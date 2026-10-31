import { Router } from 'express';
import { promotionsController } from './promotions.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';

const router = Router();

// All promotion operations are principal/admin-only (promotions.manage;
// ADMIN bypasses permission checks).
router.get('/overview', authenticate, authorize('promotions.manage'), promotionsController.overview);
router.get('/preview', authenticate, authorize('promotions.manage'), promotionsController.preview);
router.get('/history/:studentId', authenticate, authorize('promotions.manage'), promotionsController.history);
router.get('/', authenticate, authorize('promotions.manage'), promotionsController.list);
router.post('/evaluate', authenticate, authorize('promotions.manage'), promotionsController.evaluate);
router.post('/bulk-approve', authenticate, authorize('promotions.manage'), promotionsController.bulkApprove);
router.post('/execute', authenticate, authorize('promotions.manage'), promotionsController.execute);
router.patch('/:id/decision', authenticate, authorize('promotions.manage'), promotionsController.decide);

export default router;
