import {
  calendarRepository,
  CALENDAR_EVENT_TYPES,
  HOLIDAY_EVENT_TYPES,
  TARGET_AUDIENCES,
  eventAppliesToAllClasses,
  eventClassIds,
  eventSuspendsClasses,
  toDateKey
} from './calendar.repository.js';
import { noticesRepository, schoolToday } from '../notices/notices.repository.js';
import { notificationService } from '../../shared/services/notificationService.js';
import { db } from '../../shared/db/knex.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { emitRealtimeEvent, RealtimeEvents } from '../../shared/realtime/eventEmitter.js';
import { getSocketServer } from '../../shared/realtime/socket.js';
import { auditRepository } from '../audit/audit.repository.js';
import { getTeacherScope, getParentChildren, getStudentByUserId, isStaff } from '../../shared/services/accessScope.js';

export const CALENDAR_UPDATED_EVENT = 'calendar.updated';

const EVENT_TYPE_LABELS = {
  VACATION: 'School Vacation',
  PUBLIC_HOLIDAY: 'Public Holiday',
  EMERGENCY_CLOSURE: 'Emergency Holiday',
  SPECIAL_HOLIDAY: 'Special Holiday',
  EXAMINATION: 'Examination',
  SCHOOL_EVENT: 'School Event',
  PARENT_MEETING: 'Parent Meeting',
  ANNOUNCEMENT: 'Announcement',
  INSTITUTIONAL_BREAK: 'Institutional Break',
  EXAM_PREP: 'Exam Preparation Break'
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const AUDIENCE_ROLES = {
  ALL: ['STUDENT', 'PARENT', 'TEACHER'],
  STUDENTS: ['STUDENT'],
  PARENTS: ['PARENT'],
  STUDENTS_PARENTS: ['STUDENT', 'PARENT'],
  TEACHERS: ['TEACHER'],
  STAFF: ['TEACHER']
};

function badRequest(message) {
  return new AppError(message, 400, ErrorCodes.BAD_REQUEST);
}

function bool(value, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'string') return ['true', '1', 'yes'].includes(value.toLowerCase());
  return Boolean(value);
}

function formatRange(startDate, endDate) {
  return startDate === endDate ? startDate : `${startDate} to ${endDate}`;
}

/** Validates and normalises an event payload into DB columns. */
async function buildEventColumns(input, existing = null) {
  const pick = (key, column) => (input[key] !== undefined ? input[key] : existing ? existing[column] : undefined);

  const title = String(pick('title', 'title') || '').trim();
  const eventType = String(input.eventType || input.holidayType || existing?.event_type || existing?.holiday_type || 'PUBLIC_HOLIDAY').toUpperCase();
  const startDate = toDateKey(pick('startDate', 'start_date'));
  const endDate = toDateKey(pick('endDate', 'end_date')) || startDate;

  if (!title) throw badRequest('Event title is required');
  if (title.length > 120) throw badRequest('Event title must be at most 120 characters');
  if (!CALENDAR_EVENT_TYPES.includes(eventType)) throw badRequest(`Event type must be one of: ${CALENDAR_EVENT_TYPES.join(', ')}`);
  if (!startDate || !DATE_RE.test(startDate) || !endDate || !DATE_RE.test(endDate)) {
    throw badRequest('Start date and end date are required (YYYY-MM-DD)');
  }
  if (startDate > endDate) throw badRequest('Start date cannot be after end date');

  const isHolidayType = HOLIDAY_EVENT_TYPES.includes(eventType);

  let startTime = input.startTime !== undefined ? input.startTime || null : existing?.start_time || null;
  let endTime = input.endTime !== undefined ? input.endTime || null : existing?.end_time || null;
  if (startTime && !TIME_RE.test(String(startTime))) throw badRequest('Start time must be HH:MM');
  if (endTime && !TIME_RE.test(String(endTime))) throw badRequest('End time must be HH:MM');
  if ((startTime && !endTime) || (!startTime && endTime)) throw badRequest('Provide both start and end time, or neither');
  if (startTime && endTime && String(startTime).slice(0, 5) >= String(endTime).slice(0, 5)) {
    throw badRequest('End time must be after start time');
  }

  const isFullDayHoliday = bool(
    input.isFullDayHoliday,
    existing ? Boolean(Number(existing.is_full_day_holiday ?? 1)) : isHolidayType && !startTime
  );
  if (isFullDayHoliday) {
    startTime = null;
    endTime = null;
  }

  // Classes are only suspended when explicitly requested, defaulting to "yes" for holiday types
  const classesSuspended = bool(
    input.classesSuspended,
    existing ? Boolean(Number(existing.classes_suspended ?? 1)) : isHolidayType
  );
  if (classesSuspended && !isFullDayHoliday && !startTime) {
    throw badRequest('A partial-day suspension needs a start and end time');
  }

  const targetAudience = String(input.targetAudience || existing?.target_audience || 'ALL').toUpperCase();
  if (!TARGET_AUDIENCES.includes(targetAudience)) throw badRequest(`Target audience must be one of: ${TARGET_AUDIENCES.join(', ')}`);

  let classIds = input.classIds !== undefined ? input.classIds : existing ? eventClassIds(existing) : null;
  classIds = Array.isArray(classIds) ? Array.from(new Set(classIds.map(Number).filter(Boolean))) : [];
  let affectsAllClasses = bool(input.affectsAllClasses, existing ? eventAppliesToAllClasses(existing) : classIds.length === 0);
  if (affectsAllClasses) classIds = [];
  if (!affectsAllClasses && classIds.length === 0) throw badRequest('Select at least one class, or apply the event school-wide');
  if (classIds.length > 0) {
    const found = await db('classes').whereIn('id', classIds).pluck('id');
    const missing = classIds.filter((id) => !found.map(Number).includes(id));
    if (missing.length > 0) throw badRequest(`Unknown class id(s): ${missing.join(', ')}`);
  }
  affectsAllClasses = classIds.length === 0;

  const description = input.description !== undefined
    ? (input.description ? String(input.description).trim().slice(0, 500) : null)
    : existing?.description || null;

  return {
    title,
    holiday_type: eventType,
    event_type: eventType,
    start_date: startDate,
    end_date: endDate,
    start_time: startTime ? String(startTime).slice(0, 5) : null,
    end_time: endTime ? String(endTime).slice(0, 5) : null,
    description,
    target_audience: targetAudience,
    class_ids: classIds.length > 0 ? JSON.stringify(classIds) : null,
    affects_all_classes: affectsAllClasses ? 1 : 0,
    is_full_day_holiday: isFullDayHoliday ? 1 : 0,
    classes_suspended: classesSuspended ? 1 : 0,
    send_notification: bool(input.sendNotification, existing ? Boolean(Number(existing.send_notification ?? 1)) : true) ? 1 : 0,
    is_published: bool(input.isPublished, existing ? Boolean(Number(existing.is_published ?? 1)) : true) ? 1 : 0
  };
}

function classScopesOverlap(a, b) {
  if (eventAppliesToAllClasses(a) || eventAppliesToAllClasses(b)) return true;
  const bIds = eventClassIds(b);
  return eventClassIds(a).some((id) => bIds.includes(id));
}

function timesOverlap(a, b) {
  const singleDay = (e) => toDateKey(e.start_date) === toDateKey(e.end_date);
  if (!a.start_time || !a.end_time || !b.start_time || !b.end_time) return true;
  if (!singleDay(a) || !singleDay(b)) return true;
  const s = (t) => String(t).slice(0, 5);
  return s(a.start_time) < s(b.end_time) && s(b.start_time) < s(a.end_time);
}

async function audienceUserIdsByRole(roleNames) {
  if (!roleNames.length) return [];
  return (await db('users')
    .join('roles', 'users.role_id', 'roles.id')
    .whereRaw(`UPPER(roles.name) IN (${roleNames.map(() => '?').join(',')})`, roleNames)
    .whereNot('users.status', 'DEACTIVATED')
    .pluck('users.id')).map(Number);
}

async function teacherUserIdsForClasses(classIds) {
  const today = schoolToday();
  const [assigned, slotted] = await Promise.all([
    db('teacher_assignments')
      .whereIn('class_id', classIds)
      .where((q) => q.whereNull('effective_to').orWhere('effective_to', '>=', today))
      .pluck('teacher_id'),
    db('timetable_slots').whereIn('class_id', classIds).whereNot('status', 'ARCHIVED').pluck('teacher_id')
  ]);
  const teacherIds = Array.from(new Set([...assigned, ...slotted].map(Number).filter(Boolean)));
  if (teacherIds.length === 0) return [];
  return (await db('teachers')
    .join('users', 'teachers.user_id', 'users.id')
    .whereIn('teachers.id', teacherIds)
    .whereNot('users.status', 'DEACTIVATED')
    .pluck('users.id')).map(Number);
}

/** All user ids who should be notified about an event (staff always included). */
async function resolveRecipientUserIds(row) {
  const audience = row.target_audience || 'ALL';
  const roles = AUDIENCE_ROLES[audience] || AUDIENCE_ROLES.ALL;
  const allClasses = eventAppliesToAllClasses(row);
  const classIds = eventClassIds(row);
  const ids = new Set(await audienceUserIdsByRole(['ADMIN', 'PRINCIPAL']));

  const wantsStudents = roles.includes('STUDENT');
  const wantsParents = roles.includes('PARENT');

  if (wantsStudents || wantsParents) {
    let studentQuery = db('students')
      .join('users', 'students.user_id', 'users.id')
      .where('students.status', 'ACTIVE')
      .whereNot('users.status', 'DEACTIVATED');
    if (!allClasses) studentQuery = studentQuery.whereIn('students.current_class_id', classIds);
    const students = await studentQuery.select('students.id', 'students.user_id');

    if (wantsStudents) students.forEach((s) => ids.add(Number(s.user_id)));
    if (wantsParents && students.length > 0) {
      const studentIds = students.map((s) => s.id);
      for (let i = 0; i < studentIds.length; i += 1000) {
        const parentUsers = await db('parent_student')
          .join('parents', 'parent_student.parent_id', 'parents.id')
          .join('users', 'parents.user_id', 'users.id')
          .whereIn('parent_student.student_id', studentIds.slice(i, i + 1000))
          .whereNot('users.status', 'DEACTIVATED')
          .pluck('users.id');
        parentUsers.forEach((id) => ids.add(Number(id)));
      }
    }
  }

  const wantsTeachers = roles.includes('TEACHER');
  if (wantsTeachers) {
    const teacherIds = allClasses ? await audienceUserIdsByRole(['TEACHER']) : await teacherUserIdsForClasses(classIds);
    teacherIds.forEach((id) => ids.add(id));
  } else if (eventSuspendsClasses(row)) {
    // Teachers whose lessons are suspended must always be told
    const teacherIds = allClasses ? await audienceUserIdsByRole(['TEACHER']) : await teacherUserIdsForClasses(classIds);
    teacherIds.forEach((id) => ids.add(id));
  }

  return Array.from(ids);
}

function emitToUsers(userIds, event, payload) {
  const io = getSocketServer();
  if (!io || userIds.length === 0) return;
  try {
    for (let i = 0; i < userIds.length; i += 500) {
      io.to(userIds.slice(i, i + 500).map((id) => `user:${id}`)).emit(event, {
        ...payload,
        _event: event,
        _timestamp: new Date().toISOString()
      });
    }
  } catch (err) {
    console.warn('[CalendarService] realtime delivery warning:', err.message);
  }
}

function buildNotificationText(row, action) {
  const label = EVENT_TYPE_LABELS[row.event_type || row.holiday_type] || 'Calendar Event';
  const range = formatRange(toDateKey(row.start_date), toDateKey(row.end_date));
  const time = row.start_time && row.end_time ? `, ${String(row.start_time).slice(0, 5)}-${String(row.end_time).slice(0, 5)}` : '';
  const scope = eventAppliesToAllClasses(row) ? 'School-wide' : 'Selected classes';
  const suspension = eventSuspendsClasses(row)
    ? (Number(row.is_full_day_holiday ?? 1) ? ' Regular classes are suspended.' : ' Affected periods are suspended.')
    : '';

  if (action === 'CANCELLED') {
    return {
      title: `Cancelled: ${row.title}`.slice(0, 200),
      message: `${label} "${row.title}" (${range}) has been cancelled.${eventSuspendsClasses(row) ? ' The regular timetable applies again.' : ''}`,
      priority: 'High'
    };
  }
  if (action === 'UPDATED') {
    return {
      title: `Updated: ${row.title}`.slice(0, 200),
      message: `${label} "${row.title}" has changed. Now: ${range}${time}. ${scope}.${suspension}`.trim(),
      priority: 'High'
    };
  }
  return {
    title: `${label}: ${row.title}`.slice(0, 200),
    message: `${row.title} — ${range}${time}. ${scope}.${suspension}${row.description ? ` ${row.description}` : ''}`.trim(),
    priority: HOLIDAY_EVENT_TYPES.includes(row.event_type || row.holiday_type) ? 'High' : 'Medium'
  };
}

/**
 * Persist one notification per recipient (offline users see it on next login; unread counts
 * are per user) and push it live. Duplicate (same event, same text) notifications are skipped.
 */
async function notifyAudience(row, action, recipientIds = null) {
  try {
    const userIds = recipientIds || (await resolveRecipientUserIds(row));
    if (userIds.length === 0) return 0;

    const { title, message, priority } = buildNotificationText(row, action);

    const alreadyNotified = new Set();
    for (let i = 0; i < userIds.length; i += 1000) {
      const rows = await db('operational_notifications')
        .where({ related_record_type: 'CalendarEvent', related_record_id: String(row.id), title, message })
        .whereIn('user_id', userIds.slice(i, i + 1000))
        .pluck('user_id');
      rows.forEach((id) => alreadyNotified.add(Number(id)));
    }
    const fresh = userIds.filter((id) => !alreadyNotified.has(id));
    if (fresh.length === 0) return 0;

    await notificationService.notifyUsers(fresh, {
      title,
      message,
      type: HOLIDAY_EVENT_TYPES.includes(row.event_type || row.holiday_type) ? 'Holiday' : 'Calendar Event',
      targetRole: 'ALL',
      relatedRecordId: row.id,
      relatedRecordType: 'CalendarEvent',
      priority
    });

    emitToUsers(fresh, RealtimeEvents.NOTIFICATION_CREATED, {
      title,
      message,
      type: 'Holiday',
      priority: priority.toUpperCase(),
      relatedRecordId: String(row.id),
      relatedRecordType: 'CalendarEvent',
      createdAt: new Date().toISOString()
    });

    return fresh.length;
  } catch (err) {
    console.warn('[CalendarService] notification warning:', err.message);
    return 0;
  }
}

/** Tell every connected portal to refresh calendar / dashboard / timetable views. */
function broadcastCalendarChange(action, row, sync) {
  const payload = { action, eventId: row.id, startDate: toDateKey(row.start_date), endDate: toDateKey(row.end_date) };
  const allRoles = { roles: ['TEACHER', 'STUDENT', 'PARENT', 'PRINCIPAL', 'ADMIN'] };
  emitRealtimeEvent(CALENDAR_UPDATED_EVENT, payload, allRoles);
  // Existing listeners (dashboards, holiday popups) refetch on these
  emitRealtimeEvent('HOLIDAY_ANNOUNCEMENT', { type: `CALENDAR_${action}`, holidayId: row.id }, allRoles);
  if (sync && (sync.cancelled > 0 || sync.restored > 0)) {
    emitRealtimeEvent(RealtimeEvents.TIMETABLE_CHANGE, {
      type: action === 'CANCELLED' ? 'HOLIDAY_REVOKED' : 'HOLIDAY_DECLARED',
      holidayId: row.id,
      cancelledCount: sync.cancelled,
      restoredCount: sync.restored
    }, allRoles);
  }
}

export const calendarService = {
  async getActiveSession() {
    return await db('academic_sessions').where({ is_current: 1 }).first();
  },

  async resolveSessionId(sessionId) {
    if (sessionId) return Number(sessionId);
    const current = await this.getActiveSession();
    return current?.id || null;
  },

  /** Role + class context used to decide which events a user may see. */
  async resolveViewer(user) {
    if (!user || isStaff(user)) return { role: user?.role || 'ADMIN', staff: true, classIds: null };
    if (user.role === 'TEACHER') {
      const scope = await getTeacherScope(user.id);
      return { role: 'TEACHER', staff: false, classIds: Array.from(scope.classIds) };
    }
    if (user.role === 'STUDENT') {
      const student = await getStudentByUserId(user.id);
      return { role: 'STUDENT', staff: false, classIds: student?.current_class_id ? [Number(student.current_class_id)] : [] };
    }
    if (user.role === 'PARENT') {
      const { children } = await getParentChildren(user.id);
      return { role: 'PARENT', staff: false, classIds: children.map((c) => Number(c.classId)).filter(Boolean) };
    }
    return { role: user.role, staff: false, classIds: [] };
  },

  isVisibleTo(row, viewer) {
    if (viewer.staff) return true;
    if (row.is_published !== undefined && row.is_published !== null && !Number(row.is_published)) return false;

    const audience = row.target_audience || 'ALL';
    const roleAllowed = (AUDIENCE_ROLES[audience] || AUDIENCE_ROLES.ALL).includes(viewer.role);
    const classMatch = eventAppliesToAllClasses(row) || eventClassIds(row).some((id) => viewer.classIds.includes(id));

    if (viewer.role === 'TEACHER' && eventSuspendsClasses(row) && classMatch) return true;
    return roleAllowed && classMatch;
  },

  async getHolidays({ sessionId, year, month, startDate, endDate }) {
    return await calendarRepository.getHolidays({
      sessionId: await this.resolveSessionId(sessionId),
      year,
      month,
      startDate,
      endDate
    });
  },

  // ─── Legacy holiday endpoints (kept for existing clients) ───────────────

  async createHoliday({ sessionId, title, holidayType = 'PUBLIC_HOLIDAY', startDate, endDate, description = null, affectsAllClasses = true, classIds, createdBy, confirmConflicts }) {
    return await this.createEvent({
      sessionId,
      title,
      eventType: holidayType,
      startDate,
      endDate,
      description,
      affectsAllClasses,
      classIds,
      isFullDayHoliday: true,
      classesSuspended: true,
      confirmConflicts: confirmConflicts !== undefined ? confirmConflicts : true,
      createdBy,
      raw: true
    });
  },

  async updateHoliday(id, data, userId) {
    return await this.updateEvent(id, { confirmConflicts: true, ...data }, userId, { raw: true });
  },

  async deleteHoliday(id, userId) {
    await this.deleteEvent(id, userId);
    return { success: true, message: 'Holiday break removed and timetable restored' };
  },

  // ─── Calendar events ─────────────────────────────────────────────────────

  async getEvents({ sessionId, year, month, startDate, endDate, user, classId } = {}) {
    const viewer = await this.resolveViewer(user);
    // An explicit date range / year spans sessions; without one, default to the current session
    const hasRange = Boolean((startDate && endDate) || year);
    const rows = await calendarRepository.getEventRows({
      sessionId: sessionId ? Number(sessionId) : hasRange ? null : await this.resolveSessionId(null),
      year,
      month,
      startDate,
      endDate
    });
    return rows
      .filter((r) => this.isVisibleTo(r, viewer))
      .filter((r) => !classId || eventAppliesToAllClasses(r) || eventClassIds(r).includes(Number(classId)))
      .map((r) => calendarRepository.formatEvent(r));
  },

  async getUpcomingEvents({ sessionId, user, classId, limitDays = 30 } = {}) {
    const today = schoolToday();
    const days = Math.min(Math.max(Number(limitDays) || 30, 1), 366);
    const end = new Date(Date.parse(`${today}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
    const events = await this.getEvents({ sessionId, startDate: today, endDate: end, user, classId });
    const nextHoliday = events.find((e) => e.isHoliday || e.classesSuspended) || null;
    return { today, events, nextHoliday };
  },

  /**
   * Conflicts for a prospective event: overlapping events for the same class scope (and time),
   * and examinations scheduled on days when classes would be suspended.
   */
  async findConflicts(columns, excludeId = null) {
    const candidate = { ...columns, id: excludeId };
    const conflicts = [];

    const overlapping = await calendarRepository.findOverlappingEvents({
      startDate: columns.start_date,
      endDate: columns.end_date,
      excludeId
    });
    for (const other of overlapping) {
      if (!classScopesOverlap(candidate, other) || !timesOverlap(candidate, other)) continue;
      const otherIsHoliday = eventSuspendsClasses(other);
      const candidateIsHoliday = eventSuspendsClasses(candidate);
      const otherType = other.event_type || other.holiday_type;
      let reason = 'Overlaps another calendar event for the same classes';
      if (candidateIsHoliday && otherType === 'EXAMINATION') reason = 'An examination is scheduled during this holiday';
      else if (columns.event_type === 'EXAMINATION' && otherIsHoliday) reason = 'This examination falls on a holiday';
      else if (candidateIsHoliday && otherIsHoliday) reason = 'Overlaps an existing holiday';
      else if (candidateIsHoliday || otherIsHoliday) reason = 'Holiday overlaps a school event';
      conflicts.push({
        kind: 'CALENDAR_EVENT',
        id: other.id,
        title: other.title,
        eventType: otherType,
        startDate: toDateKey(other.start_date),
        endDate: toDateKey(other.end_date),
        reason
      });
    }

    if (eventSuspendsClasses(candidate)) {
      const exams = await calendarRepository.findExamsInRange({
        startDate: columns.start_date,
        endDate: columns.end_date,
        classIds: eventAppliesToAllClasses(candidate) ? null : eventClassIds(candidate)
      });
      exams.forEach((exam) => conflicts.push({ ...exam, reason: 'Examination scheduled on a day when classes are suspended' }));
    }

    return conflicts;
  },

  async checkConflicts(input, excludeId = null) {
    const existing = excludeId ? await calendarRepository.getHolidayById(excludeId) : null;
    if (excludeId && !existing) throw new AppError('Calendar event not found', 404, ErrorCodes.NOT_FOUND);
    const columns = await buildEventColumns(input, existing);
    return { conflicts: await this.findConflicts(columns, excludeId) };
  },

  assertNoUnconfirmedConflicts(conflicts, confirm) {
    if (conflicts.length > 0 && !bool(confirm, false)) {
      throw new AppError(
        `This event conflicts with ${conflicts.length} existing schedule item(s). Review the conflicts and confirm to publish anyway.`,
        409,
        ErrorCodes.SCHEDULE_CONFLICT,
        { conflicts }
      );
    }
  },

  async createEvent(input) {
    const sessionId = await this.resolveSessionId(input.sessionId);
    if (!sessionId) throw new AppError('No active academic session found', 404, ErrorCodes.NOT_FOUND);

    const columns = await buildEventColumns(input);
    const conflicts = await this.findConflicts(columns);
    this.assertNoUnconfirmedConflicts(conflicts, input.confirmConflicts);

    const eventId = await db.transaction(async (trx) => {
      const id = await calendarRepository.createHoliday({
        ...columns,
        session_id: sessionId,
        auto_cancelled_lessons_count: 0,
        created_by: input.createdBy || null
      }, trx);
      await auditRepository.logAction(trx, {
        actorId: input.createdBy,
        action: 'CALENDAR_EVENT_CREATED',
        recordType: 'academic_holidays',
        recordIdentifier: `Event #${id}: ${columns.title}`,
        reason: conflicts.length ? `Published with ${conflicts.length} acknowledged conflict(s)` : null,
        newValue: columns
      });
      return id;
    });

    const row = await calendarRepository.getEventRowWithCreator(eventId);
    const sync = await this.safeSync(columns.start_date, columns.end_date);

    if (Number(row.is_published)) {
      if (Number(row.send_notification)) await notifyAudience(row, 'CREATED');
      await this.postSchoolNotice(row, input.createdBy);
      broadcastCalendarChange('CREATED', row, sync);
    }

    const fresh = await calendarRepository.getEventRowWithCreator(eventId);
    if (input.raw) return fresh;
    return { ...calendarRepository.formatEvent(fresh), conflicts, timetable: sync };
  },

  async updateEvent(id, input, userId, { raw = false } = {}) {
    const existing = await calendarRepository.getHolidayById(id);
    if (!existing) throw new AppError('Calendar event not found', 404, ErrorCodes.NOT_FOUND);

    const columns = await buildEventColumns(input, existing);
    const conflicts = await this.findConflicts(columns, id);
    this.assertNoUnconfirmedConflicts(conflicts, input.confirmConflicts);

    const importantKeys = ['title', 'event_type', 'start_date', 'end_date', 'start_time', 'end_time', 'class_ids',
      'affects_all_classes', 'classes_suspended', 'is_full_day_holiday', 'target_audience'];
    const norm = (key, value) => {
      if (value === null || value === undefined) return null;
      if (key.endsWith('_date')) return toDateKey(value);
      if (key.endsWith('_time')) return String(value).slice(0, 5);
      if (key === 'class_ids') return JSON.stringify(eventClassIds({ class_ids: value }));
      return String(value);
    };
    const changed = importantKeys.filter((k) => norm(k, existing[k]) !== norm(k, columns[k]));

    // Recipients of the old version too, so people removed from scope learn about the change
    const wasPublished = existing.is_published === null || existing.is_published === undefined || Boolean(Number(existing.is_published));
    const oldRecipients = wasPublished ? await resolveRecipientUserIds(existing) : [];

    await db.transaction(async (trx) => {
      await calendarRepository.updateHoliday(id, columns, trx);
      await auditRepository.logAction(trx, {
        actorId: userId,
        action: 'CALENDAR_EVENT_UPDATED',
        recordType: 'academic_holidays',
        recordIdentifier: `Event #${id}: ${columns.title}`,
        reason: changed.length ? `Changed: ${changed.join(', ')}` : 'No schedule-relevant changes',
        previousValue: existing,
        newValue: columns
      });
    });

    const row = await calendarRepository.getEventRowWithCreator(id);
    const rangeStart = [toDateKey(existing.start_date), columns.start_date].sort()[0];
    const rangeEnd = [toDateKey(existing.end_date), columns.end_date].sort().reverse()[0];
    const sync = await this.safeSync(rangeStart, rangeEnd);

    const isPublished = Boolean(Number(row.is_published));
    if (isPublished && !wasPublished) {
      if (Number(row.send_notification)) await notifyAudience(row, 'CREATED');
      broadcastCalendarChange('CREATED', row, sync);
    } else if (!isPublished && wasPublished) {
      if (Number(existing.send_notification ?? 1)) await notifyAudience(existing, 'CANCELLED', oldRecipients);
      broadcastCalendarChange('CANCELLED', row, sync);
    } else if (isPublished) {
      if (changed.length > 0 && Number(row.send_notification)) {
        const newRecipients = await resolveRecipientUserIds(row);
        await notifyAudience(row, 'UPDATED', Array.from(new Set([...oldRecipients, ...newRecipients])));
      }
      broadcastCalendarChange('UPDATED', row, sync);
    }

    const fresh = await calendarRepository.getEventRowWithCreator(id);
    if (raw) return fresh;
    return { ...calendarRepository.formatEvent(fresh), changedFields: changed, conflicts, timetable: sync };
  },

  /** Cancels (removes) an event, restores suspended lessons and notifies the audience. */
  async deleteEvent(id, userId) {
    const existing = await calendarRepository.getHolidayById(id);
    if (!existing) throw new AppError('Calendar event not found', 404, ErrorCodes.NOT_FOUND);

    const wasPublished = existing.is_published === null || existing.is_published === undefined || Boolean(Number(existing.is_published));
    const recipients = wasPublished ? await resolveRecipientUserIds(existing) : [];

    await db.transaction(async (trx) => {
      await calendarRepository.deleteHoliday(id, trx);
      await auditRepository.logAction(trx, {
        actorId: userId,
        action: 'CALENDAR_EVENT_CANCELLED',
        recordType: 'academic_holidays',
        recordIdentifier: `Event #${id}: ${existing.title}`,
        previousValue: existing
      });
    });

    const sync = await this.safeSync(toDateKey(existing.start_date), toDateKey(existing.end_date));

    if (wasPublished) {
      if (Number(existing.send_notification ?? 1)) await notifyAudience(existing, 'CANCELLED', recipients);
      broadcastCalendarChange('CANCELLED', existing, sync);
    }

    return { success: true, restoredLessons: sync.restored, message: 'Calendar event cancelled. Regular schedule restored where applicable.' };
  },

  async safeSync(startDate, endDate) {
    try {
      return await calendarRepository.syncHolidayExceptions({ startDate, endDate });
    } catch (err) {
      console.warn('[CalendarService] timetable exception sync warning:', err.message);
      return { cancelled: 0, restored: 0, byEvent: {} };
    }
  },

  /** School-wide holidays are also posted on the existing notice board (as before). */
  async postSchoolNotice(row, userId) {
    const type = row.event_type || row.holiday_type;
    if (!HOLIDAY_EVENT_TYPES.includes(type) || !eventAppliesToAllClasses(row) || (row.target_audience || 'ALL') !== 'ALL') return;
    try {
      const todayStr = schoolToday();
      const startDate = toDateKey(row.start_date);
      const endDate = toDateKey(row.end_date);
      await noticesRepository.createNotice({
        title: `Holiday Notice: ${row.title}`,
        content: `Official Notice: ${row.title} (${formatRange(startDate, endDate)}).${eventSuspendsClasses(row) ? ' Regular classes and timetable lessons are suspended during this period.' : ''} ${row.description || ''}`.trim(),
        audience: 'School-Wide',
        targetRoles: ['Teacher', 'Student', 'Parent'],
        category: 'Holiday',
        priority: 'High',
        status: 'Published',
        publishDate: startDate <= todayStr ? todayStr : startDate,
        expiryDate: endDate,
        userId
      });
    } catch (noticeErr) {
      console.warn('[CalendarService] Warning creating holiday notice:', noticeErr.message);
    }
  },

  async getCalendarOverview({ sessionId = null, year = null, month = null, user = null }) {
    const now = new Date();
    const currentYear = year ? Number(year) : now.getFullYear();
    const currentMonth = month ? Number(month) : now.getMonth() + 1;

    const targetSession = sessionId
      ? await db('academic_sessions').where({ id: sessionId }).first()
      : await this.getActiveSession();

    const viewer = await this.resolveViewer(user);
    const [rows, terms, lessonCounts] = await Promise.all([
      calendarRepository.getEventRows({ sessionId: targetSession?.id, year: currentYear, month: currentMonth }),
      targetSession ? calendarRepository.getTermsBySession(targetSession.id) : [],
      calendarRepository.getLessonCountsByMonth(currentYear, currentMonth)
    ]);
    const visible = rows.filter((r) => this.isVisibleTo(r, viewer));

    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateString = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayEvents = visible.filter((h) => dateString >= toDateKey(h.start_date) && dateString <= toDateKey(h.end_date));
      const activeHoliday = dayEvents.find((h) => eventSuspendsClasses(h) && eventAppliesToAllClasses(h))
        || dayEvents.find((h) => eventSuspendsClasses(h));
      const dayLessons = lessonCounts.find((lc) => toDateKey(lc.date) === dateString);

      days.push({
        date: dateString,
        day: d,
        isHoliday: Boolean(activeHoliday),
        holidayTitle: activeHoliday ? activeHoliday.title : null,
        holidayType: activeHoliday ? activeHoliday.event_type || activeHoliday.holiday_type : null,
        holidayId: activeHoliday ? activeHoliday.id : null,
        classesOccur: !(activeHoliday && eventAppliesToAllClasses(activeHoliday) && Number(activeHoliday.is_full_day_holiday ?? 1)),
        events: dayEvents.map((e) => ({ id: e.id, title: e.title, eventType: e.event_type || e.holiday_type })),
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
      holidays: visible,
      terms,
      days
    };
  },

  async isDateHoliday(sessionId, dateString, classId = null) {
    return await calendarRepository.isDateHoliday(sessionId, dateString, classId);
  },

  /**
   * Active / upcoming holiday announcement (popup + banner) for the signed-in user.
   * Only holidays that are published and relevant to the user's role and classes.
   */
  async getActiveAnnouncement(user = null) {
    const todayStr = schoolToday();
    const currentSession = await this.getActiveSession();
    if (!currentSession) {
      return { activeHolidays: [], popupAnnouncement: null, isCurrentlyOnHoliday: false };
    }

    const viewer = await this.resolveViewer(user);
    const rows = (await db('academic_holidays')
      .leftJoin('users', 'academic_holidays.created_by', 'users.id')
      .where('academic_holidays.session_id', currentSession.id)
      .where('academic_holidays.end_date', '>=', todayStr)
      .select('academic_holidays.*', 'users.full_name as createdByName')
      .orderBy('academic_holidays.start_date', 'asc'))
      .filter((r) => HOLIDAY_EVENT_TYPES.includes(r.event_type || r.holiday_type) || eventSuspendsClasses(r))
      .filter((r) => this.isVisibleTo(r, viewer))
      .filter((r) => r.is_published === null || r.is_published === undefined || Number(r.is_published));

    const currentHoliday = rows.find((h) => todayStr >= toDateKey(h.start_date) && todayStr <= toDateKey(h.end_date));

    let popupAnnouncement = currentHoliday || null;
    if (!popupAnnouncement && rows.length > 0) {
      const earliest = rows[0];
      const diffDays = Math.ceil((Date.parse(`${toDateKey(earliest.start_date)}T00:00:00Z`) - Date.parse(`${todayStr}T00:00:00Z`)) / 86400000);
      if (diffDays <= 14) popupAnnouncement = earliest;
    }

    const formatHoliday = (h) => {
      if (!h) return null;
      const formatted = calendarRepository.formatEvent(h);
      return {
        ...formatted,
        isCurrent: Boolean(todayStr >= formatted.startDate && todayStr <= formatted.endDate)
      };
    };

    return {
      activeHolidays: rows.map(formatHoliday),
      popupAnnouncement: formatHoliday(popupAnnouncement),
      isCurrentlyOnHoliday: Boolean(currentHoliday && eventAppliesToAllClasses(currentHoliday))
        || Boolean(currentHoliday && viewer.classIds && !viewer.staff)
    };
  }
};
