import { reportsService } from './reports.service.js';
import { sendSuccess } from '../../shared/http/response.js';

export const reportsController = {
  async getStudentEnrolmentReport(req, res, next) {
    try {
      const { classId, status, search } = req.query;
      const data = await reportsService.getStudentEnrolmentReport({
        classId: classId ? Number(classId) : null,
        status: status || null,
        search: search || null
      });
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },

  async getFeeCollectionReport(req, res, next) {
    try {
      const { classId, billingMonth, status } = req.query;
      const data = await reportsService.getFeeCollectionReport({
        classId: classId ? Number(classId) : null,
        billingMonth: billingMonth || null,
        status: status || null
      });
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },

  async getTeacherDutyPayrollReport(req, res, next) {
    try {
      const { payrollMonth, teacherId } = req.query;
      const data = await reportsService.getTeacherDutyPayrollReport({
        payrollMonth: payrollMonth || null,
        teacherId: teacherId ? Number(teacherId) : null
      });
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },

  async getAttendanceTrendsReport(req, res, next) {
    try {
      const { classId, startDate, endDate } = req.query;
      const data = await reportsService.getAttendanceTrendsReport({
        classId: classId ? Number(classId) : null,
        startDate: startDate || null,
        endDate: endDate || null
      });
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },

  async getAcademicPerformances(req, res, next) {
    try {
      const { sessionId, subjectId, taskType, term } = req.query;
      const data = await reportsService.getAcademicPerformances({
        sessionId: sessionId ? Number(sessionId) : null,
        subjectId: subjectId ? Number(subjectId) : null,
        taskType: taskType ? String(taskType).toUpperCase() : null,
        term: term || undefined
      });
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },

  async approveResultPublication(req, res, next) {
    try {
      const classNumber = Number(req.params.classNumber);
      const { sessionId, term } = req.body;
      const result = await reportsService.approveResultPublication({
        classNumber,
        sessionId: sessionId ? Number(sessionId) : null,
        term: term || undefined,
        userId: req.user.id
      });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async getStudentRecordsReport(req, res, next) {
    try {
      const { classId, status, sessionId } = req.query;
      const data = await reportsService.getStudentRecordsReport({
        classId: classId ? Number(classId) : null,
        status: status || null,
        sessionId: sessionId ? Number(sessionId) : null
      });
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },

  async getStudentMarksReport(req, res, next) {
    try {
      const { classId, subjectId, taskType, sessionId } = req.query;
      const data = await reportsService.getStudentMarksReport({
        classId: classId ? Number(classId) : null,
        subjectId: subjectId ? Number(subjectId) : null,
        taskType: taskType ? String(taskType).toUpperCase() : null,
        sessionId: sessionId ? Number(sessionId) : null
      });
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },

  async logReportExport(req, res, next) {
    try {
      const { reportType, format, filters, rowCount } = req.body;
      const result = await reportsService.logClientExport({
        reportType,
        format,
        filters,
        rowCount,
        userId: req.user.id
      });
      return sendSuccess(res, result, null, 201);
    } catch (error) {
      next(error);
    }
  },

  async exportReport(req, res, next) {
    try {
      const { reportType, format = 'csv' } = req.query;
      const filters = req.query;
      const result = await reportsService.exportReportData({
        reportType,
        format,
        filters,
        userId: req.user.id
      });

      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      return res.send(result.content);
    } catch (error) {
      next(error);
    }
  }
};
