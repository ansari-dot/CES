import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { db } from '../src/shared/db/knex.js';
import { examService } from '../src/modules/exam/exam.service.js';
import {
  evaluatePaperMarks,
  evaluateOverallExamStatus,
  computeGrade
} from '../src/modules/exam/exam.policy.js';

async function runTerminalExamTests() {
  console.log('🚀 Starting Dedicated Online Terminal Examination Module Test Suite...\n');

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
    // Test 1: Grading Policy & Letter Grade Calculations
    // -------------------------------------------------------------
    console.log('--- 1. Testing Cambridge Letter Grade Computations ---');
    assert(computeGrade(95) === 'A*', '95% maps to Cambridge grade A*');
    assert(computeGrade(85) === 'A', '85% maps to Cambridge grade A');
    assert(computeGrade(75) === 'B', '75% maps to Cambridge grade B');
    assert(computeGrade(65) === 'C', '65% maps to Cambridge grade C');
    assert(computeGrade(55) === 'D', '55% maps to Cambridge grade D');
    assert(computeGrade(45) === 'E', '45% maps to Cambridge grade E');
    assert(computeGrade(35) === 'U', '35% maps to Cambridge grade U (Fail)');

    // -------------------------------------------------------------
    // Test 2: Multi-Section Paper Marks Evaluation
    // -------------------------------------------------------------
    console.log('\n--- 2. Testing Multi-Section Online Paper Marks Evaluation ---');
    const normalEval = evaluatePaperMarks({
      theoryObtained: 72,
      practicalObtained: 18,
      maxTheory: 80,
      maxPractical: 20,
      passingMarks: 40
    });
    assert(normalEval.totalObtained === 90, 'Total obtained marks correctly sums 72 + 18 = 90');
    assert(normalEval.percentage === 90, 'Percentage correctly calculated as 90%');
    assert(normalEval.grade === 'A*', 'Grade correctly evaluated as A*');
    assert(normalEval.isPassed === 1, 'Mark correctly flagged as passed');

    const absentEval = evaluatePaperMarks({
      theoryObtained: null,
      practicalObtained: null,
      maxTheory: 80,
      maxPractical: 20,
      passingMarks: 40,
      isAbsent: true,
      absentPolicy: 'FAIL'
    });
    assert(absentEval.isPassed === 0, 'Absent student fails when absentPolicy is FAIL');
    assert(absentEval.grade === 'U', 'Absent student receives grade U');

    // -------------------------------------------------------------
    // Test 3: Overall Student Exam Pass/Fail Status Determination
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing Overall Exam Pass/Fail & Supplementary Status ---');
    const mockPolicy = {
      min_overall_percentage: 40,
      max_failed_subjects: 0,
      supplementary_allowed: 1,
      max_supplementary_subjects: 2,
      absent_policy: 'FAIL'
    };

    const studentPass = evaluateOverallExamStatus({
      totalMarks: 500,
      obtainedMarks: 380,
      failedCount: 0,
      absentCount: 0,
      policy: mockPolicy
    });
    assert(studentPass.passStatus === 'PASSED', 'Student with 0 fails and 76% is PASSED');

    const studentSupp = evaluateOverallExamStatus({
      totalMarks: 500,
      obtainedMarks: 310,
      failedCount: 1,
      absentCount: 0,
      policy: mockPolicy
    });
    assert(studentSupp.passStatus === 'SUPPLEMENTARY', 'Student with 1 failed subject gets SUPPLEMENTARY when policy allows');

    const studentFail = evaluateOverallExamStatus({
      totalMarks: 500,
      obtainedMarks: 210,
      failedCount: 3,
      absentCount: 0,
      policy: mockPolicy
    });
    assert(studentFail.passStatus === 'FAILED', 'Student with 3 failed subjects exceeds supplementary limit and is FAILED');

    // -------------------------------------------------------------
    // Test 4: End-to-End Online Exam Lifecycle (Database Integration)
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing End-to-End Online Examination Lifecycle in Database ---');

    const session = (await db('academic_sessions').where({ is_current: 1 }).first()) || (await db('academic_sessions').first());
    assert(Boolean(session), `Found academic session: ${session?.name || 'N/A'}`);

    const term = await db('academic_terms').where({ session_id: session.id }).first();
    assert(Boolean(term), `Found academic term: ${term?.name || 'N/A'}`);

    const adminUser =
      (await db('users')
        .join('roles', 'users.role_id', 'roles.id')
        .where('roles.code', 'ADMIN')
        .select('users.*', 'roles.code as role')
        .first()) || (await db('users').first());
    if (adminUser && !adminUser.role) adminUser.role = 'ADMIN';
    assert(Boolean(adminUser), `Found actor user: ${adminUser?.username || 'N/A'}`);

    const schoolClass = await db('classes').first();
    const subject = await db('subjects').first();
    assert(Boolean(schoolClass && subject), 'Found class and subject for online exam paper');

    let createdExamId = null;
    let createdPaperId = null;

    if (session && term && schoolClass && subject && adminUser) {
      // 4a. Create Online Terminal Exam Series
      const newExam = await examService.createExam(
        {
          sessionId: session.id,
          termId: term.id,
          title: 'Automated Online Annual Exam 2026',
          examType: 'TERMINAL',
          startDate: '2026-12-01',
          endDate: '2026-12-15'
        },
        adminUser
      );
      createdExamId = newExam.id;
      assert(newExam && newExam.title === 'Automated Online Annual Exam 2026', 'createExam creates terminal_exams record');

      // 4b. Create Online Exam Paper
      const newPaper = await examService.createPaper(
        createdExamId,
        {
          classId: schoolClass.id,
          subjectId: subject.id,
          paperDate: '2026-12-02',
          startTime: '09:00 AM',
          endTime: '12:00 PM',
          maxTheoryMarks: 80,
          maxPracticalMarks: 20,
          passingMarks: 40
        },
        adminUser
      );
      createdPaperId = newPaper.id;
      assert(newPaper && Number(newPaper.total_marks) === 100, 'createPaper creates terminal_exam_papers with total_marks = 100');

      // 4c. Load Marks Sheet
      const sheet = await examService.getPaperMarksSheet(createdPaperId, adminUser);
      assert(sheet && Array.isArray(sheet.roster), 'getPaperMarksSheet loads student roster');

      // 4d. Submit Marks if students exist
      if (sheet.roster.length > 0) {
        const testStudent = sheet.roster[0];
        const submitResult = await examService.submitPaperMarks(
          createdPaperId,
          {
            action: 'SUBMIT',
            marks: [
              {
                studentId: testStudent.studentId,
                theoryObtained: 70,
                practicalObtained: 15,
                isAbsent: false,
                teacherRemarks: 'Excellent performance in online test'
              }
            ]
          },
          adminUser
        );
        assert(submitResult.status === 'MARKS_SUBMITTED', 'submitPaperMarks sets status to MARKS_SUBMITTED');

        // Check audit trail
        const audits = await db('terminal_exam_audits').where('change_reason', 'like', '%Marks submitted%');
        assert(audits.length > 0, 'terminal_exam_audits records the marks submission audit log');

        // 4e. Calculate Results & Sync to final_results
        const calcResult = await examService.calculateResults(createdExamId, schoolClass.id, adminUser);
        assert(calcResult.totalCalculated > 0, 'calculateResults computes class results');

        // Verify final_results synchronization
        const syncedResult = await db('final_results')
          .where({
            student_id: testStudent.studentId,
            term_id: term.id,
            session_id: session.id
          })
          .first();
        assert(Boolean(syncedResult), 'calculateResults synchronizes header to final_results');
        assert(Number(syncedResult.obtained_marks) === 85, 'final_results reflects accurate total obtained marks (85)');

        // 4f. Publish Exam
        const pubResult = await examService.publishExam(createdExamId, schoolClass.id, adminUser);
        assert(pubResult.isPublished === true, 'publishExam sets exam status to COMPLETED and published');

        // 4g. Retrieve Report Card
        const report = await examService.getStudentReportCard(createdExamId, testStudent.studentId, adminUser);
        assert(
          report.reportCard && report.reportCard.studentName,
          `Official report card generated for student: ${report.reportCard.studentName}`
        );
      }
    }

    // -------------------------------------------------------------
    // Cleanup Test Data
    // -------------------------------------------------------------
    if (createdExamId) {
      await db('terminal_exams').where({ id: createdExamId }).delete();
      console.log('  🧹 Cleaned up test examination records.');
    }
  } catch (err) {
    console.error('💥 Unexpected error during test run:', err);
    failed++;
  } finally {
    console.log(`\n========================================`);
    console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
    console.log(`========================================\n`);
    await db.destroy();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTerminalExamTests();

