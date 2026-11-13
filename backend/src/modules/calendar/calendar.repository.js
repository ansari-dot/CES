import { db } from '../../shared/db/knex.js';
import { config } from '../../config/index.js';
import { parseDbDate } from '../../shared/utils/date.js';

/** Prefix used on every lesson cancelled by a calendar event (also by legacy holiday rows). */
export const HOLIDAY_CANCEL_PREFIX = 'Holiday Break: ';

/** Event types that represent a day off (classes suspended by default). */
export const HOLIDAY_EVENT_TYPES = [
  'VACATION',
  'PUBLIC_HOLIDAY',
  'EMERGENCY_CLOSURE',
  'SPECIAL_HOLIDAY',
  // legacy values created before the full calendar existed
  'INSTITUTIONAL_BREAK',
  'EXAM_PREP'
];

export const CALENDAR_EVENT_TYPES = [
  'VACATION',
  'PUBLIC_HOLIDAY',
  'EMERGENCY_CLOSURE',
  'SPECIAL_HOLIDAY',
  'EXAMINATION',
  'SCHOOL_EVENT',
  'PARENT_MEETING',
  'ANNOUNCEMENT',
  'INSTITUTIONAL_BREAK',
  'EXAM_PREP'
];

export const TARGET_AUDIENCES = ['ALL', 'STUDENTS', 'PARENTS', 'STUDENTS_PARENTS', 'TEACHERS', 'STAFF'];

export function toDateKey(value) {
  if (!value) return null;
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).split('T')[0].split(' ')[0];
}

function parseJsonArray(value) {
  if (value === null || value === undefined || value === '') return null;
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normaliseTime(value) {
  if (!value) return null;
  const s = String(value).trim();
  return s.length === 5 ? `${s}:00` : s.slice(0, 8);
}

/** School wall-clock "HH:MM:SS" of a UTC instant. */
function schoolWallTime(instant) {
  const date = parseDbDate(instant);
  if (!date || Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: config.SCHOOL_TIMEZONE || 'Asia/Karachi',
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
}

export function eventClassIds(row) {
  return (parseJsonArray(row.class_ids) || []).map(Number).filter(Boolean);
}

export function eventAppliesToAllClasses(row) {
  const ids = eventClassIds(row);
  return Boolean(Number(row.affects_all_classes ?? 1)) || ids.length === 0;
}

/** Does this event suspend classes? Legacy rows (pre-migration 34) have no flags and always did. */
export function eventSuspendsClasses(row) {
  const published = row.is_published === undefined || row.is_published === null ? true : Boolean(Number(row.is_published));
  const suspended = row.classes_suspended === undefined || row.classes_suspended === null ? true : Boolean(Number(row.classes_suspended));
  return published && suspended;
}

/** Whether a calendar event (row) suspends a specific lesson (row). */
export function eventCoversLesson(event, lesson) {
  if (!eventSuspendsClasses(event)) return false;

  const dateKey = toDateKey(lesson.lesson_date);
  if (dateKey < toDateKey(event.start_date) || dateKey > toDateKey(event.end_date)) return false;

  if (!eventAppliesToAllClasses(event)) {
    if (!eventClassIds(event).includes(Number(lesson.class_id))) return false;
  }

  const fullDay = event.is_full_day_holiday === undefined || event.is_full_day_holiday === null
    ? true
    : Boolean(Number(event.is_full_day_holiday));
  const windowStart = normaliseTime(event.start_time);
  const windowEnd = normaliseTime(event.end_time);

  // Partial-day suspension: only periods overlapping the event's time window
  if (!fullDay && windowStart && windowEnd) {
    const lessonStart = schoolWallTime(lesson.start_at);
    const lessonEnd = schoolWallTime(lesson.end_at);
    if (!lessonStart || !lessonEnd) return true;
    return lessonStart < windowEnd && lessonEnd > windowStart;
  }

  return true;
}

export const calendarRepository = {
  async getHolidays({ sessionId = null, year = null, month = null, startDate = null, endDate = null } = {}) {
    let query = db('academic_holidays')
      .leftJoin('users', 'academic_holidays.created_by', 'users.id')
      .select(
        'academic_holidays.*',
        'users.full_name as createdByName',
        'users.email as createdByEmail'
      )
      .orderBy('academic_holidays.start_date', 'asc');

    if (sessionId) {
      query = query.where('academic_holidays.session_id', sessionId);
    }

    const range = resolveRange({ year, month, startDate, endDate });
    if (range) query = applyOverlap(query, range.startDate, range.endDate, 'academic_holidays.');

    return await query;
  },

  async getHolidayById(id) {
    return await db('academic_holidays').where({ id }).first();
  },

  async getEventRowWithCreator(id) {
    return await db('academic_holidays')
      .leftJoin('users', 'academic_holidays.created_by', 'users.id')
      .where('academic_holidays.id', id)
      .select('academic_holidays.*', 'users.full_name as createdByName')
      .first();
  },

  /** First published, class-suspending event covering the date (optionally for one class). */
  async isDateHoliday(sessionId, dateString, classId = null) {
    let query = db('academic_holidays')
      .whereRaw('DATE(?) BETWEEN DATE(start_date) AND DATE(end_date)', [dateString]);
    if (sessionId) query = query.where('session_id', sessionId);
    const rows = await query;
    return rows.find((r) => {
      if (!eventSuspendsClasses(r)) return false;
      if (classId && !eventAppliesToAllClasses(r)) return eventClassIds(r).includes(Number(classId));
      return true;
    }) || null;
  },

  async createHoliday(data, trx = db) {
    const [id] = await trx('academic_holidays').insert(data);
    return id;
  },

  async updateHoliday(id, data, trx = db) {
    await trx('academic_holidays').where({ id }).update({
      ...data,
      updated_at: trx.fn.now()
    });
    return await trx('academic_holidays').where({ id }).first();
  },

  async deleteHoliday(id, trx = db) {
    return await trx('academic_holidays').where({ id }).delete();
  },

  /**
   * Date-specific timetable exceptions. Idempotent reconciliation over a date range:
   *  - SCHEDULED lessons covered by a published, class-suspending event are CANCELLED and
   *    tagged with that event (holiday_event_id).
   *  - Lessons previously cancelled by a holiday that are no longer covered by any event are
   *    restored to SCHEDULED (only if the lesson has not already ended).
   * The recurring timetable_slots are never modified.
   *
   * @returns {{ cancelled: number, restored: number, byEvent: Record<number, number> }}
   */
  async syncHolidayExceptions({ startDate, endDate }) {
    const start = toDateKey(startDate);
    const end = toDateKey(endDate);
    if (!start || !end) return { cancelled: 0, restored: 0, byEvent: {} };

    const hasExceptionColumn = await db.schema.hasColumn('timetable_lessons', 'holiday_event_id');

    const events = (await db('academic_holidays')
      .where('start_date', '<=', end)
      .andWhere('end_date', '>=', start)
      .orderBy('id', 'asc'))
      .filter(eventSuspendsClasses);

    const lessons = await db('timetable_lessons')
      .whereRaw('DATE(lesson_date) BETWEEN DATE(?) AND DATE(?)', [start, end])
      .where((q) => {
        q.where('status', 'SCHEDULED').orWhere((inner) => {
          inner.where('status', 'CANCELLED');
          inner.where((tag) => {
            if (hasExceptionColumn) tag.whereNotNull('holiday_event_id');
            tag.orWhere('cancel_reason', 'like', `${HOLIDAY_CANCEL_PREFIX}%`);
          });
        });
      })
      .select('*');

    const nowMs = Date.now();
    let cancelled = 0;
    let restored = 0;
    const byEvent = {};

    for (const lesson of lessons) {
      const covering = events.find((e) => eventCoversLesson(e, lesson));

      if (lesson.status === 'SCHEDULED') {
        if (!covering) continue;
        const update = {
          status: 'CANCELLED',
          cancel_reason: `${HOLIDAY_CANCEL_PREFIX}${covering.title}`.slice(0, 255),
          updated_at: db.fn.now()
        };
        if (hasExceptionColumn) update.holiday_event_id = covering.id;
        await db('timetable_lessons').where({ id: lesson.id, status: 'SCHEDULED' }).update(update);
        cancelled++;
        byEvent[covering.id] = (byEvent[covering.id] || 0) + 1;
        continue;
      }

      // status === CANCELLED by a holiday
      if (covering) {
        const currentTag = hasExceptionColumn ? Number(lesson.holiday_event_id || 0) : null;
        if (hasExceptionColumn && currentTag !== Number(covering.id)) {
          await db('timetable_lessons').where({ id: lesson.id }).update({
            holiday_event_id: covering.id,
            cancel_reason: `${HOLIDAY_CANCEL_PREFIX}${covering.title}`.slice(0, 255),
            updated_at: db.fn.now()
          });
        }
        byEvent[covering.id] = (byEvent[covering.id] || 0) + 1;
        continue;
      }

      const endsAt = parseDbDate(lesson.end_at);
      if (endsAt && endsAt.getTime() <= nowMs) {
        // The period already passed while the holiday was in force: it did not take place.
        continue;
      }

      const restore = { status: 'SCHEDULED', cancel_reason: null, updated_at: db.fn.now() };
      if (hasExceptionColumn) restore.holiday_event_id = null;
      await db('timetable_lessons').where({ id: lesson.id, status: 'CANCELLED' }).update(restore);
      restored++;
    }

    // Keep the per-event cancelled-lesson counter accurate for events in this range
    for (const e of events) {
      if (hasExceptionColumn) {
        const row = await db('timetable_lessons')
          .where({ holiday_event_id: e.id, status: 'CANCELLED' })
          .count('* as c')
          .first();
        await db('academic_holidays').where({ id: e.id }).update({ auto_cancelled_lessons_count: Number(row?.c || 0) });
      } else if (byEvent[e.id] !== undefined) {
        await db('academic_holidays').where({ id: e.id }).update({ auto_cancelled_lessons_count: byEvent[e.id] });
      }
    }

    return { cancelled, restored, byEvent };
  },

  /** Backwards-compatible wrapper used by older callers. */
  async cancelScheduledLessonsForHoliday({ startDate, endDate }) {
    const result = await this.syncHolidayExceptions({ startDate, endDate });
    return result.cancelled;
  },

  async getTermsBySession(sessionId) {
    const hasTable = await db.schema.hasTable('academic_terms');
    if (!hasTable) return [];
    return await db('academic_terms').where({ session_id: sessionId }).orderBy('start_date', 'asc');
  },

  // ─── Extended Calendar Event Methods ────────────────────────────────────

  async getEventRows({ sessionId = null, year = null, month = null, startDate = null, endDate = null } = {}) {
    let query = db('academic_holidays')
      .leftJoin('users', 'academic_holidays.created_by', 'users.id')
      .select('academic_holidays.*', 'users.full_name as createdByName')
      .orderBy('academic_holidays.start_date', 'asc')
      .orderBy('academic_holidays.start_time', 'asc');

    if (sessionId) query = query.where('academic_holidays.session_id', sessionId);

    const range = resolveRange({ year, month, startDate, endDate });
    if (range) query = applyOverlap(query, range.startDate, range.endDate, 'academic_holidays.');

    return await query;
  },

  formatEvent(r) {
    const startDate = toDateKey(r.start_date);
    const endDate = toDateKey(r.end_date);
    const totalDays = Math.max(
      1,
      Math.round((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86400000) + 1
    );
    const eventType = r.event_type || r.holiday_type;
    return {
      id: r.id,
      sessionId: r.session_id,
      title: r.title,
      holidayType: r.holiday_type,
      eventType,
      isHoliday: HOLIDAY_EVENT_TYPES.includes(eventType),
      startDate,
      endDate,
      totalDays,
      startTime: r.start_time ? String(r.start_time).slice(0, 5) : null,
      endTime: r.end_time ? String(r.end_time).slice(0, 5) : null,
      description: r.description,
      targetAudience: r.target_audience || 'ALL',
      classIds: eventClassIds(r),
      affectsAllClasses: eventAppliesToAllClasses(r),
      isFullDayHoliday: r.is_full_day_holiday === undefined || r.is_full_day_holiday === null ? true : Boolean(Number(r.is_full_day_holiday)),
      classesSuspended: eventSuspendsClasses(r),
      sendNotification: r.send_notification === undefined || r.send_notification === null ? true : Boolean(Number(r.send_notification)),
      isPublished: r.is_published === undefined || r.is_published === null ? true : Boolean(Number(r.is_published)),
      autoCancelledLessonsCount: Number(r.auto_cancelled_lessons_count || 0),
      createdByName: r.createdByName || 'School Administration',
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  },

  /** Other calendar events overlapping the date range (excluding one id). */
  async findOverlappingEvents({ startDate, endDate, excludeId = null }) {
    let query = db('academic_holidays')
      .where('start_date', '<=', endDate)
      .andWhere('end_date', '>=', startDate);
    if (excludeId) query = query.whereNot('id', excludeId);
    return await query.select('*');
  },

  /** Examinations / tests scheduled in a date range (optionally limited to classes). */
  async findExamsInRange({ startDate, endDate, classIds = null }) {
    const results = [];
    const limitClasses = (q, column) => {
      if (classIds && classIds.length > 0) q.whereIn(column, classIds);
    };

    if (await db.schema.hasTable('date_sheet_entries')) {
      const q = db('date_sheet_entries as e')
        .join('examination_date_sheets as ds', 'e.date_sheet_id', 'ds.id')
        .leftJoin('classes as c', 'e.class_id', 'c.id')
        .leftJoin('subjects as s', 'e.subject_id', 's.id')
        .whereBetween('e.exam_date', [startDate, endDate])
        .whereNot('ds.status', 'HIDDEN')
        .select('e.id', 'e.exam_date', 'e.class_id', 'ds.title', 'c.name as className', 's.name as subjectName');
      limitClasses(q, 'e.class_id');
      (await q).forEach((r) => results.push({
        kind: 'DATESHEET_EXAM',
        id: r.id,
        date: toDateKey(r.exam_date),
        classId: r.class_id,
        title: `${r.title}: ${r.subjectName || 'Paper'}${r.className ? ` (${r.className})` : ''}`
      }));
    }

    if (await db.schema.hasTable('terminal_exam_papers')) {
      const q = db('terminal_exam_papers as p')
        .leftJoin('classes as c', 'p.class_id', 'c.id')
        .whereNotNull('p.paper_date')
        .whereBetween('p.paper_date', [startDate, endDate])
        .where('p.status', 'SCHEDULED')
        .select('p.id', 'p.paper_date', 'p.class_id', 'c.name as className');
      limitClasses(q, 'p.class_id');
      (await q).forEach((r) => results.push({
        kind: 'TERMINAL_EXAM_PAPER',
        id: r.id,
        date: toDateKey(r.paper_date),
        classId: r.class_id,
        title: `Terminal exam paper${r.className ? ` (${r.className})` : ''}`
      }));
    }

    if (await db.schema.hasTable('monthly_tests')) {
      const q = db('monthly_tests as t')
        .leftJoin('classes as c', 't.class_id', 'c.id')
        .where('t.status', 'PUBLISHED')
        .whereRaw('DATE(t.available_from) <= ?', [endDate])
        .whereRaw('DATE(t.available_until) >= ?', [startDate])
        .select('t.id', 't.title', 't.available_from', 't.class_id', 'c.name as className');
      limitClasses(q, 't.class_id');
      (await q).forEach((r) => results.push({
        kind: 'MONTHLY_TEST',
        id: r.id,
        date: toDateKey(r.available_from),
        classId: r.class_id,
        title: `${r.title}${r.className ? ` (${r.className})` : ''}`
      }));
    }

    return results;
  },

  async getLessonCountsByMonth(year, month) {
    const monthPadded = String(month).padStart(2, '0');
    const startOfMonth = `${year}-${monthPadded}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endOfMonth = `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;

    return await db('timetable_lessons')
      .whereRaw('DATE(lesson_date) BETWEEN DATE(?) AND DATE(?)', [startOfMonth, endOfMonth])
      .groupByRaw('DATE(lesson_date)')
      .select(
        db.raw('DATE(lesson_date) as date'),
        db.raw("SUM(CASE WHEN status = 'SCHEDULED' THEN 1 ELSE 0 END) as scheduledCount"),
        db.raw("SUM(CASE WHEN status = 'LIVE' THEN 1 ELSE 0 END) as liveCount"),
        db.raw("SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completedCount"),
        db.raw("SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelledCount"),
        db.raw('COUNT(*) as totalLessons')
      );
  }
};

function resolveRange({ year, month, startDate, endDate }) {
  if (startDate && endDate) return { startDate, endDate };
  if (year && month) {
    const monthPadded = String(month).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    return { startDate: `${year}-${monthPadded}-01`, endDate: `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}` };
  }
  if (year) return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
  return null;
}

function applyOverlap(query, startDate, endDate, prefix = '') {
  return query
    .where(`${prefix}start_date`, '<=', endDate)
    .andWhere(`${prefix}end_date`, '>=', startDate);
}
