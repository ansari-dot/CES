import { verifyAccessToken } from '../crypto/tokens.js';
import { getCookieNames } from '../http/cookies.js';
import { authRepository } from '../../modules/auth/auth.repository.js';
import { AppError } from '../errors/AppError.js';
import { ErrorCodes } from '../errors/errorCodes.js';

export async function authenticate(req, res, next) {
  try {
    const cookieNames = getCookieNames();
    const token = req.cookies[cookieNames.accessToken] || req.cookies['sms_at'];

    if (!token) {
      return next(new AppError('Authentication required', 401, ErrorCodes.UNAUTHENTICATED));
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new AppError('Token has expired', 401, ErrorCodes.TOKEN_EXPIRED));
      }
      return next(new AppError('Invalid token', 401, ErrorCodes.UNAUTHENTICATED));
    }

    const userId = Number(decoded.sub);
    const user = await authRepository.findUserById(userId);

    if (!user) {
      return next(new AppError('User not found', 401, ErrorCodes.UNAUTHENTICATED));
    }

    // Check status
    if (user.status === 'DEACTIVATED') {
      return next(new AppError('Account is deactivated', 403, ErrorCodes.ACCOUNT_RESTRICTED));
    }

    // Fee-based restriction: SUSPENDED students are blocked from protected
    // routes. Session/account endpoints and /students/me/dashboard (which
    // returns the restriction notice and outstanding fees) stay available.
    if (user.status === 'SUSPENDED' && user.role_code === 'STUDENT') {
      const allowedWhileSuspended = [
        '/api/v1/auth/logout', '/api/v1/auth/logout-all', '/api/v1/auth/me',
        '/api/v1/auth/change-password', '/api/v1/students/me/dashboard'
      ];
      // req.path is relative to the router mount point, so use the full path
      const fullPath = `${req.baseUrl}${req.path}`.replace(/\/+$/, '');
      const isAllowed = allowedWhileSuspended.includes(fullPath);
      if (!isAllowed) {
        return next(new AppError(
          'Portal access is restricted due to outstanding fee dues. Please contact the Principal.',
          403,
          ErrorCodes.ACCOUNT_SUSPENDED
        ));
      }
    }

    // Token version check (revocation detection)
    if (user.token_version !== decoded.tv) {
      return next(new AppError('Session invalidated, please login again', 401, ErrorCodes.UNAUTHENTICATED));
    }

    // Password change required enforcement (Section 4.3 step 6)
    // First login: only session endpoints and change-password are available until
    // the temporary password is replaced. req.path is router-relative, so use the full path.
    const allowedPathOnPasswordChange = [
      '/api/v1/auth/change-password', '/api/v1/auth/logout', '/api/v1/auth/logout-all', '/api/v1/auth/me'
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
      roleId: user.role_id,
      sid: decoded.sid,
      permissions
    };

    next();
  } catch (error) {
    next(error);
  }
}
