import { auditRepository } from './audit.repository.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';

export const auditService = {
  async recordAuditLog({
    actorId,
    actorName,
    actorRole,
    action,
    recordType,
    recordIdentifier,
    reason,
    previousValue,
    newValue,
    ipAddress
  }) {
    if (!action || !action.trim()) {
      throw new AppError('Action name is required for audit logging', 422, ErrorCodes.VALIDATION_ERROR);
    }
    if (!recordType || !recordType.trim()) {
      throw new AppError('Record type is required for audit logging', 422, ErrorCodes.VALIDATION_ERROR);
    }
    if (!recordIdentifier || !recordIdentifier.trim()) {
      throw new AppError('Record identifier is required for audit logging', 422, ErrorCodes.VALIDATION_ERROR);
    }

    return await auditRepository.recordAuditLog({
      actorId,
      actorName,
      actorRole,
      action,
      recordType,
      recordIdentifier,
      reason,
      previousValue,
      newValue,
      ipAddress
    });
  },

  async getAuditLogs(filters) {
    return await auditRepository.getAuditLogs(filters);
  }
};
