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

    // In development mode, skip CSRF for local testing; enforce in test and production
    if (config.NODE_ENV === 'development') {
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

    // 2. Extract potential session / token identifiers
    let familyId = req.user?.sid;
    const cookieNames = getCookieNames();
    const sessionId = req.cookies[cookieNames.sessionId] || req.cookies['__Host-sms_sid'] || req.cookies['sms_sid'];
    const token = req.cookies[cookieNames.accessToken] || req.cookies['__Host-sms_at'] || req.cookies['sms_at'];
    let tokenSid = null;
    if (token) {
      try {
        const decoded = verifyAccessToken(token);
        tokenSid = decoded.sid;
      } catch {
        // Token invalid or expired
      }
    }

    // 3. Double-submit token check
    const headerToken = req.headers['x-csrf-token'];
    const cookieToken = req.cookies[cookieNames.csrf] || req.cookies['sms_csrf'];
    const csrfToken = headerToken || cookieToken;

    if (!csrfToken) {
      return next(new AppError('Invalid or missing CSRF token', 403, ErrorCodes.CSRF_INVALID));
    }

    // Comprehensive multi-factor validation
    const isValid =
      verifyCsrfToken(csrfToken) ||
      (familyId && verifyCsrfToken(csrfToken, familyId)) ||
      (sessionId && verifyCsrfToken(csrfToken, sessionId)) ||
      (tokenSid && verifyCsrfToken(csrfToken, tokenSid)) ||
      verifyCsrfToken(csrfToken, 'anonymous') ||
      (headerToken && cookieToken && headerToken === cookieToken);

    if (!isValid) {
      return next(new AppError('Invalid or missing CSRF token', 403, ErrorCodes.CSRF_INVALID));
    }

    next();
  };
}
