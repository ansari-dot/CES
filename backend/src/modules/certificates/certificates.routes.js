import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { requireRole } from '../../shared/services/accessScope.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { certificatesController as c } from './certificates.controller.js';

const router = Router();
router.use(authenticate);

const staff = requireRole('ADMIN', 'PRINCIPAL');

// Template images are validated (type by magic bytes, per-field size) before being written.
const assetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 3, fields: 30 }
}).fields([
  { name: 'background', maxCount: 1 },
  { name: 'logo', maxCount: 1 },
  { name: 'principalSignature', maxCount: 1 }
]);
const assets = (req, res, next) =>
  assetUpload(req, res, (err) => {
    if (!err) return next();
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Template images must be 5 MB or smaller.' : 'Template image upload failed.';
    return next(new AppError(msg, 422, ErrorCodes.VALIDATION_ERROR));
  });

// ---- Administration: categories, templates, audit history (Principal / Admin only)
router.get('/admin/categories', staff, c.listCategories);
router.post('/admin/categories', staff, c.createCategory);
router.put('/admin/categories/:id', staff, c.updateCategory);
router.get('/admin/templates', staff, c.listTemplates);
router.post('/admin/templates', staff, assets, c.createTemplate);
router.put('/admin/templates/:id', staff, assets, c.updateTemplate);
router.patch('/admin/templates/:id/status', staff, c.setTemplateStatus);
router.get('/admin/events', staff, c.events);

// ---- Teacher issuance (class and per-student scope enforced in the service)
router.get('/catalog', requireRole('TEACHER', 'ADMIN', 'PRINCIPAL'), c.catalog);
router.get('/templates/:id/preview', requireRole('TEACHER', 'ADMIN', 'PRINCIPAL'), c.templatePreview);
router.get('/recipients', requireRole('TEACHER'), c.recipients);
router.post('/preview', requireRole('TEACHER'), c.personalizedPreview);
router.post('/issue', requireRole('TEACHER'), c.issue);
router.get('/issued', requireRole('TEACHER', 'ADMIN', 'PRINCIPAL'), c.listIssued);

// ---- Student / parent views
router.get('/mine', requireRole('STUDENT'), c.listMine);
router.get('/children/:studentId', requireRole('PARENT'), c.listForParent);

// ---- Single certificate (ownership checked in the service; foreign ids return 404)
router.get('/:id', c.details);
router.get('/:id/pdf', c.pdf);
router.post('/:id/revoke', staff, c.revoke);

export default router;
