import { parentsRepository } from './parents.repository.js';
import { studentsRepository } from './students.repository.js';
import { hashPassword } from '../../shared/crypto/password.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';

import { feesService } from '../fees/fees.service.js';

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

  async payChildChallan(userId, studentId, challanId, paymentData) {
    const parent = await parentsRepository.getParentByUserId(userId);
    if (!parent) {
      throw new AppError('Parent profile not found', 404, ErrorCodes.NOT_FOUND);
    }

    const isLinked = await parentsRepository.verifyParentStudentLink(parent.id, Number(studentId));
    if (!isLinked) {
      throw new AppError('Access denied. Student is not linked to your parent account.', 403, ErrorCodes.FORBIDDEN);
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
