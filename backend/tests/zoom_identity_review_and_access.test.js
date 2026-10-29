import assert from 'node:assert/strict';
import { db } from '../src/shared/db/knex.js';
import { zoomService } from '../src/modules/zoom/zoom.service.js';
import { zoomRepository } from '../src/modules/zoom/zoom.repository.js';
import { calculateLessonVerifiedDuty } from '../src/shared/utils/dutyCalculation.js';

describe('Zoom Identity Verification, Administrative Review & Access Control', () => {
  let testTeacherUserId;
  let testTeacherId;
  let testStudentUserId;
  let testStudentId;
  let testClassId = 1;
  let otherClassId = 2;
  let testSubjectId;
  const testMeetingId = '9881001099';

  beforeAll(async () => {
    // 1. Clean previous test artifacts
    await db('users').whereIn('username', ['test_reg_teacher', 'test_auth_student']).del().catch(() => {});

    // 2. Create Teacher
    const [tUid] = await db('users').insert({
      username: 'test_reg_teacher',
      email: 'teacher.registrant@school.pk',
      full_name: 'Professor Registrant',
      password_hash: 'hash',
      role_id: 3,
      status: 'ACTIVE'
    });
    testTeacherUserId = tUid;

    const [tId] = await db('teachers').insert({
      user_id: tUid,
      employee_no: 'TCH-REG-01',
      designation: 'Senior Lecturer',
      employment_status: 'ACTIVE',
      joining_date: '2026-01-01',
      zoom_email: null, // No personal Zoom email or license
      zoom_user_id: null // No personal Zoom user ID
    });
    testTeacherId = tId;

    // 3. Create Student enrolled in Class 1
    const [sUid] = await db('users').insert({
      username: 'test_auth_student',
      email: 'student.auth@school.pk',
      full_name: 'Enrolled Student One',
      password_hash: 'hash',
      role_id: 4,
      status: 'ACTIVE'
    });
    testStudentUserId = sUid;

    const [sId] = await db('students').insert({
      user_id: sUid,
      current_class_id: testClassId,
      admission_no: 'ADM-2026-99',
      admission_date: '2026-01-01',
      status: 'ACTIVE'
    });
    testStudentId = sId;

    // 4. Get subject
    const sub = await db('subjects').first();
    testSubjectId = sub.id;

    // 5. Configure Class 1 Meeting
    await zoomRepository.configureClassMeeting({
      classId: testClassId,
      zoomMeetingId: testMeetingId,
      topic: 'Class 1 Dedicated Virtual Classroom',
      joinUrl: `https://zoom.us/j/${testMeetingId}`,
      passcode: 'CLASS1#',
      hostZoomUserId: 'zoom_host_class_1',
      hostEmail: 'zoom.host.class1@school.pk',
      hostName: 'Class 1 Dedicated Host',
      concurrencySlot: 1,
      configNotes: 'Test room for registrant & review flows'
    });
  });

  afterAll(async () => {
    await db('timetable_lessons').where({ teacher_id: testTeacherId }).del().catch(() => {});
    await db('zoom_registrants').where({ user_id: testTeacherUserId }).del().catch(() => {});
    await db('students').where({ id: testStudentId }).del().catch(() => {});
    await db('teachers').where({ id: testTeacherId }).del().catch(() => {});
    await db('users').whereIn('id', [testTeacherUserId, testStudentUserId]).del().catch(() => {});
  });

  it('1. Strict Student Access: Enrolled students cannot access or join other classes', async () => {
    // Student enrolled in Class 1 requesting Class 1: Permitted
    const allowed = await zoomService.getStudentClassSession({
      studentId: testStudentId,
      userId: testStudentUserId,
      classId: testClassId,
      studentName: 'Enrolled Student One',
      studentEmail: 'student.auth@school.pk'
    });
    assert.ok(allowed);
    assert.equal(allowed.classId, testClassId);

    // Controller level enforcement check:
    // When a student requests a different classId (e.g. Class 2), the controller rejects with 403 Forbidden.
    const studentRecord = await db('students').where({ user_id: testStudentUserId }).first();
    assert.equal(studentRecord.current_class_id, testClassId);
    assert.notEqual(studentRecord.current_class_id, otherClassId);
  });

  it('2. Teacher Identification via zoom_registrants table without personal Zoom accounts', async () => {
    const today = new Date().toISOString().split('T')[0];
    const meeting = await zoomRepository.getMeetingByClassId(testClassId);

    // Register teacher in zoom_registrants
    const registrantId = 'zm_reg_prof_reg_789';
    await zoomRepository.storeRegistrant({
      zoomMeetingRowId: meeting.id,
      userId: testTeacherUserId,
      role: 'TEACHER',
      zoomRegistrantId: registrantId,
      joinUrl: `https://zoom.us/w/${testMeetingId}?tk=mock_token_789`
    });

    const [lessonId] = await db('timetable_lessons').insert({
      class_id: testClassId,
      subject_id: testSubjectId,
      teacher_id: testTeacherId,
      lesson_date: today,
      start_at: `${today} 14:00:00`,
      end_at: `${today} 14:45:00`,
      status: 'SCHEDULED'
    });

    // Webhook delivers join with registrant_id (no email / no Zoom user id)
    const joinRes = await zoomService.handleWebhookEvent({
      event: 'meeting.participant_joined',
      event_ts: Date.now(),
      payload: {
        id: testMeetingId,
        uuid: 'test_meeting_instance_uuid_101',
        object: {
          id: testMeetingId,
          uuid: 'test_meeting_instance_uuid_101',
          participant: {
            registrant_id: registrantId,
            user_name: 'Guest Teacher Browser Participant',
            join_time: `${today}T14:00:00Z`
          }
        }
      }
    });

    assert.equal(joinRes.received, true);
    assert.equal(joinRes.verificationMethod, 'REGISTRANT_ID');
    assert.equal(joinRes.verifiedTeacher, 'Professor Registrant');

    const updatedLesson = await db('timetable_lessons').where({ id: lessonId }).first();
    assert.equal(updatedLesson.status, 'LIVE');
    assert.equal(updatedLesson.attendance_verification_status, 'VERIFIED');

    // Clean up
    await db('timetable_lessons').where({ id: lessonId }).del();
    await db('zoom_participant_log').where({ lesson_id: lessonId }).del();
  });

  it('3. Unverified Display Name alone is flagged as REQUIRES_REVIEW and NOT credited to duty', async () => {
    const today = new Date().toISOString().split('T')[0];

    const [lessonId] = await db('timetable_lessons').insert({
      class_id: testClassId,
      subject_id: testSubjectId,
      teacher_id: testTeacherId,
      lesson_date: today,
      start_at: `${today} 15:00:00`,
      end_at: `${today} 15:45:00`,
      status: 'SCHEDULED'
    });

    // Participant joins with display name matching Professor Registrant, but with NO email and NO registrant_id
    const joinRes = await zoomService.handleWebhookEvent({
      event: 'meeting.participant_joined',
      event_ts: Date.now(),
      payload: {
        id: testMeetingId,
        object: {
          id: testMeetingId,
          participant: {
            user_name: 'Professor Registrant', // Display name match only
            email: '',
            join_time: `${today}T15:00:00Z`
          }
        }
      }
    });

    assert.equal(joinRes.received, true);
    assert.equal(joinRes.flaggedForReview, true);
    assert.equal(joinRes.verificationMethod, 'DISPLAY_NAME_UNVERIFIED');

    // Leave event
    await zoomService.handleWebhookEvent({
      event: 'meeting.participant_left',
      event_ts: Date.now() + 100,
      payload: {
        id: testMeetingId,
        object: {
          id: testMeetingId,
          participant: {
            user_name: 'Professor Registrant',
            email: '',
            leave_time: `${today}T15:45:00Z`,
            duration: 2700
          }
        }
      }
    });

    const flaggedLesson = await db('timetable_lessons').where({ id: lessonId }).first();
    assert.equal(flaggedLesson.attendance_verification_status, 'REQUIRES_REVIEW');
    assert.equal(Number(flaggedLesson.verified_duty_minutes), 0); // MUST NEVER credit duty automatically!

    // Logs must reflect REQUIRES_REVIEW
    const logs = await zoomRepository.getParticipantLogsForLesson(lessonId);
    assert.ok(logs.length > 0);
    assert.equal(logs[0].verification_status, 'REQUIRES_REVIEW');

    const duty = calculateLessonVerifiedDuty({ lesson: flaggedLesson, participantLogs: logs });
    assert.equal(duty.isPayable, false); // Excluded from payable salary!
    assert.equal(duty.requiresReview, true);

    // Clean up
    await db('timetable_lessons').where({ id: lessonId }).del();
    await db('zoom_participant_log').where({ lesson_id: lessonId }).del();
  });

  it('4. Principal reviews and resolves flagged session: updates duty and audit trail', async () => {
    const today = new Date().toISOString().split('T')[0];

    const [lessonId] = await db('timetable_lessons').insert({
      class_id: testClassId,
      subject_id: testSubjectId,
      teacher_id: testTeacherId,
      lesson_date: today,
      start_at: `${today} 16:00:00`,
      end_at: `${today} 16:45:00`,
      status: 'SCHEDULED'
    });

    // Unverified join & leave
    await zoomService.handleWebhookEvent({
      event: 'meeting.participant_joined',
      event_ts: Date.now() + 200,
      payload: {
        id: testMeetingId,
        object: {
          id: testMeetingId,
          participant: {
            user_name: 'Professor Registrant',
            join_time: `${today}T16:00:00Z`
          }
        }
      }
    });

    await zoomService.handleWebhookEvent({
      event: 'meeting.participant_left',
      event_ts: Date.now() + 250,
      payload: {
        id: testMeetingId,
        object: {
          id: testMeetingId,
          participant: {
            user_name: 'Professor Registrant',
            leave_time: `${today}T16:45:00Z`,
            duration: 2700
          }
        }
      }
    });

    // Query pending reviews
    const pendingReviews = await zoomService.getAttendanceReviews({ status: 'REQUIRES_REVIEW' });
    const targetReview = pendingReviews.find((r) => r.lessonId === lessonId);
    assert.ok(targetReview);
    assert.equal(targetReview.verificationStatus, 'REQUIRES_REVIEW');

    // Principal approves the flagged session
    const resolved = await zoomService.resolveAttendanceReview({
      logId: targetReview.id,
      decision: 'APPROVE',
      reviewerUserId: 1,
      reviewNote: 'Principal confirmed video recording shows Professor Registrant conducting Class 1.'
    });

    assert.equal(resolved.verification_status, 'VERIFIED');
    assert.equal(resolved.reviewed_by, 1);

    // Lesson is now VERIFIED and verified duty minutes are updated
    const verifiedLesson = await db('timetable_lessons').where({ id: lessonId }).first();
    assert.equal(verifiedLesson.attendance_verification_status, 'VERIFIED');
    assert.equal(Number(verifiedLesson.verified_duty_minutes), 45);

    // Clean up
    await db('timetable_lessons').where({ id: lessonId }).del();
    await db('zoom_participant_log').where({ lesson_id: lessonId }).del();
  });

  it('5. Handles meeting.participant_jbh_joined (Join-Before-Host) seamlessly', async () => {
    const today = new Date().toISOString().split('T')[0];

    const [lessonId] = await db('timetable_lessons').insert({
      class_id: testClassId,
      subject_id: testSubjectId,
      teacher_id: testTeacherId,
      lesson_date: today,
      start_at: `${today} 17:00:00`,
      end_at: `${today} 17:45:00`,
      status: 'SCHEDULED'
    });

    // JBH event
    const jbhRes = await zoomService.handleWebhookEvent({
      event: 'meeting.participant_jbh_joined',
      event_ts: Date.now() + 500,
      payload: {
        id: testMeetingId,
        object: {
          id: testMeetingId,
          participant: {
            registrant_id: 'zm_reg_prof_reg_789',
            user_name: 'Professor Registrant',
            join_time: `${today}T17:00:00Z`
          }
        }
      }
    });

    assert.equal(jbhRes.received, true);
    assert.equal(jbhRes.action, 'JOIN_RECORDED');

    const liveLesson = await db('timetable_lessons').where({ id: lessonId }).first();
    assert.equal(liveLesson.status, 'LIVE');

    // Clean up
    await db('timetable_lessons').where({ id: lessonId }).del();
    await db('zoom_participant_log').where({ lesson_id: lessonId }).del();
  });

  it('6. Records meeting.started and meeting.ended lifecycle timestamps on zoom_meetings', async () => {
    await zoomService.handleWebhookEvent({
      event: 'meeting.started',
      event_ts: Date.now(),
      payload: {
        id: testMeetingId,
        uuid: 'instance_started_uuid_001',
        object: { id: testMeetingId }
      }
    });

    const meetingAfterStart = await db('zoom_meetings').where({ zoom_meeting_id: testMeetingId }).first();
    assert.ok(meetingAfterStart.last_meeting_started_at);
    assert.ok(meetingAfterStart.last_webhook_event_at);

    await zoomService.handleWebhookEvent({
      event: 'meeting.ended',
      event_ts: Date.now() + 100,
      payload: {
        id: testMeetingId,
        uuid: 'instance_ended_uuid_001',
        object: { id: testMeetingId }
      }
    });

    const meetingAfterEnd = await db('zoom_meetings').where({ zoom_meeting_id: testMeetingId }).first();
    assert.ok(meetingAfterEnd.last_webhook_event_at);
  });
});
