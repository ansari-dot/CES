import { Router } from 'express';
import { attendanceController } from './attendance.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';

const router = Router();

// Roster and Marking
router.get('/lessons/:lessonId/roster', authenticate, attendanceController.getLessonRoster);
router.get('/classes/:classId/roster', authenticate, attendanceController.getClassRoster);
router.post('/lessons/:lessonId/delivery', authenticate, authorize('attendance.mark'), attendanceController.recordDelivery);
router.post('/lessons/:lessonId/submit', authenticate, authorize('attendance.mark'), attendanceController.submitAttendance);

// Attendance Correction Vouchers
router.post('/corrections', authenticate, attendanceController.createCorrection);
router.get('/corrections', authenticate, attendanceController.getCorrections);
router.post('/corrections/:id/review', authenticate, authorize('attendance.correct'), attendanceController.reviewCorrection);

// Statistics and Reports
router.get('/stats', authenticate, attendanceController.getStats);

export default router;
