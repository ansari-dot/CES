import { Queue, Worker } from 'bullmq';
import { config } from '../../config/index.js';
import { getBullMQConnectionOptions, testRedisConnection, getRedisStatus } from '../redis/redisClient.js';
import { dispatchSocketEvent } from '../realtime/eventEmitter.js';

/**
 * Queue Identifiers
 */
export const QUEUE_NAMES = {
  REALTIME_EVENTS: 'sms-realtime-events',
  NOTIFICATIONS: 'sms-notifications',
  ZOOM_EVENTS: 'sms-zoom-events',
  SCHEDULERS: 'sms-schedulers'
};

const queues = {};
const workers = {};
let isInitialized = false;

// Dynamic service references to avoid circular dependency cycles
let zoomServiceRef = null;
let emailServiceRef = null;
let feeLifecycleRef = null;
let zoomScheduleTickRef = null;

export function registerQueueHandlers({ zoomService, emailService, runFeeLifecycle, runZoomScheduleTick }) {
  if (zoomService) zoomServiceRef = zoomService;
  if (emailService) emailServiceRef = emailService;
  if (runFeeLifecycle) feeLifecycleRef = runFeeLifecycle;
  if (runZoomScheduleTick) zoomScheduleTickRef = runZoomScheduleTick;
}

/**
 * Initializes BullMQ queues, workers, and repeatable schedulers
 */
export async function initQueueManager({ force = false } = {}) {
  if (isInitialized) return { success: true, message: 'Queue manager already initialized' };

  if (config.isTest && !force) {
    return { success: false, reason: 'TEST_MODE_IN_MEMORY' };
  }

  const isConnected = await testRedisConnection(force);
  if (!isConnected) {
    console.warn('⚠️ BullMQ Queue Manager: Local Redis is not accessible. Running in direct fallback mode.');
    return { success: false, reason: 'REDIS_UNAVAILABLE' };
  }

  const connection = getBullMQConnectionOptions();

  try {
    // -------------------------------------------------------------
    // 1. Realtime Events Queue & Worker
    // -------------------------------------------------------------
    queues.realtimeEvents = new Queue(QUEUE_NAMES.REALTIME_EVENTS, { connection });
    workers.realtimeEvents = new Worker(
      QUEUE_NAMES.REALTIME_EVENTS,
      async (job) => {
        const { event, payload, options } = job.data;
        dispatchSocketEvent(event, payload, options);
        return { delivered: true, event };
      },
      { connection, concurrency: 10 }
    );

    // -------------------------------------------------------------
    // 2. Notifications & Async Email Queue & Worker
    // -------------------------------------------------------------
    queues.notifications = new Queue(QUEUE_NAMES.NOTIFICATIONS, { connection });
    workers.notifications = new Worker(
      QUEUE_NAMES.NOTIFICATIONS,
      async (job) => {
        const { name, data } = job;
        if (name === 'send-email') {
          if (!emailServiceRef) {
            const { emailService } = await import('../email/email.service.js');
            emailServiceRef = emailService;
          }
          return await emailServiceRef.sendMail(data);
        }
        return { processed: true, name };
      },
      { connection, concurrency: 5 }
    );

    // -------------------------------------------------------------
    // 3. Zoom Webhook Events Queue & Worker
    // -------------------------------------------------------------
    queues.zoomEvents = new Queue(QUEUE_NAMES.ZOOM_EVENTS, { connection });
    workers.zoomEvents = new Worker(
      QUEUE_NAMES.ZOOM_EVENTS,
      async (job) => {
        const { eventData, reqHeaders } = job.data;
        if (!zoomServiceRef) {
          const { zoomService } = await import('../../modules/zoom/zoom.service.js');
          zoomServiceRef = zoomService;
        }
        return await zoomServiceRef.handleWebhookEvent(eventData, { headers: reqHeaders });
      },
      { connection, concurrency: 3 }
    );

    // -------------------------------------------------------------
    // 4. System Schedulers Queue & Repeatable Workers
    // -------------------------------------------------------------
    queues.schedulers = new Queue(QUEUE_NAMES.SCHEDULERS, { connection });
    workers.schedulers = new Worker(
      QUEUE_NAMES.SCHEDULERS,
      async (job) => {
        if (job.name === 'fee-lifecycle-tick') {
          if (!feeLifecycleRef) {
            const { runFeeLifecycle } = await import('../../modules/fees/fees.scheduler.js');
            feeLifecycleRef = runFeeLifecycle;
          }
          const summary = await feeLifecycleRef();
          return { type: 'fee-lifecycle', summary };
        }

        if (job.name === 'zoom-timetable-tick') {
          if (!zoomScheduleTickRef) {
            const { runZoomScheduleTick } = await import('../../modules/zoom/zoom.scheduler.js');
            zoomScheduleTickRef = runZoomScheduleTick;
          }
          const summary = await zoomScheduleTickRef();
          return { type: 'zoom-timetable', summary };
        }

        return { ignored: true, name: job.name };
      },
      { connection, concurrency: 1 }
    );

    // Register repeatable job schedulers
    if (config.feeSchedulerEnabled) {
      await queues.schedulers.upsertJobScheduler(
        'fee-lifecycle-hourly',
        { every: 60 * 60 * 1000 }, // Every hour
        { name: 'fee-lifecycle-tick', data: { source: 'bullmq-scheduler' } }
      );
    }

    await queues.schedulers.upsertJobScheduler(
      'zoom-timetable-recurring',
      { every: 30 * 1000 }, // Every 30 seconds
      { name: 'zoom-timetable-tick', data: { source: 'bullmq-scheduler' } }
    );

    // Register error listeners for workers to prevent unhandled rejections
    for (const [key, worker] of Object.entries(workers)) {
      worker.on('error', (err) => {
        console.warn(`[BullMQ Worker: ${key}] Error:`, err.message);
      });
      worker.on('failed', (job, err) => {
        console.warn(`[BullMQ Job: ${key}:${job?.name}] Failed:`, err.message);
      });
    }

    isInitialized = true;
    console.log('🐂 BullMQ Queue Manager initialized successfully on Redis (DB 1).');
    console.log('   - Realtime Events Queue active');
    console.log('   - Notifications & Email Queue active');
    console.log('   - Zoom Webhooks Queue active');
    console.log('   - Distributed Schedulers (Fees & Zoom) active');

    return { success: true };
  } catch (err) {
    console.error('❌ Failed to initialize BullMQ Queue Manager:', err.message);
    isInitialized = false;
    return { success: false, error: err.message };
  }
}

/**
 * Enqueue a realtime event for async dispatching via Socket.IO
 */
export async function enqueueRealtimeEvent(event, payload, options = {}) {
  if (!isInitialized || !queues.realtimeEvents) {
    // Direct immediate fallback
    dispatchSocketEvent(event, payload, options);
    return false;
  }

  try {
    await queues.realtimeEvents.add(
      'emit-realtime-event',
      { event, payload, options },
      {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 2,
        backoff: { type: 'exponential', delay: 1000 }
      }
    );
    return true;
  } catch (err) {
    // Non-blocking fallback to direct socket dispatch
    console.warn(`[QueueManager] Enqueue failed for ${event}, falling back to direct emit:`, err.message);
    dispatchSocketEvent(event, payload, options);
    return false;
  }
}

/**
 * Enqueue an asynchronous transactional email
 */
export async function enqueueEmail(emailData, options = {}) {
  if (!isInitialized || !queues.notifications) {
    if (!emailServiceRef) {
      const { emailService } = await import('../email/email.service.js');
      emailServiceRef = emailService;
    }
    return await emailServiceRef.sendMail(emailData);
  }

  try {
    const job = await queues.notifications.add('send-email', emailData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 100,
      ...options
    });
    return { queued: true, jobId: job.id };
  } catch (err) {
    console.warn('[QueueManager] Enqueue email failed, sending synchronously:', err.message);
    if (!emailServiceRef) {
      const { emailService } = await import('../email/email.service.js');
      emailServiceRef = emailService;
    }
    return await emailServiceRef.sendMail(emailData);
  }
}

/**
 * Enqueue incoming Zoom webhook event for background idempotent processing
 */
export async function enqueueZoomWebhook(eventData, reqHeaders = {}, eventHash = null) {
  if (!isInitialized || !queues.zoomEvents) {
    if (!zoomServiceRef) {
      const { zoomService } = await import('../../modules/zoom/zoom.service.js');
      zoomServiceRef = zoomService;
    }
    return await zoomServiceRef.handleWebhookEvent(eventData, { headers: reqHeaders });
  }

  try {
    const job = await queues.zoomEvents.add(
      'process-webhook',
      { eventData, reqHeaders, receivedAt: new Date().toISOString() },
      {
        jobId: eventHash || undefined,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 200,
        removeOnFail: 200
      }
    );
    return { queued: true, jobId: job.id };
  } catch (err) {
    console.warn('[QueueManager] Zoom webhook enqueue failed, processing directly:', err.message);
    if (!zoomServiceRef) {
      const { zoomService } = await import('../../modules/zoom/zoom.service.js');
      zoomServiceRef = zoomService;
    }
    return await zoomServiceRef.handleWebhookEvent(eventData, { headers: reqHeaders });
  }
}

/**
 * Get comprehensive queue metrics and Redis health for administrative overview
 */
export async function getQueueMetrics() {
  const redisStatus = await getRedisStatus();
  const queueStats = {};

  if (isInitialized) {
    for (const [name, queue] of Object.entries(queues)) {
      try {
        const counts = await queue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused');
        queueStats[name] = counts;
      } catch (err) {
        queueStats[name] = { error: err.message };
      }
    }
  }

  return {
    bullMqInitialized: isInitialized,
    redis: redisStatus,
    queues: queueStats
  };
}

/**
 * Gracefully close workers and queues on application shutdown
 */
export async function closeQueueManager() {
  if (!isInitialized) return;

  console.log('Closing BullMQ workers and queues...');
  const closePromises = [];

  for (const worker of Object.values(workers)) {
    closePromises.push(worker.close().catch(() => {}));
  }

  for (const queue of Object.values(queues)) {
    closePromises.push(queue.close().catch(() => {}));
  }

  await Promise.all(closePromises);
  isInitialized = false;
  console.log('BullMQ workers and queues closed successfully.');
}

export const queueManager = {
  initQueueManager,
  enqueueRealtimeEvent,
  enqueueEmail,
  enqueueZoomWebhook,
  getQueueMetrics,
  closeQueueManager,
  registerQueueHandlers,
  isInitialized: () => isInitialized
};
