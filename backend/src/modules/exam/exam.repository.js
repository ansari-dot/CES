import { db } from '../../shared/db/knex.js';

export const examRepository = {
  async createExam(data, trx = null) {
    const [id] = await (trx || db)('terminal_exams').insert(data);
    return id;
  },

  async getExamById(id, trx = null) {
    return await (trx || db)('terminal_exams as te')
      .join('academic_sessions as s', 'te.session_id', 's.id')
      .join('academic_terms as t', 'te.term_id', 't.id')
      .join('users as u', 'te.created_by', 'u.id')
      .where('te.id', id)
      .select(
        'te.*',
        's.name as sessionName',
        's.status as sessionStatus',
        't.name as termName',
        't.is_final as isFinalTerm',
        'u.username as createdByUsername'
      )
      .first();
  },

  async listExams({ sessionId, termId, status, examType }, trx = null) {
    let query = (trx || db)('terminal_exams as te')
      .join('academic_sessions as s', 'te.session_id', 's.id')
      .join('academic_terms as t', 'te.term_id', 't.id')
      .leftJoin('terminal_exam_papers as tep', 'tep.exam_id', 'te.id')
      .groupBy('te.id')
      .select(
        'te.*',
        's.name as sessionName',
        't.name as termName',
        db.raw('COUNT(DISTINCT tep.id) as paperCount'),
        db.raw('COUNT(DISTINCT tep.class_id) as classCount')
      )
      .orderBy('te.start_date', 'desc');

    if (sessionId) query = query.where('te.session_id', Number(sessionId));
    if (termId) query = query.where('te.term_id', Number(termId));
    if (status) query = query.where('te.status', status);
    if (examType) query = query.where('te.exam_type', examType);

    return await query;
  },

  async updateExam(id, fields, trx = null) {
    return await (trx || db)('terminal_exams')
      .where({ id })
      .update({ ...fields, updated_at: db.fn.now(3) });
  },

  async createPaper(data, trx = null) {
    const [id] = await (trx || db)('terminal_exam_papers').insert(data);
    return id;
  },

  async getPaperById(id, trx = null) {
    return await (trx || db)('terminal_exam_papers as tep')
      .join('terminal_exams as te', 'tep.exam_id', 'te.id')
      .join('classes as c', 'tep.class_id', 'c.id')
      .join('subjects as s', 'tep.subject_id', 's.id')
      .leftJoin('teachers as t_mark', 'tep.marking_teacher_id', 't_mark.id')
      .leftJoin('teachers as t_inv', 'tep.invigilator_teacher_id', 't_inv.id')
      .where('tep.id', id)
      .select(
        'tep.*',
        'te.title as examTitle',
        'te.session_id as sessionId',
        'te.term_id as termId',
        'te.status as examStatus',
        'c.name as className',
        'c.grade_level as gradeLevel',
        's.name as subjectName',
        's.code as subjectCode',
        't_mark.user_id as markingTeacherUserId',
        't_inv.user_id as invigilatorTeacherUserId'
      )
      .first();
  },

  async listPapersByExam(examId, { classId, markingTeacherId, status, teacherPairs }, trx = null) {
    let query = (trx || db)('terminal_exam_papers as tep')
      .join('classes as c', 'tep.class_id', 'c.id')
      .join('subjects as s', 'tep.subject_id', 's.id')
      .leftJoin('teachers as t', 'tep.marking_teacher_id', 't.id')
      .leftJoin('users as u', 't.user_id', 'u.id')
      .where('tep.exam_id', examId)
      .select(
        'tep.*',
        'c.name as className',
        'c.grade_level as gradeLevel',
        's.name as subjectName',
        's.code as subjectCode',
        'u.username as markingTeacherName'
      )
      .orderBy(['tep.paper_date', 'tep.start_time']);

    if (classId) query = query.where('tep.class_id', Number(classId));
    if (status) query = query.where('tep.status', status);

    if (markingTeacherId) {
      if (teacherPairs && teacherPairs.length > 0) {
        query = query.where((builder) => {
          builder.where('tep.marking_teacher_id', Number(markingTeacherId))
            .orWhere((inner) => {
              inner.whereNull('tep.marking_teacher_id')
                .whereIn(db.raw("CONCAT(tep.class_id, '-', tep.subject_id)"), teacherPairs);
            });
        });
      } else {
        query = query.where('tep.marking_teacher_id', Number(markingTeacherId));
      }
    }

    return await query;
  },

  async updatePaper(id, fields, trx = null) {
    return await (trx || db)('terminal_exam_papers')
      .where({ id })
      .update({ ...fields, updated_at: db.fn.now(3) });
  },

  async getEnrolledStudentsForClass(classId, sessionId, trx = null) {
    return await (trx || db)('enrollments as e')
      .join('students as st', 'e.student_id', 'st.id')
      .join('users as u', 'st.user_id', 'u.id')
      .where('e.class_id', classId)
      .where('e.session_id', sessionId)
      .whereIn('e.status', ['ACTIVE', 'ENROLLED', 'PROMOTED'])
      .whereIn('st.status', ['ACTIVE', 'SUSPENDED'])
      .select(
        'st.id as studentId',
        'st.admission_no as admissionNumber',
        'e.id as enrollmentId',
        db.raw('COALESCE(e.roll_no, st.roll_no) as rollNo'),
        'u.full_name as studentName',
        'u.email as studentEmail'
      )
      .orderBy(db.raw('CAST(COALESCE(e.roll_no, st.roll_no, 999999) AS UNSIGNED), st.admission_no'));
  },

  async getMarksByPaper(paperId, trx = null) {
    return await (trx || db)('terminal_exam_marks as tem')
      .join('students as st', 'tem.student_id', 'st.id')
      .join('users as u', 'st.user_id', 'u.id')
      .where('tem.paper_id', paperId)
      .select(
        'tem.*',
        'st.admission_no as admissionNumber',
        'u.full_name as studentName'
      );
  },

  async upsertMark(markData, trx = null) {
    const existing = await (trx || db)('terminal_exam_marks')
      .where({ paper_id: markData.paper_id, student_id: markData.student_id })
      .first();

    if (existing) {
      await (trx || db)('terminal_exam_marks')
        .where({ id: existing.id })
        .update({ ...markData, updated_at: db.fn.now(3) });
      return { id: existing.id, isUpdate: true, oldMark: existing };
    } else {
      const [id] = await (trx || db)('terminal_exam_marks').insert({
        ...markData,
        created_at: db.fn.now(3),
        updated_at: db.fn.now(3)
      });
      return { id, isUpdate: false, oldMark: null };
    }
  },

  async recordAudit(auditData, trx = null) {
    return await (trx || db)('terminal_exam_audits').insert({
      ...auditData,
      created_at: db.fn.now(3)
    });
  },

  async getExamPapersByClass(examId, classId, trx = null) {
    return await (trx || db)('terminal_exam_papers as tep')
      .join('subjects as s', 'tep.subject_id', 's.id')
      .where('tep.exam_id', examId)
      .where('tep.class_id', classId)
      .select('tep.*', 's.name as subjectName', 's.code as subjectCode');
  },

  async getMarksForExamAndClass(examId, classId, trx = null) {
    return await (trx || db)('terminal_exam_marks as tem')
      .join('terminal_exam_papers as tep', 'tem.paper_id', 'tep.id')
      .where('tep.exam_id', examId)
      .where('tep.class_id', classId)
      .select(
        'tem.*',
        'tep.subject_id as subjectId',
        'tep.total_marks as paperTotalMarks',
        'tep.passing_marks as paperPassingMarks'
      );
  },

  async syncFinalResultHeaderAndSubjects({ header, subjectRows }, trx = null) {
    const executor = trx || db;
    const existing = await executor('final_results')
      .where({
        enrollment_id: header.enrollment_id,
        term_id: header.term_id
      })
      .first();

    let finalResultId;
    if (existing) {
      await executor('final_results').where({ id: existing.id }).update(header);
      await executor('final_result_subjects').where({ final_result_id: existing.id }).delete();
      finalResultId = existing.id;
    } else {
      const [id] = await executor('final_results').insert(header);
      finalResultId = id;
    }

    if (subjectRows && subjectRows.length > 0) {
      const rowsToInsert = subjectRows.map((r) => ({
        ...r,
        final_result_id: finalResultId
      }));
      await executor('final_result_subjects').insert(rowsToInsert);
    }

    return finalResultId;
  }
};
