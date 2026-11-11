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
        month
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
  }
};

