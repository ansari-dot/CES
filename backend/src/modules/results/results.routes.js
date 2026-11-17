import { Router } from 'express';
import { resultsController } from './results.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { requireRole } from '../../shared/services/accessScope.js';

const router = Router();

// Student / parent self-service reads (static paths before /:id)
router.get('/me', authenticate, requireRole('STUDENT'), resultsController.myResults);
router.get('/me/annual-summary', authenticate, requireRole('STUDENT'), resultsController.getMyAnnualPerformanceSummary);
router.get('/child/:studentId', authenticate, requireRole('PARENT'), resultsController.childResults);
router.get('/child/:studentId/annual-summary', authenticate, requireRole('PARENT'), resultsController.getChildAnnualPerformanceSummary);
router.get(
  '/students/:studentId',
  authenticate,
  requireRole('ADMIN', 'PRINCIPAL'),
  resultsController.studentResults
);
router.get(
  '/students/:studentId/annual-summary',
  authenticate,
  requireRole('ADMIN', 'PRINCIPAL', 'TEACHER'),
  resultsController.getAnnualPerformanceSummary
);
router.get(
  '/students/:studentId/subjects/:subjectId/detailed-marks',
  authenticate,
  requireRole('ADMIN', 'PRINCIPAL', 'TEACHER', 'STUDENT', 'PARENT'),
  resultsController.getSubjectDetailedMarks
);

// Teacher marks hand-off
router.get('/teacher-status', authenticate, requireRole('TEACHER'), resultsController.teacherStatus);
router.post(
  '/submit-marks',
  authenticate,
  requireRole('TEACHER', 'PRINCIPAL', 'ADMIN'),
  resultsController.submitMarks
);

// Principal / admin result management
router.get('/overview', authenticate, authorize('results.manage'), resultsController.overview);
router.post('/compute', authenticate, authorize('results.manage'), resultsController.compute);
router.post('/approve', authenticate, authorize('results.manage'), resultsController.approve);
router.post('/publish', authenticate, authorize('results.manage'), resultsController.publish);

router.get('/', authenticate, requireRole('ADMIN', 'PRINCIPAL', 'TEACHER'), resultsController.list);
router.get('/:id', authenticate, resultsController.detail);
router.patch('/:id/subjects', authenticate, authorize('results.manage'), resultsController.updateSubjectMarks);

export default router;
