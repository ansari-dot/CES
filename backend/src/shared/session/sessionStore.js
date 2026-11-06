import crypto from 'crypto';
import { db } from '../db/knex.js';
import { getCacheRedis } from '../redis/redisClient.js';
import { config } from '../../config/index.js';

const SESSION_PREFIX = 'sess:';
const USER_SESSIONS_PREFIX = 'user_sess:';
const HEX_64_REGEX = /^[0-9a-f]{64}$/i;

function getRedis() {
  try {
    return getCacheRedis();
  } catch {
    return null;
  }
}

export const sessionStore = {
  /**
   * Generates a 256-bit cryptographically secure, unpredictable session ID
   */
  generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
  },

  /**
   * Creates a new server-side session in Redis (L1) and MySQL user_sessions (L2)
   */
  async createSession({ userId, roleCode, userAgent = null, ipAddress = null, rememberMe = false }) {
    const sessionId = this.generateSessionId();
    const now = new Date();

    // Session expiration policy
    // When rememberMe is false: 24h idle expiry (or configured ACCESS_TTL_MIN)
    // When rememberMe is true: REFRESH_IDLE_DAYS (e.g. 30 days)
    const idleTtlMs = rememberMe
      ? config.REFRESH_IDLE_DAYS * 24 * 60 * 60 * 1000
      : (config.ACCESS_TTL_MIN || 1440) * 60 * 1000;
    const absTtlMs = rememberMe
      ? config.REFRESH_ABS_DAYS * 24 * 60 * 60 * 1000
      : (config.ACCESS_TTL_MIN || 1440) * 60 * 1000;

    const idleExpiresAt = new Date(now.getTime() + idleTtlMs);
    const absoluteExpiresAt = new Date(now.getTime() + absTtlMs);

    const sessionData = {
      sessionId,
      userId: Number(userId),
      roleCode,
      userAgent: userAgent ? String(userAgent).substring(0, 255) : null,
      ipAddress: ipAddress ? String(ipAddress).substring(0, 45) : null,
      isRemember: Boolean(rememberMe),
      idleExpiresAt: idleExpiresAt.toISOString(),
      absoluteExpiresAt: absoluteExpiresAt.toISOString(),
      lastActivityAt: now.toISOString(),
      createdAt: now.toISOString()
    };

    // 1. Persistent Database Store (L2) - survives server reboots
    try {
      await db('user_sessions').insert({
        session_id: sessionId,
        user_id: userId,
        role_code: roleCode,
        ip_address: sessionData.ipAddress,
        user_agent: sessionData.userAgent,
        is_remember: sessionData.isRemember ? 1 : 0,
        idle_expires_at: idleExpiresAt,
        absolute_expires_at: absoluteExpiresAt,
        last_activity_at: now,
        created_at: now
      });
    } catch (err) {
      console.error('[SessionStore] Error persisting session to MySQL:', err.message);
      throw err;
    }

    // 2. Redis Store (L1) - sub-millisecond in-memory cache
    const redis = getRedis();
    if (redis) {
      try {
        const ttlSec = Math.max(1, Math.floor(idleTtlMs / 1000));
        const key = `${SESSION_PREFIX}${sessionId}`;
        await redis.setex(key, ttlSec, JSON.stringify(sessionData));
        await redis.sadd(`${USER_SESSIONS_PREFIX}${userId}`, sessionId);
        // expire user set after absolute TTL
        await redis.expire(`${USER_SESSIONS_PREFIX}${userId}`, Math.floor(absTtlMs / 1000));
      } catch (err) {
        console.warn('[SessionStore] Redis cache write failed, falling back to database:', err.message);
      }
    }

    return {
      sessionId,
      idleExpiresAt,
      absoluteExpiresAt,
      isRemember: Boolean(rememberMe)
    };
  },

  /**
   * Retrieves and validates an active session
   */
  async getSession(sessionId) {
    if (!sessionId || typeof sessionId !== 'string' || !HEX_64_REGEX.test(sessionId)) {
      return null;
    }

    const redis = getRedis();
    let session = null;

    // 1. Check Redis cache first
    if (redis) {
      try {
        const raw = await redis.get(`${SESSION_PREFIX}${sessionId}`);
        if (raw) {
          session = JSON.parse(raw);
        }
      } catch (err) {
        console.warn('[SessionStore] Redis get error:', err.message);
      }
    }

    // 2. If not in Redis, check MySQL database
    if (!session) {
      const row = await db('user_sessions')
        .where({ session_id: sessionId })
        .whereNull('revoked_at')
        .first();

      if (!row) return null;

      const now = new Date();
      if (new Date(row.idle_expires_at) < now || new Date(row.absolute_expires_at) < now) {
        return null;
      }

      session = {
        sessionId: row.session_id,
        userId: Number(row.user_id),
        roleCode: row.role_code,
        userAgent: row.user_agent,
        ipAddress: row.ip_address,
        isRemember: Boolean(row.is_remember),
        idleExpiresAt: new Date(row.idle_expires_at).toISOString(),
        absoluteExpiresAt: new Date(row.absolute_expires_at).toISOString(),
        lastActivityAt: new Date(row.last_activity_at).toISOString(),
        createdAt: new Date(row.created_at).toISOString()
      };

      // Re-hydrate Redis cache
      if (redis) {
        try {
          const remainingSec = Math.max(1, Math.floor((new Date(row.idle_expires_at) - now) / 1000));
          await redis.setex(`${SESSION_PREFIX}${sessionId}`, remainingSec, JSON.stringify(session));
          await redis.sadd(`${USER_SESSIONS_PREFIX}${row.user_id}`, sessionId);
        } catch (_) {}
      }
    }

    // 3. Verify expiration
    const now = new Date();
    if (new Date(session.idleExpiresAt) < now || new Date(session.absoluteExpiresAt) < now) {
      await this.revokeSession(sessionId, 'EXPIRED');
      return null;
    }

    // 4. Update lastActivityAt if more than 60 seconds have elapsed (throttled touch)
    const lastActive = new Date(session.lastActivityAt).getTime();
    if (now.getTime() - lastActive > 60000) {
      session.lastActivityAt = now.toISOString();

      if (redis) {
        try {
          const remainingSec = Math.max(1, Math.floor((new Date(session.idleExpiresAt) - now) / 1000));
          await redis.setex(`${SESSION_PREFIX}${sessionId}`, remainingSec, JSON.stringify(session));
        } catch (_) {}
      }

      // Background update in DB (no await blocking)
      db('user_sessions')
        .where({ session_id: sessionId })
        .update({ last_activity_at: now })
        .catch(() => {});
    }

    return session;
  },

  /**
   * Revokes a specific session
   */
  async revokeSession(sessionId, reason = 'LOGOUT') {
    if (!sessionId || typeof sessionId !== 'string' || !HEX_64_REGEX.test(sessionId)) {
      return;
    }

    // Mark revoked in MySQL
    try {
      const updated = await db('user_sessions')
        .where({ session_id: sessionId })
        .whereNull('revoked_at')
        .update({
          revoked_at: new Date(),
          revoke_reason: reason
        });

      if (updated) {
        const row = await db('user_sessions').select('user_id').where({ session_id: sessionId }).first();
        if (row) {
          const redis = getRedis();
          if (redis) {
            await redis.srem(`${USER_SESSIONS_PREFIX}${row.user_id}`, sessionId).catch(() => {});
          }
        }
      }
    } catch (err) {
      console.warn('[SessionStore] Revoke error in DB:', err.message);
    }

    // Delete from Redis
    const redis = getRedis();
    if (redis) {
      try {
        await redis.del(`${SESSION_PREFIX}${sessionId}`);
      } catch (err) {
        console.warn('[SessionStore] Revoke error in Redis:', err.message);
      }
    }
  },

  /**
   * Revokes all active sessions for a user (Logout from all devices)
   */
  async revokeAllUserSessions(userId, reason = 'LOGOUT_ALL') {
    if (!userId) return;

    // Mark all revoked in MySQL
    try {
      await db('user_sessions')
        .where({ user_id: userId })
        .whereNull('revoked_at')
        .update({
          revoked_at: new Date(),
          revoke_reason: reason
        });
    } catch (err) {
      console.warn('[SessionStore] Error revoking all sessions in DB:', err.message);
    }

    // Clear from Redis
    const redis = getRedis();
    if (redis) {
      try {
        const sessionIds = await redis.smembers(`${USER_SESSIONS_PREFIX}${userId}`);
        if (sessionIds && sessionIds.length > 0) {
          const keys = sessionIds.map((sid) => `${SESSION_PREFIX}${sid}`);
          await redis.del(...keys);
        }
        await redis.del(`${USER_SESSIONS_PREFIX}${userId}`);
      } catch (err) {
        console.warn('[SessionStore] Error revoking all sessions in Redis:', err.message);
      }
    }
  },

  /**
   * Session ID rotation after authentication or privilege changes (Prevents session fixation)
   */
  async rotateSession(oldSessionId, { userId, roleCode, userAgent, ipAddress, rememberMe }) {
    if (oldSessionId) {
      await this.revokeSession(oldSessionId, 'ROTATED');
    }
    return await this.createSession({ userId, roleCode, userAgent, ipAddress, rememberMe });
  }
};

