import { db } from '../../shared/db/knex.js';

export const datesheetsRepository = {
  /**
   * List date sheets for administrative view
   */
  async listDateSheets({ academicSessionId, examType, status, isPublished, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;

    const baseQuery = db('examination_date_sheets as eds')
      .join('academic_sessions as ses', 'eds.academic_session_id', 'ses.id')
      .join('users as u', 'eds.created_by', 'u.id');

    if (academicSessionId) {
      baseQuery.where('eds.academic_session_id', academicSessionId);
    }
    if (examType) {
      baseQuery.where('eds.exam_type', examType);
    }
    if (status) {
      baseQuery.where('eds.status', status);
    }
    if (isPublished !== undefined) {
      baseQuery.where('eds.is_published', isPublished ? 1 : 0);
    }

    const countRes = await baseQuery.clone().count('eds.id as total').first();
    const total = Number(countRes?.total || 0);

    const rows = await baseQuery
      .clone()
      .select(
        'eds.id',
        'eds.academic_session_id',
        'ses.name as session_name',
        'eds.exam_type',
        'eds.scheduling_mode',
        'eds.title',
        'eds.start_date',
        'eds.end_date',
        'eds.description',
        'eds.status',
        'eds.is_published',
        'eds.published_at',
        'eds.created_by',
        'u.full_name as created_by_name',
        'eds.created_at',
        'eds.updated_at'
      )
      .orderBy('eds.created_at', 'desc')
      .limit(limit)
      .offset(offset);

    // Fetch classes summary and entry counts for each date sheet
    const sheetIds = rows.map((r) => r.id);
    let entriesSummary = [];
    if (sheetIds.length > 0) {
      entriesSummary = await db('date_sheet_entries as dse')
        .join('classes as c', 'dse.class_id', 'c.id')
        .whereIn('dse.date_sheet_id', sheetIds)
        .groupBy('dse.date_sheet_id', 'c.id', 'c.name')
        .select(
          'dse.date_sheet_id',
          'c.id as class_id',
          'c.name as class_name',
          db.raw('COUNT(dse.id) as total_exams')
        );
    }

    const dateSheets = rows.map((row) => {
      const classRows = entriesSummary.filter((e) => Number(e.date_sheet_id) === Number(row.id));
      const totalExams = classRows.reduce((acc, curr) => acc + Number(curr.total_exams || 0), 0);
      return {
        ...row,
        is_published: Boolean(row.is_published),
        total_exams: totalExams,
        applicable_classes: classRows.map((c) => ({
          id: c.class_id,
          name: c.class_name,
          examCount: Number(c.total_exams)
        }))
      };
    });

    return {
      dateSheets,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  },

  /**
   * Get complete date sheet with all schedule entries
   */
  async getDateSheetById(id) {
    const sheet = await db('examination_date_sheets as eds')
      .join('academic_sessions as ses', 'eds.academic_session_id', 'ses.id')
      .join('users as u', 'eds.created_by', 'u.id')
      .where('eds.id', id)
      .select(
        'eds.id',
        'eds.academic_session_id',
        'ses.name as session_name',
        'eds.exam_type',
        'eds.scheduling_mode',
        'eds.title',
        'eds.start_date',
        'eds.end_date',
        'eds.description',
        'eds.status',
        'eds.is_published',
        'eds.published_at',
        'eds.created_by',
        'u.full_name as created_by_name',
        'eds.created_at',
        'eds.updated_at'
      )
      .first();

    if (!sheet) return null;

    sheet.is_published = Boolean(sheet.is_published);

    const entries = await db('date_sheet_entries as dse')
      .join('classes as c', 'dse.class_id', 'c.id')
      .join('subjects as s', 'dse.subject_id', 's.id')
      .leftJoin('teachers as t', 'dse.teacher_id', 't.id')
      .leftJoin('users as tu', 't.user_id', 'tu.id')
      .where('dse.date_sheet_id', id)
      .select(
        'dse.id',
        'dse.date_sheet_id',
        'dse.class_id',
        'c.name as class_name',
        'c.grade_level',
        'dse.subject_id',
        's.name as subject_name',
        's.code as subject_code',
        'dse.teacher_id',
        'tu.full_name as teacher_name',
        'dse.exam_date',
        'dse.day_of_week',
        'dse.start_time',
        'dse.end_time',
        'dse.subject_type',
        'dse.instructions',
        'dse.timetable_slot_id',
        'dse.assessment_timing',
        'dse.duration_minutes',
        'dse.is_date_changed',
        'dse.previous_exam_date',
        'dse.previous_start_time',
        'dse.previous_end_time',
        'dse.order_index'
      )
      .orderBy(['dse.class_id', 'dse.exam_date', 'dse.start_time', 'dse.order_index']);

    return {
      ...sheet,
      entries
    };
  },

  /**
   * Create a new date sheet and entries in a transaction
   */
  async createDateSheet(headerData, entries = []) {
    return db.transaction(async (trx) => {
      const [id] = await trx('examination_date_sheets').insert(headerData);

      if (entries.length > 0) {
        const rows = entries.map((entry, index) => ({
          date_sheet_id: id,
          class_id: entry.classId,
          subject_id: entry.subjectId,
          teacher_id: entry.teacherId || null,
          exam_date: entry.examDate,
          day_of_week: entry.dayOfWeek,
          start_time: entry.startTime,
          end_time: entry.endTime,
          subject_type: entry.subjectType || 'Scholastic',
          instructions: entry.instructions || null,
          timetable_slot_id: entry.timetableSlotId || null,
          assessment_timing: entry.assessmentTiming || 'STANDALONE',
          duration_minutes: entry.durationMinutes || null,
          is_date_changed: Boolean(entry.isDateChanged),
          previous_exam_date: entry.previousExamDate || null,
          previous_start_time: entry.previousStartTime || null,
          previous_end_time: entry.previousEndTime || null,
          order_index: entry.orderIndex !== undefined ? entry.orderIndex : index
        }));
        await trx('date_sheet_entries').insert(rows);
      }

      return id;
    });
  },

  /**
   * Update date sheet and replace schedule entries
   */
  async updateDateSheet(id, headerData, entries = null) {
    return db.transaction(async (trx) => {
      await trx('examination_date_sheets')
        .where({ id })
        .update({
          ...headerData,
          updated_at: trx.raw('CURRENT_TIMESTAMP(3)')
        });

      if (entries !== null && Array.isArray(entries)) {
        await trx('date_sheet_entries').where({ date_sheet_id: id }).delete();

        if (entries.length > 0) {
          const rows = entries.map((entry, index) => ({
            date_sheet_id: id,
            class_id: entry.classId,
            subject_id: entry.subjectId,
            teacher_id: entry.teacherId || null,
            exam_date: entry.examDate,
            day_of_week: entry.dayOfWeek,
            start_time: entry.startTime,
            end_time: entry.endTime,
            subject_type: entry.subjectType || 'Scholastic',
            instructions: entry.instructions || null,
            timetable_slot_id: entry.timetableSlotId || null,
            assessment_timing: entry.assessmentTiming || 'STANDALONE',
            duration_minutes: entry.durationMinutes || null,
            is_date_changed: Boolean(entry.isDateChanged),
            previous_exam_date: entry.previousExamDate || null,
            previous_start_time: entry.previousStartTime || null,
            previous_end_time: entry.previousEndTime || null,
            order_index: entry.orderIndex !== undefined ? entry.orderIndex : index
          }));
          await trx('date_sheet_entries').insert(rows);
        }
      }

      return id;
    });
  },

  /**
   * Toggle publish / hide status
   */
  async setPublishStatus(id, { status, isPublished, publishedAt }) {
    await db('examination_date_sheets')
      .where({ id })
      .update({
        status,
        is_published: isPublished ? 1 : 0,
        published_at: publishedAt,
        updated_at: db.raw('CURRENT_TIMESTAMP(3)')
      });
  },

  /**
   * Delete date sheet (cascades to entries)
   */
  async deleteDateSheet(id) {
    return db('examination_date_sheets').where({ id }).delete();
  },

  /**
   * Find student enrolled class ID
   */
  async getStudentClassId(userId) {
    const enrollment = await db('students as s')
      .leftJoin('enrollments as e', function () {
        this.on('s.id', '=', 'e.student_id').andOn('e.status', '=', db.raw('?', ['ACTIVE']));
      })
      .where('s.user_id', userId)
      .select('s.id as student_id', 's.current_class_id', 'e.class_id as enrolled_class_id')
      .first();

    if (!enrollment) return null;
    return enrollment.enrolled_class_id || enrollment.current_class_id;
  },

  /**
   * Find student active published date sheets strictly for student's class
   */
  async getStudentActiveDateSheets(classId) {
    const publishedSheets = await db('examination_date_sheets as eds')
      .join('academic_sessions as ses', 'eds.academic_session_id', 'ses.id')
      .join('date_sheet_entries as dse', 'eds.id', 'dse.date_sheet_id')
      .where('eds.is_published', 1)
      .andWhere('eds.status', 'PUBLISHED')
      .andWhere('dse.class_id', classId)
      .distinct(
        'eds.id',
        'eds.academic_session_id',
        'ses.name as session_name',
        'eds.exam_type',
        'eds.title',
        'eds.description',
        'eds.published_at'
      )
      .orderBy('eds.published_at', 'desc');

    if (publishedSheets.length === 0) return [];

    const sheetIds = publishedSheets.map((s) => s.id);

    const entries = await db('date_sheet_entries as dse')
      .join('classes as c', 'dse.class_id', 'c.id')
      .join('subjects as s', 'dse.subject_id', 's.id')
      .whereIn('dse.date_sheet_id', sheetIds)
      .andWhere('dse.class_id', classId)
      .select(
        'dse.id',
        'dse.date_sheet_id',
        'dse.class_id',
        'c.name as class_name',
        'c.grade_level',
        'dse.subject_id',
        's.name as subject_name',
        's.code as subject_code',
        'dse.exam_date',
        'dse.day_of_week',
        'dse.start_time',
        'dse.end_time',
        'dse.subject_type',
        'dse.instructions',
        'dse.timetable_slot_id',
        'dse.assessment_timing',
        'dse.duration_minutes',
        'dse.is_date_changed',
        'dse.previous_exam_date',
        'dse.previous_start_time',
        'dse.previous_end_time',
        'dse.order_index'
      )
      .orderBy(['dse.exam_date', 'dse.start_time', 'dse.order_index']);

    return publishedSheets.map((sheet) => {
      const sheetEntries = entries.filter((e) => Number(e.date_sheet_id) === Number(sheet.id));
      return {
        ...sheet,
        class_id: classId,
        class_name: sheetEntries[0]?.class_name || `Class ${classId}`,
        entries: sheetEntries
      };
    });
  },

  /**
   * Find teacher record and assigned class/subjects
   */
  async getTeacherAssignedClassSubjects(userId) {
    const teacher = await db('teachers').where({ user_id: userId }).first();
    if (!teacher) return { teacherId: null, assignments: [] };

    // Find assigned class_id and subject_id pairs from teacher_assignments & timetable_slots
    const assignments1 = await db('teacher_assignments')
      .where({ teacher_id: teacher.id })
      .select('class_id', 'subject_id');

    const assignments2 = await db('timetable_slots')
      .where({ teacher_id: teacher.id })
      .select('class_id', 'subject_id');

    const combinedMap = new Map();
    [...assignments1, ...assignments2].forEach((a) => {
      combinedMap.set(`${a.class_id}_${a.subject_id}`, {
        class_id: Number(a.class_id),
        subject_id: Number(a.subject_id)
      });
    });

    return {
      teacherId: teacher.id,
      assignments: Array.from(combinedMap.values())
    };
  },

  /**
   * Find teacher active published date sheets strictly for teacher's assigned subjects & classes
   */
  async getTeacherActiveDateSheets(teacherId, assignments) {
    // 1. Get published date sheets
    const publishedSheets = await db('examination_date_sheets as eds')
      .join('academic_sessions as ses', 'eds.academic_session_id', 'ses.id')
      .where('eds.is_published', 1)
      .andWhere('eds.status', 'PUBLISHED')
      .select(
        'eds.id',
        'eds.academic_session_id',
        'ses.name as session_name',
        'eds.exam_type',
        'eds.title',
        'eds.description',
        'eds.published_at'
      )
      .orderBy('eds.published_at', 'desc');

    if (publishedSheets.length === 0) return [];

    const sheetIds = publishedSheets.map((s) => s.id);

    // 2. Query entries matching this teacher explicitly OR matching assigned (class_id, subject_id)
    const entriesQuery = db('date_sheet_entries as dse')
      .join('classes as c', 'dse.class_id', 'c.id')
      .join('subjects as s', 'dse.subject_id', 's.id')
      .leftJoin('teachers as t', 'dse.teacher_id', 't.id')
      .leftJoin('users as tu', 't.user_id', 'tu.id')
      .whereIn('dse.date_sheet_id', sheetIds)
      .andWhere(function () {
        if (teacherId) {
          this.where('dse.teacher_id', teacherId);
        }
        if (assignments.length > 0) {
          assignments.forEach((a) => {
            this.orWhere(function () {
              this.where('dse.class_id', a.class_id).andWhere('dse.subject_id', a.subject_id);
            });
          });
        }
      })
      .select(
        'dse.id',
        'dse.date_sheet_id',
        'dse.class_id',
        'c.name as class_name',
        'c.grade_level',
        'dse.subject_id',
        's.name as subject_name',
        's.code as subject_code',
        'dse.teacher_id',
        'tu.full_name as teacher_name',
        'dse.exam_date',
        'dse.day_of_week',
        'dse.start_time',
        'dse.end_time',
        'dse.subject_type',
        'dse.instructions',
        'dse.timetable_slot_id',
        'dse.assessment_timing',
        'dse.duration_minutes',
        'dse.is_date_changed',
        'dse.previous_exam_date',
        'dse.previous_start_time',
        'dse.previous_end_time',
        'dse.order_index'
      )
      .orderBy(['dse.class_id', 'dse.exam_date', 'dse.start_time', 'dse.order_index']);

    const matchingEntries = await entriesQuery;

    // Filter sheets to only those that have matching entries for this teacher
    return publishedSheets
      .map((sheet) => {
        const sheetEntries = matchingEntries.filter((e) => Number(e.date_sheet_id) === Number(sheet.id));
        return {
          ...sheet,
          entries: sheetEntries
        };
      })
      .filter((sheet) => sheet.entries.length > 0);
  }
};

