import { noticesService } from './notices.service.js';
import { sendSuccess } from '../../shared/http/response.js';

export const noticesController = {
  // Notices
  async createNotice(req, res, next) {
    try {
      const { title, content, audience, targetRoles, priority, status, expiryDate } = req.body;
      const notice = await noticesService.createNotice({
        title,
        content,
        audience,
        targetRoles,
        priority,
        status,
        expiryDate,
        userId: req.user.id
      });
      return sendSuccess(res, notice, null, 201);
    } catch (error) {
      next(error);
    }
  },

  async getNotices(req, res, next) {
    try {
      const { audience, role, status, search } = req.query;
      const notices = await noticesService.getNotices({
        audience: audience || null,
        role: role || null,
        status: status || null,
        search: search || null
      });
      return sendSuccess(res, notices);
    } catch (error) {
      next(error);
    }
  },

  async getNoticeById(req, res, next) {
    try {
      const id = req.params.id;
      const notice = await noticesService.getNoticeById(id);
      return sendSuccess(res, notice);
    } catch (error) {
      next(error);
    }
  },

  async archiveNotice(req, res, next) {
    try {
      const id = req.params.id;
      const notice = await noticesService.archiveNotice(id);
      return sendSuccess(res, notice);
    } catch (error) {
      next(error);
    }
  },

  // Operational Notifications
  async createNotification(req, res, next) {
    try {
      const { userId, title, message, type, targetRole, relatedRecordId, relatedRecordType, priority } = req.body;
      const notif = await noticesService.createNotification({
        userId,
        title,
        message,
        type,
        targetRole,
        relatedRecordId,
        relatedRecordType,
        priority
      });
      return sendSuccess(res, notif, null, 201);
    } catch (error) {
      next(error);
    }
  },

  async getNotifications(req, res, next) {
    try {
      const { role, isRead } = req.query;
      const notifs = await noticesService.getNotifications({
        userId: req.user.id,
        role: role || (req.user.roleCode || null),
        isRead: isRead !== undefined ? isRead === 'true' : null
      });
      return sendSuccess(res, notifs);
    } catch (error) {
      next(error);
    }
  },

  async markNotificationRead(req, res, next) {
    try {
      const id = req.params.id;
      const result = await noticesService.markNotificationRead(id);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async markAllNotificationsRead(req, res, next) {
    try {
      const result = await noticesService.markAllNotificationsRead({
        userId: req.user.id,
        role: req.user.roleCode
      });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
};
