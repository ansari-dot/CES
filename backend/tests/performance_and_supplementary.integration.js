import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { db } from '../src/shared/db/knex.js';
import { sessionStore } from '../src/shared/session/sessionStore.js';
import { outboxWorker } from '../src/modules/performance/outbox.worker.js';
import { promotionsService } from '../src/modules/promotions/promotions.service.js';

async function runTests() {
  console.log('🚀 Starting Academic Performance & Supplementary Engine Test Suite...\n');

  const app = createApp();
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  let failed = 0;

  function report(name, ok, msg = '') {
    if (ok) {
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${name} -> ${msg}`);
      failed++;
    }
  }

  try {
    // 1. Fetch test users: Principal, Teacher, Student, Parent
    const principalUser = await db('users')
      .join('roles', 'users.role_id', 'roles.id')
      .whereIn('roles.code', ['PRINCIPAL', 'ADMIN'])
      .select('users.*', 'roles.code as role_code')
      .first();

    const teacher = await db('teachers')
      .join('users', 'teachers.user_id', 'users.id')
      .join('roles', 'users.role_id', 'roles.id')
      .select('teachers.id as teacher_id', 'users.id as user_id', 'users.full_name', 'roles.code as role_code')
      .first();

    const student = await db('students')
      .join('users', 'students.user_id', 'users.id')
      .select('students.id as student_id', 'users.id as user_id', 'users.full_name', 'students.current_class_id')
      .first();

    const session = await db('academic_sessions').first();
    const subject = await db('subjects').first();

    if (!principalUser || !teacher || !student || !session || !subject) {
      console.warn('⚠️ Insufficient test fixtures in database. Skipping live HTTP tests.');
      server.close();
      return;
    }

    // Create session tokens
    const principalSession = await sessionStore.createSession({
      userId: principalUser.id,
      roleCode: principalUser.role_code
    });
    const teacherSession = await sessionStore.createSession({
      userId: teacher.user_id,
      roleCode: teacher.role_code
    });

    const principalHeaders = {
      Cookie: `sms_sid=${principalSession.sessionId}`,
      'Content-Type': 'application/json'
    };
    const teacherHeaders = {
      Cookie: `sms_sid=${teacherSession.sessionId}`,
      'Content-Type': 'application/json'
    };

    // -----------------------------------------------------------------------
    // TEST 1: Policy Seeding & Retrieval
    // -----------------------------------------------------------------------
    console.log('--- 1. Academic Grading Policies ---');
    const policyRes = await fetch(`${baseUrl}/api/v1/performance/policies/active?sessionId=${session.id}`, {
      headers: principalHeaders
    });
    const policyJson = await policyRes.json();
    report(
      'Active grading policy fetched or seeded',
      policyRes.status === 200 && policyJson.data && Number(policyJson.data.monthly_test_weight) === 40,
      JSON.stringify(policyJson)
    );

    // -----------------------------------------------------------------------
    // TEST 2: Continuous Formative Scoring (Dynamic Normalization)
    // -----------------------------------------------------------------------
    console.log('\n--- 2. Continuous Formative Monitoring ---');
    const scoreRes = await fetch(
      `${baseUrl}/api/v1/performance/students/${student.student_id}/subjects/${subject.id}?sessionId=${session.id}`,
      { headers: principalHeaders }
    );
    const scoreJson = await scoreRes.json();
    report(
      'Student formative score calculated with dynamic normalization',
      scoreRes.status === 200 && scoreJson.data && typeof scoreJson.data.overallContinuousScore === 'number',
      JSON.stringify(scoreJson)
    );

    // -----------------------------------------------------------------------
    // TEST 3: 48-Hour Cooldown & Parent Alert Dispatch
    // -----------------------------------------------------------------------
    console.log('\n--- 3. 48-Hour Cooldown & Parent Alert ---');

    // Ensure a parent is linked to the student for the test
    let parentRel = await db('parent_student').where({ student_id: student.student_id }).first();
    if (!parentRel) {
      let parent = await db('parents').first();
      if (!parent) {
        // Find a parent user
        const pUser = await db('users').join('roles', 'users.role_id', 'roles.id').where('roles.code', 'PARENT').first();
        if (pUser) {
          const [pId] = await db('parents').insert({ user_id: pUser.id, verification_status: 'APPROVED' });
          parent = { id: pId };
        }
      }
      if (parent) {
        await db('parent_student').insert({
          parent_id: parent.id,
          student_id: student.student_id,
          relation: 'FATHER',
          is_primary: 1,
          linked_by: principalUser.id
        });
      }
    }

    // Clean any prior cooldown for student + subject
    await db('academic_alert_cooldowns').where({ student_id: student.student_id, subject_id: subject.id }).delete();

    // First Alert: should succeed
    const alertRes1 = await fetch(`${baseUrl}/api/v1/performance/alerts`, {
      method: 'POST',
      headers: teacherHeaders,
      body: JSON.stringify({
        studentId: student.student_id,
        subjectId: subject.id,
        sessionId: session.id,
        alertCategory: 'ATTENTION_NEEDED',
        title: 'Formative Assessment Notice',
        messageBody: 'Student requires additional focus on recent homework assignments.'
      })
    });
    const alertJson1 = await alertRes1.json();
    report(
      'First parent alert dispatched successfully & queued in outbox',
      alertRes1.status === 201 && alertJson1.success === true,
      JSON.stringify(alertJson1)
    );

    // Second Alert immediately: must be REJECTED by 48h cooldown
    const alertRes2 = await fetch(`${baseUrl}/api/v1/performance/alerts`, {
      method: 'POST',
      headers: teacherHeaders,
      body: JSON.stringify({
        studentId: student.student_id,
        subjectId: subject.id,
        sessionId: session.id,
        alertCategory: 'ATTENTION_NEEDED',
        title: 'Duplicate Notice',
        messageBody: 'This should be blocked by 48h cooldown.'
      })
    });
    const alertJson2 = await alertRes2.json();
    report(
      'Second alert within 48h without urgent flag is rejected with 429/Cooldown error',
      alertRes2.status === 429,
      `Status: ${alertRes2.status}`
    );

    // Third Alert with urgent override: must succeed and reset cooldown
    const alertRes3 = await fetch(`${baseUrl}/api/v1/performance/alerts`, {
      method: 'POST',
      headers: teacherHeaders,
      body: JSON.stringify({
        studentId: student.student_id,
        subjectId: subject.id,
        sessionId: session.id,
        alertCategory: 'CRITICAL_RISK',
        title: 'Emergency Intervention',
        messageBody: 'Urgent meeting required regarding student performance.',
        isUrgent: true,
        overrideReason: 'Severe performance drop requiring immediate parental consultation.'
      })
    });
    const alertJson3 = await alertRes3.json();
    report(
      'Urgent alert with justified override bypasses cooldown and resets 48h window',
      alertRes3.status === 201 && alertJson3.success === true,
      JSON.stringify(alertJson3)
    );

    // -----------------------------------------------------------------------
    // TEST 4: Transactional Outbox Worker Dispatch
    // -----------------------------------------------------------------------
    console.log('\n--- 4. Outbox Worker Dispatch ---');
    const outboxBatchResult = await outboxWorker.processBatch(10);
    report(
      'Outbox worker processed pending batch with lease token',
      outboxBatchResult.processed > 0 && outboxBatchResult.succeeded > 0,
      JSON.stringify(outboxBatchResult)
    );

    // -----------------------------------------------------------------------
    // TEST 5: Supplementary Exam Ledger Lifecycle
    // -----------------------------------------------------------------------
    console.log('\n--- 5. Supplementary Exam Ledger ---');

    // Create a mock failed terminal result for testing
    let finalResult = await db('final_results')
      .where({ student_id: student.student_id, session_id: session.id })
      .first();

    if (!finalResult) {
      let term = await db('academic_terms').where({ session_id: session.id }).first();
      if (!term) {
        const [tId] = await db('academic_terms').insert({
          session_id: session.id,
          name: 'Final Term',
          is_final: 1,
          start_date: '2026-11-01',
          end_date: '2026-12-31'
        });
        term = { id: tId };
      }

      let enrollment = await db('enrollments')
        .where({ student_id: student.student_id, session_id: session.id })
        .first();
      if (!enrollment) {
        const [enrId] = await db('enrollments').insert({
          student_id: student.student_id,
          session_id: session.id,
          class_id: student.current_class_id || 1,
          enrolled_on: '2026-01-01',
          status: 'ACTIVE'
        });
        enrollment = { id: enrId, class_id: student.current_class_id || 1 };
      }

      const [frId] = await db('final_results').insert({
        enrollment_id: enrollment.id,
        student_id: student.student_id,
        class_id: enrollment.class_id,
        session_id: session.id,
        term_id: term.id,
        total_marks: 100,
        obtained_marks: 30,
        percentage: 30,
        overall_grade: 'F',
        pass_status: 'SUPPLEMENTARY',
        result_status: 'PUBLISHED'
      });

      finalResult = {
        id: frId,
        student_id: student.student_id,
        class_id: enrollment.class_id,
        session_id: session.id
      };
    }

    // Select an un-tested subject for this student so test is 100% idempotent
    const existingSuppSubjectIds = (await db('supplementary_exam_results').where({ student_id: student.student_id }).select('subject_id')).map(r => r.subject_id);
    const testSubject = await db('subjects').whereNotIn('id', existingSuppSubjectIds).first() || subject;

    let frSubject = await db('final_result_subjects')
      .where({ final_result_id: finalResult.id, subject_id: testSubject.id })
      .first();

    if (!frSubject) {
      const [frsId] = await db('final_result_subjects').insert({
        final_result_id: finalResult.id,
        subject_id: testSubject.id,
        total_marks: 100,
        obtained_marks: 32,
        percentage: 32,
        grade: 'F',
        is_absent: 0,
        passed: 0,
        source: 'MANUAL'
      });
      frSubject = { id: frsId };
    }

    // Step 5.1: Initialize Supplementary Record
    const initRes = await fetch(`${baseUrl}/api/v1/supplementary/initialize`, {
      method: 'POST',
      headers: principalHeaders,
      body: JSON.stringify({ finalResultSubjectId: frSubject.id })
    });
    const initJson = await initRes.json();
    const suppId = initJson.data?.id;
    report(
      'Supplementary exam initialized in AWAITING_SCHEDULE',
      (initRes.status === 201 || initRes.status === 200) && suppId && initJson.data.status === 'AWAITING_SCHEDULE',
      JSON.stringify(initJson)
    );

    // Step 5.2: Create a dummy date sheet entry to schedule
    let dse = await db('date_sheet_entries').where({ subject_id: testSubject.id }).first();
    if (!dse) {
      let ds = await db('examination_date_sheets').first();
      if (!ds) {
        const [dsId] = await db('examination_date_sheets').insert({
          session_id: session.id,
          class_id: finalResult.class_id,
          exam_name: 'Supplementary Examination 2026',
          exam_type: 'FINAL_TERM',
          start_date: '2026-11-20',
          end_date: '2026-11-30',
          status: 'PUBLISHED',
          created_by: principalUser.id
        });
        ds = { id: dsId };
      }
      const [newDseId] = await db('date_sheet_entries').insert({
        date_sheet_id: ds.id,
        subject_id: testSubject.id,
        exam_date: '2026-11-25',
        start_time: '09:00:00',
        end_time: '12:00:00',
        total_marks: 100,
        passing_marks: 40
      });
      dse = { id: newDseId, exam_date: '2026-11-25' };
    }

    // Schedule the supplementary exam
    const schedRes = await fetch(`${baseUrl}/api/v1/supplementary/${suppId}/schedule`, {
      method: 'PATCH',
      headers: principalHeaders,
      body: JSON.stringify({
        mode: 'MODE_A',
        dateSheetEntryId: dse.id,
        examDate: '2026-11-25'
      })
    });
    const schedJson = await schedRes.json();
    report(
      'Supplementary exam scheduled via Mode A',
      schedRes.status === 200 && schedJson.data.status === 'SCHEDULED',
      JSON.stringify(schedJson)
    );

    // Step 5.3: Record Marks in DRAFT
    const marksRes = await fetch(`${baseUrl}/api/v1/supplementary/${suppId}/marks`, {
      method: 'PATCH',
      headers: teacherHeaders,
      body: JSON.stringify({
        obtainedMarks: 65,
        isAbsent: false,
        remarks: 'Significant improvement in core areas.'
      })
    });
    const marksJson = await marksRes.json();
    report(
      'Marks recorded in DRAFT with backend pass/fail calculation (65/100 -> PASSED)',
      marksRes.status === 200 && marksJson.data.is_passed === 1 && marksJson.data.status === 'DRAFT',
      JSON.stringify(marksJson)
    );

    // Step 5.4: Submit Marks
    const submitRes = await fetch(`${baseUrl}/api/v1/supplementary/${suppId}/submit`, {
      method: 'PATCH',
      headers: teacherHeaders
    });
    const submitJson = await submitRes.json();
    report(
      'Supplementary marks submitted for approval',
      submitRes.status === 200 && submitJson.data.status === 'SUBMITTED',
      JSON.stringify(submitJson)
    );

    // Step 5.5: Approve Result (Executive)
    const approveRes = await fetch(`${baseUrl}/api/v1/supplementary/${suppId}/approve`, {
      method: 'PATCH',
      headers: principalHeaders
    });
    const approveJson = await approveRes.json();
    report(
      'Supplementary result approved by Principal',
      approveRes.status === 200 && approveJson.data.status === 'APPROVED',
      JSON.stringify(approveJson)
    );

    // Step 5.6: Publish Result (Executive)
    const publishRes = await fetch(`${baseUrl}/api/v1/supplementary/${suppId}/publish`, {
      method: 'PATCH',
      headers: principalHeaders
    });
    const publishJson = await publishRes.json();
    report(
      'Supplementary result published & made authoritative',
      publishRes.status === 200 && publishJson.data.status === 'PUBLISHED',
      JSON.stringify(publishJson)
    );

    // Step 5.7: Database Trigger Immutability Verification
    // Direct SQL update to published record must FAIL via trigger trg_supp_prevent_update
    let triggerBlocked = false;
    try {
      await db('supplementary_exam_results').where({ id: suppId }).update({ obtained_marks: 99 });
    } catch (dbErr) {
      triggerBlocked = dbErr.message.includes('Published supplementary results cannot be modified');
    }
    report(
      'Database Trigger protects published supplementary record from direct alteration',
      triggerBlocked,
      'Direct modification was rejected by database trigger'
    );

    // Step 5.8: Auditable Correction Workflow
    const corrRes = await fetch(`${baseUrl}/api/v1/supplementary/${suppId}/correction`, {
      method: 'POST',
      headers: principalHeaders,
      body: JSON.stringify({
        correctionReason: 'Scrutiny re-check: clerical mark tabulation error corrected.',
        obtainedMarks: 72,
        remarks: 'Corrected after paper re-count'
      })
    });
    const corrJson = await corrRes.json();
    const oldSup = await db('supplementary_exam_results').where({ id: suppId }).first();
    report(
      'Auditable correction issued: old record marked SUPERSEDED with superseded_by_id pointing to new v1 record',
      corrRes.status === 200 && corrJson.data.correction_version === 1 && oldSup.status === 'SUPERSEDED' && oldSup.superseded_by_id === corrJson.data.id,
      JSON.stringify(corrJson)
    );

    // -----------------------------------------------------------------------
    // TEST 6: Promotion Integration & Worksheet Re-evaluation
    // -----------------------------------------------------------------------
    console.log('\n--- 6. Authoritative Promotion Integration ---');
    await promotionsService.evaluate({ sessionId: session.id }, principalUser);

    const promotionRecord = await db('promotion_records')
      .where({ student_id: student.student_id, session_id: session.id })
      .first();

    report(
      'Promotion worksheet cleared failed subject: student eligibility updated to ELIGIBLE without modifying Terminal Card',
      promotionRecord && promotionRecord.eligibility === 'ELIGIBLE',
      `Eligibility: ${promotionRecord?.eligibility}`
    );

    // Verify original terminal marks are unchanged
    const originalCard = await db('final_result_subjects').where({ id: frSubject.id }).first();
    report(
      'Original Terminal Exam marks and pass flag preserved untouched (immutability intact)',
      originalCard.obtained_marks == 32 && originalCard.passed == 0,
      `Obtained: ${originalCard.obtained_marks}, Passed: ${originalCard.passed}`
    );

  } catch (error) {
    console.error('Fatal test error:', error);
    failed++;
  } finally {
    server.close();
    console.log(`\n========================================`);
    console.log(`Results: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
