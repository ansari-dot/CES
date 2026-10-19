import { AppError } from './AppError.js';
import { ErrorCodes } from './errorCodes.js';

export function errorHandler(err, req, res, next) {
  const requestId = req.id || req.headers['x-request-id'] || 'req-unknown';

  let statusCode = 500;
  let code = ErrorCodes.INTERNAL_SERVER_ERROR;
  let message = 'An unexpected error occurred.';
  let details = null;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err.name === 'ZodError') {
    statusCode = 400;
    code = ErrorCodes.VALIDATION_ERROR;
    message = 'Validation failed';
    details = err.errors.map((e) => ({
      field: e.path.join('.'),
      issue: e.message
    }));
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = ErrorCodes.UNAUTHENTICATED;
    message = 'Invalid authentication token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = ErrorCodes.TOKEN_EXPIRED;
    message = 'Authentication token has expired';
  }

  // Server-side logging with requestId, concealing sensitive stack traces from client
  if (statusCode >= 500) {
    req.log?.error({ err, requestId }, 'Internal server error');
  } else {
    req.log?.warn({ code, message, details, requestId }, 'Handled application error');
  }

  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      requestId
    }
  });
}
