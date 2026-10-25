import { studentsRepository } from './students.repository.js';
import { academicRepository } from '../academic/academic.repository.js';
import { hashPassword } from '../../shared/crypto/password.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { emailService } from '../../shared/email/email.service.js';

import { timetableRepository } from '../timetable/timetable.repository.js';
import { zoomRepository } from '../zoom/zoom.repository.js';
import { parseDbDate } from '../../shared/utils/date.js';
import { feesRepository } from '../fees/fees.repository.js';
import { config } from '../../config/index.js';

export const studentsService = {
  async getAllStudents(filter = {}) {
    return await studentsRepository.getAllStudents(filter);
  },

  async getStudentById(id) {
    const student = await studentsRepository.getStudentById(id);
    if (!student) {
      throw new AppError('Student not found', 404, ErrorCodes.NOT_FOUND);
    }
    return student;
  },

  async createStudent({
    name,
    admissionNo,
    rollNo,
    dateOfBirth,
    gender,
    currentClassId,
    email,
    phone,
    sessionId = null
  }) {
    // Determine active academic session if none provided
    let activeSessionId = sessionId;
    if (!activeSessionId) {
      const currentSession = await academicRepository.getCurrentSession();
      if (currentSession) {
        activeSessionId = currentSession.id;
      }
    }

    const username = admissionNo.toLowerCase().replace(/[^a-z0-9]/g, '') || `std_${Date.now()}`;
    const temporaryPassword = 'StudentPassword123!';
    const passwordHash = await hashPassword(temporaryPassword);

    const { userId, studentId } = await studentsRepository.createStudentWithUser({
      user: {
        username,
        // Also store admissionNo as a searchable alias so students can log in
        // with either the cleaned username OR the original admission number.
        // The auth findUserByIdentifier already searches username/email/phone;
        // we store the original admissionNo in the email field only when no
        // real email is provided, so the student can type it at the login screen.
        email: email || null,
        phone: phone || null,
        full_name: name,
        password_hash: passwordHash,
        status: 'ACTIVE'
      },
      student: {
        admission_no: admissionNo,
        roll_no: rollNo || null,
        date_of_birth: dateOfBirth || null,
        gender: gender || null,
        current_class_id: currentClassId,
        status: 'ACTIVE'
      },
      enrollment: activeSessionId
        ? {
            session_id: activeSessionId
          }
        : null
    });

    // Send Welcome Email with credentials to student/parent
    if (email) {
      emailService.sendStudentCredentials({
        email,
        name,
        admissionNo,
        rollNo,
        className: `Class ${currentClassId}`,
        username,
        temporaryPassword
      }).catch((err) => {
        console.warn(`[StudentsService] Background email dispatch failed: ${err.message}`);
      });
    }

    return {
      id: studentId,
      userId,
      name,
      admissionNo,
      rollNo,
      currentClassId,
      temporaryPassword
    };
  },

  async enrollStudent({ studentId, classId, sessionId, rollNo, status, enrolledOn }) {
    const student = await studentsRepository.getStudentById(studentId);
    if (!student) {
      throw new AppError('Student not found', 404, ErrorCodes.NOT_FOUND);
    }

    const enrollmentId = await studentsRepository.enrollStudent({
      studentId,
      classId,
      sessionId,
      rollNo,
      status,
      enrolledOn
    });

    return { enrollmentId, studentId, classId, sessionId, status };
  },

  async linkGuardian({ studentId, parentId, relation, isPrimary, linkedBy }) {
    await studentsRepository.linkGuardian({
      studentId,
      parentId,
      relation,
      isPrimary: isPrimary ? 1 : 0,
      linkedBy
    });
    return { studentId, parentId, relation };
  },

  async getMyDashboard(userId) {
    const data = await studentsRepository.getStudentDashboard(userId);
    if (!data) {
      throw new AppError('Student profile not found', 404, ErrorCodes.NOT_FOUND);
    }
    if (data.isRestricted) {
      const student = await studentsRepository.getStudentByUserId(userId);
      const feeRestriction = await feesRepository.getStudentRestrictionSummary(student.id);
      const whatsapp = config.PRINCIPAL_WHATSAPP_NUMBER?.replace(/\D/g, '');
      return {
        ...data,
        student,
        restrictionType: feeRestriction ? 'FEE_OVERDUE' : 'ACCOUNT',
        ...(feeRestriction && {
          suspensionReason:
            'Your portal access is temporarily restricted because your fee invoice was not paid by the end of the grace period.',
          resolutionMessage:
            'Please pay the outstanding fee, then contact the Principal on WhatsApp with your name and student ID. Your access will be restored once the Principal confirms.',
          feeRestriction
        }),
        principalContact: { whatsappUrl: whatsapp ? `https://wa.me/${whatsapp}` : null }
      };
    }
    return data;
  },

  async joinLiveLesson(userId, lessonId) {
    const student = await studentsRepository.getStudentByUserId(userId);
    if (!student) {
      throw new AppError('Student profile not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (
      student.enrollmentStatus === 'SUSPENDED' ||
      student.accountStatus === 'SUSPENDED' ||
      student.enrollmentStatus === 'DEACTIVATED' ||
      student.accountStatus === 'DEACTIVATED'
    ) {
      throw new AppError(
        'Classroom access is temporarily restricted due to account suspension or outstanding fee dues.',
        403,
        ErrorCodes.ACCOUNT_SUSPENDED
      );
    }

    const lesson = await timetableRepository.findLessonById(lessonId);
    if (!lesson) {
      throw new AppError('Lesson not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (Number(lesson.class_id) !== Number(student.currentClassId)) {
      throw new AppError('Access denied. This lesson belongs to another class.', 403, ErrorCodes.FORBIDDEN);
    }

    const now = Date.now();
    const startMs = parseDbDate(lesson.start_at).getTime();
    const endMs = parseDbDate(lesson.end_at).getTime();
    const inWindow = lesson.status === 'LIVE' || (now >= startMs - 10 * 60 * 1000 && now <= endMs + 15 * 60 * 1000);

    const meeting = await zoomRepository.getMeetingByClassId(student.currentClassId);
    if (!meeting) {
      throw new AppError('Zoom meeting not configured for this class.', 422, ErrorCodes.ZOOM_LINK_UNUSABLE);
    }

    if (inWindow) {
      await zoomRepository.logParticipant({
        lessonId: lesson.id,
        zoomMeetingId: meeting.zoom_meeting_id,
        source: 'PORTAL',
        userId: student.userId || student.user_id || userId,
        participantName: student.name,
        participantEmail: student.email,
        joinedAt: new Date()
      });

      return {
        lessonId: lesson.id,
        status: lesson.status,
        sessionState: lesson.session_state || (lesson.status === 'LIVE' ? 'LIVE' : 'SCHEDULED'),
        inWindow: true,
        canJoin: true,
        meetingId: meeting.zoom_meeting_id,
        joinUrl: meeting.joinUrl,
        passcode: meeting.passcode
      };
    }

    return {
      lessonId: lesson.id,
      status: lesson.status,
      sessionState: lesson.session_state || 'SCHEDULED',
      inWindow: false,
      canJoin: false,
      meetingId: meeting.zoom_meeting_id,
      joinUrl: null,
      passcode: meeting.passcode,
      message: 'Class session link will be accessible 10 minutes prior to scheduled start time.'
    };
  }
};
