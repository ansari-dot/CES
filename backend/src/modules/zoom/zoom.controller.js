import { zoomService } from './zoom.service.js';
import { zoomRepository } from './zoom.repository.js';
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

  async configureClassMeeting(req, res, next) {
    try {
      const classId = Number(req.params.classId);
      const { zoomMeetingId, joinUrl, passcode, hostKey, accountEmail, topic, configNotes, reason } = req.body;
      const meeting = await zoomService.configureClassMeeting({
        classId,
        zoomMeetingId,
        joinUrl,
        passcode,
        hostKey,
        accountEmail,
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
      // Find student record for logged-in user
      const student = await db('students').where({ user_id: req.user.id }).first();
      const classId = student ? student.current_class_id : Number(req.query.classId || 1);
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
      const result = await zoomService.handleWebhookEvent(req.body);
      return res.status(200).json(result);
    } catch (error) {
      console.error('Zoom webhook handling error:', error);
      return res.status(200).json({ received: false, error: error.message });
    }
  },

  async syncLessonAttendance(req, res, next) {
    try {
      const lessonId = Number(req.params.id);
      const result = await zoomService.syncLessonAttendanceFromZoom(lessonId);
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
  }
};
