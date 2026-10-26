import { feesService } from './fees.service.js';
import { db } from '../../shared/db/knex.js';
import { authRepository } from '../auth/auth.repository.js';
import { sendSuccess } from '../../shared/http/response.js';

export const feesController = {
  // 1. Fee Structures
  async createOrUpdateFeeStructure(req, res, next) {
    try {
      const { sessionId, classId, heads, effectiveFrom } = req.body;
      const result = await feesService.createOrUpdateFeeStructure({
        sessionId,
        classId,
        heads,
        effectiveFrom,
        userId: req.user.id
      });
      return sendSuccess(res, result, null, 201);
    } catch (error) {
      next(error);
    }
  },

  async getFeeStructures(req, res, next) {
    try {
      const { sessionId, classId } = req.query;
      const result = await feesService.getFeeStructures({
        sessionId: sessionId ? Number(sessionId) : null,
        classId: classId ? Number(classId) : null
      });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async getMyFeeStructure(req, res, next) {
    try {
      const student = await db('students').where({ user_id: req.user.id }).first();
      if (!student) {
        return sendSuccess(res, null);
      }
      const data = await feesService.getStudentFeeStructure(student.id);
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },

  async getStudentFeeStructure(req, res, next) {
    try {
      const id = Number(req.params.id);
      const data = await feesService.getStudentFeeStructure(id);
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },

  // 2. Concessions
  async createConcession(req, res, next) {
    try {
      const { studentId, sessionId, concessionType, value, reason } = req.body;
      const result = await feesService.createConcession({
        studentId,
        sessionId,
        concessionType,
        value,
        reason,
        approvedBy: req.user.id
      });
      return sendSuccess(res, result, null, 201);
    } catch (error) {
      next(error);
    }
  },

  async getConcessions(req, res, next) {
    try {
      const { studentId, sessionId, status } = req.query;
      const result = await feesService.getConcessions({
        studentId: studentId ? Number(studentId) : null,
        sessionId: sessionId ? Number(sessionId) : null,
        status: status || null
      });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async revokeConcession(req, res, next) {
    try {
      const id = Number(req.params.id);
      await feesService.revokeConcession(id);
      return sendSuccess(res, { revoked: true, id });
    } catch (error) {
      next(error);
    }
  },

  // 3. Monthly Challans
  async generateMonthlyChallans(req, res, next) {
    try {
      const {
        sessionId,
        classId,
        billingMonth,
        issueDate,
        dueDate,
        validUntil,
        gracePeriodDays,
        lateFeeAmount
      } = req.body;

      const result = await feesService.generateMonthlyChallans({
        sessionId,
        classId,
        billingMonth,
        issueDate,
        dueDate,
        validUntil,
        gracePeriodDays,
        lateFeeAmount
      });
      return sendSuccess(res, result, null, 201);
    } catch (error) {
      next(error);
    }
  },

  async getChallans(req, res, next) {
    try {
      const { classId, studentId, billingMonth, status, search } = req.query;
      let finalStudentId = studentId ? Number(studentId) : null;

      if (req.user && req.user.role === 'STUDENT') {
        const student = await db('students').where({ user_id: req.user.id }).first();
        if (student) finalStudentId = student.id;
      }

      const challans = await feesService.getChallans({
        classId: classId ? Number(classId) : null,
        studentId: finalStudentId,
        billingMonth: billingMonth || null,
        status: status || null,
        search: search || null
      });
      return sendSuccess(res, challans);
    } catch (error) {
      next(error);
    }
  },

  async getChallanById(req, res, next) {
    try {
      const id = Number(req.params.id);
      const challan = await feesService.getChallanById(id);
      return sendSuccess(res, challan);
    } catch (error) {
      next(error);
    }
  },

  async getChallanByConsumerNo(req, res, next) {
    try {
      const { consumerNo } = req.params;
      const challan = await feesService.getChallanByConsumerNo(consumerNo);
      return sendSuccess(res, challan);
    } catch (error) {
      next(error);
    }
  },

  // 4. Payment Proofs
  async submitPaymentProof(req, res, next) {
    try {
      let {
        challanId,
        studentId,
        parentId,
        submittedAmount,
        bankOrWallet,
        transactionReference,
        paymentDate,
        proofDocumentUrl
      } = req.body;

      // Handle file upload if present
      if (req.file) {
        proofDocumentUrl = `/api/v1/uploads/${req.file.filename}`;
      }

      // Automatically find parentId if user is a parent
      if (!parentId) {
        const p = await db('parents').where({ user_id: req.user.id }).first();
        if (p) parentId = p.id;
      }

      const proof = await feesService.submitPaymentProof({
        challanId,
        studentId,
        parentId,
        submittedAmount,
        bankOrWallet,
        transactionReference,
        paymentDate,
        proofDocumentUrl
      });

      return sendSuccess(res, proof, null, 201);
    } catch (error) {
      next(error);
    }
  },

  async getPaymentProofs(req, res, next) {
    try {
      const { status, challanId, studentId } = req.query;
      const proofs = await feesService.getPaymentProofs({
        status: status || null,
        challanId: challanId ? Number(challanId) : null,
        studentId: studentId ? Number(studentId) : null
      });
      return sendSuccess(res, proofs);
    } catch (error) {
      next(error);
    }
  },

  async reviewPaymentProof(req, res, next) {
    try {
      const proofId = Number(req.params.id);
      const { status, reviewDecisionNote, verifiedAmount } = req.body;
      const result = await feesService.reviewPaymentProof({
        proofId,
        status,
        reviewDecisionNote,
        verifiedAmount,
        reviewedByUserId: req.user.id
      });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async getFeeStats(req, res, next) {
    try {
      const { sessionId, billingMonth, classId } = req.query;
      const stats = await feesService.getFeeStats({
        sessionId: sessionId ? Number(sessionId) : null,
        billingMonth: billingMonth || null,
        classId: classId ? Number(classId) : null
      });
      return sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  },

  async getRestrictedStudents(req, res, next) {
    try {
      const list = await feesService.getRestrictedStudents();
      return sendSuccess(res, list);
    } catch (error) {
      next(error);
    }
  },

  async restoreStudentAccess(req, res, next) {
    try {
      const studentId = Number(req.params.id);
      const actorRecord = await authRepository.findUserById(req.user.id);
      const result = await feesService.restoreStudentAccess({
        studentId,
        actor: {
          id: req.user.id,
          name: actorRecord?.full_name || req.user.username,
          role: req.user.role === 'ADMIN' ? 'Administrator' : 'Principal'
        },
        ipAddress: req.ip
      });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
};
