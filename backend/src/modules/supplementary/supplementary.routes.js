import { Router } from 'express';
import { supplementaryController } from './supplementary.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';

const router = Router();

router.use(authenticate);

// Query endpoints
router.get('/failed-subjects', supplementaryController.getFailedSubjects);
router.get('/', supplementaryController.listSupplementary);
router.get('/:id', supplementaryController.getSupplementaryById);

// Lifecycle actions
router.post('/initialize', supplementaryController.initialize);
router.patch('/:id/schedule', supplementaryController.schedule);
router.patch('/:id/marks', supplementaryController.recordMarks);
router.patch('/:id/submit', supplementaryController.submitMarks);

// Executive Authority endpoints (Principal / Admin)
router.patch('/:id/approve', authorize('results.approve'), supplementaryController.approveResult);
router.patch('/:id/publish', authorize('results.publish'), supplementaryController.publishResult);
router.patch('/:id/cancel', authorize('results.manage'), supplementaryController.cancelExam);
router.post('/:id/correction', authorize('results.publish'), supplementaryController.issueCorrection);

export default router;

