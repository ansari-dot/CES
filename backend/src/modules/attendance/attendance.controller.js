import { attendanceService } from './attendance.service.js';
import { sendSuccess } from '../../shared/http/response.js';

export const attendanceController = {
  async getLessonRoster(req, res, next) {
    try {
      const lessonId = Number(req.params.lessonId);
      const data = await attendanceService.getLessonRoster(lessonId);
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },

  async getClassRoster(req, res, next) {
    try {
      const classId = Number(req.params.classId);
      const { date } = req.query;
      const data = await attendanceService.getClassRoster(classId, date);
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },

  async recordDelivery(req, res, next) {
    try {
      const lessonId = Number(req.params.lessonId);
      const {
        actualStartAt,
        actualEndAt,
        topicCovered,
        teachingNotes,
        resourceUrl,
        problemCategory
      } = req.body;

      const result = await attendanceService.recordLessonDelivery({
        lessonId,
        actualStartAt,
        actualEndAt,
        topicCovered,
        teachingNotes,
        resourceUrl,
        problemCategory,
        userId: req.user.id,
        userRole: req.user.role
      });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async submitAttendance(req, res, next) {
    try {
      const lessonId = Number(req.params.lessonId);
      const { records } = req.body;

      const result = await attendanceService.submitAttendance({
        lessonId,
        records,
        userId: req.user.id,
        userRole: req.user.role
      });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async createCorrection(req, res, next) {
    try {
      const { lessonId, studentId, proposedStatus, reason } = req.body;
      const result = await attendanceService.createCorrectionRequest({
        lessonId: Number(lessonId),
        studentId: Number(studentId),
        proposedStatus,
        reason,
        userId: req.user.id
      });
      return sendSuccess(res, result, null, 201);
    } catch (error) {
      next(error);
    }
  },

  async getCorrections(req, res, next) {
    try {
      const { status, classId, lessonId } = req.query;
      const results = await attendanceService.getCorrectionRequests({
        status: status || null,
        classId: classId ? Number(classId) : null,
        lessonId: lessonId ? Number(lessonId) : null
      });
      return sendSuccess(res, results);
    } catch (error) {
      next(error);
    }
  },

  async reviewCorrection(req, res, next) {
    try {
      const correctionId = Number(req.params.id);
      const { status, reviewRemarks } = req.body;
      const result = await attendanceService.reviewCorrectionRequest({
        correctionId,
        status,
        reviewRemarks,
        userId: req.user.id
      });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async getStats(req, res, next) {
    try {
      const { classId, studentId, startDate, endDate } = req.query;
      const stats = await attendanceService.getAttendanceStats({
        classId: classId ? Number(classId) : null,
        studentId: studentId ? Number(studentId) : null,
        startDate: startDate || null,
        endDate: endDate || null
      });
      return sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }
};
