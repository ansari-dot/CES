import { Router } from 'express';
import { feesController } from './fees.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { upload } from '../../shared/storage/upload.js';

const router = Router();

// Stats
router.get('/stats', authenticate, feesController.getFeeStats);

// Restricted students & access restoration (Principal only)
router.get('/restricted-students', authenticate, authorize('fees.access.restore'), feesController.getRestrictedStudents);
router.post('/students/:id/restore-access', authenticate, authorize('fees.access.restore'), feesController.restoreStudentAccess);

// 1. Fee Structures
router.get('/structures', authenticate, feesController.getFeeStructures);
router.post('/structures', authenticate, authorize('fees.structure.manage'), feesController.createOrUpdateFeeStructure);

// 2. Concessions
router.get('/concessions', authenticate, feesController.getConcessions);
router.post('/concessions', authenticate, authorize('fees.structure.manage'), feesController.createConcession);
router.post('/concessions/:id/revoke', authenticate, authorize('fees.structure.manage'), feesController.revokeConcession);

// 3. Challans
router.post('/challans/generate', authenticate, authorize('fees.challan.generate'), feesController.generateMonthlyChallans);
router.get('/challans', authenticate, feesController.getChallans);
router.get('/challans/consumer/:consumerNo', authenticate, feesController.getChallanByConsumerNo);
router.get('/challans/:id', authenticate, feesController.getChallanById);

// 4. Payment Proofs
router.get('/payment-proofs', authenticate, feesController.getPaymentProofs);
router.post('/payment-proofs', authenticate, upload.single('proof'), feesController.submitPaymentProof);
router.post('/payment-proofs/:id/review', authenticate, authorize('fees.payment.review'), feesController.reviewPaymentProof);

export default router;
