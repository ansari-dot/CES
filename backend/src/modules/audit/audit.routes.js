import { Router } from 'express';
import { auditController } from './audit.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';

const router = Router();

router.get('/', authenticate, authorize('audit.view'), auditController.getAuditLogs);
router.post('/', authenticate, auditController.recordAuditLog);

export default router;
