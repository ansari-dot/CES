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

    // Token version check (revocation detection)
    if (user.token_version !== decoded.tv) {
      return next(new AppError('Session invalidated, please login again', 401, ErrorCodes.UNAUTHENTICATED));
    }

    // Password change required enforcement (Section 4.3 step 6)
    const allowedPathOnPasswordChange = ['/auth/change-password', '/auth/logout', '/auth/logout-all', '/auth/me'];
    const isAllowedPath = allowedPathOnPasswordChange.some((p) => req.path.endsWith(p));

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
