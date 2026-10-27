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
  } else if (err.name === 'MulterError') {
    statusCode = 422;
    code = ErrorCodes.VALIDATION_ERROR;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'The uploaded file exceeds the maximum allowed size (100 MB).' : `File upload failed: ${err.message}`;
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
  } else if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
    statusCode = 409;
    code = ErrorCodes.CONFLICT;
    const msg = err.sqlMessage || err.message || '';
    if (msg.includes('users_email_unique') || msg.includes('email')) {
      message = 'An account with this email address already exists.';
    } else if (msg.includes('users_phone_unique') || msg.includes('phone')) {
      message = 'An account with this phone number already exists.';
    } else if (msg.includes('employee_no')) {
      message = 'A teacher with this staff identifier / employee number already exists.';
    } else if (msg.includes('admission_no')) {
      message = 'A student with this admission number already exists.';
    } else if (msg.includes('users_username_unique') || msg.includes('username')) {
      message = 'An account with this username already exists.';
    } else {
      message = 'A record with duplicate unique information already exists.';
    }
    details = [{ issue: msg }];
  } else if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.errno === 1452) {
    statusCode = 400;
    code = ErrorCodes.VALIDATION_ERROR;
    message = 'Referenced record or entity does not exist.';
    details = [{ issue: err.sqlMessage || err.message }];
  }

  // Attach original error to response so pino-http logs the true underlying error
  res.err = err;

  // Server-side logging with requestId, concealing sensitive stack traces from client
  if (statusCode >= 500) {
    console.error(`\n❌ [500 INTERNAL SERVER ERROR] ${req.method} ${req.originalUrl || req.url}`);
    console.error(err);
    req.log?.error({ err, requestId }, 'Internal server error');
  } else {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`⚠️ [${statusCode} ${code}] ${req.method} ${req.originalUrl || req.url} - ${message}`);
    }
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
