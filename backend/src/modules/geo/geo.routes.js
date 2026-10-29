import { Router } from 'express';
import { authenticateOptional } from '../../shared/middleware/authenticate.js';
import { sendSuccess } from '../../shared/http/response.js';
import { timezoneResolver } from './geo.service.js';

const router = Router();

/**
 * GET /api/v1/geo/timezone?browserTz=Europe/London
 * Detected IANA timezone for the requesting client's public IP, with the
 * browser timezone and then the school timezone as fallbacks.
 * Uses optional authentication so pre-login portal pages can resolve timezone.
 */
router.get('/timezone', authenticateOptional, async (req, res, next) => {
  try {
    const result = await timezoneResolver.resolve({
      ip: req.ip || '',
      browserTimezone: typeof req.query.browserTz === 'string' ? req.query.browserTz : null
    });
    return sendSuccess(res, result);
  } catch (error) {
    next(error);
  }
});

export default router;
