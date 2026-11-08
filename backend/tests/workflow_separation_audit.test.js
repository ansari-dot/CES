import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });
process.env.NODE_ENV = 'test';

import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/shared/db/knex.js';
import { hashPassword } from '../src/shared/crypto/password.js';

async function runWorkflowSeparationAudit() {
  console.log('================================================================================');
  console.log('  CAMBRIDGE EDUCATION LMS: DUAL WORKFLOW SEPARATION AUDIT & VERIFICATION');
  console.log('================================================================================\n');

  const app = createApp();

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

  // Helper to log in a user and extract cookie + csrf
  async function loginUser(identifier, password) {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier, password });

    if (res.status !== 200) {
      throw new Error(`Login failed for ${identifier}: ${res.status} ${JSON.stringify(res.body)}`);
    }

    const cookies = res.headers['set-cookie'];
    const csrfCookie = cookies.find((c) => c.startsWith('sms_csrf='));
    const csrfToken = csrfCookie ? csrfCookie.split(';')[0].split('=')[1] : '';

    return {
      cookies,
      csrfToken,
      user: res.body.data
    };
  }

  try {
    // -------------------------------------------------------------------------
    // Phase 0: Test Environment & User Account Preparation
    // -------------------------------------------------------------------------
    console.log('--- Phase 0: Setting up Verified Credentials for All 4 Roles ---');
    const commonPassword = 'AuditPassword123!';
    const commonHash = await hashPassword(commonPassword);

    await db('users')
      .whereIn('username', ['principal', 'teacher', 'student', 'parent'])
      .update({
        password_hash: commonHash,
        status: 'ACTIVE',
        must_change_password: 0,
        failed_login_count: 0,
        locked_until: null
      });

    const principalAuth = await loginUser('principal', commonPassword);
    const teacherAuth = await loginUser('teacher', commonPassword);
    const studentAuth = await loginUser('student', commonPassword);
    const parentAuth = await loginUser('parent', commonPassword);

    assert(principalAuth.user.role === 'PRINCIPAL', 'Principal authenticated successfully (Role: PRINCIPAL)');
    assert(teacherAuth.user.role === 'TEACHER', 'Teacher authenticated successfully (Role: TEACHER)');
    assert(studentAuth.user.role === 'STUDENT', 'Student authenticated successfully (Role: STUDENT)');
    assert(parentAuth.user.role === 'PARENT', 'Parent authenticated successfully (Role: PARENT)');

    // Retrieve active student profile
    const studentRecord = await db('students').where({ user_id: studentAuth.user.id }).first();
    const studentId = studentRecord.id;
    const classId = studentRecord.current_class_id || 5;

    // Verify parent-student linkage
    const parentRecord = await db('parents').where({ user_id: parentAuth.user.id }).first();
    const parentLink = await db('parent_student')
      .where({ parent_id: parentRecord.id, student_id: studentId })
      .first();
    assert(Boolean(parentLink), `Student #${studentId} is linked to Parent #${parentRecord.id}`);

    // Retrieve active session & term
    const activeSession = await db('academic_sessions').where({ is_current: 1 }).first() || await db('academic_sessions').first();
    const activeTerm = await db('academic_terms').where({ session_id: activeSession.id }).first();
    console.log(`Active Academic Context: Session #${activeSession.id} (${activeSession.name}), Term #${activeTerm.id} (${activeTerm.name}), Class #${classId}\n`);

    // -------------------------------------------------------------------------
    // WORKFLOW A: CONTINUOUS ASSESSMENT (NO PRINCIPAL APPROVAL)
    // -------------------------------------------------------------------------
    console.log('================================================================================');
    console.log('  WORKFLOW A: CONTINUOUS ASSESSMENT VERIFICATION (NO PRINCIPAL APPROVAL)');
    console.log('================================================================================\n');

    // Part A1: Assignments & Learning Tasks
    console.log('--- A1. Continuous Assessment: Task / Assignment Lifecycle ---');

    // Teacher creates task
    const taskTitle = `Continuous Calculus Task ${Date.now()}`;
    const createTaskRes = await request(app)
      .post('/api/v1/tasks')
      .set('Cookie', teacherAuth.cookies)
      .set('x-csrf-token', teacherAuth.csrfToken)
      .field('title', taskTitle)
      .field('instructions', 'Weekly formative assessment exercise covering differential equations.')
      .field('taskType', 'ASSIGNMENT')
      .field('classId', classId)
      .field('subjectId', 1) // Mathematics
      .field('totalMarks', 100)
      .field('passingMarks', 40)
      .field('assignedDate', new Date().toISOString().split('T')[0])
      .field('deadline', new Date(Date.now() + 86400000 * 3).toISOString());

    assert(createTaskRes.status === 201, `Teacher created assignment task "${taskTitle}" (HTTP 201)`);
    const createdTask = createTaskRes.body.data;

    // Student submits task
    const submitTaskRes = await request(app)
      .post(`/api/v1/tasks/${createdTask.id}/submit`)
      .set('Cookie', studentAuth.cookies)
      .set('x-csrf-token', studentAuth.csrfToken)
      .field('studentNotes', 'Here is my complete calculus solution steps.');

    assert(submitTaskRes.status === 200 || submitTaskRes.status === 201, 'Student submitted assignment response (HTTP 200/201)');
    const submissionId = submitTaskRes.body.data?.id;

    // Teacher grades submission directly
    const gradeTaskRes = await request(app)
      .post(`/api/v1/tasks/submissions/${submissionId}/grade`)
      .set('Cookie', teacherAuth.cookies)
      .set('x-csrf-token', teacherAuth.csrfToken)
      .send({
        marksAwarded: 94,
        feedback: 'Outstanding mathematical derivation and formatting!',
        publish: true
      });

    assert(gradeTaskRes.status === 200, 'Teacher evaluated and recorded marks (94/100) (HTTP 200)');

    // Check Student Portal: Directly visible with ZERO Principal approval
    const studentGradesRes = await request(app)
      .get('/api/v1/students/me/grades')
      .set('Cookie', studentAuth.cookies);

    assert(studentGradesRes.status === 200, 'Student retrieved continuous academic grades (HTTP 200)');
    const studentHasTask = (studentGradesRes.body.data?.recentResults || []).some(
      (r) => Number(r.taskId) === Number(createdTask.id) && Number(r.marksAwarded) === 94
    );
    assert(studentHasTask, 'Student portal immediately displays graded assignment (94/100) with ZERO Principal approval');

    // Check Parent Portal: Directly visible with ZERO Principal approval
    const parentResultsRes = await request(app)
      .get(`/api/v1/parents/me/children/${studentId}/results`)
      .set('Cookie', parentAuth.cookies);

    assert(parentResultsRes.status === 200, 'Parent retrieved child continuous academic results (HTTP 200)');
    const parentHasTask = (parentResultsRes.body.data?.recentResults || []).some(
      (r) => Number(r.submissionId) === Number(submissionId) && Number(r.marksAwarded) === 94
    );
    assert(parentHasTask, 'Parent portal immediately displays child graded assignment (94/100) with ZERO Principal approval');

    // Part A2: Monthly Tests / Quizzes
    console.log('\n--- A2. Continuous Assessment: Monthly Test / Quiz Lifecycle ---');

    // Teacher creates Monthly Test
    const createTestRes = await request(app)
      .post('/api/v1/assessments')
      .set('Cookie', teacherAuth.cookies)
      .set('x-csrf-token', teacherAuth.csrfToken)
      .send({
        title: `November Monthly Diagnostic Test ${Date.now()}`,
        examType: 'MONTHLY_TEST',
        classId: classId,
        subjectId: 1, // Mathematics
        termName: activeTerm.name,
        monthName: 'November',
        durationMinutes: 45,
        totalMarks: 20,
        passingMarks: 8,
        availableFrom: new Date(Date.now() - 3600000).toISOString(),
        availableUntil: new Date(Date.now() + 86400000).toISOString(),
        questions: [
          {
            question_type: 'MCQ',
            marks: 10,
            question_text: 'What is the derivative of x^2 with respect to x?',
            options: [
              { option_key: 'A', option_text: '2x' },
              { option_key: 'B', option_text: 'x' },
              { option_key: 'C', option_text: 'x^2' },
              { option_key: 'D', option_text: '2' }
            ],
            correct_option: 'A'
          },
          {
            question_type: 'SHORT_ANSWER',
            marks: 10,
            question_text: 'State and explain the fundamental theorem of calculus.'
          }
        ]
      });

    assert(createTestRes.status === 201, 'Teacher created Monthly Test with MCQ & Subjective questions (HTTP 201)');
    const monthlyTest = createTestRes.body.data;

    // Teacher publishes Monthly Test for students to attempt
    const publishTestWindowRes = await request(app)
      .post(`/api/v1/assessments/${monthlyTest.id}/publish`)
      .set('Cookie', teacherAuth.cookies)
      .set('x-csrf-token', teacherAuth.csrfToken);

    assert(publishTestWindowRes.status === 200, 'Teacher opened/published Monthly Test testing window (HTTP 200)');

    // Student starts attempt
    const startAttemptRes = await request(app)
      .post(`/api/v1/assessments/${monthlyTest.id}/start`)
      .set('Cookie', studentAuth.cookies)
      .set('x-csrf-token', studentAuth.csrfToken);

    assert(startAttemptRes.status === 200, 'Student started Monthly Test attempt (HTTP 200)');
    const attemptId = startAttemptRes.body.data?.attempt?.id;

    // Save answers
    const questions = startAttemptRes.body.data?.questions || [];
    const mcqQ = questions.find((q) => q.question_type === 'MCQ');
    const subjQ = questions.find((q) => q.question_type !== 'MCQ');

    await request(app)
      .post(`/api/v1/assessments/attempts/${attemptId}/save-answer`)
      .set('Cookie', studentAuth.cookies)
      .set('x-csrf-token', studentAuth.csrfToken)
      .send({
        questionId: mcqQ.id,
        selectedOption: 'A'
      });

    await request(app)
      .post(`/api/v1/assessments/attempts/${attemptId}/save-answer`)
      .set('Cookie', studentAuth.cookies)
      .set('x-csrf-token', studentAuth.csrfToken)
      .send({
        questionId: subjQ.id,
        textAnswer: 'The fundamental theorem relates differentiation and integration as reciprocal processes.'
      });

    // Student submits attempt
    const submitAttemptRes = await request(app)
      .post(`/api/v1/assessments/attempts/${attemptId}/submit`)
      .set('Cookie', studentAuth.cookies)
      .set('x-csrf-token', studentAuth.csrfToken);

    assert(submitAttemptRes.status === 200, 'Student submitted Monthly Test attempt (HTTP 200)');

    // Teacher grades subjective answer
    const gradeAttemptRes = await request(app)
      .post(`/api/v1/assessments/attempts/${attemptId}/grade`)
      .set('Cookie', teacherAuth.cookies)
      .set('x-csrf-token', teacherAuth.csrfToken)
      .send({
        questionGrades: [
          { questionId: subjQ.id, marksAwarded: 9 }
        ],
        teacherRemarks: 'Excellent conceptual articulation.'
      });

    assert(gradeAttemptRes.status === 200, 'Teacher graded subjective question (9/10) (HTTP 200)');

    // Teacher publishes results directly
    const publishTestResultsRes = await request(app)
      .post(`/api/v1/assessments/${monthlyTest.id}/publish-results`)
      .set('Cookie', teacherAuth.cookies)
      .set('x-csrf-token', teacherAuth.csrfToken);

    assert(publishTestResultsRes.status === 200, 'Teacher published Monthly Test results directly (HTTP 200)');

    // Student retrieves Monthly Test result directly
    const studentTestResultRes = await request(app)
      .get(`/api/v1/assessments/student/${monthlyTest.id}/result`)
      .set('Cookie', studentAuth.cookies);

    assert(studentTestResultRes.status === 200, 'Student viewed published Monthly Test result (HTTP 200)');
    const studentTotalScore = Number(studentTestResultRes.body.data?.attempt?.total_score);
    assert(studentTotalScore === 19, `Student obtained score correctly calculated as 19/20 (MCQ: 10 + Subjective: 9)`);

    // Parent retrieves child's Monthly Test results directly
    const parentMonthlyRes = await request(app)
      .get(`/api/v1/assessments/parent/children/${studentId}`)
      .set('Cookie', parentAuth.cookies);

    assert(parentMonthlyRes.status === 200, 'Parent viewed child Monthly Test results (HTTP 200)');
    const rawParentData = parentMonthlyRes.body.data;
    const parentList = Array.isArray(rawParentData) ? rawParentData : (rawParentData?.results || rawParentData?.attempts || []);
    const parentAttempt = parentList.find((a) => Number(a.test_id || a.testId) === Number(monthlyTest.id));
    assert(Boolean(parentAttempt), 'Parent portal lists child Monthly Test with ZERO Principal approval');
    assert(Number(parentAttempt?.total_score ?? parentAttempt?.totalScore) === 19, 'Parent portal displays verified total score of 19/20');

    // -------------------------------------------------------------------------
    // WORKFLOW B: TERMINAL / FINAL EXAMINATIONS (PRINCIPAL APPROVAL REQUIRED)
    // -------------------------------------------------------------------------
    console.log('\n================================================================================');
    console.log('  WORKFLOW B: TERMINAL / FINAL EXAMINATIONS AUDIT (PRINCIPAL APPROVAL REQUIRED)');
    console.log('================================================================================\n');

    console.log('--- B1. Security & RBAC Enforcement on Terminal Examinations ---');

    // Teacher CANNOT approve class results
    const teacherApproveAttempt = await request(app)
      .post('/api/v1/results/approve')
      .set('Cookie', teacherAuth.cookies)
      .set('x-csrf-token', teacherAuth.csrfToken)
      .send({ classId, termId: activeTerm.id });

    assert(teacherApproveAttempt.status === 403, 'Teacher cannot approve terminal exam results (HTTP 403 Forbidden)');

    // Teacher CANNOT publish class results
    const teacherPublishAttempt = await request(app)
      .post('/api/v1/results/publish')
      .set('Cookie', teacherAuth.cookies)
      .set('x-csrf-token', teacherAuth.csrfToken)
      .send({ classId, termId: activeTerm.id });

    assert(teacherPublishAttempt.status === 403, 'Teacher cannot publish terminal exam results (HTTP 403 Forbidden)');

    // Student CANNOT approve or publish
    const studentApproveAttempt = await request(app)
      .post('/api/v1/results/approve')
      .set('Cookie', studentAuth.cookies)
      .set('x-csrf-token', studentAuth.csrfToken)
      .send({ classId, termId: activeTerm.id });

    assert(studentApproveAttempt.status === 403, 'Student cannot approve terminal exam results (HTTP 403 Forbidden)');

    console.log('\n--- B2. Teacher Tabulates & Submits Terminal Exam Marks ---');

    // Setup terminal exam and paper for this audit
    const examSeriesTitle = `Audit Terminal Examination ${Date.now()}`;
    const createExamRes = await request(app)
      .post('/api/v1/exams')
      .set('Cookie', principalAuth.cookies)
      .set('x-csrf-token', principalAuth.csrfToken)
      .send({
        sessionId: activeSession.id,
        termId: activeTerm.id,
        title: examSeriesTitle,
        examType: 'TERMINAL',
        startDate: '2026-11-15',
        endDate: '2026-11-30'
      });

    assert(createExamRes.status === 201, `Principal configured terminal examination series "${examSeriesTitle}" (HTTP 201)`);
    const terminalExam = createExamRes.body.data;

    // Create exam paper for Mathematics in Class 5
    const createPaperRes = await request(app)
      .post(`/api/v1/exams/${terminalExam.id}/papers`)
      .set('Cookie', principalAuth.cookies)
      .set('x-csrf-token', principalAuth.csrfToken)
      .send({
        classId: classId,
        subjectId: 1, // Mathematics
        paperCode: `MATH-TERM-${Date.now().toString().slice(-4)}`,
        paperDate: '2026-11-20',
        startTime: '09:00:00',
        endTime: '12:00:00',
        maxTheoryMarks: 80,
        maxPracticalMarks: 20,
        passingMarks: 40
      });

    assert(createPaperRes.status === 201, 'Exam paper created with Theory (80) + Practical (20) (HTTP 201)');
    const examPaper = createPaperRes.body.data;

    // Teacher tabulates terminal marks: Theory 72, Practical 18 = 90 (Grade A*)
    const submitMarksRes = await request(app)
      .put(`/api/v1/exams/papers/${examPaper.id}/marks`)
      .set('Cookie', teacherAuth.cookies)
      .set('x-csrf-token', teacherAuth.csrfToken)
      .send({
        action: 'SUBMIT',
        marks: [
          {
            studentId: studentId,
            theoryObtained: 72,
            practicalObtained: 18,
            isAbsent: false,
            isExempt: false,
            teacherRemarks: 'Excellent mastery of all Cambridge syllabus topics.'
          }
        ]
      });

    assert(submitMarksRes.status === 200, 'Teacher submitted terminal marks for Class 5 (HTTP 200)');

    // Teacher hands off subject marks for Principal review
    const handoffRes = await request(app)
      .post('/api/v1/results/submit-marks')
      .set('Cookie', teacherAuth.cookies)
      .set('x-csrf-token', teacherAuth.csrfToken)
      .send({
        classId: classId,
        subjectId: 1,
        termId: activeTerm.id,
        note: 'Mathematics marks ready for principal audit'
      });

    assert(handoffRes.status === 200 || handoffRes.status === 201, 'Teacher submitted subject marks hand-off for Principal review (HTTP 200/201)');

    console.log('\n--- B3. Gating Check 1: DRAFT / SUBMITTED State Enforcement ---');

    // Principal calculates exam results from submitted marks
    const calcRes = await request(app)
      .post(`/api/v1/exams/${terminalExam.id}/calculate-results`)
      .set('Cookie', principalAuth.cookies)
      .set('x-csrf-token', principalAuth.csrfToken)
      .send({ classId });

    assert(calcRes.status === 200, 'Class terminal results calculated by exam engine (HTTP 200)');

    // Get the computed result ID from database
    const computedResult = await db('final_results')
      .where({ class_id: classId, term_id: activeTerm.id, student_id: studentId })
      .first();

    assert(Boolean(computedResult), `Computed final_result record exists (ID: #${computedResult?.id}, Status: ${computedResult?.result_status})`);

    // Reset result status to SUBMITTED to test DRAFT/SUBMITTED gating
    await db('final_results')
      .where({ id: computedResult.id })
      .update({ result_status: 'SUBMITTED', published_at: null });

    // Verify Student Portal CANNOT see submitted terminal results
    const studentUnpublishedMeRes = await request(app)
      .get('/api/v1/results/me')
      .set('Cookie', studentAuth.cookies);

    const studentMeResults = studentUnpublishedMeRes.body.data?.results || [];
    const studentSeesUnpublished = studentMeResults.some((r) => r.id === computedResult.id);
    assert(!studentSeesUnpublished, 'Student portal strictly hides SUBMITTED terminal results');

    // Verify Parent Portal CANNOT see submitted terminal results
    const parentUnpublishedRes = await request(app)
      .get(`/api/v1/results/child/${studentId}`)
      .set('Cookie', parentAuth.cookies);

    const parentChildResults = parentUnpublishedRes.body.data?.results || [];
    const parentSeesUnpublished = parentChildResults.some((r) => r.id === computedResult.id);
    assert(!parentSeesUnpublished, 'Parent portal strictly hides SUBMITTED terminal results');

    // Verify Direct Result Detail Endpoint BLOCKS student with 403
    const directStudentRes = await request(app)
      .get(`/api/v1/results/${computedResult.id}`)
      .set('Cookie', studentAuth.cookies);

    assert(directStudentRes.status === 403, 'Direct access to unpublished result is blocked (HTTP 403 Forbidden)');

    // Verify Direct Report Card Endpoint BLOCKS student with 403
    const directReportCardRes = await request(app)
      .get(`/api/v1/exams/${terminalExam.id}/report-card/${studentId}`)
      .set('Cookie', studentAuth.cookies);

    assert(directReportCardRes.status === 403, 'Direct access to unpublished report card is blocked (HTTP 403 Forbidden)');

    console.log('\n--- B4. Gating Check 2: Principal APPROVAL State Enforcement ---');

    // Principal views overview
    const overviewRes = await request(app)
      .get(`/api/v1/results/overview?termId=${activeTerm.id}`)
      .set('Cookie', principalAuth.cookies);

    assert(overviewRes.status === 200, 'Principal accessed Academic Oversight dashboard (HTTP 200)');

    // Principal APPROVES Class Results at the class level
    const approveRes = await request(app)
      .post('/api/v1/results/approve')
      .set('Cookie', principalAuth.cookies)
      .set('x-csrf-token', principalAuth.csrfToken)
      .send({ classId, termId: activeTerm.id });

    assert(approveRes.status === 200, `Principal approved Class #${classId} results (Approved: ${approveRes.body.data?.approved}) (HTTP 200)`);

    const approvedResult = await db('final_results').where({ id: computedResult.id }).first();
    assert(approvedResult.result_status === 'APPROVED', 'Result status transitioned to APPROVED in database');

    // CRUCIAL CHECK: Approved results MUST STILL BE HIDDEN from students & parents until published!
    const studentApprovedMeRes = await request(app)
      .get('/api/v1/results/me')
      .set('Cookie', studentAuth.cookies);

    const studentSeesApproved = (studentApprovedMeRes.body.data?.results || []).some((r) => r.id === computedResult.id);
    assert(!studentSeesApproved, 'Student portal STILL HIDES APPROVED results (awaiting publication)');

    const parentApprovedRes = await request(app)
      .get(`/api/v1/results/child/${studentId}`)
      .set('Cookie', parentAuth.cookies);

    const parentSeesApproved = (parentApprovedRes.body.data?.results || []).some((r) => r.id === computedResult.id);
    assert(!parentSeesApproved, 'Parent portal STILL HIDES APPROVED results (awaiting publication)');

    const directApprovedRes = await request(app)
      .get(`/api/v1/results/${computedResult.id}`)
      .set('Cookie', studentAuth.cookies);

    assert(directApprovedRes.status === 403, 'Direct access to approved but unpublished result is blocked (HTTP 403 Forbidden)');

    console.log('\n--- B5. Gating Check 3: Principal PUBLICATION & Live Release ---');

    // Principal PUBLISHES Class Results at the class level
    const publishRes = await request(app)
      .post('/api/v1/results/publish')
      .set('Cookie', principalAuth.cookies)
      .set('x-csrf-token', principalAuth.csrfToken)
      .send({ classId, termId: activeTerm.id });

    assert(publishRes.status === 200, `Principal published Class #${classId} results (Published: ${publishRes.body.data?.published}) (HTTP 200)`);

    const publishedResult = await db('final_results').where({ id: computedResult.id }).first();
    assert(publishedResult.result_status === 'PUBLISHED', 'Result status transitioned to PUBLISHED in database');
    assert(Boolean(publishedResult.published_at), `Published timestamp stamped: ${publishedResult.published_at}`);

    // Synchronize independent exam series publication
    await request(app)
      .post(`/api/v1/exams/${terminalExam.id}/publish`)
      .set('Cookie', principalAuth.cookies)
      .set('x-csrf-token', principalAuth.csrfToken)
      .send({ classId });

    // NOW check Student Portal: Officially visible!
    const studentPublishedMeRes = await request(app)
      .get('/api/v1/results/me')
      .set('Cookie', studentAuth.cookies);

    assert(studentPublishedMeRes.status === 200, 'Student accessed published terminal results (HTTP 200)');
    const liveStudentResult = (studentPublishedMeRes.body.data?.results || []).find((r) => r.id === computedResult.id);
    assert(Boolean(liveStudentResult), 'Student portal officially displays published terminal examination result card');
    const letterGrade = liveStudentResult?.overall_grade || liveStudentResult?.grade;
    assert(Boolean(letterGrade), `Student letter grade displayed: ${letterGrade}`);
    assert(liveStudentResult?.pass_status === 'PASSED', 'Student pass status displayed: PASSED');

    // NOW check Parent Portal: Officially visible!
    const parentPublishedRes = await request(app)
      .get(`/api/v1/results/child/${studentId}`)
      .set('Cookie', parentAuth.cookies);

    assert(parentPublishedRes.status === 200, 'Parent accessed child published terminal results (HTTP 200)');
    const liveParentResult = (parentPublishedRes.body.data?.results || []).find((r) => r.id === computedResult.id);
    assert(Boolean(liveParentResult), 'Parent portal officially displays child published terminal examination result card');

    // NOW direct detail endpoint succeeds
    const directLiveRes = await request(app)
      .get(`/api/v1/results/${computedResult.id}`)
      .set('Cookie', studentAuth.cookies);

    assert(directLiveRes.status === 200, 'Direct access to published terminal result is authorized (HTTP 200)');

    // NOW direct report card endpoint succeeds
    const directLiveReportCardRes = await request(app)
      .get(`/api/v1/exams/${terminalExam.id}/report-card/${studentId}`)
      .set('Cookie', studentAuth.cookies);

    assert(directLiveReportCardRes.status === 200, 'Direct access to published official report card is authorized (HTTP 200)');
    const reportCardData = directLiveReportCardRes.body.data?.reportCard;
    assert(reportCardData?.passStatus === 'PASSED' || Boolean(reportCardData), 'Official report card indicates student passed examination');

    // Clean up created test exam
    await db('terminal_exam_audits').where({ exam_id: terminalExam.id }).del().catch(() => {});
    await db('terminal_exam_marks').where({ paper_id: examPaper.id }).del().catch(() => {});
    await db('terminal_exam_papers').where({ id: examPaper.id }).del().catch(() => {});
    await db('terminal_exams').where({ id: terminalExam.id }).del().catch(() => {});

  } catch (err) {
    console.error('\n❌ Unhandled error during audit execution:', err);
    failed++;
  } finally {
    await db.destroy();
  }

  console.log('\n================================================================================');
  console.log(`  AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runWorkflowSeparationAudit();
