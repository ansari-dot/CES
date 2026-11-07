import http from 'node:http';
import { createApp } from './app.js';
import { config } from './config/index.js';
import { testDbConnection, db } from './shared/db/knex.js';
import { startFeeScheduler } from './modules/fees/fees.scheduler.js';
import { startZoomScheduler } from './modules/zoom/zoom.scheduler.js';
import { startAssessmentExpiryScheduler, stopAssessmentExpiryScheduler } from './modules/assessments/assessments.scheduler.js';
import { outboxWorker } from './modules/performance/outbox.worker.js';
import { initSocketServer } from './shared/realtime/socket.js';
import { testRedisConnection, closeRedisConnections } from './shared/redis/redisClient.js';
import { initQueueManager, closeQueueManager } from './shared/queue/queueManager.js';

async function bootstrap() {
  const app = createApp();
  const server = http.createServer(app);

  // Initialize WebSockets (Socket.IO)
  initSocketServer(server);

  // Test DB connection
  const isDbConnected = await testDbConnection();
  if (!isDbConnected) {
    console.warn('⚠️ Warning: Database connection check failed on startup. Retrying queries on-demand.');
  } else {
    console.log('✅ Connected to MySQL database successfully.');
  }

  // Initialize Local Redis & BullMQ Queue Manager for Event Management
  let isQueueReady = false;
  if (!config.isTest) {
    const isRedisConnected = await testRedisConnection();
    if (isRedisConnected) {
      console.log('✅ Connected to local Redis server successfully (DB 0: Cache, DB 1: BullMQ).');
      const queueInitResult = await initQueueManager();
      isQueueReady = queueInitResult.success;
    } else {
      console.warn('⚠️ Local Redis is not running or unreachable. BullMQ running in direct in-process fallback mode.');
    }
  }

  let stopFeeScheduler = null;
  let stopZoomScheduler = null;
  server.listen(config.PORT, () => {
    console.log(`🚀 School Backend API server running on port ${config.PORT} [${config.NODE_ENV}]`);
    console.log(`⚡ Real-time WebSocket server initialized.`);

    if (!config.isTest) {
      if (isQueueReady) {
        console.log(`🐂 Schedulers (Fee lifecycle & Zoom timetable) actively managed by BullMQ repeatable jobs on Redis.`);
      } else {
        if (config.feeSchedulerEnabled) {
          stopFeeScheduler = startFeeScheduler();
          console.log(`⏰ Fee lifecycle scheduler started via interval fallback (billing timezone: ${config.SCHOOL_TIMEZONE}).`);
        }
        stopZoomScheduler = startZoomScheduler();
        console.log(`🎥 Automatic Zoom timetable scheduler started via interval fallback (timezone: ${config.SCHOOL_TIMEZONE}).`);
      }
      startAssessmentExpiryScheduler(30000);
      console.log(`⏱️ Monthly Assessment Expiry Sweeper running every 30s.`);
      outboxWorker.start(15000);
      console.log(`📨 Academic Parent Alert Outbox Dispatcher running every 15s.`);
    }
  });

  // Graceful shutdown handling
  const shutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}, closing server gracefully...`);
    stopFeeScheduler?.();
    stopZoomScheduler?.();
    stopAssessmentExpiryScheduler?.();
    outboxWorker.stop();

    try {
      await closeQueueManager();
      await closeRedisConnections();
    } catch (qErr) {
      console.warn('Error closing BullMQ / Redis:', qErr.message);
    }

    server.close(async () => {
      console.log('HTTP server closed.');
      try {
        await db.destroy();
        console.log('Database pool destroyed.');
      } catch (err) {
        console.error('Error closing database pool:', err.message);
      }
      process.exit(0);
    });

    // Force shutdown after timeout
    setTimeout(() => {
      console.error('Forced shutdown due to timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
