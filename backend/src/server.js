import { createApp } from './app.js';
import { config } from './config/index.js';
import { testDbConnection, db } from './shared/db/knex.js';
import { startFeeScheduler } from './modules/fees/fees.scheduler.js';

async function bootstrap() {
  const app = createApp();

  // Test DB connection
  const isDbConnected = await testDbConnection();
  if (!isDbConnected) {
    console.warn('⚠️ Warning: Database connection check failed on startup. Retrying queries on-demand.');
  } else {
    console.log('✅ Connected to MySQL database successfully.');
  }

  let stopFeeScheduler = null;
  const server = app.listen(config.PORT, () => {
    console.log(`🚀 School Backend API server running on port ${config.PORT} [${config.NODE_ENV}]`);
    // Start fee lifecycle scheduler (skip in test environment)
    if (!config.isTest && config.feeSchedulerEnabled) {
      stopFeeScheduler = startFeeScheduler();
      console.log(`⏰ Fee lifecycle scheduler started (billing timezone: ${config.SCHOOL_TIMEZONE}).`);
    }
  });

  // Graceful shutdown handling
  const shutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}, closing HTTP server gracefully...`);
    stopFeeScheduler?.();
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
