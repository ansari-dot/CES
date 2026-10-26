import { tasksService } from './tasks.service.js';
import { db } from '../../shared/db/knex.js';
import { sendSuccess } from '../../shared/http/response.js';

export const tasksController = {
  async createTask(req, res, next) {
    try {
      const {
        sessionId,
        classId,
        subjectId,
        teacherId,
        title,
        instructions,
        assignedDate,
        deadline,
        totalMarks,
        gradingScale,
        rubricCriteria,
        handoutUrl,
        handoutName
      } = req.body;

      // Find teacher ID if not provided explicitly
      let finalTeacherId = teacherId ? Number(teacherId) : null;
      if (!finalTeacherId) {
        const t = await db('teachers').where({ user_id: req.user.id }).first();
        finalTeacherId = t ? t.id : 1;
      }

      const task = await tasksService.createTask({
        sessionId: Number(sessionId || 1),
        classId: Number(classId),
        subjectId: Number(subjectId),
        teacherId: finalTeacherId,
        title,
        instructions,
        assignedDate,
        deadline,
        totalMarks: totalMarks ? Number(totalMarks) : 20,
        gradingScale,
        rubricCriteria,
        handoutUrl,
        handoutName,
        createdBy: req.user.id
      });

      return sendSuccess(res, task, null, 201);
    } catch (error) {
      next(error);
    }
  },

  async getTasks(req, res, next) {
    try {
      const { classId, subjectId, teacherId, status, sessionId } = req.query;
      let finalClassId = classId ? Number(classId) : null;
      let studentId = null;

      if (req.user && req.user.role === 'STUDENT') {
        const student = await db('students').where({ user_id: req.user.id }).first();
        if (student) {
          studentId = student.id;
          if (!finalClassId && student.current_class_id) {
            finalClassId = student.current_class_id;
          }
        }
      }

      const tasks = await tasksService.getTasks({
        classId: finalClassId,
        subjectId: subjectId ? Number(subjectId) : null,
        teacherId: teacherId ? Number(teacherId) : null,
        status: status || null,
        sessionId: sessionId ? Number(sessionId) : null,
        studentId
      });
      return sendSuccess(res, tasks);
    } catch (error) {
      next(error);
    }
  },

  async getTaskById(req, res, next) {
    try {
      const id = Number(req.params.id);
      const task = await tasksService.getTaskById(id);
      return sendSuccess(res, task);
    } catch (error) {
      next(error);
    }
  },

  async submitTask(req, res, next) {
    try {
      const taskId = Number(req.params.id);
      const student = await db('students').where({ user_id: req.user.id }).first();
      const studentId = student ? student.id : (req.body.studentId ? Number(req.body.studentId) : null);

      let fileUrl = req.body.fileUrl;
      let fileName = req.body.fileName;
      let fileSize = req.body.fileSize;

      if (req.file) {
        fileUrl = `/api/v1/uploads/${req.file.filename}`;
        fileName = req.file.originalname;
        fileSize = `${(req.file.size / (1024 * 1024)).toFixed(1)} MB`;
      }

      const { studentNotes } = req.body;
      const submission = await tasksService.submitTask({
        taskId,
        studentId,
        fileUrl,
        fileName,
        fileSize,
        studentNotes
      });

      return sendSuccess(res, submission, null, 201);
    } catch (error) {
      next(error);
    }
  },

  async getSubmissions(req, res, next) {
    try {
      const taskId = req.params.id ? Number(req.params.id) : (req.query.taskId ? Number(req.query.taskId) : null);
      let studentId = req.query.studentId ? Number(req.query.studentId) : null;
      const status = req.query.status || null;

      if (req.user?.role === 'STUDENT') {
        const student = await db('students').where({ user_id: req.user.id }).first();
        studentId = student ? student.id : -1;
      }

      const submissions = await tasksService.getSubmissions({ taskId, studentId, status });
      return sendSuccess(res, submissions);
    } catch (error) {
      next(error);
    }
  },

  async gradeSubmission(req, res, next) {
    try {
      const submissionId = Number(req.params.id);
      const { marksAwarded, rubricScores, feedback } = req.body;

      const result = await tasksService.gradeSubmission({
        submissionId,
        marksAwarded,
        rubricScores,
        feedback,
        gradedBy: req.user.id
      });

      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  // Resources
  async createResource(req, res, next) {
    try {
      let { classId, subjectId, title, description, resourceType, fileUrl, fileSize, isPublished } = req.body;

      if (req.file) {
        fileUrl = `/api/v1/uploads/${req.file.filename}`;
        fileSize = `${(req.file.size / (1024 * 1024)).toFixed(1)} MB`;
        if (!resourceType) {
          const mime = req.file.mimetype;
          resourceType = mime.startsWith('video') ? 'RECORDING' : mime.includes('presentation') ? 'SLIDES' : 'PDF';
        }
      }

      const resource = await tasksService.createResource({
        classId: Number(classId),
        subjectId: Number(subjectId),
        title,
        description,
        resourceType,
        fileUrl,
        fileSize,
        isPublished,
        uploadedBy: req.user.id
      });
      return sendSuccess(res, resource, null, 201);
    } catch (error) {
      next(error);
    }
  },

  async getResources(req, res, next) {
    try {
      const { classId, subjectId, resourceType } = req.query;
      const resources = await tasksService.getResources({
        classId: classId ? Number(classId) : null,
        subjectId: subjectId ? Number(subjectId) : null,
        resourceType: resourceType || null
      });
      return sendSuccess(res, resources);
    } catch (error) {
      next(error);
    }
  },

  async deleteResource(req, res, next) {
    try {
      const id = Number(req.params.id);
      await tasksService.deleteResource(id);
      return sendSuccess(res, { deleted: true, id });
    } catch (error) {
      next(error);
    }
  },

  // Achievements & Recognition (SRS Section 8.3 & 12)
  async awardAchievement(req, res, next) {
    try {
      const { studentId, classId, badgeType, title, reason, starsCount } = req.body;
      const achievement = await tasksService.awardAchievement({
        studentId,
        teacherUserId: req.user.id,
        classId,
        badgeType,
        title,
        reason,
        starsCount
      });
      return sendSuccess(res, achievement, null, 201);
    } catch (error) {
      next(error);
    }
  },

  async getAchievements(req, res, next) {
    try {
      const { studentId, classId, teacherId } = req.query;
      const achievements = await tasksService.getAchievements({
        studentId: studentId ? Number(studentId) : null,
        classId: classId ? Number(classId) : null,
        teacherId: teacherId ? Number(teacherId) : null
      });
      return sendSuccess(res, achievements);
    } catch (error) {
      next(error);
    }
  }
};
