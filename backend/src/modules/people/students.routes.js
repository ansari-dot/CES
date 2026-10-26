import { Router } from 'express';
import { studentsController } from './students.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';

const router = Router();

// Student Portal (Self)
router.get('/me/dashboard', authenticate, studentsController.getMyDashboard);
router.get('/me/timetable', authenticate, studentsController.getMyTimetable);
router.get('/me/grades', authenticate, studentsController.getMyGrades);
router.get('/me/live-lesson/:lessonId/join', authenticate, studentsController.joinLiveLesson);

router.get('/', authenticate, studentsController.getAllStudents);
router.get('/:id', authenticate, studentsController.getStudentById);
router.get('/:id/grades', authenticate, studentsController.getStudentGrades);
router.post('/', authenticate, authorize('users.manage'), studentsController.createStudent);
router.post('/:id/enrol', authenticate, authorize('academic.setup.manage'), studentsController.enrollStudent);
router.post('/:id/guardians', authenticate, authorize('users.manage'), studentsController.linkGuardians);

export default router;
