import { academicService } from './academic.service.js';
import { sendSuccess } from '../../shared/http/response.js';

export const academicController = {
  async getSessions(req, res, next) {
    try {
      const sessions = await academicService.getAllSessions();
      return sendSuccess(res, sessions);
    } catch (error) {
      next(error);
    }
  },

  async createSession(req, res, next) {
    try {
      const session = await academicService.createSession(req.body);
      return sendSuccess(res, session, null, 201);
    } catch (error) {
      next(error);
    }
  },

  async getClasses(req, res, next) {
    try {
      const classes = await academicService.getAllClasses();
      return sendSuccess(res, classes);
    } catch (error) {
      next(error);
    }
  },

  async getClassSubjects(req, res, next) {
    try {
      const subjects = await academicService.getClassSubjects(Number(req.params.id));
      return sendSuccess(res, subjects);
    } catch (error) {
      next(error);
    }
  },

  async setClassSubjects(req, res, next) {
    try {
      const { subjectIds } = req.body;
      const subjects = await academicService.setClassSubjects(Number(req.params.id), subjectIds || []);
      return sendSuccess(res, subjects);
    } catch (error) {
      next(error);
    }
  },

  async getSubjects(req, res, next) {
    try {
      const subjects = await academicService.getAllSubjects();
      return sendSuccess(res, subjects);
    } catch (error) {
      next(error);
    }
  },

  async createSubject(req, res, next) {
    try {
      const subject = await academicService.createSubject(req.body);
      return sendSuccess(res, subject, null, 201);
    } catch (error) {
      next(error);
    }
  },

  async getTeacherAssignments(req, res, next) {
    try {
      const teacherId = Number(req.params.id);
      const sessionId = req.query.sessionId ? Number(req.query.sessionId) : null;
      const assignments = await academicService.getTeacherAssignments(teacherId, sessionId);
      return sendSuccess(res, assignments);
    } catch (error) {
      next(error);
    }
  },

  async assignTeacher(req, res, next) {
    try {
      const teacherId = Number(req.params.id);
      const { classId, subjectId, sessionId, effectiveFrom, effectiveTo } = req.body;
      const assignment = await academicService.assignTeacher({
        teacherId,
        classId,
        subjectId,
        sessionId,
        effectiveFrom,
        effectiveTo,
        assignedBy: req.user?.id
      });
      return sendSuccess(res, assignment, null, 201);
    } catch (error) {
      next(error);
    }
  },

  async getClassAssignments(req, res, next) {
    try {
      const classId = Number(req.params.id);
      const assignments = await academicService.getClassAssignments(classId);
      return sendSuccess(res, assignments);
    } catch (error) {
      next(error);
    }
  }
};
