import { db } from '../../shared/db/knex.js';

export const promotionsRepository = {
  /** All enrollments of a session that can still receive a year-end outcome. */
  async getSessionEnrollments(sessionId) {
    return await db('enrollments')
      .join('students', 'enrollments.student_id', 'students.id')
      .join('users', 'students.user_id', 'users.id')
      .join('classes', 'enrollments.class_id', 'classes.id')
      .where('enrollments.session_id', sessionId)
      .select(
        'enrollments.id as enrollmentId',
        'enrollments.status as enrollmentStatus',
        'enrollments.class_id as classId',
        'enrollments.roll_no as rollNo',
        'classes.grade_level as classNumber',
        'classes.name as className',
        'students.id as studentId',
        'students.status as studentStatus',
        'students.admission_no as admissionNo',
        'users.full_name as studentName'
      )
      .orderBy('classes.grade_level')
      .orderBy('students.roll_no');
  },

  async getFinalResultsMap(sessionId, termId) {
    const rows = await db('final_results')
      .where({ session_id: sessionId, term_id: termId })
      .select('id', 'enrollment_id', 'result_status', 'pass_status', 'percentage', 'overall_grade');
    const map = new Map();
    for (const row of rows) map.set(Number(row.enrollment_id), row);
    return map;
  },

  async getRecord(id) {
    return await db('promotion_records').where({ id }).first();
  },

  async getRecordByStudentSession(studentId, sessionId, trx = null) {
    return await (trx || db)('promotion_records')
      .where({ student_id: studentId, session_id: sessionId })
      .first();
  },

  async listRecords({ sessionId, classId = null, statuses = null }) {
    let query = db('promotion_records')
      .join('students', 'promotion_records.student_id', 'students.id')
      .join('users', 'students.user_id', 'users.id')
      .join('classes as fromClass', 'promotion_records.from_class_id', 'fromClass.id')
      .leftJoin('classes as toClass', 'promotion_records.to_class_id', 'toClass.id')
      .leftJoin('final_results', 'promotion_records.final_result_id', 'final_results.id')
      .where('promotion_records.session_id', sessionId)
      .select(
        'promotion_records.*',
        'users.full_name as studentName',
        'students.admission_no as admissionNo',
        'students.roll_no as rollNo',
        'fromClass.grade_level as fromClassNumber',
        'fromClass.name as fromClassName',
        'toClass.grade_level as toClassNumber',
        'toClass.name as toClassName',
        'final_results.percentage as resultPercentage',
        'final_results.overall_grade as resultGrade',
        'final_results.pass_status as resultPassStatus',
        'final_results.result_status as resultStatus'
      )
      .orderBy('fromClass.grade_level')
      .orderBy('students.roll_no');
    if (classId) query = query.where('promotion_records.from_class_id', classId);
    if (statuses) query = query.whereIn('promotion_records.status', statuses);
    return await query;
  },

  async getOverviewCounts(sessionId) {
    const byEligibility = await db('promotion_records')
      .where({ session_id: sessionId })
      .groupBy('eligibility')
      .select('eligibility')
      .count({ count: '*' });
    const byDecision = await db('promotion_records')
      .where({ session_id: sessionId })
      .groupBy('decision', 'status')
      .select('decision', 'status')
      .count({ count: '*' });
    return { byEligibility, byDecision };
  },

  async getStudentHistory(studentId) {
    return await db('promotion_records')
      .join('academic_sessions as fromSession', 'promotion_records.session_id', 'fromSession.id')
      .leftJoin('academic_sessions as toSession', 'promotion_records.to_session_id', 'toSession.id')
      .join('classes as fromClass', 'promotion_records.from_class_id', 'fromClass.id')
      .leftJoin('classes as toClass', 'promotion_records.to_class_id', 'toClass.id')
      .where('promotion_records.student_id', studentId)
      .select(
        'promotion_records.*',
        'fromSession.name as fromSessionName',
        'toSession.name as toSessionName',
        'fromClass.name as fromClassName',
        'toClass.name as toClassName'
      )
      .orderBy('promotion_records.id', 'desc');
  }
};
