import fs from 'fs';
import { tasksService } from './tasks.service.js';
import { sendSuccess } from '../../shared/http/response.js';

function optionalNumber(value) {
  return value ? Number(value) : null;
}

/** Remove a just-uploaded file when the request fails, so no orphan file is left behind. */
function discardUpload(req) {
  if (req.file?.path) fs.promises.unlink(req.file.path).catch(() => {});
}

export const tasksController = {
  async createTask(req, res, next) {
    try {
      const task = await tasksService.createTask(req.user, req.body, req.file || null);
      return sendSuccess(res, task, null, 201);
    } catch (error) {
      discardUpload(req);
      next(error);
    }
  },

  async getTasks(req, res, next) {
    try {
      const { classId, subjectId, teacherId, status, sessionId, taskType } = req.query;
      const tasks = await tasksService.getTasks(req.user, {
        classId: optionalNumber(classId),
        subjectId: optionalNumber(subjectId),
        teacherId: optionalNumber(teacherId),
        status: status || null,
        sessionId: optionalNumber(sessionId),
        taskType: taskType ? String(taskType).toUpperCase() : null
      });
      return sendSuccess(res, tasks);
    } catch (error) {
      next(error);
    }
  },

  async getTaskById(req, res, next) {
    try {
      const task = await tasksService.getTaskById(req.user, Number(req.params.id));
      return sendSuccess(res, task);
    } catch (error) {
      next(error);
    }
  },

  async updateTaskStatus(req, res, next) {
    try {
      const task = await tasksService.updateTaskStatus(req.user, Number(req.params.id), req.body.status);
      return sendSuccess(res, task);
    } catch (error) {
      next(error);
    }
  },

  async submitTask(req, res, next) {
    try {
      const submission = await tasksService.submitTask(req.user, Number(req.params.id), {
        file: req.file || null,
        studentNotes: req.body.studentNotes
      });
      return sendSuccess(res, submission, null, 201);
    } catch (error) {
      discardUpload(req);
      next(error);
    }
  },

  async getSubmissions(req, res, next) {
    try {
      const taskId = req.params.id ? Number(req.params.id) : optionalNumber(req.query.taskId);
      const submissions = await tasksService.getSubmissions(req.user, {
        taskId,
        studentId: optionalNumber(req.query.studentId),
        status: req.query.status || null
      });
      return sendSuccess(res, submissions);
    } catch (error) {
      next(error);
    }
  },

  async gradeSubmission(req, res, next) {
    try {
      const { marksAwarded, rubricScores, feedback, publish } = req.body;
      const result = await tasksService.gradeSubmission(req.user, Number(req.params.id), {
        marksAwarded,
        rubricScores,
        feedback,
        publish
      });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async returnSubmission(req, res, next) {
    try {
      const result = await tasksService.returnSubmission(req.user, Number(req.params.id), req.body.note);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async getTaskRoster(req, res, next) {
    try {
      const result = await tasksService.getTaskRoster(req.user, Number(req.params.id));
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async recordMarks(req, res, next) {
    try {
      const result = await tasksService.recordMarks(req.user, Number(req.params.id), {
        entries: req.body.entries,
        publish: req.body.publish
      });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  // Resources
  async createResource(req, res, next) {
    try {
      const resource = await tasksService.createResource(req.user, req.body, req.file || null);
      return sendSuccess(res, resource, null, 201);
    } catch (error) {
      discardUpload(req);
      next(error);
    }
  },

  async getResources(req, res, next) {
    try {
      const { classId, subjectId, resourceType } = req.query;
      const resources = await tasksService.getResources(req.user, {
        classId: optionalNumber(classId),
        subjectId: optionalNumber(subjectId),
        resourceType: resourceType || null
      });
      return sendSuccess(res, resources);
    } catch (error) {
      next(error);
    }
  },

  async updateResource(req, res, next) {
    try {
      const { isPublished, title, description } = req.body;
      const resource = await tasksService.updateResource(req.user, Number(req.params.id), { isPublished, title, description });
      return sendSuccess(res, resource);
    } catch (error) {
      next(error);
    }
  },

  async deleteResource(req, res, next) {
    try {
      const result = await tasksService.deleteResource(req.user, Number(req.params.id));
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  // Achievements & Recognition (SRS Section 8.3 & 12)
  async awardAchievement(req, res, next) {
    try {
      const achievement = await tasksService.awardAchievement(req.user, req.body);
      return sendSuccess(res, achievement, null, 201);
    } catch (error) {
      next(error);
    }
  },

  async updateAchievement(req, res, next) {
    try {
      const achievement = await tasksService.updateAchievement(req.user, Number(req.params.id), req.body);
      return sendSuccess(res, achievement);
    } catch (error) {
      next(error);
    }
  },

  async deleteAchievement(req, res, next) {
    try {
      const result = await tasksService.deleteAchievement(req.user, Number(req.params.id));
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async getAchievements(req, res, next) {
    try {
      const { studentId, classId } = req.query;
      const achievements = await tasksService.getAchievements(req.user, {
        studentId: optionalNumber(studentId),
        classId: optionalNumber(classId)
      });
      return sendSuccess(res, achievements);
    } catch (error) {
      next(error);
    }
  }
};
