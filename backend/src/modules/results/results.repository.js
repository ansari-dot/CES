import { db } from '../../shared/db/knex.js';

export const resultsRepository = {
  async getTermById(id) {
    return await db('academic_terms').where({ id }).first();
  },

  async getFinalTerm(sessionId) {
    const final = await db('academic_terms').where({ session_id: sessionId, is_final: 1 }).first();
    if (final) return final;
    // Fall back to the last term of the session when none is flagged final.
    return await db('academic_terms')
      .where({ session_id: sessionId })
      .orderBy('sort_order', 'desc')
      .orderBy('end_date', 'desc')
      .first();
  },

  async getClassByGrade(gradeLevel) {
    return await db('classes').where({ grade_level: gradeLevel }).first();
  },

  async getMaxGradeLevel() {
    const row = await db('classes').where({ is_active: 1 }).max({ max: 'grade_level' }).first();
    return row ? Number(row.max) : 8;
  },

  /** Active class subjects with names. */
  async getClassSubjects(classId) {
    return await db('class_subjects')
      .join('subjects', 'class_subjects.subject_id', 'subjects.id')
      .where('class_subjects.class_id', classId)
      .where('class_subjects.is_active', 1)
      .select('subjects.id', 'subjects.name', 'subjects.code');
  },

  /**
   * Active students of a class with their enrollment for the session.
   * Enrollment may be null when the student was admitted without one.
   */
  async getClassStudentsWithEnrollment(classId, sessionId) {
    return await db('students')
      .join('users', 'students.user_id', 'users.id')
      .leftJoin('enrollments', (join) => {
        join
          .on('enrollments.student_id', '=', 'students.id')
          .andOnVal('enrollments.session_id', '=', sessionId);
      })
      .where('students.current_class_id', classId)
      .whereIn('students.status', ['ACTIVE', 'SUSPENDED'])
      .select(
        'students.id as studentId',
        'students.user_id as userId',
        'students.admission_no as admissionNo',
        'students.roll_no as rollNo',
        'users.full_name as studentName',
        'enrollments.id as enrollmentId',
        'enrollments.status as enrollmentStatus'
      )
      .orderBy('students.roll_no');
  },

  async ensureEnrollment(trx, { studentId, classId, sessionId, rollNo }) {
    const existing = await trx('enrollments').where({ student_id: studentId, session_id: sessionId }).first();
    if (existing) return existing.id;
    const [id] = await trx('enrollments').insert({
      student_id: studentId,
      class_id: classId,
      session_id: sessionId,
      roll_no: rollNo || null,
      status: 'ACTIVE',
      enrolled_on: trx.fn.now()
    });
    return id;
  },

  /**
   * Per-student per-subject aggregates of graded EXAM-type tasks whose
   * deadline falls inside the term.
   */
  async getExamAggregates({ classId, sessionId, termStart, termEnd }) {
    const rows = await db('learning_tasks')
      .leftJoin('task_submissions', 'task_submissions.task_id', 'learning_tasks.id')
      .where('learning_tasks.class_id', classId)
      .where('learning_tasks.session_id', sessionId)
      .where('learning_tasks.task_type', 'EXAM')
      .whereIn('learning_tasks.status', ['ACTIVE', 'ARCHIVED'])
      .whereBetween('learning_tasks.deadline', [`${termStart} 00:00:00`, `${termEnd} 23:59:59`])
      .select(
        'learning_tasks.id as taskId',
        'learning_tasks.subject_id as subjectId',
        'learning_tasks.total_marks as taskTotal',
        'task_submissions.student_id as studentId',
        'task_submissions.marks_awarded as marksAwarded'
      );

    // taskTotals: subjectId -> total marks of all exam tasks of that subject
    const taskTotals = new Map();
    const seenTasks = new Set();
    for (const row of rows) {
      if (!seenTasks.has(row.taskId)) {
        seenTasks.add(row.taskId);
        taskTotals.set(row.subjectId, (taskTotals.get(row.subjectId) || 0) + Number(row.taskTotal));
      }
    }

    // perStudent: studentId -> subjectId -> { obtained, gradedTasks }
    const perStudent = new Map();
    for (const row of rows) {
      if (!row.studentId || row.marksAwarded === null) continue;
      if (!perStudent.has(row.studentId)) perStudent.set(row.studentId, new Map());
      const bySubject = perStudent.get(row.studentId);
      if (!bySubject.has(row.subjectId)) bySubject.set(row.subjectId, { obtained: 0, gradedTasks: 0 });
      const agg = bySubject.get(row.subjectId);
      agg.obtained += Number(row.marksAwarded);
      agg.gradedTasks += 1;
    }

    return { taskTotals, perStudent, examTaskCount: seenTasks.size };
  },

  async getResultByEnrollmentTerm(trx, enrollmentId, termId) {
    return await (trx || db)('final_results').where({ enrollment_id: enrollmentId, term_id: termId }).first();
  },

  async getResultSubjects(resultId, trx = null) {
    return await (trx || db)('final_result_subjects')
      .join('subjects', 'final_result_subjects.subject_id', 'subjects.id')
      .where('final_result_subjects.final_result_id', resultId)
      .select(
        'final_result_subjects.*',
        'subjects.name as subjectName',
        'subjects.code as subjectCode'
      );
  },

  async getResultById(id) {
    const result = await db('final_results')
      .join('students', 'final_results.student_id', 'students.id')
      .join('users', 'students.user_id', 'users.id')
      .join('classes', 'final_results.class_id', 'classes.id')
      .join('academic_terms', 'final_results.term_id', 'academic_terms.id')
      .join('academic_sessions', 'final_results.session_id', 'academic_sessions.id')
      .where('final_results.id', id)
      .select(
        'final_results.*',
        'users.full_name as studentName',
        'students.admission_no as admissionNo',
        'students.roll_no as rollNo',
        'classes.name as className',
        'classes.grade_level as classNumber',
        'academic_terms.name as termName',
        'academic_sessions.name as sessionName'
      )
      .first();
    if (!result) return null;
    result.subjects = await this.getResultSubjects(id);
    return result;
  },

  async listResults({ sessionId, termId, classId, statuses = null }) {
    let query = db('final_results')
      .join('students', 'final_results.student_id', 'students.id')
      .join('users', 'students.user_id', 'users.id')
      .join('classes', 'final_results.class_id', 'classes.id')
      .join('academic_terms', 'final_results.term_id', 'academic_terms.id')
      .select(
        'final_results.*',
        'users.full_name as studentName',
        'students.admission_no as admissionNo',
        'students.roll_no as rollNo',
        'classes.name as className',
        'classes.grade_level as classNumber',
        'academic_terms.name as termName'
      )
      .orderBy('classes.grade_level')
      .orderBy('students.roll_no');
    if (sessionId) query = query.where('final_results.session_id', sessionId);
    if (termId) query = query.where('final_results.term_id', termId);
    if (classId) query = query.where('final_results.class_id', classId);
    if (statuses) query = query.whereIn('final_results.result_status', statuses);
    return await query;
  },

  async updateResultStatus(ids, updates, trx = null) {
    if (!ids.length) return 0;
    return await (trx || db)('final_results').whereIn('id', ids).update(updates);
  },

  // ── Marks submissions (teacher hand-off) ───────────────────────────

  async upsertMarksSubmission({ sessionId, termId, classId, subjectId, teacherId, submittedBy, note }) {
    const existing = await db('marks_submissions')
      .where({ term_id: termId, class_id: classId, subject_id: subjectId })
      .first();
    if (existing) {
      await db('marks_submissions').where({ id: existing.id }).update({
        status: 'SUBMITTED',
        teacher_id: teacherId || existing.teacher_id,
        submitted_by: submittedBy,
        note: note || existing.note,
        submitted_at: db.fn.now(3)
      });
      return existing.id;
    }
    const [id] = await db('marks_submissions').insert({
      session_id: sessionId,
      term_id: termId,
      class_id: classId,
      subject_id: subjectId,
      teacher_id: teacherId || null,
      submitted_by: submittedBy,
      note: note || null
    });
    return id;
  },

  async getMarksSubmissions(termId, classId = null) {
    let query = db('marks_submissions')
      .join('subjects', 'marks_submissions.subject_id', 'subjects.id')
      .join('classes', 'marks_submissions.class_id', 'classes.id')
      .leftJoin('teachers', 'marks_submissions.teacher_id', 'teachers.id')
      .leftJoin('users', 'teachers.user_id', 'users.id')
      .where('marks_submissions.term_id', termId)
      .select(
        'marks_submissions.*',
        'subjects.name as subjectName',
        'classes.grade_level as classNumber',
        'classes.name as className',
        'users.full_name as teacherName'
      );
    if (classId) query = query.where('marks_submissions.class_id', classId);
    return await query;
  },

  // ── Student / parent reads ─────────────────────────────────────────

  async getPublishedResultsForStudent(studentId) {
    const results = await db('final_results')
      .join('classes', 'final_results.class_id', 'classes.id')
      .join('academic_terms', 'final_results.term_id', 'academic_terms.id')
      .join('academic_sessions', 'final_results.session_id', 'academic_sessions.id')
      .where('final_results.student_id', studentId)
      .where('final_results.result_status', 'PUBLISHED')
      .select(
        'final_results.*',
        'classes.name as className',
        'classes.grade_level as classNumber',
        'academic_terms.name as termName',
        'academic_terms.is_final as isFinalTerm',
        'academic_sessions.name as sessionName'
      )
      .orderBy('academic_sessions.start_date', 'desc')
      .orderBy('academic_terms.sort_order', 'desc');
    for (const r of results) {
      r.subjects = await this.getResultSubjects(r.id);
    }
    return results;
  },

  async getEnrollmentHistory(studentId) {
    return await db('enrollments')
      .join('classes', 'enrollments.class_id', 'classes.id')
      .join('academic_sessions', 'enrollments.session_id', 'academic_sessions.id')
      .where('enrollments.student_id', studentId)
      .select(
        'enrollments.id',
        'enrollments.status',
        'enrollments.roll_no as rollNo',
        'enrollments.enrolled_on as enrolledOn',
        'enrollments.ended_on as endedOn',
        'classes.name as className',
        'classes.grade_level as classNumber',
        'academic_sessions.name as sessionName',
        'academic_sessions.id as sessionId',
        'academic_sessions.is_current as isCurrent'
      )
      .orderBy('academic_sessions.start_date', 'desc');
  },

  async getPromotionStatusForStudent(studentId) {
    return await db('promotion_records')
      .leftJoin('classes as toClass', 'promotion_records.to_class_id', 'toClass.id')
      .leftJoin('academic_sessions as toSession', 'promotion_records.to_session_id', 'toSession.id')
      .join('academic_sessions as fromSession', 'promotion_records.session_id', 'fromSession.id')
      .where('promotion_records.student_id', studentId)
      .whereIn('promotion_records.status', ['DECIDED', 'EXECUTED'])
      .select(
        'promotion_records.decision',
        'promotion_records.status',
        'promotion_records.executed_at as executedAt',
        'fromSession.name as fromSessionName',
        'toSession.name as toSessionName',
        'toClass.name as toClassName',
        'toClass.grade_level as toClassNumber'
      )
      .orderBy('promotion_records.id', 'desc');
  },

  // ── Principal overview ─────────────────────────────────────────────

  async getClassTermOverview(sessionId, termId) {
    const classes = await db('classes').where({ is_active: 1 }).orderBy('grade_level');
    const enrolled = await db('students')
      .whereIn('status', ['ACTIVE', 'SUSPENDED'])
      .groupBy('current_class_id')
      .select('current_class_id as classId')
      .count({ count: '*' });
    const results = await db('final_results')
      .where({ session_id: sessionId, term_id: termId })
      .groupBy('class_id', 'result_status', 'pass_status')
      .select('class_id as classId', 'result_status as resultStatus', 'pass_status as passStatus')
      .count({ count: '*' });
    const submissions = await db('marks_submissions')
      .where({ term_id: termId, status: 'SUBMITTED' })
      .groupBy('class_id')
      .select('class_id as classId')
      .count({ count: '*' });
    const subjectCounts = await db('class_subjects')
      .where({ is_active: 1 })
      .groupBy('class_id')
      .select('class_id as classId')
      .count({ count: '*' });
    return { classes, enrolled, results, submissions, subjectCounts };
  }
};
