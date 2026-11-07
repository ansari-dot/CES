import { Router } from 'express';
import { performanceController } from './performance.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';

const router = Router();

router.use(authenticate);

// =========================================================================
// 1. Grading Policies
// =========================================================================
router.get('/policies/active', performanceController.getActivePolicy);
router.get('/policies', performanceController.listPolicies);
router.get('/policies/:id', performanceController.getPolicyById);
router.post(
  '/policies',
  authorize('policies.manage'), // ADMIN / PRINCIPAL pass automatically through authorize
  performanceController.createPolicy
);
router.patch(
  '/policies/:id/activate',
  authorize('policies.manage'),
  performanceController.activatePolicy
);

// =========================================================================
// 2. Continuous Formative Monitoring & Full Academic Report
// =========================================================================
router.get(
  '/students/:studentId/full-report',
  performanceController.getFullReport
);

// Promotion decision (manual override)
router.post(
  '/students/:studentId/promotion-decision',
  authorize('promotion.decide'),
  performanceController.decidePromotion
);

// Admin soft‑archive student academic data
router.delete(
  '/students/:studentId/archive',
  authorize('student.archive'),
  performanceController.archiveStudent
);
router.get(
  '/students/:studentId/subjects/:subjectId',
  performanceController.getStudentContinuousScore
);
router.get(
  '/classes/:classId/subjects/:subjectId',
  performanceController.getClassContinuousPerformance
);

// =========================================================================
// 3. Alerts & Cooldowns
// =========================================================================
router.get('/cooldown', performanceController.getCooldownStatus);
router.post('/alerts', performanceController.triggerAlert);
router.get('/alerts', performanceController.listAlerts);
router.get('/alerts/:id', performanceController.getAlertDetails);

// =========================================================================
// 4. Outbox Worker Manual Flush
// =========================================================================
router.post(
  '/outbox/process',
  authorize('system.manage'),
  performanceController.flushOutbox
);

export default router;

