import { Router } from 'express';
import { reportsController } from './reports.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { requireRole } from '../../shared/services/accessScope.js';

const router = Router();

// Exports (download CSV or JSON)
router.get('/export', authenticate, authorize('reports.export'), reportsController.exportReport);
router.post('/export-log', authenticate, authorize('reports.export'), reportsController.logReportExport);

// Student records & marks (Principal reports module)
router.get('/student-records', authenticate, requireRole('ADMIN', 'PRINCIPAL'), authorize('reports.view'), reportsController.getStudentRecordsReport);
router.get('/student-marks', authenticate, requireRole('ADMIN', 'PRINCIPAL'), authorize('reports.view'), reportsController.getStudentMarksReport);

// Operational Reports
router.get('/student-enrolment', authenticate, authorize('reports.view'), reportsController.getStudentEnrolmentReport);
router.get('/fee-collection', authenticate, authorize('reports.view'), reportsController.getFeeCollectionReport);
router.get('/teacher-duty-payroll', authenticate, authorize('reports.view'), reportsController.getTeacherDutyPayrollReport);
router.get('/attendance-trends', authenticate, authorize('reports.view'), reportsController.getAttendanceTrendsReport);

// Academic Performance & Oversight
router.get('/academic-performance', authenticate, requireRole('ADMIN', 'PRINCIPAL'), authorize('reports.view'), reportsController.getAcademicPerformances);
router.post('/academic-performance/:classNumber/publish', authenticate, authorize('academic.setup.manage'), reportsController.approveResultPublication);

export default router;
