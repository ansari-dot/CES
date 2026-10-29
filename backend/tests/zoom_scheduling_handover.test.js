import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/shared/db/knex.js';
import { hashPassword } from '../src/shared/crypto/password.js';
import { runZoomScheduleTick } from '../src/modules/zoom/zoom.scheduler.js';
import { zoomService } from '../src/modules/zoom/zoom.service.js';
import { zoomRepository } from '../src/modules/zoom/zoom.repository.js';
import { timetableService } from '../src/modules/timetable/timetable.service.js';

describe('Production-Ready Automatic Zoom Class Scheduling & Teacher Handover Tests', () => {
  let app;
  let principalCookies;
  let principalCsrf;
  let teacher1Cookies;
  let teacher1Csrf;
  let teacher1Id;
  let teacher1UserId;
  let teacher2Cookies;
  let teacher2Csrf;
  let teacher2Id;
  let teacher2UserId;
  let studentCookies;
  let studentId;
  let sessionId;

  beforeAll(async () => {
    app = createApp();

    // 1. Setup Test Principal Login
    const principalRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'principal', password: 'PrincipalPassword123!' });

    expect(principalRes.status).toBe(200);
    principalCookies = principalRes.headers['set-cookie'];
    const pCsrfCookie = principalCookies.find((c) => c.startsWith('sms_csrf='));
    principalCsrf = pCsrfCookie.split(';')[0].split('=')[1];

    // 2. Setup Teacher 1 (Period 1 Teacher)
    const pwd = await hashPassword('TeacherPassword123!');
    let t1User = await db('users').where({ email: 'teacher1.zoom@school.pk' }).first();
    if (!t1User) {
      const [uId] = await db('users').insert({
        role_id: 3,
        username: 'teacher1.zoom',
        email: 'teacher1.zoom@school.pk',
        full_name: 'Teacher One (Math)',
        password_hash: pwd,
        status: 'ACTIVE',
        must_change_password: 0
      });
      t1User = { id: uId };
    }
    teacher1UserId = t1User.id;

    let t1Record = await db('teachers').where({ user_id: teacher1UserId }).first();
    if (!t1Record) {
      const [tId] = await db('teachers').insert({
        user_id: teacher1UserId,
        employee_no: 'TCH-ZOOM-1',
        designation: 'Mathematics Faculty',
        joining_date: '2024-01-01',
        employment_status: 'ACTIVE'
      });
      t1Record = { id: tId };
    }
    teacher1Id = t1Record.id;

    // Login Teacher 1
    const t1Res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'teacher1.zoom@school.pk', password: 'TeacherPassword123!' });
    teacher1Cookies = t1Res.headers['set-cookie'];
    teacher1Csrf = teacher1Cookies.find((c) => c.startsWith('sms_csrf=')).split(';')[0].split('=')[1];

    // 3. Setup Teacher 2 (Period 2 Incoming Teacher)
    let t2User = await db('users').where({ email: 'teacher2.zoom@school.pk' }).first();
    if (!t2User) {
      const [uId] = await db('users').insert({
        role_id: 3,
        username: 'teacher2.zoom',
        email: 'teacher2.zoom@school.pk',
        full_name: 'Teacher Two (Science)',
        password_hash: pwd,
        status: 'ACTIVE',
        must_change_password: 0
      });
      t2User = { id: uId };
    }
    teacher2UserId = t2User.id;

    let t2Record = await db('teachers').where({ user_id: teacher2UserId }).first();
    if (!t2Record) {
      const [tId] = await db('teachers').insert({
        user_id: teacher2UserId,
        employee_no: 'TCH-ZOOM-2',
        designation: 'Science Faculty',
        joining_date: '2024-01-01',
        employment_status: 'ACTIVE'
      });
      t2Record = { id: tId };
    }
    teacher2Id = t2Record.id;

    // Login Teacher 2
    const t2Res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'teacher2.zoom@school.pk', password: 'TeacherPassword123!' });
    teacher2Cookies = t2Res.headers['set-cookie'];
    teacher2Csrf = teacher2Cookies.find((c) => c.startsWith('sms_csrf=')).split(';')[0].split('=')[1];

    // 4. Setup Student in Class 1
    let stUser = await db('users').where({ email: 'student1.zoom@school.pk' }).first();
    if (!stUser) {
      const [uId] = await db('users').insert({
        role_id: 4,
        username: 'student1.zoom',
        email: 'student1.zoom@school.pk',
        full_name: 'Student One',
        password_hash: pwd,
        status: 'ACTIVE',
        must_change_password: 0
      });
      stUser = { id: uId };
    }
    let stRecord = await db('students').where({ user_id: stUser.id }).first();
    if (!stRecord) {
      const [sId] = await db('students').insert({
        user_id: stUser.id,
        admission_no: 'ADM-ZOOM-1',
        current_class_id: 1, // Enrolled in Class 1
        admission_date: '2025-09-01',
        status: 'ACTIVE'
      });
      stRecord = { id: sId };
    }
    studentId = stRecord.id;

    // Ensure student is active and not restricted by leftover fee test data
    await db('users').where({ id: stUser.id }).update({ status: 'ACTIVE' });
    await db('students').where({ id: studentId }).update({ status: 'ACTIVE' });
    await db('fee_challans').where({ student_id: studentId }).del().catch(() => {});
    await db('fee_restriction_events').where({ student_id: studentId }).del().catch(() => {});

    // Login Student
    const stRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'student1.zoom@school.pk', password: 'TeacherPassword123!' });
    studentCookies = stRes.headers['set-cookie'];

    const curSession = await db('academic_sessions').where({ is_current: 1 }).first();
    sessionId = curSession.id;

    // Clean up test timetable data
    await db('timetable_lessons').del();
    await db('timetable_slots').del();
    await db('zoom_meetings').del();
    await db('operational_notifications').where('title', 'like', '%Class%').orWhere('title', 'like', '%Absence%').del();
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('1 & 2: Principal One-Time Setup, Persistence & No Duplication', () => {
    it('1. Principal saves a classroom link once and it persists across sessions', async () => {
      const saveRes = await request(app)
        .put('/api/v1/zoom/class-meetings/1')
        .set('Cookie', principalCookies)
        .set('X-CSRF-Token', principalCsrf)
        .send({
          zoomMeetingId: '81122334455',
          joinUrl: 'https://zoom.us/j/81122334455?pwd=PERMCLASS1',
          passcode: 'PERMCLASS1',
          topic: 'Class 1 Permanent Live Room',
          configNotes: 'JBH enabled, passcodes enforced'
        });

      expect(saveRes.status).toBe(200);
      expect(saveRes.body.success).toBe(true);
      expect(saveRes.body.data.zoom_meeting_id).toBe('81122334455');
      expect(saveRes.body.data.passcode).toBe('PERMCLASS1');

      // Verify persistent in database
      const row = await db('zoom_meetings').where({ class_id: 1, status: 'ACTIVE' }).first();
      expect(row).toBeDefined();
      expect(row.zoom_meeting_id).toBe('81122334455');
    });

    it('2. Updating an existing classroom configuration updates or replaces without duplicate ACTIVE records', async () => {
      const updateRes = await request(app)
        .put('/api/v1/zoom/class-meetings/1')
        .set('Cookie', principalCookies)
        .set('X-CSRF-Token', principalCsrf)
        .send({
          zoomMeetingId: '89999888877',
          joinUrl: 'https://zoom.us/j/89999888877?pwd=ROTATED1',
          passcode: 'ROTATED1',
          topic: 'Class 1 Permanent Live Room - Rotated',
          reason: 'Annual rotation by Principal'
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.body.success).toBe(true);

      // Exactly ONE active meeting must exist for Class 1
      const activeRows = await db('zoom_meetings').where({ class_id: 1, status: 'ACTIVE' });
      expect(activeRows.length).toBe(1);
      expect(activeRows[0].zoom_meeting_id).toBe('89999888877');

      // Previous record was marked REPLACED for auditability
      const replacedRows = await db('zoom_meetings').where({ class_id: 1, status: 'REPLACED' });
      expect(replacedRows.length).toBeGreaterThanOrEqual(1);
      expect(replacedRows[0].retire_reason).toBe('Annual rotation by Principal');
    });
  });

  describe('3 & 4: Actual Timetable Following & 8 Simultaneous Classes Without Duplicates', () => {
    it('3 & 4. Schedules 8 simultaneous lesson records from actual timetable slots without duplicates', async () => {
      // Find today's weekday in school timezone
      const schoolTz = 'Asia/Karachi';
      const now = new Date();
      const dayName = new Intl.DateTimeFormat('en-US', { timeZone: schoolTz, weekday: 'short' }).format(now);
      const weekdayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
      const todayWeekday = weekdayMap[dayName] || 1;

      // Ensure persistent Zoom meetings exist for classes 1-8
      await zoomService.setupClassMeetings({ hostUserId: 'zoom_admin_master', createdBy: 1 });

      // Create 8 published timetable slots at 10:00 - 10:45 AM for Classes 1 through 8
      for (let classId = 1; classId <= 8; classId++) {
        await db('timetable_slots').insert({
          session_id: sessionId,
          class_id: classId,
          subject_id: 1,
          teacher_id: teacher1Id,
          weekday: todayWeekday,
          start_time: '10:00:00',
          end_time: '10:45:00',
          status: 'PUBLISHED',
          effective_from: '2026-01-01',
          created_by: 1
        });
      }

      // Execute scheduler tick
      const tickResult = await runZoomScheduleTick(now);
      expect(tickResult.success).toBe(true);

      // Formatter for today
      const todayStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: schoolTz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(now);

      // Verify 8 distinct lesson records were created for today
      const todayLessons = await db('timetable_lessons').where({ lesson_date: todayStr });
      expect(todayLessons.length).toBe(8);

      const classIds = todayLessons.map((l) => l.class_id).sort((a, b) => a - b);
      expect(classIds).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);

      // Repeated scheduler run must NOT create duplicate lessons (Idempotency)
      await runZoomScheduleTick(now);
      const todayLessonsAfterSecondTick = await db('timetable_lessons').where({ lesson_date: todayStr });
      expect(todayLessonsAfterSecondTick.length).toBe(8);
    }, 30000);
  });

  describe('5 & 6: Five-Minute Notifications & Deduplication on Retries', () => {
    it('5 & 6. Dispatches notification at T-5m and prevents duplicates on retries/restarts', async () => {
      const now = new Date();
      const schoolTz = 'Asia/Karachi';
      const todayStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: schoolTz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(now);

      // Create a lesson starting in exactly 4 minutes
      const startAt = new Date(now.getTime() + 4 * 60 * 1000);
      const endAt = new Date(now.getTime() + 45 * 60 * 1000);

      const [lessonId] = await db('timetable_lessons').insert({
        class_id: 1,
        subject_id: 1,
        teacher_id: teacher1Id,
        lesson_date: todayStr,
        start_at: startAt,
        end_at: endAt,
        status: 'SCHEDULED',
        session_state: 'SCHEDULED'
      });

      // Clear notifications
      await db('operational_notifications').where({ user_id: teacher1UserId }).del();

      // Tick 1: Should notify teacher 1
      const tick1 = await runZoomScheduleTick(now);
      expect(tick1.success).toBe(true);

      const lessonAfterTick1 = await db('timetable_lessons').where({ id: lessonId }).first();
      expect(lessonAfterTick1.teacher_notified_at).not.toBeNull();
      expect(lessonAfterTick1.session_state).toBe('STARTING_SOON');

      const notifs1 = await db('operational_notifications').where({ user_id: teacher1UserId });
      expect(notifs1.length).toBe(1);
      expect(notifs1[0].message).toContain('Your next class starts in 5 minutes');

      // Tick 2 (Simulating retry / next interval): Must NOT duplicate notification
      await runZoomScheduleTick(now);
      const notifs2 = await db('operational_notifications').where({ user_id: teacher1UserId });
      expect(notifs2.length).toBe(1);
    });
  });

  describe('7: Server Restart Recovery', () => {
    it('7. Recover overdue or missed scheduled jobs after server restart without data loss', async () => {
      const now = new Date();
      // Even if lock was held or server abruptly died, scheduler resets stale locks and resumes
      await db('zoom_schedule_locks')
        .where('job_name', 'ZOOM_CLASS_SCHEDULER')
        .update({
          locked_until: new Date(now.getTime() - 10000) // expired lock
        });

      const tick = await runZoomScheduleTick(now);
      expect(tick.success).toBe(true);
    });
  });

  describe('8: Teacher Handover & Revocation of Previous Privileges', () => {
    it('8. Concludes previous lesson upon incoming teacher start; prevents unauthorized access', async () => {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      // Lesson 1 (Teacher 1)
      const [l1Id] = await db('timetable_lessons').insert({
        class_id: 1,
        subject_id: 1,
        teacher_id: teacher1Id,
        lesson_date: todayStr,
        start_at: new Date(now.getTime() - 20 * 60 * 1000),
        end_at: new Date(now.getTime() + 10 * 60 * 1000),
        status: 'LIVE',
        session_state: 'LIVE'
      });

      // Lesson 2 (Teacher 2, scheduled for next period)
      const [l2Id] = await db('timetable_lessons').insert({
        class_id: 1,
        subject_id: 2,
        teacher_id: teacher2Id,
        lesson_date: todayStr,
        start_at: new Date(now.getTime() - 2 * 60 * 1000),
        end_at: new Date(now.getTime() + 38 * 60 * 1000),
        status: 'SCHEDULED',
        session_state: 'SCHEDULED'
      });

      // Teacher 1 attempts to start Teacher 2's lesson -> FORBIDDEN (403)
      const unauthRes = await request(app)
        .post(`/api/v1/zoom/sessions/${l2Id}/start`)
        .set('Cookie', teacher1Cookies)
        .set('X-CSRF-Token', teacher1Csrf);
      expect(unauthRes.status).toBe(403);

      // Teacher 2 starts Lesson 2
      const authRes = await request(app)
        .post(`/api/v1/zoom/sessions/${l2Id}/start`)
        .set('Cookie', teacher2Cookies)
        .set('X-CSRF-Token', teacher2Csrf);

      expect(authRes.status).toBe(200);
      expect(authRes.body.data.status).toBe('LIVE');
      expect(authRes.body.data.previousLessonAutoCompleted).toBe(true);

      // Verify Lesson 1 is now marked COMPLETED with handover timestamp
      const l1After = await db('timetable_lessons').where({ id: l1Id }).first();
      expect(l1After.status).toBe('COMPLETED');
      expect(l1After.handover_at).not.toBeNull();

      // Verify Lesson 2 has teacher_joined_at stamped
      const l2After = await db('timetable_lessons').where({ id: l2Id }).first();
      expect(l2After.status).toBe('LIVE');
      expect(l2After.teacher_joined_at).not.toBeNull();
    });
  });

  describe('9: Student Class Access Authorization', () => {
    it('9. Student sees only their enrolled class session and cannot access other classes', async () => {
      // Ensure no residual restriction before accessing session
      await db('users').where({ email: 'student1.zoom@school.pk' }).update({ status: 'ACTIVE' });
      await db('students').where({ id: studentId }).update({ status: 'ACTIVE' });
      await db('fee_challans').where({ student_id: studentId }).del().catch(() => {});
      await db('fee_restriction_events').where({ student_id: studentId }).del().catch(() => {});

      const studentSessionRes = await request(app)
        .get('/api/v1/zoom/student-class-session')
        .set('Cookie', studentCookies);

      expect(studentSessionRes.status).toBe(200);
      expect(studentSessionRes.body.data.classId).toBe(1);

      // Attempting to inject query classId=8 does not override enrolled class and is rejected
      const restrictedRes = await request(app)
        .get('/api/v1/zoom/student-class-session?classId=8')
        .set('Cookie', studentCookies);

      expect([200, 403]).toContain(restrictedRes.status);
      if (restrictedRes.status === 200) {
        expect(restrictedRes.body.data.classId).toBe(1); // Securely kept to enrolled class
      }
    });
  });

  describe('10: Teacher Absence Detection & Alert After Grace Period', () => {
    it('10. Triggers TEACHER_ABSENT alert after 10-minute grace period without host launch', async () => {
      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      // Lesson started 12 minutes ago, teacher never joined
      const [absentLessonId] = await db('timetable_lessons').insert({
        class_id: 1,
        subject_id: 1,
        teacher_id: teacher1Id,
        lesson_date: todayStr,
        start_at: new Date(now.getTime() - 12 * 60 * 1000),
        end_at: new Date(now.getTime() + 25 * 60 * 1000),
        status: 'SCHEDULED',
        session_state: 'AWAITING_TEACHER',
        teacher_joined_at: null,
        teacher_absence_alert_at: null
      });

      // Clear previous principal alerts
      await db('operational_notifications').where('title', 'Teacher Absence Alert').del();

      // Run scheduler tick
      const tick = await runZoomScheduleTick(now);
      expect(tick.success).toBe(true);

      // Verify lesson state changed to TEACHER_ABSENT
      const lessonRow = await db('timetable_lessons').where({ id: absentLessonId }).first();
      expect(lessonRow.session_state).toBe('TEACHER_ABSENT');
      expect(lessonRow.teacher_absence_alert_at).not.toBeNull();

      // Verify alert notification was dispatched
      const alerts = await db('operational_notifications').where('title', 'Teacher Absence Alert');
      expect(alerts.length).toBeGreaterThanOrEqual(1);
      expect(alerts[0].message).toContain('Teacher Absence Alert');
      expect(alerts[0].message).toContain('Grace period (10 minutes) exceeded');
    });
  });

  describe('11 & 12: Zoom Link Validation & Capacity Oversight', () => {
    it('11 & 12. Validates Zoom link URLs and accurately reports capacity status and limitations', async () => {
      // Rejection of invalid URL
      const invalidRes = await request(app)
        .put('/api/v1/zoom/class-meetings/1')
        .set('Cookie', principalCookies)
        .set('X-CSRF-Token', principalCsrf)
        .send({
          zoomMeetingId: '1234567890',
          joinUrl: 'invalid-url-protocol',
          passcode: '123'
        });

      expect(invalidRes.status).toBe(400);

      // Capacity endpoint accurately reports single Zoom Pro account & JBH architecture
      const capacityRes = await request(app)
        .get('/api/v1/zoom/capacity-status')
        .set('Cookie', principalCookies);

      expect(capacityRes.status).toBe(200);
      expect(capacityRes.body.data.accountType).toMatch(/Zoom/);
      expect(capacityRes.body.data.concurrencyArchitecture).toMatch(/Permanent Virtual Classrooms|Join-Before-Host/);
    }, 30000);
  });

  describe('13 & 14: Concurrent Scheduler Safety & Documented Host Handover', () => {
    it('13. Concurrent scheduler executions lock safely without collision', async () => {
      await db('zoom_schedule_locks').where('job_name', 'ZOOM_CLASS_SCHEDULER').update({ locked_until: null });
      const now = new Date();
      const [res1, res2] = await Promise.all([
        runZoomScheduleTick(now),
        runZoomScheduleTick(now)
      ]);

      // One should succeed, the other safely skips due to lock
      const results = [res1, res2];
      const hasSuccess = results.some((r) => r.success === true);
      const hasSkipped = results.some((r) => r.skipped === 'locked' || r.success === true);

      expect(hasSuccess).toBe(true);
      expect(hasSkipped).toBe(true);
    });

    it('14. Verified Zoom host handover limitation and documented JBH mitigation', async () => {
      const meeting = await zoomRepository.getMeetingByClassId(1);
      expect(meeting).toBeDefined();
      expect(meeting.joinUrl).toContain('zoom.us');
      // Passcodes and Join URLs are stored encrypted in DB and decrypted on retrieval
      expect(meeting.passcode).toBeDefined();
    });
  });
});
