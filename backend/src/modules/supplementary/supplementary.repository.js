import { db } from '../../shared/db/knex.js';

export const supplementaryRepository = {
  /**
   * Find all failed Terminal Exam subject results eligible for supplementary exam.
   */
  async findFailedTerminalSubjects({ sessionId, classId, studentId } = {}, trx = db) {
    let query = trx('final_result_subjects as frs')
      .join('final_results as fr', 'frs.final_result_id', 'fr.id')
      .join('students as s', 'fr.student_id', 's.id')
      .join('users as su', 's.user_id', 'su.id')
      .join('subjects as sub', 'frs.subject_id', 'sub.id')
      .join('classes as c', 'fr.class_id', 'c.id')
      .join('academic_sessions as sess', 'fr.session_id', 'sess.id')
      .leftJoin('supplementary_exam_results as ser', function () {
        this.on('ser.final_result_subject_id', '=', 'frs.id')
          .andOnIn('ser.status', ['AWAITING_SCHEDULE', 'SCHEDULED', 'DRAFT', 'SUBMITTED', 'APPROVED', 'PUBLISHED']);
      })
      .where('frs.passed', 0)
      .whereIn('fr.result_status', ['APPROVED', 'PUBLISHED'])
      .select(
        'frs.id as final_result_subject_id',
        'fr.id as final_result_id',
        'fr.student_id',
        'fr.session_id',
        'fr.class_id',
        'frs.subject_id',
        'frs.total_marks as original_max_marks',
        'frs.obtained_marks as original_obtained_marks',
        'frs.grade as original_grade',
        'frs.is_absent as original_is_absent',
        'frs.passed as original_subject_passed',
        'su.full_name as student_name',
        's.admission_no',
        'c.name as class_name',
        'sub.name as subject_name',
        'sub.code as subject_code',
        'sess.name as session_name',
        'ser.id as active_supplementary_id',
        'ser.status as supplementary_status',
        'ser.attempt_number as current_attempt_number',
        'ser.is_passed as supplementary_is_passed'
      );

    if (sessionId) query = query.where('fr.session_id', sessionId);
    if (classId) query = query.where('fr.class_id', classId);
    if (studentId) query = query.where('fr.student_id', studentId);

    return query.orderBy(['fr.class_id', 'su.full_name']);
  },

  /**
   * Find a single supplementary exam record with comprehensive details.
   */
  async findById(id, trx = db) {
    return trx('supplementary_exam_results as ser')
      .join('students as s', 'ser.student_id', 's.id')
      .join('users as su', 's.user_id', 'su.id')
      .join('subjects as sub', 'ser.subject_id', 'sub.id')
      .join('classes as c', 'ser.class_id', 'c.id')
      .join('academic_sessions as sess', 'ser.session_id', 'sess.id')
      .leftJoin('date_sheet_entries as dse', 'ser.date_sheet_entry_id', 'dse.id')
      .leftJoin('monthly_tests as mt', 'ser.monthly_test_id', 'mt.id')
      .leftJoin('users as u_conducted', 'ser.conducted_by', 'u_conducted.id')
      .leftJoin('users as u_approved', 'ser.approved_by', 'u_approved.id')
      .leftJoin('users as u_published', 'ser.published_by', 'u_published.id')
      .leftJoin('users as u_cancelled', 'ser.cancelled_by', 'u_cancelled.id')
      .where('ser.id', id)
      .select(
        'ser.*',
        'su.full_name as student_name',
        's.admission_no',
        'c.name as class_name',
        'sub.name as subject_name',
        'sub.code as subject_code',
        'sess.name as session_name',
        'dse.exam_date as date_sheet_date',
        'mt.title as monthly_test_title',
        'u_conducted.full_name as conducted_by_name',
        'u_approved.full_name as approved_by_name',
        'u_published.full_name as published_by_name',
        'u_cancelled.full_name as cancelled_by_name'
      )
      .first();
  },

  /**
   * List supplementary records with filters.
   */
  async list({ sessionId, classId, studentId, subjectId, status, limit = 50, offset = 0 } = {}, trx = db) {
    let query = trx('supplementary_exam_results as ser')
      .join('students as s', 'ser.student_id', 's.id')
      .join('users as su', 's.user_id', 'su.id')
      .join('subjects as sub', 'ser.subject_id', 'sub.id')
      .join('classes as c', 'ser.class_id', 'c.id')
      .join('academic_sessions as sess', 'ser.session_id', 'sess.id')
      .select(
        'ser.*',
        'su.full_name as student_name',
        's.admission_no',
        'c.name as class_name',
        'sub.name as subject_name',
        'sub.code as subject_code',
        'sess.name as session_name'
      );

    if (sessionId) query = query.where('ser.session_id', sessionId);
    if (classId) query = query.where('ser.class_id', classId);
    if (studentId) query = query.where('ser.student_id', studentId);
    if (subjectId) query = query.where('ser.subject_id', subjectId);
    if (status) query = query.where('ser.status', status);

    return query.orderBy(['ser.class_id', 'ser.created_at'], 'desc').limit(limit).offset(offset);
  },

  async count({ sessionId, classId, studentId, subjectId, status } = {}, trx = db) {
    let query = trx('supplementary_exam_results as ser');
    if (sessionId) query = query.where('ser.session_id', sessionId);
    if (classId) query = query.where('ser.class_id', classId);
    if (studentId) query = query.where('ser.student_id', studentId);
    if (subjectId) query = query.where('ser.subject_id', subjectId);
    if (status) query = query.where('ser.status', status);

    const [{ count }] = await query.count('* as count');
    return Number(count);
  },

  /**
   * Insert a supplementary record.
   */
  async create(data, trx = db) {
    const [id] = await trx('supplementary_exam_results').insert(data);
    return this.findById(id, trx);
  },

  /**
   * Update mutable fields of a supplementary record.
   */
  async update(id, updates, trx = db) {
    await trx('supplementary_exam_results')
      .where({ id })
      .update({ ...updates, updated_at: trx.raw('CURRENT_TIMESTAMP(3)') });
    return this.findById(id, trx);
  },

  /**
   * Find existing active attempt for a given final_result_subject_id.
   */
  async findActiveAttemptForSubject(finalResultSubjectId, trx = db) {
    return trx('supplementary_exam_results')
      .where({ final_result_subject_id: finalResultSubjectId })
      .whereIn('status', ['AWAITING_SCHEDULE', 'SCHEDULED', 'DRAFT', 'SUBMITTED', 'APPROVED', 'PUBLISHED'])
      .first();
  },

  /**
   * Authoritative attempt resolution:
   * Returns the published attempt determining pass/clearance status.
   */
  async getAuthoritativePublishedAttempt(finalResultSubjectId, trx = db) {
    return trx('supplementary_exam_results')
      .where({ final_result_subject_id: finalResultSubjectId, status: 'PUBLISHED' })
      .orderBy([
        { column: 'is_passed', order: 'desc' },
        { column: 'obtained_marks', order: 'desc' },
        { column: 'attempt_number', order: 'desc' }
      ])
      .first();
  },

  /**
   * Atomic supersession and correction.
   * Creates new correction record and marks old published record SUPERSEDED.
   */
  async supersedeAndCreateCorrection(oldRecordId, newRecordData, trx = db) {
    // 1. Allocate next ID with exclusive table lock to preserve strict serial integrity
    const [idRows] = await trx.raw('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM supplementary_exam_results FOR UPDATE');
    const nextId = Number(idRows[0]?.next_id || 1);

    // 2. Mark old published record SUPERSEDED (clears uq_supp_active_attempt to NULL, satisfying DB triggers)
    await trx('supplementary_exam_results')
      .where({ id: oldRecordId })
      .update({
        status: 'SUPERSEDED',
        superseded_by_id: nextId,
        updated_at: trx.raw('CURRENT_TIMESTAMP(3)')
      });

    // 3. Insert new correction record with explicit allocated ID
    await trx('supplementary_exam_results').insert({
      id: nextId,
      ...newRecordData
    });

    return this.findById(nextId, trx);
  }
};
