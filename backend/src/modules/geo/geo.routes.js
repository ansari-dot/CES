import { Router } from 'express';
import { authenticate, authenticateOptional } from '../../shared/middleware/authenticate.js';
import { sendSuccess } from '../../shared/http/response.js';
import { timezoneResolver, isValidTimeZone } from './geo.service.js';
import { db } from '../../shared/db/knex.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { config } from '../../config/index.js';

const router = Router();

/**
 * GET /api/v1/geo/timezone?browserTz=Europe/London
 * Detected IANA timezone for the requesting client's public IP.
 */
router.get('/timezone', authenticateOptional, async (req, res, next) => {
  try {
    const result = await timezoneResolver.resolve({
      ip: req.ip || '',
      browserTimezone: typeof req.query.browserTz === 'string' ? req.query.browserTz : null
    });

    // If user is authenticated, also return their saved preference
    let savedPreference = null;
    if (req.user?.id) {
      const pref = await db('user_timezone_preferences').where({ user_id: req.user.id }).first().catch(() => null);
      if (pref) {
        savedPreference = { timezone: pref.timezone, source: pref.source };
      }
    }

    return sendSuccess(res, {
      ...result,
      savedPreference,
      // Effective timezone: manual preference wins over IP detection
      effectiveTimezone: savedPreference?.source === 'MANUAL' ? savedPreference.timezone : result.timezone
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/geo/my-timezone
 * Returns the authenticated user's saved timezone preference.
 */
router.get('/my-timezone', authenticate, async (req, res, next) => {
  try {
    const pref = await db('user_timezone_preferences').where({ user_id: req.user.id }).first();
    return sendSuccess(res, pref
      ? { timezone: pref.timezone, source: pref.source, updatedAt: pref.updated_at }
      : { timezone: config.SCHOOL_TIMEZONE, source: 'fallback', updatedAt: null }
    );
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/geo/my-timezone
 * Save or update the authenticated user's timezone preference.
 * Body: { timezone: 'Asia/Karachi', source: 'MANUAL' }
 */
router.put('/my-timezone', authenticate, async (req, res, next) => {
  try {
    const { timezone, source = 'MANUAL' } = req.body;

    if (!timezone || !isValidTimeZone(timezone)) {
      throw new AppError('Invalid IANA timezone string', 422, ErrorCodes.VALIDATION_ERROR);
    }

    // Normalise the source (portals send lowercase 'browser' / 'ip' / 'manual')
    const SOURCE_MAP = { MANUAL: 'MANUAL', BROWSER: 'BROWSER', IP: 'IP_DETECTED', IP_DETECTED: 'IP_DETECTED' };
    const resolvedSource = SOURCE_MAP[String(source || 'MANUAL').toUpperCase()];
    if (!resolvedSource) {
      throw new AppError('source must be MANUAL, BROWSER or IP_DETECTED', 422, ErrorCodes.VALIDATION_ERROR);
    }

    // Do NOT overwrite a MANUAL preference with an auto-detected one
    const existing = await db('user_timezone_preferences').where({ user_id: req.user.id }).first();
    if (existing && existing.source === 'MANUAL' && resolvedSource !== 'MANUAL') {
      // Return existing without overwriting
      return sendSuccess(res, { timezone: existing.timezone, source: existing.source, updatedAt: existing.updated_at });
    }

    if (existing) {
      await db('user_timezone_preferences')
        .where({ user_id: req.user.id })
        .update({ timezone, source: resolvedSource });
    } else {
      await db('user_timezone_preferences').insert({
        user_id: req.user.id,
        timezone,
        source: resolvedSource
      });
    }

    return sendSuccess(res, { timezone, source: resolvedSource });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/geo/my-timezone
 * Clears a manual choice so the portal goes back to automatic (browser) detection.
 */
router.delete('/my-timezone', authenticate, async (req, res, next) => {
  try {
    await db('user_timezone_preferences').where({ user_id: req.user.id }).delete();
    return sendSuccess(res, { timezone: null, source: 'fallback', schoolTimezone: config.SCHOOL_TIMEZONE });
  } catch (error) {
    next(error);
  }
});

export default router;
