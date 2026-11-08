import { db } from '../../shared/db/knex.js';

export const assessmentsRepository = {
  // -------------------------------------------------------------
  // Test Management
  // -------------------------------------------------------------
  async createTest(testData, trx = db) {
    const [id] = await trx('monthly_tests').insert(testData);
    return this.findTestById(id, trx);
  },

  async updateTest(testId, updates, trx = db) {
    await trx('monthly_tests')
      .where({ id: testId })
      .update({ ...updates, updated_at: trx.raw('CURRENT_TIMESTAMP(3)') });
    return this.findTestById(testId, trx);
  },

  async findTestById(testId, trx = db) {
    const test = await trx('monthly_tests')
      .join('classes', 'monthly_tests.class_id', 'classes.id')
      .join('subjects', 'monthly_tests.subject_id', 'subjects.id')
      .join('teachers', 'monthly_tests.teacher_id', 'teachers.id')
      .join('users as teacher_users', 'teachers.user_id', 'teacher_users.id')
      .where('monthly_tests.id', testId)
      .select(
        'monthly_tests.*',
        'classes.name as class_name',
        'subjects.name as subject_name',
        'subjects.code as subject_code',
        'teacher_users.full_name as teacher_name'
      )
      .first();

    if (!test) return null;
    return {
      ...test,
      total_marks: Number(test.total_marks),
      passing_marks: Number(test.passing_marks)
    };
  },

  async getTestsList({ classId, subjectId, teacherId, status, examType, sessionId, limit = 50, offset = 0 }) {
    let query = db('monthly_tests')
      .join('classes', 'monthly_tests.class_id', 'classes.id')
      .join('subjects', 'monthly_tests.subject_id', 'subjects.id')
      .join('teachers', 'monthly_tests.teacher_id', 'teachers.id')
      .join('users as teacher_users', 'teachers.user_id', 'teacher_users.id')
      .select(
        'monthly_tests.*',
        'classes.name as class_name',
        'subjects.name as subject_name',
        'subjects.code as subject_code',
        'teacher_users.full_name as teacher_name'
      );

    if (sessionId) query = query.where('monthly_tests.session_id', sessionId);
    if (classId) query = query.where('monthly_tests.class_id', classId);
    if (subjectId) query = query.where('monthly_tests.subject_id', subjectId);
    if (teacherId) query = query.where('monthly_tests.teacher_id', teacherId);
    if (status) query = query.where('monthly_tests.status', status);
    if (examType) query = query.where('monthly_tests.exam_type', examType);

    return query.orderBy('monthly_tests.available_from', 'desc').limit(limit).offset(offset);
  },

  async countTests({ classId, subjectId, teacherId, status, examType, sessionId }) {
    let query = db('monthly_tests');
    if (sessionId) query = query.where('monthly_tests.session_id', sessionId);
    if (classId) query = query.where('monthly_tests.class_id', classId);
    if (subjectId) query = query.where('monthly_tests.subject_id', subjectId);
    if (teacherId) query = query.where('monthly_tests.teacher_id', teacherId);
    if (status) query = query.where('monthly_tests.status', status);
    if (examType) query = query.where('monthly_tests.exam_type', examType);

    const res = await query.count('id as total').first();
    return Number(res?.total || 0);
  },

  // -------------------------------------------------------------
  // Question Management
  // -------------------------------------------------------------
  async replaceQuestions(testId, questionsList, trx = db) {
    // Delete existing questions
    await trx('test_questions').where({ test_id: testId }).delete();

    if (!questionsList || questionsList.length === 0) return [];

    const toInsert = questionsList.map((q, idx) => ({
      test_id: testId,
      question_number: q.question_number || idx + 1,
      section_name: q.section_name || q.sectionName || 'Part 1',
      section_instructions: q.section_instructions || q.sectionInstructions || null,
      question_type: q.question_type || q.questionType || 'MCQ',
      question_text: q.question_text || q.prompt,
      image_url: q.image_url || q.imageUrl || null,
      marks: Number(q.marks || 1),
      options: q.options ? JSON.stringify(q.options) : null,
      correct_option: (q.correct_option || q.correctOption) ? String(q.correct_option || q.correctOption).toUpperCase().trim() : null,
      rubric_guide: q.rubric_guide || q.rubricGuide || null
    }));

    await trx('test_questions').insert(toInsert);
    return this.getQuestionsForTest(testId, { includeAnswers: true }, trx);
  },

  async getQuestionsForTest(testId, { includeAnswers = false } = {}, trx = db) {
    const columns = [
      'id',
      'test_id',
      'question_number',
      'section_name',
      'section_instructions',
      'question_type',
      'question_text',
      'image_url',
      'marks',
      'options',
      'rubric_guide'
    ];
    if (includeAnswers) {
      columns.push('correct_option');
    }

    const rows = await trx('test_questions')
      .where({ test_id: testId })
      .select(columns)
      .orderBy('question_number', 'asc');

    return rows.map((r) => ({
      ...r,
      marks: Number(r.marks),
      options: typeof r.options === 'string' ? JSON.parse(r.options) : r.options || []
    }));
  },

  // -------------------------------------------------------------
  // Attempts & Live Exam Sessions
  // -------------------------------------------------------------
  async findAttemptById(attemptId, trx = db) {
    return trx('test_attempts').where({ id: attemptId }).first();
  },

  async findAttemptByTestAndStudent(testId, studentId, trx = db) {
    return trx('test_attempts')
      .where({ test_id: testId, student_id: studentId })
      .orderBy('attempt_number', 'desc')
      .first();
  },

  async createAttempt(attemptData, trx = db) {
    const [id] = await trx('test_attempts').insert(attemptData);
    return this.findAttemptById(id, trx);
  },

  async updateAttempt(attemptId, updates, trx = db) {
    await trx('test_attempts')
      .where({ id: attemptId })
      .update({ ...updates, updated_at: trx.raw('CURRENT_TIMESTAMP(3)') });
    return this.findAttemptById(attemptId, trx);
  },

  async upsertAnswer({ attemptId, questionId, selectedOption, textAnswer, attachmentUrl, attachmentName }, trx = db) {
    const existing = await trx('test_attempt_answers')
      .where({ attempt_id: attemptId, question_id: questionId })
      .first();

    if (existing) {
      await trx('test_attempt_answers')
        .where({ id: existing.id })
        .update({
          selected_option: selectedOption !== undefined ? selectedOption : existing.selected_option,
          text_answer: textAnswer !== undefined ? textAnswer : existing.text_answer,
          attachment_url: attachmentUrl !== undefined ? attachmentUrl : existing.attachment_url,
          attachment_name: attachmentName !== undefined ? attachmentName : existing.attachment_name,
          saved_at: trx.raw('CURRENT_TIMESTAMP(3)'),
          updated_at: trx.raw('CURRENT_TIMESTAMP(3)')
        });
      return trx('test_attempt_answers').where({ id: existing.id }).first();
    } else {
      const [id] = await trx('test_attempt_answers').insert({
        attempt_id: attemptId,
        question_id: questionId,
        selected_option: selectedOption || null,
        text_answer: textAnswer || null,
        attachment_url: attachmentUrl || null,
        attachment_name: attachmentName || null
      });
      return trx('test_attempt_answers').where({ id }).first();
    }
  },

  async getAttemptAnswers(attemptId, trx = db) {
    return trx('test_attempt_answers')
      .where({ attempt_id: attemptId })
      .orderBy('question_id', 'asc');
  },

  async findExpiredInProgressAttempts(nowDate = new Date()) {
    return db('test_attempts')
      .where('status', 'IN_PROGRESS')
      .where('expires_at', '<=', nowDate)
      .limit(50);
  },

  // -------------------------------------------------------------
  // Teacher Submissions Roster & Grading
  // -------------------------------------------------------------
  async getTestSubmissionsRoster(testId) {
    const test = await this.findTestById(testId);
    if (!test) return null;

    // Get all enrolled active students in that class
    const students = await db('enrollments')
      .join('students', 'enrollments.student_id', 'students.id')
      .join('users', 'students.user_id', 'users.id')
      .where({
        'enrollments.class_id': test.class_id,
        'enrollments.session_id': test.session_id,
        'enrollments.status': 'ACTIVE'
      })
      .select(
        'students.id as student_id',
        'students.roll_no as roll_number',
        'students.admission_no as admission_number',
        'users.full_name as student_name',
        'users.email as student_email'
      )
      .orderBy('students.roll_no', 'asc');

    // Get all attempts for this test
    const attempts = await db('test_attempts')
      .where({ test_id: testId })
      .select('*');

    const attemptsByStudent = new Map(attempts.map((a) => [Number(a.student_id), a]));
    const now = new Date();
    const isWindowClosed = now > new Date(test.available_until);

    const roster = students.map((std) => {
      const attempt = attemptsByStudent.get(Number(std.student_id));
      let status = 'NOT_STARTED';
      let isMissed = false;

      if (attempt) {
        status = attempt.status;
      } else if (isWindowClosed) {
        status = 'MISSED';
        isMissed = true;
      }

      return {
        studentId: std.student_id,
        rollNumber: std.roll_number,
        admissionNumber: std.admission_number,
        studentName: std.student_name,
        studentEmail: std.student_email,
        attemptId: attempt ? attempt.id : null,
        status,
        isMissed,
        startedAt: attempt ? attempt.started_at : null,
        submittedAt: attempt ? attempt.submitted_at : null,
        submissionTrigger: attempt ? attempt.submission_trigger : (isMissed ? 'MISSED_WINDOW' : null),
        mcqScore: attempt ? Number(attempt.mcq_score) : 0,
        subjectiveScore: attempt && attempt.subjective_score != null ? Number(attempt.subjective_score) : (isMissed ? 0 : null),
        totalScore: attempt && attempt.total_score != null ? Number(attempt.total_score) : (isMissed ? 0 : null),
        isPassed: attempt ? attempt.is_passed : (isMissed ? 0 : null),
        teacherRemarks: attempt ? attempt.teacher_remarks : (isMissed ? 'Student missed examination window (Absent)' : null),
        gradedAt: attempt ? attempt.graded_at : null
      };
    });

    const totalStudents = roster.length;
    const submittedCount = roster.filter((r) => r.status === 'SUBMITTED' || r.status === 'GRADED').length;
    const gradedCount = roster.filter((r) => r.status === 'GRADED').length;
    const missedCount = roster.filter((r) => r.status === 'MISSED').length;
    const inProgressCount = roster.filter((r) => r.status === 'IN_PROGRESS').length;
    const pendingGradingCount = submittedCount - gradedCount;

    const gradedScores = roster
      .filter((r) => r.status === 'GRADED' && r.totalScore != null)
      .map((r) => r.totalScore);
    const averageScore = gradedScores.length > 0
      ? Number((gradedScores.reduce((a, b) => a + b, 0) / gradedScores.length).toFixed(2))
      : 0;

    return {
      test,
      metrics: {
        totalStudents,
        submittedCount,
        gradedCount,
        missedCount,
        inProgressCount,
        pendingGradingCount,
        averageScore
      },
      roster,
      // Aliases matching the teacher grading modal's contract
      submissions: roster,
      rosterSummary: {
        totalEnrolled: totalStudents,
        totalSubmitted: submittedCount,
        totalGraded: gradedCount,
        pendingEvaluation: pendingGradingCount
      }
    };
  },

  async updateAnswerGrading(answerId, { marksAwarded, teacherFeedback }, trx = db) {
    await trx('test_attempt_answers')
      .where({ id: answerId })
      .update({
        marks_awarded: marksAwarded,
        teacher_feedback: teacherFeedback || null,
        updated_at: trx.raw('CURRENT_TIMESTAMP(3)')
      });
  },

  // -------------------------------------------------------------
  // Student Portal Queries
  // -------------------------------------------------------------
  async getStudentAssessmentsList(studentId, classId, sessionId) {
    const tests = await db('monthly_tests')
      .join('subjects', 'monthly_tests.subject_id', 'subjects.id')
      .where('monthly_tests.class_id', classId)
      .where('monthly_tests.session_id', sessionId)
      .whereIn('monthly_tests.status', ['PUBLISHED', 'CLOSED', 'RESULTS_PUBLISHED'])
      .select(
        'monthly_tests.*',
        'subjects.name as subject_name',
        'subjects.code as subject_code'
      )
      .orderBy('monthly_tests.available_from', 'desc');

    const attempts = await db('test_attempts')
      .where({ student_id: studentId })
      .whereIn('test_id', tests.map((t) => t.id));

    const attemptsByStudent = new Map(attempts.map((a) => [Number(a.test_id), a]));
    const now = new Date();

    return tests.map((t) => {
      const attempt = attemptsByStudent.get(Number(t.id));
      const availableFrom = new Date(t.available_from);
      const availableUntil = new Date(t.available_until);

      let calculatedStatus = 'UPCOMING';
      let isMissed = false;

      if (attempt) {
        calculatedStatus = attempt.status;
      } else {
        if (now < availableFrom) {
          calculatedStatus = 'UPCOMING';
        } else if (now >= availableFrom && now <= availableUntil) {
          calculatedStatus = 'LIVE';
        } else {
          calculatedStatus = 'MISSED';
          isMissed = true;
        }
      }

      const secondsUntilOpen = now < availableFrom ? Math.max(0, Math.floor((availableFrom.getTime() - now.getTime()) / 1000)) : 0;
      const secondsRemainingInWindow = (now >= availableFrom && now <= availableUntil) ? Math.max(0, Math.floor((availableUntil.getTime() - now.getTime()) / 1000)) : 0;

      return {
        id: t.id,
        title: t.title,
        description: t.description,
        examType: t.exam_type || 'MONTHLY_TEST',
        termName: t.term_name || t.month_name,
        dateSheetEntryId: t.date_sheet_entry_id,
        monthName: t.month_name,
        subjectId: t.subject_id,
        subjectName: t.subject_name,
        subjectCode: t.subject_code,
        durationMinutes: t.duration_minutes,
        totalMarks: Number(t.total_marks),
        passingMarks: Number(t.passing_marks),
        availableFrom: t.available_from,
        availableUntil: t.available_until,
        testStatus: t.status,
        attemptStatus: calculatedStatus,
        isMissed,
        isLive: calculatedStatus === 'LIVE',
        isUpcoming: calculatedStatus === 'UPCOMING',
        secondsUntilOpen,
        secondsRemainingInWindow,
        attemptId: attempt ? attempt.id : null,
        startedAt: attempt ? attempt.started_at : null,
        expiresAt: attempt ? attempt.expires_at : null,
        submittedAt: attempt ? attempt.submitted_at : null,
        mcqScore: attempt ? Number(attempt.mcq_score) : (isMissed ? 0 : null),
        subjectiveScore: attempt && attempt.subjective_score != null ? Number(attempt.subjective_score) : (isMissed ? 0 : null),
        totalScore: attempt && t.status === 'RESULTS_PUBLISHED' ? Number(attempt.total_score) : (isMissed ? 0 : null),
        isPassed: attempt && t.status === 'RESULTS_PUBLISHED' ? attempt.is_passed : (isMissed ? 0 : null),
        teacherRemarks: attempt && t.status === 'RESULTS_PUBLISHED' ? attempt.teacher_remarks : (isMissed ? 'Marked Absent — Examination window closed without attempt' : null)
      };
    });
  },

  // -------------------------------------------------------------
  // Parent & Principal Queries
  // -------------------------------------------------------------
  async getParentChildAssessments(studentId) {
    const attempts = await db('test_attempts')
      .join('monthly_tests', 'test_attempts.test_id', 'monthly_tests.id')
      .join('subjects', 'monthly_tests.subject_id', 'subjects.id')
      .join('classes', 'monthly_tests.class_id', 'classes.id')
      .where('test_attempts.student_id', studentId)
      .where('monthly_tests.status', 'RESULTS_PUBLISHED')
      .where('test_attempts.status', 'GRADED')
      .select(
        'test_attempts.id as attempt_id',
        'monthly_tests.id as test_id',
        'monthly_tests.title',
        'monthly_tests.exam_type',
        'monthly_tests.term_name',
        'monthly_tests.month_name',
        'classes.name as class_name',
        'subjects.name as subject_name',
        'monthly_tests.total_marks',
        'monthly_tests.passing_marks',
        'test_attempts.mcq_score',
        'test_attempts.subjective_score',
        'test_attempts.total_score',
        'test_attempts.is_passed',
        'test_attempts.teacher_remarks',
        'test_attempts.graded_at'
      )
      .orderBy('test_attempts.graded_at', 'desc');

    return attempts.map((a) => ({
      ...a,
      total_marks: Number(a.total_marks),
      passing_marks: Number(a.passing_marks),
      mcq_score: Number(a.mcq_score),
      subjective_score: a.subjective_score != null ? Number(a.subjective_score) : 0,
      total_score: Number(a.total_score)
    }));
  }
};
