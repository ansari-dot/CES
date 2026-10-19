import { db } from '../../shared/db/knex.js';

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

export const payrollRepository = {
  // 1. Generate Monthly Payroll Drafts
  async generateMonthlyDrafts({ payrollMonth, userId, teacherId = null }) {
    let teachersQuery = db('teachers')
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

    for (const t of teachers) {
      // 1. Check if draft already exists
      const existing = await db('teacher_payroll_drafts')
        .where({ teacher_id: t.teacherId, payroll_month: payrollMonth })
        .first();

      if (existing) {
        skippedCount++;
        continue;
      }

      // 2. Fetch salary profile (or default to FIXED)
      const profile = await db('teacher_salary_profiles')
        .where('teacher_id', t.teacherId)
        .orderBy('effective_from', 'desc')
        .first();

      const model = profile ? profile.model : 'FIXED';
      const baseMonthlySalary = profile ? Number(profile.base_amount || 0) : 50000;
      const perLessonRate = profile ? Number(profile.per_lesson_rate || 0) : 1500;
      const perHourRate = profile ? Number(profile.per_hour_rate || 0) : 1200;

      let allowances = 5000;
      let standardDeductions = 2500;
      if (profile && profile.rules) {
        try {
          const parsed = typeof profile.rules === 'string' ? JSON.parse(profile.rules) : profile.rules;
          if (parsed.allowances !== undefined) allowances = Number(parsed.allowances);
          if (parsed.standardDeductions !== undefined) standardDeductions = Number(parsed.standardDeductions);
        } catch {
          // ignore json parse error
        }
      }

      // 3. Compute duty metrics from timetable_lessons
      const lessons = await db('timetable_lessons').where('teacher_id', t.teacherId);

      const scheduledLessons = lessons.length;
      const completedLessons = lessons.filter((l) => l.status === 'COMPLETED').length;
      const cancelledLessons = lessons.filter((l) => l.status === 'CANCELLED').length;
      const missedLessons = lessons.filter((l) => l.status === 'MISSED').length;
      const approvedLeaveDays = 0;

      // Approximate hours (0.75h per lesson if no explicit time diff)
      let verifiedHours = 0;
      for (const l of lessons.filter((l) => l.status === 'COMPLETED')) {
        if (l.start_at && l.end_at) {
          const start = new Date(l.start_at).getTime();
          const end = new Date(l.end_at).getTime();
          const diffHours = (end - start) / (1000 * 60 * 60);
          verifiedHours += diffHours > 0 ? diffHours : 0.75;
        } else {
          verifiedHours += 0.75;
        }
      }
      verifiedHours = Number(verifiedHours.toFixed(2));

      // 4. Calculate Earnings per Salary Model
      let basePay = 0;
      let ratePerUnit = 0;
      let lessonOrHourlyEarning = 0;
      let calculationFormula = '';

      if (model === 'FIXED') {
        basePay = baseMonthlySalary;
        ratePerUnit = 0;
        lessonOrHourlyEarning = 0;
        calculationFormula = `Fixed: Base (Rs. ${basePay.toLocaleString()}) + Allowances (Rs. ${allowances.toLocaleString()}) - Deductions (Rs. ${standardDeductions.toLocaleString()})`;
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
      const netPayable = Math.max(0, grossAmount - standardDeductions);

      await db('teacher_payroll_drafts').insert({
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
        calculation_formula: calculationFormula,
        gross_amount: grossAmount,
        net_payable: netPayable,
        status: 'SUBMITTED_FOR_APPROVAL',
        generated_by: userId
      });

      generatedCount++;
    }

    return {
      message: `Generated ${generatedCount} payroll drafts for ${payrollMonth}. ${skippedCount} teachers skipped (drafts exist).`,
      generatedCount,
      skippedCount
    };
  },

  // 2. Query Salary Drafts
  async getSalaryDrafts({ payrollMonth = null, teacherId = null, status = null } = {}, trx = db) {
    let query = trx('teacher_payroll_drafts')
      .join('teachers', 'teacher_payroll_drafts.teacher_id', 'teachers.id')
      .join('users as teacher_users', 'teachers.user_id', 'teacher_users.id')
      .join('users as generator_users', 'teacher_payroll_drafts.generated_by', 'generator_users.id')
      .leftJoin('users as reviewer_users', 'teacher_payroll_drafts.reviewed_by', 'reviewer_users.id')
      .select(
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

    if (payrollMonth) query = query.where('teacher_payroll_drafts.payroll_month', payrollMonth);
    if (teacherId) query = query.where('teacher_payroll_drafts.teacher_id', teacherId);
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
    const list = await this.getSalaryDrafts({}, trx);
    return list.find((d) => d.id === String(id)) || null;
  },

  // 3. Review Salary Draft (Approve / Return / Reject)
  async reviewSalaryDraft({ draftId, decision, reviewRemarks, reviewerUserId }) {
    return await db.transaction(async (trx) => {
      const draft = await trx('teacher_payroll_drafts').where({ id: draftId }).first();
      if (!draft) return null;

      const backendStatus = mapStatusToBackend(decision);
      let salarySlipNumber = draft.salary_slip_number;

      if (backendStatus === 'APPROVED' && !salarySlipNumber) {
        salarySlipNumber = `SLIP-${Date.now().toString().slice(-6)}`;
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

      return await this.findSalaryDraftById(draftId, trx);
    });
  },

  // 4. Add Salary Adjustment (Addition / Deduction)
  async addSalaryAdjustment({ draftId, type, title, amount, reason, authorizedByUserId }) {
    return await db.transaction(async (trx) => {
      const draft = await trx('teacher_payroll_drafts').where({ id: draftId }).first();
      if (!draft) return null;

      const upperType = type.toUpperCase() === 'ADDITION' ? 'ADDITION' : 'DEDUCTION';
      const adjAmount = Math.abs(Number(amount));

      await trx('teacher_salary_adjustments').insert({
        payroll_draft_id: draftId,
        type: upperType,
        title,
        amount: adjAmount,
        reason,
        authorized_by: authorizedByUserId
      });

      // Recalculate totals
      const allAdjustments = await trx('teacher_salary_adjustments').where({
        payroll_draft_id: draftId
      });

      let additions = Number(draft.allowances);
      let deductions = Number(draft.standard_deductions);

      for (const a of allAdjustments) {
        if (a.type === 'ADDITION') additions += Number(a.amount);
        if (a.type === 'DEDUCTION') deductions += Number(a.amount);
      }

      const earnings = Number(draft.base_pay) + Number(draft.lesson_or_hourly_earning);
      const grossAmount = earnings + additions;
      const netPayable = Math.max(0, grossAmount - deductions);

      await trx('teacher_payroll_drafts').where({ id: draftId }).update({
        gross_amount: grossAmount,
        net_payable: netPayable,
        updated_at: trx.fn.now(3)
      });

      return await this.findSalaryDraftById(draftId, trx);
    });
  },

  // 5. Settle Salary Payment
  async settleSalaryPayment({ draftId, paymentMethod, paymentReference, paidAmount }) {
    return await db.transaction(async (trx) => {
      const draft = await trx('teacher_payroll_drafts').where({ id: draftId }).first();
      if (!draft) return null;

      const finalAmount = Number(paidAmount || draft.net_payable);

      await trx('teacher_payroll_drafts')
        .where({ id: draftId })
        .update({
          status: 'PAID',
          payment_method: paymentMethod || 'Bank Transfer',
          payment_reference: paymentReference || `REF-${Date.now()}`,
          paid_at: trx.fn.now(3),
          paid_amount: finalAmount,
          updated_at: trx.fn.now(3)
        });

      return await this.findSalaryDraftById(draftId, trx);
    });
  },

  // 6. Duty Summary for Teacher
  async getTeacherDutySummary({ teacherId, payrollMonth }) {
    const teacher = await db('teachers')
      .join('users', 'teachers.user_id', 'users.id')
      .where('teachers.id', teacherId)
      .select('teachers.id', 'teachers.employee_no as staffIdentifier', 'users.full_name as teacherName')
      .first();

    if (!teacher) return null;

    const lessons = await db('timetable_lessons').where('teacher_id', teacherId);

    const scheduledLessons = lessons.length;
    const completedLessons = lessons.filter((l) => l.status === 'COMPLETED').length;
    const cancelledLessons = lessons.filter((l) => l.status === 'CANCELLED').length;
    const missedLessons = lessons.filter((l) => l.status === 'MISSED').length;

    let verifiedTeachingHours = 0;
    for (const l of lessons.filter((l) => l.status === 'COMPLETED')) {
      if (l.start_at && l.end_at) {
        const start = new Date(l.start_at).getTime();
        const end = new Date(l.end_at).getTime();
        const diffHours = (end - start) / (1000 * 60 * 60);
        verifiedTeachingHours += diffHours > 0 ? diffHours : 0.75;
      } else {
        verifiedTeachingHours += 0.75;
      }
    }

    return {
      teacherId: String(teacherId),
      staffIdentifier: teacher.staffIdentifier,
      teacherName: teacher.teacherName,
      payrollMonth,
      scheduledLessons,
      completedLessons,
      cancelledLessons,
      missedLessons,
      approvedLeaveDays: 0,
      verifiedTeachingHours: Number(verifiedTeachingHours.toFixed(2)),
      pendingDutyCorrections: 0
    };
  }
};
