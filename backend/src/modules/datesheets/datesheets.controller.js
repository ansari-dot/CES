import { datesheetsService } from './datesheets.service.js';
import { sendSuccess } from '../../shared/http/response.js';

export const datesheetsController = {
  /**
   * GET /api/v1/datesheets
   * Principal list date sheets with filters
   */
  async listDateSheets(req, res, next) {
    try {
      const { academicSessionId, examType, status, isPublished, page, limit } = req.query;
      const result = await datesheetsService.listDateSheets({
        academicSessionId: academicSessionId ? Number(academicSessionId) : undefined,
        examType: examType || undefined,
        status: status || undefined,
        isPublished: isPublished !== undefined ? isPublished === 'true' || isPublished === '1' : undefined,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20
      });
      return sendSuccess(res, result, 'Date sheets retrieved successfully.');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/v1/datesheets/:id
   * Principal get date sheet details with full class entries
   */
  async getDateSheetById(req, res, next) {
    try {
      const { id } = req.params;
      const result = await datesheetsService.getDateSheetDetails(Number(id));
      return sendSuccess(res, result, 'Date sheet details retrieved successfully.');
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/v1/datesheets
   * Principal create date sheet
   */
  async createDateSheet(req, res, next) {
    try {
      const result = await datesheetsService.createDateSheet(req.body, req.user);
      return sendSuccess(res, result, 'Date sheet created successfully.', 201);
    } catch (err) {
      next(err);
    }
  },

  /**
   * PUT /api/v1/datesheets/:id
   * Principal update date sheet
   */
  async updateDateSheet(req, res, next) {
    try {
      const { id } = req.params;
      const result = await datesheetsService.updateDateSheet(Number(id), req.body, req.user);
      return sendSuccess(res, result, 'Date sheet updated successfully.');
    } catch (err) {
      next(err);
    }
  },

  /**
   * PATCH /api/v1/datesheets/:id/publish
   * Principal toggle publish / hide status
   */
  async togglePublishStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { isPublished } = req.body;
      const result = await datesheetsService.togglePublishStatus(Number(id), { isPublished }, req.user);
      return sendSuccess(res, result, `Date sheet ${isPublished ? 'published' : 'hidden'} successfully.`);
    } catch (err) {
      next(err);
    }
  },

  /**
   * DELETE /api/v1/datesheets/:id
   * Principal delete date sheet
   */
  async deleteDateSheet(req, res, next) {
    try {
      const { id } = req.params;
      await datesheetsService.deleteDateSheet(Number(id), req.user);
      return sendSuccess(res, null, 'Date sheet deleted successfully.');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/v1/datesheets/student/active
   * Student get active published date sheets & popup announcement
   */
  async getStudentActiveDateSheets(req, res, next) {
    try {
      const result = await datesheetsService.getStudentActiveDateSheets(req.user.id);
      return sendSuccess(res, result, 'Student examination date sheets retrieved successfully.');
    } catch (err) {
      next(err);
    }
  },

  /**
   * GET /api/v1/datesheets/teacher/active
   * Teacher get active published date sheets & popup announcement
   */
  async getTeacherActiveDateSheets(req, res, next) {
    try {
      const result = await datesheetsService.getTeacherActiveDateSheets(req.user.id);
      return sendSuccess(res, result, 'Teacher examination date sheets retrieved successfully.');
    } catch (err) {
      next(err);
    }
  }
};
