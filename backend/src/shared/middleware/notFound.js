import { AppError } from '../errors/AppError.js';
import { ErrorCodes } from '../errors/errorCodes.js';

export function notFound(req, res, next) {
  next(new AppError(`Endpoint ${req.method} ${req.originalUrl} not found`, 404, ErrorCodes.NOT_FOUND));
}
