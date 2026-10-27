import { noticesRepository } from '../../modules/notices/notices.repository.js';

export const notificationService = {
  /**
   * Safely create an operational notification without interrupting caller flow.
   */
  async notify({
    userId = null,
    title,
    message,
    type = 'Operational Update',
    targetRole = 'ALL',
    relatedRecordId = null,
    relatedRecordType = null,
    priority = 'Medium'
  }) {
    try {
      if (!title || !message) return null;

      const created = await noticesRepository.createNotification({
        userId,
        title,
        message,
        type,
        targetRole,
        relatedRecordId,
        relatedRecordType,
        priority
      });

      return created;
    } catch (err) {
      console.warn('[NotificationService] Operational notification warning:', err.message);
      return null;
    }
  },

  /**
   * Create one in-app notification per recipient user (deduplicated), so each
   * user only sees what was addressed to them and keeps their own read state.
   */
  async notifyUsers(userIds, {
    title,
    message,
    type = 'Operational Update',
    targetRole = 'ALL',
    relatedRecordId = null,
    relatedRecordType = null,
    priority = 'Medium'
  }) {
    try {
      const unique = Array.from(new Set((userIds || []).map(Number).filter(Boolean)));
      if (!title || !message || unique.length === 0) return 0;
      return await noticesRepository.createNotificationsForUsers(unique, {
        title,
        message,
        type,
        targetRole,
        relatedRecordId,
        relatedRecordType,
        priority
      });
    } catch (err) {
      console.warn('[NotificationService] Targeted notification warning:', err.message);
      return 0;
    }
  }
};
