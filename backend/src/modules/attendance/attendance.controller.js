import { attendanceService } from './attendance.service.js';
import { sendSuccess } from '../../shared/http/response.js';
import { getStudentByUserId, assertCanViewStudent, forbidden } from '../../shared/services/accessScope.js';
import { parentsRepository } from '../people/parents.repository.js';

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
      const { classId, startDate, endDate } = req.query;
      let { studentId } = req.query;

      // Students only get their own statistics; parents only their linked children's
      if (req.user.role === 'STUDENT') {
        const self = await getStudentByUserId(req.user.id);
        studentId = self ? self.id : -1;
      } else if (req.user.role === 'PARENT') {
        if (!studentId) throw forbidden('Select one of your children to view attendance.');
        await assertCanViewStudent(req.user, Number(studentId));
      }

      const stats = await attendanceService.getAttendanceStats({
        classId: classId && !['STUDENT', 'PARENT'].includes(req.user.role) ? Number(classId) : null,
        studentId: studentId ? Number(studentId) : null,
        startDate: startDate || null,
        endDate: endDate || null
      });

      // Personal views also get the date-wise history
      if (['STUDENT', 'PARENT'].includes(req.user.role) && Number(studentId) > 0) {
        stats.records = await parentsRepository.getChildAttendanceRecords(Number(studentId), {
          startDate: startDate || null,
          endDate: endDate || null
        });
      }
      return sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }
};
