import { zoomRepository } from './zoom.repository.js';
import { timetableRepository } from '../timetable/timetable.repository.js';
import { academicRepository } from '../academic/academic.repository.js';
import { db } from '../../shared/db/knex.js';
import { notificationService } from '../../shared/services/notificationService.js';
import { zoomApiClient } from '../../shared/services/zoomApiClient.js';
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
          configNotes: 'Persistent Zoom room configured with Join-Before-Host (JBH) enabled.',
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

  async configureClassMeeting({
    classId,
    zoomMeetingId,
    joinUrl,
    passcode,
    hostKey,
    accountEmail,
    topic,
    configNotes,
    reason = 'Principal updated classroom configuration',
    userId
  }) {
    if (!classId) {
      throw new AppError('classId is required', 400, ErrorCodes.BAD_REQUEST);
    }
    if (!zoomMeetingId || !String(zoomMeetingId).trim()) {
      throw new AppError('Zoom meeting ID is required', 400, ErrorCodes.BAD_REQUEST);
    }
    if (!joinUrl || !String(joinUrl).trim().startsWith('http')) {
      throw new AppError('A valid Zoom join URL (http/https) is required', 400, ErrorCodes.BAD_REQUEST);
    }

    const cleanMeetingId = String(zoomMeetingId).replace(/\s+/g, '');
    let finalNotes = (configNotes || '').trim();
    if (hostKey && !finalNotes.includes(hostKey)) {
      finalNotes = `Host Key: ${hostKey}. ${finalNotes}`.trim();
    }
    if (accountEmail && !finalNotes.includes(accountEmail)) {
      finalNotes = `Account: ${accountEmail}. ${finalNotes}`.trim();
    }

    const meetingId = await zoomRepository.configureClassMeeting({
      classId: Number(classId),
      zoomMeetingId: cleanMeetingId,
      topic: topic || `Class ${classId} Official Live Classroom`,
      joinUrl: String(joinUrl).trim(),
      passcode: passcode ? String(passcode).trim() : null,
      startUrl: String(joinUrl).trim(),
      configNotes: finalNotes || 'Persistent room configured with Join-Before-Host (JBH) enabled.',
      reason,
      createdBy: userId
    });

    await db('audit_logs').insert({
      actor_id: userId || null,
      actor_name: 'Principal',
      actor_role: 'PRINCIPAL',
      action: 'ZOOM_CLASSROOM_CONFIGURED',
      record_type: 'Zoom Meeting',
      record_identifier: String(meetingId),
      reason: `Principal configured permanent classroom for Class ${classId} (Meeting ID: ${cleanMeetingId}).`,
      created_at: db.fn.now(3)
    });

    return await zoomRepository.getMeetingByClassId(Number(classId));
  },

  async deleteClassMeeting(classId, userId) {
    const existing = await zoomRepository.getMeetingByClassId(Number(classId));
    if (!existing) {
      throw new AppError(`Class ${classId} Zoom meeting not found`, 404, ErrorCodes.NOT_FOUND);
    }
    await zoomRepository.deleteMeetingByClassId(Number(classId));
    await db('audit_logs').insert({
      actor_id: userId || null,
      actor_name: 'Principal',
      actor_role: 'PRINCIPAL',
      action: 'ZOOM_CLASSROOM_DELETED',
      record_type: 'Zoom Meeting',
      record_identifier: String(existing.id),
      reason: `Principal deleted Zoom classroom link for Class ${classId} (Meeting ID: ${existing.zoom_meeting_id}).`,
      created_at: db.fn.now(3)
    });
    return { success: true, message: `Class ${classId} meeting removed.` };
  },

  async renewOrReplaceMeeting({ classId, newMeetingId, newJoinUrl, newPasscode, reason, userId }) {
    if (!reason || !reason.trim()) {
      throw new AppError('A reason is mandatory for renewing or replacing a class Zoom room link.', 400, ErrorCodes.BAD_REQUEST);
    }

    const existing = await zoomRepository.getMeetingByClassId(Number(classId));
    if (!existing) {
      throw new AppError(`Class ${classId} Zoom meeting not found`, 404, ErrorCodes.NOT_FOUND);
    }

    const nextMeetingId = newMeetingId
      ? String(newMeetingId).replace(/\s+/g, '')
      : `900${classId}${Math.floor(1000 + Math.random() * 9000)}`;
    const nextPasscode = newPasscode || `CLASS${classId}#${Math.floor(10 + Math.random() * 89)}`;
    const nextJoinUrl = newJoinUrl || `https://zoom.us/j/${nextMeetingId}?pwd=${nextPasscode}`;

    await zoomRepository.configureClassMeeting({
      classId: Number(classId),
      zoomMeetingId: nextMeetingId,
      topic: `Class ${classId} Official Live Classroom`,
      joinUrl: nextJoinUrl,
      passcode: nextPasscode,
      startUrl: nextJoinUrl,
      configNotes: `Rotated on ${new Date().toISOString().split('T')[0]}. Reason: ${reason}`,
      reason,
      createdBy: userId
    });

    await db('audit_logs').insert({
      actor_id: userId || null,
      actor_name: 'Principal',
      actor_role: 'PRINCIPAL',
      action: 'ZOOM_CLASSROOM_ROTATED',
      record_type: 'Zoom Meeting',
      record_identifier: String(existing.id),
      reason: `Rotated Class ${classId} Zoom room from ${existing.zoom_meeting_id} to ${nextMeetingId}. Justification: ${reason}`,
      previous_value: existing.zoom_meeting_id,
      new_value: nextMeetingId,
      created_at: db.fn.now(3)
    });

    return await zoomRepository.getMeetingByClassId(Number(classId));
  },

  async getZoomApiStatus() {
    return await zoomApiClient.testConnection();
  },

  async autoGenerateClassMeetingViaZoomApi({ classId, passcode, topic, userId }) {
    if (!zoomApiClient.isConfigured()) {
      throw new AppError(
        'Zoom API credentials are not configured in .env. Please configure ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET, or use manual configuration mode.',
        422,
        ErrorCodes.ZOOM_LINK_UNUSABLE
      );
    }

    const cls = await academicRepository.findClassById(Number(classId));
    if (!cls) {
      throw new AppError(`Class ${classId} not found`, 404, ErrorCodes.NOT_FOUND);
    }

    const customTopic = topic || `Class ${cls.grade_level} Official Live Classroom`;
    const cleanPasscode = passcode ? String(passcode).trim() : `CLASS${cls.grade_level}#`;

    const zoomResult = await zoomApiClient.createClassroomMeeting({
      gradeLevel: cls.grade_level,
      topic: customTopic,
      passcode: cleanPasscode
    });

    const meetingId = await zoomRepository.configureClassMeeting({
      classId: Number(classId),
      zoomMeetingId: zoomResult.meetingId,
      topic: customTopic,
      joinUrl: zoomResult.joinUrl,
      passcode: zoomResult.passcode,
      startUrl: zoomResult.startUrl || zoomResult.joinUrl,
      configNotes: 'Created via Zoom Server-to-Server OAuth API with Join-Before-Host (JBH) enabled.',
      reason: 'Auto-created via Zoom Server-to-Server OAuth API',
      createdBy: userId
    });

    await db('audit_logs').insert({
      actor_id: userId || null,
      actor_name: 'Principal',
      actor_role: 'PRINCIPAL',
      action: 'ZOOM_CLASSROOM_API_GENERATED',
      record_type: 'Zoom Meeting',
      record_identifier: String(meetingId),
      reason: `Auto-generated Zoom classroom via Zoom API for Class ${classId} (Meeting ID: ${zoomResult.meetingId}).`,
      created_at: db.fn.now(3)
    });

    return await zoomRepository.getMeetingByClassId(Number(classId));
  },

  async autoGenerateAllClassMeetingsViaZoomApi({ userId }) {
    if (!zoomApiClient.isConfigured()) {
      throw new AppError(
        'Zoom API credentials are not configured in .env. Please configure ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET, or use manual configuration mode.',
        422,
        ErrorCodes.ZOOM_LINK_UNUSABLE
      );
    }

    const classes = await academicRepository.getAllClasses();
    const results = [];

    for (const cls of classes) {
      try {
        const meeting = await this.autoGenerateClassMeetingViaZoomApi({
          classId: cls.id,
          userId
        });
        results.push({ classId: cls.id, grade: cls.grade_level, success: true, meetingId: meeting.zoom_meeting_id });
      } catch (err) {
        results.push({ classId: cls.id, grade: cls.grade_level, success: false, error: err.message });
      }
    }

    return {
      message: `Processed Zoom API meeting generation for ${classes.length} classes`,
      results
    };
  },

  async runHealthCheck(classId) {
    const meeting = await zoomRepository.getMeetingByClassId(Number(classId));
    if (!meeting) {
      throw new AppError(`Class ${classId} Zoom meeting not found`, 404, ErrorCodes.NOT_FOUND);
    }

    let isHealthy = false;
    let zoomApiDetails = null;

    if (zoomApiClient.isConfigured() && meeting.zoom_meeting_id && /^\d+$/.test(meeting.zoom_meeting_id)) {
      try {
        const zoomMeeting = await zoomApiClient.getMeeting(meeting.zoom_meeting_id);
        isHealthy = Boolean(zoomMeeting && zoomMeeting.id);
        zoomApiDetails = {
          verifiedOnZoom: true,
          joinBeforeHost: zoomMeeting.settings?.join_before_host ?? null,
          meetingStatus: zoomMeeting.status || 'active'
        };
      } catch (err) {
        isHealthy = false;
        zoomApiDetails = {
          verifiedOnZoom: false,
          error: err.message || 'Meeting could not be verified on Zoom'
        };
      }
    } else {
      const isValidUrl = meeting.joinUrl && (meeting.joinUrl.startsWith('https://') || meeting.joinUrl.startsWith('http://'));
      const hasId = Boolean(meeting.zoom_meeting_id);
      isHealthy = Boolean(isValidUrl && hasId);
      zoomApiDetails = {
        verifiedOnZoom: false,
        mode: 'Format validation (Manual mode)'
      };
    }

    const status = isHealthy ? 'HEALTHY' : 'DEGRADED';
    await zoomRepository.updateMeetingHealth(Number(classId), status);

    return {
      classId: Number(classId),
      classNumber: meeting.grade_level || classId,
      zoomMeetingId: meeting.zoom_meeting_id,
      healthCheckStatus: isHealthy ? 'Operational' : 'Degraded',
      zoomApiDetails,
      lastHealthCheckDate: new Date().toISOString()
    };
  },

  async getCapacityAndConcurrencyStatus() {
    const activeMeetings = await db('zoom_meetings').where({ status: 'ACTIVE' }).count('id as count').first();
    const today = new Date().toISOString().split('T')[0];
    const todayLessons = await db('timetable_lessons').where({ lesson_date: today }).count('id as count').first();
    const absenceAlerts = await db('timetable_lessons').where({ lesson_date: today }).whereNotNull('teacher_absence_alert_at').count('id as count').first();

    return {
      accountType: 'Zoom Pro (Single License)',
      licensedHost: 'Principal (School Administrator)',
      licensedHostLimit: 1,
      concurrencyArchitecture: 'Persistent Classrooms with Join-Before-Host (JBH) and Passcodes',
      configuredClassrooms: Number(activeMeetings?.count || 0),
      simultaneousCapacity: 8,
      todayScheduledLessons: Number(todayLessons?.count || 0),
      todayAbsenceAlerts: Number(absenceAlerts?.count || 0),
      zoomApiConfigured: zoomApiClient.isConfigured(),
      realZoomCapabilities: {
        hostDelegationSupportedViaApi: false,
        simultaneousMeetingsUnderSingleHost: 'Restricted without JBH',
        mitigationStrategy: 'Join-Before-Host enabled on persistent meetings with LMS application-level teacher handover and time-fenced access.'
      },
      policyNotes: 'Official Zoom Pro license officially allows 1 concurrent meeting hosted by the licensed user. For 8 simultaneous classes, rooms are pre-configured with Join-Before-Host (JBH). The LMS manages teacher authorization, attendance timestamps, and handover transitions.'
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

      const diffMin = Math.round((startMs - now) / 60000);
      const isStartingSoon = diffMin > 0 && diffMin <= 5;

      return {
        ...les,
        canStart,
        minutesUntilStart: diffMin,
        isStartingSoon
      };
    });
  },

  async startLesson({ lessonId, teacherId, userId = null, userRole }) {
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

    // Seamless Host Handoff: If previous lesson for this class is still LIVE,
    // automatically conclude it so host privileges cleanly transfer to the incoming teacher.
    const activeLessons = await timetableRepository.getLessons({
      classId: lesson.class_id,
      status: 'LIVE'
    });
    const conflictingLive = activeLessons.find((l) => l.id !== lesson.id);
    if (conflictingLive) {
      await timetableRepository.updateLesson(conflictingLive.id, {
        status: 'COMPLETED',
        session_state: 'COMPLETED',
        handover_at: db.fn.now(3),
        handover_notes: 'Concluded automatically upon host transition to next scheduled period teacher.'
      });

      await db('audit_logs').insert({
        actor_id: userId || null,
        actor_name: lesson.teacherName || 'Faculty',
        actor_role: userRole || 'TEACHER',
        action: 'TEACHER_HANDOVER_CONCLUDED',
        record_type: 'Timetable Lesson',
        record_identifier: String(conflictingLive.id),
        reason: `Previous lesson automatically concluded upon start of lesson #${lesson.id} by incoming teacher.`,
        previous_value: 'LIVE',
        new_value: 'COMPLETED',
        created_at: db.fn.now(3)
      });
    }

    // Load meeting details
    const meeting = await zoomRepository.getMeetingByClassId(lesson.class_id);
    if (!meeting) {
      throw new AppError('Class Zoom meeting not configured', 422, ErrorCodes.ZOOM_LINK_UNUSABLE);
    }

    // Update lesson status to LIVE and record teacher join timestamp
    await timetableRepository.updateLesson(lesson.id, {
      status: 'LIVE',
      session_state: 'LIVE',
      teacher_joined_at: db.fn.now(3),
      zoom_meeting_id: meeting.id
    });

    // Resolve user ID for participant log
    let logUserId = userId;
    if (!logUserId && teacherId) {
      const teacherRow = await db('teachers').where({ id: teacherId }).first();
      logUserId = teacherRow ? teacherRow.user_id : null;
    }

    // Log host launch in participant log
    await zoomRepository.logParticipant({
      lessonId: lesson.id,
      zoomMeetingId: meeting.zoom_meeting_id,
      source: 'PORTAL',
      userId: logUserId,
      participantName: lesson.teacherName,
      joinedAt: new Date()
    });

    // Record in audit log
    await db('audit_logs').insert({
      actor_id: logUserId,
      actor_name: lesson.teacherName || 'Faculty',
      actor_role: userRole || 'TEACHER',
      action: 'TEACHER_JOINED_LESSON',
      record_type: 'Timetable Lesson',
      record_identifier: String(lesson.id),
      reason: `Teacher ${lesson.teacherName || 'Faculty'} launched Class ${lesson.classNumber || lesson.class_id} (${lesson.subjectName}). Session is now LIVE.`,
      new_value: 'LIVE',
      created_at: db.fn.now(3)
    });

    // Emit live operational notification
    notificationService.notify({
      title: conflictingLive ? 'Host Handoff Completed' : 'Class Live Now',
      message: conflictingLive
        ? `Host ownership for Class ${lesson.classNumber || lesson.class_id} transferred to ${lesson.teacherName || 'Faculty'}. Prior lesson was concluded cleanly.`
        : `Class ${lesson.classNumber || lesson.class_id} (${lesson.subjectName || 'Live Lesson'}) is now LIVE. Instructor ${lesson.teacherName || 'Faculty'} has started hosting.`,
      type: conflictingLive ? 'Failed Zoom Meeting' : 'Timetable Change',
      targetRole: 'PRINCIPAL',
      relatedRecordId: lesson.id,
      relatedRecordType: 'ZoomMeeting',
      priority: conflictingLive ? 'High' : 'Medium'
    });

    return {
      lessonId: lesson.id,
      status: 'LIVE',
      sessionState: 'LIVE',
      zoomMeetingId: meeting.zoom_meeting_id,
      joinUrl: meeting.startUrl || meeting.joinUrl,
      startUrl: meeting.startUrl,
      passcode: meeting.passcode,
      hostKey: meeting.hostKey || '884422',
      canStart: true,
      hostTransitioned: Boolean(conflictingLive),
      previousLessonAutoCompleted: Boolean(conflictingLive)
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
      status: 'COMPLETED',
      session_state: 'COMPLETED',
      handover_at: db.fn.now(3),
      handover_notes: notes || 'Instruction concluded'
    });

    await db('audit_logs').insert({
      actor_id: null,
      actor_name: lesson.teacherName || 'Faculty',
      actor_role: userRole || 'TEACHER',
      action: 'TEACHER_HANDOVER_CONCLUDED',
      record_type: 'Timetable Lesson',
      record_identifier: String(lessonId),
      reason: `Lesson #${lessonId} completed by faculty. Topic: ${topic || 'Instruction complete'}. Handover ready for next period.`,
      previous_value: lesson.status,
      new_value: 'COMPLETED',
      created_at: db.fn.now(3)
    });

    notificationService.notify({
      title: 'Class Session Concluded',
      message: `Lesson #${lessonId} was completed by faculty. Topic: ${topic || 'Instruction complete'}.`,
      type: 'Timetable Change',
      targetRole: 'PRINCIPAL',
      relatedRecordId: lessonId,
      relatedRecordType: 'ZoomMeeting',
      priority: 'Low'
    });

    return {
      lessonId,
      status: 'COMPLETED',
      sessionState: 'COMPLETED',
      topic,
      notes
    };
  },

  async getStudentClassSession({ studentId, userId = null, classId, studentName, studentEmail }) {
    const today = new Date().toISOString().split('T')[0];
    const lessons = await timetableRepository.getLessons({
      classId,
      date: today
    });

    const meeting = await zoomRepository.getMeetingByClassId(classId);
    const now = Date.now();

    // Find current live lesson or next scheduled lesson
    const currentOrNext = lessons.find(
      (l) => l.status === 'LIVE' || (l.status === 'SCHEDULED' && parseDbDate(l.endAt).getTime() > now)
    );

    if (!currentOrNext) {
      return {
        lesson: null,
        classId,
        sessionState: 'NO_CLASS',
        zoomMeetingId: meeting ? meeting.zoom_meeting_id : `900${classId}000${classId}`,
        passcode: meeting ? meeting.passcode : `CLASS${classId}#`,
        joinUrl: meeting ? meeting.joinUrl : null,
        inWindow: false,
        canJoin: false,
        message: 'No live class actively conducting at this moment. Link opens during scheduled timetable periods.'
      };
    }

    const startMs = parseDbDate(currentOrNext.startAt).getTime();
    const endMs = parseDbDate(currentOrNext.endAt).getTime();
    const sessionState = currentOrNext.sessionState || currentOrNext.status;
    // Window: 10 min before start to end + 15 min (SRS Section 6.7)
    const inWindow = currentOrNext.status === 'LIVE' || (now >= startMs - 10 * 60 * 1000 && now <= endMs + 15 * 60 * 1000);

    let statusMessage = '';
    if (sessionState === 'LIVE') {
      statusMessage = 'Class is actively in session. You may join now.';
    } else if (sessionState === 'AWAITING_TEACHER') {
      statusMessage = 'Class period has started. Waiting for teacher to start instruction.';
    } else if (sessionState === 'TEACHER_ABSENT') {
      statusMessage = 'Teacher is currently delayed/absent. School administration has been alerted.';
    } else if (sessionState === 'STARTING_SOON') {
      statusMessage = 'Class starts in less than 5 minutes. Please get ready.';
    } else {
      statusMessage = 'Upcoming scheduled period.';
    }

    if (inWindow && meeting) {
      let logUserId = userId;
      if (!logUserId && studentId) {
        const studentRow = await db('students').where({ id: studentId }).first();
        logUserId = studentRow ? studentRow.user_id : null;
      }

      // Log student join intent
      await zoomRepository.logParticipant({
        lessonId: currentOrNext.id,
        zoomMeetingId: meeting.zoom_meeting_id,
        source: 'PORTAL',
        userId: logUserId,
        participantName: studentName,
        participantEmail: studentEmail,
        joinedAt: new Date()
      });

      return {
        lesson: currentOrNext,
        classId,
        sessionState,
        zoomMeetingId: meeting.zoom_meeting_id,
        passcode: meeting.passcode,
        inWindow: true,
        canJoin: true,
        joinUrl: meeting.joinUrl,
        message: statusMessage
      };
    }

    return {
      lesson: currentOrNext,
      classId,
      sessionState,
      zoomMeetingId: meeting ? meeting.zoom_meeting_id : `900${classId}000${classId}`,
      passcode: meeting ? meeting.passcode : `CLASS${classId}#`,
      inWindow: false,
      canJoin: false,
      joinUrl: null,
      message: statusMessage || 'Class session link will be accessible 10 minutes prior to scheduled start time.'
    };
  },

  async handleWebhookEvent(eventData) {
    if (!eventData) return { received: false };

    // 1. Handle Zoom URL validation challenge
    if (eventData.event === 'endpoint.url_validation') {
      const plainToken = eventData.payload?.plainToken;
      const encryptedToken = zoomApiClient.validateWebhookPlainToken(plainToken);
      return { plainToken, encryptedToken };
    }

    const event = eventData.event;
    const payload = eventData.payload?.object;
    if (!payload) return { received: true };

    const zoomMeetingId = String(payload.id || '');
    const eventHash = `EVT-${event}-${zoomMeetingId}-${Date.now()}`;

    // Log the incoming webhook event
    await zoomRepository.logWebhookEvent({
      eventHash,
      eventType: event,
      zoomMeetingId,
      lessonId: null,
      payload: eventData
    }).catch(() => null);

    // 2. Handle Teacher/Participant Join (Start Duty Time)
    if (event === 'meeting.participant_joined') {
      const participant = payload.participant;
      const email = participant?.email || participant?.user_name;
      if (!email) return { received: true };

      // Check if participant is a registered teacher
      const teacherUser = await db('users')
        .join('teachers', 'users.id', 'teachers.user_id')
        .where((qb) => {
          qb.where('users.email', email).orWhere('users.full_name', participant.user_name);
        })
        .select('teachers.id as teacherId', 'users.id as userId', 'users.full_name as name')
        .first();

      if (teacherUser) {
        const today = new Date().toISOString().split('T')[0];
        const meetingRow = await db('zoom_meetings')
          .where('zoom_meeting_id', zoomMeetingId)
          .where('status', 'ACTIVE')
          .first();

        const lesson = await db('timetable_lessons')
          .where('teacher_id', teacherUser.teacherId)
          .where('lesson_date', today)
          .whereIn('status', ['SCHEDULED', 'LIVE'])
          .orderBy('start_at', 'asc')
          .first();

        if (lesson) {
          const joinTime = participant.join_time ? new Date(participant.join_time) : new Date();

          await db('timetable_lessons')
            .where({ id: lesson.id })
            .update({
              status: 'LIVE',
              session_state: 'LIVE',
              teacher_joined_at: joinTime,
              actual_start_at: lesson.actual_start_at || joinTime,
              zoom_meeting_id: meetingRow?.id || lesson.zoom_meeting_id
            });

          await zoomRepository.logParticipant({
            lessonId: lesson.id,
            zoomMeetingId,
            source: 'WEBHOOK',
            userId: teacherUser.userId,
            participantName: teacherUser.name,
            participantEmail: email,
            joinedAt: joinTime
          });

          await db('audit_logs').insert({
            actor_id: teacherUser.userId,
            actor_name: teacherUser.name,
            actor_role: 'TEACHER',
            action: 'ZOOM_SERVER_ATTENDANCE_JOIN',
            record_type: 'Timetable Lesson',
            record_identifier: String(lesson.id),
            reason: `Teacher join verified by Zoom Server-to-Server Webhook. Join time: ${joinTime.toISOString()}`,
            previous_value: lesson.status,
            new_value: 'LIVE',
            created_at: db.fn.now(3)
          });
        }
      }
    }

    // 3. Handle Teacher/Participant Leave (Track Duty Hours & Handover)
    if (event === 'meeting.participant_left') {
      const participant = payload.participant;
      const email = participant?.email || participant?.user_name;
      if (!email) return { received: true };

      const teacherUser = await db('users')
        .join('teachers', 'users.id', 'teachers.user_id')
        .where((qb) => {
          qb.where('users.email', email).orWhere('users.full_name', participant.user_name);
        })
        .select('teachers.id as teacherId', 'users.id as userId', 'users.full_name as name')
        .first();

      if (teacherUser) {
        const today = new Date().toISOString().split('T')[0];
        const lesson = await db('timetable_lessons')
          .where('teacher_id', teacherUser.teacherId)
          .where('lesson_date', today)
          .where('status', 'LIVE')
          .first();

        if (lesson) {
          const leaveTime = participant.leave_time ? new Date(participant.leave_time) : new Date();

          await db('timetable_lessons')
            .where({ id: lesson.id })
            .update({
              status: 'COMPLETED',
              session_state: 'COMPLETED',
              actual_end_at: leaveTime,
              handover_at: leaveTime,
              handover_notes: `Concluded via Zoom Server-to-Server leave event. Attended duration: ${participant.duration || 'Period finished'}s`
            });

          await db('zoom_participant_log')
            .where({ lesson_id: lesson.id, user_id: teacherUser.userId })
            .whereNull('left_at')
            .update({ left_at: leaveTime });

          await db('audit_logs').insert({
            actor_id: teacherUser.userId,
            actor_name: teacherUser.name,
            actor_role: 'TEACHER',
            action: 'ZOOM_SERVER_ATTENDANCE_LEAVE',
            record_type: 'Timetable Lesson',
            record_identifier: String(lesson.id),
            reason: `Teacher departure verified by Zoom Server-to-Server Webhook. Leave time: ${leaveTime.toISOString()}`,
            previous_value: 'LIVE',
            new_value: 'COMPLETED',
            created_at: db.fn.now(3)
          });
        }
      }
    }

    return { received: true };
  },

  async syncLessonAttendanceFromZoom(lessonId) {
    const lesson = await timetableRepository.findLessonById(lessonId);
    if (!lesson) {
      throw new AppError('Lesson not found', 404, ErrorCodes.NOT_FOUND);
    }

    const meeting = await zoomRepository.getMeetingByClassId(lesson.class_id);
    if (!meeting) {
      throw new AppError('Class Zoom meeting not configured', 422, ErrorCodes.ZOOM_LINK_UNUSABLE);
    }

    const participants = await zoomApiClient.getMeetingParticipants(meeting.zoom_meeting_id);

    const teacherUser = await db('users')
      .join('teachers', 'users.id', 'teachers.user_id')
      .where('teachers.id', lesson.teacher_id)
      .select('users.email', 'users.full_name as name', 'users.id as userId')
      .first();

    let teacherLog = null;
    if (teacherUser) {
      teacherLog = participants.find(
        (p) =>
          (p.user_email && p.user_email.toLowerCase() === teacherUser.email.toLowerCase()) ||
          (p.name && p.name.toLowerCase().includes(teacherUser.name.toLowerCase()))
      );
    }

    if (teacherLog) {
      const joinTime = teacherLog.join_time ? new Date(teacherLog.join_time) : lesson.actual_start_at || new Date();
      const leaveTime = teacherLog.leave_time ? new Date(teacherLog.leave_time) : new Date();
      const durationSeconds = Number(teacherLog.duration) || 0;
      const durationHours = durationSeconds > 0 ? Number((durationSeconds / 3600).toFixed(2)) : 0.75;

      await db('timetable_lessons')
        .where({ id: lessonId })
        .update({
          status: 'COMPLETED',
          session_state: 'COMPLETED',
          teacher_joined_at: joinTime,
          actual_start_at: joinTime,
          actual_end_at: leaveTime,
          handover_at: leaveTime,
          handover_notes: `Synced via Zoom Server-to-Server API. Duration: ${durationSeconds}s (${durationHours}h)`
        });

      return {
        lessonId,
        synced: true,
        teacherFound: true,
        joinTime,
        leaveTime,
        durationHours,
        status: 'COMPLETED'
      };
    }

    return {
      lessonId,
      synced: true,
      teacherFound: false,
      message: 'No participant matching teacher email was returned by Zoom API report yet.'
    };
  },

  async getTeacherDailyDutySummary(teacherId, date) {
    const queryDate = date || new Date().toISOString().split('T')[0];

    const teacher = await db('teachers')
      .join('users', 'teachers.user_id', 'users.id')
      .where('teachers.id', teacherId)
      .select('teachers.id', 'teachers.employee_no as staffId', 'users.full_name as name', 'users.email')
      .first();

    if (!teacher) {
      throw new AppError('Teacher not found', 404, ErrorCodes.NOT_FOUND);
    }

    const lessons = await db('timetable_lessons')
      .leftJoin('classes', 'timetable_lessons.class_id', 'classes.id')
      .leftJoin('subjects', 'timetable_lessons.subject_id', 'subjects.id')
      .where('timetable_lessons.teacher_id', teacherId)
      .where('timetable_lessons.lesson_date', queryDate)
      .select(
        'timetable_lessons.id',
        'classes.name as className',
        'classes.grade_level as classNumber',
        'subjects.name as subjectName',
        'timetable_lessons.status',
        'timetable_lessons.start_at',
        'timetable_lessons.end_at',
        'timetable_lessons.teacher_joined_at',
        'timetable_lessons.actual_start_at',
        'timetable_lessons.actual_end_at',
        'timetable_lessons.handover_at'
      )
      .orderBy('timetable_lessons.start_at', 'asc');

    let totalTrackedMinutes = 0;
    let completedCount = 0;

    const detailedLessons = lessons.map((l) => {
      let durationMinutes = 0;
      const start = l.actual_start_at || l.teacher_joined_at;
      const end = l.actual_end_at || l.handover_at;

      if (start && end) {
        durationMinutes = Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000));
      } else {
        durationMinutes = 0;
      }

      if (l.status === 'COMPLETED') {
        completedCount++;
        totalTrackedMinutes += durationMinutes;
      }

      return {
        id: l.id,
        className: l.className || `Class ${l.classNumber}`,
        subjectName: l.subjectName,
        status: l.status,
        scheduledStart: l.start_at,
        scheduledEnd: l.end_at,
        actualJoinTime: l.teacher_joined_at || l.actual_start_at,
        actualLeaveTime: l.actual_end_at || l.handover_at,
        trackedMinutes: durationMinutes,
        trackedHours: Number((durationMinutes / 60).toFixed(2))
      };
    });

    const totalTrackedHours = Number((totalTrackedMinutes / 60).toFixed(2));
    const attendanceStatus = completedCount > 0 ? 'Present (Zoom Verified)' : (lessons.length > 0 ? 'Pending / Not Attended' : 'No Scheduled Lessons');

    return {
      teacherId: teacher.id,
      teacherName: teacher.name,
      staffId: teacher.staffId,
      date: queryDate,
      attendanceStatus,
      totalScheduledLessons: lessons.length,
      totalCompletedLessons: completedCount,
      totalTrackedMinutes,
      totalTrackedHours,
      lessons: detailedLessons
    };
  }
};
