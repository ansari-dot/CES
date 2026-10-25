import { db } from '../../shared/db/knex.js';
import { config } from '../../config/index.js';
import { notificationService } from '../../shared/services/notificationService.js';
import { wallClockToUtc } from '../timetable/timetable.service.js';
import { parseDbDate } from '../../shared/utils/date.js';

const TICK_INTERVAL_MS = 30 * 1000; // 30 seconds
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

    // 3. Process 5-Minute Teacher Notifications
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

    let notifiedCount = 0;
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

    // 5. Teacher Absence Alerts (Grace period exceeded)
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

    let absenceAlertCount = 0;
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

    // 6. Automatic Lesson Conclusion & Teacher Handover at Period End
    const concludedLessons = await db('timetable_lessons')
      .whereIn('status', ['SCHEDULED', 'LIVE'])
      .where('end_at', '<=', new Date(nowMs))
      .select('id', 'class_id', 'status', 'teacher_id');

    let handoverCount = 0;
    for (const cl of concludedLessons) {
      const updated = await db('timetable_lessons')
        .where({ id: cl.id })
        .whereIn('status', ['SCHEDULED', 'LIVE'])
        .update({
          status: 'COMPLETED',
          session_state: 'COMPLETED',
          handover_at: db.fn.now(3),
          handover_notes: 'Class period ended. Lesson concluded for incoming teacher handover.'
        });

      if (updated) {
        await db('audit_logs').insert({
          actor_id: null,
          actor_name: 'System (Zoom Scheduler)',
          actor_role: 'System',
          action: 'TEACHER_HANDOVER_COMPLETED',
          record_type: 'Timetable Lesson',
          record_identifier: String(cl.id),
          reason: `Lesson concluded automatically at period end. Previous teacher permissions expired.`,
          previous_value: cl.status,
          new_value: 'COMPLETED',
          created_at: db.fn.now(3)
        });
        handoverCount++;
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
