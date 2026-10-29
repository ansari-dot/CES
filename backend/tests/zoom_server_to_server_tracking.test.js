import assert from 'node:assert/strict';
import { db } from '../src/shared/db/knex.js';
import { zoomService } from '../src/modules/zoom/zoom.service.js';
import { zoomRepository } from '../src/modules/zoom/zoom.repository.js';
import { zoomApiClient } from '../src/shared/services/zoomApiClient.js';
import { payrollRepository } from '../src/modules/payroll/payroll.repository.js';

describe('Zoom Server-to-Server Duty & Payroll Tracking', () => {
  let testTeacherUserId;
  let testTeacherId;
  let testClassId;
  let testSubjectId;
  let testLessonId;
  const meetingId = '90010001001';

  beforeAll(async () => {
    try {
    await db('users').where({ username: 'test_zoom_teacher' }).del().catch(() => {});

    // 1. Create a test teacher
    const [uId] = await db('users').insert({
      username: 'test_zoom_teacher',
      email: 'zoom_teacher@school.pk',
      full_name: 'Professor Zoom Test',
      password_hash: 'hash',
      role_id: 3,
      status: 'ACTIVE'
    });
    testTeacherUserId = uId;

    const [tId] = await db('teachers').insert({
      user_id: uId,
      employee_no: 'TCH-ZOOM-TEST',
      designation: 'Senior Faculty',
      employment_status: 'ACTIVE',
      joining_date: '2026-01-01'
    });
    testTeacherId = tId;

    // 2. Set up Hourly Salary Profile (e.g. Rs. 2,000 / hour)
    await db('teacher_salary_profiles').insert({
      teacher_id: tId,
      model: 'PER_HOUR',
      base_amount: 0,
      per_hour_rate: 2000,
      per_lesson_rate: 1500,
      rules: JSON.stringify({ allowances: 2000, standardDeductions: 500 }),
      effective_from: '2026-01-01'
    });

    // 3. Get or create class & subject
    let cls = await db('classes').first();
    testClassId = cls.id;
    let sub = await db('subjects').first();
    testSubjectId = sub.id;

    // 4. Create class zoom meeting
    await db('zoom_meetings').where({ class_id: testClassId }).del();
    await zoomRepository.configureClassMeeting({
      classId: testClassId,
      zoomMeetingId: meetingId,
      joinUrl: `https://zoom.us/j/${meetingId}`,
      passcode: 'CLASS1#',
      topic: 'Class 1 Test Room'
    });

    // 5. Create a timetable lesson for today
    const today = new Date().toISOString().split('T')[0];
    const [lId] = await db('timetable_lessons').insert({
      class_id: testClassId,
      subject_id: testSubjectId,
      teacher_id: tId,
      lesson_date: today,
      start_at: `${today} 09:00:00`,
      end_at: `${today} 09:45:00`,
      status: 'SCHEDULED'
    });
    testLessonId = lId;
    } catch (err) {
      console.error('BEFORE HOOK ERROR:', err);
      throw err;
    }
  });

  afterAll(async () => {
    // Clean up test records
    await db('zoom_participant_log').where({ lesson_id: testLessonId }).del().catch(() => {});
    await db('zoom_events').where({ zoom_meeting_id: meetingId }).del().catch(() => {});
    await db('teacher_payroll_drafts').where({ teacher_id: testTeacherId }).del().catch(() => {});
    await db('teacher_salary_profiles').where({ teacher_id: testTeacherId }).del().catch(() => {});
    await db('zoom_meetings').where({ zoom_meeting_id: meetingId }).del().catch(() => {});
    await zoomRepository.configureClassMeeting({
      classId: testClassId,
      zoomMeetingId: `8800000000${testClassId}`.slice(-10),
      joinUrl: `https://zoom.us/j/8800000000${testClassId}`,
      passcode: 'CLASS1#',
      topic: `Class ${testClassId} Standard Room`
    }).catch(() => {});
    await db('teachers').where({ id: testTeacherId }).del().catch(() => {});
    await db('audit_logs').where({ actor_id: testTeacherUserId }).del().catch(() => {});
    await db('users').where({ id: testTeacherUserId }).del().catch(() => {});
  });

  it('1. Handles Zoom URL validation webhook event', async () => {
    const res = await zoomService.handleWebhookEvent({
      event: 'endpoint.url_validation',
      payload: { plainToken: 'zoom_test_token_12345' }
    });
    assert.equal(res.plainToken, 'zoom_test_token_12345');
    assert.ok(res.encryptedToken);
  });

  it('2. Records teacher join time via Server-to-Server webhook and marks status LIVE', async () => {
    const today = new Date().toISOString().split('T')[0];
    const joinTime = new Date(`${today}T09:01:00Z`).toISOString();
    await zoomService.handleWebhookEvent({
      event: 'meeting.participant_joined',
      payload: {
        id: meetingId,
        object: {
          id: meetingId,
          participant: {
            user_name: 'Professor Zoom Test',
            email: 'zoom_teacher@school.pk',
            join_time: joinTime
          }
        }
      }
    });

    const updated = await db('timetable_lessons').where({ id: testLessonId }).first();
    assert.equal(updated.status, 'LIVE');
    assert.ok(updated.teacher_joined_at);
  });

  it('3. Records teacher leave time via Server-to-Server webhook, marks status COMPLETED, and sets actual end', async () => {
    const today = new Date().toISOString().split('T')[0];
    const leaveTime = new Date(`${today}T09:46:00Z`).toISOString();
    await zoomService.handleWebhookEvent({
      event: 'meeting.participant_left',
      payload: {
        id: meetingId,
        object: {
          id: meetingId,
          participant: {
            user_name: 'Professor Zoom Test',
            email: 'zoom_teacher@school.pk',
            leave_time: leaveTime,
            duration: 2700 // 45 minutes
          }
        }
      }
    });

    const updated = await db('timetable_lessons').where({ id: testLessonId }).first();
    assert.equal(updated.status, 'COMPLETED');
    assert.ok(updated.actual_end_at);
  });

  it('4. Computes daily duty summary with exact Zoom minutes and verified attendance', async () => {
    const today = new Date().toISOString().split('T')[0];
    const summary = await zoomService.getTeacherDailyDutySummary(testTeacherId, today);

    assert.equal(summary.teacherId, testTeacherId);
    assert.equal(summary.totalCompletedLessons, 1);
    assert.equal(summary.attendanceStatus, 'Present (Zoom Verified)');
    assert.ok(summary.totalTrackedMinutes >= 40);
    assert.ok(summary.totalTrackedHours >= 0.7);
  });

  it('5. Computes monthly payroll using verified Zoom tracked hours', async () => {
    const draft = await payrollRepository.generateMonthlyDrafts({
      payrollMonth: 'October 2026',
      userId: 1,
      teacherId: testTeacherId
    });

    const savedDraft = await db('teacher_payroll_drafts')
      .where({ teacher_id: testTeacherId, payroll_month: 'October 2026' })
      .first();

    assert.ok(savedDraft);
    assert.equal(savedDraft.salary_model, 'PER_HOUR');
    assert.equal(savedDraft.completed_lessons, 1);
    assert.ok(Number(savedDraft.verified_hours) >= 0.7);
    assert.ok(Number(savedDraft.net_payable) > 0);
  });
});
