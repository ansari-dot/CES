import { Router } from 'express';
import { datesheetsController } from './datesheets.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { requireRole } from '../../shared/services/accessScope.js';

const router = Router();

// All date sheet APIs require authentication
router.use(authenticate);

// -------------------------------------------------------------
// Student Active Date Sheets & Popup Announcement
// -------------------------------------------------------------
router.get(
  '/student/active',
  requireRole('STUDENT'),
  datesheetsController.getStudentActiveDateSheets
);

// -------------------------------------------------------------
// Teacher Active Date Sheets & Popup Announcement
// -------------------------------------------------------------
router.get(
  '/teacher/active',
  requireRole('TEACHER', 'PRINCIPAL', 'ADMIN'),
  datesheetsController.getTeacherActiveDateSheets
);

// -------------------------------------------------------------
// Principal / Admin Date Sheet Management
// -------------------------------------------------------------
router.get(
  '/',
  requireRole('PRINCIPAL', 'ADMIN'),
  datesheetsController.listDateSheets
);

router.post(
  '/',
  requireRole('PRINCIPAL', 'ADMIN'),
  datesheetsController.createDateSheet
);

router.get(
  '/:id',
  requireRole('PRINCIPAL', 'ADMIN'),
  datesheetsController.getDateSheetById
);

router.put(
  '/:id',
  requireRole('PRINCIPAL', 'ADMIN'),
  datesheetsController.updateDateSheet
);

router.patch(
  '/:id/publish',
  requireRole('PRINCIPAL', 'ADMIN'),
  datesheetsController.togglePublishStatus
);

router.delete(
  '/:id',
  requireRole('PRINCIPAL', 'ADMIN'),
  datesheetsController.deleteDateSheet
);

export default router;

