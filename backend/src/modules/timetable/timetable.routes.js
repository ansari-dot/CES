import { Router } from 'express';
import { timetableController } from './timetable.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';

const router = Router();

router.get('/slots', authenticate, timetableController.getSlots);
router.get('/my-slots', authenticate, timetableController.getMySlots);
router.get('/my-lessons', authenticate, timetableController.getMyLessons);
router.post('/slots', authenticate, authorize('timetable.manage'), timetableController.createSlot);
router.put('/slots/:id', authenticate, authorize('timetable.manage'), timetableController.updateSlot);
router.delete('/slots/:id', authenticate, authorize('timetable.manage'), timetableController.deleteSlot);

router.get('/lessons', authenticate, timetableController.getLessons);
router.post('/publish', authenticate, authorize('timetable.publish'), timetableController.publishTimetable);

router.post('/lessons/:id/cancel', authenticate, authorize('timetable.manage'), timetableController.cancelLesson);
router.post('/lessons/:id/substitute', authenticate, authorize('timetable.manage'), timetableController.substituteTeacher);

export default router;
