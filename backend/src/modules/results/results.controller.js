import { resultsService } from './results.service.js';
import { sendSuccess } from '../../shared/http/response.js';
import { getStudentByUserId } from '../../shared/services/accessScope.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';

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
  },

  async studentResults(req, res, next) {
    try {
      const data = await resultsService.getStudentAcademicHistory(Number(req.params.studentId), { isStaffUser: true });
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },

  async getAnnualPerformanceSummary(req, res, next) {
    try {
      const data = await resultsService.getStudentAnnualSubjectSummary({
        studentId: req.params.studentId,
        sessionId: req.query.sessionId,
        user: req.user
      });
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },

  async getSubjectDetailedMarks(req, res, next) {
    try {
      const data = await resultsService.getStudentSubjectDetailedMarks({
        studentId: req.params.studentId,
        subjectId: req.params.subjectId,
        sessionId: req.query.sessionId,
        user: req.user
      });
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },

  async getMyAnnualPerformanceSummary(req, res, next) {
    try {
      const student = await getStudentByUserId(req.user.id);
      if (!student) throw new AppError('Student profile not found', 404, ErrorCodes.NOT_FOUND);
      const data = await resultsService.getStudentAnnualSubjectSummary({
        studentId: student.id,
        sessionId: req.query.sessionId,
        user: req.user
      });
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },

  async getChildAnnualPerformanceSummary(req, res, next) {
    try {
      const data = await resultsService.getStudentAnnualSubjectSummary({
        studentId: req.params.studentId,
        sessionId: req.query.sessionId,
        user: req.user
      });
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }
};
