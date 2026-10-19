import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { upload, streamFile, UPLOAD_ROOT } from '../../shared/storage/upload.js';
import { authenticate } from '../../shared/middleware/authenticate.js';
import { sendSuccess } from '../../shared/http/response.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';

const router = Router();

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// 1. Upload File Endpoint
router.post('/', authenticate, upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError('No file uploaded', 422, ErrorCodes.VALIDATION_ERROR);
    }

    const fileUrl = `/api/v1/uploads/${req.file.filename}`;
    const fileSizeFormatted = formatFileSize(req.file.size);

    return sendSuccess(
      res,
      {
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileUrl,
        fileSize: fileSizeFormatted,
        sizeBytes: req.file.size,
        mimeType: req.file.mimetype
      },
      null,
      201
    );
  } catch (error) {
    next(error);
  }
});

// 2. Stream / Download File with Range Requests & Buffer Streaming
router.get('/:filename', (req, res, next) => {
  try {
    // Prevent directory traversal attacks
    const safeFilename = path.basename(req.params.filename);
    const filePath = path.join(UPLOAD_ROOT, safeFilename);

    if (!fs.existsSync(filePath)) {
      throw new AppError('File not found', 404, ErrorCodes.NOT_FOUND);
    }

    return streamFile(req, res, filePath);
  } catch (error) {
    next(error);
  }
});

export default router;
