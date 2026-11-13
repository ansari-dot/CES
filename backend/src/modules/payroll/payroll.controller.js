import { payrollService } from './payroll.service.js';
import { sendSuccess } from '../../shared/http/response.js';
import { isStaff, getTeacherByUserId, forbidden } from '../../shared/services/accessScope.js';

/**
 * Payroll data is confidential: staff (Principal/Admin) see everything, a teacher only
 * their own records, every other role nothing. Returns the teacher id to force, or null.
 */
async function resolvePayrollScope(user) {
  if (isStaff(user)) return { staff: true, teacherId: null };
  if (user?.role === 'TEACHER') {
    const teacher = await getTeacherByUserId(user.id);
    if (!teacher) throw forbidden('Teacher profile not found');
    return { staff: false, teacherId: Number(teacher.id), userId: Number(user.id) };
  }
  throw forbidden('Payroll records are only available to staff and the teacher concerned.');
}

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
      const scope = await resolvePayrollScope(req.user);
      const drafts = await payrollService.getSalaryDrafts({
        payrollMonth: payrollMonth || null,
        teacherId: scope.staff ? (teacherId ? Number(teacherId) : null) : scope.teacherId,
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
      const scope = await resolvePayrollScope(req.user);
      const draft = await payrollService.getSalaryDraftById(id);
      if (!scope.staff && Number(draft?.teacherId) !== scope.teacherId) {
        throw forbidden('You can only view your own salary records.');
      }
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
      const scope = await resolvePayrollScope(req.user);
      if (!scope.staff && Number(teacherId) !== scope.teacherId && Number(teacherId) !== scope.userId) {
        throw forbidden('You can only view your own duty summary.');
      }
      const summary = await payrollService.getTeacherDutySummary({
        teacherId: scope.staff ? teacherId : scope.teacherId,
        payrollMonth
      });
      return sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  }
};
