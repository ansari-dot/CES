import { getCacheRedis } from '../redis/redisClient.js';
import { AppError } from '../errors/AppError.js';
import { ErrorCodes } from '../errors/errorCodes.js';

const memoryStore = new Map();

/**
 * Creates a rate limiter middleware backed by Redis with in-memory fallback
 *
 * @param {Object} options
 * @param {string} options.keyPrefix Prefix for Redis keys
 * @param {number} options.windowMs Window duration in milliseconds (e.g. 15 * 60 * 1000)
 * @param {number} options.max Maximum requests per window
 * @param {string} options.message Error message on limit exceed
 */
export function createRateLimiter({ keyPrefix, windowMs, max, message }) {
  const windowSec = Math.ceil(windowMs / 1000);

  return async (req, res, next) => {
    if (process.env.NODE_ENV === 'test') {
      return next();
    }
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const key = `ratelimit:${keyPrefix}:${ip}`;

    try {
      const redis = getCacheRedis();
      if (redis) {
        const count = await redis.incr(key);
        if (count === 1) {
          await redis.expire(key, windowSec);
        }

        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, max - count));

        if (count > max) {
          const ttl = await redis.ttl(key);
          res.setHeader('Retry-After', ttl > 0 ? ttl : windowSec);
          return next(new AppError(message || 'Too many attempts. Please try again later.', 429, ErrorCodes.RATE_LIMIT_EXCEEDED));
        }

        return next();
      }
    } catch (_) {
      // Redis unavailable, fallback to in-memory map
    }

    // In-memory fallback
    const now = Date.now();
    let record = memoryStore.get(key);

    if (!record || record.resetAt <= now) {
      record = { count: 1, resetAt: now + windowMs };
      memoryStore.set(key, record);
    } else {
      record.count += 1;
    }

    // Periodic map cleanup
    if (memoryStore.size > 10000) {
      for (const [k, v] of memoryStore.entries()) {
        if (v.resetAt <= now) memoryStore.delete(k);
      }
    }

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));

    if (record.count > max) {
      const retrySec = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader('Retry-After', retrySec);
      return next(new AppError(message || 'Too many attempts. Please try again later.', 429, ErrorCodes.RATE_LIMIT_EXCEEDED));
    }

    return next();
  };
}

export const loginRateLimiter = createRateLimiter({
  keyPrefix: 'login',
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: 'Too many login attempts from this network. Please wait a few minutes before trying again.'
});

export const passwordResetRateLimiter = createRateLimiter({
  keyPrefix: 'pwd_reset',
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: 'Too many password reset requests. Please wait a few minutes before trying again.'
});

