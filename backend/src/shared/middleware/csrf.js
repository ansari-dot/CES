import { AppError } from '../errors/AppError.js';
import { ErrorCodes } from '../errors/errorCodes.js';
import { verifyCsrfToken, verifyAccessToken } from '../crypto/tokens.js';
import { getCookieNames } from '../http/cookies.js';
import { config } from '../../config/index.js';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function csrfProtection(options = {}) {
  const { exemptPaths = [] } = options;

  return (req, res, next) => {
    // Only check state-changing methods
    if (!STATE_CHANGING_METHODS.has(req.method)) {
      return next();
    }

    // In development, skip CSRF — double-submit cookie only guards against
    // cross-site attacks which cannot occur on localhost.
    if (!config.isProduction) {
      return next();
    }

    // Check exempt paths (e.g. webhooks, login, forgot password, refresh)
    const isExempt = exemptPaths.some((p) => {
      if (typeof p === 'string') return req.path === p || req.originalUrl === p;
      if (p instanceof RegExp) return p.test(req.path) || p.test(req.originalUrl);
      return false;
    });

    if (isExempt) {
      return next();
    }

    // 1. Origin / Referer check
    const origin = req.headers['origin'];
    if (origin && !config.allowedOrigins.includes(origin) && config.isProduction) {
      return next(new AppError('Forbidden origin', 403, ErrorCodes.CSRF_INVALID));
    }

    // 2. Extract session family id (sid) from user or access token cookie
    let familyId = req.user?.sid;
    if (!familyId) {
      const cookieNames = getCookieNames();
      const token = req.cookies[cookieNames.accessToken] || req.cookies['sms_at'];
      if (token) {
        try {
          const decoded = verifyAccessToken(token);
          familyId = decoded.sid;
        } catch {
          // Token invalid or expired, fallback to anonymous
        }
      }
    }

    // 3. Double-submit token check
    const csrfToken = req.headers['x-csrf-token'];
    const valid = verifyCsrfToken(csrfToken, familyId || 'anonymous');

    if (!csrfToken || !valid) {
      return next(new AppError('Invalid or missing CSRF token', 403, ErrorCodes.CSRF_INVALID));
    }

    next();
  };
}
