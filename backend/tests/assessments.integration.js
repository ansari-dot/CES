import 'dotenv/config';
import http from 'http';
import { createApp } from '../src/app.js';
import { db } from '../src/shared/db/knex.js';
import { sessionStore } from '../src/shared/session/sessionStore.js';
import { assessmentsService } from '../src/modules/assessments/assessments.service.js';
import { runAssessmentExpirySweep } from '../src/modules/assessments/assessments.scheduler.js';

async function runAssessmentTests() {
  console.log('🚀 Starting Monthly Test & Assessment Engine Test Suite...\n');

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
    // 1. Fetch student and their enrolled class
    const student = await db('students').where({ status: 'ACTIVE' }).first();
    const studentUser = await db('users').where({ id: student.user_id }).first();
    const enrollment = await db('enrollments').where({ student_id: student.id, status: 'ACTIVE' }).first();
    const classId = enrollment.class_id;
    const session = await db('academic_sessions').where({ id: enrollment.session_id }).first();

    // Find teacher assigned to this class
    const assignment = await db('teacher_assignments')
      .where({ class_id: classId })
      .first();

    const teacher = await db('teachers').where({ id: assignment.teacher_id }).first();
    const teacherUser = await db('users').where({ id: teacher.user_id }).first();
    const subjectId = assignment.subject_id;

    // Create session cookies
    const teacherSess = await sessionStore.createSession({ userId: teacherUser.id, roleCode: 'TEACHER' });
    const studentSess = await sessionStore.createSession({ userId: studentUser.id, roleCode: 'STUDENT' });

    console.log(`👤 Testing with Teacher (${teacherUser.username}) and Student (${studentUser.username}) on Class ID: ${classId}\n`);

    // -------------------------------------------------------------
    // Test 1: Teacher Creates Monthly Test (Hybrid: MCQ + Subjective)
    // -------------------------------------------------------------
    console.log('--- 1. Testing Test Creation (MCQ + Subjective) ---');
    const availableFrom = new Date(Date.now() - 60000).toISOString(); // Opened 1m ago
    const availableUntil = new Date(Date.now() + 86400000).toISOString(); // Closes in 24h

    const createRes = await fetch(`${baseUrl}/api/v1/assessments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sms_sid=${teacherSess.sessionId}`
      },
      body: JSON.stringify({
        class_id: classId,
        subject_id: subjectId,
        session_id: session.id,
        title: 'November Mathematics Monthly Assessment',
        description: 'Complete all questions. Time limit is 30 minutes.',
        month_name: 'November 2026',
        duration_minutes: 30,
        available_from: availableFrom,
        available_until: availableUntil,
        passing_marks: 5,
        publishImmediately: true,
        questions: [
          {
            question_number: 1,
            question_type: 'MCQ',
            question_text: 'What is 15 * 6?',
            marks: 2,
            options: [
              { id: 'A', text: '70' },
              { id: 'B', text: '80' },
              { id: 'C', text: '90' },
              { id: 'D', text: '100' }
            ],
            correct_option: 'C'
          },
          {
            question_number: 2,
            question_type: 'MCQ',
            question_text: 'What is the square root of 144?',
            marks: 3,
            options: [
              { id: 'A', text: '10' },
              { id: 'B', text: '12' },
              { id: 'C', text: '14' },
              { id: 'D', text: '16' }
            ],
            correct_option: 'B'
          },
          {
            question_number: 3,
            question_type: 'SHORT_ANSWER',
            question_text: 'Explain the Pythagorean theorem in your own words with formula.',
            marks: 5,
            rubric_guide: 'a^2 + b^2 = c^2 for right triangles. Full 5 marks for formula + explanation.'
          }
        ]
      })
    });

    const createJson = await createRes.json();
    assert(createRes.status === 201, 'Teacher successfully created monthly test');
    const testId = createJson.data?.id;
    assert(testId > 0, `Test assigned ID: ${testId}`);
    assert(Number(createJson.data?.total_marks) === 10, 'Total marks correctly aggregated (2+3+5 = 10)');

    // -------------------------------------------------------------
    // Test 2: Student starts test attempt (Server Authoritative Timer)
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Student Starting Timed Attempt ---');
    const startRes = await fetch(`${baseUrl}/api/v1/assessments/${testId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sms_sid=${studentSess.sessionId}`
      }
    });

    const startJson = await startRes.json();
    assert(startRes.status === 200, 'Student started test attempt');
    const attemptId = startJson.data?.attemptId;
    assert(attemptId > 0, `Created attempt ID: ${attemptId}`);
    assert(startJson.data?.expiresAt != null, 'Response contains server-authoritative expiresAt');
    assert(startJson.data?.questions?.length === 3, 'Returns all 3 questions');

    // Security Check: Correct options must NEVER be leaked to student
    const hasLeakedKey = startJson.data.questions.some((q) => q.correct_option != null);
    assert(!hasLeakedKey, 'Security Check: MCQ correct answer keys are strictly hidden from student');

    // -------------------------------------------------------------
    // Test 3: Resume Attempt on Refresh (Stable Timer & Answers)
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing Resume Attempt (Simulating Browser Refresh) ---');
    const resumeRes = await fetch(`${baseUrl}/api/v1/assessments/${testId}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sms_sid=${studentSess.sessionId}`
      }
    });
    const resumeJson = await resumeRes.json();
    assert(resumeJson.data?.attemptId === attemptId, 'Resume returns the same active attempt (no duplicates)');
    assert(resumeJson.data?.expiresAt === startJson.data.expiresAt, 'Server timer expiresAt remains identical');

    // -------------------------------------------------------------
    // Test 4: Answer Auto-Saving
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing Answer Auto-Saving ---');
    const q1 = startJson.data.questions[0]; // MCQ 1: What is 15 * 6? Correct = C
    const saveQ1 = await fetch(`${baseUrl}/api/v1/assessments/attempts/${attemptId}/save-answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sms_sid=${studentSess.sessionId}`
      },
      body: JSON.stringify({
        question_id: q1.id,
        selected_option: 'C'
      })
    });
    assert(saveQ1.status === 200, 'Student auto-saved MCQ answer (selected: C)');

    const q3 = startJson.data.questions[2]; // Subjective
    const saveQ3 = await fetch(`${baseUrl}/api/v1/assessments/attempts/${attemptId}/save-answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sms_sid=${studentSess.sessionId}`
      },
      body: JSON.stringify({
        question_id: q3.id,
        text_answer: 'In any right-angled triangle, a^2 + b^2 = c^2, where c is the hypotenuse.'
      })
    });
    assert(saveQ3.status === 200, 'Student auto-saved subjective text answer');

    // -------------------------------------------------------------
    // Test 5: Manual Submission & Automated MCQ Grading
    // -------------------------------------------------------------
    console.log('\n--- 5. Testing Submission & Automatic MCQ Evaluation ---');
    const submitRes = await fetch(`${baseUrl}/api/v1/assessments/attempts/${attemptId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sms_sid=${studentSess.sessionId}`
      }
    });
    assert(submitRes.status === 200, 'Test submission succeeded');

    const attemptInDb = await db('test_attempts').where({ id: attemptId }).first();
    assert(attemptInDb.status === 'SUBMITTED', 'Attempt status updated to SUBMITTED (awaiting subjective grading)');
    assert(Number(attemptInDb.mcq_score) === 2.0, `MCQs auto-evaluated correctly: 2.0 / 5.0 (Q1 answered correctly, Q2 skipped = 2.0)`);
    assert(attemptInDb.subjective_score === null, 'Subjective score remains NULL until teacher grades');

    // -------------------------------------------------------------
    // Test 6: Modifications Rejected After Submission
    // -------------------------------------------------------------
    console.log('\n--- 6. Testing Modifications Blocked After Submission ---');
    const postSubmitSave = await fetch(`${baseUrl}/api/v1/assessments/attempts/${attemptId}/save-answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sms_sid=${studentSess.sessionId}`
      },
      body: JSON.stringify({
        question_id: q1.id,
        selected_option: 'A'
      })
    });
    assert(postSubmitSave.status === 422, 'Modifications strictly rejected after test submission');

    // -------------------------------------------------------------
    // Test 7: Teacher Grading Workstation (Subjective Grading)
    // -------------------------------------------------------------
    console.log('\n--- 7. Testing Teacher Grading Workstation ---');
    const rosterRes = await fetch(`${baseUrl}/api/v1/assessments/${testId}/submissions`, {
      headers: { Cookie: `sms_sid=${teacherSess.sessionId}` }
    });
    const rosterJson = await rosterRes.json();
    assert(rosterRes.status === 200, 'Teacher retrieved class submission roster');
    assert(rosterJson.data?.metrics?.submittedCount >= 1, 'Roster shows submitted student count');

    const gradeRes = await fetch(`${baseUrl}/api/v1/assessments/attempts/${attemptId}/grade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sms_sid=${teacherSess.sessionId}`
      },
      body: JSON.stringify({
        questionGrades: [
          {
            questionId: q3.id,
            marksAwarded: 5,
            teacherFeedback: 'Excellent explanation and accurate formula.'
          }
        ],
        teacherRemarks: 'Strong grasp of geometry concepts.'
      })
    });
    assert(gradeRes.status === 200, 'Teacher successfully graded subjective question (awarded 5/5)');

    const gradedAttempt = await db('test_attempts').where({ id: attemptId }).first();
    assert(gradedAttempt.status === 'GRADED', 'Attempt status transitioned to GRADED');
    assert(Number(gradedAttempt.subjective_score) === 5.0, 'Subjective score correctly recorded (5.0)');
    assert(Number(gradedAttempt.total_score) === 7.0, 'Total score correctly calculated: 2.0 (MCQ) + 5.0 (Subjective) = 7.0 / 10');
    assert(gradedAttempt.is_passed === 1, 'is_passed correctly evaluated (7.0 >= passing marks 5.0)');

    // -------------------------------------------------------------
    // Test 8: Publishing Results & Student Visibility
    // -------------------------------------------------------------
    console.log('\n--- 8. Testing Results Publishing & Visibility ---');
    const publishRes = await fetch(`${baseUrl}/api/v1/assessments/${testId}/publish-results`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sms_sid=${teacherSess.sessionId}`
      }
    });
    assert(publishRes.status === 200, 'Teacher published test results');

    const studentListRes = await fetch(`${baseUrl}/api/v1/assessments/student/my-tests`, {
      headers: { Cookie: `sms_sid=${studentSess.sessionId}` }
    });
    const studentListJson = await studentListRes.json();
    const studentTestsList = Array.isArray(studentListJson.data)
      ? studentListJson.data
      : (studentListJson.data.allTests || studentListJson.data.completedTests || []);
    const publishedTest = studentTestsList.find((t) => Number(t.id) === Number(testId));
    assert(publishedTest != null, 'Student can see published monthly test');
    assert(publishedTest.totalScore === 7.0, 'Student can see final published total score (7.0 / 10)');
    assert(publishedTest.isPassed === 1, 'Student can see pass status');

    // -------------------------------------------------------------
    // Test 9: Expiration Sweeper Auto-Finalizes Expired Attempts
    // -------------------------------------------------------------
    console.log('\n--- 9. Testing Background Expiration Sweeper ---');
    // Create an expired in-progress attempt for testing
    const fakeExpiredAttempt = await db('test_attempts').insert({
      test_id: testId,
      student_id: student.id,
      attempt_number: 2,
      started_at: new Date(Date.now() - 3600000), // 1 hour ago
      expires_at: new Date(Date.now() - 60000), // expired 1 minute ago
      status: 'IN_PROGRESS'
    });

    const sweepResult = await runAssessmentExpirySweep();
    assert(sweepResult.finalizedCount >= 1, `Expiration sweeper auto-finalized ${sweepResult.finalizedCount} expired attempt(s)`);

    const sweptAttempt = await db('test_attempts').where({ id: fakeExpiredAttempt[0] }).first();
    assert(sweptAttempt.status !== 'IN_PROGRESS', 'Expired attempt status was automatically moved out of IN_PROGRESS');
    assert(sweptAttempt.submission_trigger === 'AUTO_EXPIRED', 'Submission trigger recorded as AUTO_EXPIRED');

    // Clean up test attempt 2
    await db('test_attempts').where({ id: fakeExpiredAttempt[0] }).delete();

    // -------------------------------------------------------------
    // Test 10: Generalized Mid-Term Examination with Sections
    // -------------------------------------------------------------
    console.log('\n--- 10. Testing Mid-Term Exam Creation with Sections & Filtering ---');
    const midTermRes = await fetch(`${baseUrl}/api/v1/assessments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `sms_sid=${teacherSess.sessionId}`
      },
      body: JSON.stringify({
        class_id: classId,
        subject_id: subjectId,
        session_id: session.id,
        exam_type: 'MID_TERM',
        term_name: 'Mid-Term 2026',
        title: 'Mid-Term Examination — Mathematics Paper I',
        description: 'Comprehensive half-yearly evaluation covering Algebra, Geometry, and Numbers.',
        duration_minutes: 90,
        passing_marks: 20,
        available_from: availableFrom,
        available_until: availableUntil,
        publishImmediately: true,
        questions: [
          {
            section_name: 'Section A: Objective (MCQs)',
            question_type: 'MCQ',
            question_text: 'Solve for x: 3x - 5 = 16',
            marks: 5,
            options: [
              { key: 'A', text: '5' },
              { key: 'B', text: '7' },
              { key: 'C', text: '9' },
              { key: 'D', text: '11' }
            ],
            correct_option: 'B'
          },
          {
            section_name: 'Section B: Subjective Questions',
            question_type: 'SHORT_ANSWER',
            question_text: 'Prove that the sum of the angles in any triangle equals 180 degrees.',
            marks: 15,
            rubric_guide: '5 marks for diagram, 5 marks for construction, 5 marks for proof.'
          }
        ]
      })
    });

    const midTermJson = await midTermRes.json();
    assert(midTermRes.status === 201, 'Teacher created Mid-Term examination');
    assert(midTermJson.data.exam_type === 'MID_TERM', 'Exam type correctly stored as MID_TERM');
    assert(midTermJson.data.total_marks === 20, 'Total marks aggregated across Section A and B (5 + 15 = 20)');
    assert(midTermJson.data.questions[0].section_name === 'Section A: Objective (MCQs)', 'Section A saved on question 1');
    assert(midTermJson.data.questions[1].section_name === 'Section B: Subjective Questions', 'Section B saved on question 2');

    // Test examType query filtering
    const filterMidTermRes = await fetch(`${baseUrl}/api/v1/assessments?examType=MID_TERM`, {
      headers: { Cookie: `sms_sid=${teacherSess.sessionId}` }
    });
    const filterMidTermJson = await filterMidTermRes.json();
    assert(
      filterMidTermJson.data.tests.some((t) => t.id === midTermJson.data.id),
      'Filter query by examType=MID_TERM returns the Mid-Term paper'
    );

    const filterFinalTermRes = await fetch(`${baseUrl}/api/v1/assessments?examType=FINAL_TERM`, {
      headers: { Cookie: `sms_sid=${teacherSess.sessionId}` }
    });
    const filterFinalTermJson = await filterFinalTermRes.json();
    assert(
      !filterFinalTermJson.data.tests.some((t) => t.id === midTermJson.data.id),
      'Filter query by examType=FINAL_TERM strictly excludes Mid-Term papers'
    );

    // Verify student sees the Mid-Term exam with its examType badge
    const studentCheckRes = await fetch(`${baseUrl}/api/v1/assessments/student/my-tests`, {
      headers: { Cookie: `sms_sid=${studentSess.sessionId}` }
    });
    const studentCheckJson = await studentCheckRes.json();
    const studentCheckList = Array.isArray(studentCheckJson.data)
      ? studentCheckJson.data
      : (studentCheckJson.data.allTests || studentCheckJson.data.availableTests || []);
    const studentMidTerm = studentCheckList.find((t) => Number(t.id) === Number(midTermJson.data.id));
    assert(studentMidTerm != null, 'Student can see published Mid-Term examination');
    assert(studentMidTerm.examType === 'MID_TERM', 'Student receives examType = MID_TERM');

    // Clean up created mid-term test
    await db('monthly_tests').where({ id: midTermJson.data.id }).delete();

    // -------------------------------------------------------------
    // Test 11: Automated Time Lock & Missed/Absent Status Verification
    // -------------------------------------------------------------
    console.log('\n--- 11. Testing Automated Time Lock & Missed/Absent Status ---');
    // Create a future scheduled test (opens in 1 hour)
    const futureTest = await db('monthly_tests').insert({
      session_id: session.id,
      class_id: classId,
      subject_id: subjectId,
      teacher_id: teacher.id,
      title: 'Future Scheduled Test — Strict Lock Check',
      month_name: 'November 2026',
      duration_minutes: 30,
      total_marks: 10,
      passing_marks: 4,
      available_from: new Date(Date.now() + 3600000), // Opens in 1 hour
      available_until: new Date(Date.now() + 7200000),
      status: 'PUBLISHED',
      created_by: teacherUser.id
    });
    const futureTestId = futureTest[0];

    // Attempting to start future test before available_from must fail with 422/403
    const earlyStartRes = await fetch(`${baseUrl}/api/v1/assessments/${futureTestId}/start`, {
      method: 'POST',
      headers: { Cookie: `sms_sid=${studentSess.sessionId}` }
    });
    assert(
      earlyStartRes.status === 422 || earlyStartRes.status === 403,
      'Early entrance strictly blocked when exam has not opened yet'
    );

    // Create a closed/past test that the student never attempted
    const pastTest = await db('monthly_tests').insert({
      session_id: session.id,
      class_id: classId,
      subject_id: subjectId,
      teacher_id: teacher.id,
      title: 'Past Missed Examination — Absent Check',
      month_name: 'November 2026',
      duration_minutes: 30,
      total_marks: 20,
      passing_marks: 8,
      available_from: new Date(Date.now() - 7200000), // Opened 2 hours ago
      available_until: new Date(Date.now() - 3600000), // Closed 1 hour ago
      status: 'PUBLISHED',
      created_by: teacherUser.id
    });
    const pastTestId = pastTest[0];

    // Fetch student tests list: verify past unattempted test has attemptStatus = 'MISSED' and isMissed = true
    const missedCheckRes = await fetch(`${baseUrl}/api/v1/assessments/student/my-tests`, {
      headers: { Cookie: `sms_sid=${studentSess.sessionId}` }
    });
    const missedCheckJson = await missedCheckRes.json();
    const missedCheckList = Array.isArray(missedCheckJson.data)
      ? missedCheckJson.data
      : (missedCheckJson.data.allTests || missedCheckJson.data.completedTests || []);
    const missedExamItem = missedCheckList.find((t) => Number(t.id) === Number(pastTestId));
    assert(missedExamItem != null, 'Student receives the closed unattempted test');
    assert(missedExamItem.attemptStatus === 'MISSED', 'Unattempted closed test automatically tagged as MISSED');
    assert(missedExamItem.isMissed === true, 'isMissed boolean flag is set to true');

    // Verify teacher submissions roster lists the student as MISSED (Absent)
    const teacherRosterRes = await fetch(`${baseUrl}/api/v1/assessments/${pastTestId}/submissions`, {
      headers: { Cookie: `sms_sid=${teacherSess.sessionId}` }
    });
    const teacherRosterJson = await teacherRosterRes.json();
    assert(teacherRosterJson.data.metrics.missedCount >= 1, 'Teacher metrics report missedCount >= 1');
    const rosterStudent = teacherRosterJson.data.roster.find((r) => Number(r.studentId) === Number(student.id));
    assert(rosterStudent != null, 'Student is in teacher roster');
    assert(rosterStudent.status === 'MISSED', 'Student status in teacher roster is MISSED (Absent)');
    assert(rosterStudent.isMissed === true, 'Student isMissed flag is true in teacher roster');

    // Cleanup past and future test records
    await db('monthly_tests').whereIn('id', [futureTestId, pastTestId]).delete();

    console.log(`\n========================================`);
    console.log(`Assessment Test Results: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);

  } catch (err) {
    console.error('Test Execution Error:', err);
    failed++;
  } finally {
    server.close();
    setTimeout(() => process.exit(failed > 0 ? 1 : 0), 100);
  }
}

runAssessmentTests();
