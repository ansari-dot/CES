import { zoomService } from './zoom.service.js';
import { db } from '../../shared/db/knex.js';
import { sendSuccess } from '../../shared/http/response.js';

export const zoomController = {
  async setupClassMeetings(req, res, next) {
    try {
      const result = await zoomService.setupClassMeetings({
        createdBy: req.user?.id
      });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async getClassMeetings(req, res, next) {
    try {
      const meetings = await zoomService.getAllClassMeetings();
      return sendSuccess(res, meetings);
    } catch (error) {
      next(error);
    }
  },

  async getMyClassSession(req, res, next) {
    try {
      // Find teacher record for logged-in user
      const teacher = await db('teachers').where({ user_id: req.user.id }).first();
      const teacherId = teacher ? teacher.id : req.user.id;

      const sessions = await zoomService.getMyClassSession(teacherId);
      return sendSuccess(res, sessions);
    } catch (error) {
      next(error);
    }
  },

  async startLesson(req, res, next) {
    try {
      const lessonId = Number(req.params.id);
      const teacher = await db('teachers').where({ user_id: req.user.id }).first();
      const teacherId = teacher ? teacher.id : req.user.id;

      const result = await zoomService.startLesson({
        lessonId,
        teacherId,
        userRole: req.user?.role
      });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async endLesson(req, res, next) {
    try {
      const lessonId = Number(req.params.id);
      const teacher = await db('teachers').where({ user_id: req.user.id }).first();
      const teacherId = teacher ? teacher.id : req.user.id;
      const { topic, notes } = req.body;

      const result = await zoomService.endLesson({
        lessonId,
        teacherId,
        userRole: req.user?.role,
        topic,
        notes
      });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async getStudentClassSession(req, res, next) {
    try {
      // Find student record for logged-in user
      const student = await db('students').where({ user_id: req.user.id }).first();
      const classId = student ? student.current_class_id : Number(req.query.classId || 1);
      const studentId = student ? student.id : req.user.id;

      const result = await zoomService.getStudentClassSession({
        studentId,
        classId,
        studentName: req.user?.full_name || req.user?.username,
        studentEmail: req.user?.email
      });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
};
