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
      status = 'DRAFT',
      entries = []
    } = payload;

    if (!examType || !['MONTHLY_TEST', 'MID_TERM', 'FINAL_TERM'].includes(examType)) {
      throw new AppError('Valid exam type is required (MONTHLY_TEST, MID_TERM, FINAL_TERM)', 422, ErrorCodes.VALIDATION_ERROR);
    }
    if (!title || !title.trim()) {
      throw new AppError('Examination title is required', 422, ErrorCodes.VALIDATION_ERROR);
    }

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
      orderIndex: e.orderIndex !== undefined ? Number(e.orderIndex) : idx
    }));

    const dateSheetId = await datesheetsRepository.createDateSheet(
      {
        academic_session_id: sessionId,
        exam_type: examType,
        title: title.trim(),
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
      reason: `Created ${examType} date sheet: "${title}" with ${normalizedEntries.length} papers.`
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
      status,
      entries
    } = payload;

    const headerUpdates = {};
    if (academicSessionId) headerUpdates.academic_session_id = academicSessionId;
    if (examType && ['MONTHLY_TEST', 'MID_TERM', 'FINAL_TERM'].includes(examType)) headerUpdates.exam_type = examType;
    if (title && title.trim()) headerUpdates.title = title.trim();
    if (description !== undefined) headerUpdates.description = description ? description.trim() : null;

    if (status) {
      headerUpdates.status = status;
      headerUpdates.is_published = status === 'PUBLISHED' ? 1 : 0;
      if (status === 'PUBLISHED' && !existing.published_at) {
        headerUpdates.published_at = new Date();
      }
    }

    let normalizedEntries = null;
    if (Array.isArray(entries)) {
      normalizedEntries = entries.map((e, idx) => ({
        classId: Number(e.classId),
        subjectId: Number(e.subjectId),
        teacherId: e.teacherId ? Number(e.teacherId) : null,
        examDate: e.examDate,
        dayOfWeek: e.dayOfWeek || computeDayOfWeek(e.examDate),
        startTime: e.startTime || '08:00 AM',
        endTime: e.endTime || '10:00 AM',
        subjectType: e.subjectType || 'Scholastic',
        instructions: e.instructions || null,
        orderIndex: e.orderIndex !== undefined ? Number(e.orderIndex) : idx
      }));
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
      reason: `Updated date sheet: "${existing.title}".`
    }).catch(() => {});

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

    // Find the latest active date sheet for the announcement popup
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
   * Broadcast notification to enrolled students and teachers
   */
  async broadcastDateSheetAnnouncement(dateSheetId, title, examType) {
    try {
      const entries = await db('date_sheet_entries').where({ date_sheet_id: dateSheetId });
      const classIds = [...new Set(entries.map((e) => e.class_id))];

      if (classIds.length === 0) return;

      // Find all active student user IDs enrolled in these classes
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

