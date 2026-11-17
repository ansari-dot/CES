import { Router } from 'express';
import { feesController } from './fees.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { upload } from '../../shared/storage/upload.js';
import { requireRole } from '../../shared/services/accessScope.js';
import { qrUploadSingle } from './fees.qrUpload.js';

const router = Router();

// Stats
router.get('/stats', authenticate, feesController.getFeeStats);

// 0. Bank Accounts & Assignments
router.get('/bank-accounts', authenticate, feesController.getBankAccounts);
router.post('/bank-accounts', authenticate, authorize('fees.structure.manage'), feesController.createBankAccount);
router.put('/bank-accounts/:id', authenticate, authorize('fees.structure.manage'), feesController.updateBankAccount);
router.delete('/bank-accounts/:id', authenticate, authorize('fees.structure.manage'), feesController.archiveBankAccount);
router.put('/students/:id/bank-account', authenticate, authorize('fees.structure.manage'), feesController.assignStudentBankAccount);
router.put('/challans/:id/bank-account', authenticate, requireRole('ADMIN', 'PRINCIPAL'), feesController.assignChallanBankAccount);

// 0b. Per-challan payment details (revisioned) & optional QR code.
// Editing is Principal/Admin only; the QR image is served only to users who may view the challan.
router.get('/challans/:id/payment-details', authenticate, requireRole('ADMIN', 'PRINCIPAL'), feesController.getChallanPaymentDetails);
router.put(
  '/challans/:id/payment-details',
  authenticate,
  requireRole('ADMIN', 'PRINCIPAL'),
  qrUploadSingle('qr'),
  feesController.reviseChallanPaymentDetails
);
router.get('/challans/:id/payment-qr', authenticate, feesController.streamChallanPaymentQr);

// Restricted students & access restoration (Principal only)
router.get('/restricted-students', authenticate, authorize('fees.access.restore'), feesController.getRestrictedStudents);
router.post('/students/:id/restore-access', authenticate, authorize('fees.access.restore'), feesController.restoreStudentAccess);

// 1. Fee Structures
router.get('/my-structure', authenticate, feesController.getMyFeeStructure);
router.get('/students/:id/structure', authenticate, feesController.getStudentFeeStructure);
router.get('/structures', authenticate, feesController.getFeeStructures);
router.post('/structures', authenticate, authorize('fees.structure.manage'), feesController.createOrUpdateFeeStructure);

// 2. Concessions
router.get('/concessions', authenticate, feesController.getConcessions);
router.post('/concessions', authenticate, authorize('fees.structure.manage'), feesController.createConcession);
router.put('/concessions/:id', authenticate, authorize('fees.structure.manage'), feesController.updateConcession);
router.post('/concessions/:id/revoke', authenticate, authorize('fees.structure.manage'), feesController.revokeConcession);

// 3. Challans
router.post('/challans/generate', authenticate, authorize('fees.challan.generate'), feesController.generateMonthlyChallans);
router.post('/challans/:id/block', authenticate, authorize('fees.access.restore'), feesController.blockStudentAccess);
router.get('/challans', authenticate, feesController.getChallans);
router.get('/challans/consumer/:consumerNo', authenticate, feesController.getChallanByConsumerNo);
router.get('/challans/:id', authenticate, feesController.getChallanById);

// 4. Payment Proofs
router.get('/payment-proofs', authenticate, feesController.getPaymentProofs);
router.post('/payment-proofs', authenticate, upload.single('proof'), feesController.submitPaymentProof);
router.post('/payment-proofs/:id/review', authenticate, authorize('fees.payment.review'), feesController.reviewPaymentProof);

export default router;
