import { timetableService } from './timetable.service.js';
import { sendSuccess } from '../../shared/http/response.js';

export const timetableController = {
  async getSlots(req, res, next) {
    try {
      const classId = req.query.classId ? Number(req.query.classId) : null;
      const teacherId = req.query.teacherId ? Number(req.query.teacherId) : null;
      const sessionId = req.query.sessionId ? Number(req.query.sessionId) : null;

      const slots = await timetableService.getSlots({ classId, teacherId, sessionId });
      return sendSuccess(res, slots);
    } catch (error) {
      next(error);
    }
  },

  async createSlot(req, res, next) {
    try {
      const { sessionId, classId, subjectId, teacherId, weekday, startTime, endTime, effectiveFrom } = req.body;
      const slot = await timetableService.createSlot({
        sessionId: Number(sessionId),
        classId: Number(classId),
        subjectId: Number(subjectId),
        teacherId: Number(teacherId),
        weekday: Number(weekday),
        startTime,
        endTime,
        effectiveFrom,
        createdBy: req.user?.id
      });
      return sendSuccess(res, slot, null, 201);
    } catch (error) {
      next(error);
    }
  },

  async getLessons(req, res, next) {
    try {
      const classId = req.query.classId ? Number(req.query.classId) : null;
      const teacherId = req.query.teacherId ? Number(req.query.teacherId) : null;
      const date = req.query.date || null;
      const status = req.query.status || null;

      const lessons = await timetableService.getLessons({ classId, teacherId, date, status });
      return sendSuccess(res, lessons);
    } catch (error) {
      next(error);
    }
  },

  async publishTimetable(req, res, next) {
    try {
      const { sessionId, days } = req.body;
      const result = await timetableService.publishTimetable({
        sessionId: Number(sessionId),
        days: days ? Number(days) : 14,
        createdBy: req.user?.id
      });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async cancelLesson(req, res, next) {
    try {
      const lessonId = Number(req.params.id);
      const { reason } = req.body;
      const result = await timetableService.cancelLesson({
        lessonId,
        reason,
        userId: req.user?.id
      });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async substituteTeacher(req, res, next) {
    try {
      const lessonId = Number(req.params.id);
      const { substituteTeacherId, reason } = req.body;
      const result = await timetableService.substituteTeacher({
        lessonId,
        substituteTeacherId: Number(substituteTeacherId),
        reason,
        userId: req.user?.id
      });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
};
