import { db } from '../../shared/db/knex.js';
import { config } from '../../config/index.js';
import { notificationService } from '../../shared/services/notificationService.js';
import { wallClockToUtc } from '../timetable/timetable.service.js';
import { parseDbDate } from '../../shared/utils/date.js';
import { zoomRepository } from './zoom.repository.js';
import { calculateLessonVerifiedDuty, currentPayrollMonthLabel } from '../../shared/utils/dutyCalculation.js';
import { emitRealtimeEvent, RealtimeEvents } from '../../shared/realtime/eventEmitter.js';
import { zoomService } from './zoom.service.js';
import { datesheetsService } from '../datesheets/datesheets.service.js';

const TICK_INTERVAL_MS = 10 * 1000; // 10 seconds active reconciler
const TEACHER_GRACE_PERIOD_MS = 10 * 60 * 1000; // 10 minutes past start time
const PRE_NOTIFICATION_WINDOW_MS = 5 * 60 * 1000; // 5 minutes before scheduled start

export async function runZoomScheduleTick(now = new Date()) {
  const schoolTz = config.SCHOOL_TIMEZONE || 'Asia/Karachi';
  const nowMs = now.getTime();

  // 1. Try to acquire lock for this tick (idempotent across multiple processes/clusters)
  let locked = false;
  try {
    const updated = await db('zoom_schedule_locks')
      .where('job_name', 'ZOOM_CLASS_SCHEDULER')
      .andWhere((q) => {
        q.whereNull('locked_until').orWhere('locked_until', '<', db.fn.now(3));
      })
      .update({
        locked_until: new Date(nowMs + 60000), // lock for 60 seconds
        last_run_at: db.fn.now(3)
      });
    locked = updated > 0;
  } catch {
    // If lock table not available yet, run safely in process
    locked = true;
  }

  if (!locked) {
    return { skipped: 'locked' };
  }

  try {
    // 2. Ensure today's lessons exist from timetable slots (Recovery & Day Rollover)
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: schoolTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const todayStr = formatter.format(now);
    const dayName = new Intl.DateTimeFormat('en-US', { timeZone: schoolTz, weekday: 'short' }).format(now);
    const weekdayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
    const todayWeekday = weekdayMap[dayName] || 1;

    // 2. Check School-Wide Exam Mode (Mode A: Dedicated Mid-Term/Final-Term Exam Period)
    const examPeriodCheck = await datesheetsService.isSchoolInExamPeriod(todayStr).catch(() => ({ inExamMode: false }));
    const isSchoolInExamMode = Boolean(examPeriodCheck && examPeriodCheck.inExamMode);

    if (isSchoolInExamMode) {
      console.log(`[ZoomScheduler] School-Wide EXAM_MODE Active on ${todayStr} for "${examPeriodCheck.title}" (${examPeriodCheck.examType}). Suppressing regular timetable lesson generation for all classes.`);
    } else {
      const publishedSlots = await db('timetable_slots')
        .join('academic_sessions', 'timetable_slots.session_id', 'academic_sessions.id')
        .where('academic_sessions.is_current', 1)
        .where('timetable_slots.status', 'PUBLISHED')
        .where('timetable_slots.weekday', todayWeekday)
        .select('timetable_slots.*');

      for (const slot of publishedSlots) {
        const existing = await db('timetable_lessons')
          .where({ slot_id: slot.id, lesson_date: todayStr })
          .first();

        if (!existing) {
          const classMeeting = await db('zoom_meetings')
            .where({ class_id: slot.class_id, status: 'ACTIVE' })
            .first();

          const startAt = new Date(wallClockToUtc(todayStr, slot.start_time, schoolTz));
          const endAt = new Date(wallClockToUtc(todayStr, slot.end_time, schoolTz));

          try {
            await db('timetable_lessons').insert({
              slot_id: slot.id,
              class_id: slot.class_id,
              subject_id: slot.subject_id,
              teacher_id: slot.teacher_id,
              zoom_meeting_id: classMeeting ? classMeeting.id : null,
              lesson_date: todayStr,
              start_at: startAt,
              end_at: endAt,
              status: 'SCHEDULED',
              session_state: 'SCHEDULED'
            });
          } catch (err) {
            console.error('[ZoomScheduler] Error inserting lesson for slot', slot.id, err.message);
          }
        }
      }
    }

    // 3. Process 5-Minute Teacher Notifications (Skipped during School-Wide Exam Mode)
    let notifiedCount = 0;
    if (!isSchoolInExamMode) {
      const notifyTargetStart = new Date(nowMs + PRE_NOTIFICATION_WINDOW_MS + 30000);
      const notifyPastCutoff = new Date(nowMs - 2 * 60 * 1000);

      const pendingNotifications = await db('timetable_lessons')
        .join('classes', 'timetable_lessons.class_id', 'classes.id')
        .join('subjects', 'timetable_lessons.subject_id', 'subjects.id')
        .join('teachers', db.raw('COALESCE(timetable_lessons.substitute_teacher_id, timetable_lessons.teacher_id)'), 'teachers.id')
        .join('users as teacher_users', 'teachers.user_id', 'teacher_users.id')
        .whereIn('timetable_lessons.status', ['SCHEDULED', 'STARTING_SOON'])
        .whereNull('timetable_lessons.teacher_notified_at')
        .where('timetable_lessons.start_at', '<=', notifyTargetStart)
        .where('timetable_lessons.start_at', '>=', notifyPastCutoff)
        .select(
          'timetable_lessons.id as lessonId',
          'timetable_lessons.start_at as startAt',
          'classes.name as className',
          'classes.grade_level as classNumber',
          'subjects.name as subjectName',
          'teacher_users.id as teacherUserId',
          'teacher_users.full_name as teacherName',
          'teacher_users.email as teacherEmail'
        );

      for (const item of pendingNotifications) {
        const startDateTime = parseDbDate(item.startAt);
        const timeStr = new Intl.DateTimeFormat('en-US', {
          timeZone: schoolTz,
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }).format(startDateTime);

        const notificationMsg = `Your next class starts in 5 minutes. Class: Class ${item.classNumber || item.className}. Subject: ${item.subjectName}. Start time: ${timeStr}. Please get ready.`;

        // Atomically mark notified first
        const updated = await db('timetable_lessons')
          .where({ id: item.lessonId })
          .whereNull('teacher_notified_at')
          .update({
            teacher_notified_at: db.fn.now(3),
            session_state: 'STARTING_SOON'
          });

        if (updated) {
          await notificationService.notify({
            userId: item.teacherUserId,
            title: 'Upcoming Class in 5 Minutes',
            message: notificationMsg,
            type: 'Timetable Change',
            targetRole: 'TEACHER',
            relatedRecordId: item.lessonId,
            relatedRecordType: 'TimetableLesson',
            priority: 'High'
          });
          notifiedCount++;
        }
      }
    }

    // 4. Activate Sessions at Scheduled Start Time
    const activeLessons = await db('timetable_lessons')
      .whereIn('status', ['SCHEDULED', 'STARTING_SOON'])
      .where('start_at', '<=', new Date(nowMs))
      .where('end_at', '>', new Date(nowMs))
      .select('id', 'teacher_joined_at', 'session_state');

    for (const al of activeLessons) {
      const newState = al.teacher_joined_at ? 'LIVE' : 'AWAITING_TEACHER';
      await db('timetable_lessons')
        .where({ id: al.id })
        .whereIn('status', ['SCHEDULED', 'STARTING_SOON'])
        .update({
          session_state: newState
        });
    }

    // 5. Teacher Absence Alerts (Skipped during School-Wide Exam Mode)
    let absenceAlertCount = 0;
    if (!isSchoolInExamMode) {
      const absenceThreshold = new Date(nowMs - TEACHER_GRACE_PERIOD_MS);
      const absentCandidateLessons = await db('timetable_lessons')
        .join('classes', 'timetable_lessons.class_id', 'classes.id')
        .join('subjects', 'timetable_lessons.subject_id', 'subjects.id')
        .join('teachers', db.raw('COALESCE(timetable_lessons.substitute_teacher_id, timetable_lessons.teacher_id)'), 'teachers.id')
        .join('users as teacher_users', 'teachers.user_id', 'teacher_users.id')
        .where('timetable_lessons.start_at', '<=', absenceThreshold)
        .where('timetable_lessons.end_at', '>', new Date(nowMs))
        .whereNotIn('timetable_lessons.status', ['LIVE', 'COMPLETED', 'CANCELLED'])
        .whereNull('timetable_lessons.teacher_joined_at')
        .whereNull('timetable_lessons.teacher_absence_alert_at')
        .select(
          'timetable_lessons.id as lessonId',
          'timetable_lessons.start_at as startAt',
          'classes.grade_level as classNumber',
          'classes.name as className',
          'subjects.name as subjectName',
          'teacher_users.full_name as teacherName'
        );

      for (const item of absentCandidateLessons) {
        const startDateTime = parseDbDate(item.startAt);
        const timeStr = new Intl.DateTimeFormat('en-US', {
          timeZone: schoolTz,
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }).format(startDateTime);

        const alertMsg = `Teacher Absence Alert: Faculty member ${item.teacherName} has not joined Class ${item.classNumber || item.className} (${item.subjectName}) scheduled for ${timeStr}. Grace period (10 minutes) exceeded.`;

        const updated = await db('timetable_lessons')
          .where({ id: item.lessonId })
          .whereNull('teacher_absence_alert_at')
          .update({
            teacher_absence_alert_at: db.fn.now(3),
            session_state: 'TEACHER_ABSENT'
          });

        if (updated) {
          await notificationService.notify({
            title: 'Teacher Absence Alert',
            message: alertMsg,
            type: 'Failed Zoom Meeting',
            targetRole: 'PRINCIPAL',
            relatedRecordId: item.lessonId,
            relatedRecordType: 'TimetableLesson',
            priority: 'High'
          });

          await db('audit_logs').insert({
            actor_id: null,
            actor_name: 'System (Zoom Scheduler)',
            actor_role: 'System',
            action: 'TEACHER_ABSENCE_ALERT',
            record_type: 'Timetable Lesson',
            record_identifier: String(item.lessonId),
            reason: alertMsg,
            previous_value: 'AWAITING_TEACHER',
            new_value: 'TEACHER_ABSENT',
            created_at: db.fn.now(3)
          });

          absenceAlertCount++;
        }
      }
    }

    // 5b. Active Zoom Meeting State Verification (Server-to-Server Auto-Conclusion when teacher leaves meeting)
    const activeLiveLessons = await db('timetable_lessons')
      .where('status', 'LIVE')
      .select('*');

    for (const all of activeLiveLessons) {
      await zoomService.checkAndAutoConcludeIfMeetingEnded(all);
    }

    // 6. Automatic Lesson Conclusion & Teacher Handover at Period End
    const concludedLessons = await db('timetable_lessons')
      .whereIn('status', ['SCHEDULED', 'STARTING_SOON', 'LIVE'])
      .where('end_at', '<=', new Date(nowMs))
      .select('id', 'class_id', 'status', 'teacher_id', 'slot_id', 'lesson_date', 'teacher_joined_at', 'actual_start_at', 'actual_end_at', 'start_at', 'end_at', 'period_occurrence_id');

    let handoverCount = 0;
    for (const cl of concludedLessons) {
      const teacherAttended = Boolean(cl.teacher_joined_at || cl.actual_start_at);
      const periodOccId = cl.period_occurrence_id || `period_${cl.class_id}_${cl.lesson_date}_${cl.slot_id || cl.id}`;
      const classMeeting = await db('zoom_meetings').where({ class_id: cl.class_id, status: 'ACTIVE' }).first();
      const zoomMeetingId = classMeeting ? classMeeting.zoom_meeting_id : '0';

      // Pre-capture connected participants in the persistent classroom meeting BEFORE closing open intervals
      const connectedParticipantsInRoom = classMeeting
        ? await zoomRepository.findCurrentlyConnectedParticipantsInMeeting(classMeeting.zoom_meeting_id)
        : [];

      if (teacherAttended) {
        // Teacher verified joined: compute verified duty intervals
        const participantLogs = await zoomRepository.getParticipantLogsForLesson(cl.id);
        const duty = calculateLessonVerifiedDuty({ lesson: cl, participantLogs, now: parseDbDate(cl.end_at) });

        // Conclude lesson with completed status and verified duty hours
        const updated = await db('timetable_lessons')
          .where({ id: cl.id })
          .whereIn('status', ['SCHEDULED', 'STARTING_SOON', 'LIVE'])
          .update({
            status: 'COMPLETED',
            session_state: 'COMPLETED',
            actual_end_at: cl.actual_end_at || cl.end_at,
            handover_at: db.fn.now(3),
            verified_duty_minutes: duty.verifiedMinutes,
            attendance_verification_status: duty.verificationStatus,
            period_occurrence_id: periodOccId,
            handover_notes: `Class period ended. Attended: ${duty.verifiedMinutes} mins (${duty.verifiedHours} hrs). Handover completed.`
          });

        if (updated) {
          // Authoritative Duty Session Ledger persistence
          await zoomRepository.upsertTeacherDutySession({
            teacherId: cl.teacher_id,
            classId: cl.class_id,
            lessonId: cl.id,
            periodOccurrenceId: periodOccId,
            zoomMeetingId,
            sessionStart: cl.actual_start_at || cl.start_at,
            sessionEnd: cl.actual_end_at || cl.end_at,
            totalVerifiedMinutes: duty.verifiedMinutes,
            payableMinutes: duty.isPayable ? duty.verifiedMinutes : 0,
            sessionStatus: 'COMPLETED',
            reconciliationStatus: duty.requiresReview ? 'DISCREPANCY_FOUND' : 'RECONCILED',
            auditNote: `Scheduler period-end conclusion. Verified: ${duty.verifiedMinutes}m`
          });

          // Close any open participant intervals for this lesson at period boundary
          await db('zoom_participant_log')
            .where({ lesson_id: cl.id })
            .whereNull('left_at')
            .update({
              left_at: cl.end_at,
              duration_seconds: db.raw('TIMESTAMPDIFF(SECOND, joined_at, ?)', [cl.end_at])
            });

          await db('audit_logs').insert({
            actor_id: null,
            actor_name: 'System (Zoom Scheduler)',
            actor_role: 'System',
            action: 'TEACHER_HANDOVER_COMPLETED',
            record_type: 'Timetable Lesson',
            record_identifier: String(cl.id),
            reason: `Lesson concluded automatically at period end. Teacher duty finalized: ${duty.verifiedMinutes}m.`,
            previous_value: cl.status,
            new_value: 'COMPLETED',
            created_at: db.fn.now(3)
          });

          emitRealtimeEvent(RealtimeEvents.TEACHER_DUTY_UPDATED, {
            teacherId: cl.teacher_id,
            lessonId: cl.id,
            status: 'COMPLETED',
            verifiedMinutes: duty.verifiedMinutes,
            payableMinutes: duty.isPayable ? duty.verifiedMinutes : 0
          }, { teacherIds: [cl.teacher_id] });

          emitRealtimeEvent(RealtimeEvents.CLASS_STATUS_UPDATED, {
            lessonId: cl.id,
            classId: cl.class_id,
            status: 'COMPLETED',
            sessionState: 'COMPLETED'
          }, { classIds: [cl.class_id] });

          handoverCount++;
        }
      } else {
        // Teacher NEVER joined: strictly record as MISSED / ABSENT (Never credit unverified attendance)
        const updated = await db('timetable_lessons')
          .where({ id: cl.id })
          .whereIn('status', ['SCHEDULED', 'STARTING_SOON'])
          .update({
            status: 'MISSED',
            session_state: 'TEACHER_ABSENT',
            attendance_verification_status: 'ABSENT',
            verified_duty_minutes: 0,
            period_occurrence_id: periodOccId,
            handover_at: db.fn.now(3),
            handover_notes: 'Class period ended without verified teacher attendance. Marked MISSED.'
          });

        if (updated) {
          await zoomRepository.upsertTeacherDutySession({
            teacherId: cl.teacher_id,
            classId: cl.class_id,
            lessonId: cl.id,
            periodOccurrenceId: periodOccId,
            zoomMeetingId,
            sessionStart: cl.start_at,
            sessionEnd: cl.end_at,
            totalVerifiedMinutes: 0,
            payableMinutes: 0,
            sessionStatus: 'MISSED',
            reconciliationStatus: 'RECONCILED',
            auditNote: 'Class period ended without verified teacher attendance.'
          });

          await db('audit_logs').insert({
            actor_id: null,
            actor_name: 'System (Zoom Scheduler)',
            actor_role: 'System',
            action: 'TEACHER_MISSED_LESSON',
            record_type: 'Timetable Lesson',
            record_identifier: String(cl.id),
            reason: `Scheduled period ended with no verified teacher join. Marked MISSED. No duty hours credited.`,
            previous_value: cl.status,
            new_value: 'MISSED',
            created_at: db.fn.now(3)
          });
          handoverCount++;
        }
      }

      // 7. Automated Consecutive Period Transition & Continuous Student Presence (Critical Bug C)
      // If another period follows for this class (e.g. Teacher B joins next period in same continuous Zoom room)
      const nextLesson = await db('timetable_lessons')
        .where('class_id', cl.class_id)
        .where('lesson_date', todayStr)
        .where('start_at', '>=', db.raw('DATE_SUB(?, INTERVAL 5 MINUTE)', [cl.end_at]))
        .where('start_at', '<=', db.raw('DATE_ADD(?, INTERVAL 15 MINUTE)', [cl.end_at]))
        .whereNotIn('status', ['COMPLETED', 'CANCELLED'])
        .orderBy('start_at', 'asc')
        .first();

      if (nextLesson && classMeeting) {
        const nextPeriodOccId = nextLesson.period_occurrence_id || `period_${nextLesson.class_id}_${todayStr}_${nextLesson.slot_id || nextLesson.id}`;
        await db('timetable_lessons')
          .where({ id: nextLesson.id })
          .update({
            period_occurrence_id: nextPeriodOccId,
            zoom_meeting_id: classMeeting.id
          });

        // Use pre-captured connected participants from the persistent virtual classroom
        const connectedParticipants = (connectedParticipantsInRoom && connectedParticipantsInRoom.length > 0)
          ? connectedParticipantsInRoom
          : await zoomRepository.findCurrentlyConnectedParticipantsInMeeting(classMeeting.zoom_meeting_id);

        // A. Continuous Student Attendance Rollover
        const connectedStudents = connectedParticipants.filter((p) => p.role === 'STUDENT');
        for (const cp of connectedStudents) {
          let studentRecord = null;
          if (cp.user_id) {
            studentRecord = await db('students')
              .join('users', 'students.user_id', 'users.id')
              .where('students.user_id', cp.user_id)
              .where('students.current_class_id', cl.class_id)
              .select('students.id as studentId', 'users.full_name as name', 'users.id as userId')
              .first();
          }

          if (studentRecord) {
            // Carry forward student presence interval for next period
            await zoomRepository.logParticipant({
              lessonId: nextLesson.id,
              zoomMeetingId: classMeeting.zoom_meeting_id,
              source: 'WEBHOOK',
              userId: studentRecord.userId,
              role: 'STUDENT',
              verificationStatus: 'VERIFIED',
              verificationReason: 'Continuous presence carried forward across consecutive periods',
              joinedAt: parseDbDate(nextLesson.start_at),
              leftAt: null
            });

            // Upsert attendance record for next period as PRESENT
            await zoomRepository.recordStudentAttendanceFromZoom({
              lessonId: nextLesson.id,
              studentId: studentRecord.studentId,
              status: 'PRESENT',
              source: 'WEBHOOK',
              firstJoinedAt: parseDbDate(nextLesson.start_at),
              verifiedMinutes: 0,
              markedByUserId: nextLesson.teacher_id,
              remarks: 'Continuous attendance carried forward from previous period'
            });

            emitRealtimeEvent(
              RealtimeEvents.STUDENT_ATTENDANCE_UPDATED,
              {
                lessonId: nextLesson.id,
                studentId: studentRecord.studentId,
                studentName: studentRecord.name,
                status: 'PRESENT',
                classId: nextLesson.class_id,
                carriedForward: true
              },
              { classIds: [nextLesson.class_id] }
            );
          }
        }

        // B. Check if incoming Teacher B is already in the room
        const incomingTeacherUser = await db('teachers')
          .join('users', 'teachers.user_id', 'users.id')
          .where('teachers.id', nextLesson.teacher_id)
          .select('teachers.id as teacherId', 'users.id as userId', 'users.full_name as name')
          .first();

        if (incomingTeacherUser) {
          const isTeacherBPresent = connectedParticipants.some((p) => p.user_id === incomingTeacherUser.userId);
          if (isTeacherBPresent) {
            await db('timetable_lessons')
              .where({ id: nextLesson.id })
              .update({
                status: 'LIVE',
                session_state: 'LIVE',
                actual_start_at: nextLesson.start_at,
                teacher_joined_at: nextLesson.start_at,
                attendance_verification_status: 'VERIFIED'
              });

            await zoomRepository.upsertTeacherDutySession({
              teacherId: incomingTeacherUser.teacherId,
              classId: nextLesson.class_id,
              lessonId: nextLesson.id,
              periodOccurrenceId: nextPeriodOccId,
              zoomMeetingId: classMeeting.zoom_meeting_id,
              sessionStart: parseDbDate(nextLesson.start_at),
              sessionStatus: 'IN_PROGRESS',
              reconciliationStatus: 'NOT_RECONCILED',
              auditNote: 'Incoming teacher already present in classroom room at period transition.'
            });

            emitRealtimeEvent(RealtimeEvents.CLASS_PERIOD_ACTIVATED, {
              lessonId: nextLesson.id,
              classId: nextLesson.class_id,
              status: 'LIVE',
              teacherId: incomingTeacherUser.teacherId,
              teacherName: incomingTeacherUser.name
            }, { classIds: [nextLesson.class_id], teacherIds: [incomingTeacherUser.teacherId] });
          } else {
            emitRealtimeEvent(RealtimeEvents.CLASS_PERIOD_ACTIVATED, {
              lessonId: nextLesson.id,
              classId: nextLesson.class_id,
              status: nextLesson.status,
              sessionState: 'AWAITING_TEACHER',
              teacherId: incomingTeacherUser.teacherId,
              teacherName: incomingTeacherUser.name
            }, { classIds: [nextLesson.class_id], teacherIds: [incomingTeacherUser.teacherId] });
          }
        }
      }
    }

    // Release lock
    await db('zoom_schedule_locks')
      .where('job_name', 'ZOOM_CLASS_SCHEDULER')
      .update({
        locked_until: null,
        last_status: 'SUCCESS',
        last_error: null
      });

    return {
      success: true,
      notifiedCount,
      absenceAlertCount,
      handoverCount
    };
  } catch (err) {
    console.error('[ZoomScheduler] Error during schedule tick:', err.message);
    try {
      await db('zoom_schedule_locks')
        .where('job_name', 'ZOOM_CLASS_SCHEDULER')
        .update({
          locked_until: null,
          last_status: 'FAILED',
          last_error: err.message
        });
    } catch {
      // quiet fallback
    }
    return { success: false, error: err.message };
  }
}

let running = false;
async function tick() {
  if (running) return;
  running = true;
  try {
    await runZoomScheduleTick();
  } catch (err) {
    console.error('[ZoomScheduler] Tick error:', err.message);
  } finally {
    running = false;
  }
}

export function startZoomScheduler() {
  tick(); // Immediate first run on startup
  const timer = setInterval(tick, TICK_INTERVAL_MS);
  return () => clearInterval(timer);
}

export const zoomScheduler = {
  runZoomScheduleTick,
  startZoomScheduler,
  recoverActiveSessionsOnStartup: runZoomScheduleTick
};

