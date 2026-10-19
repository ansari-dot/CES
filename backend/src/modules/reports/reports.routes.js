import { Router } from 'express';
import { reportsController } from './reports.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';

const router = Router();

// Exports (download CSV or JSON)
router.get('/export', authenticate, authorize('reports.export'), reportsController.exportReport);

// Operational Reports
router.get('/student-enrolment', authenticate, authorize('reports.view'), reportsController.getStudentEnrolmentReport);
router.get('/fee-collection', authenticate, authorize('reports.view'), reportsController.getFeeCollectionReport);
router.get('/teacher-duty-payroll', authenticate, authorize('reports.view'), reportsController.getTeacherDutyPayrollReport);
router.get('/attendance-trends', authenticate, authorize('reports.view'), reportsController.getAttendanceTrendsReport);

// Academic Performance & Oversight
router.get('/academic-performance', authenticate, authorize('reports.view'), reportsController.getAcademicPerformances);
router.post('/academic-performance/:classNumber/publish', authenticate, authorize('academic.setup.manage'), reportsController.approveResultPublication);

export default router;
