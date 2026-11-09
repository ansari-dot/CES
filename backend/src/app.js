import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { config } from './config/index.js';
import { requestId } from './shared/middleware/requestId.js';
import { csrfProtection } from './shared/middleware/csrf.js';
import { notFound } from './shared/middleware/notFound.js';
import { errorHandler } from './shared/errors/errorHandler.js';
import { AppError } from './shared/errors/AppError.js';
import { ErrorCodes } from './shared/errors/errorCodes.js';
import authRoutes from './modules/auth/auth.routes.js';
import teachersRoutes from './modules/teachers/teachers.routes.js';
import academicRoutes from './modules/academic/academic.routes.js';
import studentsRoutes from './modules/people/students.routes.js';
import parentsRoutes from './modules/people/parents.routes.js';
import timetableRoutes from './modules/timetable/timetable.routes.js';
import zoomRoutes from './modules/zoom/zoom.routes.js';
import attendanceRoutes from './modules/attendance/attendance.routes.js';
import tasksRoutes from './modules/tasks/tasks.routes.js';
import uploadsRoutes from './modules/uploads/uploads.routes.js';
import feesRoutes from './modules/fees/fees.routes.js';
import payrollRoutes from './modules/payroll/payroll.routes.js';
import noticesRoutes from './modules/notices/notices.routes.js';
import auditRoutes from './modules/audit/audit.routes.js';
import reportsRoutes from './modules/reports/reports.routes.js';
import geoRoutes from './modules/geo/geo.routes.js';
import resultsRoutes from './modules/results/results.routes.js';
import promotionsRoutes from './modules/promotions/promotions.routes.js';
import assessmentsRoutes from './modules/assessments/assessments.routes.js';
import datesheetsRoutes from './modules/datesheets/datesheets.routes.js';
import performanceRoutes from './modules/performance/performance.routes.js';
import supplementaryRoutes from './modules/supplementary/supplementary.routes.js';
import examRoutes from './modules/exam/exam.routes.js';

export function createApp() {
  const app = express();

  // Trust proxy for rate limiting and accurate client IP behind reverse proxy / Nginx
  app.set('trust proxy', 1);

  // 1. Request ID middleware
  app.use(requestId);

  // 2. Structured logging (Pino)
  if (!config.isTest) {
    app.use(
      pinoHttp({
        genReqId: (req) => req.id,
        redact: ['req.headers.cookie', 'req.headers.authorization']
      })
    );
  }

  // 3. Security headers (Helmet) & HTTP Parameter Pollution (HPP)
  app.use(
    helmet({
      contentSecurityPolicy: config.isProduction ? undefined : false,
      crossOriginResourcePolicy: { policy: 'same-site' }
    })
  );
  app.use(hpp());

  // 4. CORS configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin, allowed origins, or any cambridgeeducation.uk.com subdomain
        if (
          !origin ||
          config.allowedOrigins.includes(origin) ||
          origin.endsWith('.cambridgeeducation.uk.com') ||
          origin === 'https://cambridgeeducation.uk.com' ||
          !config.isProduction
        ) {
          return callback(null, true);
        }
        return callback(new AppError('Blocked by CORS policy', 403, ErrorCodes.FORBIDDEN));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-Id']
    })
  );

  // 5. Body and Cookie parsers
  app.use(cookieParser());
  app.use(
    express.json({
      limit: '100kb',
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // 6. CSRF verification for state-changing requests
  app.use(
    csrfProtection({
      exemptPaths: [
        '/api/v1/auth/login',
        '/api/v1/auth/refresh',
        '/api/v1/auth/logout',
        '/api/v1/auth/logout-all',
        '/api/v1/auth/forgot-password',
        '/api/v1/auth/reset-password',
        '/api/v1/parents/register',
        /^\/api\/v1\/zoom\/webhook/,
        /^\/api\/v1\/webhooks\//
      ]
    })
  );

  // 7. Base health check endpoint
  app.get('/api/v1/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // BullMQ & Redis Event Management status endpoint
  app.get('/api/v1/system/queues', async (_req, res) => {
    try {
      const { getQueueMetrics } = await import('./shared/queue/queueManager.js');
      const metrics = await getQueueMetrics();
      res.json({ success: true, ...metrics, timestamp: new Date().toISOString() });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // 8. Module Routes mounting
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/teachers', teachersRoutes);
  app.use('/api/v1', academicRoutes);
  app.use('/api/v1/students', studentsRoutes);
  app.use('/api/v1/parents', parentsRoutes);
  app.use('/api/v1/timetable', timetableRoutes);
  app.use('/api/v1/zoom', zoomRoutes);
  app.use('/api/v1/attendance', attendanceRoutes);
  app.use('/api/v1/tasks', tasksRoutes);
  app.use('/api/v1/uploads', uploadsRoutes);
  app.use('/api/v1/fees', feesRoutes);
  app.use('/api/v1/payroll', payrollRoutes);
  app.use('/api/v1/notices', noticesRoutes);
  app.use('/api/v1/audit', auditRoutes);
  app.use('/api/v1/reports', reportsRoutes);
  app.use('/api/v1/geo', geoRoutes);
  app.use('/api/v1/results', resultsRoutes);
  app.use('/api/v1/promotions', promotionsRoutes);
  app.use('/api/v1/assessments', assessmentsRoutes);
  app.use('/api/v1/datesheets', datesheetsRoutes);
  app.use('/api/v1/performance', performanceRoutes);
  app.use('/api/v1/supplementary', supplementaryRoutes);
  app.use('/api/v1/exams', examRoutes);

  // 9. 404 Handler
  app.use(notFound);

  // 10. Central Error Handler
  app.use(errorHandler);

  return app;
}
