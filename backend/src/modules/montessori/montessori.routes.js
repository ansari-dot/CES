import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { requireRole } from '../../shared/services/accessScope.js';
import { sendSuccess } from '../../shared/http/response.js';
import * as mgmt from './montessori.management.service.js';
import * as rec from './montessori.records.service.js';
import * as live from './montessori.live.service.js';
import { assertCanViewStudent } from './montessori.access.js';

/**
 * Montessori Management API (/api/v1/montessori).
 * Route-level role checks; assignment and parent-link checks happen in the services.
 */
const router = Router();
router.use(authenticate);

const staff = requireRole('ADMIN', 'PRINCIPAL');
const staffOrTeacher = requireRole('ADMIN', 'PRINCIPAL', 'TEACHER');
const ok = (fn, status = 200) => async (req, res, next) => {
  try {
    const data = await fn(req);
    return sendSuccess(res, data ?? { success: true }, null, status);
  } catch (err) {
    next(err);
  }
};

// ---- Principal: dashboard, sections, learning areas
router.get('/dashboard', staff, ok((req) => rec.dashboard({ sessionId: req.query.sessionId ? Number(req.query.sessionId) : null })));
router.get('/sections', staff, ok((req) => mgmt.listSections({ sessionId: req.query.sessionId, includeInactive: req.query.includeInactive === 'true' })));
router.post('/sections', staff, ok(async (req) => ({ id: await mgmt.createSection(req.user, req.body) }), 201));
router.put('/sections/reorder', staff, ok((req) => mgmt.reorderSections(req.user, req.body?.orderedIds)));
router.put('/sections/:id', staff, ok((req) => mgmt.updateSection(req.user, req.params.id, req.body)));
router.patch('/sections/:id/status', staff, ok((req) => mgmt.setSectionStatus(req.user, req.params.id, req.body?.isActive === true, req.body?.reason)));
router.get('/learning-areas', staffOrTeacher, ok((req) => mgmt.listLearningAreas({ includeInactive: req.query.includeInactive === 'true' })));
router.post('/learning-areas', staff, ok(async (req) => ({ id: await mgmt.saveLearningArea(req.user, null, req.body) }), 201));
router.put('/learning-areas/:id', staff, ok(async (req) => ({ id: await mgmt.saveLearningArea(req.user, req.params.id, req.body) })));

// ---- Principal: teacher assignments
router.get('/teachers', staff, ok(() => mgmt.listTeachers()));
router.get('/assignments', staff, ok((req) => mgmt.assignmentHistory({ sectionId: req.query.sectionId, teacherId: req.query.teacherId })));
router.post('/sections/:id/assignments', staff, ok(async (req) => ({ id: await mgmt.assignTeacher(req.user, req.params.id, req.body) }), 201));
router.post('/assignments/:id/end', staff, ok((req) => mgmt.endAssignment(req.user, req.params.id, req.body?.reason)));

// ---- Principal: student allocations
router.get('/students/available', staff, ok((req) => mgmt.availableStudents(req.query)));
router.get('/students/:id/allocations', staff, ok((req) => mgmt.studentAllocationHistory(req.params.id)));
router.post('/sections/:id/allocations', staff, ok((req) => mgmt.allocateStudents(req.user, req.params.id, req.body), 201));
router.post('/allocations/transfer', staff, ok((req) => mgmt.transferStudents(req.user, req.body)));
router.post('/allocations/:id/end', staff, ok((req) => mgmt.removeAllocation(req.user, req.params.id, req.body?.reason)));

// ---- Teacher (assigned) + Principal: class, attendance, activities, progress, reports
router.get('/my/sections', requireRole('TEACHER'), ok((req) => rec.mySections(req.user)));
router.get('/sections/:id/students', staffOrTeacher, ok((req) => rec.sectionStudents(req.user, req.params.id)));
router.get('/sections/:id/attendance', staffOrTeacher, ok((req) => rec.attendanceRoster(req.user, req.params.id, req.query.date)));
router.put('/sections/:id/attendance', staffOrTeacher, ok((req) => rec.saveAttendance(req.user, req.params.id, req.body)));
router.get('/attendance/report', staffOrTeacher, ok((req) => rec.attendanceReport(req.user, req.query)));
router.get('/activities', staffOrTeacher, ok((req) => rec.listActivities(req.user, req.query)));
router.post('/activities', requireRole('TEACHER'), ok((req) => rec.createActivity(req.user, req.body), 201));
router.put('/activities/:id', requireRole('TEACHER'), ok((req) => rec.updateActivity(req.user, req.params.id, req.body)));
router.patch('/activities/:id/status', requireRole('TEACHER'), ok((req) => rec.setActivityStatus(req.user, req.params.id, req.body?.status)));
router.get('/progress', staffOrTeacher, ok((req) => rec.listProgress(req.user, req.query)));
router.post('/progress', requireRole('TEACHER'), ok((req) => rec.recordProgress(req.user, req.body), 201));
router.put('/progress/:id', staffOrTeacher, ok((req) => rec.correctProgress(req.user, req.params.id, req.body)));
router.get('/progress/:id/history', staffOrTeacher, ok((req) => rec.progressHistoryOf(req.user, req.params.id)));
router.get('/reports/sections/:id', staffOrTeacher, ok((req) => rec.sectionReport(req.user, req.params.id, req.query)));
router.get('/reports/students/:id', staffOrTeacher, ok(async (req) => {
  await assertCanViewStudent(req.user, req.params.id);
  return rec.studentReport(req.user, req.params.id, req.query);
}));

// ---- Montessori Live Classes (Zoom). Separate records from regular timetable live classes.
router.get('/live-classes', staff, ok((req) => live.listLiveClasses({ scope: req.query.scope, sectionId: req.query.sectionId })));
router.get('/live-classes/options', staff, ok(() => live.meetingOptions()));
router.post('/live-classes', staff, ok((req) => live.createLiveClass(req.user, req.body), 201));
router.put('/live-classes/:id', staff, ok((req) => live.updateLiveClass(req.user, req.params.id, req.body)));
router.post('/live-classes/:id/cancel', staff, ok((req) => live.cancelLiveClass(req.user, req.params.id, req.body?.reason)));
router.get('/my/live-classes', requireRole('TEACHER'), ok((req) => live.myLiveClasses(req.user)));
router.get('/student/live-classes', requireRole('STUDENT'), ok((req) => live.studentLiveClasses(req.user)));
router.get('/parent/children/:studentId/live-classes', requireRole('PARENT'), ok((req) => live.parentLiveClasses(req.user, req.params.studentId)));

// ---- Parent (read-only, linked children)
router.get('/parent/children', requireRole('PARENT'), ok((req) => rec.parentChildren(req.user)));
router.get('/parent/children/:studentId', requireRole('PARENT'), ok((req) => rec.parentChildView(req.user, req.params.studentId, req.query)));

export default router;
