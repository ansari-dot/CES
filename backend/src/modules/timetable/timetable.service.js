import { timetableRepository } from './timetable.repository.js';
import { zoomRepository } from '../zoom/zoom.repository.js';
import { db } from '../../shared/db/knex.js';
import { notificationService } from '../../shared/services/notificationService.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { config } from '../../config/index.js';

/**
 * Convert a school wall-clock time string "HH:MM" or "HH:MM:SS" on a given
 * date string "YYYY-MM-DD" from the school timezone to a UTC ISO string.
 * Accurate two-pass offset resolution with strict month 0-indexing.
 */
export function wallClockToUtc(dateString, timeString, schoolTimezone = config.SCHOOL_TIMEZONE || 'Asia/Karachi') {
  const [year, month, day] = dateString.split('-').map(Number);
  const timePart = timeString.length === 5 ? `${timeString}:00` : timeString;
  const [hour, minute, second = 0] = timePart.split(':').map(Number);

  // Initial UTC guess treating wall-clock components as UTC (month - 1 for 0-based month)
  const guessUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);

  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: schoolTimezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  });

  const getOffset = (instantMs) => {
    const parts = dtf.formatToParts(new Date(instantMs));
    const p = {};
    for (const part of parts) {
      if (part.type !== 'literal') p[part.type] = Number(part.value);
    }
    const localUtcMs = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
    return localUtcMs - instantMs;
  };

  const offset1 = getOffset(guessUtcMs);
  let instantMs = guessUtcMs - offset1;
  const offset2 = getOffset(instantMs);
  if (offset2 !== offset1) {
    instantMs = guessUtcMs - offset2;
  }

  return new Date(instantMs).toISOString();
}

export const timetableService = {
  async getSlots(filter = {}) {
    return await timetableRepository.getSlots(filter);
  },

  async createSlot({
    sessionId,
    classId,
    subjectId,
    teacherId,
    weekday,
    startTime,
    endTime,
    effectiveFrom,
    effectiveTo = null,
    status = 'PUBLISHED',
    createdBy
  }) {
    if (!weekday || weekday < 1 || weekday > 7) {
      throw new AppError('Valid weekday is required (1=Monday ... 7=Sunday)', 400, ErrorCodes.BAD_REQUEST, [
        { field: 'weekday', issue: 'Weekday must be between 1 (Monday) and 7 (Sunday)' }
      ]);
    }

    // 1. Conflict check: no class overlap, no teacher double-booking
    const conflict = await timetableRepository.checkSlotConflict({
      classId,
      teacherId,
      weekday,
      startTime,
      endTime
    });

    if (conflict) {
      const message =
        conflict.type === 'CLASS_CONFLICT'
          ? 'Class already has another subject scheduled during this period.'
          : 'Teacher already has another class assigned during this period.';
      throw new AppError(message, 409, ErrorCodes.SCHEDULE_CONFLICT, [
        { field: 'timeRange', issue: message }
      ]);
    }

    const slotId = await timetableRepository.createSlot({
      session_id: sessionId,
      class_id: classId,
      subject_id: subjectId,
      teacher_id: teacherId,
      weekday,
      start_time: startTime,
      end_time: endTime,
      effective_from: effectiveFrom || new Date().toISOString().split('T')[0],
      effective_to: effectiveTo,
      status,
      created_by: createdBy
    });

    await timetableRepository.logChange({
      slotId,
      changeType: 'CREATED',
      newValues: { classId, subjectId, teacherId, weekday, startTime, endTime },
      reason: 'Slot created',
      changedBy: createdBy
    });

    // Auto-generate rolling lessons so they immediately appear on teacher, student, and principal calendars
    try {
      await this.publishTimetable({ sessionId, days: 14, createdBy });
    } catch (e) {
      console.warn('[TimetableService] Auto-publish on slot creation warning:', e.message);
    }

    return await timetableRepository.findSlotById(slotId);
  },

  async updateSlot(params) {
    const { slotId, userId, reason = 'Slot updated' } = params;
    const data = params.updates ? { ...params.updates, ...params } : params;
    const {
      sessionId,
      classId,
      subjectId,
      teacherId,
      weekday,
      startTime,
      endTime,
      effectiveFrom,
      effectiveTo = null,
      status
    } = data;

    const existing = await timetableRepository.findSlotById(slotId);
    if (!existing) {
      throw new AppError('Timetable slot not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (weekday !== undefined && (weekday < 1 || weekday > 7)) {
      throw new AppError('Weekday must be between 1 (Monday) and 7 (Sunday)', 400, ErrorCodes.BAD_REQUEST);
    }

    const targetClassId = classId !== undefined ? classId : existing.classId || existing.class_id;
    const targetTeacherId = teacherId !== undefined ? teacherId : existing.teacherId || existing.teacher_id;
    const targetWeekday = weekday !== undefined ? weekday : existing.weekday;
    const targetStartTime = startTime || existing.startTime || existing.start_time;
    const targetEndTime = endTime || existing.endTime || existing.end_time;

    // Check conflict excluding this slot
    if (classId || teacherId || weekday !== undefined || startTime || endTime) {
      const conflict = await timetableRepository.checkSlotConflict({
        classId: targetClassId,
        teacherId: targetTeacherId,
        weekday: targetWeekday,
        startTime: targetStartTime,
        endTime: targetEndTime,
        excludeSlotId: slotId
      });

      if (conflict) {
        const message =
          conflict.type === 'CLASS_CONFLICT'
            ? 'Class already has another subject scheduled during this period.'
            : 'Teacher already has another class assigned during this period.';
        throw new AppError(message, 409, ErrorCodes.SCHEDULE_CONFLICT, [
          { field: 'timeRange', issue: message }
        ]);
      }
    }

    const updates = {
      ...(sessionId && { session_id: sessionId }),
      ...(classId && { class_id: classId }),
      ...(subjectId && { subject_id: subjectId }),
      ...(teacherId && { teacher_id: teacherId }),
      ...(weekday !== undefined && { weekday }),
      ...(startTime && { start_time: startTime }),
      ...(endTime && { end_time: endTime }),
      ...(effectiveFrom && { effective_from: effectiveFrom }),
      ...(effectiveTo !== undefined && { effective_to: effectiveTo }),
      ...(status && { status })
    };

    await timetableRepository.updateSlot(slotId, updates);

    // If future scheduled lessons exist for this slot, update them or cancel if weekday changed
    const schoolTz = config.SCHOOL_TIMEZONE || 'Asia/Karachi';
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: schoolTz }).format(new Date());

    const futureLessons = await db('timetable_lessons')
      .where({ slot_id: slotId })
      .where('lesson_date', '>=', todayStr);

    for (const fl of futureLessons) {
      const flWeekdayParts = new Intl.DateTimeFormat('en-US', { timeZone: schoolTz, weekday: 'short' })
        .format(new Date(fl.lesson_date + 'T12:00:00Z'));
      const flWeekday = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[flWeekdayParts];

      const newWeekday = weekday !== undefined ? weekday : existing.weekday;
      if (flWeekday !== newWeekday) {
        await timetableRepository.updateLesson(fl.id, {
          status: 'CANCELLED',
          cancel_reason: 'Slot rescheduled to a different weekday'
        });
      } else {
        const newStart = startTime || existing.startTime || existing.start_time;
        const newEnd = endTime || existing.endTime || existing.end_time;
        const startAt = new Date(wallClockToUtc(fl.lesson_date, newStart, schoolTz));
        const endAt = new Date(wallClockToUtc(fl.lesson_date, newEnd, schoolTz));
        await timetableRepository.updateLesson(fl.id, {
          class_id: classId || existing.classId || existing.class_id,
          subject_id: subjectId || existing.subjectId || existing.subject_id,
          teacher_id: teacherId || existing.teacherId || existing.teacher_id,
          start_at: startAt,
          end_at: endAt,
          status: 'SCHEDULED',
          cancel_reason: null
        });
      }
    }

    await timetableRepository.logChange({
      slotId,
      changeType: 'EDITED',
      oldValues: existing,
      newValues: updates,
      reason,
      changedBy: userId
    });

    try {
      await this.publishTimetable({ sessionId: existing.sessionId || existing.session_id || 1, days: 14, createdBy: userId });
    } catch (e) {
      console.warn('[TimetableService] Auto-publish on slot update warning:', e.message);
    }

    return await timetableRepository.findSlotById(slotId);
  },

  async deleteSlot({ slotId, userId, reason = 'Slot archived' }) {
    const existing = await timetableRepository.findSlotById(slotId);
    if (!existing) {
      throw new AppError('Timetable slot not found', 404, ErrorCodes.NOT_FOUND);
    }

    await timetableRepository.updateSlot(slotId, { status: 'ARCHIVED' });

    // Cancel future scheduled lessons created from this slot
    const schoolTz = config.SCHOOL_TIMEZONE || 'Asia/Karachi';
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: schoolTz }).format(new Date());

    await db('timetable_lessons')
      .where({ slot_id: slotId, status: 'SCHEDULED' })
      .where('lesson_date', '>=', todayStr)
      .update({
        status: 'CANCELLED',
        cancel_reason: reason || 'Timetable slot archived'
      });

    await timetableRepository.logChange({
      slotId,
      changeType: 'CANCELLED',
      oldValues: { status: existing.status },
      newValues: { status: 'ARCHIVED' },
      reason,
      changedBy: userId
    });

    return { slotId, status: 'ARCHIVED' };
  },

  async getLessons(filter = {}) {
    return await timetableRepository.getLessons(filter);
  },

  async getLessonById(id) {
    const lesson = await timetableRepository.findLessonById(id);
    if (!lesson) {
      throw new AppError('Lesson not found', 404, ErrorCodes.NOT_FOUND);
    }
    return lesson;
  },

  async publishTimetable({ sessionId, days = 14, createdBy }) {
    const schoolTz = config.SCHOOL_TIMEZONE || 'Asia/Karachi';
    const slots = await timetableRepository.getSlots({ sessionId });
    const publishedSlots = slots.filter((s) => s.status === 'PUBLISHED');
    const generatedLessons = [];

    // Calculate dates in the school's configured source timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: schoolTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const todaySchoolStr = formatter.format(now);
    const [startYear, startMonth, startDay] = todaySchoolStr.split('-').map(Number);

    for (let dayOffset = 0; dayOffset < days; dayOffset++) {
      const targetDate = new Date(Date.UTC(startYear, startMonth - 1, startDay + dayOffset, 12, 0, 0));
      const dateString = formatter.format(targetDate);

      const dayParts = new Intl.DateTimeFormat('en-US', {
        timeZone: schoolTz,
        weekday: 'short'
      }).format(targetDate);

      const weekdayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
      const srsWeekday = weekdayMap[dayParts] || 1;

      const matchingSlots = publishedSlots.filter((s) => s.weekday === srsWeekday);

      for (const slot of matchingSlots) {
        const classMeeting = await zoomRepository.getMeetingByClassId(slot.classId);

        // Convert school wall-clock time (Pakistan/Asia/Karachi) to UTC for storage.
        // Clients receive UTC and convert to their local timezone for display.
        const startAt = new Date(wallClockToUtc(dateString, slot.startTime, schoolTz));
        const endAt = new Date(wallClockToUtc(dateString, slot.endTime, schoolTz));

        try {
          const lessonId = await timetableRepository.createLesson({
            slot_id: slot.id,
            class_id: slot.classId,
            subject_id: slot.subjectId,
            teacher_id: slot.teacherId,
            zoom_meeting_id: classMeeting ? classMeeting.id : null,
            lesson_date: dateString,
            start_at: startAt,
            end_at: endAt,
            status: 'SCHEDULED'
          });
          generatedLessons.push(lessonId);
        } catch {
          // If lesson already exists for this slot on this date, synchronize its parameters
          try {
            await db('timetable_lessons')
              .where({ slot_id: slot.id, lesson_date: dateString })
              .update({
                class_id: slot.classId,
                subject_id: slot.subjectId,
                teacher_id: slot.teacherId,
                zoom_meeting_id: classMeeting ? classMeeting.id : null,
                start_at: startAt,
                end_at: endAt
              });
          } catch (_) {}
        }
      }
    }

    await timetableRepository.logChange({
      changeType: 'PUBLISHED',
      newValues: { sessionId, days, generatedCount: generatedLessons.length },
      reason: 'Published timetable and generated rolling window lessons',
      changedBy: createdBy
    });

    const slotIds = slots.map((s) => s.id);
    let totalScheduledCount = generatedLessons.length;
    if (slotIds.length > 0) {
      const activeRows = await db('timetable_lessons')
        .whereIn('slot_id', slotIds)
        .count('* as count')
        .first();
      totalScheduledCount = Math.max(generatedLessons.length, Number(activeRows?.count || 0));
    }

    notificationService.notify({
      title: 'Academic Timetable Published',
      message: `Timetable published covering a ${days}-day rolling window with ${totalScheduledCount} scheduled lessons.`,
      type: 'Timetable Change',
      targetRole: 'TEACHER',
      relatedRecordId: sessionId,
      relatedRecordType: 'Timetable',
      priority: 'Medium'
    });

    return {
      message: `Generated ${generatedLessons.length} new lessons (${totalScheduledCount} total active) for ${days} days rolling window`,
      count: totalScheduledCount,
      newCount: generatedLessons.length
    };
  },

  async cancelLesson({ lessonId, reason, userId }) {
    const lesson = await timetableRepository.findLessonById(lessonId);
    if (!lesson) throw new AppError('Lesson not found', 404, ErrorCodes.NOT_FOUND);

    await timetableRepository.updateLesson(lessonId, {
      status: 'CANCELLED',
      cancel_reason: reason || 'Cancelled by administration'
    });

    await timetableRepository.logChange({
      lessonId,
      changeType: 'CANCELLED',
      oldValues: { status: lesson.status },
      newValues: { status: 'CANCELLED', cancel_reason: reason },
      reason,
      changedBy: userId
    });

    notificationService.notify({
      title: 'Scheduled Lesson Cancelled',
      message: `Lesson #${lessonId} scheduled for ${lesson.lesson_date || 'scheduled date'} was cancelled: ${reason || 'Administrative update'}.`,
      type: 'Timetable Change',
      targetRole: 'ALL',
      relatedRecordId: lessonId,
      relatedRecordType: 'Timetable',
      priority: 'High'
    });

    return { lessonId, status: 'CANCELLED' };
  },

  async substituteTeacher({ lessonId, substituteTeacherId, reason, userId }) {
    const lesson = await timetableRepository.findLessonById(lessonId);
    if (!lesson) throw new AppError('Lesson not found', 404, ErrorCodes.NOT_FOUND);

    await timetableRepository.updateLesson(lessonId, {
      substitute_teacher_id: substituteTeacherId
    });

    await timetableRepository.logChange({
      lessonId,
      changeType: 'SUBSTITUTED',
      oldValues: { teacher_id: lesson.teacher_id, substitute_teacher_id: lesson.substitute_teacher_id },
      newValues: { substitute_teacher_id: substituteTeacherId },
      reason: reason || 'Substitute teacher assigned',
      changedBy: userId
    });

    let subUserId = null;
    try {
      const subTeacher = await db('teachers').where({ id: substituteTeacherId }).first();
      subUserId = subTeacher?.user_id;
    } catch (_) {}

    notificationService.notify({
      userId: subUserId,
      title: 'Substitute Teaching Duty Assigned',
      message: `You have been assigned as substitute instructor for Lesson #${lessonId}. Reason: ${reason || 'Institutional allocation'}.`,
      type: 'Substitute Assigned',
      targetRole: 'TEACHER',
      relatedRecordId: lessonId,
      relatedRecordType: 'Timetable',
      priority: 'High'
    });

    return { lessonId, substituteTeacherId };
  }
};
