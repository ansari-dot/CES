import { calendarRepository } from './calendar.repository.js';
import { timetableService } from '../timetable/timetable.service.js';
import { noticesRepository, schoolToday } from '../notices/notices.repository.js';
import { notificationService } from '../../shared/services/notificationService.js';
import { db } from '../../shared/db/knex.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { emitRealtimeEvent, RealtimeEvents } from '../../shared/realtime/eventEmitter.js';
import { auditRepository } from '../audit/audit.repository.js';

export const calendarService = {
  async getActiveSession() {
    return await db('academic_sessions').where({ is_current: 1 }).first();
  },

  async getHolidays({ sessionId, year, month, startDate, endDate }) {
    let targetSessionId = sessionId;
    if (!targetSessionId) {
      const current = await this.getActiveSession();
      targetSessionId = current?.id;
    }
    return await calendarRepository.getHolidays({
      sessionId: targetSessionId,
      year,
      month,
      startDate,
      endDate
    });
  },

  async createHoliday({
    sessionId,
    title,
    holidayType = 'PUBLIC_HOLIDAY',
    startDate,
    endDate,
    description = null,
    affectsAllClasses = true,
    createdBy
  }) {
    if (!title || !startDate || !endDate) {
      throw new AppError('Holiday title, start date, and end date are required', 400, ErrorCodes.BAD_REQUEST);
    }

    if (new Date(startDate) > new Date(endDate)) {
      throw new AppError('Start date cannot be after end date', 400, ErrorCodes.BAD_REQUEST);
    }

    let targetSessionId = sessionId;
    if (!targetSessionId) {
      const current = await this.getActiveSession();
      if (!current) {
        throw new AppError('No active academic session found', 404, ErrorCodes.NOT_FOUND);
      }
      targetSessionId = current.id;
    }

    // 1. Insert holiday record
    const holidayId = await calendarRepository.createHoliday({
      session_id: targetSessionId,
      title: title.trim(),
      holiday_type: holidayType,
      start_date: startDate,
      end_date: endDate,
      description: description ? description.trim() : null,
      affects_all_classes: affectsAllClasses ? 1 : 0,
      auto_cancelled_lessons_count: 0,
      created_by: createdBy
    });

    // 2. Automatically cancel any scheduled timetable lessons during this holiday period
    let cancelledCount = 0;
    try {
      cancelledCount = await calendarRepository.cancelScheduledLessonsForHoliday({
        startDate,
        endDate,
        title: title.trim()
      });

      // Update count on holiday
      await calendarRepository.updateHoliday(holidayId, {
        auto_cancelled_lessons_count: cancelledCount
      });
    } catch (err) {
      console.warn('[CalendarService] Warning during lesson cancellation:', err.message);
    }

    // 3. Emit Realtime events so teachers & students see instant timetable suppression & holiday popup
    emitRealtimeEvent(RealtimeEvents.TIMETABLE_CHANGE, {
      type: 'HOLIDAY_DECLARED',
      holidayId,
      title,
      startDate,
      endDate,
      cancelledCount
    }, { roles: ['TEACHER', 'STUDENT', 'PRINCIPAL'] });

    emitRealtimeEvent('HOLIDAY_ANNOUNCEMENT', {
      type: 'NEW_HOLIDAY_BREAK',
      holidayId,
      title,
      holidayType,
      startDate,
      endDate,
      description: description ? description.trim() : null,
      cancelledCount
    }, { roles: ['TEACHER', 'STUDENT', 'PRINCIPAL', 'PARENT'] });

    // 4. Automatically publish official School Notice across all portals
    try {
      const todayStr = schoolToday();
      const noticeContent = `Official Notice: ${title} (${startDate} to ${endDate}). School classes, timetable lessons, and live Zoom meetings are suspended during this break period. ${description || ''}`.trim();
      await noticesRepository.createNotice({
        title: `Holiday Break Notice: ${title}`,
        content: noticeContent,
        audience: 'School-Wide',
        targetRoles: ['Teacher', 'Student', 'Parent'],
        category: 'Holiday',
        priority: 'High',
        status: 'Published',
        publishDate: startDate <= todayStr ? todayStr : startDate,
        expiryDate: endDate,
        userId: createdBy
      });
    } catch (noticeErr) {
      console.warn('[CalendarService] Warning creating holiday notice:', noticeErr.message);
    }

    // 5. Send notifications
    try {
      notificationService.notify({
        title: `Holiday Break Announcement: ${title}`,
        message: `Official notification: ${title} from ${startDate} to ${endDate}. All classes are suspended.`,
        type: 'Holiday',
        targetRole: 'ALL',
        priority: 'High'
      });
    } catch (_) {}

    // 6. Audit Log
    try {
      await auditRepository.log({
        userId: createdBy,
        action: 'HOLIDAY_BREAK_DECLARED',
        entityType: 'academic_holidays',
        entityId: holidayId,
        details: JSON.stringify({
          title,
          holidayType,
          startDate,
          endDate,
          cancelledLessons: cancelledCount
        })
      });
    } catch (e) {
      // quiet fallback if audit schema differs
    }

    return await calendarRepository.getHolidayById(holidayId);
  },

  async updateHoliday(id, data, userId) {
    const existing = await calendarRepository.getHolidayById(id);
    if (!existing) {
      throw new AppError('Holiday break not found', 404, ErrorCodes.NOT_FOUND);
    }

    const startDate = data.startDate || existing.start_date;
    const endDate = data.endDate || existing.end_date;
    const title = data.title || existing.title;

    if (new Date(startDate) > new Date(endDate)) {
      throw new AppError('Start date cannot be after end date', 400, ErrorCodes.BAD_REQUEST);
    }

    const updated = await calendarRepository.updateHoliday(id, {
      ...(data.title && { title: data.title.trim() }),
      ...(data.holidayType && { holiday_type: data.holidayType }),
      ...(data.startDate && { start_date: data.startDate }),
      ...(data.endDate && { end_date: data.endDate }),
      ...(data.description !== undefined && { description: data.description ? data.description.trim() : null }),
      ...(data.affectsAllClasses !== undefined && { affects_all_classes: data.affectsAllClasses ? 1 : 0 })
    });

    // Re-cancel any scheduled lessons in the updated range
    try {
      const cancelledCount = await calendarRepository.cancelScheduledLessonsForHoliday({
        startDate,
        endDate,
        title
      });
      await calendarRepository.updateHoliday(id, {
        auto_cancelled_lessons_count: cancelledCount
      });
    } catch (err) {
      console.warn('[CalendarService] Error syncing cancellations after holiday update:', err.message);
    }

    emitRealtimeEvent(RealtimeEvents.TIMETABLE_CHANGE, {
      type: 'HOLIDAY_UPDATED',
      holidayId: id,
      title,
      startDate,
      endDate
    }, { roles: ['TEACHER', 'STUDENT', 'PRINCIPAL'] });

    return updated;
  },

  async deleteHoliday(id, userId) {
    const existing = await calendarRepository.getHolidayById(id);
    if (!existing) {
      throw new AppError('Holiday break not found', 404, ErrorCodes.NOT_FOUND);
    }

    await calendarRepository.deleteHoliday(id);

    // Re-publish timetable rolling window to restore lessons
    try {
      await timetableService.publishTimetable({
        sessionId: existing.session_id,
        days: 14,
        createdBy: userId
      });
    } catch (err) {
      console.warn('[CalendarService] Auto-publish on holiday removal warning:', err.message);
    }

    emitRealtimeEvent(RealtimeEvents.TIMETABLE_CHANGE, {
      type: 'HOLIDAY_REVOKED',
      holidayId: id,
      title: existing.title
    }, { roles: ['TEACHER', 'STUDENT', 'PRINCIPAL'] });

    try {
      await auditRepository.log({
        userId,
        action: 'HOLIDAY_BREAK_REVOKED',
        entityType: 'academic_holidays',
        entityId: id,
        details: JSON.stringify({
          title: existing.title,
          startDate: existing.start_date,
          endDate: existing.end_date
        })
      });
    } catch (_) {}

    return { success: true, message: 'Holiday break removed and timetable restored' };
  },

  async getCalendarOverview({ sessionId = null, year = null, month = null }) {
    const now = new Date();
    const currentYear = year ? Number(year) : now.getFullYear();
    const currentMonth = month ? Number(month) : now.getMonth() + 1;

    let targetSession = null;
    if (sessionId) {
      targetSession = await db('academic_sessions').where({ id: sessionId }).first();
    } else {
      targetSession = await this.getActiveSession();
    }

    const [holidays, terms, lessonCounts] = await Promise.all([
      calendarRepository.getHolidays({
        sessionId: targetSession?.id,
        year: currentYear,
        month: currentMonth
      }),
      targetSession ? calendarRepository.getTermsBySession(targetSession.id) : [],
      calendarRepository.getLessonCountsByMonth(currentYear, currentMonth)
    ]);

    // Map daily summary for the month
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const days = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dayPadded = String(d).padStart(2, '0');
      const monthPadded = String(currentMonth).padStart(2, '0');
      const dateString = `${currentYear}-${monthPadded}-${dayPadded}`;

      const activeHoliday = holidays.find((h) => {
        const start = String(h.start_date).split('T')[0];
        const end = String(h.end_date).split('T')[0];
        return dateString >= start && dateString <= end;
      });

      const dayLessons = lessonCounts.find((lc) => {
        const lcDate = String(lc.date).split('T')[0];
        return lcDate === dateString;
      });

      days.push({
        date: dateString,
        day: d,
        isHoliday: !!activeHoliday,
        holidayTitle: activeHoliday ? activeHoliday.title : null,
        holidayType: activeHoliday ? activeHoliday.holiday_type : null,
        holidayId: activeHoliday ? activeHoliday.id : null,
        classesOccur: !activeHoliday,
        lessonsSummary: dayLessons || {
          scheduledCount: 0,
          liveCount: 0,
          completedCount: 0,
          cancelledCount: 0,
          totalLessons: 0
        }
      });
    }

    return {
      session: targetSession,
      year: currentYear,
      month: currentMonth,
      holidays,
      terms,
      days
    };
  },

  async isDateHoliday(sessionId, dateString) {
    return await calendarRepository.isDateHoliday(sessionId, dateString);
  },

  /**
   * Fetch active/upcoming holiday announcements & popup modal for Student, Teacher, Principal & Parent
   * Same architectural logic as active examination datesheets!
   */
  async getActiveAnnouncement(user = null) {
    const todayStr = schoolToday();
    const currentSession = await this.getActiveSession();
    if (!currentSession) {
      return {
        activeHolidays: [],
        popupAnnouncement: null,
        isCurrentlyOnHoliday: false
      };
    }

    // Get all holidays in this session where end_date is >= today
    const upcomingHolidays = await db('academic_holidays')
      .leftJoin('users', 'academic_holidays.created_by', 'users.id')
      .where('academic_holidays.session_id', currentSession.id)
      .whereRaw('DATE(academic_holidays.end_date) >= DATE(?)', [todayStr])
      .select(
        'academic_holidays.*',
        'users.full_name as createdByName'
      )
      .orderBy('academic_holidays.start_date', 'asc');

    // Check if school is currently in a holiday break today
    const currentHoliday = upcomingHolidays.find((h) => {
      const s = String(h.start_date).split('T')[0];
      const e = String(h.end_date).split('T')[0];
      return todayStr >= s && todayStr <= e;
    });

    // Check for popup announcement:
    // Prioritize current holiday, or the earliest upcoming holiday starting within 14 days
    let popupAnnouncement = currentHoliday || null;
    if (!popupAnnouncement && upcomingHolidays.length > 0) {
      const earliest = upcomingHolidays[0];
      const earliestStart = new Date(String(earliest.start_date).split('T')[0]);
      const today = new Date(todayStr);
      const diffDays = Math.ceil((earliestStart.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= 14) {
        popupAnnouncement = earliest;
      }
    }

    const formatHoliday = (h) => {
      if (!h) return null;
      const startStr = String(h.start_date).split('T')[0];
      const endStr = String(h.end_date).split('T')[0];
      const sDate = new Date(startStr);
      const eDate = new Date(endStr);
      const totalDays = Math.max(1, Math.round((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

      return {
        id: h.id,
        sessionId: h.session_id,
        title: h.title,
        holidayType: h.holiday_type,
        startDate: startStr,
        endDate: endStr,
        totalDays,
        description: h.description,
        affectsAllClasses: Boolean(h.affects_all_classes),
        autoCancelledLessonsCount: Number(h.auto_cancelled_lessons_count || 0),
        createdByName: h.createdByName || 'School Administration',
        isCurrent: Boolean(todayStr >= startStr && todayStr <= endStr)
      };
    };

    return {
      activeHolidays: upcomingHolidays.map(formatHoliday),
      popupAnnouncement: formatHoliday(popupAnnouncement),
      isCurrentlyOnHoliday: Boolean(currentHoliday)
    };
  }
};

