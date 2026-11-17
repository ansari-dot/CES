import { Router } from 'express';
import { createRateLimiter } from '../../shared/middleware/rateLimit.js';
import { challanInfoQrService, renderVerifyPage } from './fees.infoQr.js';

// Public (no login) challan verification opened by scanning the information QR.
// The signed token prevents guessing other challans; the page shows masked data only.
const router = Router();

const verifyLimiter = createRateLimiter({
  keyPrefix: 'challan-verify',
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: 'Too many verification requests. Please try again later.'
});

router.get('/verify/:token', verifyLimiter, async (req, res, next) => {
  try {
    const data = await challanInfoQrService.verify(req.params.token);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.status(data ? 200 : 404).type('html').send(renderVerifyPage(data));
  } catch (err) {
    next(err);
  }
});

export default router;
