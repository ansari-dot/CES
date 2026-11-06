import { assessmentsRepository } from './assessments.repository.js';
import { db } from '../../shared/db/knex.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import {
  isStaff,
  forbidden,
  getTeacherScope,
  getStudentByUserId,
  getParentByUserId,
  getCurrentSessionId,
  getClassAudienceUserIds
} from '../../shared/services/accessScope.js';
import { parseDbDate } from '../../shared/utils/date.js';
import { notificationService } from '../../shared/services/notificationService.js';
import { dispatchSocketEvent } from '../../shared/realtime/eventEmitter.js';
import { auditRepository } from '../audit/audit.repository.js';

function validationError(message) {
  return new AppError(message, 422, ErrorCodes.VALIDATION_ERROR);
}

function notFound(message) {
  return new AppError(message, 404, ErrorCodes.NOT_FOUND);
}

export const assessmentsService = {
  // -------------------------------------------------------------
  // Teacher Test Creation & Management
  // -------------------------------------------------------------
  async createTest(user, data) {
    let teacherId = null;

    if (user.role === 'TEACHER') {
      const scope = await getTeacherScope(user.id);
      if (!scope.teacher) throw forbidden('Teacher profile not found for this account.');
      if (!scope.pairs.has(`${data.class_id}-${data.subject_id}`)) {
        throw forbidden('You are not assigned to teach this subject in the selected class.');
      }
      teacherId = scope.teacher.id;
    } else if (isStaff(user)) {
      teacherId = data.teacher_id;
      if (!teacherId) {
        // Resolve default assigned teacher
        const ta = await db('teacher_assignments')
          .where({ class_id: data.class_id, subject_id: data.subject_id })
          .first();
        teacherId = ta ? ta.teacher_id : null;
      }
      if (!teacherId) throw validationError('Please specify a valid teacher for this test.');
    } else {
      throw forbidden();
    }

    const sessionId = data.session_id || (await getCurrentSessionId());
    if (!sessionId) throw validationError('Active academic session is required.');

    // Validate schedule & timing
    const duration = Number(data.duration_minutes || 45);
    if (!Number.isInteger(duration) || duration < 5 || duration > 300) {
      throw validationError('Duration must be between 5 and 300 minutes.');
    }

    const availableFrom = new Date(data.available_from);
    const availableUntil = new Date(data.available_until);
    if (isNaN(availableFrom.getTime()) || isNaN(availableUntil.getTime())) {
      throw validationError('Valid availability start and end dates/times are required.');
    }
    if (availableFrom >= availableUntil) {
      throw validationError('Availability start time must be before end time.');
    }

    const totalMarks = Number(data.total_marks || 20);
    const passingMarks = Number(data.passing_marks || 8);
    if (passingMarks > totalMarks) {
      throw validationError('Passing marks cannot exceed total marks.');
    }

    // Questions validation
    const questions = Array.isArray(data.questions) ? data.questions : [];
    let computedTotalMarks = 0;

    questions.forEach((q, idx) => {
      const qNum = idx + 1;
      if (!q.question_text || !String(q.question_text).trim()) {
        throw validationError(`Question #${qNum} text is required.`);
      }
      const qMarks = Number(q.marks || 1);
      if (qMarks <= 0) throw validationError(`Question #${qNum} marks must be positive.`);
      computedTotalMarks += qMarks;

      if (q.question_type === 'MCQ') {
        if (!Array.isArray(q.options) || q.options.length < 2) {
          throw validationError(`MCQ #${qNum} must have at least 2 options.`);
        }
        if (!q.correct_option) {
          throw validationError(`MCQ #${qNum} must designate a correct option key (e.g. 'A').`);
        }
      }
    });

    const finalTotalMarks = questions.length > 0 ? computedTotalMarks : totalMarks;

    const examType = ['MONTHLY_TEST', 'MID_TERM', 'FINAL_TERM', 'CLASS_QUIZ'].includes(data.exam_type)
      ? data.exam_type
      : 'MONTHLY_TEST';

    const test = await db.transaction(async (trx) => {
      const created = await assessmentsRepository.createTest(
        {
          session_id: sessionId,
          class_id: data.class_id,
          subject_id: data.subject_id,
          teacher_id: teacherId,
          exam_type: examType,
          date_sheet_entry_id: data.date_sheet_entry_id ? Number(data.date_sheet_entry_id) : null,
          term_name: data.term_name || (examType === 'MID_TERM' ? 'Mid-Term' : examType === 'FINAL_TERM' ? 'Final-Term' : data.month_name || null),
          title: data.title.trim(),
          description: data.description ? data.description.trim() : null,
          month_name: data.month_name || (examType === 'MID_TERM' ? 'Mid-Term Exam' : examType === 'FINAL_TERM' ? 'Final-Term Exam' : 'Monthly Assessment'),
          duration_minutes: duration,
          total_marks: finalTotalMarks,
          passing_marks: Math.min(passingMarks, finalTotalMarks),
          available_from: availableFrom,
          available_until: availableUntil,
          shuffle_questions: Boolean(data.shuffle_questions),
          shuffle_options: Boolean(data.shuffle_options),
          max_attempts: 1,
          status: data.publishImmediately ? 'PUBLISHED' : 'DRAFT',
          created_by: user.id
        },
        trx
      );

      if (questions.length > 0) {
        await assessmentsRepository.replaceQuestions(created.id, questions, trx);
      }

      await auditRepository.recordAuditLog({
        actorId: user.id,
        actorName: user.name || user.username,
        actorRole: user.role,
        action: 'CREATE_MONTHLY_TEST',
        recordType: 'MONTHLY_TEST',
        recordIdentifier: String(created.id),
        reason: `Created monthly test: ${created.title} with total marks ${finalTotalMarks}`
      }).catch(() => {});

      return created;
    });

    return this.getTestDetails(user, test.id);
  },

  async updateTest(user, testId, data) {
    const test = await assessmentsRepository.findTestById(testId);
    if (!test) throw notFound('Monthly test not found.');

    await this.assertTeacherCanManageTest(user, test);

    // If test is already published or closed, check if attempts started
    const attempts = await db('test_attempts').where({ test_id: testId }).first();
    if (attempts && data.questions) {
      throw validationError('Cannot modify questions because students have already attempted this test.');
    }

    const updates = {};
    if (data.title) updates.title = data.title.trim();
    if (data.description !== undefined) updates.description = data.description;
    if (data.exam_type && ['MONTHLY_TEST', 'MID_TERM', 'FINAL_TERM', 'CLASS_QUIZ'].includes(data.exam_type)) {
      updates.exam_type = data.exam_type;
    }
    if (data.term_name !== undefined) updates.term_name = data.term_name;
    if (data.date_sheet_entry_id !== undefined) updates.date_sheet_entry_id = data.date_sheet_entry_id ? Number(data.date_sheet_entry_id) : null;
    if (data.month_name) updates.month_name = data.month_name;
    if (data.duration_minutes) updates.duration_minutes = Number(data.duration_minutes);
    if (data.passing_marks) updates.passing_marks = Number(data.passing_marks);
    if (data.available_from) updates.available_from = new Date(data.available_from);
    if (data.available_until) updates.available_until = new Date(data.available_until);
    if (data.shuffle_questions !== undefined) updates.shuffle_questions = Boolean(data.shuffle_questions);
    if (data.shuffle_options !== undefined) updates.shuffle_options = Boolean(data.shuffle_options);

    await db.transaction(async (trx) => {
      if (Array.isArray(data.questions) && !attempts) {
        let computedTotal = 0;
        data.questions.forEach((q, idx) => {
          computedTotal += Number(q.marks || 1);
        });
        updates.total_marks = computedTotal;
        await assessmentsRepository.replaceQuestions(testId, data.questions, trx);
      }

      if (Object.keys(updates).length > 0) {
        await assessmentsRepository.updateTest(testId, updates, trx);
      }
    });

    return this.getTestDetails(user, testId);
  },

  async publishTest(user, testId) {
    const test = await assessmentsRepository.findTestById(testId);
    if (!test) throw notFound('Monthly test not found.');
    await this.assertTeacherCanManageTest(user, test);

    const questions = await assessmentsRepository.getQuestionsForTest(testId);
    if (questions.length === 0) {
      throw validationError('Cannot publish an assessment with zero questions.');
    }

    const updated = await assessmentsRepository.updateTest(testId, { status: 'PUBLISHED' });

    // Notify class students & parents
    const audienceIds = await getClassAudienceUserIds([test.class_id], { includeStudents: true, includeParents: true });
    if (audienceIds.length > 0) {
      await notificationService.notifyUsers(audienceIds, {
        title: `New Monthly Test: ${test.title}`,
        message: `${test.subject_name} monthly test is now scheduled for your class. Duration: ${test.duration_minutes} minutes.`,
        type: 'Academic Updates'
      });
      dispatchSocketEvent('ASSESSMENT_PUBLISHED', { testId, title: test.title, classId: test.class_id });
    }

    return updated;
  },

  async closeTest(user, testId) {
    const test = await assessmentsRepository.findTestById(testId);
    if (!test) throw notFound('Monthly test not found.');
    await this.assertTeacherCanManageTest(user, test);

    return assessmentsRepository.updateTest(testId, { status: 'CLOSED' });
  },

  async getTestDetails(user, testId) {
    const test = await assessmentsRepository.findTestById(testId);
    if (!test) throw notFound('Monthly test not found.');

    const isTeacherOrStaff = user.role === 'TEACHER' || isStaff(user);
    const questions = await assessmentsRepository.getQuestionsForTest(testId, {
      includeAnswers: isTeacherOrStaff || test.status === 'RESULTS_PUBLISHED'
    });

    return { ...test, questions };
  },

  async listTests(user, query = {}) {
    const sessionId = query.sessionId || (await getCurrentSessionId());
    const limit = Math.min(Number(query.limit) || 50, 100);
    const offset = Number(query.offset) || 0;

    if (user.role === 'TEACHER') {
      const scope = await getTeacherScope(user.id);
      if (!scope.teacher) return { tests: [], total: 0 };
      const teacherId = scope.teacher.id;

      const [tests, total] = await Promise.all([
        assessmentsRepository.getTestsList({
          teacherId,
          classId: query.classId,
          subjectId: query.subjectId,
          status: query.status,
          examType: query.examType,
          sessionId,
          limit,
          offset
        }),
        assessmentsRepository.countTests({
          teacherId,
          classId: query.classId,
          subjectId: query.subjectId,
          status: query.status,
          examType: query.examType,
          sessionId
        })
      ]);
      return { tests, total };
    }

    if (isStaff(user)) {
      const [tests, total] = await Promise.all([
        assessmentsRepository.getTestsList({
          classId: query.classId,
          subjectId: query.subjectId,
          teacherId: query.teacherId,
          status: query.status,
          examType: query.examType,
          sessionId,
          limit,
          offset
        }),
        assessmentsRepository.countTests({
          classId: query.classId,
          subjectId: query.subjectId,
          teacherId: query.teacherId,
          status: query.status,
          examType: query.examType,
          sessionId
        })
      ]);
      return { tests, total };
    }

    throw forbidden();
  },

  // -------------------------------------------------------------
  // Student Exam Engine (Timed Attempts & Auto-Submission)
  // -------------------------------------------------------------
  async startOrResumeAttempt(user, testId) {
    if (user.role !== 'STUDENT') throw forbidden('Only students can take assessments.');
    const student = await getStudentByUserId(user.id);
    if (!student) throw forbidden('Student record not found.');

    const test = await assessmentsRepository.findTestById(testId);
    if (!test) throw notFound('Assessment not found.');

    if (test.status !== 'PUBLISHED' && test.status !== 'CLOSED') {
      throw validationError('This test is not currently active.');
    }

    // Verify class enrollment
    if (Number(test.class_id) !== Number(student.current_class_id)) {
      throw forbidden('You are not enrolled in the class assigned to this test.');
    }

    const now = new Date();

    // Check for existing attempt
    let attempt = await assessmentsRepository.findAttemptByTestAndStudent(testId, student.id);

    if (attempt) {
      // Check if attempt is already completed
      if (attempt.status !== 'IN_PROGRESS') {
        return {
          status: attempt.status,
          attemptId: attempt.id,
          submittedAt: attempt.submitted_at,
          totalScore: test.status === 'RESULTS_PUBLISHED' ? attempt.total_score : null,
          isPassed: test.status === 'RESULTS_PUBLISHED' ? attempt.is_passed : null,
          isCompleted: true
        };
      }

      // If IN_PROGRESS, check if expired
      const expiresAt = parseDbDate(attempt.expires_at);
      if (now.getTime() > expiresAt.getTime()) {
        // Auto-finalize expired attempt immediately
        await this.finalizeAttempt(attempt.id, 'AUTO_EXPIRED');
        attempt = await assessmentsRepository.findAttemptById(attempt.id);
        return {
          status: attempt.status,
          attemptId: attempt.id,
          submittedAt: attempt.submitted_at,
          isCompleted: true,
          message: 'Examination time has ended. Your answers have been submitted.'
        };
      }

      // Resume active attempt
      const questions = await assessmentsRepository.getQuestionsForTest(testId, { includeAnswers: false });
      const savedAnswers = await assessmentsRepository.getAttemptAnswers(attempt.id);

      return {
        attemptId: attempt.id,
        testId: test.id,
        testTitle: test.title,
        durationMinutes: test.duration_minutes,
        startedAt: parseDbDate(attempt.started_at)?.toISOString() || attempt.started_at,
        expiresAt: expiresAt.toISOString(),
        serverTime: now.toISOString(),
        questions,
        savedAnswers,
        isCompleted: false
      };
    }

    // Creating new attempt: verify testing window
    const availableFrom = parseDbDate(test.available_from);
    const availableUntil = parseDbDate(test.available_until);

    if (now.getTime() < availableFrom.getTime()) {
      const waitSecs = Math.max(1, Math.ceil((availableFrom.getTime() - now.getTime()) / 1000));
      throw validationError(
        `This examination is not open yet. It is scheduled to start at ${availableFrom.toISOString()} (in ${waitSecs} seconds).`
      );
    }
    if (now.getTime() > availableUntil.getTime()) {
      throw validationError(
        `The examination availability cutoff time has passed (${availableUntil.toISOString()}). You have been marked absent/missed.`
      );
    }

    // Calculate server authoritative expiry
    const expiresAt = new Date(now.getTime() + test.duration_minutes * 60 * 1000);

    attempt = await db.transaction(async (trx) => {
      // Atomic insert preventing race condition
      return assessmentsRepository.createAttempt(
        {
          test_id: test.id,
          student_id: student.id,
          attempt_number: 1,
          started_at: now,
          expires_at: expiresAt,
          status: 'IN_PROGRESS'
        },
        trx
      );
    });

    const questions = await assessmentsRepository.getQuestionsForTest(testId, { includeAnswers: false });

    return {
      attemptId: attempt.id,
      testId: test.id,
      testTitle: test.title,
      durationMinutes: test.duration_minutes,
      startedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      serverTime: now.toISOString(),
      questions,
      savedAnswers: [],
      isCompleted: false
    };
  },

  async saveAnswer(user, attemptId, data) {
    if (user.role !== 'STUDENT') throw forbidden();
    const student = await getStudentByUserId(user.id);
    if (!student) throw forbidden();

    const attempt = await assessmentsRepository.findAttemptById(attemptId);
    if (!attempt || Number(attempt.student_id) !== Number(student.id)) {
      throw notFound('Active test attempt not found.');
    }

    if (attempt.status !== 'IN_PROGRESS') {
      throw validationError('This examination attempt has already been submitted and locked.');
    }

    const now = new Date();
    const expiresAt = parseDbDate(attempt.expires_at);

    // Enforce server-authoritative timer
    if (now.getTime() > expiresAt.getTime()) {
      // Time elapsed: auto-finalize and reject further edits
      await this.finalizeAttempt(attemptId, 'AUTO_EXPIRED');
      throw new AppError('Time has expired! Your test has been automatically submitted.', 403, ErrorCodes.FORBIDDEN);
    }

    const saved = await assessmentsRepository.upsertAnswer({
      attemptId,
      questionId: data.question_id,
      selectedOption: data.selected_option || null,
      textAnswer: data.text_answer || null,
      attachmentUrl: data.attachment_url || null,
      attachmentName: data.attachment_name || null
    });

    return { success: true, savedAt: saved.saved_at };
  },

  async submitAttempt(user, attemptId) {
    if (user.role !== 'STUDENT') throw forbidden();
    const student = await getStudentByUserId(user.id);
    if (!student) throw forbidden();

    const attempt = await assessmentsRepository.findAttemptById(attemptId);
    if (!attempt || Number(attempt.student_id) !== Number(student.id)) {
      throw notFound('Attempt not found.');
    }

    if (attempt.status !== 'IN_PROGRESS') {
      return { success: true, message: 'Already submitted.', status: attempt.status };
    }

    return this.finalizeAttempt(attemptId, 'MANUAL');
  },

  async finalizeAttempt(attemptId, trigger = 'MANUAL') {
    const attempt = await assessmentsRepository.findAttemptById(attemptId);
    if (!attempt) return null;
    if (attempt.status !== 'IN_PROGRESS') return attempt;

    const test = await assessmentsRepository.findTestById(attempt.test_id);
    const questions = await assessmentsRepository.getQuestionsForTest(test.id, { includeAnswers: true });
    const answers = await assessmentsRepository.getAttemptAnswers(attemptId);

    const answerMap = new Map(answers.map((a) => [Number(a.question_id), a]));

    let mcqScore = 0;
    let hasSubjective = false;

    // Automatic MCQ Evaluation
    await db.transaction(async (trx) => {
      for (const q of questions) {
        const studentAns = answerMap.get(Number(q.id));

        if (q.question_type === 'MCQ') {
          const selected = studentAns?.selected_option ? String(studentAns.selected_option).trim().toUpperCase() : null;
          const isCorrect = selected && selected === String(q.correct_option).trim().toUpperCase();
          const marksAwarded = isCorrect ? Number(q.marks) : 0;

          if (isCorrect) mcqScore += marksAwarded;

          if (studentAns) {
            await trx('test_attempt_answers')
              .where({ id: studentAns.id })
              .update({
                is_correct: isCorrect,
                marks_awarded: marksAwarded,
                updated_at: trx.raw('CURRENT_TIMESTAMP(3)')
              });
          }
        } else {
          hasSubjective = true;
        }
      }

      // If test has no subjective questions, it is fully graded immediately!
      const isFullyGraded = !hasSubjective;
      const subjectiveScore = isFullyGraded ? 0 : null;
      const totalScore = isFullyGraded ? mcqScore : null;
      const isPassed = isFullyGraded ? totalScore >= Number(test.passing_marks) : null;
      const nextStatus = isFullyGraded ? 'GRADED' : 'SUBMITTED';

      await assessmentsRepository.updateAttempt(
        attemptId,
        {
          submitted_at: new Date(),
          submission_trigger: trigger,
          status: nextStatus,
          mcq_score: mcqScore,
          subjective_score: subjectiveScore,
          total_score: totalScore,
          is_passed: isPassed
        },
        trx
      );
    });

    dispatchSocketEvent('ASSESSMENT_ATTEMPT_SUBMITTED', {
      testId: test.id,
      studentId: attempt.student_id,
      trigger
    });

    return assessmentsRepository.findAttemptById(attemptId);
  },

  // -------------------------------------------------------------
  // Teacher Grading Workstation & Publishing
  // -------------------------------------------------------------
  async getTestSubmissions(user, testId) {
    const test = await assessmentsRepository.findTestById(testId);
    if (!test) throw notFound('Monthly test not found.');
    await this.assertTeacherCanManageTest(user, test);

    return assessmentsRepository.getTestSubmissionsRoster(testId);
  },

  async getAttemptForGrading(user, attemptId) {
    const attempt = await assessmentsRepository.findAttemptById(attemptId);
    if (!attempt) throw notFound('Attempt not found.');

    const test = await assessmentsRepository.findTestById(attempt.test_id);
    await this.assertTeacherCanManageTest(user, test);

    const student = await db('students')
      .join('users', 'students.user_id', 'users.id')
      .where('students.id', attempt.student_id)
      .select('students.*', 'users.full_name as student_name', 'users.email as student_email')
      .first();

    const questions = await assessmentsRepository.getQuestionsForTest(test.id, { includeAnswers: true });
    const answers = await assessmentsRepository.getAttemptAnswers(attemptId);
    const answerMap = new Map(answers.map((a) => [Number(a.question_id), a]));

    const combinedQuestions = questions.map((q) => {
      const ans = answerMap.get(Number(q.id));
      return {
        ...q,
        studentAnswer: ans
          ? {
              id: ans.id,
              selectedOption: ans.selected_option,
              textAnswer: ans.text_answer,
              attachmentUrl: ans.attachment_url,
              attachmentName: ans.attachment_name,
              isCorrect: ans.is_correct,
              marksAwarded: ans.marks_awarded != null ? Number(ans.marks_awarded) : null,
              teacherFeedback: ans.teacher_feedback
            }
          : null
      };
    });

    return {
      attempt,
      student,
      test,
      questions: combinedQuestions
    };
  },

  async gradeAttempt(user, attemptId, { questionGrades, teacherRemarks }) {
    const attempt = await assessmentsRepository.findAttemptById(attemptId);
    if (!attempt) throw notFound('Attempt not found.');

    const test = await assessmentsRepository.findTestById(attempt.test_id);
    await this.assertTeacherCanManageTest(user, test);

    const questions = await assessmentsRepository.getQuestionsForTest(test.id, { includeAnswers: true });
    const qMap = new Map(questions.map((q) => [Number(q.id), q]));

    let subjectiveScore = 0;

    await db.transaction(async (trx) => {
      for (const item of questionGrades) {
        const q = qMap.get(Number(item.questionId));
        if (!q) continue;

        if (q.question_type !== 'MCQ') {
          const marks = Number(item.marksAwarded);
          if (isNaN(marks) || marks < 0 || marks > Number(q.marks)) {
            throw validationError(`Marks for question #${q.question_number} must be between 0 and ${q.marks}`);
          }
          subjectiveScore += marks;

          await trx('test_attempt_answers')
            .where({ attempt_id: attemptId, question_id: q.id })
            .update({
              marks_awarded: marks,
              teacher_feedback: item.teacherFeedback || null,
              updated_at: trx.raw('CURRENT_TIMESTAMP(3)')
            });
        }
      }

      const totalScore = Number(attempt.mcq_score) + subjectiveScore;
      const isPassed = totalScore >= Number(test.passing_marks);

      await assessmentsRepository.updateAttempt(
        attemptId,
        {
          subjective_score: subjectiveScore,
          total_score: totalScore,
          is_passed: isPassed,
          teacher_remarks: teacherRemarks || null,
          graded_by: user.id,
          graded_at: new Date(),
          status: 'GRADED'
        },
        trx
      );
    });

    return this.getAttemptForGrading(user, attemptId);
  },

  async publishResults(user, testId) {
    const test = await assessmentsRepository.findTestById(testId);
    if (!test) throw notFound('Monthly test not found.');
    await this.assertTeacherCanManageTest(user, test);

    // Verify all submitted attempts are graded
    const pending = await db('test_attempts')
      .where({ test_id: testId, status: 'SUBMITTED' })
      .count('id as count')
      .first();

    if (Number(pending?.count || 0) > 0) {
      throw validationError(`Cannot publish results. There are ${pending.count} submission(s) pending grading.`);
    }

    await assessmentsRepository.updateTest(testId, { status: 'RESULTS_PUBLISHED' });

    // Notify students & parents of published results
    const audienceIds = await getClassAudienceUserIds([test.class_id], { includeStudents: true, includeParents: true });
    if (audienceIds.length > 0) {
      await notificationService.notifyUsers(audienceIds, {
        title: `Results Published: ${test.title}`,
        message: `Marks for ${test.subject_name} monthly test have been evaluated and published.`,
        type: 'Academic Updates'
      });
      dispatchSocketEvent('ASSESSMENT_RESULTS_PUBLISHED', { testId, title: test.title, classId: test.class_id });
    }

    return { success: true, message: 'Monthly test results published successfully.' };
  },

  // -------------------------------------------------------------
  // Student Portal Overview & Results
  // -------------------------------------------------------------
  async getStudentAssessments(user) {
    if (user.role !== 'STUDENT') throw forbidden();
    const student = await getStudentByUserId(user.id);
    if (!student) throw forbidden();

    const sessionId = await getCurrentSessionId();
    const allTests = await assessmentsRepository.getStudentAssessmentsList(student.id, student.current_class_id, sessionId);

    const availableTests = allTests.filter(
      (t) => t.attemptStatus === 'UPCOMING' || t.attemptStatus === 'LIVE' || t.attemptStatus === 'IN_PROGRESS'
    );
    const completedTests = allTests.filter(
      (t) => t.attemptStatus === 'SUBMITTED' || t.attemptStatus === 'GRADED' || t.attemptStatus === 'AUTO_EXPIRED' || t.isMissed
    );
    const missedTests = allTests.filter((t) => t.isMissed);

    return {
      allTests,
      availableTests,
      completedTests,
      missedTests
    };
  },

  async getStudentTestResult(user, testId) {
    if (user.role !== 'STUDENT') throw forbidden();
    const student = await getStudentByUserId(user.id);
    if (!student) throw forbidden();

    const test = await assessmentsRepository.findTestById(testId);
    if (!test) throw notFound('Assessment not found.');

    if (test.status !== 'RESULTS_PUBLISHED') {
      throw validationError('Results for this test have not been published yet.');
    }

    const attempt = await assessmentsRepository.findAttemptByTestAndStudent(testId, student.id);
    if (!attempt) {
      throw notFound('No submission record found for this examination.');
    }

    const questions = await assessmentsRepository.getQuestionsForTest(testId, { includeAnswers: true });
    const answers = await assessmentsRepository.getAttemptAnswers(attempt.id);
    const answerMap = new Map(answers.map((a) => [Number(a.question_id), a]));

    const combinedQuestions = questions.map((q) => {
      const ans = answerMap.get(Number(q.id));
      return {
        ...q,
        studentAnswer: ans
          ? {
              selected_option: ans.selected_option,
              answer_text: ans.answer_text,
              attachment_url: ans.attachment_url,
              is_correct: ans.is_correct,
              marks_awarded: Number(ans.marks_awarded || 0),
              teacher_feedback: ans.teacher_feedback
            }
          : null
      };
    });

    return {
      attempt,
      test,
      questions: combinedQuestions
    };
  },

  // -------------------------------------------------------------
  // Parent Portal Result Access
  // -------------------------------------------------------------
  async getParentChildAssessments(user, studentId) {
    if (user.role !== 'PARENT') throw forbidden();
    const parent = await getParentByUserId(user.id);
    if (!parent) throw forbidden();

    // Verify parent-student linkage
    const link = await db('parent_student')
      .where({ parent_id: parent.id, student_id: studentId })
      .first();
    if (!link) throw forbidden('Access denied. Student is not linked to your parent account.');

    return assessmentsRepository.getParentChildAssessments(studentId);
  },

  // -------------------------------------------------------------
  // Helper Authorizations
  // -------------------------------------------------------------
  async assertTeacherCanManageTest(user, test) {
    if (isStaff(user)) return;
    if (user.role === 'TEACHER') {
      const scope = await getTeacherScope(user.id);
      if (scope.teacher && Number(scope.teacher.id) === Number(test.teacher_id)) return;
      if (scope.pairs.has(`${test.class_id}-${test.subject_id}`)) return;
    }
    throw forbidden('You do not have permission to manage this assessment.');
  }
};
