import { datesheetsRepository } from './datesheets.repository.js';
import { db } from '../../shared/db/knex.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { notificationService } from '../../shared/services/notificationService.js';
import { auditRepository } from '../audit/audit.repository.js';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function computeDayOfWeek(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return WEEKDAYS[d.getUTCDay()] || WEEKDAYS[d.getDay()];
}

function parseTimeToMinutes(t) {
  if (!t) return 0;
  const match = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return 0;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const meridian = match[3] ? match[3].toUpperCase() : null;
  if (meridian === 'PM' && h < 12) h += 12;
  if (meridian === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

function timesOverlap(s1, e1, s2, e2) {
  const start1 = parseTimeToMinutes(s1);
  const end1 = parseTimeToMinutes(e1);
  const start2 = parseTimeToMinutes(s2);
  const end2 = parseTimeToMinutes(e2);
  return start1 < end2 && start2 < end1;
}

function detectMultipleExamsOnSingleDay(entries) {
  const map = new Map();
  for (const e of entries) {
    const key = `${e.class_id || e.classId}_${e.exam_date || e.examDate}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(e);
  }

  const conflicts = [];
  for (const [key, group] of map.entries()) {
    if (group.length > 1) {
      conflicts.push({
        classId: group[0].class_id || group[0].classId,
        className: group[0].class_name,
        examDate: group[0].exam_date || group[0].examDate,
        dayOfWeek: group[0].day_of_week || group[0].dayOfWeek,
        exams: group.map((g) => ({
          subjectName: g.subject_name || g.subjectName,
          subjectCode: g.subject_code || g.subjectCode,
          startTime: g.start_time || g.startTime,
          endTime: g.end_time || g.endTime
        }))
      });
    }
  }
  return conflicts;
}

export const datesheetsService = {
  /**
   * List all examination date sheets with filters
   */
  async listDateSheets(filters = {}) {
    return datesheetsRepository.listDateSheets(filters);
  },

  /**
   * Get single date sheet with all classes and subjects
   */
  async getDateSheetDetails(id) {
    const sheet = await datesheetsRepository.getDateSheetById(id);
    if (!sheet) {
      throw new AppError('Examination date sheet not found', 404, ErrorCodes.NOT_FOUND);
    }

    const multipleExams = detectMultipleExamsOnSingleDay(sheet.entries || []);

    return {
      ...sheet,
      multipleExamsAttention: multipleExams
    };
  },

  /**
   * Create a new date sheet with multi-class entries
   */
  async createDateSheet(payload, user) {
    const {
      academicSessionId,
      examType,
      title,
      description,
      startDate: userStartDate,
      endDate: userEndDate,
      status = 'DRAFT',
      entries = []
    } = payload;

    if (!examType || !['MONTHLY_TEST', 'CLASS_QUIZ', 'MID_TERM', 'FINAL_TERM'].includes(examType)) {
      throw new AppError('Valid exam type is required (MONTHLY_TEST, CLASS_QUIZ, MID_TERM, FINAL_TERM)', 422, ErrorCodes.VALIDATION_ERROR);
    }
    if (!title || !title.trim()) {
      throw new AppError('Examination title is required', 422, ErrorCodes.VALIDATION_ERROR);
    }

    // Determine scheduling mode based on category
    const isDedicatedExam = examType === 'MID_TERM' || examType === 'FINAL_TERM';
    const schedulingMode = isDedicatedExam ? 'DEDICATED_EXAM' : 'TIMETABLE_ASSESSMENT';

    // Resolve active academic session if not provided
    let sessionId = academicSessionId;
    if (!sessionId) {
      const activeSession = await db('academic_sessions').where({ is_current: 1 }).first();
      sessionId = activeSession ? activeSession.id : 1;
    }

    const isPublished = status === 'PUBLISHED';
    const publishedAt = isPublished ? new Date() : null;

    // Normalize entries
    const normalizedEntries = (entries || []).map((e, idx) => ({
      classId: Number(e.classId),
      subjectId: Number(e.subjectId),
      teacherId: e.teacherId ? Number(e.teacherId) : null,
      examDate: e.examDate,
      dayOfWeek: e.dayOfWeek || computeDayOfWeek(e.examDate),
      startTime: e.startTime || '08:00 AM',
      endTime: e.endTime || '10:00 AM',
      subjectType: e.subjectType || 'Scholastic',
      instructions: e.instructions || null,
      timetableSlotId: e.timetableSlotId ? Number(e.timetableSlotId) : null,
      assessmentTiming: e.assessmentTiming || (isDedicatedExam ? 'STANDALONE' : 'ENTIRE_LECTURE'),
      durationMinutes: e.durationMinutes ? Number(e.durationMinutes) : null,
      isDateChanged: false,
      orderIndex: e.orderIndex !== undefined ? Number(e.orderIndex) : idx
    }));

    // 1. Mandatory Rule for Dedicated Exams: One Subject Per Class Per Day
    if (isDedicatedExam && normalizedEntries.length > 0) {
      const classDateMap = new Set();
      for (const e of normalizedEntries) {
        const key = `${e.classId}_${e.examDate}`;
        if (classDateMap.has(key)) {
          throw new AppError(
            `Validation error: Class ${e.classId} has multiple examinations scheduled on ${e.examDate}. For Mid-Term and Final-Term examinations, each class can have only one examination subject per day.`,
            422,
            ErrorCodes.VALIDATION_ERROR
          );
        }
        classDateMap.add(key);
      }
    }

    // 2. Teacher Conflict Prevention: No simultaneous exams for the same teacher
    for (let i = 0; i < normalizedEntries.length; i++) {
      for (let j = i + 1; j < normalizedEntries.length; j++) {
        const e1 = normalizedEntries[i];
        const e2 = normalizedEntries[j];
        if (e1.teacherId && e2.teacherId && Number(e1.teacherId) === Number(e2.teacherId)) {
          if (e1.examDate === e2.examDate && timesOverlap(e1.startTime, e1.endTime, e2.startTime, e2.endTime)) {
            throw new AppError(
              `Validation error: Teacher is assigned to multiple simultaneous examinations on ${e1.examDate} between ${e1.startTime} and ${e1.endTime}. A teacher cannot invigilate multiple examinations simultaneously.`,
              422,
              ErrorCodes.VALIDATION_ERROR
            );
          }
        }
      }
    }

    // 3. Resolve start_date and end_date for School-Wide Exam Mode
    let finalStartDate = userStartDate || null;
    let finalEndDate = userEndDate || null;
    if (normalizedEntries.length > 0) {
      const dates = normalizedEntries.map((e) => e.examDate).filter(Boolean).sort();
      if (!finalStartDate && dates.length > 0) finalStartDate = dates[0];
      if (!finalEndDate && dates.length > 0) finalEndDate = dates[dates.length - 1];
    }

    const dateSheetId = await datesheetsRepository.createDateSheet(
      {
        academic_session_id: sessionId,
        exam_type: examType,
        scheduling_mode: schedulingMode,
        title: title.trim(),
        start_date: finalStartDate,
        end_date: finalEndDate,
        description: description ? description.trim() : null,
        status,
        is_published: isPublished ? 1 : 0,
        published_at: publishedAt,
        created_by: user.id
      },
      normalizedEntries
    );

    // Audit Log
    await auditRepository.recordAuditLog({
      actorId: user.id,
      actorName: user.name || user.full_name || 'Principal',
      actorRole: user.role_code || 'Principal',
      action: 'CREATE_DATE_SHEET',
      recordType: 'EXAMINATION_DATE_SHEET',
      recordIdentifier: `EDS-${dateSheetId}`,
      reason: `Created ${examType} (${schedulingMode}) date sheet: "${title}" with ${normalizedEntries.length} papers.`
    }).catch(() => {});

    // Notify users if published immediately
    if (isPublished) {
      await this.broadcastDateSheetAnnouncement(dateSheetId, title, examType).catch(() => {});
    }

    return this.getDateSheetDetails(dateSheetId);
  },

  /**
   * Update date sheet and replace schedule entries
   */
  async updateDateSheet(id, payload, user) {
    const existing = await datesheetsRepository.getDateSheetById(id);
    if (!existing) {
      throw new AppError('Examination date sheet not found', 404, ErrorCodes.NOT_FOUND);
    }

    const {
      academicSessionId,
      examType,
      title,
      description,
      startDate: userStartDate,
      endDate: userEndDate,
      status,
      entries
    } = payload;

    const targetExamType = examType || existing.exam_type;
    const isDedicatedExam = targetExamType === 'MID_TERM' || targetExamType === 'FINAL_TERM';
    const schedulingMode = isDedicatedExam ? 'DEDICATED_EXAM' : 'TIMETABLE_ASSESSMENT';

    const headerUpdates = {};
    if (academicSessionId) headerUpdates.academic_session_id = academicSessionId;
    if (examType && ['MONTHLY_TEST', 'CLASS_QUIZ', 'MID_TERM', 'FINAL_TERM'].includes(examType)) {
      headerUpdates.exam_type = examType;
      headerUpdates.scheduling_mode = schedulingMode;
    }
    if (title && title.trim()) headerUpdates.title = title.trim();
    if (description !== undefined) headerUpdates.description = description ? description.trim() : null;
    if (userStartDate) headerUpdates.start_date = userStartDate;
    if (userEndDate) headerUpdates.end_date = userEndDate;

    if (status) {
      headerUpdates.status = status;
      headerUpdates.is_published = status === 'PUBLISHED' ? 1 : 0;
      if (status === 'PUBLISHED' && !existing.published_at) {
        headerUpdates.published_at = new Date();
      }
    }

    let normalizedEntries = null;
    const changedEntries = [];

    if (Array.isArray(entries)) {
      normalizedEntries = entries.map((e, idx) => {
        // Compare with existing entries to track date/time changes
        const prev = (existing.entries || []).find(
          (old) => Number(old.class_id) === Number(e.classId) && Number(old.subject_id) === Number(e.subjectId)
        );

        let isDateChanged = false;
        let previousExamDate = null;
        let previousStartTime = null;
        let previousEndTime = null;

        if (prev) {
          const dateChanged = prev.exam_date !== e.examDate;
          const timeChanged = prev.start_time !== e.startTime || prev.end_time !== e.endTime;
          if (dateChanged || timeChanged) {
            isDateChanged = true;
            previousExamDate = prev.exam_date;
            previousStartTime = prev.start_time;
            previousEndTime = prev.end_time;
            changedEntries.push({
              classId: e.classId,
              subjectName: prev.subject_name,
              oldDate: prev.exam_date,
              newDate: e.examDate,
              oldTime: `${prev.start_time} - ${prev.end_time}`,
              newTime: `${e.startTime} - ${e.endTime}`
            });
          }
        }

        return {
          classId: Number(e.classId),
          subjectId: Number(e.subjectId),
          teacherId: e.teacherId ? Number(e.teacherId) : null,
          examDate: e.examDate,
          dayOfWeek: e.dayOfWeek || computeDayOfWeek(e.examDate),
          startTime: e.startTime || '08:00 AM',
          endTime: e.endTime || '10:00 AM',
          subjectType: e.subjectType || 'Scholastic',
          instructions: e.instructions || null,
          timetableSlotId: e.timetableSlotId ? Number(e.timetableSlotId) : null,
          assessmentTiming: e.assessmentTiming || (isDedicatedExam ? 'STANDALONE' : 'ENTIRE_LECTURE'),
          durationMinutes: e.durationMinutes ? Number(e.durationMinutes) : null,
          isDateChanged,
          previousExamDate,
          previousStartTime,
          previousEndTime,
          orderIndex: e.orderIndex !== undefined ? Number(e.orderIndex) : idx
        };
      });

      // 1. Mandatory Rule for Dedicated Exams: One Subject Per Class Per Day
      if (isDedicatedExam && normalizedEntries.length > 0) {
        const classDateMap = new Set();
        for (const e of normalizedEntries) {
          const key = `${e.classId}_${e.examDate}`;
          if (classDateMap.has(key)) {
            throw new AppError(
              `Validation error: Class ${e.classId} has multiple examinations scheduled on ${e.examDate}. For Mid-Term and Final-Term examinations, each class can have only one examination subject per day.`,
              422,
              ErrorCodes.VALIDATION_ERROR
            );
          }
          classDateMap.add(key);
        }
      }

      // 2. Teacher Conflict Prevention
      for (let i = 0; i < normalizedEntries.length; i++) {
        for (let j = i + 1; j < normalizedEntries.length; j++) {
          const e1 = normalizedEntries[i];
          const e2 = normalizedEntries[j];
          if (e1.teacherId && e2.teacherId && Number(e1.teacherId) === Number(e2.teacherId)) {
            if (e1.examDate === e2.examDate && timesOverlap(e1.startTime, e1.endTime, e2.startTime, e2.endTime)) {
              throw new AppError(
                `Validation error: Teacher is assigned to multiple simultaneous examinations on ${e1.examDate} between ${e1.startTime} and ${e1.endTime}. A teacher cannot invigilate multiple examinations simultaneously.`,
                422,
                ErrorCodes.VALIDATION_ERROR
              );
            }
          }
        }
      }

      // Update start_date and end_date if not explicitly provided
      if (!headerUpdates.start_date && normalizedEntries.length > 0) {
        const dates = normalizedEntries.map((e) => e.examDate).filter(Boolean).sort();
        if (dates.length > 0) {
          headerUpdates.start_date = dates[0];
          headerUpdates.end_date = dates[dates.length - 1];
        }
      }
    }

    await datesheetsRepository.updateDateSheet(id, headerUpdates, normalizedEntries);

    // Audit Log
    await auditRepository.recordAuditLog({
      actorId: user.id,
      actorName: user.name || user.full_name || 'Principal',
      actorRole: user.role_code || 'Principal',
      action: 'UPDATE_DATE_SHEET',
      recordType: 'EXAMINATION_DATE_SHEET',
      recordIdentifier: `EDS-${id}`,
      reason: `Updated date sheet: "${existing.title}". ${changedEntries.length > 0 ? `${changedEntries.length} examination date(s) changed.` : ''}`
    }).catch(() => {});

    // Notify users if dates changed on a published date sheet
    if (existing.is_published && changedEntries.length > 0) {
      await this.notifyScheduleDateChanges(id, existing.title, changedEntries).catch(() => {});
    }

    return this.getDateSheetDetails(id);
  },

  /**
   * Toggle Publish / Hide status
   */
  async togglePublishStatus(id, { isPublished }, user) {
    const existing = await datesheetsRepository.getDateSheetById(id);
    if (!existing) {
      throw new AppError('Examination date sheet not found', 404, ErrorCodes.NOT_FOUND);
    }

    const newStatus = isPublished ? 'PUBLISHED' : 'HIDDEN';
    const publishedAt = isPublished ? (existing.published_at || new Date()) : existing.published_at;

    await datesheetsRepository.setPublishStatus(id, {
      status: newStatus,
      isPublished: Boolean(isPublished),
      publishedAt
    });

    // Audit Log
    await auditRepository.recordAuditLog({
      actorId: user.id,
      actorName: user.name || user.full_name || 'Principal',
      actorRole: user.role_code || 'Principal',
      action: isPublished ? 'PUBLISH_DATE_SHEET' : 'HIDE_DATE_SHEET',
      recordType: 'EXAMINATION_DATE_SHEET',
      recordIdentifier: `EDS-${id}`,
      reason: `${isPublished ? 'Published/Unhid' : 'Hidden'} date sheet: "${existing.title}".`
    }).catch(() => {});

    // Send notifications when unhidden / published
    if (isPublished) {
      await this.broadcastDateSheetAnnouncement(id, existing.title, existing.exam_type).catch(() => {});
    }

    return this.getDateSheetDetails(id);
  },

  /**
   * Delete date sheet
   */
  async deleteDateSheet(id, user) {
    const existing = await datesheetsRepository.getDateSheetById(id);
    if (!existing) {
      throw new AppError('Examination date sheet not found', 404, ErrorCodes.NOT_FOUND);
    }

    await datesheetsRepository.deleteDateSheet(id);

    // Audit Log
    await auditRepository.recordAuditLog({
      actorId: user.id,
      actorName: user.name || user.full_name || 'Principal',
      actorRole: user.role_code || 'Principal',
      action: 'DELETE_DATE_SHEET',
      recordType: 'EXAMINATION_DATE_SHEET',
      recordIdentifier: `EDS-${id}`,
      reason: `Permanently deleted date sheet: "${existing.title}".`
    }).catch(() => {});

    return { success: true };
  },

  /**
   * Check if the entire school is currently in School-Wide Exam Mode for a given date
   * Used by Zoom Scheduler to suppress regular timetable lectures, handovers & false absences
   */
  async isSchoolInExamPeriod(dateStr) {
    if (!dateStr) return { inExamMode: false };

    // Check published DEDICATED_EXAM date sheets (Mid-Term / Final-Term)
    const activeExamSheet = await db('examination_date_sheets as eds')
      .where('eds.is_published', 1)
      .andWhere('eds.status', 'PUBLISHED')
      .andWhere('eds.scheduling_mode', 'DEDICATED_EXAM')
      .andWhere(function () {
        this.where(function () {
          this.where('eds.start_date', '<=', dateStr).andWhere('eds.end_date', '>=', dateStr);
        }).orWhereExists(function () {
          this.select('id')
            .from('date_sheet_entries as dse')
            .whereRaw('dse.date_sheet_id = eds.id')
            .andWhere('dse.exam_date', dateStr);
        });
      })
      .first();

    if (activeExamSheet) {
      return {
        inExamMode: true,
        examType: activeExamSheet.exam_type,
        title: activeExamSheet.title,
        dateSheetId: activeExamSheet.id,
        startDate: activeExamSheet.start_date,
        endDate: activeExamSheet.end_date
      };
    }

    return { inExamMode: false };
  },

  /**
   * Fetch active published date sheets for student
   */
  async getStudentActiveDateSheets(studentUserId) {
    const classId = await datesheetsRepository.getStudentClassId(studentUserId);
    if (!classId) {
      return { activeDateSheets: [], popupAnnouncement: null };
    }

    const sheets = await datesheetsRepository.getStudentActiveDateSheets(classId);

    // Format each sheet with multiple exams detection
    const formattedSheets = sheets.map((sheet) => ({
      ...sheet,
      multipleExamsAttention: detectMultipleExamsOnSingleDay(sheet.entries || [])
    }));

    const popupAnnouncement = formattedSheets.length > 0 ? formattedSheets[0] : null;

    return {
      studentClassId: classId,
      activeDateSheets: formattedSheets,
      popupAnnouncement
    };
  },

  /**
   * Fetch active published date sheets for teacher (filtered strictly by assigned classes and subjects)
   */
  async getTeacherActiveDateSheets(teacherUserId) {
    const { teacherId, assignments } = await datesheetsRepository.getTeacherAssignedClassSubjects(teacherUserId);
    if (!teacherId) {
      return { activeDateSheets: [], popupAnnouncement: null };
    }

    const sheets = await datesheetsRepository.getTeacherActiveDateSheets(teacherId, assignments);

    const formattedSheets = sheets.map((sheet) => ({
      ...sheet,
      multipleExamsAttention: detectMultipleExamsOnSingleDay(sheet.entries || [])
    }));

    const popupAnnouncement = formattedSheets.length > 0 ? formattedSheets[0] : null;

    return {
      teacherId,
      activeDateSheets: formattedSheets,
      popupAnnouncement
    };
  },

  /**
   * Notify users about date/time changes
   */
  async notifyScheduleDateChanges(dateSheetId, title, changedEntries) {
    try {
      const classIds = [...new Set(changedEntries.map((c) => c.classId))];
      if (classIds.length === 0) return;

      const studentUsers = await db('students as s')
        .join('enrollments as e', 's.id', 'e.student_id')
        .whereIn('e.class_id', classIds)
        .andWhere('e.status', 'ACTIVE')
        .select('s.user_id');

      const userIds = studentUsers.map((u) => u.user_id);
      if (userIds.length > 0) {
        await notificationService.notifyUsers(userIds, {
          title: `Examination Rescheduled: ${title}`,
          message: `Important: The examination schedule has been updated. Please verify your new examination dates on the Date Sheet page.`,
          type: 'EXAM_RESCHEDULED'
        });
      }
    } catch (err) {
      console.warn('Failed to notify users about schedule changes:', err);
    }
  },

  /**
   * Broadcast notification to enrolled students and teachers
   */
  async broadcastDateSheetAnnouncement(dateSheetId, title, examType) {
    try {
      const entries = await db('date_sheet_entries').where({ date_sheet_id: dateSheetId });
      const classIds = [...new Set(entries.map((e) => e.class_id))];

      if (classIds.length === 0) return;

      const studentUsers = await db('students as s')
        .join('enrollments as e', 's.id', 'e.student_id')
        .whereIn('e.class_id', classIds)
        .andWhere('e.status', 'ACTIVE')
        .select('s.user_id');

      const teacherUsers = await db('teachers as t')
        .join('date_sheet_entries as dse', 't.id', 'dse.teacher_id')
        .where('dse.date_sheet_id', dateSheetId)
        .select('t.user_id');

      const userIds = [...new Set([...studentUsers.map((u) => u.user_id), ...teacherUsers.map((u) => u.user_id)])];

      if (userIds.length > 0) {
        await notificationService.notifyUsers(userIds, {
          title: `Examination Date Sheet Published: ${title}`,
          message: `The official ${examType.replace('_', ' ')} examination schedule has been announced. Please review your timetable.`,
          type: 'EXAM_ANNOUNCEMENT'
        });
      }
    } catch (err) {
      console.warn('Failed to dispatch date sheet broadcast notifications:', err);
    }
  }
};
