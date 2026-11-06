import { Router } from 'express';
import { authController } from './auth.controller.js';
import { authenticate, authenticateOptional } from '../../shared/middleware/authenticate.js';
import { validate } from '../../shared/middleware/validate.js';
import {
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} from './auth.validators.js';

const router = Router();

// Public auth endpoints
router.post('/login', validate(loginSchema), authController.login);
router.post('/refresh', authController.refresh);

// CSRF token retrieval — optional authentication binds to session familyId if present, else anonymous
router.get('/csrf', authenticateOptional, authController.getCsrf);

// Protected auth endpoints (logout accepts optional authentication so clearing cookies always succeeds)
router.post('/logout', authenticateOptional, authController.logout);
router.post('/logout-all', authenticateOptional, authController.logoutAll);
router.get('/me', authenticate, authController.getMe);
router.post('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);

export default router;
