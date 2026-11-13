import { calendarService } from './calendar.service.js';
import { sendSuccess } from '../../shared/http/response.js';

export const calendarController = {
  async getActiveAnnouncement(req, res, next) {
    try {
      const data = await calendarService.getActiveAnnouncement(req.user);
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },

  async getHolidays(req, res, next) {
    try {
      const sessionId = req.query.sessionId ? Number(req.query.sessionId) : null;
      const year = req.query.year ? Number(req.query.year) : null;
      const month = req.query.month ? Number(req.query.month) : null;
      const startDate = req.query.startDate || null;
      const endDate = req.query.endDate || null;

      const holidays = await calendarService.getHolidays({
        sessionId,
        year,
        month,
        startDate,
        endDate
      });

      return sendSuccess(res, holidays);
    } catch (error) {
      next(error);
    }
  },

  async getCalendarOverview(req, res, next) {
    try {
      const sessionId = req.query.sessionId ? Number(req.query.sessionId) : null;
      const year = req.query.year ? Number(req.query.year) : null;
      const month = req.query.month ? Number(req.query.month) : null;

      const overview = await calendarService.getCalendarOverview({
        sessionId,
        year,
        month,
        user: req.user
      });

      return sendSuccess(res, overview);
    } catch (error) {
      next(error);
    }
  },

  async createHoliday(req, res, next) {
    try {
      const {
        sessionId,
        title,
        holidayType,
        startDate,
        endDate,
        description,
        affectsAllClasses
      } = req.body;

      const holiday = await calendarService.createHoliday({
        sessionId: sessionId ? Number(sessionId) : null,
        title,
        holidayType,
        startDate,
        endDate,
        description,
        affectsAllClasses,
        classIds: req.body.classIds,
        confirmConflicts: req.body.confirmConflicts,
        createdBy: req.user?.id
      });

      return sendSuccess(res, holiday, 'Holiday break declared successfully. Timetable lessons have been updated.', 201);
    } catch (error) {
      next(error);
    }
  },

  async updateHoliday(req, res, next) {
    try {
      const id = Number(req.params.id);
      const holiday = await calendarService.updateHoliday(id, req.body, req.user?.id);
      return sendSuccess(res, holiday, 'Holiday break updated successfully');
    } catch (error) {
      next(error);
    }
  },

  async deleteHoliday(req, res, next) {
    try {
      const id = Number(req.params.id);
      const result = await calendarService.deleteHoliday(id, req.user?.id);
      return sendSuccess(res, result, 'Holiday break removed. Regular schedule restored.');
    } catch (error) {
      next(error);
    }
  },

  // ─── Extended Calendar Event Endpoints ────────────────────────────────────

  async getEvents(req, res, next) {
    try {
      const { sessionId, year, month, startDate, endDate, classId } = req.query;
      const events = await calendarService.getEvents({
        sessionId: sessionId ? Number(sessionId) : null,
        year: year ? Number(year) : null,
        month: month ? Number(month) : null,
        startDate: startDate || null,
        endDate: endDate || null,
        user: req.user,
        classId: classId ? Number(classId) : null
      });
      return sendSuccess(res, events);
    } catch (error) {
      next(error);
    }
  },

  async getUpcomingEvents(req, res, next) {
    try {
      const { sessionId, classId, limitDays } = req.query;
      const data = await calendarService.getUpcomingEvents({
        sessionId: sessionId ? Number(sessionId) : null,
        user: req.user,
        classId: classId ? Number(classId) : null,
        limitDays: limitDays ? Number(limitDays) : 30
      });
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },

  async checkConflicts(req, res, next) {
    try {
      const excludeId = req.body.id ? Number(req.body.id) : null;
      const result = await calendarService.checkConflicts(req.body, excludeId);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async createEvent(req, res, next) {
    try {
      const event = await calendarService.createEvent({
        ...req.body,
        sessionId: req.body.sessionId ? Number(req.body.sessionId) : null,
        createdBy: req.user?.id
      });
      return sendSuccess(res, event, 'Calendar event published successfully.', 201);
    } catch (error) {
      next(error);
    }
  },

  async updateEvent(req, res, next) {
    try {
      const id = Number(req.params.id);
      const event = await calendarService.updateEvent(id, req.body, req.user?.id);
      return sendSuccess(res, event, 'Calendar event updated successfully.');
    } catch (error) {
      next(error);
    }
  },

  async deleteEvent(req, res, next) {
    try {
      const id = Number(req.params.id);
      const result = await calendarService.deleteEvent(id, req.user?.id);
      return sendSuccess(res, result, 'Calendar event cancelled. Affected users have been notified.');
    } catch (error) {
      next(error);
    }
  }
};
