import { payrollRepository } from './payroll.repository.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { currentPayrollMonthLabel } from '../../shared/utils/dutyCalculation.js';

export const payrollService = {
  async generateMonthlyDrafts({ payrollMonth, userId, teacherId = null }) {
    if (!payrollMonth || !payrollMonth.trim()) {
      throw new AppError('Payroll month is required (e.g. "April 2026")', 422, ErrorCodes.VALIDATION_ERROR);
    }

    return await payrollRepository.generateMonthlyDrafts({
      payrollMonth: payrollMonth.trim(),
      userId,
      teacherId: teacherId ? Number(teacherId) : null
    });
  },

  async getSalaryDrafts(filters) {
    return await payrollRepository.getSalaryDrafts(filters);
  },

  async getSalaryDraftById(id) {
    if (!id || isNaN(Number(id))) {
      throw new AppError('Valid salary draft ID is required', 422, ErrorCodes.VALIDATION_ERROR);
    }

    const draft = await payrollRepository.findSalaryDraftById(id);
    if (!draft) {
      throw new AppError('Salary draft not found', 404, ErrorCodes.NOT_FOUND);
    }
    return draft;
  },

  async reviewSalaryDraft({ draftId, decision, reviewRemarks, reviewerUserId }) {
    if (!draftId || isNaN(Number(draftId))) {
      throw new AppError('Valid salary draft ID is required', 422, ErrorCodes.VALIDATION_ERROR);
    }

    if (!decision || typeof decision !== 'string') {
      throw new AppError('Review decision is required', 422, ErrorCodes.VALIDATION_ERROR);
    }

    const normDecision = decision.toUpperCase().replace(/\s+/g, '_');
    if (!['APPROVED', 'RETURNED_FOR_CORRECTION', 'REJECTED'].includes(normDecision)) {
      throw new AppError('Invalid review decision. Must be Approved, Returned for Correction, or Rejected', 422, ErrorCodes.VALIDATION_ERROR);
    }

    if (['RETURNED_FOR_CORRECTION', 'REJECTED'].includes(normDecision) && (!reviewRemarks || !reviewRemarks.trim())) {
      throw new AppError('A reason note is required when returning or rejecting salary drafts.', 422, ErrorCodes.VALIDATION_ERROR);
    }

    const updated = await payrollRepository.reviewSalaryDraft({
      draftId: Number(draftId),
      decision,
      reviewRemarks: reviewRemarks ? reviewRemarks.trim() : '',
      reviewerUserId
    });

    if (!updated) {
      throw new AppError('Salary draft not found', 404, ErrorCodes.NOT_FOUND);
    }

    return updated;
  },

  async addSalaryAdjustment({ draftId, type, title, amount, reason, authorizedByUserId }) {
    if (!draftId || isNaN(Number(draftId))) {
      throw new AppError('Valid salary draft ID is required', 422, ErrorCodes.VALIDATION_ERROR);
    }

    if (!type || !['ADDITION', 'DEDUCTION'].includes(type.toUpperCase())) {
      throw new AppError('Adjustment type must be either Addition or Deduction', 422, ErrorCodes.VALIDATION_ERROR);
    }

    if (!title || !title.trim()) {
      throw new AppError('Adjustment title is required', 422, ErrorCodes.VALIDATION_ERROR);
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new AppError('Adjustment amount must be greater than zero', 422, ErrorCodes.VALIDATION_ERROR);
    }

    if (!reason || !reason.trim()) {
      throw new AppError('Adjustment reason is required', 422, ErrorCodes.VALIDATION_ERROR);
    }

    const updated = await payrollRepository.addSalaryAdjustment({
      draftId: Number(draftId),
      type,
      title: title.trim(),
      amount: numAmount,
      reason: reason.trim(),
      authorizedByUserId
    });

    if (!updated) {
      throw new AppError('Salary draft not found', 404, ErrorCodes.NOT_FOUND);
    }

    return updated;
  },

  async settleSalaryPayment({ draftId, paymentMethod, paymentReference, paidAmount, userId = null }) {
    if (!draftId || isNaN(Number(draftId))) {
      throw new AppError('Valid salary draft ID is required', 422, ErrorCodes.VALIDATION_ERROR);
    }

    if (paidAmount !== undefined && paidAmount !== null) {
      const numAmount = Number(paidAmount);
      if (isNaN(numAmount) || numAmount <= 0) {
        throw new AppError('Disbursement amount must be greater than zero', 422, ErrorCodes.VALIDATION_ERROR);
      }
    }

    const updated = await payrollRepository.settleSalaryPayment({
      draftId: Number(draftId),
      paymentMethod,
      paymentReference,
      paidAmount: paidAmount ? Number(paidAmount) : undefined,
      userId
    });

    if (!updated) {
      throw new AppError('Salary draft not found', 404, ErrorCodes.NOT_FOUND);
    }

    return updated;
  },

  async getTeacherDutySummary({ teacherId, payrollMonth }) {
    if (!teacherId || isNaN(Number(teacherId))) {
      throw new AppError('Valid teacher ID is required', 422, ErrorCodes.VALIDATION_ERROR);
    }

    const summary = await payrollRepository.getTeacherDutySummary({
      teacherId: Number(teacherId),
      payrollMonth: payrollMonth || currentPayrollMonthLabel()
    });

    if (!summary) {
      throw new AppError('Teacher record not found', 404, ErrorCodes.NOT_FOUND);
    }

    return summary;
  }
};
