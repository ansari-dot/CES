import { performanceService } from './performance.service.js';
import { outboxWorker } from './outbox.worker.js';

export const performanceController = {
  async decidePromotion(req, res, next) {
    try {
      const { studentId } = req.params;
      const { decision, reason } = req.body; // decision: PROMOTE/RETAIN/SUPPLEMENTARY
      const result = await performanceService.recordPromotionDecision(Number(studentId), decision, reason, req.user);
      res.json({ success: true, data: result, message: 'Promotion decision recorded' });
    } catch (err) {
      next(err);
    }
  },

  // New: Admin soft‑archive student academic data for a closed session
  async archiveStudent(req, res, next) {
    try {
      const { studentId } = req.params;
      const { sessionId } = req.query;
      const result = await performanceService.archiveStudentAcademicData(Number(studentId), Number(sessionId), req.user);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  // Policies
  async getActivePolicy(req, res, next) {
    try {
      const sessionId = req.query.sessionId ? Number(req.query.sessionId) : null;
      const policy = await performanceService.getActivePolicy(sessionId);
      res.json({ success: true, data: policy });
    } catch (err) {
      next(err);
    }
  },

  async listPolicies(req, res, next) {
    try {
      const { scope, sessionId, status, limit, offset } = req.query;
      const result = await performanceService.listPolicies({
        scope,
        sessionId: sessionId ? Number(sessionId) : undefined,
        status,
        limit: limit ? Number(limit) : 50,
        offset: offset ? Number(offset) : 0
      });
      res.json({ success: true, data: result.data, total: result.total });
    } catch (err) {
      next(err);
    }
  },

  async getPolicyById(req, res, next) {
    try {
      const policy = await performanceService.getPolicyById(Number(req.params.id));
      res.json({ success: true, data: policy });
    } catch (err) {
      next(err);
    }
  },

  async createPolicy(req, res, next) {
    try {
      const policy = await performanceService.createPolicy(req.body, req.user);
      res.status(201).json({ success: true, data: policy, message: 'Grading policy created successfully' });
    } catch (err) {
      next(err);
    }
  },

  async activatePolicy(req, res, next) {
    try {
      const policy = await performanceService.activatePolicy(Number(req.params.id), req.user);
      res.json({ success: true, data: policy, message: 'Grading policy activated successfully' });
    } catch (err) {
      next(err);
    }
  },

  // Student Formative Scoring & Full Academic Report
  async getFullReport(req, res, next) {
    try {
      const { studentId } = req.params;
      const sessionId = req.query.sessionId ? Number(req.query.sessionId) : null;
      const report = await performanceService.getStudentFullAcademicReport({
        studentId: Number(studentId),
        sessionId
      });
      res.json({ success: true, data: report });
    } catch (err) {
      next(err);
    }
  },

  async getStudentContinuousScore(req, res, next) {
    try {
      const { studentId, subjectId } = req.params;
      const { sessionId, classId } = req.query;

      const result = await performanceService.calculateStudentSubjectScore({
        studentId: Number(studentId),
        subjectId: Number(subjectId),
        sessionId: Number(sessionId),
        classId: classId ? Number(classId) : null
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async getClassContinuousPerformance(req, res, next) {
    try {
      const { classId, subjectId } = req.params;
      const { sessionId } = req.query;

      const result = await performanceService.getClassPerformanceSummary({
        classId: Number(classId),
        subjectId: Number(subjectId),
        sessionId: Number(sessionId)
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  // Cooldown & Alerts
  async getCooldownStatus(req, res, next) {
    try {
      const { studentId, subjectId } = req.query;
      const status = await performanceService.getCooldownStatus(Number(studentId), Number(subjectId));
      res.json({ success: true, data: status });
    } catch (err) {
      next(err);
    }
  },

  async triggerAlert(req, res, next) {
    try {
      const result = await performanceService.triggerParentAlert(req.body, req.user);
      res.status(201).json({
        success: true,
        data: result,
        message: 'Parent intervention alert queued successfully for delivery'
      });
    } catch (err) {
      next(err);
    }
  },

  async listAlerts(req, res, next) {
    try {
      const { studentId, sessionId, teacherId, limit, offset } = req.query;
      const alerts = await performanceService.listAlerts({
        studentId: studentId ? Number(studentId) : undefined,
        sessionId: sessionId ? Number(sessionId) : undefined,
        teacherId: teacherId ? Number(teacherId) : undefined,
        limit: limit ? Number(limit) : 50,
        offset: offset ? Number(offset) : 0
      });
      res.json({ success: true, data: alerts });
    } catch (err) {
      next(err);
    }
  },

  async getAlertDetails(req, res, next) {
    try {
      const alert = await performanceService.getAlertDetails(Number(req.params.id));
      res.json({ success: true, data: alert });
    } catch (err) {
      next(err);
    }
  },

  async flushOutbox(req, res, next) {
    try {
      const batchSize = req.query.batchSize ? Number(req.query.batchSize) : 20;
      const result = await outboxWorker.processBatch(batchSize);
      res.json({ success: true, data: result, message: 'Outbox processed successfully' });
    } catch (err) {
      next(err);
    }
  }
};

