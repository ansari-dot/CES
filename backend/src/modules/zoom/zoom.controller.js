import { zoomService } from './zoom.service.js';
import { zoomRepository } from './zoom.repository.js';
import { db } from '../../shared/db/knex.js';
import { sendSuccess } from '../../shared/http/response.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';

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

  async configureClassMeeting(req, res, next) {
    try {
      const classId = Number(req.params.classId);
      const {
        zoomMeetingId,
        joinUrl,
        passcode,
        hostKey,
        accountEmail,
        hostName,
        hostZoomUserId,
        accountId,
        concurrencySlot,
        topic,
        configNotes,
        reason
      } = req.body;

      const meeting = await zoomService.configureClassMeeting({
        classId,
        zoomMeetingId,
        joinUrl,
        passcode,
        hostKey,
        accountEmail,
        hostName,
        hostZoomUserId,
        accountId,
        concurrencySlot: concurrencySlot ? Number(concurrencySlot) : undefined,
        topic,
        configNotes,
        reason,
        userId: req.user?.id
      });
      return sendSuccess(res, meeting);
    } catch (error) {
      next(error);
    }
  },

  async deleteClassMeeting(req, res, next) {
    try {
      const classId = Number(req.params.classId);
      const result = await zoomService.deleteClassMeeting(classId, req.user?.id);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async deleteAllClassMeetings(req, res, next) {
    try {
      const result = await zoomService.deleteAllClassMeetings(req.user?.id);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async renewZoomMeeting(req, res, next) {
    try {
      const classId = Number(req.params.classId);
      const { newMeetingId, newJoinUrl, newPasscode, reason } = req.body;
      const result = await zoomService.renewOrReplaceMeeting({
        classId,
        newMeetingId,
        newJoinUrl,
        newPasscode,
        reason,
        userId: req.user?.id
      });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async runHealthCheck(req, res, next) {
    try {
      const classId = Number(req.params.classId);
      const result = await zoomService.runHealthCheck(classId);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async getCapacityStatus(req, res, next) {
    try {
      const result = await zoomService.getCapacityAndConcurrencyStatus();
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async getMeetingHistory(req, res, next) {
    try {
      const classId = Number(req.params.classId);
      const history = await zoomRepository.getMeetingRenewalHistory(classId);
      return sendSuccess(res, history);
    } catch (error) {
      next(error);
    }
  },

  async getMyClassSession(req, res, next) {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
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
        userId: req.user?.id,
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
      const student = await db('students').where({ user_id: req.user.id }).first();
      let classId;

      if (student || req.user?.role === 'STUDENT') {
        if (!student?.current_class_id) {
          throw new AppError('Student is not enrolled in an active class', 403, ErrorCodes.FORBIDDEN);
        }
        if (req.query.classId && Number(req.query.classId) !== Number(student.current_class_id)) {
          throw new AppError('Forbidden: You can only access your enrolled class session', 403, ErrorCodes.FORBIDDEN);
        }
        classId = Number(student.current_class_id);
      } else {
        classId = Number(req.query.classId || 1);
      }

      const studentId = student ? student.id : req.user.id;

      const result = await zoomService.getStudentClassSession({
        studentId,
        userId: req.user?.id,
        classId,
        studentName: req.user?.full_name || req.user?.username,
        studentEmail: req.user?.email
      });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async getZoomApiStatus(req, res, next) {
    try {
      const status = await zoomService.getZoomApiStatus();
      return sendSuccess(res, status);
    } catch (error) {
      next(error);
    }
  },

  async generateClassMeetingViaZoomApi(req, res, next) {
    try {
      const classId = Number(req.params.classId);
      const { passcode, topic } = req.body || {};
      const meeting = await zoomService.autoGenerateClassMeetingViaZoomApi({
        classId,
        passcode,
        topic,
        userId: req.user?.id
      });
      return sendSuccess(res, meeting);
    } catch (error) {
      next(error);
    }
  },

  async generateAllClassMeetingsViaZoomApi(req, res, next) {
    try {
      const result = await zoomService.autoGenerateAllClassMeetingsViaZoomApi({
        userId: req.user?.id
      });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async handleWebhook(req, res) {
    try {
      const result = await zoomService.handleWebhookEvent(req.body, req);
      return res.status(200).json(result);
    } catch (error) {
      if (error.statusCode === 401 || error.statusCode === 403) {
        return res.status(error.statusCode).json({ success: false, error: error.message });
      }
      console.error('Zoom webhook handling error:', error);
      return res.status(200).json({ received: false, error: error.message });
    }
  },

  async testClassEventDelivery(req, res, next) {
    try {
      const classId = Number(req.params.classId);
      const result = await zoomService.testClassEventDelivery(classId);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async listLicensedUsers(req, res, next) {
    try {
      const users = await zoomService.listLicensedUsers();
      return sendSuccess(res, users);
    } catch (error) {
      next(error);
    }
  },

  async syncLessonAttendance(req, res, next) {
    try {
      const lessonId = Number(req.params.id);
      const result = await zoomService.reconcileLessonAttendance(lessonId);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async reconcileLessonAttendance(req, res, next) {
    try {
      const lessonId = Number(req.params.id);
      const result = await zoomService.reconcileLessonAttendance(lessonId);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async getTeacherDailyDuty(req, res, next) {
    try {
      const teacherId = Number(req.params.teacherId);
      const { date } = req.query;
      const result = await zoomService.getTeacherDailyDutySummary(teacherId, date);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  },

  async getAttendanceReviews(req, res, next) {
    try {
      const { status, limit } = req.query;
      const reviews = await zoomService.getAttendanceReviews({
        status: status || null,
        limit: limit ? Number(limit) : 50
      });
      return sendSuccess(res, reviews);
    } catch (error) {
      next(error);
    }
  },

  async resolveAttendanceReview(req, res, next) {
    try {
      const logId = Number(req.params.id);
      const { decision, reviewNote } = req.body;
      const result = await zoomService.resolveAttendanceReview({
        logId,
        decision,
        reviewerUserId: req.user?.id,
        reviewNote
      });
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
};
