import { Router } from 'express';
import { zoomController } from './zoom.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';

const router = Router();

// Zoom Class Meetings Setup & Monitoring (Admin & Principal)
router.post('/class-meetings/setup', authenticate, authorize('zoom.meeting.manage'), zoomController.setupClassMeetings);
router.get('/class-meetings', authenticate, authorize('zoom.meeting.manage'), zoomController.getClassMeetings);

// Teacher Class Session
router.get('/my-class-session', authenticate, zoomController.getMyClassSession);
router.post('/sessions/:id/start', authenticate, authorize('zoom.session.start'), zoomController.startLesson);
router.post('/sessions/:id/end', authenticate, zoomController.endLesson);

// Student Live Class Access
router.get('/student-class-session', authenticate, zoomController.getStudentClassSession);

export default router;
