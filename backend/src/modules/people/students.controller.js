import { studentsService } from './students.service.js';
import { sendSuccess } from '../../shared/http/response.js';

export const studentsController = {
  async getAllStudents(req, res, next) {
    try {
      const classId = req.query.classId ? Number(req.query.classId) : null;
      const status = req.query.status || null;
      const students = await studentsService.getAllStudents({ classId, status });
      return sendSuccess(res, students);
    } catch (error) {
      next(error);
    }
  },

  async getStudentById(req, res, next) {
    try {
      const student = await studentsService.getStudentById(Number(req.params.id));
      return sendSuccess(res, student);
    } catch (error) {
      next(error);
    }
  },

  async createStudent(req, res, next) {
    try {
      const {
        name,
        admissionNo,
        rollNo,
        dateOfBirth,
        gender,
        currentClassId,
        email,
        phone,
        sessionId
      } = req.body;

      const student = await studentsService.createStudent({
        name,
        admissionNo,
        rollNo,
        dateOfBirth,
        gender,
        currentClassId: Number(currentClassId),
        email,
        phone,
        sessionId: sessionId ? Number(sessionId) : null
      });

      return sendSuccess(res, student, null, 201);
    } catch (error) {
      next(error);
    }
  },

  async enrollStudent(req, res, next) {
    try {
      const studentId = Number(req.params.id);
      const { classId, sessionId, rollNo, status, enrolledOn } = req.body;

      const result = await studentsService.enrollStudent({
        studentId,
        classId: Number(classId),
        sessionId: Number(sessionId),
        rollNo,
        status,
        enrolledOn
      });

      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async linkGuardians(req, res, next) {
    try {
      const studentId = Number(req.params.id);
      const { parentId, relation, isPrimary } = req.body;

      const result = await studentsService.linkGuardian({
        studentId,
        parentId: Number(parentId),
        relation,
        isPrimary,
        linkedBy: req.user?.id
      });

      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async getMyDashboard(req, res, next) {
    try {
      const data = await studentsService.getMyDashboard(req.user.id);
      return sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  },

  async joinLiveLesson(req, res, next) {
    try {
      const lessonId = Number(req.params.lessonId);
      const session = await studentsService.joinLiveLesson(req.user.id, lessonId);
      return sendSuccess(res, session);
    } catch (error) {
      next(error);
    }
  }
};
