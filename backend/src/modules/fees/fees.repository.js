import { db } from '../../shared/db/knex.js';
import {
  normalizeBillingMonth,
  isSameBillingMonth,
  getBillingPeriod,
  addDays,
  GRACE_PERIOD_DAYS
} from './fees.billing.js';

export const feesRepository = {
  // 1. Fee Structures
  async createOrUpdateFeeStructure({ sessionId, classId, heads = [], effectiveFrom, userId }) {
    return await db.transaction(async (trx) => {
      // Calculate total monthly recurring
      let totalRecurring = 0;
      for (const h of heads) {
        if (h.isRecurring !== false) {
          totalRecurring += Number(h.amount || 0);
        }
      }

      const existing = await trx('fee_structures')
        .where({ session_id: sessionId, class_id: classId })
        .first();

      let structureId;
      if (existing) {
        structureId = existing.id;
        await trx('fee_structures')
          .where({ id: structureId })
          .update({
            total_monthly_recurring: totalRecurring,
            effective_from: effectiveFrom || existing.effective_from,
            status: 'ACTIVE',
            updated_at: trx.fn.now(3)
          });
        // Clear old heads
        await trx('fee_structure_heads').where({ fee_structure_id: structureId }).del();
      } else {
        const [newId] = await trx('fee_structures').insert({
          session_id: sessionId,
          class_id: classId,
          total_monthly_recurring: totalRecurring,
          effective_from: effectiveFrom || new Date().toISOString().split('T')[0],
          status: 'ACTIVE',
          created_by: userId
        });
        structureId = newId;
      }

      // Insert heads
      if (heads.length > 0) {
        const headRows = heads.map((h) => ({
          fee_structure_id: structureId,
          head_type: (h.head || h.headType || 'TUITION').toUpperCase(),
          amount: Number(h.amount || 0),
          is_recurring: h.isRecurring !== false ? 1 : 0,
          description: h.description || null
        }));
        await trx('fee_structure_heads').insert(headRows);
      }

      return await this.findFeeStructureById(structureId, trx);
    });
  },

  async findFeeStructureById(id, trx = db) {
    const structure = await trx('fee_structures')
      .join('classes', 'fee_structures.class_id', 'classes.id')
      .join('academic_sessions', 'fee_structures.session_id', 'academic_sessions.id')
      .where('fee_structures.id', id)
      .select(
        'fee_structures.id',
        'fee_structures.session_id as sessionId',
        'academic_sessions.name as academicSession',
        'fee_structures.class_id as classId',
        'classes.grade_level as classNumber',
        'classes.name as className',
        'fee_structures.total_monthly_recurring as totalMonthlyRecurring',
        'fee_structures.effective_from as effectiveFrom',
        'fee_structures.status'
      )
      .first();

    if (!structure) return null;

    const heads = await trx('fee_structure_heads')
      .where({ fee_structure_id: id })
      .select('id', 'head_type as head', 'amount', 'is_recurring as isRecurring', 'description');

    return {
      ...structure,
      totalMonthlyRecurring: Number(structure.totalMonthlyRecurring),
      heads: heads.map((h) => ({
        ...h,
        amount: Number(h.amount),
        isRecurring: Boolean(h.isRecurring)
      }))
    };
  },

  async getFeeStructures({ sessionId = null, classId = null } = {}) {
    let query = db('fee_structures')
      .join('classes', 'fee_structures.class_id', 'classes.id')
      .join('academic_sessions', 'fee_structures.session_id', 'academic_sessions.id')
      .select(
        'fee_structures.id',
        'fee_structures.session_id as sessionId',
        'academic_sessions.name as academicSession',
        'fee_structures.class_id as classId',
        'classes.grade_level as classNumber',
        'classes.name as className',
        'fee_structures.total_monthly_recurring as totalMonthlyRecurring',
        'fee_structures.effective_from as effectiveFrom',
        'fee_structures.status'
      )
      .orderBy('classes.grade_level', 'asc');

    if (sessionId) query = query.where('fee_structures.session_id', sessionId);
    if (classId) query = query.where('fee_structures.class_id', classId);

    const rows = await query;
    return await Promise.all(
      rows.map(async (row) => {
        const heads = await db('fee_structure_heads')
          .where({ fee_structure_id: row.id })
          .select('id', 'head_type as head', 'amount', 'is_recurring as isRecurring', 'description');
        return {
          ...row,
          totalMonthlyRecurring: Number(row.totalMonthlyRecurring),
          heads: heads.map((h) => ({
            ...h,
            amount: Number(h.amount),
            isRecurring: Boolean(h.isRecurring)
          }))
        };
      })
    );
  },

  async getStudentFeeStructure(studentId) {
    const student = await db('students')
      .join('classes', 'students.current_class_id', 'classes.id')
      .join('users', 'students.user_id', 'users.id')
      .where('students.id', studentId)
      .select(
        'students.id',
        'users.full_name as studentName',
        'students.admission_no as admissionNo',
        'students.roll_no as rollNo',
        'students.current_class_id as classId',
        'classes.grade_level as classNumber',
        'classes.name as className'
      )
      .first();

    if (!student) return null;

    const structure = await db('fee_structures')
      .join('academic_sessions', 'fee_structures.session_id', 'academic_sessions.id')
      .where({ 'fee_structures.class_id': student.classId, 'fee_structures.status': 'ACTIVE' })
      .select(
        'fee_structures.id',
        'fee_structures.session_id as sessionId',
        'academic_sessions.name as academicSession',
        'fee_structures.class_id as classId',
        'fee_structures.total_monthly_recurring as totalMonthlyRecurring',
        'fee_structures.effective_from as effectiveFrom',
        'fee_structures.status'
      )
      .first();

    let heads = [];
    if (structure) {
      heads = await db('fee_structure_heads')
        .where({ fee_structure_id: structure.id })
        .select('id', 'head_type as head', 'amount', 'is_recurring as isRecurring', 'description');
    }

    const concessions = await db('student_concessions')
      .where({ student_id: student.id, status: 'ACTIVE' })
      .select('id', 'concession_type as concessionType', 'value', 'reason', 'created_at as createdAt');

    let totalRecurring = structure ? Number(structure.totalMonthlyRecurring) : 0;
    let concessionDiscount = 0;
    for (const c of concessions) {
      if (c.concessionType === 'PERCENTAGE') {
        concessionDiscount += (totalRecurring * Number(c.value)) / 100;
      } else {
        concessionDiscount += Number(c.value);
      }
    }
    const netMonthlyRecurring = Math.max(0, totalRecurring - concessionDiscount);

    return {
      student,
      structure: structure
        ? {
            ...structure,
            totalMonthlyRecurring: Number(structure.totalMonthlyRecurring),
            heads: heads.map((h) => ({
              ...h,
              amount: Number(h.amount),
              isRecurring: Boolean(h.isRecurring)
            }))
          }
        : null,
      concessions: concessions.map((c) => ({
        ...c,
        value: Number(c.value)
      })),
      discountAmount: concessionDiscount,
      netMonthlyRecurring
    };
  },

  // 2. Student Concessions
  async createConcession({ studentId, sessionId, concessionType, value, reason, approvedBy }) {
    const [id] = await db('student_concessions').insert({
      student_id: studentId,
      session_id: sessionId,
      concession_type: concessionType.toUpperCase(),
      value: Number(value),
      reason,
      approved_by: approvedBy,
      status: 'ACTIVE'
    });
    return id;
  },

  async getConcessions({ studentId = null, sessionId = null, status = null } = {}) {
    let query = db('student_concessions')
      .join('students', 'student_concessions.student_id', 'students.id')
      .join('users as student_users', 'students.user_id', 'student_users.id')
      .join('classes', 'students.current_class_id', 'classes.id')
      .join('academic_sessions', 'student_concessions.session_id', 'academic_sessions.id')
      .join('users as approver_users', 'student_concessions.approved_by', 'approver_users.id')
      .select(
        'student_concessions.id',
        'student_concessions.student_id as studentId',
        'student_users.full_name as studentName',
        'students.roll_no as rollNumber',
        'students.admission_no as admissionNumber',
        'classes.grade_level as classNumber',
        'academic_sessions.name as effectiveSession',
        'student_concessions.concession_type as concessionType',
        'student_concessions.value',
        'student_concessions.reason',
        'approver_users.full_name as approvedBy',
        'student_concessions.status',
        'student_concessions.created_at as createdAt'
      )
      .orderBy('student_concessions.created_at', 'desc');

    if (studentId) query = query.where('student_concessions.student_id', studentId);
    if (sessionId) query = query.where('student_concessions.session_id', sessionId);
    if (status) query = query.where('student_concessions.status', status);

    const rows = await query;
    return rows.map((r) => ({ ...r, value: Number(r.value) }));
  },

  async revokeConcession(id) {
    return await db('student_concessions').where({ id }).update({ status: 'REVOKED' });
  },

  // 3. Monthly Fee Challans
  async generateMonthlyChallans({
    sessionId,
    classId = null,
    billingMonth,
    issueDate,
    dueDate,
    validUntil,
    gracePeriodDays = 5,
    lateFeeAmount = 500
  }) {
    let studentsQuery = db('students')
      .where('students.status', 'ACTIVE');

    if (classId) {
      studentsQuery = studentsQuery.where('students.current_class_id', classId);
    }

    const students = await studentsQuery;
    const generatedChallans = [];
    let createdCount = 0;

    // Clean month string (e.g. "April 2026" or "2026-04")
    const cleanMonth = billingMonth;
    const periodKey = normalizeBillingMonth(cleanMonth);
    const policyPeriod = periodKey ? getBillingPeriod(Number(periodKey.slice(0, 4)), Number(periodKey.slice(5, 7))) : null;
    const effectiveDueDate = dueDate || policyPeriod?.dueDate || null;
    const effectiveValidUntil =
      validUntil || (effectiveDueDate ? addDays(effectiveDueDate, gracePeriodDays ?? GRACE_PERIOD_DAYS) : null);

    for (const student of students) {
      // Check if challan already exists for this student, month, session.
      // Month labels are compared in normalised form so "2026-11" and
      // "November 2026" are recognised as the same billing period.
      const sessionChallans = await db('fee_challans')
        .where({ student_id: student.id, session_id: sessionId })
        .select('id', 'billing_month');
      const existing = sessionChallans.find((c) => isSameBillingMonth(c.billing_month, cleanMonth));

      if (existing) {
        generatedChallans.push(existing.id);
        continue;
      }

      // Find fee structure for student's current class
      const feeStruct = await db('fee_structures')
        .where({ class_id: student.current_class_id, session_id: sessionId, status: 'ACTIVE' })
        .first();

      let tuitionAmount = 5000;
      let technologyAmount = 500;
      let examinationAmount = 0;
      let booksAmount = 0;
      let admissionAmount = 0;
      let otherAmount = 0;

      if (feeStruct) {
        const heads = await db('fee_structure_heads').where({ fee_structure_id: feeStruct.id });
        tuitionAmount = Number(heads.find((h) => h.head_type === 'TUITION')?.amount || 0);
        technologyAmount = Number(heads.find((h) => h.head_type === 'TECHNOLOGY')?.amount || 0);
        examinationAmount = Number(heads.find((h) => h.head_type === 'EXAMINATION')?.amount || 0);
        booksAmount = Number(heads.find((h) => h.head_type === 'BOOKS')?.amount || 0);
        admissionAmount = Number(heads.find((h) => h.head_type === 'ADMISSION')?.amount || 0);
        otherAmount = Number(heads.find((h) => h.head_type === 'OTHER')?.amount || 0);
      }

      const grossAmount =
        tuitionAmount + technologyAmount + examinationAmount + booksAmount + admissionAmount + otherAmount;

      // Check active concessions
      const activeConcession = await db('student_concessions')
        .where({ student_id: student.id, session_id: sessionId, status: 'ACTIVE' })
        .first();

      let concessionAmount = 0;
      if (activeConcession) {
        const val = Number(activeConcession.value);
        if (activeConcession.concession_type === 'PERCENTAGE' || activeConcession.concession_type === 'SIBLING_DISCOUNT') {
          concessionAmount = Number(((grossAmount * val) / 100).toFixed(2));
        } else {
          concessionAmount = Math.min(val, grossAmount);
        }
      }

      // Check past unpaid arrears
      const pastUnpaid = (
        await db('fee_challans')
          .where('student_id', student.id)
          .where('status', '!=', 'PAID')
      ).filter((p) => !isSameBillingMonth(p.billing_month, cleanMonth));

      let arrearsAmount = 0;
      for (const p of pastUnpaid) {
        arrearsAmount += Number(p.total_payable) - Number(p.paid_amount);
      }

      const totalPayable = grossAmount - concessionAmount + arrearsAmount;

      // Generate 10-digit 1Link Consumer Number:
      // Prefix 10 + 2-digit Year + 2-digit Month (of the billing period) + 4-digit Student Sequence = 10 digits
      const issue = issueDate || policyPeriod?.issueDate || new Date().toISOString().split('T')[0];
      const [yyyy, mm] = (periodKey || issue.slice(0, 7)).split('-');
      const studentSeq = String(student.id).padStart(4, '0').slice(-4);
      const { consumerNumber, challanNumber } = await this._uniqueChallanNumbers(yyyy, mm, studentSeq);

      const row = {
        challan_number: challanNumber,
        consumer_number: consumerNumber,
        session_id: sessionId,
        class_id: student.current_class_id,
        student_id: student.id,
        billing_month: cleanMonth,
        issue_date: issue,
        due_date: effectiveDueDate || new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        valid_until: effectiveValidUntil || new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        grace_period_days: gracePeriodDays,
        tuition_amount: tuitionAmount,
        technology_amount: technologyAmount,
        examination_amount: examinationAmount,
        books_amount: booksAmount,
        admission_amount: admissionAmount,
        other_amount: otherAmount,
        gross_amount: grossAmount,
        concession_amount: concessionAmount,
        arrears_amount: arrearsAmount,
        late_fee_amount: lateFeeAmount,
        total_payable: totalPayable,
        paid_amount: 0.00,
        status: 'UNPAID'
      };

      try {
        const [cId] = await db('fee_challans').insert(row);
        generatedChallans.push(cId);
        createdCount += 1;
      } catch (err) {
        // A concurrent run (scheduler + manual request) already created it
        if (err.code === 'ER_DUP_ENTRY') continue;
        throw err;
      }
    }

    return {
      message: `Generated ${generatedChallans.length} fee challans for ${cleanMonth}`,
      count: generatedChallans.length,
      createdCount
    };
  },

  async _uniqueChallanNumbers(yyyy, mm, studentSeq) {
    // Second digit of the prefix is bumped only if a legacy row already occupies the number
    for (let variant = 0; variant < 10; variant++) {
      const consumerNumber = `1${variant}${yyyy.slice(-2)}${mm}${studentSeq}`;
      const challanNumber = `CH-${yyyy}-${mm}-${studentSeq}${variant ? `-${variant}` : ''}`;
      const clash = await db('fee_challans')
        .where({ consumer_number: consumerNumber })
        .orWhere({ challan_number: challanNumber })
        .first();
      if (!clash) return { consumerNumber, challanNumber };
    }
    throw new Error(`Unable to allocate a unique consumer number for ${yyyy}-${mm}-${studentSeq}`);
  },

  async getChallans({ classId = null, studentId = null, billingMonth = null, status = null, search = null } = {}) {
    let query = db('fee_challans')
      .join('classes', 'fee_challans.class_id', 'classes.id')
      .join('students', 'fee_challans.student_id', 'students.id')
      .join('users as student_users', 'students.user_id', 'student_users.id')
      .join('academic_sessions', 'fee_challans.session_id', 'academic_sessions.id')
      .select(
        'fee_challans.id',
        'fee_challans.challan_number as challanNumber',
        'fee_challans.consumer_number as consumerNumber',
        'fee_challans.student_id as studentId',
        'student_users.full_name as studentName',
        'students.roll_no as rollNumber',
        'students.admission_no as admissionNumber',
        'classes.grade_level as classNumber',
        'classes.name as className',
        'fee_challans.billing_month as billingMonth',
        'academic_sessions.name as academicSession',
        'fee_challans.issue_date as generationDate',
        'fee_challans.due_date as dueDate',
        'fee_challans.valid_until as validUntil',
        'fee_challans.grace_period_days as gracePeriodDays',
        'fee_challans.tuition_amount as tuitionFee',
        'fee_challans.technology_amount as technologyFee',
        'fee_challans.examination_amount as examinationFee',
        'fee_challans.books_amount as booksFee',
        'fee_challans.admission_amount as admissionFee',
        'fee_challans.other_amount as otherFee',
        'fee_challans.gross_amount as grossAmount',
        'fee_challans.concession_amount as concessionAmount',
        'fee_challans.arrears_amount as arrearsAmount',
        'fee_challans.late_fee_amount as lateFeeAmount',
        'fee_challans.total_payable as totalPayable',
        'fee_challans.paid_amount as paidAmount',
        'fee_challans.status',
        'fee_challans.reminders_sent_count as remindersSentCount',
        'fee_challans.last_reminder_at as lastReminderDate'
      )
      .orderBy('fee_challans.created_at', 'desc');

    if (classId) query = query.where('fee_challans.class_id', classId);
    if (studentId) query = query.where('fee_challans.student_id', studentId);
    if (billingMonth) query = query.where('fee_challans.billing_month', billingMonth);
    if (status) query = query.where('fee_challans.status', status);
    if (search) {
      query = query.where((q) => {
        q.where('fee_challans.challan_number', 'like', `%${search}%`)
          .orWhere('fee_challans.consumer_number', 'like', `%${search}%`)
          .orWhere('student_users.full_name', 'like', `%${search}%`);
      });
    }

    const rows = await query;
    return rows.map((r) => ({
      ...r,
      paidAmount: Number(r.paidAmount),
      totalPayable: Number(r.totalPayable),
      outstandingBalance: Number(r.totalPayable) - Number(r.paidAmount),
      breakdown: {
        tuitionFee: Number(r.tuitionFee),
        technologyFee: Number(r.technologyFee),
        examinationFee: Number(r.examinationFee),
        booksFee: Number(r.booksFee),
        admissionFee: Number(r.admissionFee),
        otherFee: Number(r.otherFee),
        grossAmount: Number(r.grossAmount),
        concessionAmount: Number(r.concessionAmount),
        arrearsAmount: Number(r.arrearsAmount),
        lateFeeAmount: Number(r.lateFeeAmount),
        totalPayable: Number(r.totalPayable)
      }
    }));
  },

  async findChallanById(id) {
    const list = await this.getChallans();
    return list.find((c) => c.id == id) || null;
  },

  async findChallanByConsumerNo(consumerNumber) {
    const list = await this.getChallans();
    return list.find((c) => c.consumerNumber === consumerNumber) || null;
  },

  // 4. Payment Proof Submissions & Review
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
    // 1. Check duplicate transaction reference per SRS Section 11.4
    const duplicate = await db('fee_payment_proofs')
      .where({ transaction_reference: transactionReference })
      .first();

    if (duplicate) {
      return { duplicate: true };
    }

    const [id] = await db('fee_payment_proofs').insert({
      challan_id: challanId,
      student_id: studentId,
      parent_id: parentId || null,
      submitted_amount: Number(submittedAmount),
      bank_or_wallet: bankOrWallet,
      transaction_reference: transactionReference,
      payment_date: paymentDate || new Date().toISOString().split('T')[0],
      proof_document_url: proofDocumentUrl || null,
      status: 'PENDING'
    });

    // Update challan status to PENDING_VERIFICATION
    await db('fee_challans').where({ id: challanId }).update({
      status: 'PENDING_VERIFICATION'
    });

    return await this.findPaymentProofById(id);
  },

  async getPaymentProofs({ status = null, challanId = null, studentId = null } = {}, trx = db) {
    let query = trx('fee_payment_proofs')
      .join('fee_challans', 'fee_payment_proofs.challan_id', 'fee_challans.id')
      .join('students', 'fee_payment_proofs.student_id', 'students.id')
      .join('users as student_users', 'students.user_id', 'student_users.id')
      .join('classes', 'fee_challans.class_id', 'classes.id')
      .leftJoin('parents', 'fee_payment_proofs.parent_id', 'parents.id')
      .leftJoin('users as parent_users', 'parents.user_id', 'parent_users.id')
      .leftJoin('users as reviewer_users', 'fee_payment_proofs.reviewed_by', 'reviewer_users.id')
      .select(
        'fee_payment_proofs.id',
        'fee_payment_proofs.challan_id as challanId',
        'fee_challans.challan_number as challanNumber',
        'fee_payment_proofs.student_id as studentId',
        'student_users.full_name as studentName',
        'fee_payment_proofs.parent_id as parentId',
        'parent_users.full_name as parentName',
        'classes.grade_level as classNumber',
        'fee_payment_proofs.submitted_amount as submittedAmount',
        'fee_payment_proofs.bank_or_wallet as bankOrWallet',
        'fee_payment_proofs.transaction_reference as transactionReference',
        'fee_payment_proofs.payment_date as paymentDate',
        'fee_payment_proofs.proof_document_url as proofDocumentUrl',
        'fee_payment_proofs.created_at as submissionTimestamp',
        'fee_payment_proofs.status',
        'reviewer_users.full_name as reviewedBy',
        'fee_payment_proofs.reviewed_at as reviewTimestamp',
        'fee_payment_proofs.review_decision_note as reviewDecisionNote',
        'fee_payment_proofs.verified_amount as verifiedAmount',
        'fee_payment_proofs.receipt_number as receiptNumber'
      )
      .orderBy('fee_payment_proofs.created_at', 'desc');

    if (status) query = query.where('fee_payment_proofs.status', status);
    if (challanId) query = query.where('fee_payment_proofs.challan_id', challanId);
    if (studentId) query = query.where('fee_payment_proofs.student_id', studentId);

    const rows = await query;
    return rows.map((r) => ({
      ...r,
      submittedAmount: Number(r.submittedAmount),
      verifiedAmount: r.verifiedAmount ? Number(r.verifiedAmount) : null
    }));
  },

  async findPaymentProofById(id, trx = db) {
    const list = await this.getPaymentProofs({}, trx);
    return list.find((p) => p.id == id) || null;
  },

  async reviewPaymentProof({ proofId, status, reviewDecisionNote, verifiedAmount, reviewedByUserId }) {
    return await db.transaction(async (trx) => {
      const proof = await trx('fee_payment_proofs').where({ id: proofId }).first();
      if (!proof) return null;

      const challan = await trx('fee_challans').where({ id: proof.challan_id }).first();
      if (!challan) return null;

      const upperStatus = status.toUpperCase();
      let receiptNumber = null;
      let finalVerifiedAmount = Number(verifiedAmount || proof.submitted_amount);

      if (upperStatus === 'APPROVED') {
        receiptNumber = `REC-${Date.now().toString().slice(-6)}`;
        const newPaidAmount = Number(challan.paid_amount) + finalVerifiedAmount;
        const totalPayable = Number(challan.total_payable);

        const challanStatus = newPaidAmount >= totalPayable ? 'PAID' : 'PARTIALLY_PAID';

        await trx('fee_challans')
          .where({ id: challan.id })
          .update({
            paid_amount: newPaidAmount,
            status: challanStatus,
            updated_at: trx.fn.now(3)
          });
      } else if (upperStatus === 'REJECTED') {
        // If rejected and paid_amount is 0, revert to UNPAID
        if (Number(challan.paid_amount) === 0) {
          await trx('fee_challans')
            .where({ id: challan.id })
            .update({ status: 'UNPAID', updated_at: trx.fn.now(3) });
        }
      }

      await trx('fee_payment_proofs')
        .where({ id: proofId })
        .update({
          status: upperStatus,
          reviewed_by: reviewedByUserId,
          reviewed_at: trx.fn.now(3),
          review_decision_note: reviewDecisionNote || null,
          verified_amount: upperStatus === 'APPROVED' ? finalVerifiedAmount : null,
          receipt_number: receiptNumber
        });

      return await this.findPaymentProofById(proofId, trx);
    });
  },

  // 5. Fee-based portal restriction lifecycle
  //
  // A challan is "restrictable" when it still has an outstanding balance, is not
  // awaiting payment-proof verification, and its grace period (valid_until) ended
  // before today in the billing timezone. Each restrictable challan gets at most
  // one fee_restriction_events row; once resolved it never restricts again.

  _restrictableChallansQuery(schoolToday, trx = db) {
    return trx('fee_challans as fc')
      .whereIn('fc.status', ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'])
      .whereRaw('fc.total_payable - fc.paid_amount > 0')
      .where('fc.valid_until', '<', schoolToday);
  },

  async findRestrictionCandidates(schoolToday) {
    return await this._restrictableChallansQuery(schoolToday)
      .join('students as s', 'fc.student_id', 's.id')
      .leftJoin('fee_restriction_events as fre', 'fre.challan_id', 'fc.id')
      .whereNull('fre.id')
      .where('s.status', 'ACTIVE')
      .select(
        'fc.id as challanId',
        'fc.student_id as studentId',
        's.user_id as userId',
        'fc.session_id as sessionId',
        'fc.billing_month as billingMonth',
        'fc.valid_until as validUntil'
      )
      .orderBy(['fc.student_id', 'fc.id']);
  },

  /**
   * Restrict one student for the given overdue challans. Returns
   * 'RESTRICTED' | 'ATTACHED' (already fee-restricted; challans added) | 'SKIPPED'.
   */
  async applyFeeRestriction({ studentId, userId, challans, now = new Date() }) {
    return await db.transaction(async (trx) => {
      const user = await trx('users').where({ id: userId }).forUpdate().first();
      if (!user) return 'SKIPPED';

      const openEvent = await trx('fee_restriction_events')
        .where({ student_id: studentId })
        .whereNull('resolved_at')
        .first();

      let outcome;
      if (user.status === 'ACTIVE') {
        outcome = 'RESTRICTED';
      } else if (user.status === 'SUSPENDED' && openEvent) {
        outcome = 'ATTACHED';
      } else {
        // Suspended/deactivated for a non-fee reason: leave untouched
        return 'SKIPPED';
      }

      const months = [...new Set(challans.map((c) => c.billingMonth))].join(', ');
      const reason = `Fee overdue after grace period (${months})`;

      await trx('fee_restriction_events').insert(
        challans.map((c) => ({
          student_id: studentId,
          user_id: userId,
          challan_id: c.challanId,
          session_id: c.sessionId,
          billing_month: c.billingMonth,
          reason,
          restricted_at: now
        }))
      );

      if (outcome === 'RESTRICTED') {
        await trx('users').where({ id: userId }).update({ status: 'SUSPENDED' });
        await trx('account_status_history').insert({
          user_id: userId,
          old_status: 'ACTIVE',
          new_status: 'SUSPENDED',
          reason_code: 'FEE_OVERDUE',
          reason_text: `Automatic restriction: ${reason}. Challan IDs: ${challans.map((c) => c.challanId).join(', ')}.`,
          effective_from: now,
          changed_by: null // system action
        });
        await trx('audit_logs').insert({
          actor_id: null,
          actor_name: 'System (Fee Scheduler)',
          actor_role: 'System',
          action: 'RESTRICT_STUDENT_PORTAL_ACCESS',
          record_type: 'Student Account',
          record_identifier: String(studentId),
          reason,
          previous_value: 'ACTIVE',
          new_value: 'SUSPENDED'
        });
      }

      return outcome;
    });
  },

  /** Students with open restrictions whose restricting challans have all been settled. */
  async findSettledOpenRestrictions() {
    const rows = await db('fee_restriction_events as fre')
      .join('fee_challans as fc', 'fre.challan_id', 'fc.id')
      .whereNull('fre.resolved_at')
      .select(
        'fre.student_id as studentId',
        'fre.user_id as userId',
        'fc.status',
        db.raw('fc.total_payable - fc.paid_amount as outstanding')
      );

    const byStudent = new Map();
    for (const r of rows) {
      const entry = byStudent.get(r.studentId) || { studentId: r.studentId, userId: r.userId, settled: true };
      if (r.status !== 'PAID' && Number(r.outstanding) > 0) entry.settled = false;
      byStudent.set(r.studentId, entry);
    }
    return [...byStudent.values()].filter((e) => e.settled);
  },

  async liftSettledRestriction({ studentId, userId, now = new Date() }) {
    return await db.transaction(async (trx) => {
      const user = await trx('users').where({ id: userId }).forUpdate().first();
      const resolved = await trx('fee_restriction_events')
        .where({ student_id: studentId })
        .whereNull('resolved_at')
        .update({
          resolved_at: now,
          resolved_by: null,
          resolution: 'INVOICE_SETTLED',
          resolve_reason: 'All restricting invoices settled'
        });

      if (!resolved || !user || user.status !== 'SUSPENDED') return false;

      const lastChange = await trx('account_status_history')
        .where({ user_id: userId })
        .orderBy('id', 'desc')
        .first();
      if (lastChange?.reason_code !== 'FEE_OVERDUE') return false;

      await trx('users').where({ id: userId }).update({ status: 'ACTIVE' });
      await trx('account_status_history').insert({
        user_id: userId,
        old_status: 'SUSPENDED',
        new_status: 'ACTIVE',
        reason_code: 'FEE_SETTLED',
        reason_text: 'Automatic reactivation: all invoices that caused the fee restriction are settled.',
        effective_from: now,
        changed_by: null
      });
      return true;
    });
  },

  async getRestrictedStudents() {
    // Students whose account is SUSPENDED with at least one open fee restriction
    const rows = await db('fee_restriction_events as fre')
      .join('students', 'fre.student_id', 'students.id')
      .join('users', 'fre.user_id', 'users.id')
      .leftJoin('classes', 'students.current_class_id', 'classes.id')
      .whereNull('fre.resolved_at')
      .where('users.status', 'SUSPENDED')
      .select(
        'students.id as studentId',
        'users.full_name as studentName',
        'students.admission_no as admissionNo',
        'students.roll_no as rollNo',
        'classes.grade_level as classNumber',
        'classes.name as className',
        'fre.billing_month as billingMonth',
        'fre.reason',
        'fre.restricted_at as restrictedAt',
        'users.status as portalStatus'
      )
      .orderBy('fre.restricted_at', 'desc');

    const byStudent = new Map();
    for (const r of rows) {
      const entry = byStudent.get(r.studentId);
      if (!entry) {
        byStudent.set(r.studentId, { ...r, restrictedForMonths: [r.billingMonth] });
      } else {
        if (!entry.restrictedForMonths.includes(r.billingMonth)) entry.restrictedForMonths.push(r.billingMonth);
        if (r.restrictedAt < entry.restrictedAt) entry.restrictedAt = r.restrictedAt;
      }
    }

    return await Promise.all(
      [...byStudent.values()].map(async ({ billingMonth, ...r }) => ({
        ...r,
        ...(await this.getOutstandingSummary(r.studentId))
      }))
    );
  },

  /**
   * Outstanding invoices for a student. Because the challan generator rolls
   * unpaid balances into the next invoice as arrears, the latest unpaid
   * invoice's balance is reported as the amount due (summing every invoice
   * would double-count carried-forward arrears).
   */
  async getOutstandingSummary(studentId) {
    const challans = await db('fee_challans')
      .where('student_id', studentId)
      .whereNot('status', 'PAID')
      .whereRaw('total_payable - paid_amount > 0')
      .select('id', 'billing_month', 'due_date', 'valid_until', 'status', 'total_payable', 'paid_amount')
      .orderBy([{ column: 'issue_date', order: 'desc' }, { column: 'id', order: 'desc' }]);

    const outstandingInvoices = challans.map((c) => ({
      challanId: c.id,
      billingMonth: c.billing_month,
      dueDate: c.due_date,
      graceEndsOn: c.valid_until,
      status: c.status,
      outstanding: Number(c.total_payable) - Number(c.paid_amount)
    }));

    return {
      outstandingInvoices,
      outstandingAmount: outstandingInvoices[0]?.outstanding ?? 0
    };
  },

  /** Open fee restriction details for the student's own restricted dashboard. */
  async getStudentRestrictionSummary(studentId) {
    const open = await db('fee_restriction_events')
      .where({ student_id: studentId })
      .whereNull('resolved_at')
      .select('billing_month', 'restricted_at', 'reason')
      .orderBy('restricted_at', 'asc');
    if (!open.length) return null;

    return {
      restrictedAt: open[0].restricted_at,
      restrictedForMonths: [...new Set(open.map((o) => o.billing_month))],
      ...(await this.getOutstandingSummary(studentId))
    };
  },

  async findStudentForRestore(studentId) {
    const student = await db('students')
      .join('users', 'students.user_id', 'users.id')
      .where('students.id', studentId)
      .select('students.id', 'students.user_id as userId', 'users.status as userStatus', 'users.full_name as name')
      .first();
    if (!student) return null;

    const [{ openCount }] = await db('fee_restriction_events')
      .where({ student_id: studentId })
      .whereNull('resolved_at')
      .count('* as openCount');
    return { ...student, openRestrictions: Number(openCount) };
  },

  async restoreStudentAccess({ studentId, userId, actor, ipAddress, schoolToday, now = new Date() }) {
    return await db.transaction(async (trx) => {
      const user = await trx('users').where({ id: userId }).forUpdate().first();
      const openEvents = await trx('fee_restriction_events')
        .where({ student_id: studentId })
        .whereNull('resolved_at')
        .select('id', 'billing_month');

      // Re-checked under lock so concurrent clicks cannot double-restore
      if (!user || user.status !== 'SUSPENDED' || openEvents.length === 0) {
        return null;
      }

      const resolution = {
        resolved_at: now,
        resolved_by: actor.id,
        resolution: 'PRINCIPAL_MANUAL_RESTORE',
        resolve_reason: `Manual restore by ${actor.name}`
      };

      // 1. Resolve the open restriction events
      await trx('fee_restriction_events').whereIn('id', openEvents.map((e) => e.id)).update(resolution);

      // 2. Cover any other already-overdue challans with resolved events so the
      //    scheduler does not immediately re-restrict for the same overdue state.
      const uncovered = await this._restrictableChallansQuery(schoolToday, trx)
        .leftJoin('fee_restriction_events as fre', 'fre.challan_id', 'fc.id')
        .whereNull('fre.id')
        .where('fc.student_id', studentId)
        .select('fc.id', 'fc.session_id', 'fc.billing_month');
      if (uncovered.length) {
        await trx('fee_restriction_events').insert(
          uncovered.map((c) => ({
            student_id: studentId,
            user_id: userId,
            challan_id: c.id,
            session_id: c.session_id,
            billing_month: c.billing_month,
            reason: 'Overdue at time of Principal manual restore',
            restricted_at: now,
            ...resolution
          }))
        );
      }

      // 3. Restore the account (financial invoice status is intentionally untouched)
      await trx('users').where({ id: userId }).update({ status: 'ACTIVE' });

      await trx('account_status_history').insert({
        user_id: userId,
        old_status: 'SUSPENDED',
        new_status: 'ACTIVE',
        reason_code: 'PRINCIPAL_MANUAL_RESTORE',
        reason_text: `${actor.name} manually restored portal access after the student reported fee payment.`,
        effective_from: now,
        changed_by: actor.id,
        reactivated_by: actor.id
      });

      // 4. Audit log
      await trx('audit_logs').insert({
        actor_id: actor.id,
        actor_name: actor.name,
        actor_role: actor.role,
        action: 'RESTORE_STUDENT_PORTAL_ACCESS',
        record_type: 'Student Account',
        record_identifier: String(studentId),
        reason: `Manual portal access restoration (restricted for: ${[
          ...new Set(openEvents.map((e) => e.billing_month))
        ].join(', ')})`,
        previous_value: 'SUSPENDED',
        new_value: 'ACTIVE',
        ip_address: ipAddress || null
      });

      return { studentId, userId, previousStatus: 'SUSPENDED', portalStatus: 'ACTIVE', restoredAt: now.toISOString() };
    });
  },

  async getFeeStats({ sessionId = null, billingMonth = null, classId = null } = {}) {
    let query = db('fee_challans');
    if (sessionId) query = query.where({ session_id: sessionId });
    if (billingMonth) query = query.where({ billing_month: billingMonth });
    if (classId) query = query.where({ class_id: classId });

    const rows = await query.select('total_payable', 'paid_amount', 'status');

    let totalBilled = 0;
    let totalCollected = 0;
    let paidCount = 0;
    let unpaidCount = 0;
    let pendingVerificationCount = 0;

    for (const r of rows) {
      totalBilled += Number(r.total_payable);
      totalCollected += Number(r.paid_amount);
      if (r.status === 'PAID') paidCount++;
      else if (r.status === 'UNPAID' || r.status === 'OVERDUE') unpaidCount++;
      else if (r.status === 'PENDING_VERIFICATION') pendingVerificationCount++;
    }

    const totalOutstanding = Math.max(0, totalBilled - totalCollected);
    const collectionRate = totalBilled > 0 ? Number(((totalCollected / totalBilled) * 100).toFixed(1)) : 0;

    return {
      totalChallans: rows.length,
      totalBilled,
      totalCollected,
      totalOutstanding,
      collectionRate,
      paidCount,
      unpaidCount,
      pendingVerificationCount
    };
  }
};
