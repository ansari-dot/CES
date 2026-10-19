import { auditService } from './audit.service.js';
import { sendSuccess } from '../../shared/http/response.js';

export const auditController = {
  async recordAuditLog(req, res, next) {
    try {
      const {
        action,
        recordType,
        recordIdentifier,
        reason,
        previousValue,
        newValue
      } = req.body;

      const actorName = req.user?.fullName || req.user?.username || 'System User';
      const actorRole = req.user?.roleCode || 'User';
      const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;

      const log = await auditService.recordAuditLog({
        actorId: req.user?.id,
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

      return sendSuccess(res, log, null, 201);
    } catch (error) {
      next(error);
    }
  },

  async getAuditLogs(req, res, next) {
    try {
      const { recordType, action, limit } = req.query;
      const logs = await auditService.getAuditLogs({
        recordType: recordType || null,
        action: action || null,
        limit: limit ? Number(limit) : 150
      });
      return sendSuccess(res, logs);
    } catch (error) {
      next(error);
    }
  }
};
