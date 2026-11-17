import multer from 'multer';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { QR_MAX_BYTES } from './fees.paymentDetails.js';

// QR images are validated (magic bytes, size) before anything is written to disk,
// so they are buffered in memory with a hard 1 MB cap.
const qrMulter = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: QR_MAX_BYTES, files: 1, fields: 20 }
});

export function qrUploadSingle(field) {
  const handler = qrMulter.single(field);
  return (req, res, next) =>
    handler(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError('QR code image must be 1 MB or smaller.', 422, ErrorCodes.VALIDATION_ERROR));
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(new AppError('Only one QR image may be uploaded, in the "qr" field.', 422, ErrorCodes.VALIDATION_ERROR));
      }
      return next(new AppError('QR upload failed. Please try a different image.', 422, ErrorCodes.VALIDATION_ERROR));
    });
}
