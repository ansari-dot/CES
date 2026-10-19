import { payrollRepository } from './payroll.repository.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';

export const payrollService = {
  async generateMonthlyDrafts({ payrollMonth, userId, teacherId = null }) {
    if (!payrollMonth || !payrollMonth.trim()) {
      throw new AppError('Payroll month is required (e.g. "April 2026")', 422, ErrorCodes.VALIDATION_ERROR);
    }

    return await payrollRepository.generateMonthlyDrafts({
      payrollMonth,
      userId,
      teacherId: teacherId ? Number(teacherId) : null
    });
  },

  async getSalaryDrafts(filters) {
    return await payrollRepository.getSalaryDrafts(filters);
  },

  async getSalaryDraftById(id) {
    const draft = await payrollRepository.findSalaryDraftById(id);
    if (!draft) {
      throw new AppError('Salary draft not found', 404, ErrorCodes.NOT_FOUND);
    }
    return draft;
  },

  async reviewSalaryDraft({ draftId, decision, reviewRemarks, reviewerUserId }) {
    const draft = await payrollRepository.findSalaryDraftById(draftId);
    if (!draft) {
      throw new AppError('Salary draft not found', 404, ErrorCodes.NOT_FOUND);
    }

    const normDecision = decision.toUpperCase().replace(/\s+/g, '_');
    if (['RETURNED_FOR_CORRECTION', 'REJECTED'].includes(normDecision) && (!reviewRemarks || !reviewRemarks.trim())) {
      throw new AppError('A reason note is required when returning or rejecting salary drafts.', 422, ErrorCodes.VALIDATION_ERROR);
    }

    return await payrollRepository.reviewSalaryDraft({
      draftId: Number(draftId),
      decision,
      reviewRemarks,
      reviewerUserId
    });
  },

  async addSalaryAdjustment({ draftId, type, title, amount, reason, authorizedByUserId }) {
    const draft = await payrollRepository.findSalaryDraftById(draftId);
    if (!draft) {
      throw new AppError('Salary draft not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (!title || !title.trim()) {
      throw new AppError('Adjustment title is required', 422, ErrorCodes.VALIDATION_ERROR);
    }

    if (!amount || Number(amount) <= 0) {
      throw new AppError('Adjustment amount must be greater than zero', 422, ErrorCodes.VALIDATION_ERROR);
    }

    if (!reason || !reason.trim()) {
      throw new AppError('Adjustment reason is required', 422, ErrorCodes.VALIDATION_ERROR);
    }

    return await payrollRepository.addSalaryAdjustment({
      draftId: Number(draftId),
      type,
      title,
      amount: Number(amount),
      reason,
      authorizedByUserId
    });
  },

  async settleSalaryPayment({ draftId, paymentMethod, paymentReference, paidAmount }) {
    const draft = await payrollRepository.findSalaryDraftById(draftId);
    if (!draft) {
      throw new AppError('Salary draft not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (draft.status !== 'Approved') {
      throw new AppError('Only approved salary drafts can be settled for payment.', 400, ErrorCodes.VALIDATION_ERROR);
    }

    return await payrollRepository.settleSalaryPayment({
      draftId: Number(draftId),
      paymentMethod,
      paymentReference,
      paidAmount
    });
  },

  async getTeacherDutySummary({ teacherId, payrollMonth }) {
    const summary = await payrollRepository.getTeacherDutySummary({
      teacherId: Number(teacherId),
      payrollMonth: payrollMonth || 'April 2026'
    });

    if (!summary) {
      throw new AppError('Teacher record not found', 404, ErrorCodes.NOT_FOUND);
    }

    return summary;
  }
};
