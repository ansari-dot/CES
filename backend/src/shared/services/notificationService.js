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
  }
};
