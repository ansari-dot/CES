import Redis from 'ioredis';
import { config } from '../../config/index.js';

let cacheRedis = null;
let queueRedis = null;
let redisHealthy = false;

/**
 * Parse Redis URL into host, port, db, password options for BullMQ and ioredis
 */
export function parseRedisUrl(urlString) {
  try {
    const url = new URL(urlString);
    const db = url.pathname && url.pathname.length > 1 ? parseInt(url.pathname.slice(1), 10) : 0;
    return {
      host: url.hostname || '127.0.0.1',
      port: parseInt(url.port || '6379', 10),
      password: url.password || undefined,
      username: url.username || undefined,
      db: isNaN(db) ? 0 : db
    };
  } catch {
    return {
      host: '127.0.0.1',
      port: 6379,
      db: 0
    };
  }
}

/**
 * Get shared Cache Redis instance (DB 0 by default)
 */
export function getCacheRedis() {
  if (cacheRedis) return cacheRedis;

  const opts = parseRedisUrl(config.REDIS_CACHE_URL);
  cacheRedis = new Redis({
    ...opts,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      if (times > 5) return null;
      return Math.min(times * 200, 2000);
    }
  });

  cacheRedis.on('connect', () => {
    redisHealthy = true;
  });

  cacheRedis.on('error', (err) => {
    // Non-fatal warning to avoid crashing the whole API if Redis restarts
    if (config.NODE_ENV !== 'test') {
      console.warn(`[Redis Cache] Connection error: ${err.message}`);
    }
  });

  return cacheRedis;
}

/**
 * Get shared Queue Redis instance for BullMQ (DB 1 by default, maxRetriesPerRequest: null required)
 */
export function getQueueRedis() {
  if (queueRedis) return queueRedis;

  const opts = parseRedisUrl(config.REDIS_QUEUE_URL);
  queueRedis = new Redis({
    ...opts,
    lazyConnect: true,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      if (times > 5) return null;
      return Math.min(times * 200, 2000);
    }
  });

  queueRedis.on('error', (err) => {
    if (config.NODE_ENV !== 'test') {
      console.warn(`[Redis Queue] Connection error: ${err.message}`);
    }
  });

  return queueRedis;
}

/**
 * Get connection options object specifically for BullMQ Queue and Worker constructors
 */
export function getBullMQConnectionOptions() {
  const opts = parseRedisUrl(config.REDIS_QUEUE_URL);
  return {
    ...opts,
    maxRetriesPerRequest: null,
    enableReadyCheck: false
  };
}

/**
 * Test Redis connectivity on startup
 */
export async function testRedisConnection(force = false) {
  if (config.isTest && !force) {
    return false;
  }

  try {
    const client = getCacheRedis();
    if (client.status !== 'ready' && client.status !== 'connecting') {
      await client.connect();
    }
    const pong = await client.ping();
    redisHealthy = pong === 'PONG';
    return redisHealthy;
  } catch (err) {
    redisHealthy = false;
    console.warn(`⚠️ Warning: Redis connection check failed (${err.message}). BullMQ will run in fallback mode.`);
    return false;
  }
}

/**
 * Check current health and server info of Redis
 */
export async function getRedisStatus() {
  try {
    const client = getCacheRedis();
    const pong = await client.ping();
    const infoRaw = await client.info();
    const lines = infoRaw.split('\r\n');
    const versionLine = lines.find((l) => l.startsWith('redis_version:'));
    const version = versionLine ? versionLine.split(':')[1] : 'unknown';

    return {
      connected: pong === 'PONG',
      version,
      cacheUrl: config.REDIS_CACHE_URL,
      queueUrl: config.REDIS_QUEUE_URL
    };
  } catch (err) {
    return {
      connected: false,
      error: err.message,
      cacheUrl: config.REDIS_CACHE_URL,
      queueUrl: config.REDIS_QUEUE_URL
    };
  }
}

/**
 * Close all active Redis connections gracefully
 */
export async function closeRedisConnections() {
  const promises = [];
  if (cacheRedis) {
    promises.push(cacheRedis.quit().catch(() => {}));
    cacheRedis = null;
  }
  if (queueRedis) {
    promises.push(queueRedis.quit().catch(() => {}));
    queueRedis = null;
  }
  await Promise.all(promises);
}
