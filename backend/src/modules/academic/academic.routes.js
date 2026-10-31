import { Router } from 'express';
import { academicController } from './academic.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';

const router = Router();

// Sessions (academic years)
router.get('/sessions', authenticate, academicController.getSessions);
router.post('/sessions', authenticate, authorize('academic.setup.manage'), academicController.createSession);
router.patch('/sessions/:id', authenticate, authorize('academic.setup.manage'), academicController.updateSession);
router.post('/sessions/:id/activate', authenticate, authorize('academic.setup.manage'), academicController.activateSession);
router.post('/sessions/:id/close', authenticate, authorize('academic.setup.manage'), academicController.closeSession);
router.get('/sessions/:id/stats', authenticate, authorize('reports.view'), academicController.getSessionStats);

// Academic terms
router.get('/sessions/:id/terms', authenticate, academicController.getTerms);
router.post('/sessions/:id/terms', authenticate, authorize('academic.setup.manage'), academicController.createTerm);
router.patch('/terms/:id', authenticate, authorize('academic.setup.manage'), academicController.updateTerm);

// Promotion policy
router.get('/promotion-policy', authenticate, academicController.getPromotionPolicy);
router.put('/promotion-policy', authenticate, authorize('academic.setup.manage'), academicController.savePromotionPolicy);

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

// Class Assignments (subjects → teachers for a class)
router.get('/classes/:id/assignments', authenticate, academicController.getClassAssignments);

export default router;
