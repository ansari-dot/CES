import { AppError } from '../errors/AppError.js';
import { ErrorCodes } from '../errors/errorCodes.js';

export function authorize(requiredPermission) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, ErrorCodes.UNAUTHENTICATED));
    }

    // Administrator and Principal roles have full administrative authority
    if (req.user.role === 'ADMIN' || req.user.role === 'PRINCIPAL') {
      return next();
    }

    // Role-permission check
    const hasPermission = req.user.permissions?.includes(requiredPermission);
    if (!hasPermission) {
      return next(new AppError('Forbidden: insufficient permissions', 403, ErrorCodes.FORBIDDEN));
    }

    next();
  };
}
