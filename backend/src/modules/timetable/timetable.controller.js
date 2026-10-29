import { timetableService } from './timetable.service.js';
import { sendSuccess } from '../../shared/http/response.js';
import { db } from '../../shared/db/knex.js';
import { zoomService } from '../zoom/zoom.service.js';

const parseWeekday = (val) => {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'number') return val;
  const s = String(val).trim().toLowerCase();
  const map = {
    monday: 1, mon: 1, 1: 1,
    tuesday: 2, tue: 2, 2: 2,
    wednesday: 3, wed: 3, 3: 3,
    thursday: 4, thu: 4, 4: 4,
    friday: 5, fri: 5, 5: 5,
    saturday: 6, sat: 6, 6: 6,
    sunday: 7, sun: 7, 7: 7
  };
  return map[s] !== undefined ? map[s] : Number(val);
};

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
      let lessons = await timetableService.getLessons({ teacherId: teacher.id, startDate, endDate });

      for (const l of lessons) {
        if (l.status === 'LIVE') {
          const resCheck = await zoomService.checkAndAutoConcludeIfMeetingEnded(l.id);
          if (resCheck && resCheck.concluded) {
            l.status = 'COMPLETED';
            l.sessionState = 'COMPLETED';
            l.verifiedDutyMinutes = resCheck.verifiedMinutes;
          }
        }
      }

      return sendSuccess(res, lessons);
    } catch (error) {
      next(error);
    }
  },

  async getSlots(req, res, next) {
    try {
      const classId = req.query.classId ? Number(req.query.classId) : null;
      let teacherId = req.query.teacherId ? Number(req.query.teacherId) : null;
      const sessionId = req.query.sessionId ? Number(req.query.sessionId) : null;

      const userRole = req.user?.role || req.user?.role_code;
      if (userRole === 'TEACHER') {
        const teacher = await db('teachers').where({ user_id: req.user.id }).first();
        if (teacher) teacherId = teacher.id;
      }

      const slots = await timetableService.getSlots({ classId, teacherId, sessionId });
      return sendSuccess(res, slots);
    } catch (error) {
      next(error);
    }
  },

  async createSlot(req, res, next) {
    try {
      const { sessionId, classId, subjectId, teacherId, weekday, startTime, endTime, effectiveFrom } = req.body;
      const parsedWeekday = parseWeekday(weekday);
      const slot = await timetableService.createSlot({
        sessionId: Number(sessionId),
        classId: Number(classId),
        subjectId: Number(subjectId),
        teacherId: Number(teacherId),
        weekday: parsedWeekday,
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
      const updates = { ...req.body };
      if (updates.weekday !== undefined) {
        updates.weekday = parseWeekday(updates.weekday);
      }
      const slot = await timetableService.updateSlot({
        slotId,
        updates,
        ...updates,
        userId: req.user?.id,
        reason: req.body?.reason
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
      let teacherId = req.query.teacherId ? Number(req.query.teacherId) : null;
      const date = req.query.date || null;
      const startDate = req.query.startDate || null;
      const endDate = req.query.endDate || null;
      const status = req.query.status || null;

      const userRole = req.user?.role || req.user?.role_code;
      if (userRole === 'TEACHER') {
        const teacher = await db('teachers').where({ user_id: req.user.id }).first();
        if (teacher) teacherId = teacher.id;
      }

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
