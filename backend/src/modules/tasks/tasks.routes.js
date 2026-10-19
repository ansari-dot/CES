import { Router } from 'express';
import { tasksController } from './tasks.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { upload } from '../../shared/storage/upload.js';

const router = Router();

// Resources
router.get('/resources', authenticate, tasksController.getResources);
router.post('/resources', authenticate, authorize('tasks.manage'), upload.single('file'), tasksController.createResource);
router.delete('/resources/:id', authenticate, authorize('tasks.manage'), tasksController.deleteResource);

// Submissions
router.get('/submissions', authenticate, tasksController.getSubmissions);
router.post('/submissions/:id/grade', authenticate, authorize('tasks.grade'), tasksController.gradeSubmission);

// Achievements & Badges (SRS Section 8.3 & 12)
router.get('/achievements', authenticate, tasksController.getAchievements);
router.post('/achievements', authenticate, authorize('tasks.grade'), tasksController.awardAchievement);

// Tasks
router.get('/', authenticate, tasksController.getTasks);
router.post('/', authenticate, authorize('tasks.manage'), upload.single('handout'), tasksController.createTask);
router.get('/:id', authenticate, tasksController.getTaskById);
router.get('/:id/submissions', authenticate, tasksController.getSubmissions);
router.post('/:id/submit', authenticate, upload.single('file'), tasksController.submitTask);

export default router;
