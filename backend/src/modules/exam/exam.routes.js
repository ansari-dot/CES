import { Router } from 'express';
import { examController } from './exam.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { validate } from '../../shared/middleware/validate.js';
import {
  createExamSchema,
  ensureExamSchema,
  createPaperSchema,
  submitMarksSchema,
  calculateResultsSchema,
  publishExamSchema
} from './exam.validation.js';

const router = Router();

// 1. Examination Series Management
router.post(
  '/',
  authenticate,
  authorize('results.manage'),
  validate(createExamSchema),
  examController.create
);

// Find-or-create the term's examination series (teachers initialize it from marks entry)
router.post(
  '/ensure',
  authenticate,
  validate(ensureExamSchema),
  examController.ensure
);

router.get('/', authenticate, examController.list);
router.get('/:id', authenticate, examController.detail);

// 2. Exam Paper Configuration & Schedules
router.post(
  '/:id/papers',
  authenticate,
  validate(createPaperSchema),
  examController.createPaper
);

router.get('/:id/papers', authenticate, examController.listPapers);

// 3. Marks Tabulation Sheet & Teacher Submission (placed before :id params to avoid collisions)
router.get(
  '/papers/:paperId/marks-sheet',
  authenticate,
  examController.getMarksSheet
);

router.put(
  '/papers/:paperId/marks',
  authenticate,
  validate(submitMarksSchema),
  examController.submitMarks
);

// 4. Principal Moderation, Verification, and Approval
router.post(
  '/:id/verify-class-marks',
  authenticate,
  authorize('results.manage'),
  examController.verifyClassMarks
);

router.post(
  '/:id/calculate-results',
  authenticate,
  authorize('results.manage'),
  validate(calculateResultsSchema),
  examController.calculateResults
);

router.post(
  '/:id/publish',
  authenticate,
  authorize('results.manage'),
  validate(publishExamSchema),
  examController.publish
);

// 5. Official Report Card Access
router.get(
  '/:id/report-card/:studentId',
  authenticate,
  examController.getReportCard
);

export default router;

