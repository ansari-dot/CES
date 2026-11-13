import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { requireRole } from '../../shared/services/accessScope.js';
import { sendSuccess } from '../../shared/http/response.js';
import { accountabilityService } from './accountability.service.js';

/**
 * Teacher Academic Accountability  (/api/v1/accountability)
 *
 *  - Principal / Admin: policies, performance overview, teacher evidence, reports, exceptions
 *  - Teacher: own requirements and grading obligations only (/me)
 *  - Students and parents: no access (enforced here, not only in the UI)
 */
const router = Router();
const staff = requireRole('PRINCIPAL', 'ADMIN');
const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (error) {
    next(error);
  }
};

router.use(authenticate);

// Teacher: own responsibilities
router.get('/me', requireRole('TEACHER'), wrap(async (req, res) => {
  sendSuccess(res, await accountabilityService.myWork(req.user, req.query));
}));

// Policies
router.get('/policies', staff, wrap(async (req, res) => {
  sendSuccess(res, await accountabilityService.listPolicies());
}));
router.post('/policies', staff, wrap(async (req, res) => {
  sendSuccess(res, await accountabilityService.createPolicy(req.body || {}, req.user.id), 'Academic work policy created.', 201);
}));
router.put('/policies/:id', staff, wrap(async (req, res) => {
  sendSuccess(res, await accountabilityService.updatePolicy(Number(req.params.id), req.body || {}, req.user.id), 'Policy updated (new version saved).');
}));
router.patch('/policies/:id/status', staff, wrap(async (req, res) => {
  const active = Boolean(req.body?.active);
  sendSuccess(res, await accountabilityService.setPolicyActive(Number(req.params.id), active, req.user.id, req.body?.reason || null));
}));

// Performance monitoring
router.get('/overview', staff, wrap(async (req, res) => {
  sendSuccess(res, await accountabilityService.overview(req.query));
}));
router.get('/teachers/:teacherId', staff, wrap(async (req, res) => {
  sendSuccess(res, await accountabilityService.teacherDetail(req.params.teacherId, req.query));
}));
router.get('/reports', staff, wrap(async (req, res) => {
  sendSuccess(res, await accountabilityService.report(req.query));
}));

// Exceptions (reason mandatory, original deadline preserved, audited)
router.post('/obligations/extend', staff, wrap(async (req, res) => {
  sendSuccess(res, await accountabilityService.extendObligations(req.body || {}, req.user.id), 'Deadline extended.');
}));
router.post('/obligations/excuse', staff, wrap(async (req, res) => {
  sendSuccess(res, await accountabilityService.excuseObligations(req.body || {}, req.user.id), 'Grading work excused.');
}));
router.post('/requirements/:id/excuse', staff, wrap(async (req, res) => {
  sendSuccess(res, await accountabilityService.excuseRequirement(Number(req.params.id), req.body?.reason, req.user.id), 'Requirement excused.');
}));

export default router;
