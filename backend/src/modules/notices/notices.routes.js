import { Router } from 'express';
import { noticesController } from './notices.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { requireRole } from '../../shared/services/accessScope.js';

const router = Router();

// Operational Notifications (must be above /:id to prevent route clash)
router.get('/notifications', authenticate, noticesController.getNotifications);
router.post('/notifications', authenticate, requireRole('ADMIN', 'PRINCIPAL', 'TEACHER'), noticesController.createNotification);
router.post('/notifications/read-all', authenticate, noticesController.markAllNotificationsRead);
router.post('/notifications/:id/read', authenticate, noticesController.markNotificationRead);

// School Notices (visibility is resolved per role/class in the service)
router.get('/', authenticate, noticesController.getNotices);
router.post('/', authenticate, requireRole('ADMIN', 'PRINCIPAL', 'TEACHER'), noticesController.createNotice);
router.get('/:id', authenticate, noticesController.getNoticeById);
router.put('/:id', authenticate, requireRole('ADMIN', 'PRINCIPAL', 'TEACHER'), noticesController.updateNotice);
router.post('/:id/read', authenticate, noticesController.markNoticeRead);
router.post('/:id/archive', authenticate, requireRole('ADMIN', 'PRINCIPAL', 'TEACHER'), noticesController.archiveNotice);

export default router;
