import { chatService } from './chat.service.js';
import { sendSuccess } from '../../shared/http/response.js';

export const chatController = {
  async getThreads(req, res, next) {
    try {
      const role = req.user.role;
      let result = null;
      if (role === 'TEACHER') {
        result = await chatService.getTeacherThreads(req.user.id, req.query);
      } else if (role === 'STUDENT') {
        result = await chatService.getStudentThreads(req.user.id, req.query);
      } else if (role === 'PRINCIPAL' || role === 'ADMIN') {
        result = await chatService.getPrincipalOversight({
          userId: req.user.id,
          userRole: role,
          filters: req.query,
          ipAddress: req.ip
        });
      }
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },

  async createThread(req, res, next) {
    try {
      const { classId, subjectId, targetStudentId, targetTeacherId } = req.body;
      const thread = await chatService.getOrCreateThread({
        userId: req.user.id,
        userRole: req.user.role,
        classId,
        subjectId,
        targetStudentId,
        targetTeacherId
      });
      return sendSuccess(res, thread, null, 201);
    } catch (err) {
      next(err);
    }
  },

  async getMessages(req, res, next) {
    try {
      const { threadId } = req.params;
      const { page, limit, beforeId } = req.query;
      const result = await chatService.getThreadMessages({
        threadId: Number(threadId),
        userId: req.user.id,
        userRole: req.user.role,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 50,
        beforeId: beforeId ? Number(beforeId) : null,
        ipAddress: req.ip
      });
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },

  async sendMessage(req, res, next) {
    try {
      const { threadId } = req.params;
      const { content } = req.body;
      const result = await chatService.sendMessage({
        threadId: Number(threadId),
        userId: req.user.id,
        userRole: req.user.role,
        content
      });
      return sendSuccess(res, result, null, 201);
    } catch (err) {
      next(err);
    }
  },

  async markRead(req, res, next) {
    try {
      const { threadId } = req.params;
      const result = await chatService.markAsRead({
        threadId: Number(threadId),
        userId: req.user.id,
        userRole: req.user.role
      });
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getOversight(req, res, next) {
    try {
      const result = await chatService.getPrincipalOversight({
        userId: req.user.id,
        userRole: req.user.role,
        filters: req.query,
        ipAddress: req.ip
      });
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },

  async getClassStudents(req, res, next) {
    try {
      const { classId } = req.params;
      const students = await chatService.getClassStudents(req.user.id, classId);
      return sendSuccess(res, students);
    } catch (err) {
      next(err);
    }
  }
};

