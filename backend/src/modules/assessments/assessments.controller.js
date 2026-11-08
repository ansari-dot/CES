import { assessmentsService } from './assessments.service.js';
import { sendSuccess } from '../../shared/http/response.js';

export const assessmentsController = {
  // -------------------------------------------------------------
  // Teacher Test Management
  // -------------------------------------------------------------
  async updateTestStatus(req, res, next) {
    try {
      const data = await assessmentsService.updateTestStatus(req.user, Number(req.params.id), req.body.status);
      return sendSuccess(res, data, 'Test status updated.');
    } catch (err) {
      next(err);
    }
  },

  async createTest(req, res, next) {
    try {
      const test = await assessmentsService.createTest(req.user, req.body);
      return sendSuccess(res, test, 'Monthly test created successfully.', 201);
    } catch (err) {
      next(err);
    }
  },

  async updateTest(req, res, next) {
    try {
      const test = await assessmentsService.updateTest(req.user, Number(req.params.id), req.body);
      return sendSuccess(res, test, 'Monthly test updated successfully.');
    } catch (err) {
      next(err);
    }
  },

  async publishTest(req, res, next) {
    try {
      const test = await assessmentsService.publishTest(req.user, Number(req.params.id));
      return sendSuccess(res, test, 'Monthly test published successfully.');
    } catch (err) {
      next(err);
    }
  },

  async closeTest(req, res, next) {
    try {
      const test = await assessmentsService.closeTest(req.user, Number(req.params.id));
      return sendSuccess(res, test, 'Monthly test closed successfully.');
    } catch (err) {
      next(err);
    }
  },

  async getTestDetails(req, res, next) {
    try {
      const test = await assessmentsService.getTestDetails(req.user, Number(req.params.id));
      return sendSuccess(res, test);
    } catch (err) {
      next(err);
    }
  },

  async listTests(req, res, next) {
    try {
      const result = await assessmentsService.listTests(req.user, req.query);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },

  // -------------------------------------------------------------
  // Teacher Grading Workstation
  // -------------------------------------------------------------
  async getTestSubmissions(req, res, next) {
    try {
      const data = await assessmentsService.getTestSubmissions(req.user, Number(req.params.id));
      return sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },

  async getAttemptForGrading(req, res, next) {
    try {
      const data = await assessmentsService.getAttemptForGrading(req.user, Number(req.params.attemptId));
      return sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },

  async gradeAttempt(req, res, next) {
    try {
      const data = await assessmentsService.gradeAttempt(req.user, Number(req.params.attemptId), req.body);
      return sendSuccess(res, data, 'Grading saved successfully.');
    } catch (err) {
      next(err);
    }
  },

  async publishResults(req, res, next) {
    try {
      const result = await assessmentsService.publishResults(req.user, Number(req.params.id));
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },

  // -------------------------------------------------------------
  // Student Portal Live Exam APIs
  // -------------------------------------------------------------
  async getStudentAssessments(req, res, next) {
    try {
      const tests = await assessmentsService.getStudentAssessments(req.user);
      return sendSuccess(res, tests);
    } catch (err) {
      next(err);
    }
  },

  async startOrResumeAttempt(req, res, next) {
    try {
      const session = await assessmentsService.startOrResumeAttempt(req.user, Number(req.params.id));
      return sendSuccess(res, session);
    } catch (err) {
      next(err);
    }
  },

  async saveAnswer(req, res, next) {
    try {
      const result = await assessmentsService.saveAnswer(req.user, Number(req.params.attemptId), req.body);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },

  async submitAttempt(req, res, next) {
    try {
      const result = await assessmentsService.submitAttempt(req.user, Number(req.params.attemptId));
      return sendSuccess(res, result, 'Examination submitted successfully.');
    } catch (err) {
      next(err);
    }
  },

  async getStudentTestResult(req, res, next) {
    try {
      const data = await assessmentsService.getStudentTestResult(req.user, Number(req.params.id));
      return sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },

  // -------------------------------------------------------------
  // Zoom Invigilation Controls
  // -------------------------------------------------------------
  async getInvigilationSession(req, res, next) {
    try {
      const data = await assessmentsService.getInvigilationSession(req.user, Number(req.params.id));
      return sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },

  async startInvigilation(req, res, next) {
    try {
      const data = await assessmentsService.startInvigilation(req.user, Number(req.params.id));
      return sendSuccess(res, data, 'Invigilation session launched.');
    } catch (err) {
      next(err);
    }
  },

  // -------------------------------------------------------------
  // Parent Portal Child Results
  // -------------------------------------------------------------
  async getParentChildAssessments(req, res, next) {
    try {
      const data = await assessmentsService.getParentChildAssessments(req.user, Number(req.params.studentId));
      return sendSuccess(res, { results: data });
    } catch (err) {
      next(err);
    }
  },

  // -------------------------------------------------------------
  // Manual Parent Academic Alert Dispatch (Low Scorers)
  // -------------------------------------------------------------
  async notifyLowPerformers(req, res, next) {
    try {
      const { thresholdPercentage, customNote, force } = req.body || {};
      const result = await assessmentsService.notifyLowPerformers(Number(req.params.id), {
        actor: req.user,
        isManual: true,
        thresholdPercentage,
        customNote,
        force
      });
      return sendSuccess(res, result, result.message || 'Parent alerts dispatched successfully.');
    } catch (err) {
      next(err);
    }
  },

  async notifyAttemptParent(req, res, next) {
    try {
      const { customNote } = req.body || {};
      const result = await assessmentsService.notifyAttemptParent(
        req.user,
        Number(req.params.id),
        Number(req.params.attemptId),
        { customNote }
      );
      return sendSuccess(res, result, result.message || 'Parent alert dispatched successfully.');
    } catch (err) {
      next(err);
    }
  }
};

