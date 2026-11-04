import request from 'supertest';
import { createApp } from '../src/app.js';
import {
  initQueueManager,
  closeQueueManager,
  enqueueRealtimeEvent,
  enqueueEmail,
  getQueueMetrics,
  registerQueueHandlers
} from '../src/shared/queue/queueManager.js';
import { testRedisConnection, getRedisStatus, closeRedisConnections } from '../src/shared/redis/redisClient.js';
import { RealtimeEvents } from '../src/shared/realtime/eventEmitter.js';

describe('BullMQ & Local Redis Event Management Integration', () => {
  let app;
  let mockEmailSent = false;

  beforeAll(async () => {
    app = createApp();

    // Register mock email sender so we don't attempt external network SMTP during local unit test
    registerQueueHandlers({
      emailService: {
        sendMail: async (data) => {
          mockEmailSent = true;
          return { sent: true, messageId: 'mock-msg-123', to: data.to };
        }
      }
    });
  });

  afterAll(async () => {
    await closeQueueManager();
    await closeRedisConnections();
  });

  it('1. should connect to local Redis server on port 6379', async () => {
    const isConnected = await testRedisConnection(true);
    expect(isConnected).toBe(true);

    const status = await getRedisStatus();
    expect(status.connected).toBe(true);
    expect(status.version).toBeDefined();
    expect(status.queueUrl).toContain('6379/1');
  });

  it('2. should initialize BullMQ Queue Manager with all 4 event queues', async () => {
    const initResult = await initQueueManager({ force: true });
    expect(initResult.success).toBe(true);

    const metrics = await getQueueMetrics();
    expect(metrics.bullMqInitialized).toBe(true);
    expect(metrics.queues.realtimeEvents).toBeDefined();
    expect(metrics.queues.notifications).toBeDefined();
    expect(metrics.queues.zoomEvents).toBeDefined();
    expect(metrics.queues.schedulers).toBeDefined();
  });

  it('3. should process real-time event via BullMQ worker asynchronously', async () => {
    const enqueued = await enqueueRealtimeEvent(
      RealtimeEvents.NOTIFICATION_CREATED,
      {
        id: 99999,
        title: 'BullMQ Test Notification',
        message: 'Event successfully queued and processed via local Redis',
        createdAt: new Date().toISOString()
      },
      { roles: ['ADMIN'] }
    );
    expect(enqueued).toBe(true);

    // Wait for the BullMQ worker to process the job
    await new Promise((r) => setTimeout(r, 800));

    const metrics = await getQueueMetrics();
    expect(metrics.queues.realtimeEvents.completed).toBeGreaterThanOrEqual(1);
    expect(metrics.queues.realtimeEvents.failed).toBe(0);
  });

  it('4. should enqueue email job in notifications queue and process via worker', async () => {
    const res = await enqueueEmail({
      to: 'test@example.com',
      subject: 'BullMQ Async Email Test',
      text: 'Testing BullMQ email queuing.'
    });

    expect(res).toBeDefined();
    expect(res.queued).toBe(true);
    expect(res.jobId).toBeDefined();

    // Wait for worker pickup and processing
    await new Promise((r) => setTimeout(r, 800));

    expect(mockEmailSent).toBe(true);
    const metrics = await getQueueMetrics();
    expect(metrics.queues.notifications.completed).toBeGreaterThanOrEqual(1);
  });

  it('5. should expose queue health metrics via GET /api/v1/system/queues', async () => {
    const response = await request(app).get('/api/v1/system/queues');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.bullMqInitialized).toBe(true);
    expect(response.body.redis.connected).toBe(true);
    expect(response.body.queues.realtimeEvents).toBeDefined();
    expect(response.body.queues.schedulers).toBeDefined();
  });
});
