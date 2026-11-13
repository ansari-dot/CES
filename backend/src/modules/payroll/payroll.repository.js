import { db } from '../../shared/db/knex.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { parsePayrollMonthRange, currentPayrollMonthLabel } from '../../shared/utils/dutyCalculation.js';
import { getTeacherDutyForPeriod } from '../../shared/utils/teacherDutyQuery.js';
import { computeTeacherAttendance, getProfileForPeriod } from '../../shared/utils/teacherAttendance.js';

const PAYROLL_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Both spellings of a payroll month ("November 2026" and "2026-11") for duplicate checks. */
function payrollMonthAliases(payrollMonth, range) {
  const aliases = new Set([String(payrollMonth).trim()]);
  if (range) {
    aliases.add(`${range.year}-${String(range.month).padStart(2, '0')}`);
    aliases.add(`${PAYROLL_MONTH_NAMES[range.month - 1]} ${range.year}`);
  }
  return Array.from(aliases);
}

function mapSalaryModelToFrontend(model) {
  switch (model) {
    case 'FIXED':
      return 'Fixed monthly';
    case 'PER_LESSON':
      return 'Per completed lesson';
    case 'PER_HOUR':
      return 'Per hour';
    case 'HYBRID':
      return 'Hybrid';
    default:
      return model;
  }
}

function mapSalaryModelToBackend(model) {
  if (!model) return 'FIXED';
  const upper = model.toUpperCase();
  if (upper.includes('LESSON')) return 'PER_LESSON';
  if (upper.includes('HOUR')) return 'PER_HOUR';
  if (upper.includes('HYBRID')) return 'HYBRID';
  return 'FIXED';
}

function mapStatusToFrontend(status) {
  switch (status) {
    case 'DRAFT':
      return 'Draft';
    case 'SUBMITTED_FOR_APPROVAL':
      return 'Submitted for Approval';
    case 'APPROVED':
      return 'Approved';
    case 'RETURNED_FOR_CORRECTION':
      return 'Returned for Correction';
    case 'REJECTED':
      return 'Rejected';
    case 'PAID':
      return 'Paid';
    default:
      return status;
  }
}

function mapStatusToBackend(status) {
  if (!status) return 'SUBMITTED_FOR_APPROVAL';
  const upper = status.toUpperCase().replace(/\s+/g, '_');
  if (['DRAFT', 'SUBMITTED_FOR_APPROVAL', 'APPROVED', 'RETURNED_FOR_CORRECTION', 'REJECTED', 'PAID'].includes(upper)) {
    return upper;
  }
  return 'SUBMITTED_FOR_APPROVAL';
}

/**
 * Atomically records an audit entry within an ongoing database transaction.
 */
async function logPayrollAudit(trx, {
  actorId = null,
  action,
  recordIdentifier,
  reason = null,
  previousValue = null,
  newValue = null
}) {
  let actorName = 'System';
  let actorRole = 'System';

  if (actorId) {
    const actor = await trx('users')
      .leftJoin('roles', 'users.role_id', 'roles.id')
      .where('users.id', actorId)
      .select('users.full_name', 'roles.name as role_name')
      .first();

    if (actor) {
      actorName = actor.full_name || `User #${actorId}`;
      actorRole = actor.role_name || 'Staff';
    }
  }

  await trx('audit_logs').insert({
    actor_id: actorId ? Number(actorId) : null,
    actor_name: actorName,
    actor_role: actorRole,
    action,
    record_type: 'Teacher Payroll',
    record_identifier: recordIdentifier,
    reason: reason || null,
    previous_value: previousValue ? String(previousValue) : null,
    new_value: newValue ? String(newValue) : null,
    created_at: trx.fn.now(3)
  });
}

export const payrollRepository = {
  // 1. Generate Monthly Payroll Drafts (ACID Atomic Batch)
  async generateMonthlyDrafts({ payrollMonth, userId, teacherId = null }) {
    return await db.transaction(async (trx) => {
      let teachersQuery = trx('teachers')
        .join('users', 'teachers.user_id', 'users.id')
        .where('users.status', 'ACTIVE');

      if (teacherId) {
        teachersQuery = teachersQuery.where('teachers.id', teacherId);
      }

      const teachers = await teachersQuery.select(
        'teachers.id as teacherId',
        'teachers.employee_no as staffIdentifier',
        'users.full_name as teacherName'
      );

      let generatedCount = 0;
      let skippedCount = 0;
      const skippedNoSalaryProfile = [];
      const teachersWithPendingReview = [];

      const monthRange = parsePayrollMonthRange(payrollMonth);
      if (!monthRange) {
        throw new AppError(
          `Unrecognised payroll month "${payrollMonth}". Use a format such as "April 2026" or "2026-04".`,
          400,
          ErrorCodes.BAD_REQUEST
        );
      }

      const hasAttendanceTable = await trx.schema.hasTable('teacher_checkin_checkout');
      const hasAttendanceColumns = await trx.schema.hasColumn('teacher_payroll_drafts', 'attendance_deduction');

      for (const t of teachers) {
        // 1. Atomically check if draft already exists (approved / paid drafts are never regenerated)
        const existing = await trx('teacher_payroll_drafts')
          .where({ teacher_id: t.teacherId })
          .whereIn('payroll_month', payrollMonthAliases(payrollMonth, monthRange))
          .first();

        if (existing) {
          skippedCount++;
          continue;
        }

        // 2. Salary profile: rates come ONLY from the approved profile. No profile -> no draft.
        // The profile in force during this payroll month (never a future-dated one)
        const profile = await getProfileForPeriod(trx, t.teacherId, monthRange.startDate, monthRange.endDate);

        if (!profile) {
          skippedNoSalaryProfile.push({ teacherId: t.teacherId, teacherName: t.teacherName });
          continue;
        }

        const model = profile.model;
        const baseMonthlySalary = Number(profile.base_amount || 0);
        const perLessonRate = Number(profile.per_lesson_rate || 0);
        const perHourRate = Number(profile.per_hour_rate || 0);

        let allowances = 0;
        let standardDeductions = 0;
        if (profile.rules) {
          try {
            const parsed = typeof profile.rules === 'string' ? JSON.parse(profile.rules) : profile.rules;
            if (parsed.allowances !== undefined) allowances = Number(parsed.allowances) || 0;
            if (parsed.standardDeductions !== undefined) standardDeductions = Number(parsed.standardDeductions) || 0;
          } catch {
            // ignore json parse error
          }
        }

        // 3. Duty metrics: SAME shared calculation the teacher dashboard uses, limited to the selected month
        const dutyResult = await getTeacherDutyForPeriod(trx, {
          teacherId: t.teacherId,
          startDate: monthRange.startDate,
          endDate: monthRange.endDate
        });
        const periodDuty = dutyResult.duty;
        if (periodDuty.pendingReviewLessons > 0) {
          teachersWithPendingReview.push({
            teacherId: t.teacherId,
            teacherName: t.teacherName,
            pendingReviewLessons: periodDuty.pendingReviewLessons
          });
        }

        const scheduledLessons = periodDuty.totalScheduledLessons;
        const completedLessons = periodDuty.completedLessons;
        const cancelledLessons = periodDuty.cancelledLessons;
        const missedLessons = periodDuty.missedLessons;
        // Verified daily attendance (check-in/out) for fixed-salary policy and reporting
        const attendance = hasAttendanceTable
          ? await computeTeacherAttendance(trx, {
              teacherId: t.teacherId,
              startDate: monthRange.startDate,
              endDate: monthRange.endDate,
              profile
            })
          : null;
        const approvedLeaveDays = attendance ? attendance.leaveDays : 0;
        const verifiedHours = periodDuty.verifiedTeachingHours;

        // 4. Calculate Earnings per Salary Model
        let basePay = 0;
        let ratePerUnit = 0;
        let lessonOrHourlyEarning = 0;
        let calculationFormula = '';

        let attendanceDeduction = 0;
        if (model === 'FIXED') {
          basePay = baseMonthlySalary;
          ratePerUnit = 0;
          lessonOrHourlyEarning = 0;
          // Fixed salary is the configured monthly amount; attendance deductions only per configured policy
          attendanceDeduction = attendance ? attendance.deduction : 0;
          calculationFormula = `Fixed: Base (Rs. ${basePay.toLocaleString()}) + Allowances (Rs. ${allowances.toLocaleString()}) - Deductions (Rs. ${standardDeductions.toLocaleString()})`;
          if (attendanceDeduction > 0) {
            calculationFormula += ` - Attendance (Rs. ${attendanceDeduction.toLocaleString()}: ${attendance.deductionFormula})`;
          } else if (attendance && attendance.absentDays > 0 && !attendance.deductionRuleConfigured) {
            calculationFormula += ` [${attendance.absentDays} absence(s) recorded; no deduction rule configured]`;
          }
        } else if (model === 'PER_LESSON') {
          basePay = 0;
          ratePerUnit = perLessonRate;
          lessonOrHourlyEarning = completedLessons * perLessonRate;
          calculationFormula = `Per Lesson: ${completedLessons} completed × Rs. ${perLessonRate.toLocaleString()} + Allowances (Rs. ${allowances.toLocaleString()}) - Deductions (Rs. ${standardDeductions.toLocaleString()})`;
        } else if (model === 'PER_HOUR') {
          basePay = 0;
          ratePerUnit = perHourRate;
          lessonOrHourlyEarning = Number((verifiedHours * perHourRate).toFixed(2));
          calculationFormula = `Per Hour: ${verifiedHours} hrs × Rs. ${perHourRate.toLocaleString()} + Allowances (Rs. ${allowances.toLocaleString()}) - Deductions (Rs. ${standardDeductions.toLocaleString()})`;
        } else if (model === 'HYBRID') {
          basePay = baseMonthlySalary;
          ratePerUnit = perLessonRate;
          lessonOrHourlyEarning = completedLessons * perLessonRate;
          calculationFormula = `Hybrid: Base (Rs. ${basePay.toLocaleString()}) + (${completedLessons} lessons × Rs. ${ratePerUnit.toLocaleString()}) + Allowances (Rs. ${allowances.toLocaleString()}) - Deductions (Rs. ${standardDeductions.toLocaleString()})`;
        }

        const grossAmount = basePay + lessonOrHourlyEarning + allowances;
        const netPayable = Math.max(0, grossAmount - standardDeductions - attendanceDeduction);

        await trx('teacher_payroll_drafts').insert({
          teacher_id: t.teacherId,
          payroll_month: payrollMonth,
          salary_model: model,
          scheduled_lessons: scheduledLessons,
          completed_lessons: completedLessons,
          cancelled_lessons: cancelledLessons,
          missed_lessons: missedLessons,
          approved_leave_days: approvedLeaveDays,
          verified_hours: verifiedHours,
          base_pay: basePay,
          rate_per_unit: ratePerUnit,
          lesson_or_hourly_earning: lessonOrHourlyEarning,
          allowances,
          standard_deductions: standardDeductions,
          calculation_formula: periodDuty.pendingReviewLessons > 0
            ? `${calculationFormula} [${periodDuty.pendingReviewLessons} lesson(s) with unresolved attendance review were NOT paid]`.slice(0, 480)
            : calculationFormula,
          gross_amount: grossAmount,
          net_payable: netPayable,
          status: 'SUBMITTED_FOR_APPROVAL',
          generated_by: userId,
          ...(hasAttendanceColumns && attendance
            ? {
                duty_days: attendance.presentDays,
                absent_days: attendance.absentDays,
                late_days: attendance.lateDays,
                early_departure_days: attendance.earlyDays,
                duty_minutes: Math.round(attendance.dutyMinutes),
                attendance_deduction: attendanceDeduction
              }
            : {})
        });

        generatedCount++;
      }

      if (generatedCount > 0) {
        await logPayrollAudit(trx, {
          actorId: userId,
          action: 'GENERATE_PAYROLL_DRAFTS',
          recordIdentifier: `Month: ${payrollMonth}`,
          reason: `Batch generated ${generatedCount} teacher salary drafts (${skippedCount} skipped).`,
          newValue: `Generated: ${generatedCount}, Skipped: ${skippedCount}`
        });
      }

      return {
        message: `Generated ${generatedCount} payroll drafts for ${payrollMonth}. ${skippedCount} teachers skipped (drafts exist). ${skippedNoSalaryProfile.length} skipped (no approved salary profile).`,
        generatedCount,
        skippedCount,
        skippedNoSalaryProfile,
        teachersWithPendingReview
      };
    });
  },

  // 2. Query Salary Drafts (Efficient index filter)
  async getSalaryDrafts({ payrollMonth = null, teacherId = null, status = null, draftId = null } = {}, trx = db) {
    let query = trx('teacher_payroll_drafts')
      .join('teachers', 'teacher_payroll_drafts.teacher_id', 'teachers.id')
      .join('users as teacher_users', 'teachers.user_id', 'teacher_users.id')
      .join('users as generator_users', 'teacher_payroll_drafts.generated_by', 'generator_users.id')
      .leftJoin('users as reviewer_users', 'teacher_payroll_drafts.reviewed_by', 'reviewer_users.id')
      .select(
        // raw row first (includes the attendance columns added by migration 35 when present)
        'teacher_payroll_drafts.*',
        'teacher_payroll_drafts.id',
        'teacher_payroll_drafts.teacher_id as teacherId',
        'teacher_users.full_name as teacherName',
        'teachers.employee_no as staffIdentifier',
        'teacher_payroll_drafts.payroll_month as payrollMonth',
        'teacher_payroll_drafts.salary_model as rawSalaryModel',
        'teacher_payroll_drafts.scheduled_lessons as scheduledLessons',
        'teacher_payroll_drafts.completed_lessons as completedLessons',
        'teacher_payroll_drafts.cancelled_lessons as cancelledLessons',
        'teacher_payroll_drafts.missed_lessons as missedLessons',
        'teacher_payroll_drafts.approved_leave_days as approvedLeaveDays',
        'teacher_payroll_drafts.verified_hours as verifiedHours',
        'teacher_payroll_drafts.base_pay as basePay',
        'teacher_payroll_drafts.rate_per_unit as ratePerUnit',
        'teacher_payroll_drafts.lesson_or_hourly_earning as lessonOrHourlyEarning',
        'teacher_payroll_drafts.allowances',
        'teacher_payroll_drafts.standard_deductions as standardDeductions',
        'teacher_payroll_drafts.calculation_formula as calculationFormula',
        'teacher_payroll_drafts.gross_amount as grossAmount',
        'teacher_payroll_drafts.net_payable as netPayable',
        'teacher_payroll_drafts.status as rawStatus',
        'teacher_payroll_drafts.created_at as generatedAt',
        'generator_users.full_name as generatedBy',
        'reviewer_users.full_name as reviewedBy',
        'teacher_payroll_drafts.reviewed_at as reviewedAt',
        'teacher_payroll_drafts.review_remarks as reviewRemarks',
        'teacher_payroll_drafts.salary_slip_number as salarySlipNumber',
        'teacher_payroll_drafts.payment_method as paymentMethod',
        'teacher_payroll_drafts.payment_reference as paymentReference',
        'teacher_payroll_drafts.paid_at as paidAt',
        'teacher_payroll_drafts.paid_amount as paidAmount'
      )
      .orderBy('teacher_payroll_drafts.created_at', 'desc');

    if (draftId) query = query.where('teacher_payroll_drafts.id', draftId);
    if (payrollMonth) query = query.where('teacher_payroll_drafts.payroll_month', payrollMonth);
    if (teacherId) {
      query = query.where((qb) => {
        qb.where('teacher_payroll_drafts.teacher_id', teacherId).orWhere('teachers.user_id', teacherId);
      });
    }
    if (status) query = query.where('teacher_payroll_drafts.status', mapStatusToBackend(status));

    const rows = await query;

    return await Promise.all(
      rows.map(async (r) => {
        const adjustments = await trx('teacher_salary_adjustments')
          .join('users', 'teacher_salary_adjustments.authorized_by', 'users.id')
          .where('teacher_salary_adjustments.payroll_draft_id', r.id)
          .select(
            'teacher_salary_adjustments.id',
            'teacher_salary_adjustments.type as rawType',
            'teacher_salary_adjustments.title',
            'teacher_salary_adjustments.amount',
            'teacher_salary_adjustments.reason',
            'users.full_name as authorizedBy'
          );

        return {
          id: String(r.id),
          teacherId: String(r.teacherId),
          teacherName: r.teacherName,
          staffIdentifier: r.staffIdentifier,
          payrollMonth: r.payrollMonth,
          salaryModel: mapSalaryModelToFrontend(r.rawSalaryModel),
          scheduledLessons: Number(r.scheduledLessons),
          completedLessons: Number(r.completedLessons),
          cancelledLessons: Number(r.cancelledLessons),
          missedLessons: Number(r.missedLessons),
          approvedLeaveDays: Number(r.approvedLeaveDays),
          dutyDays: Number(r.duty_days || 0),
          absentDays: Number(r.absent_days || 0),
          lateDays: Number(r.late_days || 0),
          earlyDepartureDays: Number(r.early_departure_days || 0),
          dutyHours: Math.round((Number(r.duty_minutes || 0) / 60) * 100) / 100,
          attendanceDeduction: Number(r.attendance_deduction || 0),
          verifiedHours: Number(r.verifiedHours),
          basePay: Number(r.basePay),
          ratePerUnit: Number(r.ratePerUnit),
          lessonOrHourlyEarning: Number(r.lessonOrHourlyEarning),
          allowances: Number(r.allowances),
          standardDeductions: Number(r.standardDeductions),
          calculationFormula: r.calculationFormula,
          grossAmount: Number(r.grossAmount),
          netPayable: Number(r.netPayable),
          status: mapStatusToFrontend(r.rawStatus),
          generatedAt: r.generatedAt,
          generatedBy: r.generatedBy,
          reviewedBy: r.reviewedBy || undefined,
          reviewedAt: r.reviewedAt || undefined,
          reviewRemarks: r.reviewRemarks || undefined,
          salarySlipNumber: r.salarySlipNumber || undefined,
          paymentRecord: r.paymentReference
            ? {
                paymentMethod: r.paymentMethod || 'Bank Transfer',
                paymentReference: r.paymentReference,
                paidAt: r.paidAt,
                paidAmount: Number(r.paidAmount)
              }
            : undefined,
          adjustments: adjustments.map((a) => ({
            id: String(a.id),
            type: a.rawType === 'ADDITION' ? 'Addition' : 'Deduction',
            title: a.title,
            amount: Number(a.amount),
            reason: a.reason,
            authorizedBy: a.authorizedBy
          }))
        };
      })
    );
  },

  async findSalaryDraftById(id, trx = db) {
    const list = await this.getSalaryDrafts({ draftId: id }, trx);
    return list[0] || null;
  },

  // 3. Review Salary Draft (Approve / Return / Reject) with ACID Isolation & Invariants
  async reviewSalaryDraft({ draftId, decision, reviewRemarks, reviewerUserId }) {
    return await db.transaction(async (trx) => {
      // 1. Acquire exclusive lock on the draft row (Pessimistic concurrency control)
      const draft = await trx('teacher_payroll_drafts')
        .where({ id: draftId })
        .forUpdate()
        .first();

      if (!draft) return null;

      // Invariant: Once PAID, draft is frozen and immutable
      if (draft.status === 'PAID') {
        throw new AppError('Cannot modify or review a salary draft that has already been paid and settled.', 400, ErrorCodes.VALIDATION_ERROR);
      }

      const backendStatus = mapStatusToBackend(decision);
      let salarySlipNumber = draft.salary_slip_number;

      if (backendStatus === 'APPROVED' && !salarySlipNumber) {
        const cleanMonth = (draft.payroll_month || 'MONTH').replace(/\s+/g, '').toUpperCase();
        salarySlipNumber = `SLIP-${cleanMonth}-${String(draft.teacher_id).padStart(4, '0')}-${String(draft.id).padStart(4, '0')}`;
      }

      await trx('teacher_payroll_drafts')
        .where({ id: draftId })
        .update({
          status: backendStatus,
          reviewed_by: reviewerUserId,
          reviewed_at: trx.fn.now(3),
          review_remarks: reviewRemarks || null,
          salary_slip_number: salarySlipNumber,
          updated_at: trx.fn.now(3)
        });

      // Atomic Audit Log
      await logPayrollAudit(trx, {
        actorId: reviewerUserId,
        action: `REVIEW_DRAFT_${backendStatus}`,
        recordIdentifier: `Slip: ${salarySlipNumber || draft.id} (Draft #${draftId})`,
        reason: reviewRemarks || `Status transitioned to ${backendStatus}`,
        previousValue: `Status: ${draft.status}`,
        newValue: `Status: ${backendStatus}, Slip: ${salarySlipNumber || 'N/A'}`
      });

      return await this.findSalaryDraftById(draftId, trx);
    });
  },

  // 4. Add Salary Adjustment (Addition / Deduction) with Atomic Row Lock & Recalculation
  async addSalaryAdjustment({ draftId, type, title, amount, reason, authorizedByUserId }) {
    return await db.transaction(async (trx) => {
      // 1. Acquire exclusive lock on the draft row (Pessimistic concurrency control)
      const draft = await trx('teacher_payroll_drafts')
        .where({ id: draftId })
        .forUpdate()
        .first();

      if (!draft) return null;

      // Invariant: Frozen states
      if (draft.status === 'PAID') {
        throw new AppError('Cannot add adjustments to a salary draft that has already been settled and paid.', 400, ErrorCodes.VALIDATION_ERROR);
      }
      if (draft.status === 'REJECTED') {
        throw new AppError('Cannot add adjustments to a rejected salary draft.', 400, ErrorCodes.VALIDATION_ERROR);
      }

      const upperType = type.toUpperCase() === 'ADDITION' ? 'ADDITION' : 'DEDUCTION';
      const adjAmount = Math.abs(Number(amount));

      // 2. Insert adjustment record
      await trx('teacher_salary_adjustments').insert({
        payroll_draft_id: draftId,
        type: upperType,
        title,
        amount: adjAmount,
        reason,
        authorized_by: authorizedByUserId
      });

      // 3. Atomically recalculate totals from source of truth inside transaction
      const allAdjustments = await trx('teacher_salary_adjustments').where({
        payroll_draft_id: draftId
      });

      let additions = Number(draft.allowances);
      // Attendance deduction computed at generation (fixed-salary policy) is preserved
      let deductions = Number(draft.standard_deductions) + Number(draft.attendance_deduction || 0);

      for (const a of allAdjustments) {
        if (a.type === 'ADDITION') additions += Number(a.amount);
        if (a.type === 'DEDUCTION') deductions += Number(a.amount);
      }

      const earnings = Number(draft.base_pay) + Number(draft.lesson_or_hourly_earning);
      const grossAmount = earnings + additions;
      const netPayable = Math.max(0, grossAmount - deductions);

      // Invariant: If draft was previously approved, modifying financial amounts requires re-audit
      let newStatus = draft.status;
      if (draft.status === 'APPROVED') {
        newStatus = 'SUBMITTED_FOR_APPROVAL';
      }

      await trx('teacher_payroll_drafts').where({ id: draftId }).update({
        gross_amount: grossAmount,
        net_payable: netPayable,
        status: newStatus,
        updated_at: trx.fn.now(3)
      });

      // Atomic Audit Log
      await logPayrollAudit(trx, {
        actorId: authorizedByUserId,
        action: `ADD_ADJUSTMENT_${upperType}`,
        recordIdentifier: `Draft #${draftId} - ${title}`,
        reason: `${reason} (Amount: Rs. ${adjAmount})`,
        previousValue: `Gross: ${draft.gross_amount}, Net: ${draft.net_payable}, Status: ${draft.status}`,
        newValue: `Gross: ${grossAmount}, Net: ${netPayable}, Status: ${newStatus}`
      });

      return await this.findSalaryDraftById(draftId, trx);
    });
  },

  // 5. Settle Salary Payment with Concurrency Isolation (Prevents Double-Payout)
  async settleSalaryPayment({ draftId, paymentMethod, paymentReference, paidAmount, userId = null }) {
    return await db.transaction(async (trx) => {
      // 1. Acquire exclusive lock on the draft row (Pessimistic concurrency control)
      const draft = await trx('teacher_payroll_drafts')
        .where({ id: draftId })
        .forUpdate()
        .first();

      if (!draft) return null;

      // Invariant: Prevent double payout race conditions
      if (draft.status === 'PAID') {
        throw new AppError('Salary draft has already been settled and paid. Double disbursement is prevented.', 409, ErrorCodes.CONFLICT);
      }

      // Invariant: Only approved drafts can be disbursed
      if (draft.status !== 'APPROVED') {
        throw new AppError('Only approved salary drafts can be settled for payment.', 400, ErrorCodes.VALIDATION_ERROR);
      }

      const finalAmount = Number(paidAmount || draft.net_payable);
      if (finalAmount <= 0) {
        throw new AppError('Disbursement amount must be greater than zero.', 400, ErrorCodes.VALIDATION_ERROR);
      }

      const reference = paymentReference || `REF-${Date.now()}`;

      // Invariant: Prevent duplicate payment reference on another settled record
      if (paymentReference) {
        const existingRef = await trx('teacher_payroll_drafts')
          .where({ payment_reference: paymentReference })
          .whereNot({ id: draftId })
          .first();

        if (existingRef) {
          throw new AppError(`Payment reference "${paymentReference}" is already registered on another salary disbursement.`, 409, ErrorCodes.CONFLICT);
        }
      }

      await trx('teacher_payroll_drafts')
        .where({ id: draftId })
        .update({
          status: 'PAID',
          payment_method: paymentMethod || 'Bank Transfer',
          payment_reference: reference,
          paid_at: trx.fn.now(3),
          paid_amount: finalAmount,
          updated_at: trx.fn.now(3)
        });

      // Atomic Audit Log
      await logPayrollAudit(trx, {
        actorId: userId,
        action: 'SETTLE_SALARY_PAYMENT',
        recordIdentifier: `Slip: ${draft.salary_slip_number || draftId} (Draft #${draftId})`,
        reason: `Settled via ${paymentMethod || 'Bank Transfer'}, Reference: ${reference}`,
        previousValue: `Status: APPROVED, Net: ${draft.net_payable}`,
        newValue: `Status: PAID, Paid: ${finalAmount}, Ref: ${reference}`
      });

      return await this.findSalaryDraftById(draftId, trx);
    });
  },

  // 6. Duty Summary for Teacher
  async getTeacherDutySummary(teacherIdOrObj, payrollMonthArg = null) {
    const tId = typeof teacherIdOrObj === 'object' && teacherIdOrObj !== null
      ? teacherIdOrObj.teacherId
      : teacherIdOrObj;
    const queryMonth = (typeof teacherIdOrObj === 'object' && teacherIdOrObj !== null
      ? teacherIdOrObj.payrollMonth
      : payrollMonthArg) || currentPayrollMonthLabel();

    // Accept either the teachers.id or the owning users.id
    const teacherRow = await db('teachers')
      .where((qb) => {
        qb.where('id', tId).orWhere('user_id', tId);
      })
      .select('id', 'user_id', 'employee_no')
      .first();

    if (!teacherRow) return null;

    const monthRange = parsePayrollMonthRange(queryMonth);
    const result = await getTeacherDutyForPeriod(db, {
      teacherId: teacherRow.id,
      startDate: monthRange ? monthRange.startDate : null,
      endDate: monthRange ? monthRange.endDate : null
    });
    if (!result) return null;
    const { teacher, duty: periodDuty } = result;

    const salaryProfile = await db('teacher_salary_profiles')
      .where('teacher_id', teacherRow.id)
      .whereNull('effective_to')
      .orderBy('effective_from', 'desc')
      .first();

    const hourlyRateFormatted = salaryProfile && Number(salaryProfile.per_hour_rate) > 0
      ? `Rs. ${Number(salaryProfile.per_hour_rate).toLocaleString()} / hr`
      : salaryProfile && Number(salaryProfile.per_lesson_rate) > 0
      ? `Rs. ${Number(salaryProfile.per_lesson_rate).toLocaleString()} / lesson`
      : 'Standard Faculty';

    return {
      teacherId: String(teacher.id),
      staffIdentifier: teacher.staffIdentifier,
      teacherName: teacher.teacherName,
      payrollMonth: queryMonth,
      salaryModel: salaryProfile ? mapSalaryModelToFrontend(salaryProfile.model) : 'Standard Fixed/Hybrid',
      baseSalary: salaryProfile ? Number(salaryProfile.base_amount) : 45000,
      hourlyRate: hourlyRateFormatted,
      perHourRate: salaryProfile ? Number(salaryProfile.per_hour_rate) : 0,
      perLessonRate: salaryProfile ? Number(salaryProfile.per_lesson_rate) : 1500,
      scheduledLessons: periodDuty.totalScheduledLessons,
      completedLessons: periodDuty.completedLessons,
      cancelledLessons: periodDuty.cancelledLessons,
      missedLessons: periodDuty.missedLessons,
      approvedLeaveDays: 0,
      totalDutyMinutes: periodDuty.totalDutyMinutes,
      verifiedTeachingHours: periodDuty.verifiedTeachingHours,
      liveDutyHours: periodDuty.liveDutyHours,
      activeLiveCount: periodDuty.activeLiveCount,
      pendingReviewLessons: periodDuty.pendingReviewLessons,
      pendingDutyCorrections: periodDuty.pendingReviewLessons,
      todayTeachingHours: periodDuty.todayDuty?.totalDutyHours || 0,
      todayTeachingMinutes: periodDuty.todayDuty?.totalDutyMinutes || 0,
      todayCompletedCount: periodDuty.todayDuty?.completedLessons || 0,
      todayScheduledCount: periodDuty.todayDuty?.totalScheduledLessons || 0,
      dailyBreakdown: periodDuty.dailyBreakdown || [],
      detailedLessons: periodDuty.detailedLessons || []
    };
  }
};
