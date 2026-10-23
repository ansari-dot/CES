import { Router } from 'express';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { sendSuccess } from '../../shared/http/response.js';
import { timezoneResolver } from './geo.service.js';

const router = Router();

/**
 * GET /api/v1/geo/timezone?browserTz=Europe/London
 * Detected IANA timezone for the requesting client's public IP, with the
 * browser timezone and then the school timezone as fallbacks.
 * Requires a session so the endpoint cannot be used as an open lookup proxy.
 */
router.get('/timezone', authenticate, async (req, res, next) => {
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
