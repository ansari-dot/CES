import { Router } from 'express';
import { tasksController } from './tasks.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { authorize } from '../../shared/middleware/authorize.js';
import { upload } from '../../shared/storage/upload.js';

const router = Router();

// Resources
router.get('/resources', authenticate, tasksController.getResources);
router.post('/resources', authenticate, authorize('tasks.manage'), upload.single('file'), tasksController.createResource);
router.patch('/resources/:id', authenticate, authorize('tasks.manage'), tasksController.updateResource);
router.delete('/resources/:id', authenticate, authorize('tasks.manage'), tasksController.deleteResource);

// Submissions
router.get('/submissions', authenticate, tasksController.getSubmissions);
router.post('/submissions/:id/grade', authenticate, authorize('tasks.grade'), tasksController.gradeSubmission);
router.post('/submissions/:id/return', authenticate, authorize('tasks.grade'), tasksController.returnSubmission);

// Achievements & Badges (SRS Section 8.3 & 12)
router.get('/achievements', authenticate, tasksController.getAchievements);
router.post('/achievements', authenticate, authorize('tasks.grade'), tasksController.awardAchievement);
router.put('/achievements/:id', authenticate, authorize('tasks.grade'), tasksController.updateAchievement);
router.delete('/achievements/:id', authenticate, authorize('tasks.grade'), tasksController.deleteAchievement);

// Student Mistakes & Weak Areas Tracking (Academic Workspace Section 8)
router.get('/mistakes', authenticate, tasksController.getMistakes);
router.post('/mistakes', authenticate, authorize('tasks.grade'), tasksController.recordMistake);
router.patch('/mistakes/:id', authenticate, authorize('tasks.grade'), tasksController.updateMistake);
router.delete('/mistakes/:id', authenticate, authorize('tasks.grade'), tasksController.deleteMistake);

// Tasks
router.get('/', authenticate, tasksController.getTasks);
router.post('/', authenticate, authorize('tasks.manage'), upload.single('handout'), tasksController.createTask);
router.get('/:id', authenticate, tasksController.getTaskById);
router.patch('/:id/status', authenticate, authorize('tasks.manage'), tasksController.updateTaskStatus);
router.get('/:id/submissions', authenticate, tasksController.getSubmissions);
router.get('/:id/roster', authenticate, authorize('tasks.grade'), tasksController.getTaskRoster);
router.post('/:id/marks', authenticate, authorize('tasks.grade'), tasksController.recordMarks);
router.post('/:id/submit', authenticate, upload.single('file'), tasksController.submitTask);

export default router;
