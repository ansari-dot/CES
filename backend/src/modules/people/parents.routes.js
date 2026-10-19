import { Router } from 'express';
import { parentsController } from './parents.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';

import { upload } from '../../shared/storage/upload.js';

const router = Router();

// Public registration
router.post('/register', parentsController.registerParent);

// Parent Portal (Self)
router.get('/me/dashboard', authenticate, parentsController.getMyDashboard);
router.get('/me/children/:studentId/challans', authenticate, parentsController.getChildChallans);
router.post('/me/children/:studentId/challans/:challanId/pay', authenticate, upload.single('proof'), parentsController.payChildChallan);

// Protected routes (Admin / Principal)
router.get('/', authenticate, authorize('users.manage'), parentsController.getAllParents);
router.get('/:id', authenticate, parentsController.getParentById);
router.post('/:id/approve', authenticate, authorize('users.manage'), parentsController.approveParent);

export default router;
