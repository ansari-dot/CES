import { resultsService } from './results.service.js';
import { sendSuccess } from '../../shared/http/response.js';

export const resultsController = {
  async compute(req, res, next) {
    try {
      const summary = await resultsService.computeClassResults(req.body, req.user);
      return sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  },

  async list(req, res, next) {
    try {
      const rows = await resultsService.listResults(req.query, req.user);
      return sendSuccess(res, rows);
    } catch (error) {
      next(error);
    }
  },

  async overview(req, res, next) {
    try {
      const data = await resultsService.getOverview(req.query, req.user);
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },

  async detail(req, res, next) {
    try {
      const result = await resultsService.getResultDetail(req.params.id, req.user);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async submitMarks(req, res, next) {
    try {
      const data = await resultsService.submitMarks(req.body, req.user);
      return sendSuccess(res, data, null, 201);
    } catch (error) {
      next(error);
    }
  },

  async teacherStatus(req, res, next) {
    try {
      const data = await resultsService.getTeacherTermStatus(req.query.termId, req.user);
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },

  async approve(req, res, next) {
    try {
      const data = await resultsService.approveClassResults(req.body, req.user);
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },

  async publish(req, res, next) {
    try {
      const data = await resultsService.publishClassResults(req.body, req.user);
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },

  async updateSubjectMarks(req, res, next) {
    try {
      const result = await resultsService.updateSubjectMarks(req.params.id, req.body, req.user);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async myResults(req, res, next) {
    try {
      const data = await resultsService.getMyResults(req.user);
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },

  async childResults(req, res, next) {
    try {
      const data = await resultsService.getChildResults(req.user, req.params.studentId);
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }
};
