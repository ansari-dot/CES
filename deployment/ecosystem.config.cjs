/**
 * PM2 Ecosystem Configuration for Cambridge Education System Backend
 *
 * Usage:
 *   pm2 start deployment/ecosystem.config.cjs --env production
 *   pm2 save
 *   pm2 startup
 */

module.exports = {
  apps: [
    {
      name: 'ces-backend-api',
      script: './src/server.js',
      cwd: './backend',
      instances: 1, // Single instance ensures in-memory socket coordination; or scale with Redis
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '1G',
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000
      },
      error_file: '../logs/pm2-backend-error.log',
      out_file: '../logs/pm2-backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      restart_delay: 4000
    }
  ]
};

