import { Router } from 'express';
import { payrollController } from './payroll.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';

const router = Router();

// Draft Generation
router.post('/drafts/generate', authenticate, authorize('payroll.draft.manage'), payrollController.generateMonthlyDrafts);

// Query Drafts & Duty
router.get('/drafts', authenticate, payrollController.getSalaryDrafts);
router.get('/drafts/:id', authenticate, payrollController.getSalaryDraftById);
router.get('/duty-summary/:teacherId', authenticate, payrollController.getTeacherDutySummary);

// Review & Approval Workflow
router.post('/drafts/:id/review', authenticate, authorize('payroll.draft.approve'), payrollController.reviewSalaryDraft);

// Financial Adjustments (Additions / Deductions)
router.post('/drafts/:id/adjustments', authenticate, authorize('payroll.draft.manage'), payrollController.addSalaryAdjustment);

// Payment Settlement
router.post('/drafts/:id/settle', authenticate, authorize('payroll.draft.approve'), payrollController.settleSalaryPayment);

export default router;
