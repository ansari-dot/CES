import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { db } from '../src/shared/db/knex.js';
import { zoomService } from '../src/modules/zoom/zoom.service.js';
import { zoomRepository } from '../src/modules/zoom/zoom.repository.js';
import { zoomApiClient } from '../src/shared/services/zoomApiClient.js';
import { payrollRepository } from '../src/modules/payroll/payroll.repository.js';
import { mergeIntervals, calculateLessonVerifiedDuty, calculateTeacherPeriodDuty, parsePayrollMonthRange } from '../src/shared/utils/dutyCalculation.js';

describe('Class-Based Zoom Hosting, Automatic Teacher Duty & Payroll Integration', () => {
  // Test entities
  let teacherAUserId, teacherAId;
  let teacherBUserId, teacherBId;
  let testSubjectId;
  const classes = [1, 2, 3, 4, 5, 6, 7, 8];
  const meetingIds = {
    1: '9881001001',
    2: '9882002002',
    3: '9883003003'
  };

  beforeAll(async () => {
    // 1. Clean existing test artifacts if any
    await db('users').whereIn('username', ['test_prof_alpha', 'test_prof_beta']).del().catch(() => {});

    // 2. Create Teacher A (teaches Class 1 and Class 3)
    const [uIdA] = await db('users').insert({
      username: 'test_prof_alpha',
      email: 'teacher.alpha@school.pk',
      full_name: 'Professor Alpha',
      password_hash: 'hash',
      role_id: 3,
      status: 'ACTIVE'
    });
    teacherAUserId = uIdA;

    const [tIdA] = await db('teachers').insert({
      user_id: uIdA,
      employee_no: 'TCH-ALPHA-01',
      designation: 'Senior Faculty',
      employment_status: 'ACTIVE',
      joining_date: '2026-01-01',
      zoom_email: 'teacher.alpha@school.pk',
      zoom_user_id: 'zoom_usr_alpha_123'
    });
    teacherAId = tIdA;

    // Set Salary Profile for Teacher A: PER_HOUR (Rs. 2,000 / hr)
    await db('teacher_salary_profiles').insert({
      teacher_id: tIdA,
      model: 'PER_HOUR',
      base_amount: 0,
      per_hour_rate: 2000,
      per_lesson_rate: 1500,
      rules: JSON.stringify({ allowances: 1000, standardDeductions: 200 }),
      effective_from: '2026-01-01'
    });

    // 3. Create Teacher B (teaches Class 2 simultaneously with Class 1)
    const [uIdB] = await db('users').insert({
      username: 'test_prof_beta',
      email: 'teacher.beta@school.pk',
      full_name: 'Professor Beta',
      password_hash: 'hash',
      role_id: 3,
      status: 'ACTIVE'
    });
    teacherBUserId = uIdB;

    const [tIdB] = await db('teachers').insert({
      user_id: uIdB,
      employee_no: 'TCH-BETA-02',
      designation: 'Faculty',
      employment_status: 'ACTIVE',
      joining_date: '2026-01-01',
      zoom_email: 'teacher.beta@school.pk',
      zoom_user_id: 'zoom_usr_beta_456'
    });
    teacherBId = tIdB;

    // Set Salary Profile for Teacher B: HYBRID (Rs. 40,000 base + Rs. 1,000/lesson)
    await db('teacher_salary_profiles').insert({
      teacher_id: tIdB,
      model: 'HYBRID',
      base_amount: 40000,
      per_hour_rate: 1000,
      per_lesson_rate: 1000,
      rules: JSON.stringify({ allowances: 2000, standardDeductions: 1000 }),
      effective_from: '2026-01-01'
    });

    // 4. Get subject
    const sub = await db('subjects').first();
    testSubjectId = sub.id;

    // 5. Configure 8 Classrooms mapped to 8 separately licensed Zoom hosts
    for (const c of classes) {
      await db('zoom_meetings').where({ class_id: c }).del();
      await zoomRepository.configureClassMeeting({
        classId: c,
        zoomMeetingId: meetingIds[c] || `988${c}00${c}00${c}`,
        topic: `Class ${c} Official Virtual Classroom`,
        joinUrl: `https://zoom.us/j/${meetingIds[c] || `988${c}00${c}00${c}`}`,
        passcode: `CLASS${c}#`,
        hostZoomUserId: `zoom_host_lic_${c}`,
        hostEmail: `zoom.host.class${c}@school.pk`,
        hostName: `Class ${c} Licensed Host Identity`,
        concurrencySlot: c,
        configNotes: `Permanent virtual room for Class ${c}`
      });
    }
  });

  afterAll(async () => {
    // Clean up test data
    const tIds = [teacherAId, teacherBId].filter(Boolean);
    if (tIds.length > 0) {
      await db('teacher_duty_sessions').whereIn('teacher_id', tIds).del().catch(() => {});
      await db('teacher_payroll_drafts').whereIn('teacher_id', tIds).del().catch(() => {});
      await db('teacher_salary_profiles').whereIn('teacher_id', tIds).del().catch(() => {});
      await db('timetable_lessons').whereIn('teacher_id', tIds).del().catch(() => {});
      await db('zoom_events').whereIn('zoom_meeting_id', Object.values(meetingIds)).del().catch(() => {});
      await db('teachers').whereIn('id', tIds).del().catch(() => {});
    }
    const uIds = [teacherAUserId, teacherBUserId].filter(Boolean);
    if (uIds.length > 0) {
      await db('audit_logs').whereIn('actor_id', uIds).del().catch(() => {});
      await db('users').whereIn('id', uIds).del().catch(() => {});
    }
  });

  it('1. Verifies 8 permanent virtual classrooms mapped to 8 separately licensed Zoom hosts', async () => {
    const status = await zoomService.getCapacityAndConcurrencyStatus();
    assert.equal(status.licensedHosts, 8);
    assert.equal(status.concurrencyCapacity, 8);
    assert.equal(status.simultaneousLessonsSupported, 8);
    assert.equal(status.hostMappings.length, 8);

    // Each class must have distinct licensed host identity
    const hostEmails = status.hostMappings.map((m) => m.hostEmail);
    const uniqueEmails = new Set(hostEmails);
    assert.equal(uniqueEmails.size, 8, 'Each class must have its own distinct licensed Zoom host account');

    const class1 = status.hostMappings.find((m) => m.classId === 1);
    assert.equal(class1.hostEmail, 'zoom.host.class1@school.pk');
    assert.equal(class1.concurrencySlot, 1);
  }, 25000);

  it('2. Distinguishes permanent classroom host from assigned teacher (zero duty credited to classroom host)', async () => {
    const today = new Date().toISOString().split('T')[0];

    // Create a lesson for Class 1 with Teacher A
    const [lessonId] = await db('timetable_lessons').insert({
      class_id: 1,
      subject_id: testSubjectId,
      teacher_id: teacherAId,
      lesson_date: today,
      start_at: `${today} 09:00:00`,
      end_at: `${today} 09:45:00`,
      status: 'SCHEDULED'
    });

    // Classroom host account joins the meeting (e.g. permanent room open)
    const hostJoinRes = await zoomService.handleWebhookEvent({
      event: 'meeting.participant_joined',
      event_ts: Date.now(),
      payload: {
        id: meetingIds[1],
        object: {
          id: meetingIds[1],
          participant: {
            id: 'zoom_host_lic_1',
            user_name: 'Class 1 Licensed Host Identity',
            email: 'zoom.host.class1@school.pk',
            join_time: `${today}T08:50:00Z`
          }
        }
      }
    });

    assert.equal(hostJoinRes.role, 'CLASSROOM_HOST');
    assert.equal(hostJoinRes.verifiedAsTeacher, false);

    // Verify lesson is NOT marked LIVE and Teacher A is not credited
    const checkLesson = await db('timetable_lessons').where({ id: lessonId }).first();
    assert.equal(checkLesson.status, 'SCHEDULED');
    assert.equal(checkLesson.teacher_joined_at, null);

    // Clean up
    await db('timetable_lessons').where({ id: lessonId }).del();
  });

  it('3. Supports simultaneous lessons in different classes (Class 1 & Class 2 running at 09:00)', async () => {
    const today = new Date().toISOString().split('T')[0];

    // Lesson 1: Class 1, Teacher A at 09:00
    const [lesson1Id] = await db('timetable_lessons').insert({
      class_id: 1,
      subject_id: testSubjectId,
      teacher_id: teacherAId,
      lesson_date: today,
      start_at: `${today} 09:00:00`,
      end_at: `${today} 09:45:00`,
      status: 'SCHEDULED'
    });

    // Lesson 2: Class 2, Teacher B at 09:00 (simultaneous)
    const [lesson2Id] = await db('timetable_lessons').insert({
      class_id: 2,
      subject_id: testSubjectId,
      teacher_id: teacherBId,
      lesson_date: today,
      start_at: `${today} 09:00:00`,
      end_at: `${today} 09:45:00`,
      status: 'SCHEDULED'
    });

    // Concurrent Teacher A join on Class 1 Zoom Room
    await zoomService.handleWebhookEvent({
      event: 'meeting.participant_joined',
      event_ts: Date.now(),
      payload: {
        id: meetingIds[1],
        object: {
          id: meetingIds[1],
          participant: {
            id: 'zoom_usr_alpha_123',
            user_name: 'Professor Alpha',
            email: 'teacher.alpha@school.pk',
            join_time: `${today}T09:01:00Z`
          }
        }
      }
    });

    // Concurrent Teacher B join on Class 2 Zoom Room
    await zoomService.handleWebhookEvent({
      event: 'meeting.participant_joined',
      event_ts: Date.now() + 10,
      payload: {
        id: meetingIds[2],
        object: {
          id: meetingIds[2],
          participant: {
            id: 'zoom_usr_beta_456',
            user_name: 'Professor Beta',
            email: 'teacher.beta@school.pk',
            join_time: `${today}T09:02:00Z`
          }
        }
      }
    });

    const l1 = await db('timetable_lessons').where({ id: lesson1Id }).first();
    const l2 = await db('timetable_lessons').where({ id: lesson2Id }).first();

    assert.equal(l1.status, 'LIVE');
    assert.equal(l2.status, 'LIVE');
    assert.ok(l1.teacher_joined_at);
    assert.ok(l2.teacher_joined_at);

    // Clean up
    await db('timetable_lessons').whereIn('id', [lesson1Id, lesson2Id]).del();
  });

  it('4. Supports one teacher teaching multiple classes at different times (Teacher A in Class 1 @ 09:00 & Class 3 @ 11:00)', async () => {
    const today = new Date().toISOString().split('T')[0];

    // Period 1: Teacher A in Class 1 (09:00 - 09:45)
    const [p1Id] = await db('timetable_lessons').insert({
      class_id: 1,
      subject_id: testSubjectId,
      teacher_id: teacherAId,
      lesson_date: today,
      start_at: `${today} 09:00:00`,
      end_at: `${today} 09:45:00`,
      status: 'SCHEDULED'
    });

    // Period 2: Teacher A in Class 3 (11:00 - 11:45)
    const [p2Id] = await db('timetable_lessons').insert({
      class_id: 3,
      subject_id: testSubjectId,
      teacher_id: teacherAId,
      lesson_date: today,
      start_at: `${today} 11:00:00`,
      end_at: `${today} 11:45:00`,
      status: 'SCHEDULED'
    });

    // Complete Period 1: Join 09:00, Leave 09:45
    await zoomService.handleWebhookEvent({
      event: 'meeting.participant_joined',
      event_ts: Date.now(),
      payload: {
        id: meetingIds[1],
        object: {
          id: meetingIds[1],
          participant: {
            id: 'zoom_usr_alpha_123',
            user_name: 'Professor Alpha',
            email: 'teacher.alpha@school.pk',
            join_time: `${today}T09:00:00Z`
          }
        }
      }
    });

    await zoomService.handleWebhookEvent({
      event: 'meeting.participant_left',
      event_ts: Date.now() + 100,
      payload: {
        id: meetingIds[1],
        object: {
          id: meetingIds[1],
          participant: {
            id: 'zoom_usr_alpha_123',
            user_name: 'Professor Alpha',
            email: 'teacher.alpha@school.pk',
            leave_time: `${today}T09:45:00Z`,
            duration: 2700
          }
        }
      }
    });

    // Complete Period 2: Join 11:00, Leave 11:45
    await zoomService.handleWebhookEvent({
      event: 'meeting.participant_joined',
      event_ts: Date.now() + 200,
      payload: {
        id: meetingIds[3],
        object: {
          id: meetingIds[3],
          participant: {
            id: 'zoom_usr_alpha_123',
            user_name: 'Professor Alpha',
            email: 'teacher.alpha@school.pk',
            join_time: `${today}T11:00:00Z`
          }
        }
      }
    });

    await zoomService.handleWebhookEvent({
      event: 'meeting.participant_left',
      event_ts: Date.now() + 300,
      payload: {
        id: meetingIds[3],
        object: {
          id: meetingIds[3],
          participant: {
            id: 'zoom_usr_alpha_123',
            user_name: 'Professor Alpha',
            email: 'teacher.alpha@school.pk',
            leave_time: `${today}T11:45:00Z`,
            duration: 2700
          }
        }
      }
    });

    // Query daily duty summary for Teacher A
    const dutySummary = await zoomService.getTeacherDailyDutySummary(teacherAId, today);
    assert.equal(dutySummary.totalCompletedLessons, 2);
    assert.equal(dutySummary.totalTrackedMinutes, 90);
    assert.equal(dutySummary.totalTrackedHours, 1.5);

    // Clean up
    await db('timetable_lessons').whereIn('id', [p1Id, p2Id]).del();
  });

  it('5. Handles teacher late arrival, temporary disconnection, and rejoining without double counting', async () => {
    const today = new Date().toISOString().split('T')[0];

    const [lessonId] = await db('timetable_lessons').insert({
      class_id: 1,
      subject_id: testSubjectId,
      teacher_id: teacherAId,
      lesson_date: today,
      start_at: `${today} 09:00:00`,
      end_at: `${today} 09:45:00`,
      status: 'SCHEDULED'
    });

    // Interval 1: Late join at 09:05, drops at 09:20 (15 minutes)
    await zoomService.handleWebhookEvent({
      event: 'meeting.participant_joined',
      event_ts: Date.now(),
      payload: {
        id: meetingIds[1],
        object: {
          id: meetingIds[1],
          participant: {
            id: 'zoom_usr_alpha_123',
            user_name: 'Professor Alpha',
            email: 'teacher.alpha@school.pk',
            join_time: `${today}T09:05:00Z`
          }
        }
      }
    });

    await zoomService.handleWebhookEvent({
      event: 'meeting.participant_left',
      event_ts: Date.now() + 10,
      payload: {
        id: meetingIds[1],
        object: {
          id: meetingIds[1],
          participant: {
            id: 'zoom_usr_alpha_123',
            user_name: 'Professor Alpha',
            email: 'teacher.alpha@school.pk',
            leave_time: `${today}T09:20:00Z`,
            duration: 900
          }
        }
      }
    });

    // Interval 2: Teacher rejoins at 09:25, concludes at 09:45 (20 minutes)
    await zoomService.handleWebhookEvent({
      event: 'meeting.participant_joined',
      event_ts: Date.now() + 20,
      payload: {
        id: meetingIds[1],
        object: {
          id: meetingIds[1],
          participant: {
            id: 'zoom_usr_alpha_123',
            user_name: 'Professor Alpha',
            email: 'teacher.alpha@school.pk',
            join_time: `${today}T09:25:00Z`
          }
        }
      }
    });

    await zoomService.handleWebhookEvent({
      event: 'meeting.participant_left',
      event_ts: Date.now() + 30,
      payload: {
        id: meetingIds[1],
        object: {
          id: meetingIds[1],
          participant: {
            id: 'zoom_usr_alpha_123',
            user_name: 'Professor Alpha',
            email: 'teacher.alpha@school.pk',
            leave_time: `${today}T09:45:00Z`,
            duration: 1200
          }
        }
      }
    });

    const logs = await zoomRepository.getParticipantLogsForLesson(lessonId);
    const lesson = await db('timetable_lessons').where({ id: lessonId }).first();

    const duty = calculateLessonVerifiedDuty({ lesson, participantLogs: logs });
    // Total connected = 15m + 20m = 35m (not full 45m meeting duration)
    assert.equal(duty.verifiedMinutes, 35);
    assert.equal(duty.intervals.length, 2);

    // Clean up
    await db('timetable_lessons').where({ id: lessonId }).del();
  });

  it('6. Flags unmatched teacher identities (display name alone without verified email)', async () => {
    // Participant enters with name "Professor Alpha" but unknown email "impostor@gmail.com"
    const res = await zoomService.handleWebhookEvent({
      event: 'meeting.participant_joined',
      event_ts: Date.now(),
      payload: {
        id: meetingIds[1],
        object: {
          id: meetingIds[1],
          participant: {
            id: 'unknown_id_999',
            user_name: 'Professor Alpha',
            email: 'impostor@gmail.com',
            join_time: new Date().toISOString()
          }
        }
      }
    });

    assert.equal(res.verifiedAsTeacher, false);
    assert.equal(res.flaggedForReview, true);

    // Verify participant was logged as FLAGGED
    const flaggedLog = await db('zoom_participant_log')
      .where({ zoom_meeting_id: meetingIds[1], verification_status: 'FLAGGED' })
      .first();
    assert.ok(flaggedLog);
    assert.match(flaggedLog.verification_reason, /Display name matched/);
  });

  it('7. Processes duplicate event deliveries idempotently', async () => {
    const fixedTs = 1774000000000;
    const payload = {
      event: 'meeting.participant_joined',
      event_ts: fixedTs,
      payload: {
        id: meetingIds[1],
        object: {
          id: meetingIds[1],
          participant: {
            id: 'zoom_usr_alpha_123',
            user_name: 'Professor Alpha',
            email: 'teacher.alpha@school.pk',
            join_time: new Date().toISOString()
          }
        }
      }
    };

    // First delivery
    const res1 = await zoomService.handleWebhookEvent(payload);
    assert.equal(res1.received, true);
    assert.equal(res1.action, 'JOIN_RECORDED');

    // Duplicate delivery with identical event_ts
    const res2 = await zoomService.handleWebhookEvent(payload);
    assert.equal(res2.received, true);
    assert.equal(res2.idempotentDuplicate, true);
  });

  it('8. Verifies webhook HMAC-SHA256 signature and rejects invalid signatures', () => {
    const secret = 'test_webhook_secret_token_12345';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const rawBody = JSON.stringify({ event: 'meeting.participant_joined' });

    const message = `v0:${timestamp}:${rawBody}`;
    const validSignature = `v0=${crypto.createHmac('sha256', secret).update(message).digest('hex')}`;

    // Valid signature passes
    const isValid = zoomApiClient.verifyWebhookSignature({
      signature: validSignature,
      timestamp,
      rawBody
    });
    assert.equal(isValid, true);

    // Invalid signature fails
    const isInvalid = zoomApiClient.verifyWebhookSignature({
      signature: 'v0=invalid_tampered_signature_hex_value',
      timestamp,
      rawBody
    });
    assert.equal(isInvalid, false);

    // Expired timestamp (> 5 minutes old) fails
    const expiredTimestamp = String(Math.floor(Date.now() / 1000) - 400);
    const expiredMsg = `v0:${expiredTimestamp}:${rawBody}`;
    const expiredSig = `v0=${crypto.createHmac('sha256', secret).update(expiredMsg).digest('hex')}`;
    const isExpired = zoomApiClient.verifyWebhookSignature({
      signature: expiredSig,
      timestamp: expiredTimestamp,
      rawBody
    });
    assert.equal(isExpired, false);
  });

  it('9. Reconciles missed events using authoritative Zoom participant report', async () => {
    const today = new Date().toISOString().split('T')[0];

    const [lessonId] = await db('timetable_lessons').insert({
      class_id: 1,
      subject_id: testSubjectId,
      teacher_id: teacherAId,
      lesson_date: today,
      start_at: `${today} 09:00:00`,
      end_at: `${today} 09:45:00`,
      status: 'SCHEDULED'
    });

    const origIsConfigured = zoomApiClient.isConfigured;
    zoomApiClient.isConfigured = () => true;
    const origGetParticipants = zoomApiClient.getMeetingParticipants;
    zoomApiClient.getMeetingParticipants = async () => [
      {
        id: 'zoom_usr_alpha_123',
        user_email: 'teacher.alpha@school.pk',
        name: 'Professor Alpha',
        join_time: `${today}T09:00:00Z`,
        leave_time: `${today}T09:45:00Z`,
        duration: 2700
      }
    ];

    try {
      const recon = await zoomService.reconcileLessonAttendance(lessonId);
      assert.equal(recon.reconciled, true);
      assert.equal(recon.teacherFound, true);
      assert.equal(recon.durationHours, 0.75);

      const updated = await db('timetable_lessons').where({ id: lessonId }).first();
      assert.equal(updated.status, 'COMPLETED');
      assert.equal(updated.attendance_verification_status, 'VERIFIED');
      assert.equal(updated.reconciliation_status, 'RECONCILED');
    } finally {
      zoomApiClient.isConfigured = origIsConfigured;
      zoomApiClient.getMeetingParticipants = origGetParticipants;
      await db('timetable_lessons').where({ id: lessonId }).del();
    }
  });

  it('10. Monthly payroll boundaries strictly filter by month and prevent double counting', async () => {
    // Clean any prior April 2026 drafts
    await db('teacher_payroll_drafts').where({ teacher_id: teacherAId, payroll_month: 'April 2026' }).del();

    // Insert completed lessons across month boundaries:
    // Lesson 1: April 10, 2026 (45 mins)
    // Lesson 2: April 12, 2026 (45 mins)
    // Lesson 3: May 02, 2026 (45 mins) - Outside April!
    await db('timetable_lessons').insert([
      {
        class_id: 1,
        subject_id: testSubjectId,
        teacher_id: teacherAId,
        lesson_date: '2026-04-10',
        start_at: '2026-04-10 09:00:00',
        end_at: '2026-04-10 09:45:00',
        actual_start_at: '2026-04-10 09:00:00',
        actual_end_at: '2026-04-10 09:45:00',
        verified_duty_minutes: 45,
        attendance_verification_status: 'VERIFIED',
        status: 'COMPLETED'
      },
      {
        class_id: 1,
        subject_id: testSubjectId,
        teacher_id: teacherAId,
        lesson_date: '2026-04-12',
        start_at: '2026-04-12 10:00:00',
        end_at: '2026-04-12 10:45:00',
        actual_start_at: '2026-04-12 10:00:00',
        actual_end_at: '2026-04-12 10:45:00',
        verified_duty_minutes: 45,
        attendance_verification_status: 'VERIFIED',
        status: 'COMPLETED'
      },
      {
        class_id: 1,
        subject_id: testSubjectId,
        teacher_id: teacherAId,
        lesson_date: '2026-05-02',
        start_at: '2026-05-02 09:00:00',
        end_at: '2026-05-02 09:45:00',
        actual_start_at: '2026-05-02 09:00:00',
        actual_end_at: '2026-05-02 09:45:00',
        verified_duty_minutes: 45,
        attendance_verification_status: 'VERIFIED',
        status: 'COMPLETED'
      }
    ]);

    // Generate monthly draft for April 2026
    await payrollRepository.generateMonthlyDrafts({
      payrollMonth: 'April 2026',
      teacherId: teacherAId,
      userId: 1
    });

    const draft = await db('teacher_payroll_drafts')
      .where({ teacher_id: teacherAId, payroll_month: 'April 2026' })
      .first();

    assert.ok(draft);
    // Must include ONLY the 2 April lessons, excluding May!
    assert.equal(draft.completed_lessons, 2);
    assert.equal(Number(draft.verified_hours), 1.5); // 90 mins = 1.5 hrs
    // PER_HOUR rate is Rs. 2,000 / hr -> 1.5 * 2,000 = 3,000
    // Allowances = 1,000, Deductions = 200 -> Net = 3,000 + 1,000 - 200 = 3,800
    assert.equal(Number(draft.net_payable), 3800);

    // Consistency check: Duty summary for April 2026 matches payroll draft
    const dutySummary = await payrollRepository.getTeacherDutySummary(teacherAId, 'April 2026');
    assert.equal(dutySummary.completedLessons, draft.completed_lessons);
    assert.equal(dutySummary.verifiedTeachingHours, Number(draft.verified_hours));
  });

  it('11. Preserves approved and settled payroll records against modification', async () => {
    const draft = await db('teacher_payroll_drafts')
      .where({ teacher_id: teacherAId, payroll_month: 'April 2026' })
      .first();

    assert.ok(draft);

    // Approve the draft
    await payrollRepository.reviewSalaryDraft({
      draftId: draft.id,
      decision: 'Approved',
      reviewRemarks: 'Duty hours verified against Zoom logs',
      reviewerUserId: 1
    });

    // Settle the draft
    await payrollRepository.settleSalaryPayment({
      draftId: draft.id,
      paymentMethod: 'Bank Transfer',
      paymentReference: 'TXN-SETTLE-001',
      paidAmount: draft.net_payable,
      userId: 1
    });

    const settled = await db('teacher_payroll_drafts').where({ id: draft.id }).first();
    assert.equal(settled.status, 'PAID');

    // Attempting to add an adjustment to settled draft must throw error
    await assert.rejects(
      async () => {
        await payrollRepository.addSalaryAdjustment({
          draftId: draft.id,
          type: 'Addition',
          title: 'Illegal Post-Settlement Bonus',
          amount: 500,
          reason: 'Test',
          authorizedByUserId: 1
        });
      },
      (err) => err.message.includes('Cannot add adjustments to a salary draft that has already been settled and paid')
    );

    // Attempting to double-disburse must throw conflict error
    await assert.rejects(
      async () => {
        await payrollRepository.settleSalaryPayment({
          draftId: draft.id,
          paymentMethod: 'Bank Transfer',
          paymentReference: 'TXN-DUPLICATE',
          paidAmount: draft.net_payable,
          userId: 1
        });
      },
      (err) => err.message.includes('Salary draft has already been settled and paid')
    );
  });
});

