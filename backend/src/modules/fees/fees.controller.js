import fs from 'fs';
import { challanPaymentDetailsService } from './fees.paymentDetails.js';
import { feesService } from './fees.service.js';
import { db } from '../../shared/db/knex.js';
import { authRepository } from '../auth/auth.repository.js';
import { sendSuccess } from '../../shared/http/response.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { isStaff, getStudentByUserId, getParentChildren } from '../../shared/services/accessScope.js';

export const feesController = {
  // 0b. Per-challan payment details (revisioned) & QR code
  async getChallanPaymentDetails(req, res, next) {
    try {
      const data = await challanPaymentDetailsService.getDetails(Number(req.params.id));
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },

  async reviseChallanPaymentDetails(req, res, next) {
    try {
      const data = await challanPaymentDetailsService.revise({
        challanId: Number(req.params.id),
        actor: req.user,
        input: req.body || {},
        file: req.file || null,
        ipAddress: req.ip || null
      });
      return sendSuccess(res, data, 'Challan payment details revised');
    } catch (error) {
      next(error);
    }
  },

  async streamChallanPaymentQr(req, res, next) {
    try {
      const { filePath, mimeType } = await challanPaymentDetailsService.resolveQrFile(
        req.user,
        Number(req.params.id),
        req.query.rev ? Number(req.query.rev) : null
      );
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Cache-Control', 'private, max-age=300');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', 'inline; filename="payment-qr"');
      return fs.createReadStream(filePath).on('error', next).pipe(res);
    } catch (error) {
      next(error);
    }
  },

  // 0. School Bank Accounts & Custom Assignments
  async getBankAccounts(req, res, next) {
    try {
      const { status } = req.query;
      const accounts = await feesService.getBankAccounts({ status: status || null });
      return sendSuccess(res, accounts);
    } catch (error) {
      next(error);
    }
  },

  async createBankAccount(req, res, next) {
    try {
      const { bankName, branchName, accountTitle, accountNumber, iban, isDefault, instructions } = req.body;
      const account = await feesService.createBankAccount(
        { bankName, branchName, accountTitle, accountNumber, iban, isDefault, instructions },
        req.user?.id
      );
      return sendSuccess(res, account, 'Bank account created successfully', 201);
    } catch (error) {
      next(error);
    }
  },

  async updateBankAccount(req, res, next) {
    try {
      const id = Number(req.params.id);
      const { bankName, branchName, accountTitle, accountNumber, iban, isDefault, status, instructions } = req.body;
      const updated = await feesService.updateBankAccount(
        id,
        { bankName, branchName, accountTitle, accountNumber, iban, isDefault, status, instructions },
        req.user?.id
      );
      return sendSuccess(res, updated, 'Bank account updated successfully');
    } catch (error) {
      next(error);
    }
  },

  async archiveBankAccount(req, res, next) {
    try {
      const id = Number(req.params.id);
      await feesService.archiveBankAccount(id, req.user?.id);
      return sendSuccess(res, { success: true }, 'Bank account archived');
    } catch (error) {
      next(error);
    }
  },

  async assignStudentBankAccount(req, res, next) {
    try {
      const studentId = Number(req.params.id);
      const { bankAccountId } = req.body;
      const result = await feesService.assignStudentBankAccount({
        studentId,
        bankAccountId: bankAccountId ? Number(bankAccountId) : null,
        actorId: req.user?.id
      });
      return sendSuccess(res, result, 'Student bank account updated');
    } catch (error) {
      next(error);
    }
  },

  async assignChallanBankAccount(req, res, next) {
    try {
      const challanId = Number(req.params.id);
      const { bankAccountId } = req.body;
      const result = await feesService.assignChallanBankAccount({
        challanId,
        bankAccountId: Number(bankAccountId),
        actorId: req.user?.id
      });
      return sendSuccess(res, result, 'Challan bank account updated');
    } catch (error) {
      next(error);
    }
  },

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
      const { studentId, sessionId, termId, concessionType, value, reason, effectiveStartDate, effectiveEndDate, feeComponent, adminNotes } = req.body;
      const result = await feesService.createConcession({
        studentId,
        sessionId,
        termId: termId || null,
        concessionType,
        value,
        reason,
        approvedBy: req.user.id,
        effectiveStartDate: effectiveStartDate || null,
        effectiveEndDate: effectiveEndDate || null,
        feeComponent: feeComponent || null,
        adminNotes: adminNotes || null
      });
      return sendSuccess(res, result, null, 201);
    } catch (error) {
      next(error);
    }
  },

  async getConcessions(req, res, next) {
    try {
      const { studentId, sessionId, status } = req.query;
      const filters = {
        studentId: studentId ? Number(studentId) : null,
        sessionId: sessionId ? Number(sessionId) : null,
        status: status || null
      };
      // Staff see every concession; students and parents only their own / their children's
      if (!isStaff(req.user)) {
        if (req.user?.role === 'STUDENT') {
          const me = await getStudentByUserId(req.user.id);
          filters.studentIds = me ? [me.id] : [];
        } else if (req.user?.role === 'PARENT') {
          const { children } = await getParentChildren(req.user.id);
          filters.studentIds = children.map((c) => c.id);
        } else {
          throw new AppError('You are not allowed to view fee concessions', 403, ErrorCodes.FORBIDDEN);
        }
        if (filters.studentId && !filters.studentIds.includes(filters.studentId)) filters.studentIds = [];
      }
      const result = await feesService.getConcessions(filters);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async updateConcession(req, res, next) {
    try {
      const result = await feesService.updateConcession(Number(req.params.id), req.body || {}, req.user?.id);
      return sendSuccess(res, result, 'Concession updated. New challans will use the updated terms.');
    } catch (error) {
      next(error);
    }
  },

  async revokeConcession(req, res, next) {
    try {
      const id = Number(req.params.id);
      await feesService.revokeConcession(id, { actorId: req.user?.id, reason: req.body?.reason || null });
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
      const { classId, studentId, billingMonth, status, search, bankAccountId } = req.query;
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
        search: search || null,
        bankAccountId: bankAccountId || null
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
      const { status, challanId, studentId, bankAccountId } = req.query;
      const proofs = await feesService.getPaymentProofs({
        status: status || null,
        challanId: challanId ? Number(challanId) : null,
        studentId: studentId ? Number(studentId) : null,
        bankAccountId: bankAccountId || null
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

  async blockStudentAccess(req, res, next) {
    try {
      const challanId = Number(req.params.id);
      const actorRecord = await authRepository.findUserById(req.user.id);
      const result = await feesService.blockStudentAccess({
        challanId,
        actor: {
          id: req.user.id,
          name: actorRecord?.full_name || req.user.username,
          role: req.user.role === 'ADMIN' ? 'Administrator' : 'Principal'
        }
      });
      return sendSuccess(res, result);
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
