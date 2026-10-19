import { zoomRepository } from './zoom.repository.js';
import { timetableRepository } from '../timetable/timetable.repository.js';
import { academicRepository } from '../academic/academic.repository.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { parseDbDate } from '../../shared/utils/date.js';

export const zoomService = {
  async getAllClassMeetings() {
    return await zoomRepository.getAllClassMeetings();
  },

  async setupClassMeetings({ hostUserId = 'zoom_admin_master', hostMode = 'ALT_HOST', createdBy }) {
    const classes = await academicRepository.getAllClasses();
    const createdMeetings = [];

    for (const cls of classes) {
      const existing = await zoomRepository.getMeetingByClassId(cls.id);
      if (!existing) {
        const meetingNumber = `900${cls.grade_level}000${cls.grade_level}`;
        const passcode = `CLASS${cls.grade_level}#`;
        const joinUrl = `https://zoom.us/j/${meetingNumber}?pwd=${passcode}`;
        const startUrl = `https://zoom.us/s/${meetingNumber}?zak=host_token_${cls.grade_level}`;

        const meetingId = await zoomRepository.createOrReplaceMeeting({
          classId: cls.id,
          zoomMeetingId: meetingNumber,
          topic: `Class ${cls.grade_level} Official Live Classroom`,
          joinUrl,
          passcode,
          startUrl,
          hostZoomUserId: hostUserId,
          hostMode,
          createdBy
        });
        createdMeetings.push(meetingId);
      }
    }

    return {
      message: `Ensured 8 class-level recurring Zoom meetings`,
      count: createdMeetings.length
    };
  },

  async getMyClassSession(teacherId) {
    const today = new Date().toISOString().split('T')[0];
    const lessons = await timetableRepository.getLessons({
      teacherId,
      date: today
    });

    const now = Date.now();
    return lessons.map((les) => {
      const startMs = parseDbDate(les.startAt).getTime();
      const endMs = parseDbDate(les.endAt).getTime();
      // Window: 10 min before start to end + 30 min (SRS Section 6.4)
      const isWindowOpen = now >= startMs - 10 * 60 * 1000 && now <= endMs + 30 * 60 * 1000;
      const canStart = (les.status === 'SCHEDULED' || les.status === 'LIVE') && isWindowOpen;

      return {
        ...les,
        canStart
      };
    });
  },

  async startLesson({ lessonId, teacherId, userRole }) {
    const lesson = await timetableRepository.findLessonById(lessonId);
    if (!lesson) {
      throw new AppError('Lesson not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Authorization: Assigned teacher, substitute, or Admin/Principal
    const isAssigned =
      lesson.teacher_id === teacherId ||
      lesson.substitute_teacher_id === teacherId ||
      userRole === 'ADMIN' ||
      userRole === 'PRINCIPAL';

    if (!isAssigned) {
      throw new AppError('You are not assigned to conduct this lesson', 403, ErrorCodes.FORBIDDEN);
    }

    // Time window check: 10 min before start to end + 30 min
    const now = Date.now();
    const startMs = parseDbDate(lesson.start_at).getTime();
    const endMs = parseDbDate(lesson.end_at).getTime();
    const isWindowOpen = now >= startMs - 10 * 60 * 1000 && now <= endMs + 30 * 60 * 1000;

    if (!isWindowOpen && userRole !== 'ADMIN' && userRole !== 'PRINCIPAL') {
      throw new AppError(
        'Outside permitted lesson window. Classes may only start within 10 minutes of scheduled start time.',
        422,
        ErrorCodes.OUTSIDE_LESSON_WINDOW
      );
    }

    // Check no other lesson of the same class is currently LIVE (SRS Section 6.5)
    const activeLessons = await timetableRepository.getLessons({
      classId: lesson.class_id,
      status: 'LIVE'
    });
    const conflictingLive = activeLessons.find((l) => l.id !== lesson.id);
    if (conflictingLive) {
      throw new AppError(
        'Previous lesson for this class is still LIVE. It must be ended before starting this lesson.',
        409,
        ErrorCodes.PREVIOUS_LESSON_ACTIVE
      );
    }

    // Load meeting details
    const meeting = await zoomRepository.getMeetingByClassId(lesson.class_id);
    if (!meeting) {
      throw new AppError('Class Zoom meeting not configured', 422, ErrorCodes.ZOOM_LINK_UNUSABLE);
    }

    // Update lesson status to LIVE
    await timetableRepository.updateLesson(lesson.id, {
      status: 'LIVE',
      zoom_meeting_id: meeting.id
    });

    // Log host launch in participant log
    await zoomRepository.logParticipant({
      lessonId: lesson.id,
      zoomMeetingId: meeting.zoom_meeting_id,
      source: 'PORTAL',
      userId: teacherId,
      participantName: lesson.teacherName,
      joinedAt: new Date()
    });

    return {
      lessonId: lesson.id,
      status: 'LIVE',
      zoomMeetingId: meeting.zoom_meeting_id,
      joinUrl: meeting.joinUrl,
      canStart: true
    };
  },

  async endLesson({ lessonId, teacherId, userRole, topic = '', notes = '' }) {
    const lesson = await timetableRepository.findLessonById(lessonId);
    if (!lesson) {
      throw new AppError('Lesson not found', 404, ErrorCodes.NOT_FOUND);
    }

    const isAuthorized =
      lesson.teacher_id === teacherId ||
      lesson.substitute_teacher_id === teacherId ||
      userRole === 'ADMIN' ||
      userRole === 'PRINCIPAL';

    if (!isAuthorized) {
      throw new AppError('Unauthorized to end this lesson', 403, ErrorCodes.FORBIDDEN);
    }

    await timetableRepository.updateLesson(lessonId, {
      status: 'COMPLETED'
    });

    return {
      lessonId,
      status: 'COMPLETED',
      topic,
      notes
    };
  },

  async getStudentClassSession({ studentId, classId, studentName, studentEmail }) {
    const today = new Date().toISOString().split('T')[0];
    const lessons = await timetableRepository.getLessons({
      classId,
      date: today
    });

    const now = Date.now();
    // Find current live lesson or next scheduled lesson
    const currentOrNext = lessons.find(
      (l) => l.status === 'LIVE' || (l.status === 'SCHEDULED' && parseDbDate(l.endAt).getTime() > now)
    );

    if (!currentOrNext) {
      return {
        lesson: null,
        joinUrl: null,
        message: 'No active or upcoming classes scheduled for your class today.'
      };
    }

    const startMs = parseDbDate(currentOrNext.startAt).getTime();
    const endMs = parseDbDate(currentOrNext.endAt).getTime();
    // Window: 10 min before start to end + 15 min (SRS Section 6.7)
    const inWindow = currentOrNext.status === 'LIVE' || (now >= startMs - 10 * 60 * 1000 && now <= endMs + 15 * 60 * 1000);

    const meeting = await zoomRepository.getMeetingByClassId(classId);

    if (inWindow && meeting) {
      // Log student join intent (SRS Section 6.7)
      await zoomRepository.logParticipant({
        lessonId: currentOrNext.id,
        zoomMeetingId: meeting.zoom_meeting_id,
        source: 'PORTAL',
        userId: studentId,
        participantName: studentName,
        participantEmail: studentEmail,
        joinedAt: new Date()
      });

      return {
        lesson: currentOrNext,
        inWindow: true,
        joinUrl: meeting.joinUrl,
        passcode: meeting.passcode
      };
    }

    return {
      lesson: currentOrNext,
      inWindow: false,
      joinUrl: null,
      message: 'Class session link will be accessible 10 minutes prior to scheduled start time.'
    };
  }
};
