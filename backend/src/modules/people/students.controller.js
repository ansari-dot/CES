import { studentsService } from './students.service.js';
import { sendSuccess } from '../../shared/http/response.js';
import { db } from '../../shared/db/knex.js';
import { timetableRepository } from '../timetable/timetable.repository.js';
import { assertCanViewStudent, getTeacherScope, isStaff, forbidden } from '../../shared/services/accessScope.js';

export const studentsController = {
  async getAllStudents(req, res, next) {
    try {
      const classId = req.query.classId ? Number(req.query.classId) : null;
      const status = req.query.status || null;

      // Teachers only see students of the classes they teach
      if (req.user.role === 'TEACHER') {
        const scope = await getTeacherScope(req.user.id);
        const allowed = Array.from(scope.classIds);
        if (classId && !scope.classIds.has(classId)) return sendSuccess(res, []);
        const students = await studentsService.getAllStudents({
          classId,
          classIds: classId ? null : allowed,
          status: status || 'ACTIVE'
        });
        return sendSuccess(res, students);
      }

      if (!isStaff(req.user)) {
        throw forbidden('You are not allowed to list student records.');
      }

      const students = await studentsService.getAllStudents({ classId, status });
      return sendSuccess(res, students);
    } catch (error) {
      next(error);
    }
  },

  async getStudentById(req, res, next) {
    try {
      await assertCanViewStudent(req.user, Number(req.params.id));
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

  async getMyTimetable(req, res, next) {
    try {
      const student = await db('students').where({ user_id: req.user.id }).first();
      if (!student) return sendSuccess(res, []);

      let classId = student.current_class_id;
      if (!classId) {
        const activeEnrollment = await db('enrollments')
          .where({ student_id: student.id, status: 'ACTIVE' })
          .orderBy('id', 'desc')
          .first();
        if (activeEnrollment) {
          classId = activeEnrollment.class_id;
        }
      }

      if (!classId) return sendSuccess(res, []);

      const lessons = await timetableRepository.getLessons({ classId });
      return sendSuccess(res, lessons);
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
  },

  async getMyGrades(req, res, next) {
    try {
      const grades = await studentsService.getStudentGrades(req.user.id, true);
      return sendSuccess(res, grades);
    } catch (error) {
      next(error);
    }
  },

  async getStudentGrades(req, res, next) {
    try {
      const studentId = Number(req.params.id);
      await assertCanViewStudent(req.user, studentId);
      const grades = await studentsService.getStudentGrades(studentId, false);
      return sendSuccess(res, grades);
    } catch (error) {
      next(error);
    }
  }
};
