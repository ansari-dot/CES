import { noticesService } from './notices.service.js';
import { sendSuccess } from '../../shared/http/response.js';

export const noticesController = {
  // Notices
  async createNotice(req, res, next) {
    try {
      const { title, content, audience, targetRoles, targetClassIds, classId, category, priority, status, publishDate, expiryDate } = req.body;
      const notice = await noticesService.createNotice(req.user, {
        title,
        content,
        audience,
        targetRoles,
        targetClassIds,
        classId,
        category,
        priority,
        status,
        publishDate,
        expiryDate
      });
      return sendSuccess(res, notice, null, 201);
    } catch (error) {
      next(error);
    }
  },

  async updateNotice(req, res, next) {
    try {
      const { title, content, audience, targetRoles, targetClassIds, category, priority, status, publishDate, expiryDate } = req.body;
      const notice = await noticesService.updateNotice(req.user, req.params.id, {
        title,
        content,
        audience,
        targetRoles,
        targetClassIds,
        category,
        priority,
        status,
        publishDate,
        expiryDate
      });
      return sendSuccess(res, notice);
    } catch (error) {
      next(error);
    }
  },

  async getNotices(req, res, next) {
    try {
      const { audience, role, status, search } = req.query;
      const notices = await noticesService.getNotices(req.user, {
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
      const notice = await noticesService.getNoticeById(req.user, req.params.id);
      return sendSuccess(res, notice);
    } catch (error) {
      next(error);
    }
  },

  async markNoticeRead(req, res, next) {
    try {
      const result = await noticesService.markNoticeRead(req.user, req.params.id);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async archiveNotice(req, res, next) {
    try {
      const notice = await noticesService.archiveNotice(req.user, req.params.id);
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
      const { isRead } = req.query;
      const notifs = await noticesService.getNotifications(req.user, {
        isRead: isRead !== undefined ? isRead === 'true' : null
      });
      return sendSuccess(res, notifs);
    } catch (error) {
      next(error);
    }
  },

  async markNotificationRead(req, res, next) {
    try {
      const result = await noticesService.markNotificationRead(req.user, req.params.id);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async markAllNotificationsRead(req, res, next) {
    try {
      const result = await noticesService.markAllNotificationsRead(req.user);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
};
