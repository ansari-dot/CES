import { parentsRepository } from './parents.repository.js';
import { studentsRepository } from './students.repository.js';
import { hashPassword } from '../../shared/crypto/password.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';

import { feesService } from '../fees/fees.service.js';
import { tasksRepository } from '../tasks/tasks.repository.js';
import { attendanceRepository } from '../attendance/attendance.repository.js';

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

  async registerParent({ name, email, phone, cnic, relation, password }) {
    const username = email.toLowerCase().replace(/[^a-z0-9]/g, '_') || `prn_${Date.now()}`;
    const passwordHash = await hashPassword(password || 'ParentPassword123!');

    const { userId, parentId } = await parentsRepository.registerParentWithUser({
      user: {
        username,
        email,
        phone,
        full_name: name,
        password_hash: passwordHash
      },
      parent: {
        cnic,
        relation
      }
    });

    return {
      id: parentId,
      userId,
      name,
      email,
      phone,
      verificationStatus: 'PENDING'
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
