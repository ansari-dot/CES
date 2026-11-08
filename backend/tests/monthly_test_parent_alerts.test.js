import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
import http from 'http';
import { createApp } from '../src/app.js';
import { db } from '../src/shared/db/knex.js';
import { sessionStore } from '../src/shared/session/sessionStore.js';
import { emailService } from '../src/shared/email/email.service.js';
import { assessmentsService } from '../src/modules/assessments/assessments.service.js';
import { assessmentsRepository } from '../src/modules/assessments/assessments.repository.js';

async function runMonthlyTestAlertTests() {
  console.log('🚀 Starting Monthly Test Parent Performance Alert Test Suite...\n');

  const app = createApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // -------------------------------------------------------------
    // Test 1: Email Template Verification
    // -------------------------------------------------------------
    console.log('--- 1. Testing Email Alert Template Generation ---');
    let capturedMail = null;
    const originalQueueMail = emailService.queueMail.bind(emailService);
    emailService.queueMail = async (mailOptions) => {
      capturedMail = mailOptions;
      return { sent: true, queued: true, messageId: 'test-msg-123' };
    };

    const emailRes = await emailService.sendMonthlyTestPerformanceAlert({
      to: 'parent.test@example.com',
      parentName: 'Mr. Tariq Khan',
      studentName: 'Ali Khan',
      rollNo: 'CS-101',
      admissionNo: 'ADM-2026-001',
      className: 'Grade 9 - Cambridge',
      testTitle: 'Mathematics Chapter 3 Evaluation',
      subjectName: 'Mathematics',
      monthName: 'November 2026',
      totalMarks: 50,
      passingMarks: 25,
      obtainedMarks: 18,
      percentage: 36,
      isPassed: false,
      teacherRemarks: 'Needs extra revision on quadratic equations.',
      portalUrl: 'http://localhost:3003'
    });

    assert(emailRes.queued === true || emailRes.sent === true, 'Email service queued the alert successfully');
    assert(capturedMail && capturedMail.to === 'parent.test@example.com', 'Recipient parent email address correctly populated');
    assert(capturedMail.subject.includes('Ali Khan') && capturedMail.subject.includes('Mathematics'), 'Subject line identifies student and subject');
    assert(capturedMail.html.includes('18 / 50'), 'HTML includes obtained and total marks');
    assert(capturedMail.html.includes('25 Marks'), 'HTML includes passing marks');
    assert(capturedMail.html.includes('http://localhost:3003/results'), 'HTML includes direct link to Parent Portal results page');
    assert(capturedMail.text.includes('http://localhost:3003/results'), 'Plain text includes direct link to Parent Portal results page');
    assert(capturedMail.html.includes('Needs extra revision on quadratic equations'), 'HTML includes teacher feedback');

    // -------------------------------------------------------------
    // Test 2: Database Repository Low-Performer Detection
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Repository Low-Performer Detection ---');
    // Find active student and teacher
    const student = await db('students').where({ status: 'ACTIVE' }).first();
    const enrollment = await db('enrollments').where({ student_id: student.id, status: 'ACTIVE' }).first();
    const session = await db('academic_sessions').where({ id: enrollment.session_id }).first();
    const assignment = await db('teacher_assignments').where({ class_id: enrollment.class_id }).first();
    const teacher = await db('teachers').where({ id: assignment.teacher_id }).first();
    const teacherUser = await db('users').where({ id: teacher.user_id }).first();

    // Create a mock monthly test
    const [testId] = await db('monthly_tests').insert({
      session_id: session.id,
      class_id: enrollment.class_id,
      subject_id: assignment.subject_id,
      teacher_id: teacher.id,
      title: 'Automated Parent Alert Test Exam',
      description: 'Unit test verifying parent alert triggering',
      month_name: 'November 2026',
      duration_minutes: 30,
      total_marks: 30.00,
      passing_marks: 15.00,
      available_from: new Date(Date.now() - 3600000),
      available_until: new Date(Date.now() + 3600000),
      status: 'PUBLISHED',
      created_by: teacherUser.id
    });

    // Create a failing attempt for the student (score 10 / 30, below passing 15)
    const [attemptId] = await db('test_attempts').insert({
      test_id: testId,
      student_id: student.id,
      attempt_number: 1,
      started_at: new Date(Date.now() - 1800000),
      expires_at: new Date(Date.now() + 1800000),
      submitted_at: new Date(Date.now() - 600000),
      submission_trigger: 'MANUAL',
      status: 'GRADED',
      mcq_score: 5.00,
      subjective_score: 5.00,
      total_score: 10.00,
      is_passed: 0,
      teacher_remarks: 'Needs urgent practice in basic problems',
      graded_by: teacherUser.id,
      graded_at: new Date()
    });

    const lowPerfResult = await assessmentsRepository.findLowPerformingAttempts(testId);
    assert(lowPerfResult.test && lowPerfResult.test.id == testId, 'findLowPerformingAttempts resolves test');
    assert(lowPerfResult.attempts.length >= 1, 'findLowPerformingAttempts identified the failing student attempt');
    const matchedAttempt = lowPerfResult.attempts.find((a) => a.student_id == student.id);
    assert(matchedAttempt && matchedAttempt.total_score === 10, 'Failing score (10 pts) accurately retrieved');

    // -------------------------------------------------------------
    // Test 3: Manual Trigger via assessmentsService.notifyLowPerformers
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing assessmentsService.notifyLowPerformers ---');
    // Ensure student has a linked parent for testing
    let parentLink = await db('parent_student').where({ student_id: student.id }).first();
    let parentUser = null;

    if (!parentLink) {
      // Find or create test parent user
      let pUser = await db('users').where({ role: 'PARENT' }).first();
      let parentRecord = null;
      if (pUser) {
        parentRecord = await db('parents').where({ user_id: pUser.id }).first();
      }
      if (parentRecord) {
        await db('parent_student').insert({
          parent_id: parentRecord.id,
          student_id: student.id,
          relation: 'FATHER',
          is_primary: 1,
          linked_by: teacherUser.id
        });
        parentLink = { parent_id: parentRecord.id, student_id: student.id };
        parentUser = pUser;
      }
    } else {
      const pRecord = await db('parents').where({ id: parentLink.parent_id }).first();
      parentUser = await db('users').where({ id: pRecord.user_id }).first();
    }

    const actorTeacher = {
      ...teacherUser,
      role: 'TEACHER',
      role_code: 'TEACHER'
    };

    capturedMail = null;
    const notifyRes = await assessmentsService.notifyLowPerformers(testId, {
      actor: actorTeacher,
      isManual: true,
      force: true
    });

    assert(notifyRes.success === true, 'assessmentsService.notifyLowPerformers returned success');
    assert(notifyRes.lowPerformersCount >= 1, 'Correct low performers count in dispatch summary');
    if (parentUser) {
      assert(notifyRes.alertsSent >= 1, `Alert sent to linked parent (${parentUser.email})`);
      assert(capturedMail !== null, 'Email was dispatched to parent during notifyLowPerformers');
    }

    // -------------------------------------------------------------
    // Test 4: Single Student Attempt Alert (notifyAttemptParent)
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing assessmentsService.notifyAttemptParent ---');
    if (parentUser) {
      capturedMail = null;
      const singleRes = await assessmentsService.notifyAttemptParent(actorTeacher, testId, attemptId, {
        customNote: 'Please see me during office hours regarding this test.'
      });
      assert(singleRes.success === true, 'notifyAttemptParent returned success');
      assert(capturedMail && capturedMail.text.includes('Please see me during office hours'), 'Custom teacher note included in single parent email');
    }

    // -------------------------------------------------------------
    // Test 5: HTTP Endpoints for Manual Alert Dispatches
    // -------------------------------------------------------------
    console.log('\n--- 5. Testing HTTP API Endpoints ---');
    const teacherSess = await sessionStore.createSession({ userId: teacherUser.id, roleCode: 'TEACHER' });

    // Endpoint A: POST /api/v1/assessments/:id/notify-low-performers
    const httpRes1 = await fetch(`${baseUrl}/api/v1/assessments/${testId}/notify-low-performers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `sms_sid=${teacherSess.sessionId}; __Host-sms_sid=${teacherSess.sessionId}`
      },
      body: JSON.stringify({ force: true })
    });
    const json1 = await httpRes1.json();
    assert(httpRes1.status === 200 && json1.success === true, 'POST /notify-low-performers returns 200 OK');

    // Endpoint B: POST /api/v1/assessments/:id/attempts/:attemptId/notify-parent
    if (parentUser) {
      const httpRes2 = await fetch(`${baseUrl}/api/v1/assessments/${testId}/attempts/${attemptId}/notify-parent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `sms_sid=${teacherSess.sessionId}; __Host-sms_sid=${teacherSess.sessionId}`
        },
        body: JSON.stringify({ customNote: 'API Test Note' })
      });
      const json2 = await httpRes2.json();
      assert(httpRes2.status === 200 && json2.success === true, 'POST /attempts/:attemptId/notify-parent returns 200 OK');
    }

    // Clean up mock test records
    await db('test_attempts').where({ id: attemptId }).delete();
    await db('monthly_tests').where({ id: testId }).delete();

    // Restore original method
    emailService.queueMail = originalQueueMail;

    console.log(`\n========================================`);
    console.log(`Test Results: ${passed} PASSED, ${failed} FAILED`);
    console.log(`========================================\n`);

    server.close();
    await db.destroy();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('💥 Test execution error:', err);
    server.close();
    await db.destroy();
    process.exit(1);
  }
}

runMonthlyTestAlertTests();
