import { Router } from 'express';
import { parentsController } from './parents.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { requireRole } from '../../shared/services/accessScope.js';

import { upload } from '../../shared/storage/upload.js';

const router = Router();

// Public registration
router.post('/register', parentsController.registerParent);

// Parent Portal (Self) — every child route verifies the parent-student link server-side
const parentOnly = [authenticate, requireRole('PARENT')];
router.get('/me/dashboard', ...parentOnly, parentsController.getMyDashboard);
router.get('/me/children/:studentId/attendance', ...parentOnly, parentsController.getChildAttendance);
router.get('/me/children/:studentId/challans', ...parentOnly, parentsController.getChildChallans);
router.get('/me/children/:studentId/challans/:challanId', ...parentOnly, parentsController.getChildChallanDetail);
router.post('/me/children/:studentId/challans/:challanId/pay', ...parentOnly, upload.single('proof'), parentsController.payChildChallan);
router.get('/me/children/:studentId/results', ...parentOnly, parentsController.getChildResults);
router.get('/me/children/:studentId/assignments', ...parentOnly, parentsController.getChildAssignments);
router.get('/me/children/:studentId/achievements', ...parentOnly, parentsController.getChildAchievements);

// Protected routes (Admin / Principal)
router.get('/', authenticate, authorize('users.manage'), parentsController.getAllParents);
router.get('/:id', authenticate, authorize('users.manage'), parentsController.getParentById);
router.post('/:id/approve', authenticate, authorize('users.manage'), parentsController.approveParent);

export default router;
