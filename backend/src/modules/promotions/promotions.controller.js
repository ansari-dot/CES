import { promotionsService } from './promotions.service.js';
import { sendSuccess } from '../../shared/http/response.js';

export const promotionsController = {
  async evaluate(req, res, next) {
    try {
      const summary = await promotionsService.evaluate(req.body, req.user);
      return sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  },

  async list(req, res, next) {
    try {
      const rows = await promotionsService.list(req.query);
      return sendSuccess(res, rows);
    } catch (error) {
      next(error);
    }
  },

  async overview(req, res, next) {
    try {
      const data = await promotionsService.overview(req.query);
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },

  async decide(req, res, next) {
    try {
      const record = await promotionsService.decide(req.params.id, req.body, req.user);
      return sendSuccess(res, record);
    } catch (error) {
      next(error);
    }
  },

  async bulkApprove(req, res, next) {
    try {
      const summary = await promotionsService.bulkApprove(req.body, req.user);
      return sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  },

  async preview(req, res, next) {
    try {
      const data = await promotionsService.preview(req.query);
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },

  async execute(req, res, next) {
    try {
      const summary = await promotionsService.execute(req.body, req.user);
      return sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  },

  async history(req, res, next) {
    try {
      const rows = await promotionsService.history(req.params.studentId);
      return sendSuccess(res, rows);
    } catch (error) {
      next(error);
    }
  }
};
