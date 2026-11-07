import { db } from '../../shared/db/knex.js';
import { promotionsRepository } from './promotions.repository.js';
import { resultsRepository } from '../results/results.repository.js';
import { academicRepository } from '../academic/academic.repository.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { getClassAudienceUserIds } from '../../shared/services/accessScope.js';
import { notificationService } from '../../shared/services/notificationService.js';

const DECISIONS = ['PROMOTE', 'RETAIN', 'GRADUATE', 'WITHHOLD', 'WITHDRAW'];

/** The decision that naturally follows an eligibility verdict. */
const DEFAULT_DECISION = {
  ELIGIBLE: 'PROMOTE',
  NOT_ELIGIBLE: 'RETAIN',
  GRADUATING: 'GRADUATE',
  WITHDRAWN: 'WITHDRAW',
  PENDING_RESULT: null,
  SUPPLEMENTARY_REQUIRED: null
};

async function auditEntry(trx, actor, { action, recordType, recordIdentifier, reason, previousValue, newValue }) {
  await trx('audit_logs').insert({
    actor_id: actor?.id || null,
    actor_name: actor?.username || 'System',
    actor_role: actor?.role || 'SYSTEM',
    action,
    record_type: recordType,
    record_identifier: recordIdentifier,
    reason: reason || null,
    previous_value: previousValue != null ? String(previousValue).slice(0, 60000) : null,
    new_value: newValue != null ? String(newValue).slice(0, 60000) : null
  });
}

async function loadSession(sessionId) {
  const session = await academicRepository.getSessionById(Number(sessionId));
  if (!session) throw new AppError('Academic year not found', 404, ErrorCodes.NOT_FOUND);
  return session;
}

export const promotionsService = {
  /**
   * Builds or refreshes the promotion worksheet for a session: one record per
   * student, with eligibility derived from the published final-term result.
   * EXECUTED records are never touched.
   */
  async evaluate({ sessionId }, actor) {
    const session = await loadSession(sessionId);
    if (session.status === 'CLOSED') {
      throw new AppError('A closed academic year cannot be re-evaluated', 409, ErrorCodes.INVALID_STATE);
    }
    const finalTerm = await resultsRepository.getFinalTerm(session.id);
    if (!finalTerm) {
      throw new AppError(
        'Define the academic year\'s terms (including a final term) before evaluating promotions',
        422,
        ErrorCodes.VALIDATION_ERROR
      );
    }
    const maxGrade = await resultsRepository.getMaxGradeLevel();
    const enrollments = await promotionsRepository.getSessionEnrollments(session.id);
    if (enrollments.length === 0) {
      throw new AppError('No enrollments found for this academic year', 422, ErrorCodes.VALIDATION_ERROR);
    }
    const resultsMap = await promotionsRepository.getFinalResultsMap(session.id, finalTerm.id);

    // Fetch failed terminal subjects and published supplementary clearances for this session
    const failedSubjects = await db('final_result_subjects as frs')
      .join('final_results as fr', 'frs.final_result_id', 'fr.id')
      .where('fr.session_id', session.id)
      .andWhere('frs.passed', 0)
      .select('frs.id as subject_result_id', 'frs.final_result_id');

    const failedByFinalResult = new Map();
    for (const fs of failedSubjects) {
      if (!failedByFinalResult.has(fs.final_result_id)) {
        failedByFinalResult.set(fs.final_result_id, []);
      }
      failedByFinalResult.get(fs.final_result_id).push(fs.subject_result_id);
    }

    const supplementaryResults = await db('supplementary_exam_results')
      .where('session_id', session.id)
      .andWhere('status', 'PUBLISHED')
      .orderBy([
        { column: 'is_passed', order: 'desc' },
        { column: 'obtained_marks', order: 'desc' },
        { column: 'attempt_number', order: 'desc' }
      ])
      .select('final_result_subject_id', 'is_passed');

    const authoritativeSuppMap = new Map();
    for (const sr of supplementaryResults) {
      if (!authoritativeSuppMap.has(sr.final_result_subject_id)) {
        authoritativeSuppMap.set(sr.final_result_subject_id, Boolean(sr.is_passed));
      }
    }

    let created = 0;
    let updated = 0;
    let skippedExecuted = 0;

    await db.transaction(async (trx) => {
      for (const enr of enrollments) {
        const existing = await promotionsRepository.getRecordByStudentSession(enr.studentId, session.id, trx);
        if (existing && existing.status === 'EXECUTED') {
          skippedExecuted += 1;
          continue;
        }

        const result = resultsMap.get(Number(enr.enrollmentId)) || null;
        let eligibility = 'PENDING_RESULT';
        if (enr.enrollmentStatus === 'WITHDRAWN' || enr.studentStatus === 'INACTIVE') {
          eligibility = 'WITHDRAWN';
        } else if (result && ['APPROVED', 'PUBLISHED'].includes(result.result_status)) {
          if (result.pass_status === 'PASSED') {
            eligibility = Number(enr.classNumber) >= maxGrade ? 'GRADUATING' : 'ELIGIBLE';
          } else if (result.pass_status === 'FAILED') {
            eligibility = 'NOT_ELIGIBLE';
          } else if (result.pass_status === 'SUPPLEMENTARY') {
            // Check if all failed subjects have been cleared via published supplementary exam passes
            const failedSubjectIds = failedByFinalResult.get(result.id) || [];
            const hasUnclearedSubjects =
              failedSubjectIds.length === 0 ||
              failedSubjectIds.some((id) => !authoritativeSuppMap.get(id));

            if (!hasUnclearedSubjects) {
              // Authoritative supplementary clearance achieved
              eligibility = Number(enr.classNumber) >= maxGrade ? 'GRADUATING' : 'ELIGIBLE';
            } else {
              eligibility = 'SUPPLEMENTARY_REQUIRED';
            }
          }
        }

        const fields = {
          session_id: session.id,
          student_id: enr.studentId,
          enrollment_id: enr.enrollmentId,
          from_class_id: enr.classId,
          final_result_id: result ? result.id : null,
          eligibility
        };

        if (existing) {
          // A decision already taken by a person is preserved; only the
          // eligibility inputs refresh.
          await trx('promotion_records').where({ id: existing.id }).update(fields);
          updated += 1;
        } else {
          await trx('promotion_records').insert({ ...fields, decision: 'PENDING', status: 'DRAFT' });
          created += 1;
        }
      }

      await auditEntry(trx, actor, {
        action: 'EVALUATE_PROMOTION_ELIGIBILITY',
        recordType: 'Promotion',
        recordIdentifier: session.name,
        newValue: `${created} created, ${updated} refreshed, ${skippedExecuted} already executed`
      });
    });

    return { created, updated, skippedExecuted, finalTerm: finalTerm.name };
  },

  async list(query) {
    const session = await loadSession(query.sessionId);
    const rows = await promotionsRepository.listRecords({
      sessionId: session.id,
      classId: query.classId ? Number(query.classId) : null
    });
    return rows;
  },

  async overview({ sessionId }) {
    const session = await loadSession(sessionId);
    const counts = await promotionsRepository.getOverviewCounts(session.id);
    const finalTerm = await resultsRepository.getFinalTerm(session.id);
    return {
      session: { id: session.id, name: session.name, status: session.status },
      finalTerm: finalTerm ? { id: finalTerm.id, name: finalTerm.name } : null,
      byEligibility: counts.byEligibility.map((r) => ({ eligibility: r.eligibility, count: Number(r.count) })),
      byDecision: counts.byDecision.map((r) => ({ decision: r.decision, status: r.status, count: Number(r.count) }))
    };
  },

  /** Decide one record; overriding the recommendation requires a reason. */
  async decide(recordId, { decision, reason }, actor) {
    if (!DECISIONS.includes(decision)) {
      throw new AppError(`Decision must be one of: ${DECISIONS.join(', ')}`, 422, ErrorCodes.VALIDATION_ERROR);
    }
    const record = await promotionsRepository.getRecord(Number(recordId));
    if (!record) throw new AppError('Promotion record not found', 404, ErrorCodes.NOT_FOUND);
    if (record.status === 'EXECUTED') {
      throw new AppError('This promotion has already been executed', 409, ErrorCodes.INVALID_STATE);
    }
    const recommended = DEFAULT_DECISION[record.eligibility];
    const isOverride = recommended !== decision && decision !== 'WITHHOLD';
    if (isOverride && (!reason || !String(reason).trim())) {
      throw new AppError(
        'Overriding the recommendation requires a reason',
        422,
        ErrorCodes.VALIDATION_ERROR
      );
    }
    await db.transaction(async (trx) => {
      await trx('promotion_records')
        .where({ id: record.id })
        .update({
          decision,
          is_override: isOverride ? 1 : 0,
          override_reason: isOverride ? String(reason).trim().slice(0, 500) : null,
          status: decision === 'WITHHOLD' ? 'DRAFT' : 'DECIDED',
          decided_by: actor.id,
          decided_at: db.fn.now(3)
        });
      await auditEntry(trx, actor, {
        action: isOverride ? 'OVERRIDE_PROMOTION_DECISION' : 'DECIDE_PROMOTION',
        recordType: 'Promotion',
        recordIdentifier: `Student #${record.student_id} · Session #${record.session_id}`,
        reason: reason || null,
        previousValue: `${record.eligibility} → ${record.decision}`,
        newValue: decision
      });
    });
    return await promotionsRepository.getRecord(record.id);
  },

  /**
   * Bulk approval: every DRAFT record whose eligibility has a natural
   * decision gets it. Pending/supplementary cases stay untouched.
   */
  async bulkApprove({ sessionId, classId }, actor) {
    const session = await loadSession(sessionId);
    const rows = await promotionsRepository.listRecords({
      sessionId: session.id,
      classId: classId ? Number(classId) : null,
      statuses: ['DRAFT']
    });
    let decided = 0;
    await db.transaction(async (trx) => {
      for (const record of rows) {
        const decision = DEFAULT_DECISION[record.eligibility];
        if (!decision) continue;
        await trx('promotion_records')
          .where({ id: record.id })
          .update({ decision, status: 'DECIDED', decided_by: actor.id, decided_at: db.fn.now(3) });
        decided += 1;
      }
      await auditEntry(trx, actor, {
        action: 'BULK_APPROVE_PROMOTIONS',
        recordType: 'Promotion',
        recordIdentifier: classId ? `${session.name} · Class ${classId}` : session.name,
        newValue: `${decided} records decided`
      });
    });
    return { decided, skipped: rows.length - decided };
  },

  /** Placement preview: what execute would do, without doing it. */
  async preview({ sessionId, toSessionId }) {
    const session = await loadSession(sessionId);
    const target = await loadSession(toSessionId);
    const maxGrade = await resultsRepository.getMaxGradeLevel();
    const rows = await promotionsRepository.listRecords({ sessionId: session.id, statuses: ['DECIDED', 'EXECUTED'] });
    const placements = [];
    for (const record of rows) {
      let toClassNumber = null;
      let outcome = record.decision;
      if (record.decision === 'PROMOTE') {
        toClassNumber = Number(record.fromClassNumber) >= maxGrade ? null : Number(record.fromClassNumber) + 1;
        if (toClassNumber === null) outcome = 'GRADUATE';
      } else if (record.decision === 'RETAIN') {
        toClassNumber = Number(record.fromClassNumber);
      }
      placements.push({
        recordId: record.id,
        studentId: record.student_id,
        studentName: record.studentName,
        admissionNo: record.admissionNo,
        fromClassNumber: record.fromClassNumber,
        toClassNumber,
        outcome,
        executed: record.status === 'EXECUTED'
      });
    }
    return { session: session.name, toSession: target.name, placements };
  },

  /**
   * Executes all DECIDED records into the target academic year inside one
   * transaction. Idempotent: executed records are skipped, and the unique
   * (student, session) enrollment constraint prevents duplicates.
   */
  async execute({ sessionId, toSessionId }, actor) {
    const session = await loadSession(sessionId);
    const target = await loadSession(toSessionId);
    if (target.id === session.id) {
      throw new AppError('The target academic year must differ from the year being closed', 422, ErrorCodes.VALIDATION_ERROR);
    }
    if (target.status === 'CLOSED') {
      throw new AppError('Students cannot be moved into a closed academic year', 409, ErrorCodes.INVALID_STATE);
    }
    const maxGrade = await resultsRepository.getMaxGradeLevel();
    const rows = await promotionsRepository.listRecords({ sessionId: session.id, statuses: ['DECIDED'] });
    if (rows.length === 0) {
      throw new AppError('No approved promotion decisions are awaiting execution', 422, ErrorCodes.VALIDATION_ERROR);
    }

    const summary = { promoted: 0, retained: 0, graduated: 0, withdrawn: 0, skipped: 0 };
    const executedStudentIds = [];

    await db.transaction(async (trx) => {
      for (const record of rows) {
        const current = await trx('promotion_records').where({ id: record.id }).forUpdate().first();
        if (!current || current.status === 'EXECUTED') {
          summary.skipped += 1;
          continue;
        }

        const endOld = (status) =>
          trx('enrollments').where({ id: record.enrollment_id }).update({ status, ended_on: trx.fn.now() });

        let newEnrollmentId = null;
        let toClassId = null;

        if (record.decision === 'PROMOTE' || record.decision === 'RETAIN') {
          let toClassNumber = Number(record.fromClassNumber);
          if (record.decision === 'PROMOTE') {
            if (toClassNumber >= maxGrade) {
              // Final grade: a PROMOTE decision becomes graduation.
              await endOld('GRADUATED');
              await trx('students').where({ id: record.student_id }).update({ status: 'GRADUATED' });
              summary.graduated += 1;
              await trx('promotion_records').where({ id: record.id }).update({
                decision: 'GRADUATE',
                to_session_id: null,
                status: 'EXECUTED',
                executed_at: trx.fn.now(3),
                executed_by: actor.id
              });
              executedStudentIds.push(record.student_id);
              continue;
            }
            toClassNumber += 1;
          }
          const toClass = await resultsRepository.getClassByGrade(toClassNumber);
          if (!toClass) {
            throw new AppError(`No class is configured for grade ${toClassNumber}`, 422, ErrorCodes.VALIDATION_ERROR);
          }
          toClassId = toClass.id;

          const existingTarget = await trx('enrollments')
            .where({ student_id: record.student_id, session_id: target.id })
            .first();
          if (existingTarget) {
            newEnrollmentId = existingTarget.id; // already placed: idempotent
          } else {
            const [id] = await trx('enrollments').insert({
              student_id: record.student_id,
              class_id: toClassId,
              session_id: target.id,
              roll_no: null,
              status: 'ACTIVE',
              enrolled_on: trx.fn.now()
            });
            newEnrollmentId = id;
          }
          await endOld(record.decision === 'PROMOTE' ? 'PROMOTED' : 'RETAINED');
          await trx('students').where({ id: record.student_id }).update({ current_class_id: toClassId });
          summary[record.decision === 'PROMOTE' ? 'promoted' : 'retained'] += 1;
        } else if (record.decision === 'GRADUATE') {
          await endOld('GRADUATED');
          await trx('students').where({ id: record.student_id }).update({ status: 'GRADUATED' });
          summary.graduated += 1;
        } else if (record.decision === 'WITHDRAW') {
          await endOld('WITHDRAWN');
          await trx('students').where({ id: record.student_id }).update({ status: 'INACTIVE' });
          summary.withdrawn += 1;
        } else {
          summary.skipped += 1;
          continue;
        }

        await trx('promotion_records').where({ id: record.id }).update({
          to_session_id: ['PROMOTE', 'RETAIN'].includes(record.decision) ? target.id : null,
          to_class_id: toClassId,
          new_enrollment_id: newEnrollmentId,
          status: 'EXECUTED',
          executed_at: trx.fn.now(3),
          executed_by: actor.id
        });
        executedStudentIds.push(record.student_id);
      }

      await auditEntry(trx, actor, {
        action: 'EXECUTE_PROMOTIONS',
        recordType: 'Promotion',
        recordIdentifier: `${session.name} → ${target.name}`,
        newValue: JSON.stringify(summary)
      });
    });

    if (executedStudentIds.length > 0) {
      const recipients = await getClassAudienceUserIds([], {
        includeStudents: true,
        includeParents: true,
        studentIds: executedStudentIds
      });
      notificationService.notifyUsers(recipients, {
        title: 'Academic Year Promotion Decision',
        message: `Promotion decisions for ${session.name} have been finalised. Open Results & Progress to see your placement for ${target.name}.`,
        type: 'Promotion Decision',
        targetRole: 'ALL',
        relatedRecordId: String(session.id),
        relatedRecordType: 'Promotion',
        priority: 'High'
      });
    }

    return summary;
  },

  async history(studentId) {
    return await promotionsRepository.getStudentHistory(Number(studentId));
  }
};
