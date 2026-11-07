import crypto from 'crypto';
import { db } from '../../shared/db/knex.js';
import { performanceRepository } from './performance.repository.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';

const COOLDOWN_HOURS = 48;

export const performanceService = {
  // =========================================================================
  // 1. POLICY MANAGEMENT
  // =========================================================================

  /**
   * Get active policy, ensuring a default global policy is seeded if none exists.
   */
  async getActivePolicy(sessionId = null) {
    let policy = await performanceRepository.findActivePolicy(sessionId);
    if (!policy) {
      // Seed default GLOBAL policy if none exists
      const [existingGlobal] = await db('academic_grading_policies').where({ scope: 'GLOBAL' }).limit(1);
      if (!existingGlobal) {
        policy = await performanceRepository.createPolicy({
          scope: 'GLOBAL',
          session_id: null,
          version: 'v1.0.0',
          policy_name: 'Standard Continuous Formative Policy',
          monthly_test_weight: 40.00,
          quiz_weight: 20.00,
          mid_term_weight: 30.00,
          homework_weight: 10.00,
          critical_risk_threshold: 40.00,
          attention_threshold: 60.00,
          good_standing_threshold: 75.00,
          excellent_threshold: 90.00,
          status: 'ACTIVE',
          effective_from: '2026-01-01',
          created_by: null
        });
      } else {
        policy = existingGlobal;
      }
    }
    return policy;
  },

  async listPolicies(filters) {
    const list = await performanceRepository.listPolicies(filters);
    const total = await performanceRepository.countPolicies(filters);
    return { data: list, total };
  },

  async getPolicyById(id) {
    const policy = await performanceRepository.findPolicyById(id);
    if (!policy) throw new AppError('Grading policy not found', 404, ErrorCodes.NOT_FOUND);
    return policy;
  },

  async createPolicy(policyData, actor) {
    // Validate weight sum
    const totalWeight =
      Number(policyData.monthly_test_weight || 0) +
      Number(policyData.quiz_weight || 0) +
      Number(policyData.mid_term_weight || 0) +
      Number(policyData.homework_weight || 0);

    if (Math.round(totalWeight * 100) / 100 !== 100.00) {
      throw new AppError('Formative weights must sum exactly to 100.00%', 422, ErrorCodes.VALIDATION_ERROR);
    }

    // Validate threshold hierarchy
    const crit = Number(policyData.critical_risk_threshold);
    const attn = Number(policyData.attention_threshold);
    const good = Number(policyData.good_standing_threshold);
    const excl = Number(policyData.excellent_threshold);

    if (!(crit < attn && attn < good && good < excl)) {
      throw new AppError(
        'Alert thresholds must satisfy: critical < attention < good_standing < excellent',
        422,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    return db.transaction(async (trx) => {
      if (policyData.status === 'ACTIVE') {
        await performanceRepository.archiveActivePolicy(policyData.scope, policyData.session_id, trx);
      }
      return performanceRepository.createPolicy(
        {
          ...policyData,
          created_by: actor?.id || null
        },
        trx
      );
    });
  },

  async activatePolicy(id, actor) {
    const target = await this.getPolicyById(id);
    if (target.status === 'ACTIVE') return target;

    return db.transaction(async (trx) => {
      await performanceRepository.archiveActivePolicy(target.scope, target.session_id, trx);
      return performanceRepository.updatePolicy(id, { status: 'ACTIVE' }, trx);
    });
  },

  // =========================================================================
  // 2. CONTINUOUS FORMATIVE SCORING (Dynamic Normalization)
  // =========================================================================

  /**
   * Calculates continuous formative progress for a student in a subject.
   * Terminal examination results are EXCLUDED from this calculation.
   */
  async calculateStudentSubjectScore({ studentId, subjectId, sessionId, classId = null }) {
    const policy = await this.getActivePolicy(sessionId);

    // 1. Fetch assessments by formative categories
    const [monthlyTests, quizzes, midTerms, homework] = await Promise.all([
      performanceRepository.getStudentTestsByType({ studentId, subjectId, sessionId, examType: 'MONTHLY_TEST' }),
      performanceRepository.getStudentTestsByType({ studentId, subjectId, sessionId, examType: 'CLASS_QUIZ' }),
      performanceRepository.getStudentTestsByType({ studentId, subjectId, sessionId, examType: 'MID_TERM' }),
      performanceRepository.getStudentHomeworkTasks({ studentId, subjectId, sessionId })
    ]);

    // Helper to evaluate a test category
    const evaluateTestCategory = (items) => {
      if (!items || items.length === 0) return { administered: 0, obtained: 0, total: 0, percentage: null };
      let obtainedSum = 0;
      let totalSum = 0;
      for (const t of items) {
        const total = Number(t.total_marks || 0);
        totalSum += total;
        // If graded or submitted score available
        if (t.attempt_status === 'GRADED' && t.obtained_score !== null) {
          obtainedSum += Number(t.obtained_score);
        } else if (t.attempt_status === 'SUBMITTED' && t.obtained_score !== null) {
          obtainedSum += Number(t.obtained_score);
        }
      }
      const percentage = totalSum > 0 ? Number(((obtainedSum / totalSum) * 100).toFixed(2)) : 0;
      return { administered: items.length, obtained: obtainedSum, total: totalSum, percentage };
    };

    // Helper to evaluate homework category
    const evaluateHomeworkCategory = (items) => {
      if (!items || items.length === 0) return { administered: 0, obtained: 0, total: 0, percentage: null };
      let obtainedSum = 0;
      let totalSum = 0;
      for (const h of items) {
        const total = Number(h.total_marks || 0);
        totalSum += total;
        if (h.submission_status === 'GRADED' && h.marks_awarded !== null) {
          obtainedSum += Number(h.marks_awarded);
        }
      }
      const percentage = totalSum > 0 ? Number(((obtainedSum / totalSum) * 100).toFixed(2)) : 0;
      return { administered: items.length, obtained: obtainedSum, total: totalSum, percentage };
    };

    const monthlyCat = evaluateTestCategory(monthlyTests);
    const quizCat = evaluateTestCategory(quizzes);
    const midTermCat = evaluateTestCategory(midTerms);
    const hwCat = evaluateHomeworkCategory(homework);

    // Dynamic Normalization: distribute weights across administered categories
    let weightedScoreSum = 0;
    let totalAdministeredWeight = 0;

    const categories = [
      { name: 'monthly_tests', result: monthlyCat, configuredWeight: Number(policy.monthly_test_weight) },
      { name: 'quizzes', result: quizCat, configuredWeight: Number(policy.quiz_weight) },
      { name: 'mid_terms', result: midTermCat, configuredWeight: Number(policy.mid_term_weight) },
      { name: 'homework', result: hwCat, configuredWeight: Number(policy.homework_weight) }
    ];

    for (const cat of categories) {
      if (cat.result.administered > 0 && cat.result.percentage !== null) {
        weightedScoreSum += cat.result.percentage * (cat.configuredWeight / 100);
        totalAdministeredWeight += cat.configuredWeight;
      }
    }

    let overallContinuousScore = 0;
    let hasAdministeredAssessments = totalAdministeredWeight > 0;

    if (hasAdministeredAssessments) {
      overallContinuousScore = Number(((weightedScoreSum / (totalAdministeredWeight / 100))).toFixed(2));
    } else {
      overallContinuousScore = 100.00; // Benchmark clean state if no assessments conducted yet
    }

    // Determine Standing
    const crit = Number(policy.critical_risk_threshold);
    const attn = Number(policy.attention_threshold);
    const good = Number(policy.good_standing_threshold);
    const excl = Number(policy.excellent_threshold);

    let standing = 'EXCELLENT';
    let alertCategorySuggestion = null;

    if (!hasAdministeredAssessments) {
      standing = 'PENDING_DATA';
    } else if (overallContinuousScore < crit) {
      standing = 'CRITICAL_RISK';
      alertCategorySuggestion = 'CRITICAL_RISK';
    } else if (overallContinuousScore < attn) {
      standing = 'ATTENTION_NEEDED';
      alertCategorySuggestion = 'ATTENTION_NEEDED';
    } else if (overallContinuousScore < good) {
      standing = 'ACCEPTABLE';
    } else if (overallContinuousScore < excl) {
      standing = 'GOOD_STANDING';
    } else {
      standing = 'EXCELLENT';
    }

    // Attendance stats
    const attendance = await performanceRepository.getStudentAttendanceRate({
      studentId,
      classId,
      sessionId
    });

    const homeworkDeficit = hwCat.administered > 0 && hwCat.percentage < attn;
    const attendanceDeficit = attendance.attendanceRate < 75.00;

    return {
      studentId: Number(studentId),
      subjectId: Number(subjectId),
      sessionId: Number(sessionId),
      policy: {
        id: policy.id,
        version: policy.version,
        name: policy.policy_name
      },
      hasAdministeredAssessments,
      overallContinuousScore,
      standing,
      alertCategorySuggestion,
      deficits: {
        homeworkDeficit,
        attendanceDeficit
      },
      breakdown: {
        monthlyTests: {
          weight: Number(policy.monthly_test_weight),
          administered: monthlyCat.administered,
          obtained: monthlyCat.obtained,
          totalPossible: monthlyCat.total,
          percentage: monthlyCat.percentage
        },
        quizzes: {
          weight: Number(policy.quiz_weight),
          administered: quizCat.administered,
          obtained: quizCat.obtained,
          totalPossible: quizCat.total,
          percentage: quizCat.percentage
        },
        midTerms: {
          weight: Number(policy.mid_term_weight),
          administered: midTermCat.administered,
          obtained: midTermCat.obtained,
          totalPossible: midTermCat.total,
          percentage: midTermCat.percentage
        },
        homework: {
          weight: Number(policy.homework_weight),
          administered: hwCat.administered,
          obtained: hwCat.obtained,
          totalPossible: hwCat.total,
          percentage: hwCat.percentage
        }
      },
      attendance
    };
  },

  /**
   * Continuous class summary for a subject.
   */
  async getClassPerformanceSummary({ classId, subjectId, sessionId }) {
    const students = await db('enrollments as e')
      .join('students as s', 'e.student_id', 's.id')
      .join('users as u', 's.user_id', 'u.id')
      .where('e.class_id', classId)
      .andWhere('e.session_id', sessionId)
      .andWhere('e.status', 'ACTIVE')
      .select('s.id as student_id', 'u.full_name', 's.admission_no', 'e.roll_no')
      .orderBy('e.roll_no', 'asc');

    const results = [];
    for (const student of students) {
      const summary = await this.calculateStudentSubjectScore({
        studentId: student.student_id,
        subjectId,
        sessionId,
        classId
      });
      results.push({
        ...student,
        performance: summary
      });
    }

    return results;
  },

  // =========================================================================
  // 3. 48-HOUR ROLLING COOLDOWN & PARENT ALERT DISPATCH
  // =========================================================================

  /**
   * Check cooldown status for (studentId, subjectId).
   */
  async getCooldownStatus(studentId, subjectId) {
    const cooldown = await performanceRepository.getCooldown(studentId, subjectId);
    if (!cooldown) {
      return { inCooldown: false, cooldownExpiresAt: null, remainingMs: 0 };
    }

    const now = new Date();
    const expiry = new Date(cooldown.cooldown_expires_at);
    const diff = expiry.getTime() - now.getTime();

    if (diff <= 0) {
      return { inCooldown: false, cooldownExpiresAt: expiry.toISOString(), remainingMs: 0 };
    }

    const remainingHours = Math.floor(diff / (1000 * 60 * 60));
    const remainingMinutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return {
      inCooldown: true,
      cooldownExpiresAt: expiry.toISOString(),
      remainingMs: diff,
      remainingTimeFormatted: `${remainingHours}h ${remainingMinutes}m`,
      lastAlertType: cooldown.last_alert_type,
      lastWasUrgent: Boolean(cooldown.last_was_urgent)
    };
  },

  /**
   * Dispatch an academic parent alert transactionally respecting the 48h cooldown.
   */
  async triggerParentAlert(
    {
      studentId,
      subjectId,
      sessionId,
      alertCategory,
      title,
      messageBody,
      isUrgent = false,
      overrideReason = null
    },
    actor
  ) {
    if (!title || !messageBody) {
      throw new AppError('Alert title and message body are required', 422, ErrorCodes.VALIDATION_ERROR);
    }

    const validCategories = ['CRITICAL_RISK', 'ATTENTION_NEEDED', 'HOMEWORK_DEFICIT', 'ATTENDANCE_DEFICIT'];
    if (!validCategories.includes(alertCategory)) {
      throw new AppError(`Invalid alert category: ${alertCategory}`, 422, ErrorCodes.VALIDATION_ERROR);
    }

    // 1. Evaluate 48-Hour Cooldown
    const cooldownStatus = await this.getCooldownStatus(studentId, subjectId);
    if (cooldownStatus.inCooldown) {
      if (!isUrgent) {
        throw new AppError(
          `Alert cooldown active. An alert was already sent for this student and subject within the last 48 hours. Cooldown expires in ${cooldownStatus.remainingTimeFormatted}. Urgent override required for emergency communication.`,
          429,
          ErrorCodes.RATE_LIMITED
        );
      }

      if (!overrideReason || overrideReason.trim().length < 10) {
        throw new AppError(
          'An urgent alert override requires a detailed justification (at least 10 characters).',
          422,
          ErrorCodes.VALIDATION_ERROR
        );
      }
    }

    // 2. Fetch current metrics and active policy
    const perfData = await this.calculateStudentSubjectScore({ studentId, subjectId, sessionId });
    const policy = await this.getActivePolicy(sessionId);

    let thresholdApplied = 0;
    if (alertCategory === 'CRITICAL_RISK') thresholdApplied = Number(policy.critical_risk_threshold);
    else if (alertCategory === 'ATTENTION_NEEDED') thresholdApplied = Number(policy.attention_threshold);
    else if (alertCategory === 'HOMEWORK_DEFICIT') thresholdApplied = Number(policy.attention_threshold);
    else if (alertCategory === 'ATTENDANCE_DEFICIT') thresholdApplied = 75.00;

    // 3. Resolve Teacher attribution
    let teacherId = null;
    let alertSource = 'SYSTEM';

    if (actor?.role === 'TEACHER') {
      const teacher = await db('teachers').where({ user_id: actor.id }).first();
      if (teacher) {
        teacherId = teacher.id;
        alertSource = 'TEACHER';
      }
    }

    // 4. Resolve verified parents via parent_student
    const parents = await performanceRepository.getVerifiedParentsForStudent(studentId);
    if (!parents || parents.length === 0) {
      throw new AppError(
        'Cannot dispatch alert: No registered or verified parent/guardian linked to this student.',
        422,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // 5. Atomic database transaction
    return db.transaction(async (trx) => {
      // Create Alert record
      const alertData = {
        session_id: sessionId,
        student_id: studentId,
        subject_id: subjectId,
        alert_source: alertSource,
        teacher_id: teacherId,
        triggered_by_user_id: actor?.id || null,
        grading_policy_id: policy.id,
        grading_policy_version: policy.version,
        alert_category: alertCategory,
        calculated_score: perfData.overallContinuousScore,
        threshold_applied: thresholdApplied,
        title,
        message_body: messageBody,
        is_urgent: isUrgent ? 1 : 0,
        override_reason: isUrgent ? overrideReason.trim() : null,
        metric_snapshot: JSON.stringify(perfData)
      };

      // Prepare recipients and outbox payloads
      const recipients = [];
      const outboxItems = [];

      for (const p of parents) {
        recipients.push({
          parentId: p.parent_id,
          relation: p.relation
        });

        outboxItems.push({
          parentId: p.parent_id,
          idempotencyKey: `alert_${studentId}_${subjectId}_${p.parent_id}_${crypto.randomUUID()}`,
          payload: {
            userId: p.user_id,
            parentId: p.parent_id,
            studentId,
            studentName: parents[0]?.student_name,
            title,
            message: messageBody,
            category: alertCategory,
            score: perfData.overallContinuousScore,
            isUrgent,
            timestamp: new Date().toISOString()
          }
        });
      }

      // Insert Alert, Recipients & Outbox
      const dispatchResult = await performanceRepository.createAlertWithRecipientsAndOutbox(
        { alertData, recipients, outboxItems },
        trx
      );

      // Upsert Cooldown (Current time + 48 hours)
      const now = new Date();
      const expiresAt = new Date(now.getTime() + COOLDOWN_HOURS * 60 * 60 * 1000);

      await performanceRepository.upsertCooldown(
        {
          studentId,
          subjectId,
          lastAlertType: alertCategory,
          lastAlertAt: now,
          cooldownExpiresAt: expiresAt,
          lastWasUrgent: isUrgent
        },
        trx
      );

      return {
        success: true,
        alertId: dispatchResult.alertId,
        recipientCount: dispatchResult.recipientCount,
        outboxCount: dispatchResult.outboxCount,
        cooldownExpiresAt: expiresAt.toISOString()
      };
    });
  },

  async listAlerts(filters) {
    return performanceRepository.listAlerts(filters);
  },

  async getAlertDetails(alertId) {
    const alert = await performanceRepository.getAlertById(alertId);
    if (!alert) throw new AppError('Alert not found', 404, ErrorCodes.NOT_FOUND);
    const recipients = await performanceRepository.getAlertRecipients(alertId);
    return {
      ...alert,
      recipients
    };
  },

  /**
   * Complete academic report for a student in a session.
   * Pulls profile, formative continuous scores across all subjects, attendance, alerts, and terminal result.
   */
  async getStudentFullAcademicReport({ studentId, sessionId = null }) {
    let session = null;
    if (sessionId) {
      session = await db('academic_sessions').where({ id: sessionId }).first();
    } else {
      session = (await db('academic_sessions').where({ is_current: 1 }).first()) || (await db('academic_sessions').first());
    }
    if (!session) throw new AppError('Academic session not found', 404, ErrorCodes.NOT_FOUND);

    const student = await db('students as s')
      .join('users as u', 's.user_id', 'u.id')
      .where('s.id', studentId)
      .select('s.*', 'u.full_name as student_name', 'u.email as student_email')
      .first();

    if (!student) throw new AppError('Student profile not found', 404, ErrorCodes.NOT_FOUND);

    const enrollment = await db('enrollments as e')
      .join('classes as c', 'e.class_id', 'c.id')
      .where({ 'e.student_id': studentId, 'e.session_id': session.id })
      .select('e.*', 'c.name as class_name', 'c.grade_level as class_number')
      .first();

    const classId = enrollment?.class_id || student.current_class_id;

    const parents = await performanceRepository.getVerifiedParentsForStudent(studentId);

    const classSubjects = await db('class_subjects as cs')
      .join('subjects as sub', 'cs.subject_id', 'sub.id')
      .where('cs.class_id', classId)
      .select('sub.id', 'sub.name', 'sub.code')
      .orderBy('sub.name');

    const subjectPerformances = [];
    let continuousScoreSum = 0;
    let scoredSubjectCount = 0;

    for (const sub of classSubjects) {
      const perf = await this.calculateStudentSubjectScore({
        studentId,
        subjectId: sub.id,
        sessionId: session.id,
        classId
      });
      subjectPerformances.push({
        subjectId: sub.id,
        subjectName: sub.name,
        subjectCode: sub.code,
        ...perf
      });
      if (perf.hasAdministeredAssessments) {
        continuousScoreSum += perf.overallContinuousScore;
        scoredSubjectCount += 1;
      }
    }

    const overallFormativeAverage =
      scoredSubjectCount > 0 ? Number((continuousScoreSum / scoredSubjectCount).toFixed(2)) : null;

    const attendance = await performanceRepository.getStudentAttendanceRate({
      studentId,
      classId,
      sessionId: session.id
    });

    const alerts = await performanceRepository.listAlerts({
      studentId,
      sessionId: session.id
    });

    const terminalResult = await db('final_results as fr')
      .join('academic_terms as t', 'fr.term_id', 't.id')
      .where({ 'fr.student_id': studentId, 'fr.session_id': session.id, 'fr.result_status': 'PUBLISHED' })
      .select('fr.*', 't.name as term_name', 't.is_final')
      .first();

    let terminalSubjects = [];
    if (terminalResult) {
      terminalSubjects = await db('final_result_subjects as frs')
        .join('subjects as sub', 'frs.subject_id', 'sub.id')
        .where('frs.final_result_id', terminalResult.id)
        .select('frs.*', 'sub.name as subject_name', 'sub.code as subject_code');

      const suppList = await db('supplementary_exam_results')
        .where({ student_id: studentId, session_id: session.id, status: 'PUBLISHED' })
        .orderBy([
          { column: 'is_passed', order: 'desc' },
          { column: 'obtained_marks', order: 'desc' }
        ]);

      const suppMap = new Map();
      for (const sp of suppList) {
        if (!suppMap.has(sp.final_result_subject_id)) {
          suppMap.set(sp.final_result_subject_id, sp);
        }
      }

      terminalSubjects = terminalSubjects.map((ts) => ({
        ...ts,
        supplementary: suppMap.get(ts.id) || null
      }));
    }

    return {
      student: {
        id: student.id,
        name: student.student_name,
        email: student.student_email,
        admissionNo: student.admission_no,
        rollNo: enrollment?.roll_no || student.roll_no,
        className: enrollment?.class_name || `Class ${student.current_class_id}`,
        classNumber: enrollment?.class_number || student.current_class_id,
        enrollmentStatus: enrollment?.status || student.status,
        guardianName: parents[0]?.parent_name || student.father_name || 'N/A',
        guardianEmail: parents[0]?.parent_email || student.father_email || 'N/A'
      },
      session: {
        id: session.id,
        name: session.name,
        isCurrent: Boolean(session.is_current),
        status: session.status
      },
      formativeMonitoring: {
        overallAverage: overallFormativeAverage,
        scoredSubjects: scoredSubjectCount,
        totalSubjects: classSubjects.length,
        subjects: subjectPerformances
      },
      attendance,
      alerts,
      terminalResult: terminalResult
        ? {
            ...terminalResult,
            subjects: terminalSubjects
          }
        : null
    };
  },

  /**
   * Permanently purge a student's previous-session operational records (task submissions,
   * test attempts, daily attendance, continuous alerts) while strictly preserving their
   * Terminal Examination Result Card, subject marks, and supplementary re-sits.
   */
  async archiveStudentAcademicData(studentId, sessionId, actor) {
    if (!isStaff(actor)) {
      throw new AppError('Forbidden: Principal or Admin authorization required', 403, ErrorCodes.FORBIDDEN);
    }

    const session = await db('academic_sessions').where({ id: sessionId }).first();
    if (!session) throw new AppError('Academic session not found', 404, ErrorCodes.NOT_FOUND);
    if (session.is_current) {
      throw new AppError('Cannot purge academic records for the currently active session', 409, ErrorCodes.INVALID_STATE);
    }

    const student = await db('students').where({ id: studentId }).first();
    if (!student) throw new AppError('Student not found', 404, ErrorCodes.NOT_FOUND);

    await db.transaction(async (trx) => {
      // 1. Delete test attempts and answers for tests in that session
      const testIds = await trx('monthly_tests')
        .where({ session_id: sessionId })
        .whereNotIn('id', function () {
          this.select('monthly_test_id').from('supplementary_exam_results').whereNotNull('monthly_test_id');
        })
        .pluck('id');

      if (testIds.length > 0) {
        const attemptIds = await trx('test_attempts')
          .where({ student_id: studentId })
          .whereIn('test_id', testIds)
          .pluck('id');

        if (attemptIds.length > 0) {
          await trx('test_attempt_answers').whereIn('attempt_id', attemptIds).delete();
          await trx('test_attempts').whereIn('id', attemptIds).delete();
        }
      }

      // 2. Delete task submissions for tasks in that session
      const taskIds = await trx('learning_tasks').where({ session_id: sessionId }).pluck('id');
      if (taskIds.length > 0) {
        await trx('task_submissions').where({ student_id: studentId }).whereIn('task_id', taskIds).delete();
      }

      // 3. Delete attendance for lessons in that session
      const slotIds = await trx('timetable_slots').where({ session_id: sessionId }).pluck('id');
      if (slotIds.length > 0) {
        const lessonIds = await trx('timetable_lessons').whereIn('slot_id', slotIds).pluck('id');
        if (lessonIds.length > 0) {
          await trx('attendance_corrections').where({ student_id: studentId }).whereIn('lesson_id', lessonIds).delete();
          await trx('lesson_attendance').where({ student_id: studentId }).whereIn('lesson_id', lessonIds).delete();
        }
      }

      // 4. Delete continuous alerts
      await trx('academic_parent_alerts').where({ student_id: studentId, session_id: sessionId }).delete();

      // Audit log
      await trx('audit_logs').insert({
        actor_id: actor.id,
        actor_name: actor.username || actor.name || 'Principal',
        actor_role: actor.role || 'PRINCIPAL',
        action: 'PURGE_STUDENT_PREVIOUS_SESSION_RECORDS',
        record_type: 'Student',
        record_identifier: `${student.admission_no} (${session.name})`,
        new_value: 'Previous-session operational records permanently deleted; Terminal result card preserved.'
      });
    });

    return {
      success: true,
      message: `Previous-session records for student ${student.admission_no} in session ${session.name} permanently deleted.`
    };
  }
};
