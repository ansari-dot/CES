import crypto from 'crypto';
import { parentsRepository } from './parents.repository.js';
import { studentsRepository } from './students.repository.js';
import { hashPassword } from '../../shared/crypto/password.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { db } from '../../shared/db/knex.js';

import { feesService } from '../fees/fees.service.js';
import { tasksRepository } from '../tasks/tasks.repository.js';
import { attendanceRepository } from '../attendance/attendance.repository.js';
import { emailService } from '../../shared/email/email.service.js';

// Matches the minimum length enforced by the change-password endpoint
const MIN_PASSWORD_LENGTH = 10;

/** Random temporary password without look-alike characters (e.g. "Prn-k7Hq2xWm9"). */
function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let body = '';
  for (let i = 0; i < 9; i += 1) body += alphabet[crypto.randomInt(alphabet.length)];
  return `Prn-${body}`;
}

async function createParentAccount({ name, email, phone, cnic, relation, password, mustChangePassword = false, verifiedBy = null }) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!String(name || '').trim() || !cleanEmail) {
    throw new AppError('Name and email are required', 422, ErrorCodes.VALIDATION_ERROR);
  }

  // Check for duplicate email upfront with a clear message
  const existing = await db('users').where({ email: cleanEmail }).first();
  if (existing) {
    throw new AppError(
      `The email "${cleanEmail}" is already registered. Please use a different email than the student's.`,
      409,
      'EMAIL_ALREADY_REGISTERED'
    );
  }

  const username = cleanEmail.replace(/[^a-z0-9]/g, '_') || `prn_${Date.now()}`;
  const passwordHash = await hashPassword(password);

  const { userId, parentId } = await parentsRepository.registerParentWithUser({
    user: {
      username,
      email: cleanEmail,
      phone,
      full_name: String(name).trim(),
      password_hash: passwordHash
    },
    parent: {
      cnic,
      relation
    },
    mustChangePassword,
    verifiedBy
  });

  return { userId, parentId, username };
}

export const parentsService = {
  async getAllParents(filter = {}) {
    return await parentsRepository.getAllParents(filter);
  },

  async getParentById(id) {
    const parent = await parentsRepository.getParentById(id);
    if (!parent) {
      throw new AppError('Parent record not found', 404, ErrorCodes.NOT_FOUND);
    }
    return parent;
  },

  /** Public self-registration: the parent chooses their own password; the school verifies later. */
  async registerParent({ name, email, phone, cnic, relation, password }) {
    if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
      throw new AppError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`, 422, ErrorCodes.VALIDATION_ERROR);
    }
    const { userId, parentId } = await createParentAccount({ name, email, phone, cnic, relation, password });

    return {
      id: parentId,
      userId,
      name,
      email,
      phone,
      verificationStatus: 'PENDING'
    };
  },

  /**
   * Account created by the Principal: a temporary password (typed by the
   * Principal, or generated) is emailed to the parent, who must replace it
   * on first login.
   */
  async createParentByStaff({ name, email, phone, cnic, relation, password, createdBy }) {
    const typed = password ? String(password).trim() : '';
    if (typed && typed.length < MIN_PASSWORD_LENGTH) {
      throw new AppError(
        `The temporary password must be at least ${MIN_PASSWORD_LENGTH} characters, or leave it blank to generate one`,
        422,
        ErrorCodes.VALIDATION_ERROR
      );
    }
    const temporaryPassword = typed || generateTemporaryPassword();

    const { userId, parentId, username } = await createParentAccount({
      name,
      email,
      phone,
      cnic,
      relation,
      password: temporaryPassword,
      mustChangePassword: true,
      verifiedBy: createdBy
    });

    const mail = await emailService
      .sendParentCredentials({ email: email.trim(), name: name.trim(), temporaryPassword })
      .catch((err) => {
        console.warn('[ParentsService] Credential email failed:', err.message);
        return { sent: false, reason: 'SEND_FAILED' };
      });

    return {
      id: parentId,
      code: `PRN-${String(parentId).padStart(2, '0')}`,
      userId,
      username,
      name: name.trim(),
      email: email.trim(),
      phone,
      cnic,
      verificationStatus: 'APPROVED',
      // Returned once so the Principal can hand it over if the email could not be delivered
      temporaryPassword,
      emailSent: Boolean(mail?.sent),
      emailStatus: mail?.sent ? 'SENT' : mail?.reason || 'NOT_SENT'
    };
  },

  async approveParent({ parentId, status, verifiedBy, children = [] }) {
    const parent = await parentsRepository.getParentById(parentId);
    if (!parent) {
      throw new AppError('Parent record not found', 404, ErrorCodes.NOT_FOUND);
    }

    await parentsRepository.updateVerification(parentId, status, verifiedBy);

    if (status === 'APPROVED' && children.length > 0) {
      for (const child of children) {
        await studentsRepository.linkGuardian({
          studentId: child.studentId,
          parentId,
          relation: child.relation || 'GUARDIAN',
          isPrimary: child.isPrimary ? 1 : 0,
          linkedBy: verifiedBy
        });
      }
    }

    return await parentsRepository.getParentById(parentId);
  },

  async getMyDashboard(userId) {
    const data = await parentsRepository.getParentDashboard(userId);
    if (!data) {
      throw new AppError('Parent profile not found', 404, ErrorCodes.NOT_FOUND);
    }
    return data;
  },

  async getChildChallans(userId, studentId) {
    const parent = await parentsRepository.getParentByUserId(userId);
    if (!parent) {
      throw new AppError('Parent profile not found', 404, ErrorCodes.NOT_FOUND);
    }

    const challans = await parentsRepository.getChildChallans(parent.id, Number(studentId));
    if (challans === null) {
      throw new AppError('Access denied. Student is not linked to your parent account.', 403, ErrorCodes.FORBIDDEN);
    }
    return challans;
  },

  /** Verifies the parent-child link and returns the child's basic record. */
  async getLinkedChild(userId, studentId) {
    const parent = await parentsRepository.getParentByUserId(userId);
    if (!parent) {
      throw new AppError('Parent profile not found', 404, ErrorCodes.NOT_FOUND);
    }
    const isLinked = await parentsRepository.verifyParentStudentLink(parent.id, Number(studentId));
    if (!isLinked) {
      throw new AppError('Access denied. Student is not linked to your parent account.', 403, ErrorCodes.FORBIDDEN);
    }
    const student = await studentsRepository.getStudentById(Number(studentId));
    if (!student) throw new AppError('Student not found', 404, ErrorCodes.NOT_FOUND);
    return { parent, student };
  },

  async getChildAttendance(userId, studentId, { startDate = null, endDate = null } = {}) {
    const { student } = await this.getLinkedChild(userId, studentId);
    const [stats, records] = await Promise.all([
      attendanceRepository.getAttendanceStats({ studentId: student.id, startDate, endDate }),
      parentsRepository.getChildAttendanceRecords(student.id, { startDate, endDate })
    ]);
    return {
      studentId: student.id,
      ...stats,
      attendanceRate: stats.total > 0 ? stats.attendanceRate : null,
      records
    };
  },

  async getChildChallanDetail(userId, studentId, challanId) {
    const { student } = await this.getLinkedChild(userId, studentId);
    const challan = await parentsRepository.getChildChallanDetail(student.id, Number(challanId));
    if (!challan) throw new AppError('Challan not found', 404, ErrorCodes.NOT_FOUND);
    return challan;
  },

  async getChildResults(userId, studentId) {
    const { student } = await this.getLinkedChild(userId, studentId);
    return await studentsRepository.getStudentGrades(student.id);
  },

  async getChildAssignments(userId, studentId) {
    const { student } = await this.getLinkedChild(userId, studentId);
    const tasks = await tasksRepository.getTasks({
      classId: student.currentClassId,
      statuses: ['ACTIVE', 'ARCHIVED'],
      studentId: student.id
    });
    return tasks.map((t) => ({
      id: t.id,
      title: t.title,
      instructions: t.instructions,
      taskType: t.taskType,
      subjectName: t.subjectName,
      teacherName: t.teacherName,
      assignedDate: t.assignedDate,
      deadline: t.deadline,
      totalMarks: t.totalMarks,
      status: t.status,
      handoutName: t.handoutName,
      handoutUrl: t.handoutUrl,
      submissionStatus: t.submissionStatus,
      resubmitRequested: t.resubmitRequested,
      submittedAt: t.submittedAt,
      isLate: t.isLate,
      marksAwarded: t.marksAwarded,
      feedback: t.feedback,
      gradedAt: t.gradedAt
    }));
  },

  async getChildResources(userId, studentId) {
    const { student } = await this.getLinkedChild(userId, studentId);
    return await tasksRepository.getResources({ classId: student.currentClassId, publishedOnly: true });
  },

  async getChildAchievements(userId, studentId) {
    const { student } = await this.getLinkedChild(userId, studentId);
    return await tasksRepository.getAchievements({ studentId: student.id, publishedOnly: true });
  },

  async payChildChallan(userId, studentId, challanId, paymentData) {
    const parent = await parentsRepository.getParentByUserId(userId);
    if (!parent) {
      throw new AppError('Parent profile not found', 404, ErrorCodes.NOT_FOUND);
    }

    const isLinked = await parentsRepository.verifyParentStudentLink(parent.id, Number(studentId));
    if (!isLinked) {
      throw new AppError('Access denied. Student is not linked to your parent account.', 403, ErrorCodes.FORBIDDEN);
    }

    // The challan must belong to this child
    const challan = await parentsRepository.getChildChallanDetail(Number(studentId), Number(challanId));
    if (!challan) {
      throw new AppError('Challan not found for this student', 404, ErrorCodes.NOT_FOUND);
    }
    if (challan.status === 'PAID') {
      throw new AppError('This challan is already fully paid', 422, ErrorCodes.VALIDATION_ERROR);
    }

    return await feesService.submitPaymentProof({
      challanId: Number(challanId),
      studentId: Number(studentId),
      parentId: parent.id,
      submittedAmount: paymentData.submittedAmount,
      bankOrWallet: paymentData.bankOrWallet,
      transactionReference: paymentData.transactionReference,
      paymentDate: paymentData.paymentDate,
      proofDocumentUrl: paymentData.proofDocumentUrl
    });
  }
};
