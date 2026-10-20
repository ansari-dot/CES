import { noticesRepository } from './notices.repository.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';

export const noticesService = {
  // Notices
  async createNotice({ title, content, audience, targetRoles, priority, status, expiryDate, userId }) {
    if (!title || !title.trim()) {
      throw new AppError('Notice title is required', 422, ErrorCodes.VALIDATION_ERROR);
    }
    if (!content || !content.trim()) {
      throw new AppError('Notice content is required', 422, ErrorCodes.VALIDATION_ERROR);
    }

    const notice = await noticesRepository.createNotice({
      title,
      content,
      audience,
      targetRoles,
      priority,
      status,
      expiryDate,
      userId
    });

    try {
      await noticesRepository.createNotification({
        title: `Official Notice: ${title}`,
        message: content.length > 140 ? `${content.substring(0, 137)}...` : content,
        type: 'Operational Update',
        targetRole: 'ALL',
        relatedRecordId: notice.id,
        relatedRecordType: 'Notice',
        priority: priority === 'Urgent' ? 'High' : 'Medium'
      });
    } catch (_) {}

    return notice;
  },

  async getNotices(filters) {
    return await noticesRepository.getNotices(filters);
  },

  async getNoticeById(id) {
    const notice = await noticesRepository.findNoticeById(id);
    if (!notice) {
      throw new AppError('Notice not found', 404, ErrorCodes.NOT_FOUND);
    }
    return notice;
  },

  async archiveNotice(id) {
    const notice = await noticesRepository.findNoticeById(id);
    if (!notice) {
      throw new AppError('Notice not found', 404, ErrorCodes.NOT_FOUND);
    }
    return await noticesRepository.archiveNotice(id);
  },

  // Operational Notifications
  async createNotification({ userId, title, message, type, targetRole, relatedRecordId, relatedRecordType, priority }) {
    if (!title || !title.trim()) {
      throw new AppError('Notification title is required', 422, ErrorCodes.VALIDATION_ERROR);
    }
    if (!message || !message.trim()) {
      throw new AppError('Notification message is required', 422, ErrorCodes.VALIDATION_ERROR);
    }

    return await noticesRepository.createNotification({
      userId,
      title,
      message,
      type,
      targetRole,
      relatedRecordId,
      relatedRecordType,
      priority
    });
  },

  async getNotifications(filters) {
    return await noticesRepository.getNotifications(filters);
  },

  async markNotificationRead(id) {
    return await noticesRepository.markNotificationRead(id);
  },

  async markAllNotificationsRead(filters) {
    return await noticesRepository.markAllNotificationsRead(filters);
  }
};
