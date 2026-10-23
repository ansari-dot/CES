import { timetableService } from './timetable.service.js';
import { sendSuccess } from '../../shared/http/response.js';
import { db } from '../../shared/db/knex.js';

export const timetableController = {
  async getMySlots(req, res, next) {
    try {
      const teacher = await db('teachers').where({ user_id: req.user.id }).first();
      if (!teacher) return sendSuccess(res, []);
      const slots = await timetableService.getSlots({ teacherId: teacher.id });
      return sendSuccess(res, slots);
    } catch (error) {
      next(error);
    }
  },

  async getMyLessons(req, res, next) {
    try {
      const teacher = await db('teachers').where({ user_id: req.user.id }).first();
      if (!teacher) return sendSuccess(res, []);
      const startDate = req.query.startDate || null;
      const endDate = req.query.endDate || null;
      const lessons = await timetableService.getLessons({ teacherId: teacher.id, startDate, endDate });
      return sendSuccess(res, lessons);
    } catch (error) {
      next(error);
    }
  },

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

  async updateSlot(req, res, next) {
    try {
      const slotId = Number(req.params.id);
      const { sessionId, classId, subjectId, teacherId, weekday, startTime, endTime, effectiveFrom, effectiveTo, status, reason } = req.body;
      const slot = await timetableService.updateSlot({
        slotId,
        sessionId: sessionId ? Number(sessionId) : undefined,
        classId: classId ? Number(classId) : undefined,
        subjectId: subjectId ? Number(subjectId) : undefined,
        teacherId: teacherId ? Number(teacherId) : undefined,
        weekday: weekday !== undefined ? Number(weekday) : undefined,
        startTime,
        endTime,
        effectiveFrom,
        effectiveTo,
        status,
        userId: req.user?.id,
        reason
      });
      return sendSuccess(res, slot);
    } catch (error) {
      next(error);
    }
  },

  async deleteSlot(req, res, next) {
    try {
      const slotId = Number(req.params.id);
      const { reason } = req.body || {};
      const result = await timetableService.deleteSlot({
        slotId,
        userId: req.user?.id,
        reason
      });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async getLessons(req, res, next) {
    try {
      const classId = req.query.classId ? Number(req.query.classId) : null;
      const teacherId = req.query.teacherId ? Number(req.query.teacherId) : null;
      const date = req.query.date || null;
      const startDate = req.query.startDate || null;
      const endDate = req.query.endDate || null;
      const status = req.query.status || null;

      const lessons = await timetableService.getLessons({ classId, teacherId, date, startDate, endDate, status });
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
