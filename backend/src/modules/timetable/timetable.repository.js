import { db } from '../../shared/db/knex.js';

export const timetableRepository = {
  // Slots
  async getSlots({ classId = null, teacherId = null, sessionId = null } = {}) {
    let query = db('timetable_slots')
      .join('classes', 'timetable_slots.class_id', 'classes.id')
      .join('subjects', 'timetable_slots.subject_id', 'subjects.id')
      .join('teachers', 'timetable_slots.teacher_id', 'teachers.id')
      .join('users', 'teachers.user_id', 'users.id')
      .select(
        'timetable_slots.id',
        'timetable_slots.session_id as sessionId',
        'timetable_slots.class_id as classId',
        'classes.grade_level as classNumber',
        'classes.name as className',
        'timetable_slots.subject_id as subjectId',
        'subjects.code as subjectCode',
        'subjects.name as subjectName',
        'timetable_slots.teacher_id as teacherId',
        'users.full_name as teacherName',
        'timetable_slots.weekday',
        'timetable_slots.start_time as startTime',
        'timetable_slots.end_time as endTime',
        'timetable_slots.status'
      )
      .orderBy(['timetable_slots.weekday', 'timetable_slots.start_time']);

    if (classId) query = query.where('timetable_slots.class_id', classId);
    if (teacherId) query = query.where('timetable_slots.teacher_id', teacherId);
    if (sessionId) query = query.where('timetable_slots.session_id', sessionId);

    return await query;
  },

  async findSlotById(id) {
    return await db('timetable_slots').where({ id }).first();
  },

  async checkSlotConflict({ classId, teacherId, weekday, startTime, endTime, excludeSlotId = null }) {
    let baseQuery = db('timetable_slots')
      .where({ weekday })
      .where('status', '!=', 'ARCHIVED')
      .where('start_time', '<', endTime)
      .where('end_time', '>', startTime);

    if (excludeSlotId) {
      baseQuery = baseQuery.where('id', '!=', excludeSlotId);
    }

    // 1. Check class overlap (because 1 meeting is shared per class)
    const classConflict = await baseQuery.clone().where({ class_id: classId }).first();
    if (classConflict) {
      return { type: 'CLASS_CONFLICT', conflictingSlot: classConflict };
    }

    // 2. Check teacher double-booking
    const teacherConflict = await baseQuery.clone().where({ teacher_id: teacherId }).first();
    if (teacherConflict) {
      return { type: 'TEACHER_CONFLICT', conflictingSlot: teacherConflict };
    }

    return null;
  },

  async createSlot(slotData) {
    const [id] = await db('timetable_slots').insert(slotData);
    return id;
  },

  async updateSlot(id, updates) {
    return await db('timetable_slots').where({ id }).update(updates);
  },

  // Lessons
  async getLessons({ classId = null, teacherId = null, date = null, startDate = null, endDate = null, status = null } = {}) {
    let query = db('timetable_lessons')
      .join('classes', 'timetable_lessons.class_id', 'classes.id')
      .join('subjects', 'timetable_lessons.subject_id', 'subjects.id')
      .join('teachers', 'timetable_lessons.teacher_id', 'teachers.id')
      .join('users', 'teachers.user_id', 'users.id')
      .leftJoin('zoom_meetings', 'timetable_lessons.zoom_meeting_id', 'zoom_meetings.id')
      .select(
        'timetable_lessons.id',
        'timetable_lessons.slot_id as slotId',
        'timetable_lessons.class_id as classId',
        'classes.grade_level as classNumber',
        'classes.name as className',
        'timetable_lessons.subject_id as subjectId',
        'subjects.code as subjectCode',
        'subjects.name as subjectName',
        'timetable_lessons.teacher_id as teacherId',
        'users.full_name as teacherName',
        'timetable_lessons.substitute_teacher_id as substituteTeacherId',
        'timetable_lessons.zoom_meeting_id as zoomMeetingId',
        'zoom_meetings.zoom_meeting_id as meetingNumber',
        'zoom_meetings.last_health_status as meetingHealth',
        'timetable_lessons.lesson_date as lessonDate',
        'timetable_lessons.start_at as startAt',
        'timetable_lessons.end_at as endAt',
        'timetable_lessons.status',
        'timetable_lessons.cancel_reason as cancelReason'
      )
      .orderBy('timetable_lessons.start_at', 'asc');

    if (classId) query = query.where('timetable_lessons.class_id', classId);
    if (teacherId) {
      query = query.where((q) => {
        q.where('timetable_lessons.teacher_id', teacherId)
          .orWhere('timetable_lessons.substitute_teacher_id', teacherId);
      });
    }
    if (date) query = query.where('timetable_lessons.lesson_date', date);
    if (startDate) query = query.where('timetable_lessons.start_at', '>=', startDate);
    if (endDate) query = query.where('timetable_lessons.end_at', '<=', endDate);
    if (status) query = query.where('timetable_lessons.status', status);

    return await query;
  },

  async findLessonById(id) {
    return await db('timetable_lessons')
      .join('classes', 'timetable_lessons.class_id', 'classes.id')
      .join('subjects', 'timetable_lessons.subject_id', 'subjects.id')
      .join('teachers', 'timetable_lessons.teacher_id', 'teachers.id')
      .join('users', 'teachers.user_id', 'users.id')
      .leftJoin('zoom_meetings', 'timetable_lessons.zoom_meeting_id', 'zoom_meetings.id')
      .where('timetable_lessons.id', id)
      .select(
        'timetable_lessons.*',
        'classes.name as className',
        'classes.grade_level as classNumber',
        'subjects.name as subjectName',
        'users.full_name as teacherName',
        'zoom_meetings.zoom_meeting_id as meetingNumber',
        'zoom_meetings.last_health_status as meetingHealth'
      )
      .first();
  },

  async checkLessonConflict({ classId, teacherId, startAt, endAt, excludeLessonId = null }) {
    let baseQuery = db('timetable_lessons')
      .whereNotIn('status', ['CANCELLED', 'RESCHEDULED'])
      .where('start_at', '<', endAt)
      .where('end_at', '>', startAt);

    if (excludeLessonId) {
      baseQuery = baseQuery.where('id', '!=', excludeLessonId);
    }

    const classConflict = await baseQuery.clone().where({ class_id: classId }).first();
    if (classConflict) return { type: 'CLASS_CONFLICT', conflictingLesson: classConflict };

    const teacherConflict = await baseQuery.clone().where({ teacher_id: teacherId }).first();
    if (teacherConflict) return { type: 'TEACHER_CONFLICT', conflictingLesson: teacherConflict };

    return null;
  },

  async createLesson(lessonData) {
    const [id] = await db('timetable_lessons').insert(lessonData);
    return id;
  },

  async updateLesson(id, updates) {
    return await db('timetable_lessons').where({ id }).update(updates);
  },

  async logChange({ lessonId, slotId, changeType, oldValues, newValues, reason, changedBy }) {
    return await db('timetable_change_log').insert({
      lesson_id: lessonId || null,
      slot_id: slotId || null,
      change_type: changeType,
      old_values: oldValues ? JSON.stringify(oldValues) : null,
      new_values: newValues ? JSON.stringify(newValues) : null,
      reason: reason || null,
      changed_by: changedBy
    });
  }
};
