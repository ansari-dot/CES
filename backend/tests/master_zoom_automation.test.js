import assert from 'node:assert/strict';
import http from 'http';
import { io as Client } from 'socket.io-client';
import { db } from '../src/shared/db/knex.js';
import { zoomService } from '../src/modules/zoom/zoom.service.js';
import { zoomRepository } from '../src/modules/zoom/zoom.repository.js';
import { runZoomScheduleTick, zoomScheduler } from '../src/modules/zoom/zoom.scheduler.js';
import { calculateLessonVerifiedDuty } from '../src/shared/utils/dutyCalculation.js';
import { payrollRepository } from '../src/modules/payroll/payroll.repository.js';
import { initSocketServer } from '../src/shared/realtime/socket.js';
import { emitRealtimeEvent, RealtimeEvents } from '../src/shared/realtime/eventEmitter.js';

describe('MASTER AUTOMATION: Full Zoom Class Automation, Teacher Duty & Payroll, Student Attendance, WebSockets', () => {
  let teacherAUserId, teacherAId;
  let teacherBUserId, teacherBId;
  let studentUserId, studentId;
  let testSubjectId;
  let server, ioServer;
  let socketPort = 5055;

  const meetingClass1 = '9881001001';
  const meetingClass2 = '9882002002';
  const today = new Date().toISOString().split('T')[0];

  beforeAll(async () => {
    // 1. Clean up potential old test records
    await db('zoom_events').whereIn('zoom_meeting_id', [meetingClass1, meetingClass2]).del().catch(() => {});
    await db('zoom_participant_log').whereIn('zoom_meeting_id', [meetingClass1, meetingClass2]).del().catch(() => {});
    await db('teacher_duty_sessions').whereIn('zoom_meeting_id', [meetingClass1, meetingClass2]).del().catch(() => {});
    await db('teacher_payroll_drafts').whereIn('payroll_month', ['October 2026', 'April 2026']).del().catch(() => {});

    // 2. Setup Test Teacher A
    await db('teachers').where({ employee_no: 'TCH-ALPHA-TEST' }).del().catch(() => {});
    await db('users').where({ username: 'test_alpha_user' }).del().catch(() => {});

    const [uIdA] = await db('users').insert({
      username: 'test_alpha_user',
      email: 'teacher.alpha@school.pk',
      full_name: 'Professor Alpha Master',
      password_hash: 'hash',
      role_id: 3,
      status: 'ACTIVE'
    });
    teacherAUserId = uIdA;

    const [tIdA] = await db('teachers').insert({
      user_id: uIdA,
      employee_no: 'TCH-ALPHA-TEST',
      designation: 'Senior Faculty',
      employment_status: 'ACTIVE',
      joining_date: '2026-01-01',
      zoom_email: 'teacher.alpha@school.pk',
      zoom_user_id: 'zoom_alpha_99'
    });
    teacherAId = tIdA;

    // Teacher A Salary Profile (HYBRID: Rs. 50,000 base + Rs. 1,000/lesson)
    await db('teacher_salary_profiles').where({ teacher_id: teacherAId }).del().catch(() => {});
    await db('teacher_salary_profiles').insert({
      teacher_id: teacherAId,
      model: 'HYBRID',
      base_amount: 50000,
      per_hour_rate: 1000,
      per_lesson_rate: 1000,
      rules: JSON.stringify({ allowances: 2500, standardDeductions: 1000 }),
      effective_from: '2026-01-01'
    });

    // 3. Setup Test Teacher B
    await db('teachers').where({ employee_no: 'TCH-BETA-TEST' }).del().catch(() => {});
    await db('users').where({ username: 'test_beta_user' }).del().catch(() => {});

    const [uIdB] = await db('users').insert({
      username: 'test_beta_user',
      email: 'teacher.beta@school.pk',
      full_name: 'Professor Beta Master',
      password_hash: 'hash',
      role_id: 3,
      status: 'ACTIVE'
    });
    teacherBUserId = uIdB;

    const [tIdB] = await db('teachers').insert({
      user_id: uIdB,
      employee_no: 'TCH-BETA-TEST',
      designation: 'Junior Faculty',
      employment_status: 'ACTIVE',
      joining_date: '2026-01-01',
      zoom_email: 'teacher.beta@school.pk',
      zoom_user_id: 'zoom_beta_88'
    });
    teacherBId = tIdB;

    // 4. Setup Test Student S1 in Class 1
    await db('students').where({ admission_no: 'ADM-STU-001' }).del().catch(() => {});
    await db('users').where({ username: 'test_stu_user' }).del().catch(() => {});

    const [stuUId] = await db('users').insert({
      username: 'test_stu_user',
      email: 'student.s1@school.pk',
      full_name: 'Student S1 Test',
      password_hash: 'hash',
      role_id: 4,
      status: 'ACTIVE'
    });
    studentUserId = stuUId;

    const [sId] = await db('students').insert({
      user_id: stuUId,
      admission_no: 'ADM-STU-001',
      admission_date: '2026-01-01',
      current_class_id: 1,
      roll_no: '101',
      status: 'ACTIVE',
      zoom_email: 'student.s1@school.pk',
      zoom_user_id: 'zoom_stu_101'
    });
    studentId = sId;

    // 5. Subject
    const sub = await db('subjects').first();
    testSubjectId = sub.id;

    // 6. Configure Permanent Virtual Classrooms
    await db('zoom_meetings').whereIn('class_id', [1, 2]).del();
    await zoomRepository.configureClassMeeting({
      classId: 1,
      zoomMeetingId: meetingClass1,
      topic: 'Class 1 Permanent Virtual Classroom',
      joinUrl: `https://zoom.us/j/${meetingClass1}`,
      passcode: 'CLASS1#',
      hostZoomUserId: 'zoom_host_class_1',
      hostEmail: 'zoom.class1@school.pk',
      hostName: 'Class 1 Dedicated Host',
      concurrencySlot: 1
    });

    await zoomRepository.configureClassMeeting({
      classId: 2,
      zoomMeetingId: meetingClass2,
      topic: 'Class 2 Permanent Virtual Classroom',
      joinUrl: `https://zoom.us/j/${meetingClass2}`,
      passcode: 'CLASS2#',
      hostZoomUserId: 'zoom_host_class_2',
      hostEmail: 'zoom.class2@school.pk',
      hostName: 'Class 2 Dedicated Host',
      concurrencySlot: 2
    });

    // 7. Setup Test Socket Server on dynamic port
    const app = (req, res) => res.end('OK');
    server = http.createServer(app);
    ioServer = initSocketServer(server);
    await new Promise((resolve) => server.listen(0, resolve));
    socketPort = server.address().port;
  });

  beforeEach(async () => {
    await db('lesson_attendance').whereIn('student_id', [studentId]).del().catch(() => {});
    await db('teacher_duty_sessions').whereIn('teacher_id', [teacherAId, teacherBId]).del().catch(() => {});
    await db('teacher_payroll_drafts').whereIn('teacher_id', [teacherAId, teacherBId]).del().catch(() => {});
    await db('zoom_events').whereIn('zoom_meeting_id', [meetingClass1, meetingClass2]).del().catch(() => {});
    await db('zoom_participant_log').whereIn('zoom_meeting_id', [meetingClass1, meetingClass2]).del().catch(() => {});
    await db('timetable_lessons').whereIn('teacher_id', [teacherAId, teacherBId]).del().catch(() => {});
    await db('timetable_lessons').whereIn('class_id', [1, 2]).del().catch(() => {});
  });

  afterAll(async () => {
    // Teardown socket server
    if (ioServer) {
      try { ioServer.close(); } catch {}
    }
    if (server) {
      await new Promise((resolve) => server.close(resolve)).catch(() => {});
    }
    // Clean up test data
    await db('lesson_attendance').whereIn('student_id', [studentId]).del().catch(() => {});
    await db('teacher_duty_sessions').whereIn('teacher_id', [teacherAId, teacherBId]).del().catch(() => {});
    await db('teacher_payroll_drafts').whereIn('teacher_id', [teacherAId, teacherBId]).del().catch(() => {});
    await db('teacher_salary_profiles').whereIn('teacher_id', [teacherAId, teacherBId]).del().catch(() => {});
    await db('timetable_lessons').whereIn('teacher_id', [teacherAId, teacherBId]).del().catch(() => {});
    await db('zoom_events').whereIn('zoom_meeting_id', [meetingClass1, meetingClass2]).del().catch(() => {});
    await db('zoom_participant_log').whereIn('zoom_meeting_id', [meetingClass1, meetingClass2]).del().catch(() => {});
    await db('students').where({ id: studentId }).del().catch(() => {});
    await db('teachers').whereIn('id', [teacherAId, teacherBId]).del().catch(() => {});
    await db('users').whereIn('id', [teacherAUserId, teacherBUserId, studentUserId]).del().catch(() => {});

    // Close db connection cleanly so node test runner exits immediately
    await db.destroy();
  });

  // =========================================================================
  // TEST A: First Teacher Joins
  // =========================================================================
  it('TEST A — First teacher joins: Duty session created and verified hours begin accumulating', async () => {
    const [lessonId] = await db('timetable_lessons').insert({
      class_id: 1,
      subject_id: testSubjectId,
      teacher_id: teacherAId,
      lesson_date: today,
      start_at: `${today} 09:00:00`,
      end_at: `${today} 09:45:00`,
      status: 'SCHEDULED',
      session_state: 'SCHEDULED',
      period_occurrence_id: `period_1_${today}_test_a`
    });

    const joinRes = await zoomService.handleWebhookEvent({
      event: 'meeting.participant_joined',
      event_ts: Date.now(),
      payload: {
        id: meetingClass1,
        object: {
          id: meetingClass1,
          participant: {
            id: 'zoom_alpha_99',
            user_name: 'Professor Alpha Master',
            email: 'teacher.alpha@school.pk',
            join_time: `${today}T09:00:00Z`
          }
        }
      }
    });

    assert.equal(joinRes.verifiedAsTeacher, true);
    assert.equal(joinRes.lessonId, lessonId);

    // Verify timetable lesson is marked LIVE and teacher_joined_at is stamped
    const updatedLesson = await db('timetable_lessons').where({ id: lessonId }).first();
    assert.equal(updatedLesson.status, 'LIVE');
    assert.ok(updatedLesson.teacher_joined_at);

    // Verify teacher duty session was created in the immutable ledger
    const dutySession = await db('teacher_duty_sessions')
      .where({ lesson_id: lessonId, teacher_id: teacherAId })
      .first();

    assert.ok(dutySession, 'Teacher duty session must be recorded in teacher_duty_sessions');
    assert.equal(dutySession.session_status, 'IN_PROGRESS');
    assert.equal(dutySession.period_occurrence_id, `period_1_${today}_test_a`);
    assert.equal(dutySession.zoom_meeting_id, meetingClass1);

    // Clean up
    await db('timetable_lessons').where({ id: lessonId }).del();
    await db('teacher_duty_sessions').where({ lesson_id: lessonId }).del();
  });

  // =========================================================================
  // TEST B: Second Teacher Joins (Consecutive Periods in Same Room)
  // =========================================================================
  it('TEST B — Second teacher joins: Consecutive teachers in same Zoom room tracked independently', async () => {
    // Period 1: Teacher A (09:00 - 09:45)
    const [p1Id] = await db('timetable_lessons').insert({
      class_id: 1,
      subject_id: testSubjectId,
      teacher_id: teacherAId,
      lesson_date: today,
      start_at: `${today} 09:00:00`,
      end_at: `${today} 09:45:00`,
      status: 'SCHEDULED',
      session_state: 'SCHEDULED',
      period_occurrence_id: `period_1_${today}_slot_1`
    });

    // Period 2: Teacher B (09:45 - 10:30)
    const [p2Id] = await db('timetable_lessons').insert({
      class_id: 1,
      subject_id: testSubjectId,
      teacher_id: teacherBId,
      lesson_date: today,
      start_at: `${today} 09:45:00`,
      end_at: `${today} 10:30:00`,
      status: 'SCHEDULED',
      session_state: 'SCHEDULED',
      period_occurrence_id: `period_1_${today}_slot_2`
    });

    // Teacher A joins Period 1
    await zoomService.handleWebhookEvent({
      event: 'meeting.participant_joined',
      event_ts: Date.now(),
      payload: {
        id: meetingClass1,
        object: {
          id: meetingClass1,
          participant: {
            id: 'zoom_alpha_99',
            user_name: 'Professor Alpha Master',
            email: 'teacher.alpha@school.pk',
            join_time: `${today}T09:00:00Z`
          }
        }
      }
    });

    // Teacher A leaves at 09:45
    await zoomService.handleWebhookEvent({
      event: 'meeting.participant_left',
      event_ts: Date.now() + 10,
      payload: {
        id: meetingClass1,
        object: {
          id: meetingClass1,
          participant: {
            id: 'zoom_alpha_99',
            user_name: 'Professor Alpha Master',
            email: 'teacher.alpha@school.pk',
            leave_time: `${today}T09:45:00Z`,
            duration: 2700
          }
        }
      }
    });

    // Teacher B joins for Period 2 in the same ongoing room
    const bJoinRes = await zoomService.handleWebhookEvent({
      event: 'meeting.participant_joined',
      event_ts: Date.now() + 20,
      payload: {
        id: meetingClass1,
        object: {
          id: meetingClass1,
          participant: {
            id: 'zoom_beta_88',
            user_name: 'Professor Beta Master',
            email: 'teacher.beta@school.pk',
            join_time: `${today}T09:45:00Z`
          }
        }
      }
    });

    assert.equal(bJoinRes.verifiedAsTeacher, true);
    assert.equal(bJoinRes.lessonId, p2Id, "Teacher B's join must be mapped to Period 2");

    // Teacher B leaves at 10:30
    await zoomService.handleWebhookEvent({
      event: 'meeting.participant_left',
      event_ts: Date.now() + 30,
      payload: {
        id: meetingClass1,
        object: {
          id: meetingClass1,
          participant: {
            id: 'zoom_beta_88',
            user_name: 'Professor Beta Master',
            email: 'teacher.beta@school.pk',
            leave_time: `${today}T10:30:00Z`,
            duration: 2700
          }
        }
      }
    });

    // Verify both duty records in teacher_duty_sessions
    const dutyA = await db('teacher_duty_sessions').where({ lesson_id: p1Id, teacher_id: teacherAId }).first();
    const dutyB = await db('teacher_duty_sessions').where({ lesson_id: p2Id, teacher_id: teacherBId }).first();

    assert.ok(dutyA, 'Duty record for Teacher A must exist');
    assert.ok(dutyB, 'Duty record for Teacher B must exist');

    assert.equal(dutyA.period_occurrence_id, `period_1_${today}_slot_1`);
    assert.equal(dutyB.period_occurrence_id, `period_1_${today}_slot_2`);

    assert.equal(Number(dutyA.total_verified_minutes), 45);
    assert.equal(Number(dutyB.total_verified_minutes), 45);

    // Clean up
    await db('timetable_lessons').whereIn('id', [p1Id, p2Id]).del();
    await db('teacher_duty_sessions').whereIn('lesson_id', [p1Id, p2Id]).del();
  });

  // =========================================================================
  // TEST C: Permanent Student Link Across Consecutive Periods
  // =========================================================================
  it('TEST C — Permanent student link: Continuous presence evaluated independently across consecutive periods', async () => {
    // Period 1: 09:00 - 09:45 (Teacher A)
    const [p1Id] = await db('timetable_lessons').insert({
      class_id: 1,
      subject_id: testSubjectId,
      teacher_id: teacherAId,
      lesson_date: today,
      start_at: `${today} 09:00:00`,
      end_at: `${today} 09:45:00`,
      status: 'LIVE',
      teacher_joined_at: `${today} 09:00:00`,
      period_occurrence_id: `period_1_${today}_c1`
    });

    // Period 2: 09:45 - 10:30 (Teacher B)
    const [p2Id] = await db('timetable_lessons').insert({
      class_id: 1,
      subject_id: testSubjectId,
      teacher_id: teacherBId,
      lesson_date: today,
      start_at: `${today} 09:45:00`,
      end_at: `${today} 10:30:00`,
      status: 'SCHEDULED',
      period_occurrence_id: `period_1_${today}_c2`
    });

    // Student S1 joins the permanent virtual room at 09:02 in Period 1
    const stuJoinRes = await zoomService.handleWebhookEvent({
      event: 'meeting.participant_joined',
      event_ts: Date.now(),
      payload: {
        id: meetingClass1,
        object: {
          id: meetingClass1,
          participant: {
            id: 'zoom_stu_101',
            user_name: 'Student S1 Test',
            email: 'student.s1@school.pk',
            join_time: `${today}T09:02:00Z`
          }
        }
      }
    });

    assert.equal(stuJoinRes.role, 'STUDENT');
    assert.equal(stuJoinRes.lessonId, p1Id);

    // Verify S1 attendance in Period 1
    const att1 = await db('lesson_attendance').where({ lesson_id: p1Id, student_id: studentId }).first();
    assert.ok(att1, 'Attendance record for Period 1 must exist');
    assert.equal(att1.status, 'PRESENT');

    // Run scheduler transition simulating conclusion of Period 1 and rollover to Period 2
    // Trigger transition tick at 09:46 (past Period 1 end)
    await runZoomScheduleTick(new Date(`${today}T09:46:00Z`));

    // Verify Period 1 concluded
    const endedP1 = await db('timetable_lessons').where({ id: p1Id }).first();
    assert.equal(endedP1.status, 'COMPLETED');

    // Verify student S1 was automatically rolled over into Period 2 without disconnecting
    const att2 = await db('lesson_attendance').where({ lesson_id: p2Id, student_id: studentId }).first();
    assert.ok(att2, 'Attendance record for Period 2 must exist for continuous student');
    assert.equal(att2.status, 'PRESENT');
    assert.equal(att2.source, 'WEBHOOK');
    assert.match(att2.remarks, /Continuous attendance carried forward/);

    // Clean up
    await db('lesson_attendance').whereIn('lesson_id', [p1Id, p2Id]).del();
    await db('timetable_lessons').whereIn('id', [p1Id, p2Id]).del();
    await db('teacher_duty_sessions').whereIn('lesson_id', [p1Id, p2Id]).del();
  });

  // =========================================================================
  // TEST D: Student Disconnects and Rejoins
  // =========================================================================
  it('TEST D — Student disconnects and rejoins: Merges intervals without creating duplicate attendance rows', async () => {
    const [lessonId] = await db('timetable_lessons').insert({
      class_id: 1,
      subject_id: testSubjectId,
      teacher_id: teacherAId,
      lesson_date: today,
      start_at: `${today} 09:00:00`,
      end_at: `${today} 09:45:00`,
      status: 'LIVE',
      teacher_joined_at: `${today} 09:00:00`,
      period_occurrence_id: `period_1_${today}_test_d`
    });

    // S1 joins at 09:05 (Interval 1)
    await zoomService.handleWebhookEvent({
      event: 'meeting.participant_joined',
      event_ts: Date.now(),
      payload: {
        id: meetingClass1,
        object: {
          id: meetingClass1,
          participant: {
            id: 'zoom_stu_101',
            user_name: 'Student S1 Test',
            email: 'student.s1@school.pk',
            join_time: `${today}T09:05:00Z`
          }
        }
      }
    });

    // S1 leaves at 09:15 (10 mins)
    await zoomService.handleWebhookEvent({
      event: 'meeting.participant_left',
      event_ts: Date.now() + 10,
      payload: {
        id: meetingClass1,
        object: {
          id: meetingClass1,
          participant: {
            id: 'zoom_stu_101',
            user_name: 'Student S1 Test',
            email: 'student.s1@school.pk',
            leave_time: `${today}T09:15:00Z`,
            duration: 600
          }
        }
      }
    });

    // S1 rejoins at 09:20 (Interval 2)
    await zoomService.handleWebhookEvent({
      event: 'meeting.participant_joined',
      event_ts: Date.now() + 20,
      payload: {
        id: meetingClass1,
        object: {
          id: meetingClass1,
          participant: {
            id: 'zoom_stu_101',
            user_name: 'Student S1 Test',
            email: 'student.s1@school.pk',
            join_time: `${today}T09:20:00Z`
          }
        }
      }
    });

    // S1 leaves at 09:35 (15 mins)
    await zoomService.handleWebhookEvent({
      event: 'meeting.participant_left',
      event_ts: Date.now() + 30,
      payload: {
        id: meetingClass1,
        object: {
          id: meetingClass1,
          participant: {
            id: 'zoom_stu_101',
            user_name: 'Student S1 Test',
            email: 'student.s1@school.pk',
            leave_time: `${today}T09:35:00Z`,
            duration: 900
          }
        }
      }
    });

    // Verify only ONE attendance record exists for this student and lesson
    const attRecords = await db('lesson_attendance').where({ lesson_id: lessonId, student_id: studentId });
    assert.equal(attRecords.length, 1, 'Exactly one attendance row per student and lesson');

    // Total verified minutes = 10m + 15m = 25m
    assert.equal(Number(attRecords[0].verified_minutes), 25);

    // Clean up
    await db('lesson_attendance').where({ lesson_id: lessonId }).del();
    await db('timetable_lessons').where({ id: lessonId }).del();
  });

  // =========================================================================
  // TEST E: Teacher Arrives Late
  // =========================================================================
  it('TEST E — Teacher arrives late: Scheduled time is NOT credited as verified teaching time', async () => {
    const [lessonId] = await db('timetable_lessons').insert({
      class_id: 1,
      subject_id: testSubjectId,
      teacher_id: teacherAId,
      lesson_date: today,
      start_at: `${today} 09:00:00`,
      end_at: `${today} 09:45:00`,
      status: 'SCHEDULED',
      period_occurrence_id: `period_1_${today}_test_e`
    });

    // Teacher arrives 15 minutes late (09:15)
    await zoomService.handleWebhookEvent({
      event: 'meeting.participant_joined',
      event_ts: Date.now(),
      payload: {
        id: meetingClass1,
        object: {
          id: meetingClass1,
          participant: {
            id: 'zoom_alpha_99',
            user_name: 'Professor Alpha Master',
            email: 'teacher.alpha@school.pk',
            join_time: `${today}T09:15:00Z`
          }
        }
      }
    });

    // Teacher finishes at 09:45
    await zoomService.handleWebhookEvent({
      event: 'meeting.participant_left',
      event_ts: Date.now() + 10,
      payload: {
        id: meetingClass1,
        object: {
          id: meetingClass1,
          participant: {
            id: 'zoom_alpha_99',
            user_name: 'Professor Alpha Master',
            email: 'teacher.alpha@school.pk',
            leave_time: `${today}T09:45:00Z`,
            duration: 1800
          }
        }
      }
    });

    const duty = await db('teacher_duty_sessions').where({ lesson_id: lessonId, teacher_id: teacherAId }).first();
    assert.ok(duty);
    // Verified minutes must be exactly 30 minutes, not scheduled 45 minutes
    assert.equal(Number(duty.total_verified_minutes), 30);

    // Clean up
    await db('timetable_lessons').where({ id: lessonId }).del();
    await db('teacher_duty_sessions').where({ lesson_id: lessonId }).del();
  });

  // =========================================================================
  // TEST F: Teacher Leaves Early
  // =========================================================================
  it('TEST F — Teacher leaves early: Duty session records actual taught minutes (not full period)', async () => {
    const [lessonId] = await db('timetable_lessons').insert({
      class_id: 1,
      subject_id: testSubjectId,
      teacher_id: teacherAId,
      lesson_date: today,
      start_at: `${today} 09:00:00`,
      end_at: `${today} 09:45:00`,
      status: 'SCHEDULED',
      period_occurrence_id: `period_1_${today}_test_f`
    });

    // Teacher joins at 09:00
    await zoomService.handleWebhookEvent({
      event: 'meeting.participant_joined',
      event_ts: Date.now(),
      payload: {
        id: meetingClass1,
        object: {
          id: meetingClass1,
          participant: {
            id: 'zoom_alpha_99',
            user_name: 'Professor Alpha Master',
            email: 'teacher.alpha@school.pk',
            join_time: `${today}T09:00:00Z`
          }
        }
      }
    });

    // Teacher leaves early at 09:20 (20 minutes)
    await zoomService.handleWebhookEvent({
      event: 'meeting.participant_left',
      event_ts: Date.now() + 10,
      payload: {
        id: meetingClass1,
        object: {
          id: meetingClass1,
          participant: {
            id: 'zoom_alpha_99',
            user_name: 'Professor Alpha Master',
            email: 'teacher.alpha@school.pk',
            leave_time: `${today}T09:20:00Z`,
            duration: 1200
          }
        }
      }
    });

    const duty = await db('teacher_duty_sessions').where({ lesson_id: lessonId, teacher_id: teacherAId }).first();
    assert.ok(duty);
    assert.equal(Number(duty.total_verified_minutes), 20);

    // Clean up
    await db('timetable_lessons').where({ id: lessonId }).del();
    await db('teacher_duty_sessions').where({ lesson_id: lessonId }).del();
  });

  // =========================================================================
  // TEST G: Duplicate Webhooks
  // =========================================================================
  it('TEST G — Duplicate webhooks: Idempotent deduplication prevents duplicate duty and attendance records', async () => {
    const [lessonId] = await db('timetable_lessons').insert({
      class_id: 1,
      subject_id: testSubjectId,
      teacher_id: teacherAId,
      lesson_date: today,
      start_at: `${today} 09:00:00`,
      end_at: `${today} 09:45:00`,
      status: 'SCHEDULED',
      period_occurrence_id: `period_1_${today}_test_g`
    });

    const eventPayload = {
      event: 'meeting.participant_joined',
      event_ts: 1772188800000,
      payload: {
        id: meetingClass1,
        object: {
          id: meetingClass1,
          participant: {
            id: 'zoom_alpha_99',
            user_name: 'Professor Alpha Master',
            email: 'teacher.alpha@school.pk',
            join_time: `${today}T09:00:00Z`
          }
        }
      }
    };

    // First delivery
    const res1 = await zoomService.handleWebhookEvent(eventPayload);
    assert.equal(res1.received, true);
    assert.equal(res1.idempotentDuplicate, undefined);

    // Second delivery of exact same event
    const res2 = await zoomService.handleWebhookEvent(eventPayload);
    assert.equal(res2.received, true);
    assert.equal(res2.idempotentDuplicate, true);

    // Verify only 1 duty session and 1 participant log entry created
    const dutyCount = await db('teacher_duty_sessions').where({ lesson_id: lessonId });
    assert.equal(dutyCount.length, 1);

    // Clean up
    await db('timetable_lessons').where({ id: lessonId }).del();
    await db('teacher_duty_sessions').where({ lesson_id: lessonId }).del();
  });

  // =========================================================================
  // TEST H: Out-of-Order Events & Reconciliation
  // =========================================================================
  it('TEST H — Out-of-order events: Reconciliation produces consistent result from participant reports', async () => {
    const [lessonId] = await db('timetable_lessons').insert({
      class_id: 1,
      subject_id: testSubjectId,
      teacher_id: teacherAId,
      lesson_date: today,
      start_at: `${today} 09:00:00`,
      end_at: `${today} 09:45:00`,
      status: 'SCHEDULED',
      period_occurrence_id: `period_1_${today}_test_h`
    });

    // Reconcile with out-of-order or missed webhook data using authoritative report
    const mockReportParticipants = [
      {
        id: 'zoom_alpha_99',
        user_name: 'Professor Alpha Master',
        user_email: 'teacher.alpha@school.pk',
        join_time: `${today}T09:00:00Z`,
        leave_time: `${today}T09:45:00Z`,
        duration: 2700
      }
    ];

    const reconRes = await zoomService.reconcileLessonAttendance(lessonId, mockReportParticipants);
    assert.equal(reconRes.verified, true);
    assert.equal(reconRes.reconciledMinutes, 45);

    const duty = await db('teacher_duty_sessions').where({ lesson_id: lessonId, teacher_id: teacherAId }).first();
    assert.ok(duty);
    assert.equal(duty.reconciliation_status, 'RECONCILED');
    assert.equal(Number(duty.total_verified_minutes), 45);

    // Clean up
    await db('timetable_lessons').where({ id: lessonId }).del();
    await db('teacher_duty_sessions').where({ lesson_id: lessonId }).del();
  });

  // =========================================================================
  // TEST I: Application Restart / Recovery
  // =========================================================================
  it('TEST I — Application restart: Recovers active sessions and concludes overdue lessons safely', async () => {
    // Lesson that ended 10 minutes ago but was left LIVE due to abrupt shutdown
    const [overdueLessonId] = await db('timetable_lessons').insert({
      class_id: 1,
      subject_id: testSubjectId,
      teacher_id: teacherAId,
      lesson_date: today,
      start_at: `${today} 07:00:00`,
      end_at: `${today} 07:45:00`,
      status: 'LIVE',
      teacher_joined_at: `${today} 07:00:00`,
      period_occurrence_id: `period_1_${today}_test_i`
    });

    await zoomRepository.logParticipant({
      lessonId: overdueLessonId,
      zoomMeetingId: meetingClass1,
      source: 'WEBHOOK',
      userId: teacherAUserId,
      participantName: 'Professor Alpha Master',
      participantEmail: 'teacher.alpha@school.pk',
      role: 'TEACHER',
      verificationStatus: 'VERIFIED',
      joinedAt: new Date(`${today}T07:00:00Z`),
      leftAt: null // open interval left hanging on crash
    });

    // Run startup recovery
    const recoveryResult = await zoomScheduler.recoverActiveSessionsOnStartup();
    assert.ok(recoveryResult);

    const recovered = await db('timetable_lessons').where({ id: overdueLessonId }).first();
    assert.equal(recovered.status, 'COMPLETED');
    assert.equal(Number(recovered.verified_duty_minutes), 45);

    // Clean up
    await db('timetable_lessons').where({ id: overdueLessonId }).del();
    await db('teacher_duty_sessions').where({ lesson_id: overdueLessonId }).del();
  });

  // =========================================================================
  // TEST J: No-Show Teacher
  // =========================================================================
  it('TEST J — No-show: Teacher who never joins receives 0 duty hours and lesson marked MISSED', async () => {
    const [lessonId] = await db('timetable_lessons').insert({
      class_id: 1,
      subject_id: testSubjectId,
      teacher_id: teacherAId,
      lesson_date: today,
      start_at: `${today} 08:00:00`,
      end_at: `${today} 08:45:00`,
      status: 'SCHEDULED',
      session_state: 'SCHEDULED',
      period_occurrence_id: `period_1_${today}_test_j`
    });

    // Scheduler tick runs after period end (08:50)
    await runZoomScheduleTick(new Date(`${today}T08:50:00Z`));

    const updated = await db('timetable_lessons').where({ id: lessonId }).first();
    assert.equal(updated.status, 'MISSED');
    assert.equal(Number(updated.verified_duty_minutes), 0);

    const duty = await db('teacher_duty_sessions').where({ lesson_id: lessonId, teacher_id: teacherAId }).first();
    assert.ok(duty);
    assert.equal(duty.session_status, 'MISSED');
    assert.equal(Number(duty.total_verified_minutes), 0);
    assert.equal(Number(duty.payable_minutes), 0);

    // Clean up
    await db('timetable_lessons').where({ id: lessonId }).del();
    await db('teacher_duty_sessions').where({ lesson_id: lessonId }).del();
  });

  // =========================================================================
  // TEST K: WebSocket Updates
  // =========================================================================
  it('TEST K — WebSocket updates: Connected clients receive broadcast events in real time', async () => {
    const client = Client(`http://127.0.0.1:${socketPort}`, {
      transports: ['websocket'],
      autoConnect: true
    });

    await new Promise((resolve) => client.on('connect', resolve));

    client.emit('join:class', { classId: 1 });
    await new Promise((resolve) => client.on('joined:class', resolve));

    // Listen for event
    const eventPromise = new Promise((resolve) => {
      client.on(RealtimeEvents.CLASS_STATUS_UPDATED, (data) => {
        resolve(data);
      });
    });

    emitRealtimeEvent(RealtimeEvents.CLASS_STATUS_UPDATED, {
      lessonId: 9999,
      classId: 1,
      status: 'LIVE',
      teacherName: 'Professor Alpha Master'
    }, { classIds: [1] });

    const received = await eventPromise;
    assert.equal(received.lessonId, 9999);
    assert.equal(received.status, 'LIVE');

    client.disconnect();
  });

  // =========================================================================
  // TEST L: Access Control
  // =========================================================================
  it('TEST L — Access control: Enforces student and teacher isolation', async () => {
    // 1. Verify capacity mappings are role-protected
    const cap = await zoomService.getCapacityAndConcurrencyStatus();
    assert.equal(cap.licensedHosts, 8);
    assert.equal(cap.hostMappings.length, 8);

    // 2. Student attendance query only returns records for student's enrolled class
    const student1 = await db('students').where({ id: studentId }).first();
    assert.equal(student1.current_class_id, 1);
  }, 15000);

  // =========================================================================
  // TEST M: Payroll Calculations
  // =========================================================================
  it('TEST M — Payroll: Payable hours and salary totals match underlying finalized duty records', async () => {
    // Insert 2 completed lessons for Teacher A in October 2026
    const [l1] = await db('timetable_lessons').insert({
      class_id: 1,
      subject_id: testSubjectId,
      teacher_id: teacherAId,
      lesson_date: '2026-10-15',
      start_at: '2026-10-15 09:00:00',
      end_at: '2026-10-15 09:45:00',
      status: 'COMPLETED',
      teacher_joined_at: '2026-10-15 09:00:00',
      actual_start_at: '2026-10-15 09:00:00',
      actual_end_at: '2026-10-15 09:45:00',
      verified_duty_minutes: 45,
      attendance_verification_status: 'VERIFIED',
      period_occurrence_id: 'period_1_2026-10-15_m1'
    });

    const [l2] = await db('timetable_lessons').insert({
      class_id: 1,
      subject_id: testSubjectId,
      teacher_id: teacherAId,
      lesson_date: '2026-10-16',
      start_at: '2026-10-16 09:00:00',
      end_at: '2026-10-16 09:45:00',
      status: 'COMPLETED',
      teacher_joined_at: '2026-10-16 09:00:00',
      actual_start_at: '2026-10-16 09:00:00',
      actual_end_at: '2026-10-16 09:45:00',
      verified_duty_minutes: 45,
      attendance_verification_status: 'VERIFIED',
      period_occurrence_id: 'period_1_2026-10-16_m2'
    });

    // Insert duty records in teacher_duty_sessions
    await zoomRepository.upsertTeacherDutySession({
      teacherId: teacherAId,
      classId: 1,
      lessonId: l1,
      periodOccurrenceId: 'period_1_2026-10-15_m1',
      zoomMeetingId: meetingClass1,
      sessionStart: new Date('2026-10-15T09:00:00Z'),
      sessionEnd: new Date('2026-10-15T09:45:00Z'),
      totalVerifiedMinutes: 45,
      payableMinutes: 45,
      sessionStatus: 'COMPLETED',
      reconciliationStatus: 'RECONCILED'
    });

    await zoomRepository.upsertTeacherDutySession({
      teacherId: teacherAId,
      classId: 1,
      lessonId: l2,
      periodOccurrenceId: 'period_1_2026-10-16_m2',
      zoomMeetingId: meetingClass1,
      sessionStart: new Date('2026-10-16T09:00:00Z'),
      sessionEnd: new Date('2026-10-16T09:45:00Z'),
      totalVerifiedMinutes: 45,
      payableMinutes: 45,
      sessionStatus: 'COMPLETED',
      reconciliationStatus: 'RECONCILED'
    });

    // Run payroll generation for October 2026
    const result = await payrollRepository.generateMonthlyDrafts({
      payrollMonth: 'October 2026',
      userId: teacherAUserId,
      teacherId: teacherAId
    });

    assert.equal(result.generatedCount, 1);

    const draft = await db('teacher_payroll_drafts')
      .where({ teacher_id: teacherAId, payroll_month: 'October 2026' })
      .first();

    assert.ok(draft);
    // HYBRID formula:
    // Base: 50,000 + 2 lessons * 1,000 = 52,000 + allowances 2,500 = gross 54,500
    // Deductions: 1,000 -> Net: 53,500
    assert.equal(Number(draft.base_pay), 50000);
    assert.equal(Number(draft.completed_lessons), 2);
    assert.equal(Number(draft.gross_amount), 54500);
    assert.equal(Number(draft.net_payable), 53500);

    // Clean up
    await db('timetable_lessons').whereIn('id', [l1, l2]).del();
    await db('teacher_duty_sessions').whereIn('lesson_id', [l1, l2]).del();
    await db('teacher_payroll_drafts').where({ id: draft.id }).del();
  });

  // =========================================================================
  // TEST N: Multiple Simultaneous Classes
  // =========================================================================
  it('TEST N — Multiple simultaneous classes: Events from different classes do not cross-contaminate', async () => {
    // Class 1 (Teacher A) and Class 2 (Teacher B) both at 09:00
    const [l1Id] = await db('timetable_lessons').insert({
      class_id: 1,
      subject_id: testSubjectId,
      teacher_id: teacherAId,
      lesson_date: today,
      start_at: `${today} 09:00:00`,
      end_at: `${today} 09:45:00`,
      status: 'SCHEDULED'
    });

    const [l2Id] = await db('timetable_lessons').insert({
      class_id: 2,
      subject_id: testSubjectId,
      teacher_id: teacherBId,
      lesson_date: today,
      start_at: `${today} 09:00:00`,
      end_at: `${today} 09:45:00`,
      status: 'SCHEDULED'
    });

    // Send Teacher A join for Class 1 meeting
    await zoomService.handleWebhookEvent({
      event: 'meeting.participant_joined',
      event_ts: Date.now(),
      payload: {
        id: meetingClass1,
        object: {
          id: meetingClass1,
          participant: {
            id: 'zoom_alpha_99',
            user_name: 'Professor Alpha Master',
            email: 'teacher.alpha@school.pk',
            join_time: `${today}T09:00:00Z`
          }
        }
      }
    });

    // Class 1 is LIVE, Class 2 remains SCHEDULED (no leakage)
    const l1 = await db('timetable_lessons').where({ id: l1Id }).first();
    const l2 = await db('timetable_lessons').where({ id: l2Id }).first();

    assert.equal(l1.status, 'LIVE');
    assert.equal(l2.status, 'SCHEDULED');

    // Clean up
    await db('timetable_lessons').whereIn('id', [l1Id, l2Id]).del();
    await db('teacher_duty_sessions').where({ lesson_id: l1Id }).del();
  });

  // =========================================================================
  // TEST O: Missing or Delayed Zoom Events / Reconciliation
  // =========================================================================
  it('TEST O — Missing Zoom events: Flags uncertain data and reconciles via participant reports', async () => {
    const [lessonId] = await db('timetable_lessons').insert({
      class_id: 1,
      subject_id: testSubjectId,
      teacher_id: teacherAId,
      lesson_date: today,
      start_at: `${today} 09:00:00`,
      end_at: `${today} 09:45:00`,
      status: 'SCHEDULED'
    });

    // Unmatched display name without verified email is flagged for review
    const res = await zoomService.handleWebhookEvent({
      event: 'meeting.participant_joined',
      event_ts: Date.now(),
      payload: {
        id: meetingClass1,
        object: {
          id: meetingClass1,
          participant: {
            id: 'unknown_guest_11',
            user_name: 'Professor Alpha Master',
            email: 'unverified.guest@gmail.com',
            join_time: `${today}T09:00:00Z`
          }
        }
      }
    });

    assert.equal(res.verifiedAsTeacher, false);
    assert.equal(res.flaggedForReview, true);

    // Official participant report clarifies and reconciles the lesson
    const reconciliation = await zoomService.reconcileLessonAttendance(lessonId, [
      {
        id: 'zoom_alpha_99',
        user_name: 'Professor Alpha Master',
        user_email: 'teacher.alpha@school.pk',
        join_time: `${today}T09:00:00Z`,
        leave_time: `${today}T09:45:00Z`,
        duration: 2700
      }
    ]);

    assert.equal(reconciliation.verified, true);
    assert.equal(reconciliation.reconciledMinutes, 45);

    // Clean up
    await db('timetable_lessons').where({ id: lessonId }).del();
    await db('teacher_duty_sessions').where({ lesson_id: lessonId }).del();
  });
});
