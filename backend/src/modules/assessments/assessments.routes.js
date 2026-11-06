import { Router } from 'express';
import { assessmentsController } from './assessments.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { requireRole } from '../../shared/services/accessScope.js';

const router = Router();

// Require authenticated session for all assessment APIs
router.use(authenticate);

// -------------------------------------------------------------
// Teacher & Staff Assessment Management Routes
// -------------------------------------------------------------
router.post(
  '/',
  requireRole('TEACHER', 'ADMIN', 'PRINCIPAL'),
  assessmentsController.createTest
);

router.get(
  '/',
  requireRole('TEACHER', 'ADMIN', 'PRINCIPAL'),
  assessmentsController.listTests
);

router.get(
  '/:id',
  assessmentsController.getTestDetails
);

router.put(
  '/:id',
  requireRole('TEACHER', 'ADMIN', 'PRINCIPAL'),
  assessmentsController.updateTest
);

router.post(
  '/:id/publish',
  requireRole('TEACHER', 'ADMIN', 'PRINCIPAL'),
  assessmentsController.publishTest
);

router.post(
  '/:id/close',
  requireRole('TEACHER', 'ADMIN', 'PRINCIPAL'),
  assessmentsController.closeTest
);

// -------------------------------------------------------------
// Teacher Grading Workstation Routes
// -------------------------------------------------------------
router.get(
  '/:id/submissions',
  requireRole('TEACHER', 'ADMIN', 'PRINCIPAL'),
  assessmentsController.getTestSubmissions
);

router.get(
  '/attempts/:attemptId/grading',
  requireRole('TEACHER', 'ADMIN', 'PRINCIPAL'),
  assessmentsController.getAttemptForGrading
);

router.post(
  '/attempts/:attemptId/grade',
  requireRole('TEACHER', 'ADMIN', 'PRINCIPAL'),
  assessmentsController.gradeAttempt
);

router.post(
  '/:id/publish-results',
  requireRole('TEACHER', 'ADMIN', 'PRINCIPAL'),
  assessmentsController.publishResults
);

// -------------------------------------------------------------
// Student Live Exam Room Routes
// -------------------------------------------------------------
router.get(
  '/student/my-tests',
  requireRole('STUDENT'),
  assessmentsController.getStudentAssessments
);

router.get(
  '/student/available',
  requireRole('STUDENT'),
  assessmentsController.getStudentAssessments
);

router.get(
  '/student/:id/result',
  requireRole('STUDENT'),
  assessmentsController.getStudentTestResult
);

router.post(
  '/:id/start',
  requireRole('STUDENT'),
  assessmentsController.startOrResumeAttempt
);

router.post(
  '/student/:id/start',
  requireRole('STUDENT'),
  assessmentsController.startOrResumeAttempt
);

router.post(
  '/attempts/:attemptId/save-answer',
  requireRole('STUDENT'),
  assessmentsController.saveAnswer
);

router.put(
  '/student/attempts/:attemptId/save-draft',
  requireRole('STUDENT'),
  assessmentsController.saveAnswer
);

router.post(
  '/attempts/:attemptId/submit',
  requireRole('STUDENT'),
  assessmentsController.submitAttempt
);

router.post(
  '/student/attempts/:attemptId/submit',
  requireRole('STUDENT'),
  assessmentsController.submitAttempt
);

// -------------------------------------------------------------
// Parent Child Assessment Results
// -------------------------------------------------------------
router.get(
  '/parent/children/:studentId',
  requireRole('PARENT', 'ADMIN', 'PRINCIPAL'),
  assessmentsController.getParentChildAssessments
);

export default router;

