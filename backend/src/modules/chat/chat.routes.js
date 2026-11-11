import { Router } from 'express';
import { chatController } from './chat.controller.js';
import { authenticate } from '../../shared/middleware/authenticate.js';

const router = Router();

// Strict session authentication enforced on all academic chat endpoints
router.use(authenticate);

router.get('/threads', chatController.getThreads);
router.post('/threads', chatController.createThread);
router.get('/classes/:classId/students', chatController.getClassStudents);
router.get('/threads/:threadId/messages', chatController.getMessages);
router.post('/threads/:threadId/messages', chatController.sendMessage);
router.post('/threads/:threadId/read', chatController.markRead);
router.get('/oversight', chatController.getOversight);

export default router;

