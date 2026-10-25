import { payrollService } from './payroll.service.js';
import { sendSuccess } from '../../shared/http/response.js';

export const payrollController = {
  async generateMonthlyDrafts(req, res, next) {
    try {
      const { payrollMonth, teacherId } = req.body;
      const result = await payrollService.generateMonthlyDrafts({
        payrollMonth,
        userId: req.user.id,
        teacherId
      });
      return sendSuccess(res, result, null, 201);
    } catch (error) {
      next(error);
    }
  },

  async getSalaryDrafts(req, res, next) {
    try {
      const { payrollMonth, teacherId, status } = req.query;
      const drafts = await payrollService.getSalaryDrafts({
        payrollMonth: payrollMonth || null,
        teacherId: teacherId ? Number(teacherId) : null,
        status: status || null
      });
      return sendSuccess(res, drafts);
    } catch (error) {
      next(error);
    }
  },

  async getSalaryDraftById(req, res, next) {
    try {
      const id = req.params.id;
      const draft = await payrollService.getSalaryDraftById(id);
      return sendSuccess(res, draft);
    } catch (error) {
      next(error);
    }
  },

  async reviewSalaryDraft(req, res, next) {
    try {
      const draftId = req.params.id;
      const { decision, reviewRemarks } = req.body;
      const draft = await payrollService.reviewSalaryDraft({
        draftId,
        decision,
        reviewRemarks,
        reviewerUserId: req.user.id
      });
      return sendSuccess(res, draft);
    } catch (error) {
      next(error);
    }
  },

  async addSalaryAdjustment(req, res, next) {
    try {
      const draftId = req.params.id;
      const { type, title, amount, reason } = req.body;
      const draft = await payrollService.addSalaryAdjustment({
        draftId,
        type,
        title,
        amount,
        reason,
        authorizedByUserId: req.user.id
      });
      return sendSuccess(res, draft, null, 201);
    } catch (error) {
      next(error);
    }
  },

  async settleSalaryPayment(req, res, next) {
    try {
      const draftId = req.params.id;
      const { paymentMethod, paymentReference, paidAmount } = req.body;
      const draft = await payrollService.settleSalaryPayment({
        draftId,
        paymentMethod,
        paymentReference,
        paidAmount,
        userId: req.user?.id
      });
      return sendSuccess(res, draft);
    } catch (error) {
      next(error);
    }
  },

  async getTeacherDutySummary(req, res, next) {
    try {
      const { teacherId } = req.params;
      const { payrollMonth } = req.query;
      const summary = await payrollService.getTeacherDutySummary({
        teacherId,
        payrollMonth
      });
      return sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  }
};
