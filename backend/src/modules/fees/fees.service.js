import { feesRepository } from './fees.repository.js';
import { db } from '../../shared/db/knex.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { config } from '../../config/index.js';
import { toZonedDateString } from './fees.billing.js';
import { CONCESSION_TYPES, CONCESSION_COMPONENTS, PERCENT_CONCESSION_TYPES } from './fees.concessions.js';
import { getCurrentSessionId } from '../../shared/services/accessScope.js';

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
  /**
   * Validates concession terms and resolves the academic scope.
   * The scope is always ONE session (never carried into the next year automatically);
   * optionally narrowed to a term or an explicit date window inside that session.
   */
  async _resolveConcessionTerms({ studentId, sessionId, termId, concessionType, value, effectiveStartDate, effectiveEndDate, feeComponent }) {
    const type = String(concessionType || 'PERCENTAGE').toUpperCase().replace(/\s+/g, '_');
    if (!CONCESSION_TYPES.includes(type)) {
      throw new AppError(`Concession type must be one of: ${CONCESSION_TYPES.join(', ')}`, 422, ErrorCodes.VALIDATION_ERROR);
    }
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      throw new AppError('Concession value must be greater than zero', 422, ErrorCodes.VALIDATION_ERROR);
    }
    if (PERCENT_CONCESSION_TYPES.includes(type) && numericValue > 100) {
      throw new AppError('A percentage concession cannot exceed 100%', 422, ErrorCodes.VALIDATION_ERROR);
    }

    const component = feeComponent ? String(feeComponent).toUpperCase() : null;
    if (component && !CONCESSION_COMPONENTS[component]) {
      throw new AppError(`Fee component must be one of: ${Object.keys(CONCESSION_COMPONENTS).join(', ')}`, 422, ErrorCodes.VALIDATION_ERROR);
    }

    const resolvedSessionId = sessionId ? Number(sessionId) : await getCurrentSessionId();
    const session = resolvedSessionId ? await db('academic_sessions').where({ id: resolvedSessionId }).first() : null;
    if (!session) throw new AppError('Academic session not found', 404, ErrorCodes.NOT_FOUND);

    let startDate = effectiveStartDate || null;
    let endDate = effectiveEndDate || null;
    let resolvedTermId = termId ? Number(termId) : null;
    if (resolvedTermId) {
      const term = await db('academic_terms').where({ id: resolvedTermId, session_id: session.id }).first();
      if (!term) throw new AppError('The selected term does not belong to this academic session', 422, ErrorCodes.VALIDATION_ERROR);
      startDate = startDate || String(term.start_date).slice(0, 10);
      endDate = endDate || String(term.end_date).slice(0, 10);
    }
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if ((startDate && !dateRe.test(startDate)) || (endDate && !dateRe.test(endDate))) {
      throw new AppError('Effective dates must be YYYY-MM-DD', 422, ErrorCodes.VALIDATION_ERROR);
    }
    if (startDate && endDate && startDate > endDate) {
      throw new AppError('Effective start date cannot be after the end date', 422, ErrorCodes.VALIDATION_ERROR);
    }
    const sessionStart = session.start_date ? String(session.start_date).slice(0, 10) : null;
    const sessionEnd = session.end_date ? String(session.end_date).slice(0, 10) : null;
    if ((startDate && sessionEnd && startDate > sessionEnd) || (endDate && sessionStart && endDate < sessionStart)) {
      throw new AppError(`The validity period must fall within the ${session.name} academic session`, 422, ErrorCodes.VALIDATION_ERROR);
    }

    const student = await db('students').where({ id: Number(studentId) }).first();
    if (!student) throw new AppError('Student not found', 404, ErrorCodes.NOT_FOUND);

    return {
      studentId: student.id,
      sessionId: session.id,
      termId: resolvedTermId,
      concessionType: type,
      value: numericValue,
      feeComponent: component,
      effectiveStartDate: startDate,
      effectiveEndDate: endDate
    };
  },

  async createConcession({ studentId, sessionId, termId, concessionType, value, reason, approvedBy, effectiveStartDate, effectiveEndDate, feeComponent, adminNotes }) {
    if (!studentId) {
      throw new AppError('Student ID is required', 422, ErrorCodes.VALIDATION_ERROR);
    }
    if (!reason || !String(reason).trim()) {
      throw new AppError('Reason for concession is required', 422, ErrorCodes.VALIDATION_ERROR);
    }

    const terms = await this._resolveConcessionTerms({
      studentId, sessionId, termId, concessionType, value, effectiveStartDate, effectiveEndDate, feeComponent
    });

    // One active concession per student / session / fee head / period: prevents double discounts
    const overlapping = await feesRepository.findOverlappingConcessions({
      studentId: terms.studentId,
      sessionId: terms.sessionId,
      feeComponent: terms.feeComponent,
      startDate: terms.effectiveStartDate,
      endDate: terms.effectiveEndDate
    });
    if (overlapping.length > 0) {
      throw new AppError(
        `This student already has an active ${terms.feeComponent ? `${terms.feeComponent.toLowerCase()} ` : ''}concession (#${overlapping.map((o) => o.id).join(', #')}) for an overlapping period. Edit or revoke it instead of adding a duplicate.`,
        409,
        ErrorCodes.CONFLICT
      );
    }

    const id = await feesRepository.createConcession({
      ...terms,
      reason: String(reason).trim().slice(0, 255),
      approvedBy,
      adminNotes: adminNotes || null
    });

    const list = await feesRepository.getConcessions({ studentId: terms.studentId });
    return list.find((c) => c.id === id) || { id };
  },

  /** Changes apply to challans generated afterwards; existing challans are never recalculated. */
  async updateConcession(id, input, actorId) {
    const existing = await feesRepository.getConcessionById(Number(id));
    if (!existing) throw new AppError('Concession not found', 404, ErrorCodes.NOT_FOUND);
    if (existing.status !== 'ACTIVE') {
      throw new AppError('Only active concessions can be edited. Create a new concession (renewal) instead.', 409, ErrorCodes.CONFLICT);
    }

    const pick = (key, column) => (input[key] !== undefined ? input[key] : existing[column]);
    const dateOrNull = (v) => (v ? String(v).slice(0, 10) : null);
    const terms = await this._resolveConcessionTerms({
      studentId: existing.student_id,
      sessionId: existing.session_id,
      termId: input.termId !== undefined ? input.termId : existing.term_id,
      concessionType: pick('concessionType', 'concession_type'),
      value: pick('value', 'value'),
      effectiveStartDate: input.effectiveStartDate !== undefined ? input.effectiveStartDate || null : dateOrNull(existing.effective_start_date),
      effectiveEndDate: input.effectiveEndDate !== undefined ? input.effectiveEndDate || null : dateOrNull(existing.effective_end_date),
      feeComponent: input.feeComponent !== undefined ? input.feeComponent || null : existing.fee_component
    });

    const overlapping = await feesRepository.findOverlappingConcessions({
      studentId: terms.studentId,
      sessionId: terms.sessionId,
      feeComponent: terms.feeComponent,
      startDate: terms.effectiveStartDate,
      endDate: terms.effectiveEndDate,
      excludeId: existing.id
    });
    if (overlapping.length > 0) {
      throw new AppError('The updated period overlaps another active concession for the same fee head.', 409, ErrorCodes.CONFLICT);
    }

    const updates = {
      concession_type: terms.concessionType,
      value: terms.value,
      fee_component: terms.feeComponent,
      effective_start_date: terms.effectiveStartDate,
      effective_end_date: terms.effectiveEndDate
    };
    if (await db.schema.hasColumn('student_concessions', 'term_id')) updates.term_id = terms.termId;
    if (input.reason !== undefined) {
      if (!String(input.reason).trim()) throw new AppError('Reason cannot be empty', 422, ErrorCodes.VALIDATION_ERROR);
      updates.reason = String(input.reason).trim().slice(0, 255);
    }
    if (input.adminNotes !== undefined) updates.admin_notes = input.adminNotes || null;

    await feesRepository.updateConcession(existing.id, updates, actorId, input.changeReason);
    const list = await feesRepository.getConcessions({ studentId: existing.student_id });
    return list.find((c) => c.id === existing.id) || { id: existing.id };
  },

  async getConcessions(filters) {
    return await feesRepository.getConcessions(filters);
  },

  async revokeConcession(id, { actorId = null, reason = null } = {}) {
    const existing = await feesRepository.getConcessionById(Number(id));
    if (!existing) throw new AppError('Concession not found', 404, ErrorCodes.NOT_FOUND);
    if (existing.status !== 'ACTIVE') throw new AppError('This concession is already revoked', 409, ErrorCodes.CONFLICT);
    return await feesRepository.revokeConcession(Number(id), { actorId, reason });
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

  // Principal manual portal block for a specific unpaid challan — the same
  // restriction the fee scheduler applies after the grace period, but applied
  // on demand. Reversible from Restricted Students, and lifted automatically
  // once the invoice settles.
  async blockStudentAccess({ challanId, actor }) {
    if (!Number.isInteger(challanId) || challanId <= 0) {
      throw new AppError('Invalid challan ID', 422, ErrorCodes.VALIDATION_ERROR);
    }
    const result = await feesRepository.applyManualFeeRestriction({ challanId, actor });
    switch (result.outcome) {
      case 'RESTRICTED':
        return { blocked: true, studentName: result.studentName };
      case 'ALREADY_BLOCKED':
        throw new AppError('This student\'s portal is already blocked for overdue fees.', 409, ErrorCodes.INVALID_STATE);
      case 'SETTLED':
        throw new AppError('This challan has no outstanding balance, so there is nothing to block.', 409, ErrorCodes.INVALID_STATE);
      case 'NON_FEE_SUSPENSION':
        throw new AppError('This student\'s account is suspended for a non-fee reason and cannot be fee-blocked.', 409, ErrorCodes.INVALID_STATE);
      default:
        throw new AppError('Challan or student not found', 404, ErrorCodes.NOT_FOUND);
    }
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
