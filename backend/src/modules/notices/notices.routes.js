import { Router } from 'express';
import { noticesController } from './notices.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';

const router = Router();

// Operational Notifications (must be above /:id to prevent route clash)
router.get('/notifications', authenticate, noticesController.getNotifications);
router.post('/notifications', authenticate, noticesController.createNotification);
router.post('/notifications/read-all', authenticate, noticesController.markAllNotificationsRead);
router.post('/notifications/:id/read', authenticate, noticesController.markNotificationRead);

// School Notices
router.get('/', authenticate, noticesController.getNotices);
router.post('/', authenticate, noticesController.createNotice);
router.get('/:id', authenticate, noticesController.getNoticeById);
router.post('/:id/archive', authenticate, noticesController.archiveNotice);

export default router;
