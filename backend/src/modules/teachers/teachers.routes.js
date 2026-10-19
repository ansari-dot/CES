import { Router } from 'express';
import { teachersController } from './teachers.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';

const router = Router();

// Protect all teacher management endpoints: authenticated + users.manage permission
router.get('/', authenticate, teachersController.getAllTeachers);
router.post('/', authenticate, authorize('users.manage'), teachersController.createTeacher);
router.post('/:id/status', authenticate, authorize('users.manage'), teachersController.changeStatus);

export default router;
