import { feesRepository } from './fees.repository.js';
import { db } from '../../shared/db/knex.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { config } from '../../config/index.js';
import { toZonedDateString } from './fees.billing.js';

export const feesService = {
  // Fee Structures
  async createOrUpdateFeeStructure({ sessionId, classId, heads, effectiveFrom, userId }) {
    if (!classId) {
      throw new AppError('Class ID is required', 422, ErrorCodes.VALIDATION_ERROR);
    }
    let finalClassId = Number(classId);
    const cls = await db('classes').where({ id: finalClassId }).orWhere({ grade_level: finalClassId }).first();
    if (cls) finalClassId = cls.id;

    return await feesRepository.createOrUpdateFeeStructure({
      sessionId: Number(sessionId || 1),
      classId: finalClassId,
      heads,
      effectiveFrom,
      userId
    });
  },

  async getFeeStructures(filters) {
    return await feesRepository.getFeeStructures(filters);
  },

  async getStudentFeeStructure(studentId) {
    return await feesRepository.getStudentFeeStructure(studentId);
  },

  // Concessions
  async createConcession({ studentId, sessionId, concessionType, value, reason, approvedBy }) {
    if (!studentId) {
      throw new AppError('Student ID is required', 422, ErrorCodes.VALIDATION_ERROR);
    }
    if (!value || Number(value) <= 0) {
      throw new AppError('Concession value must be greater than zero', 422, ErrorCodes.VALIDATION_ERROR);
    }
    if (!reason || !reason.trim()) {
      throw new AppError('Reason for concession is required', 422, ErrorCodes.VALIDATION_ERROR);
    }

    const id = await feesRepository.createConcession({
      studentId: Number(studentId),
      sessionId: Number(sessionId || 1),
      concessionType: concessionType || 'PERCENTAGE',
      value: Number(value),
      reason,
      approvedBy
    });

    const list = await feesRepository.getConcessions({ studentId });
    return list.find((c) => c.id === id) || { id };
  },

  async getConcessions(filters) {
    return await feesRepository.getConcessions(filters);
  },

  async revokeConcession(id) {
    return await feesRepository.revokeConcession(Number(id));
  },

  // Monthly Challans
  async generateMonthlyChallans({
    sessionId,
    classId,
    billingMonth,
    issueDate,
    dueDate,
    validUntil,
    gracePeriodDays,
    lateFeeAmount
  }) {
    if (!billingMonth || !billingMonth.trim()) {
      throw new AppError('Billing month is required (e.g. "April 2026")', 422, ErrorCodes.VALIDATION_ERROR);
    }

    return await feesRepository.generateMonthlyChallans({
      sessionId: Number(sessionId || 1),
      classId: classId ? Number(classId) : null,
      billingMonth,
      issueDate,
      dueDate,
      validUntil,
      gracePeriodDays,
      lateFeeAmount
    });
  },

  async getChallans(filters) {
    return await feesRepository.getChallans(filters);
  },

  async getChallanById(id) {
    const challan = await feesRepository.findChallanById(id);
    if (!challan) {
      throw new AppError('Challan not found', 404, ErrorCodes.NOT_FOUND);
    }
    return challan;
  },

  async getChallanByConsumerNo(consumerNumber) {
    const challan = await feesRepository.findChallanByConsumerNo(consumerNumber);
    if (!challan) {
      throw new AppError('Challan not found for consumer number', 404, ErrorCodes.NOT_FOUND);
    }
    return challan;
  },

  // Payment Proofs & Review
  async submitPaymentProof({
    challanId,
    studentId,
    parentId,
    submittedAmount,
    bankOrWallet,
    transactionReference,
    paymentDate,
    proofDocumentUrl
  }) {
    const challan = await feesRepository.findChallanById(challanId);
    if (!challan) {
      throw new AppError('Challan not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (!transactionReference || !transactionReference.trim()) {
      throw new AppError('Transaction reference is required', 422, ErrorCodes.VALIDATION_ERROR);
    }

    if (!submittedAmount || Number(submittedAmount) <= 0) {
      throw new AppError('Submitted amount must be greater than zero', 422, ErrorCodes.VALIDATION_ERROR);
    }

    const result = await feesRepository.submitPaymentProof({
      challanId: Number(challanId),
      studentId: Number(studentId || challan.studentId),
      parentId: parentId ? Number(parentId) : null,
      submittedAmount: Number(submittedAmount),
      bankOrWallet: bankOrWallet || 'Online Banking',
      transactionReference,
      paymentDate,
      proofDocumentUrl
    });

    if (result && result.duplicate) {
      throw new AppError(
        'Transaction reference has already been submitted for verification.',
        409,
        ErrorCodes.DUPLICATE_TXN_REF
      );
    }

    return result;
  },

  async getPaymentProofs(filters) {
    return await feesRepository.getPaymentProofs(filters);
  },

  async reviewPaymentProof({ proofId, status, reviewDecisionNote, verifiedAmount, reviewedByUserId }) {
    const proof = await feesRepository.findPaymentProofById(proofId);
    if (!proof) {
      throw new AppError('Payment proof not found', 404, ErrorCodes.NOT_FOUND);
    }

    const upperStatus = status.toUpperCase();
    if (!['APPROVED', 'REJECTED', 'RESUBMIT_REQUESTED'].includes(upperStatus)) {
      throw new AppError('Invalid review status', 422, ErrorCodes.VALIDATION_ERROR);
    }

    const reviewed = await feesRepository.reviewPaymentProof({
      proofId: Number(proofId),
      status: upperStatus,
      reviewDecisionNote,
      verifiedAmount,
      reviewedByUserId
    });

    return reviewed;
  },

  async getFeeStats(filters) {
    return await feesRepository.getFeeStats(filters);
  },

  async getRestrictedStudents() {
    return await feesRepository.getRestrictedStudents();
  },

  // Principal manual access restoration. No payment receipt/verification step:
  // the Principal's explicit action is the authorisation. Invoice status is not changed.
  async restoreStudentAccess({ studentId, actor, ipAddress }) {
    if (!Number.isInteger(studentId) || studentId <= 0) {
      throw new AppError('Invalid student ID', 422, ErrorCodes.VALIDATION_ERROR);
    }
    const student = await feesRepository.findStudentForRestore(studentId);
    if (!student) {
      throw new AppError('Student not found', 404, ErrorCodes.NOT_FOUND);
    }
    if (student.userStatus !== 'SUSPENDED' || student.openRestrictions === 0) {
      throw new AppError('Student portal is not currently restricted for overdue fees', 409, ErrorCodes.INVALID_STATE);
    }
    const result = await feesRepository.restoreStudentAccess({
      studentId,
      userId: student.userId,
      actor,
      ipAddress,
      schoolToday: toZonedDateString(new Date(), config.SCHOOL_TIMEZONE)
    });
    if (!result) {
      throw new AppError('Student portal is not currently restricted for overdue fees', 409, ErrorCodes.INVALID_STATE);
    }
    return { ...result, studentName: student.name };
  }
};
