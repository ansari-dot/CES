import { AppError } from '../errors/AppError.js';
import { ErrorCodes } from '../errors/errorCodes.js';

export function validate(schema) {
  return async (req, res, next) => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query);
      }
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params);
      }
      next();
    } catch (error) {
      if (error.errors) {
        const details = error.errors.map((e) => ({
          field: e.path.join('.'),
          issue: e.message
        }));
        return next(new AppError('Validation failed', 400, ErrorCodes.VALIDATION_ERROR, details));
      }
      next(error);
    }
  };
}
