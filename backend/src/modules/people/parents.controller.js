import { parentsService } from './parents.service.js';
import { sendSuccess } from '../../shared/http/response.js';

export const parentsController = {
  async getAllParents(req, res, next) {
    try {
      const status = req.query.status || null;
      const parents = await parentsService.getAllParents({ status });
      return sendSuccess(res, parents);
    } catch (error) {
      next(error);
    }
  },

  async getParentById(req, res, next) {
    try {
      const parent = await parentsService.getParentById(Number(req.params.id));
      return sendSuccess(res, parent);
    } catch (error) {
      next(error);
    }
  },

  async registerParent(req, res, next) {
    try {
      const { name, email, phone, cnic, relation, password } = req.body;
      const parent = await parentsService.registerParent({
        name,
        email,
        phone,
        cnic,
        relation,
        password
      });
      return sendSuccess(res, parent, null, 201);
    } catch (error) {
      next(error);
    }
  },

  async approveParent(req, res, next) {
    try {
      const parentId = Number(req.params.id);
      const { status, children } = req.body;
      const parent = await parentsService.approveParent({
        parentId,
        status: status || 'APPROVED',
        verifiedBy: req.user?.id,
        children: children || []
      });
      return sendSuccess(res, parent);
    } catch (error) {
      next(error);
    }
  },

  async getMyDashboard(req, res, next) {
    try {
      const data = await parentsService.getMyDashboard(req.user.id);
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },

  async getChildChallans(req, res, next) {
    try {
      const studentId = Number(req.params.studentId);
      const challans = await parentsService.getChildChallans(req.user.id, studentId);
      return sendSuccess(res, challans);
    } catch (error) {
      next(error);
    }
  },

  async payChildChallan(req, res, next) {
    try {
      const studentId = Number(req.params.studentId);
      const challanId = Number(req.params.challanId);
      let { submittedAmount, bankOrWallet, transactionReference, paymentDate, proofDocumentUrl } = req.body;

      if (req.file) {
        proofDocumentUrl = `/api/v1/uploads/${req.file.filename}`;
      }

      const result = await parentsService.payChildChallan(req.user.id, studentId, challanId, {
        submittedAmount,
        bankOrWallet,
        transactionReference,
        paymentDate,
        proofDocumentUrl
      });
      return sendSuccess(res, result, null, 201);
    } catch (error) {
      next(error);
    }
  }
};
