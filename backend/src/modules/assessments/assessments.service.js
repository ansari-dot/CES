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
import { zoomRepository } from '../zoom/zoom.repository.js';

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

    const classId = Number(data.class_id ?? data.classId);
    const subjectId = Number(data.subject_id ?? data.subjectId);

    if (user.role === 'TEACHER') {
      const scope = await getTeacherScope(user.id);
      if (!scope.teacher) throw forbidden('Teacher profile not found for this account.');
      if (!scope.pairs.has(`${classId}-${subjectId}`)) {
        throw forbidden('You are not assigned to teach this subject in the selected class.');
      }
      teacherId = scope.teacher.id;
    } else if (isStaff(user)) {
      teacherId = data.teacher_id || data.teacherId;
      if (!teacherId) {
        // Resolve default assigned teacher
        const ta = await db('teacher_assignments')
          .where({ class_id: classId, subject_id: subjectId })
          .first();
        teacherId = ta ? ta.teacher_id : null;
      }
      if (!teacherId) throw validationError('Please specify a valid teacher for this test.');
    } else {
      throw forbidden();
    }

    const sessionId = data.session_id || data.sessionId || (await getCurrentSessionId());
    if (!sessionId) throw validationError('Active academic session is required.');

    // Validate schedule & timing
    const duration = Number(data.duration_minutes || data.durationMinutes || 45);
    if (!Number.isInteger(duration) || duration < 5 || duration > 300) {
      throw validationError('Duration must be between 5 and 300 minutes.');
    }

    const availableFrom = new Date(data.available_from || data.availableFrom);
    const availableUntil = new Date(data.available_until || data.availableUntil);
    if (isNaN(availableFrom.getTime()) || isNaN(availableUntil.getTime())) {
      throw validationError('Valid availability start and end dates/times are required.');
    }
    if (availableFrom >= availableUntil) {
      throw validationError('Availability start time must be before end time.');
    }

    const totalMarks = Number(data.total_marks || data.totalMarks || 20);
    const passingMarks = Number(data.passing_marks || data.passingMarks || 8);
    if (passingMarks > totalMarks) {
      throw validationError('Passing marks cannot exceed total marks.');
    }

    // Questions validation
    const questions = Array.isArray(data.questions) ? data.questions : [];
    let computedTotalMarks = 0;

    questions.forEach((q, idx) => {
      const qNum = idx + 1;
      const qText = q.question_text || q.prompt;
      if (!qText || !String(qText).trim()) {
        throw validationError(`Question #${qNum} text is required.`);
      }
      const qMarks = Number(q.marks || 1);
      if (qMarks <= 0) throw validationError(`Question #${qNum} marks must be positive.`);
      computedTotalMarks += qMarks;

      const qType = q.question_type || q.questionType;
      if (qType === 'MCQ') {
        if (!Array.isArray(q.options) || q.options.length < 2) {
          throw validationError(`MCQ #${qNum} must have at least 2 options.`);
        }
        const correctOpt = q.correct_option || q.correctOption;
        if (!correctOpt) {
          throw validationError(`MCQ #${qNum} must designate a correct option key (e.g. 'A').`);
        }
      }
    });

    const finalTotalMarks = questions.length > 0 ? computedTotalMarks : totalMarks;

    const rawExamType = data.exam_type || data.examType;
    const examType = ['MONTHLY_TEST', 'MID_TERM', 'FINAL_TERM', 'CLASS_QUIZ'].includes(rawExamType)
      ? rawExamType
      : 'MONTHLY_TEST';

    const isDedicatedExam = examType === 'MID_TERM' || examType === 'FINAL_TERM';
    const schedulingMode = isDedicatedExam ? 'DEDICATED_EXAM' : (data.scheduling_mode || data.schedulingMode || 'TIMETABLE_ASSESSMENT');

    const test = await db.transaction(async (trx) => {
      const created = await assessmentsRepository.createTest(
        {
          session_id: sessionId,
          class_id: classId,
          subject_id: subjectId,
          teacher_id: teacherId,
          exam_type: examType,
          scheduling_mode: schedulingMode,
          date_sheet_entry_id: (data.date_sheet_entry_id || data.dateSheetEntryId) ? Number(data.date_sheet_entry_id || data.dateSheetEntryId) : null,
          timetable_slot_id: (data.timetable_slot_id || data.timetableSlotId) ? Number(data.timetable_slot_id || data.timetableSlotId) : null,
          assessment_timing: data.assessment_timing || data.assessmentTiming || (isDedicatedExam ? 'STANDALONE' : 'ENTIRE_LECTURE'),
          term_name: data.term_name || data.termName || (examType === 'MID_TERM' ? 'Mid-Term' : examType === 'FINAL_TERM' ? 'Final-Term' : data.month_name || null),
          title: data.title.trim(),
          description: data.description ? data.description.trim() : null,
          month_name: data.month_name || data.monthName || (examType === 'MID_TERM' ? 'Mid-Term Exam' : examType === 'FINAL_TERM' ? 'Final-Term Exam' : 'Monthly Assessment'),
          duration_minutes: duration,
          total_marks: finalTotalMarks,
          passing_marks: Math.min(passingMarks, finalTotalMarks),
          available_from: availableFrom,
          available_until: availableUntil,
          shuffle_questions: Boolean(data.shuffle_questions || data.shuffleQuestions),
          shuffle_options: Boolean(data.shuffle_options || data.shuffleOptions),
          max_attempts: 1,
          status: data.status || (data.publishImmediately ? 'PUBLISHED' : 'DRAFT'),
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
  /** Public test header sent to the student exam room. Never includes answers. */
  _publicTestInfo(test) {
    return {
      id: test.id,
      title: test.title,
      description: test.description || null,
      exam_type: test.exam_type,
      term_name: test.term_name || null,
      duration_minutes: test.duration_minutes,
      total_marks: test.total_marks,
      passing_marks: test.passing_marks,
      subject_name: test.subject_name,
      class_name: test.class_name
    };
  },

  /** Response shape the student ExamRoom consumes (nested attempt/test/questions). */
  _buildExamRoomPayload(test, attempt, questions, savedAnswers, now) {
    const answersByQuestion = new Map((savedAnswers || []).map((a) => [Number(a.question_id), a]));
    const expiresAt = parseDbDate(attempt.expires_at);
    const startedAt = parseDbDate(attempt.started_at);
    return {
      attempt: {
        id: attempt.id,
        test_id: attempt.test_id,
        student_id: attempt.student_id,
        status: attempt.status,
        started_at: startedAt ? startedAt.toISOString() : attempt.started_at,
        expires_at: expiresAt ? expiresAt.toISOString() : attempt.expires_at
      },
      remaining_seconds: expiresAt ? Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000)) : 0,
      server_time: now.toISOString(),
      test: this._publicTestInfo(test),
      questions: (questions || []).map((q) => {
        const saved = answersByQuestion.get(Number(q.id)) || null;
        return {
          id: q.id,
          section_name: q.section_name,
          section_instructions: q.section_instructions,
          question_type: q.question_type,
          prompt: q.question_text,
          image_url: q.image_url,
          marks: Number(q.marks),
          options: q.options || null,
          savedAnswer: saved
            ? {
                selected_option: saved.selected_option ?? null,
                answer_text: saved.text_answer ?? null,
                attachment_url: saved.attachment_url ?? null
              }
            : null
        };
      }),
      is_completed: false,
      isCompleted: false
    };
  },

  _buildCompletedRoomPayload(test, attempt, { message = null } = {}) {
    const startedAt = parseDbDate(attempt.started_at);
    const expiresAt = parseDbDate(attempt.expires_at);
    const resultsPublished = test.status === 'RESULTS_PUBLISHED';
    return {
      attempt: {
        id: attempt.id,
        test_id: attempt.test_id,
        student_id: attempt.student_id,
        status: attempt.status,
        started_at: startedAt ? startedAt.toISOString() : attempt.started_at,
        expires_at: expiresAt ? expiresAt.toISOString() : attempt.expires_at
      },
      remaining_seconds: 0,
      test: this._publicTestInfo(test),
      questions: [],
      is_completed: true,
      isCompleted: true,
      // Legacy flat fields kept for any other consumer
      status: attempt.status,
      attemptId: attempt.id,
      submittedAt: attempt.submitted_at,
      totalScore: resultsPublished ? attempt.total_score : null,
      isPassed: resultsPublished ? attempt.is_passed : null,
      message
    };
  },

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
        return this._buildCompletedRoomPayload(test, attempt);
      }

      // If IN_PROGRESS, check if expired
      const expiresAt = parseDbDate(attempt.expires_at);
      if (now.getTime() > expiresAt.getTime()) {
        // Auto-finalize expired attempt immediately
        await this.finalizeAttempt(attempt.id, 'AUTO_EXPIRED');
        attempt = await assessmentsRepository.findAttemptById(attempt.id);
        return this._buildCompletedRoomPayload(test, attempt, {
          message: 'Examination time has ended. Your answers have been submitted.'
        });
      }

      // Resume active attempt
      const questions = await assessmentsRepository.getQuestionsForTest(testId, { includeAnswers: false });
      const savedAnswers = await assessmentsRepository.getAttemptAnswers(attempt.id);
      return this._buildExamRoomPayload(test, attempt, questions, savedAnswers, now);
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
      try {
        return await assessmentsRepository.createAttempt(
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
      } catch (err) {
        // A parallel "enter room" request (double click, page remount or a
        // retried request) already created this student's attempt. Signal the
        // caller to resume it instead of surfacing a duplicate-key conflict.
        if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) return null;
        throw err;
      }
    });

    if (!attempt) {
      // The attempt now exists; take the resume path.
      return await this.startOrResumeAttempt(user, testId);
    }

    const questions = await assessmentsRepository.getQuestionsForTest(testId, { includeAnswers: false });
    return this._buildExamRoomPayload(test, attempt, questions, [], now);
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

    // The exam room sends camelCase keys; accept both conventions.
    const questionId = Number(data.question_id ?? data.questionId);
    if (!Number.isFinite(questionId) || questionId <= 0) {
      throw validationError('A valid questionId is required to save an answer.');
    }
    const saved = await assessmentsRepository.upsertAnswer({
      attemptId,
      questionId,
      selectedOption: data.selected_option ?? data.selectedOption ?? null,
      textAnswer: data.text_answer ?? data.textAnswer ?? data.answer_text ?? data.answerText ?? null,
      attachmentUrl: data.attachment_url ?? data.attachmentUrl ?? null,
      attachmentName: data.attachment_name ?? data.attachmentName ?? null
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
      // snake_case answer fields match the teacher grading modal's contract
      const studentAnswer = ans
        ? {
            id: ans.id,
            selected_option: ans.selected_option,
            answer_text: ans.text_answer,
            attachment_url: ans.attachment_url,
            attachment_name: ans.attachment_name,
            is_correct: ans.is_correct,
            marks_awarded: ans.marks_awarded != null ? Number(ans.marks_awarded) : null,
            teacher_feedback: ans.teacher_feedback
          }
        : null;
      return {
        ...q,
        prompt: q.question_text,
        studentAnswer
      };
    });

    return {
      // The grading modal reads the student identity from the attempt object
      attempt: {
        ...attempt,
        student_name: student ? student.student_name : null,
        roll_number: student ? student.roll_no : null,
        admission_number: student ? student.admission_no : null
      },
      student,
      test,
      questions: combinedQuestions
    };
  },

  async gradeAttempt(user, attemptId, { questionGrades, grades, teacherRemarks }) {
    const attempt = await assessmentsRepository.findAttemptById(attemptId);
    if (!attempt) throw notFound('Attempt not found.');

    const test = await assessmentsRepository.findTestById(attempt.test_id);
    await this.assertTeacherCanManageTest(user, test);

    // The grading modal sends `grades`; accept both payload key styles.
    const gradeItems = Array.isArray(questionGrades) ? questionGrades : Array.isArray(grades) ? grades : null;
    if (!gradeItems) {
      throw validationError('An array of question grades is required.');
    }

    const questions = await assessmentsRepository.getQuestionsForTest(test.id, { includeAnswers: true });
    const qMap = new Map(questions.map((q) => [Number(q.id), q]));

    let subjectiveScore = 0;

    await db.transaction(async (trx) => {
      for (const item of gradeItems) {
        const q = qMap.get(Number(item.questionId ?? item.question_id));
        if (!q) continue;

        if (q.question_type !== 'MCQ') {
          const marks = Number(item.marksAwarded ?? item.marks_awarded);
          if (isNaN(marks) || marks < 0 || marks > Number(q.marks)) {
            throw validationError(`Marks for question #${q.question_number} must be between 0 and ${q.marks}`);
          }
          subjectiveScore += marks;

          await trx('test_attempt_answers')
            .where({ attempt_id: attemptId, question_id: q.id })
            .update({
              marks_awarded: marks,
              teacher_feedback: item.teacherFeedback ?? item.teacher_feedback ?? null,
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
  },

  // -------------------------------------------------------------
  // Zoom Invigilation Integration (Mode A & Mode B)
  // -------------------------------------------------------------
  async getInvigilationSession(user, testId) {
    const test = await db('monthly_tests as mt')
      .join('classes as c', 'mt.class_id', 'c.id')
      .join('subjects as s', 'mt.subject_id', 's.id')
      .leftJoin('teachers as t', 'mt.teacher_id', 't.id')
      .leftJoin('users as tu', 't.user_id', 'tu.id')
      .where('mt.id', testId)
      .select(
        'mt.id',
        'mt.class_id',
        'c.name as class_name',
        'c.grade_level',
        'mt.subject_id',
        's.name as subject_name',
        's.code as subject_code',
        'mt.teacher_id',
        'tu.full_name as teacher_name',
        'mt.title',
        'mt.exam_type',
        'mt.scheduling_mode',
        'mt.available_from',
        'mt.available_until'
      )
      .first();

    if (!test) throw notFound('Assessment not found');

    // Security Check: Verify caller access
    if (user.role === 'STUDENT') {
      const student = await getStudentByUserId(user.id);
      if (!student) throw forbidden('Student record not found.');
      const studentClassId = student.current_class_id || (
        await db('enrollments')
          .where({ student_id: student.id, status: 'ACTIVE' })
          .select('class_id')
          .first()
      )?.class_id;

      if (Number(studentClassId) !== Number(test.class_id)) {
        throw forbidden('Access denied: You can only view invigilation sessions for your enrolled class.');
      }
    } else if (user.role === 'TEACHER') {
      const scope = await getTeacherScope(user.id);
      const isAssigned = scope.teacher && Number(scope.teacher.id) === Number(test.teacher_id);
      const teachesClass = scope.pairs.has(`${test.class_id}-${test.subject_id}`);
      if (!isAssigned && !teachesClass && !isStaff(user)) {
        throw forbidden('Access denied: You are not assigned to invigilate or teach this class.');
      }
    }

    // Retrieve the permanent virtual Zoom classroom for this class
    const meeting = await zoomRepository.getMeetingByClassId(test.class_id);
    if (!meeting) {
      throw validationError('No permanent Zoom classroom configured for this class.');
    }

    // Return sanitized participant information - NEVER expose host keys or start URLs to students
    return {
      testId: test.id,
      title: test.title,
      examType: test.exam_type,
      schedulingMode: test.scheduling_mode,
      classId: test.class_id,
      className: test.class_name,
      subjectName: test.subject_name,
      subjectCode: test.subject_code,
      invigilatorName: test.teacher_name || 'Assigned Invigilator',
      meetingId: meeting.zoom_meeting_id,
      joinUrl: meeting.joinUrl,
      passcode: meeting.passcode,
      topic: `${test.title} - ${test.class_name} (${test.subject_name})`,
      availableFrom: test.available_from,
      availableUntil: test.available_until,
      instructions: 'Please keep your webcam enabled throughout the examination. Ensure your workspace is clearly visible and your microphone is muted unless asked by the invigilator.'
    };
  },

  async startInvigilation(user, testId) {
    const test = await db('monthly_tests as mt')
      .join('classes as c', 'mt.class_id', 'c.id')
      .join('subjects as s', 'mt.subject_id', 's.id')
      .leftJoin('teachers as t', 'mt.teacher_id', 't.id')
      .leftJoin('users as tu', 't.user_id', 'tu.id')
      .where('mt.id', testId)
      .select(
        'mt.id',
        'mt.class_id',
        'c.name as class_name',
        'c.grade_level',
        'mt.subject_id',
        's.name as subject_name',
        'mt.teacher_id',
        'tu.full_name as teacher_name',
        'mt.title',
        'mt.exam_type',
        'mt.scheduling_mode',
        'mt.date_sheet_entry_id',
        'mt.available_from',
        'mt.available_until'
      )
      .first();

    if (!test) throw notFound('Assessment not found');

    let teacherId = test.teacher_id;
    if (user.role === 'TEACHER') {
      const scope = await getTeacherScope(user.id);
      if (!scope.teacher) throw forbidden('Teacher profile not found.');
      const isAssigned = Number(scope.teacher.id) === Number(test.teacher_id);
      const teachesClass = scope.pairs.has(`${test.class_id}-${test.subject_id}`);
      if (!isAssigned && !teachesClass) {
        throw forbidden('Only the assigned invigilator or subject teacher can launch this session.');
      }
      teacherId = scope.teacher.id;
    } else if (!isStaff(user)) {
      throw forbidden('Only faculty and administrators can launch invigilation sessions.');
    }

    const meeting = await zoomRepository.getMeetingByClassId(test.class_id);
    if (!meeting) {
      throw validationError('No permanent Zoom classroom configured for this class.');
    }

    // Audit Log: Record examination invigilation launch
    await auditRepository.recordAuditLog({
      actorId: user.id,
      actorName: user.name || user.full_name || 'Invigilator',
      actorRole: user.role_code || user.role,
      action: 'START_EXAM_INVIGILATION',
      recordType: 'EXAMINATION_INVIGILATION',
      recordIdentifier: `EXAM-${test.id}`,
      reason: `Started Zoom invigilation for ${test.title} (${test.subject_name}) in Class ${test.class_name} Room.`
    }).catch(() => {});

    // Create / Record Duty Session for verified invigilation
    let dutySessionId = null;
    try {
      const [dsId] = await db('teacher_duty_sessions').insert({
        teacher_id: teacherId,
        class_id: test.class_id,
        zoom_meeting_id: meeting.id,
        duty_type: 'EXAM_INVIGILATION',
        period_occurrence_id: `exam_${test.id}_${new Date().toISOString().split('T')[0]}`,
        date_sheet_entry_id: test.date_sheet_entry_id || null,
        session_start: new Date(),
        session_status: 'IN_PROGRESS',
        reconciliation_status: 'NOT_RECONCILED',
        audit_note: `Teacher started invigilation for ${test.title} (${test.subject_name}) in Class ${test.class_name} Zoom room.`
      });
      dutySessionId = dsId;
    } catch (err) {
      console.warn('Non-fatal: Failed to log duty session for invigilation:', err.message);
    }

    return {
      testId: test.id,
      title: test.title,
      meetingId: meeting.zoom_meeting_id,
      launchUrl: meeting.startUrl || meeting.joinUrl,
      hostKey: meeting.hostKey, // Securely returned to verified teacher
      sessionStartedAt: new Date().toISOString(),
      dutySessionId,
      role: 'INVIGILATOR'
    };
  }
};
