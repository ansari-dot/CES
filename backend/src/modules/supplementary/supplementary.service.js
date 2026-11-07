import { db } from '../../shared/db/knex.js';
import { supplementaryRepository } from './supplementary.repository.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { notificationService } from '../../shared/services/notificationService.js';

function letterGrade(pct) {
  if (pct === null || pct === undefined) return null;
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  if (pct >= 40) return 'E';
  return 'F';
}

export const supplementaryService = {
  /**
   * List all failed terminal subjects eligible for supplementary exams.
   */
  async getFailedTerminalSubjects(filters) {
    return supplementaryRepository.findFailedTerminalSubjects(filters);
  },

  async listSupplementary(filters) {
    const list = await supplementaryRepository.list(filters);
    const total = await supplementaryRepository.count(filters);
    return { data: list, total };
  },

  async getSupplementaryById(id) {
    const record = await supplementaryRepository.findById(id);
    if (!record) throw new AppError('Supplementary exam record not found', 404, ErrorCodes.NOT_FOUND);
    return record;
  },

  /**
   * Initialize a supplementary exam record for an explicitly failed Terminal Exam subject.
   */
  async initializeSupplementary({ finalResultSubjectId }, actor) {
    // 1. Fetch the failed terminal result subject
    const subjectResult = await db('final_result_subjects as frs')
      .join('final_results as fr', 'frs.final_result_id', 'fr.id')
      .where('frs.id', finalResultSubjectId)
      .select(
        'frs.*',
        'fr.student_id',
        'fr.session_id',
        'fr.class_id',
        'fr.result_status'
      )
      .first();

    if (!subjectResult) {
      throw new AppError('Terminal Exam subject result not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (subjectResult.passed !== 0) {
      throw new AppError(
        'A supplementary exam can only be created for an explicitly failed subject (passed = 0).',
        422,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    if (!['APPROVED', 'PUBLISHED'].includes(subjectResult.result_status)) {
      throw new AppError(
        'Supplementary exams can only be scheduled for approved or published Terminal Results.',
        422,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // 2. Check for existing active attempt
    const existingActive = await supplementaryRepository.findActiveAttemptForSubject(finalResultSubjectId);
    if (existingActive) {
      return existingActive;
    }

    // 3. Resolve applicable promotion policy for snapshotting
    let promotionPolicy = await db('promotion_policies')
      .where({ session_id: subjectResult.session_id })
      .first();

    if (!promotionPolicy) {
      promotionPolicy = await db('promotion_policies').first();
    }

    const policySnapshot = promotionPolicy
      ? {
          id: promotionPolicy.id,
          notes: promotionPolicy.notes,
          min_subject_percentage: Number(promotionPolicy.min_subject_percentage || 40),
          min_overall_percentage: Number(promotionPolicy.min_overall_percentage || 40),
          max_failed_subjects: Number(promotionPolicy.max_failed_subjects || 0),
          supplementary_allowed: Boolean(promotionPolicy.supplementary_allowed)
        }
      : {
          min_subject_percentage: 40.00,
          min_overall_percentage: 40.00,
          max_failed_subjects: 0,
          supplementary_allowed: true
        };

    // 4. Determine attempt number
    const [latestAttempt] = await db('supplementary_exam_results')
      .where({ final_result_subject_id: finalResultSubjectId })
      .orderBy('attempt_number', 'desc')
      .limit(1);

    const attemptNumber = latestAttempt ? Number(latestAttempt.attempt_number) + 1 : 1;

    // 5. Create supplementary record in AWAITING_SCHEDULE
    const createData = {
      final_result_subject_id: subjectResult.id,
      final_result_id: subjectResult.final_result_id,
      subject_id: subjectResult.subject_id,
      student_id: subjectResult.student_id,
      session_id: subjectResult.session_id,
      class_id: subjectResult.class_id,
      original_obtained_marks: subjectResult.is_absent ? null : subjectResult.obtained_marks,
      original_max_marks: subjectResult.total_marks,
      original_grade: subjectResult.grade,
      original_is_absent: Boolean(subjectResult.is_absent),
      original_subject_passed: 0,
      promotion_policy_id: promotionPolicy?.id || null,
      promotion_policy_snapshot: JSON.stringify(policySnapshot),
      attempt_number: attemptNumber,
      correction_version: 0,
      max_marks: subjectResult.total_marks,
      status: 'AWAITING_SCHEDULE',
      is_passed: 0,
      is_absent: 0
    };

    return supplementaryRepository.create(createData);
  },

  /**
   * Schedule a supplementary exam via Mode A (date_sheet_entries) or Mode B (monthly_tests).
   */
  async scheduleExam({ id, mode, dateSheetEntryId, monthlyTestId, examDate }, actor) {
    const record = await this.getSupplementaryById(id);
    if (!['AWAITING_SCHEDULE', 'SCHEDULED'].includes(record.status)) {
      throw new AppError(
        `Cannot schedule supplementary exam in status '${record.status}'.`,
        409,
        ErrorCodes.INVALID_STATE
      );
    }

    let finalDateSheetId = null;
    let finalMonthlyTestId = null;
    let finalExamDate = examDate ? new Date(examDate).toISOString().split('T')[0] : null;

    if (mode === 'MODE_A' || dateSheetEntryId) {
      if (!dateSheetEntryId) throw new AppError('Mode A requires dateSheetEntryId', 422, ErrorCodes.VALIDATION_ERROR);
      finalDateSheetId = Number(dateSheetEntryId);
      finalMonthlyTestId = null;

      const dateSheet = await db('date_sheet_entries').where({ id: finalDateSheetId }).first();
      if (!dateSheet) throw new AppError('Date sheet entry not found', 404, ErrorCodes.NOT_FOUND);
      if (!finalExamDate && dateSheet.exam_date) {
        finalExamDate = new Date(dateSheet.exam_date).toISOString().split('T')[0];
      }
    } else if (mode === 'MODE_B' || monthlyTestId) {
      if (!monthlyTestId) throw new AppError('Mode B requires monthlyTestId', 422, ErrorCodes.VALIDATION_ERROR);
      finalMonthlyTestId = Number(monthlyTestId);
      finalDateSheetId = null;

      const test = await db('monthly_tests').where({ id: finalMonthlyTestId }).first();
      if (!test) throw new AppError('Assessment/Monthly test not found', 404, ErrorCodes.NOT_FOUND);
      if (!finalExamDate && test.available_from) {
        finalExamDate = new Date(test.available_from).toISOString().split('T')[0];
      }
    } else {
      throw new AppError(
        'Must specify either Mode A (dateSheetEntryId) or Mode B (monthlyTestId)',
        422,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    if (!finalExamDate) {
      throw new AppError('Exam date is required to schedule supplementary examination', 422, ErrorCodes.VALIDATION_ERROR);
    }

    return supplementaryRepository.update(id, {
      status: 'SCHEDULED',
      date_sheet_entry_id: finalDateSheetId,
      monthly_test_id: finalMonthlyTestId,
      exam_date: finalExamDate
    });
  },

  /**
   * Record marks or absence for a scheduled supplementary exam.
   */
  async recordMarks({ id, obtainedMarks, isAbsent = false, remarks = null }, actor) {
    const record = await this.getSupplementaryById(id);
    if (!['SCHEDULED', 'DRAFT'].includes(record.status)) {
      throw new AppError(
        `Cannot record marks for supplementary exam in status '${record.status}'.`,
        409,
        ErrorCodes.INVALID_STATE
      );
    }

    const maxMarks = Number(record.max_marks);
    const policySnapshot = typeof record.promotion_policy_snapshot === 'string'
      ? JSON.parse(record.promotion_policy_snapshot)
      : record.promotion_policy_snapshot;

    const passingPercentage = Number(policySnapshot?.min_subject_percentage || 40.00);

    let finalMarks = null;
    let finalPassed = false;
    let finalGrade = 'F';

    if (isAbsent) {
      finalMarks = null;
      finalPassed = false;
      finalGrade = 'ABS';
    } else {
      if (obtainedMarks === null || obtainedMarks === undefined || isNaN(Number(obtainedMarks))) {
        throw new AppError('Valid obtained marks are required when student is present', 422, ErrorCodes.VALIDATION_ERROR);
      }
      finalMarks = Number(obtainedMarks);
      if (finalMarks < 0 || finalMarks > maxMarks) {
        throw new AppError(
          `Obtained marks must be between 0 and maximum marks (${maxMarks})`,
          422,
          ErrorCodes.VALIDATION_ERROR
        );
      }

      const pct = maxMarks > 0 ? (finalMarks / maxMarks) * 100 : 0;
      finalPassed = pct >= passingPercentage;
      finalGrade = letterGrade(pct);
    }

    return supplementaryRepository.update(id, {
      status: 'DRAFT',
      obtained_marks: finalMarks,
      is_absent: isAbsent ? 1 : 0,
      is_passed: finalPassed ? 1 : 0,
      grade: finalGrade,
      remarks,
      conducted_by: actor?.id || null
    });
  },

  /**
   * Submit marks for approval.
   */
  async submitMarks(id, actor) {
    const record = await this.getSupplementaryById(id);
    if (record.status !== 'DRAFT') {
      throw new AppError(
        `Only DRAFT records can be submitted for approval (current: ${record.status})`,
        409,
        ErrorCodes.INVALID_STATE
      );
    }

    if (!record.is_absent && record.obtained_marks === null) {
      throw new AppError('Cannot submit result without recorded marks or recorded absence', 422, ErrorCodes.VALIDATION_ERROR);
    }

    return supplementaryRepository.update(id, {
      status: 'SUBMITTED'
    });
  },

  /**
   * Approve supplementary exam result (Principal / Admin authority).
   */
  async approveResult(id, actor) {
    const record = await this.getSupplementaryById(id);
    if (record.status !== 'SUBMITTED') {
      throw new AppError(
        `Only SUBMITTED records can be approved (current: ${record.status})`,
        409,
        ErrorCodes.INVALID_STATE
      );
    }

    return supplementaryRepository.update(id, {
      status: 'APPROVED',
      approved_by: actor.id,
      approved_at: new Date()
    });
  },

  /**
   * Publish supplementary exam result (Principal / Admin authority).
   * Authoritatively updates student's academic record without modifying original Terminal Card.
   */
  async publishResult(id, actor) {
    const record = await this.getSupplementaryById(id);
    if (record.status !== 'APPROVED') {
      throw new AppError(
        `Only APPROVED records can be published (current: ${record.status})`,
        409,
        ErrorCodes.INVALID_STATE
      );
    }

    const updated = await supplementaryRepository.update(id, {
      status: 'PUBLISHED',
      published_by: actor.id,
      published_at: new Date()
    });

    // Notify student and parent
    try {
      const student = await db('students').where({ id: record.student_id }).first();
      if (student?.user_id) {
        await notificationService.notifyUsers([student.user_id], {
          title: 'Supplementary Examination Result Published',
          message: `Your supplementary exam result for ${record.subject_name || 'Subject'} has been officially published: ${record.is_passed ? 'PASSED' : 'FAILED'} (Grade: ${record.grade || 'N/A'}).`,
          type: 'Academic Result',
          priority: 'High',
          relatedRecordId: id,
          relatedRecordType: 'SupplementaryResult'
        });
      }
    } catch (err) {
      console.warn('[SupplementaryService] Notification warning:', err.message);
    }

    return updated;
  },

  /**
   * Cancel supplementary exam prior to publication.
   */
  async cancelExam(id, { reason }, actor) {
    const record = await this.getSupplementaryById(id);
    if (['PUBLISHED', 'SUPERSEDED'].includes(record.status)) {
      throw new AppError(
        'Published or superseded supplementary results cannot be cancelled. Use auditable correction.',
        409,
        ErrorCodes.INVALID_STATE
      );
    }

    if (!reason || reason.trim().length < 5) {
      throw new AppError('Cancellation reason must be provided (at least 5 characters)', 422, ErrorCodes.VALIDATION_ERROR);
    }

    return supplementaryRepository.update(id, {
      status: 'CANCELLED',
      cancellation_reason: reason.trim(),
      cancelled_by: actor.id,
      cancelled_at: new Date()
    });
  },

  /**
   * Issue an auditable correction for an already published supplementary result.
   * Preserves database triggers: copies protected snapshot fields, increments correction_version.
   */
  async issueCorrection(id, { correctionReason, obtainedMarks, isAbsent = false, remarks = null }, actor) {
    const oldRecord = await this.getSupplementaryById(id);
    if (oldRecord.status !== 'PUBLISHED') {
      throw new AppError(
        'Auditable corrections can only be issued against PUBLISHED supplementary results.',
        409,
        ErrorCodes.INVALID_STATE
      );
    }

    if (!correctionReason || correctionReason.trim().length < 10) {
      throw new AppError(
        'Auditable correction requires a detailed justification (at least 10 characters).',
        422,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const maxMarks = Number(oldRecord.max_marks);
    const policySnapshot = typeof oldRecord.promotion_policy_snapshot === 'string'
      ? JSON.parse(oldRecord.promotion_policy_snapshot)
      : oldRecord.promotion_policy_snapshot;

    const passingPercentage = Number(policySnapshot?.min_subject_percentage || 40.00);

    let finalMarks = null;
    let finalPassed = false;
    let finalGrade = 'F';

    if (isAbsent) {
      finalMarks = null;
      finalPassed = false;
      finalGrade = 'ABS';
    } else {
      if (obtainedMarks === null || obtainedMarks === undefined || isNaN(Number(obtainedMarks))) {
        throw new AppError('Valid obtained marks are required when student is present', 422, ErrorCodes.VALIDATION_ERROR);
      }
      finalMarks = Number(obtainedMarks);
      if (finalMarks < 0 || finalMarks > maxMarks) {
        throw new AppError(
          `Obtained marks must be between 0 and maximum marks (${maxMarks})`,
          422,
          ErrorCodes.VALIDATION_ERROR
        );
      }

      const pct = maxMarks > 0 ? (finalMarks / maxMarks) * 100 : 0;
      finalPassed = pct >= passingPercentage;
      finalGrade = letterGrade(pct);
    }

    // New version data preserving all protected relationships and snapshots
    const newRecordData = {
      final_result_subject_id: oldRecord.final_result_subject_id,
      final_result_id: oldRecord.final_result_id,
      subject_id: oldRecord.subject_id,
      student_id: oldRecord.student_id,
      session_id: oldRecord.session_id,
      class_id: oldRecord.class_id,
      date_sheet_entry_id: oldRecord.date_sheet_entry_id,
      monthly_test_id: oldRecord.monthly_test_id,
      original_obtained_marks: oldRecord.original_obtained_marks,
      original_max_marks: oldRecord.original_max_marks,
      original_grade: oldRecord.original_grade,
      original_is_absent: oldRecord.original_is_absent ? 1 : 0,
      original_subject_passed: 0,
      promotion_policy_id: oldRecord.promotion_policy_id,
      promotion_policy_snapshot: typeof oldRecord.promotion_policy_snapshot === 'string'
        ? oldRecord.promotion_policy_snapshot
        : JSON.stringify(oldRecord.promotion_policy_snapshot),
      attempt_number: oldRecord.attempt_number,
      correction_version: Number(oldRecord.correction_version) + 1,
      supersedes_id: oldRecord.id,
      correction_reason: correctionReason.trim(),
      exam_date: oldRecord.exam_date,
      obtained_marks: finalMarks,
      max_marks: oldRecord.max_marks,
      grade: finalGrade,
      is_passed: finalPassed ? 1 : 0,
      is_absent: isAbsent ? 1 : 0,
      status: 'PUBLISHED',
      conducted_by: oldRecord.conducted_by,
      approved_by: actor.id,
      approved_at: new Date(),
      published_by: actor.id,
      published_at: new Date(),
      remarks: remarks || oldRecord.remarks
    };

    return db.transaction(async (trx) => {
      return supplementaryRepository.supersedeAndCreateCorrection(oldRecord.id, newRecordData, trx);
    });
  }
};
