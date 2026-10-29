import { Router } from 'express';
import { zoomController } from './zoom.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';

const router = Router();

// Zoom Class Meetings Setup, Configuration & Capacity Oversight (Admin & Principal)
router.post('/class-meetings/setup', authenticate, authorize('zoom.meeting.manage'), zoomController.setupClassMeetings);
router.get('/class-meetings', authenticate, authorize('zoom.meeting.manage'), zoomController.getClassMeetings);
router.put('/class-meetings/:classId', authenticate, authorize('zoom.meeting.manage'), zoomController.configureClassMeeting);
router.delete('/class-meetings/:classId', authenticate, authorize('zoom.meeting.manage'), zoomController.deleteClassMeeting);
router.delete('/class-meetings', authenticate, authorize('zoom.meeting.manage'), zoomController.deleteAllClassMeetings);
router.post('/class-meetings/:classId/renew', authenticate, authorize('zoom.meeting.manage'), zoomController.renewZoomMeeting);
router.post('/class-meetings/:classId/health-check', authenticate, authorize('zoom.meeting.manage'), zoomController.runHealthCheck);
router.get('/class-meetings/:classId/history', authenticate, authorize('zoom.meeting.manage'), zoomController.getMeetingHistory);
router.get('/capacity-status', authenticate, authorize('zoom.meeting.manage'), zoomController.getCapacityStatus);
router.get('/api-status', authenticate, authorize('zoom.meeting.manage'), zoomController.getZoomApiStatus);
router.get('/licensed-users', authenticate, authorize('zoom.meeting.manage'), zoomController.listLicensedUsers);
router.post('/class-meetings/:classId/test-event', authenticate, authorize('zoom.meeting.manage'), zoomController.testClassEventDelivery);
router.post('/class-meetings/:classId/generate-zoom-api', authenticate, authorize('zoom.meeting.manage'), zoomController.generateClassMeetingViaZoomApi);
router.post('/class-meetings/generate-all-zoom-api', authenticate, authorize('zoom.meeting.manage'), zoomController.generateAllClassMeetingsViaZoomApi);
router.post('/lessons/:id/reconcile', authenticate, zoomController.reconcileLessonAttendance);

// Teacher Class Session
router.get('/my-class-session', authenticate, zoomController.getMyClassSession);
router.post('/sessions/:id/start', authenticate, authorize('zoom.session.start'), zoomController.startLesson);
router.post('/sessions/:id/end', authenticate, zoomController.endLesson);

// Student Live Class Access
router.get('/student-class-session', authenticate, zoomController.getStudentClassSession);

// Zoom Server-to-Server Webhook Endpoint (No CSRF / No Auth because Zoom calls directly)
router.post('/webhook', zoomController.handleWebhook);

// Zoom Server-to-Server Live Attendance Sync & Daily Duty Tracking
router.post('/lessons/:id/sync-zoom-attendance', authenticate, zoomController.syncLessonAttendance);
router.get('/teachers/:teacherId/daily-duty', authenticate, zoomController.getTeacherDailyDuty);

// Principal Attendance Verification Reviews (Flagged / Unverified Teacher Sessions)
router.get('/attendance-reviews', authenticate, authorize('zoom.meeting.manage'), zoomController.getAttendanceReviews);
router.post('/attendance-reviews/:id/resolve', authenticate, authorize('zoom.meeting.manage'), zoomController.resolveAttendanceReview);

export default router;
