import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { sendSuccess } from '../../shared/http/response.js';
import { isStaff } from '../../shared/services/accessScope.js';
import { dutyService } from './duty.service.js';

/**
 * Teacher Duty Tracking & Salary Configuration  (/api/v1/duty)
 *
 * Access:
 *  - Principal/Admin: all teachers (writes require payroll / attendance permissions).
 *  - Teacher: own records only; can check in / out for themselves (server clock).
 *  - Students / parents: no access.
 */
const router = Router();
const wrap = (fn) => async (req, res, next) => {
  try {
    await fn(req, res);
  } catch (error) {
    next(error);
  }
};

// ─── Salary configuration ─────────────────────────────────────────────────
router.get('/salary-profiles', authenticate, wrap(async (req, res) => {
  sendSuccess(res, await dutyService.listProfiles(req.user, req.query.teacherId));
}));

router.post('/salary-profiles', authenticate, authorize('payroll.draft.manage'), wrap(async (req, res) => {
  sendSuccess(res, await dutyService.createProfile(req.body || {}, req.user?.id), 'Salary profile configured successfully.', 201);
}));

router.put('/salary-profiles/:id', authenticate, authorize('payroll.draft.manage'), wrap(async (req, res) => {
  sendSuccess(res, await dutyService.updateProfile(req.params.id, req.body || {}, req.user?.id), 'Salary profile updated.');
}));

// ─── Daily check-in / check-out ───────────────────────────────────────────
router.get('/checkins', authenticate, wrap(async (req, res) => {
  sendSuccess(res, await dutyService.listCheckins(req.user, req.query));
}));

// Teacher self-service (time = server clock)
router.post('/checkins/me', authenticate, wrap(async (req, res) => {
  const action = req.body?.action;
  const record = await dutyService.selfCheck(req.user, action);
  sendSuccess(res, record, String(action).toUpperCase() === 'CHECK_OUT' ? 'Checked out.' : 'Checked in.');
}));

// Authorised manual entry / correction (reason required, audited)
router.post('/checkins', authenticate, authorize('attendance.correct'), wrap(async (req, res) => {
  sendSuccess(res, await dutyService.recordByStaff(req.body || {}, req.user?.id), 'Duty record saved.', 201);
}));

// ─── Reports ──────────────────────────────────────────────────────────────
router.get('/monthly-report', authenticate, wrap(async (req, res) => {
  sendSuccess(res, await dutyService.teacherMonthlyReport(req.user, req.query));
}));

router.get('/report', authenticate, wrap(async (req, res) => {
  if (!isStaff(req.user)) {
    // teachers get their own detailed report instead
    return sendSuccess(res, await dutyService.teacherMonthlyReport(req.user, req.query));
  }
  return sendSuccess(res, await dutyService.monthlySummary(req.user, req.query));
}));

export default router;
