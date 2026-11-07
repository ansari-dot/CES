import { db } from '../../shared/db/knex.js';

export const performanceRepository = {
  // =========================================================================
  // 1. ACADEMIC GRADING POLICIES
  // =========================================================================

  /**
   * Find the active grading policy.
   * Checks session-specific first; falls back to GLOBAL active policy.
   */
  async findActivePolicy(sessionId = null, trx = db) {
    if (sessionId) {
      const sessionPolicy = await trx('academic_grading_policies')
        .where({ scope: 'SESSION', session_id: sessionId, status: 'ACTIVE' })
        .first();
      if (sessionPolicy) return sessionPolicy;
    }

    return trx('academic_grading_policies')
      .where({ scope: 'GLOBAL', status: 'ACTIVE' })
      .first();
  },

  async findPolicyById(id, trx = db) {
    return trx('academic_grading_policies').where({ id }).first();
  },

  async listPolicies({ scope, sessionId, status, limit = 50, offset = 0 } = {}, trx = db) {
    let query = trx('academic_grading_policies').select('*');
    if (scope) query = query.where({ scope });
    if (sessionId) query = query.where({ session_id: sessionId });
    if (status) query = query.where({ status });
    return query.orderBy('created_at', 'desc').limit(limit).offset(offset);
  },

  async countPolicies({ scope, sessionId, status } = {}, trx = db) {
    let query = trx('academic_grading_policies');
    if (scope) query = query.where({ scope });
    if (sessionId) query = query.where({ session_id: sessionId });
    if (status) query = query.where({ status });
    const [{ count }] = await query.count('* as count');
    return Number(count);
  },

  async createPolicy(policyData, trx = db) {
    const [id] = await trx('academic_grading_policies').insert(policyData);
    return this.findPolicyById(id, trx);
  },

  async updatePolicy(id, updates, trx = db) {
    await trx('academic_grading_policies')
      .where({ id })
      .update({ ...updates, updated_at: trx.raw('CURRENT_TIMESTAMP(3)') });
    return this.findPolicyById(id, trx);
  },

  async archiveActivePolicy(scope, sessionId = null, trx = db) {
    let query = trx('academic_grading_policies')
      .where({ scope, status: 'ACTIVE' });
    if (sessionId) {
      query = query.where({ session_id: sessionId });
    } else {
      query = query.whereNull('session_id');
    }
    return query.update({ status: 'ARCHIVED', updated_at: trx.raw('CURRENT_TIMESTAMP(3)') });
  },

  // =========================================================================
  // 2. FORMATIVE ASSESSMENTS DATA EXTRACTION
  // =========================================================================

  /**
   * Fetch all tests of a specific exam_type for a student & subject within a session.
   */
  async getStudentTestsByType({ studentId, subjectId, sessionId, examType }, trx = db) {
    return trx('monthly_tests as mt')
      .leftJoin('test_attempts as ta', function () {
        this.on('ta.test_id', '=', 'mt.id')
          .andOn('ta.student_id', '=', trx.raw('?', [studentId]));
      })
      .where('mt.session_id', sessionId)
      .andWhere('mt.subject_id', subjectId)
      .andWhere('mt.exam_type', examType)
      .whereIn('mt.status', ['PUBLISHED', 'RESULTS_PUBLISHED', 'CLOSED'])
      .select(
        'mt.id as test_id',
        'mt.title',
        'mt.exam_type',
        'mt.total_marks',
        'mt.passing_marks',
        'ta.id as attempt_id',
        'ta.status as attempt_status',
        'ta.total_score as obtained_score',
        'ta.is_passed',
        'ta.submitted_at'
      )
      .orderBy('mt.available_from', 'asc');
  },

  /**
   * Fetch all learning tasks & submissions for a student & subject within a session.
   */
  async getStudentHomeworkTasks({ studentId, subjectId, sessionId }, trx = db) {
    return trx('learning_tasks as lt')
      .leftJoin('task_submissions as ts', function () {
        this.on('ts.task_id', '=', 'lt.id')
          .andOn('ts.student_id', '=', trx.raw('?', [studentId]));
      })
      .where('lt.session_id', sessionId)
      .andWhere('lt.subject_id', subjectId)
      .whereIn('lt.status', ['ACTIVE', 'ARCHIVED'])
      .select(
        'lt.id as task_id',
        'lt.title',
        'lt.total_marks',
        'lt.deadline',
        'ts.id as submission_id',
        'ts.status as submission_status',
        'ts.marks_awarded',
        'ts.is_late',
        'ts.submitted_at'
      )
      .orderBy('lt.deadline', 'asc');
  },

  /**
   * Fetch attendance stats for a student in a session.
   */
  async getStudentAttendanceRate({ studentId, classId, sessionId }, trx = db) {
    let query = trx('lesson_attendance as la')
      .join('timetable_lessons as tl', 'la.lesson_id', 'tl.id')
      .where('la.student_id', studentId);

    if (sessionId) {
      query = query.join('timetable_slots as ts', 'tl.slot_id', 'ts.id')
        .where('ts.session_id', sessionId);
    }
    if (classId) {
      query = query.where('tl.class_id', classId);
    }

    const records = await query
      .select(
        trx.raw('COUNT(la.id) as total_sessions'),
        trx.raw("SUM(CASE WHEN la.status = 'PRESENT' THEN 1 ELSE 0 END) as present_sessions"),
        trx.raw("SUM(CASE WHEN la.status = 'LATE' THEN 1 ELSE 0 END) as late_sessions"),
        trx.raw("SUM(CASE WHEN la.status = 'ABSENT' THEN 1 ELSE 0 END) as absent_sessions")
      )
      .first();

    const total = Number(records?.total_sessions || 0);
    const present = Number(records?.present_sessions || 0);
    const late = Number(records?.late_sessions || 0);
    const rate = total > 0 ? Number(((present + late * 0.5) / total * 100).toFixed(2)) : 100.00;

    return {
      totalSessions: total,
      presentSessions: present,
      lateSessions: late,
      absentSessions: Number(records?.absent_sessions || 0),
      attendanceRate: rate
    };
  },

  // =========================================================================
  // 3. 48-HOUR ROLLING COOLDOWN & ALERTS
  // =========================================================================

  async getCooldown(studentId, subjectId, trx = db) {
    return trx('academic_alert_cooldowns')
      .where({ student_id: studentId, subject_id: subjectId })
      .first();
  },

  async upsertCooldown({ studentId, subjectId, lastAlertType, lastAlertAt, cooldownExpiresAt, lastWasUrgent }, trx = db) {
    return trx.raw(`
      INSERT INTO academic_alert_cooldowns (
        student_id, subject_id, last_alert_type, last_alert_at, cooldown_expires_at, last_was_urgent, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
      ON DUPLICATE KEY UPDATE
        last_alert_type = VALUES(last_alert_type),
        last_alert_at = VALUES(last_alert_at),
        cooldown_expires_at = VALUES(cooldown_expires_at),
        last_was_urgent = VALUES(last_was_urgent),
        updated_at = CURRENT_TIMESTAMP(3)
    `, [studentId, subjectId, lastAlertType, lastAlertAt, cooldownExpiresAt, lastWasUrgent ? 1 : 0]);
  },

  /**
   * Fetch verified parents linked to a student.
   */
  async getVerifiedParentsForStudent(studentId, trx = db) {
    return trx('parent_student as ps')
      .join('parents as p', 'ps.parent_id', 'p.id')
      .join('users as u', 'p.user_id', 'u.id')
      .where('ps.student_id', studentId)
      .select(
        'p.id as parent_id',
        'u.id as user_id',
        'u.full_name as parent_name',
        'u.email as parent_email',
        'ps.relation',
        'ps.is_primary'
      );
  },

  /**
   * Atomic transactional insert for alert, recipients, and outbox entries.
   */
  async createAlertWithRecipientsAndOutbox({ alertData, recipients, outboxItems }, trx = db) {
    const [alertId] = await trx('academic_parent_alerts').insert(alertData);

    const insertedRecipients = [];
    for (const r of recipients) {
      const [recipientId] = await trx('academic_alert_recipients').insert({
        alert_id: alertId,
        parent_id: r.parentId,
        student_id: alertData.student_id,
        relationship_type: r.relation,
        status: 'PENDING'
      });
      insertedRecipients.push({ recipientId, ...r });
    }

    const createdOutbox = [];
    for (const item of outboxItems) {
      const matched = insertedRecipients.find((r) => r.parentId === item.parentId);
      if (matched) {
        const [outboxId] = await trx('academic_alert_outbox').insert({
          alert_id: alertId,
          recipient_id: matched.recipientId,
          idempotency_key: item.idempotencyKey,
          payload: JSON.stringify(item.payload),
          status: 'PENDING'
        });
        createdOutbox.push(outboxId);
      }
    }

    return {
      alertId,
      recipientCount: insertedRecipients.length,
      outboxCount: createdOutbox.length
    };
  },

  async getAlertById(alertId, trx = db) {
    return trx('academic_parent_alerts as apa')
      .join('students as s', 'apa.student_id', 's.id')
      .join('users as su', 's.user_id', 'su.id')
      .join('subjects as sub', 'apa.subject_id', 'sub.id')
      .leftJoin('teachers as t', 'apa.teacher_id', 't.id')
      .leftJoin('users as tu', 't.user_id', 'tu.id')
      .where('apa.id', alertId)
      .select(
        'apa.*',
        'su.full_name as student_name',
        'sub.name as subject_name',
        'sub.code as subject_code',
        'tu.full_name as teacher_name'
      )
      .first();
  },

  async getAlertRecipients(alertId, trx = db) {
    return trx('academic_alert_recipients as aar')
      .join('parents as p', 'aar.parent_id', 'p.id')
      .join('users as u', 'p.user_id', 'u.id')
      .where('aar.alert_id', alertId)
      .select(
        'aar.*',
        'u.full_name as parent_name',
        'u.email as parent_email'
      );
  },

  async listAlerts({ studentId, sessionId, teacherId, limit = 50, offset = 0 } = {}, trx = db) {
    let query = trx('academic_parent_alerts as apa')
      .join('students as s', 'apa.student_id', 's.id')
      .join('users as su', 's.user_id', 'su.id')
      .join('subjects as sub', 'apa.subject_id', 'sub.id')
      .leftJoin('teachers as t', 'apa.teacher_id', 't.id')
      .leftJoin('users as tu', 't.user_id', 'tu.id')
      .select(
        'apa.*',
        'su.full_name as student_name',
        'sub.name as subject_name',
        'sub.code as subject_code',
        'tu.full_name as teacher_name'
      );

    if (studentId) query = query.where('apa.student_id', studentId);
    if (sessionId) query = query.where('apa.session_id', sessionId);
    if (teacherId) query = query.where('apa.teacher_id', teacherId);

    return query.orderBy('apa.created_at', 'desc').limit(limit).offset(offset);
  }
};
