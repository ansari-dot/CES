import { Router } from 'express';
import { academicController } from './academic.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';

const router = Router();

// Sessions
router.get('/sessions', authenticate, academicController.getSessions);
router.post('/sessions', authenticate, authorize('academic.setup.manage'), academicController.createSession);

// Classes & Subjects
router.get('/classes', authenticate, academicController.getClasses);
router.get('/classes/:id/subjects', authenticate, academicController.getClassSubjects);
router.post('/classes/:id/subjects', authenticate, authorize('academic.setup.manage'), academicController.addSubjectToClass);
router.put('/classes/:id/subjects', authenticate, authorize('academic.setup.manage'), academicController.setClassSubjects);
router.post('/classes/:id/assign-teacher', authenticate, authorize('academic.setup.manage'), academicController.assignTeacher);

// Subjects
router.get('/subjects', authenticate, academicController.getSubjects);
router.post('/subjects', authenticate, authorize('academic.setup.manage'), academicController.createSubject);

// Teacher Assignments
router.get('/teachers/:id/assignments', authenticate, academicController.getTeacherAssignments);
router.post('/teachers/:id/assignments', authenticate, authorize('academic.setup.manage'), academicController.assignTeacher);
router.post('/academic/assign-teacher', authenticate, authorize('academic.setup.manage'), academicController.assignTeacher);
router.post('/academic/unassign-teacher', authenticate, authorize('academic.setup.manage'), academicController.unassignTeacher);

export default router;
