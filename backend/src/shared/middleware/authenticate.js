import { verifyAccessToken } from '../crypto/tokens.js';
import { getCookieNames } from '../http/cookies.js';
import { authRepository } from '../../modules/auth/auth.repository.js';
import { sessionStore } from '../session/sessionStore.js';
import { AppError } from '../errors/AppError.js';
import { ErrorCodes } from '../errors/errorCodes.js';

export async function authenticate(req, res, next) {
  try {
    const cookieNames = getCookieNames();
    const sessionId = req.cookies[cookieNames.sessionId] || req.cookies['__Host-sms_sid'] || req.cookies['sms_sid'];
    const token = req.cookies[cookieNames.accessToken] || req.cookies['__Host-sms_at'] || req.cookies['sms_at'];

    if (!sessionId && !token) {
      return next(new AppError('Authentication required', 401, ErrorCodes.UNAUTHENTICATED));
    }

    let userId = null;
    let decoded = null;
    let activeSession = null;

    // 1. Primary: Server-Side Session Validation
    if (sessionId) {
      activeSession = await sessionStore.getSession(sessionId);
      if (activeSession) {
        userId = activeSession.userId;
        req.session = activeSession;
      }
    }

    // 2. Fallback: JWT Access Token validation (for zero-downtime transition)
    if (!userId && token) {
      try {
        decoded = verifyAccessToken(token);
        userId = Number(decoded.sub);
      } catch (err) {
        if (err.name === 'TokenExpiredError') {
          return next(new AppError('Session has expired', 401, ErrorCodes.TOKEN_EXPIRED));
        }
      }
    }

    if (!userId) {
      return next(new AppError('Invalid or expired session', 401, ErrorCodes.UNAUTHENTICATED));
    }

    const user = await authRepository.findUserById(userId);
    if (!user) {
      return next(new AppError('User not found', 401, ErrorCodes.UNAUTHENTICATED));
    }

    // Account status validation
    if (user.status === 'DEACTIVATED') {
      return next(new AppError('Account is deactivated', 403, ErrorCodes.ACCOUNT_RESTRICTED));
    }

    // Fee-based restriction: SUSPENDED students are blocked from protected routes
    // Session/account endpoints and /students/me/dashboard stay available
    if (user.status === 'SUSPENDED' && user.role_code === 'STUDENT') {
      const allowedWhileSuspended = [
        '/api/v1/auth/logout',
        '/api/v1/auth/logout-all',
        '/api/v1/auth/me',
        '/api/v1/auth/change-password',
        '/api/v1/students/me/dashboard'
      ];
      const fullPath = `${req.baseUrl}${req.path}`.replace(/\/+$/, '');
      const isAllowed = allowedWhileSuspended.includes(fullPath);
      if (!isAllowed) {
        return next(
          new AppError(
            'Portal access is restricted due to outstanding fee dues. Please contact the Principal.',
            403,
            ErrorCodes.ACCOUNT_SUSPENDED
          )
        );
      }
    }

    // Token version check (revocation detection for JWT fallback)
    if (decoded && user.token_version !== decoded.tv) {
      return next(new AppError('Session invalidated, please login again', 401, ErrorCodes.UNAUTHENTICATED));
    }

    // Password change required enforcement
    const allowedPathOnPasswordChange = [
      '/api/v1/auth/change-password',
      '/api/v1/auth/logout',
      '/api/v1/auth/logout-all',
      '/api/v1/auth/me'
    ];
    const isAllowedPath = allowedPathOnPasswordChange.includes(`${req.baseUrl}${req.path}`.replace(/\/+$/, ''));

    if (user.must_change_password && !isAllowedPath) {
      return next(
        new AppError('Password change required before accessing other resources', 403, ErrorCodes.PASSWORD_CHANGE_REQUIRED)
      );
    }

    const permissions = await authRepository.getRolePermissions(user.role_id);

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role_code,
      role_code: user.role_code,
      roleId: user.role_id,
      sid: activeSession?.sessionId || decoded?.sid || sessionId,
      permissions
    };

    next();
  } catch (error) {
    next(error);
  }
}

export async function authenticateOptional(req, res, next) {
  try {
    const cookieNames = getCookieNames();
    const sessionId = req.cookies[cookieNames.sessionId] || req.cookies['__Host-sms_sid'] || req.cookies['sms_sid'];
    const token = req.cookies[cookieNames.accessToken] || req.cookies['__Host-sms_at'] || req.cookies['sms_at'];

    if (!sessionId && !token) {
      return next();
    }

    let userId = null;
    let decoded = null;
    let activeSession = null;

    if (sessionId) {
      activeSession = await sessionStore.getSession(sessionId);
      if (activeSession) {
        userId = activeSession.userId;
        req.session = activeSession;
      }
    }

    if (!userId && token) {
      try {
        decoded = verifyAccessToken(token);
        userId = Number(decoded.sub);
      } catch {
        // ignore
      }
    }

    if (!userId) {
      return next();
    }

    const user = await authRepository.findUserById(userId);
    if (!user || user.status === 'DEACTIVATED' || (decoded && user.token_version !== decoded.tv)) {
      return next();
    }

    const permissions = await authRepository.getRolePermissions(user.role_id);

    req.user = {
      id: user.id,
      username: user.username,
      role: user.role_code,
      role_code: user.role_code,
      roleId: user.role_id,
      sid: activeSession?.sessionId || decoded?.sid || sessionId,
      permissions
    };

    next();
  } catch {
    next();
  }
}
