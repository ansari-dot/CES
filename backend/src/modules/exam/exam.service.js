import { db } from '../../shared/db/knex.js';
import { examRepository } from './exam.repository.js';
import { academicRepository } from '../academic/academic.repository.js';
import { resultsRepository } from '../results/results.repository.js';
import { evaluatePaperMarks, evaluateOverallExamStatus, round2 } from './exam.policy.js';
import { EXAM_STATUS, PAPER_STATUS, MARK_STATUS, AUDIT_ACTIONS } from './exam.constants.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import {
  isStaff,
  forbidden,
  getTeacherScope,
  assertCanViewStudent
} from '../../shared/services/accessScope.js';
import { notificationService } from '../../shared/services/notificationService.js';

export const examService = {
  /**
   * Create a new Terminal Examination series.
   */
  async createExam({ sessionId, termId, title, examType, startDate, endDate }, actor) {
    if (!isStaff(actor)) throw forbidden('Only administrators and principals can create exams.');

    const session = await academicRepository.getSessionById(sessionId);
    if (!session) throw new AppError('Academic session not found', 404, ErrorCodes.NOT_FOUND);
    if (session.status === 'CLOSED') {
      throw new AppError('Cannot create an exam for a closed academic year', 409, ErrorCodes.INVALID_STATE);
    }

    const term = await resultsRepository.getTermById(termId);
    if (!term || Number(term.session_id) !== Number(sessionId)) {
      throw new AppError('Term not found or does not belong to this academic session', 404, ErrorCodes.NOT_FOUND);
    }

    const examId = await examRepository.createExam({
      session_id: sessionId,
      term_id: termId,
      title,
      exam_type: examType || 'TERMINAL',
      start_date: startDate,
      end_date: endDate,
      status: EXAM_STATUS.SCHEDULED,
      created_by: actor.id
    });

    notificationService.notify({
      title: 'New Examination Series Created',
      message: `${title} (${term.name}) has been scheduled.`,
      type: 'Exam Created',
      targetRole: 'PRINCIPAL',
      relatedRecordId: String(examId),
      relatedRecordType: 'TerminalExam',
      priority: 'Medium'
    });

    return await examRepository.getExamById(examId);
  },

  /**
   * List all examination series with filters.
   */
  async listExams(query, user) {
    return await examRepository.listExams({
      sessionId: query.sessionId,
      termId: query.termId,
      status: query.status,
      examType: query.examType
    });
  },

  /**
   * Get examination details by ID.
   */
  async getExamDetail(id, user) {
    const exam = await examRepository.getExamById(Number(id));
    if (!exam) throw new AppError('Examination not found', 404, ErrorCodes.NOT_FOUND);
    return exam;
  },

  /**
   * Add an exam paper (class, subject, timings, marks configuration).
   */
  async createPaper(examId, paperData, actor) {
    if (!isStaff(actor)) throw forbidden('Only staff can configure exam papers.');

    const exam = await examRepository.getExamById(Number(examId));
    if (!exam) throw new AppError('Examination not found', 404, ErrorCodes.NOT_FOUND);
    if (exam.status === EXAM_STATUS.CANCELLED || exam.status === EXAM_STATUS.COMPLETED) {
      throw new AppError('Cannot add papers to a completed or cancelled exam', 409, ErrorCodes.INVALID_STATE);
    }

    const maxTheory = Number(paperData.maxTheoryMarks || 100);
    const maxPractical = Number(paperData.maxPracticalMarks || 0);
    const totalMarks = round2(maxTheory + maxPractical);
    const passingMarks = Number(paperData.passingMarks || 40);

    const paperId = await examRepository.createPaper({
      exam_id: exam.id,
      class_id: paperData.classId,
      subject_id: paperData.subjectId,
      date_sheet_entry_id: paperData.dateSheetEntryId || null,
      paper_date: paperData.paperDate,
      start_time: paperData.startTime,
      end_time: paperData.endTime,
      max_theory_marks: maxTheory,
      max_practical_marks: maxPractical,
      total_marks: totalMarks,
      passing_marks: passingMarks,
      invigilator_teacher_id: paperData.invigilatorTeacherId || null,
      marking_teacher_id: paperData.markingTeacherId || null,
      status: PAPER_STATUS.SCHEDULED
    });

    return await examRepository.getPaperById(paperId);
  },

  /**
   * List papers for an examination series.
   */
  async listPapers(examId, query, user) {
    const filters = {
      classId: query.classId,
      markingTeacherId: query.markingTeacherId,
      status: query.status
    };

    if (user.role === 'TEACHER') {
      const scope = await getTeacherScope(user.id);
      if (scope.teacher) {
        filters.markingTeacherId = scope.teacher.id;
      }
    }

    return await examRepository.listPapersByExam(Number(examId), filters);
  },

  /**
   * Retrieves student marks-sheet for a paper (for teacher marks entry).
   */
  async getPaperMarksSheet(paperId, user) {
    const paper = await examRepository.getPaperById(Number(paperId));
    if (!paper) throw new AppError('Exam paper not found', 404, ErrorCodes.NOT_FOUND);

    if (user.role === 'TEACHER') {
      const scope = await getTeacherScope(user.id);
      if (!scope.teacher || (paper.marking_teacher_id && Number(paper.marking_teacher_id) !== Number(scope.teacher.id))) {
        if (!scope.pairs.has(`${paper.class_id}-${paper.subject_id}`)) {
          throw forbidden('You are not assigned to grade this exam paper.');
        }
      }
    } else if (!isStaff(user)) {
      throw forbidden();
    }

    const students = await examRepository.getEnrolledStudentsForClass(paper.class_id, paper.sessionId);
    const existingMarks = await examRepository.getMarksByPaper(paper.id);
    const marksByStudent = new Map(existingMarks.map((m) => [Number(m.student_id), m]));

    const roster = students.map((st) => {
      const mark = marksByStudent.get(Number(st.studentId));
      return {
        studentId: st.studentId,
        admissionNumber: st.admissionNumber,
        enrollmentId: st.enrollmentId,
        rollNo: st.rollNo,
        studentName: st.studentName,
        theoryObtained: mark ? (mark.theory_obtained !== null ? Number(mark.theory_obtained) : null) : null,
        practicalObtained: mark ? (mark.practical_obtained !== null ? Number(mark.practical_obtained) : null) : null,
        totalObtained: mark ? (mark.total_obtained !== null ? Number(mark.total_obtained) : null) : null,
        percentage: mark ? (mark.percentage !== null ? Number(mark.percentage) : null) : null,
        grade: mark?.grade || null,
        isAbsent: mark ? Boolean(mark.is_absent) : false,
        isExempt: mark ? Boolean(mark.is_exempt) : false,
        isPassed: mark ? (mark.is_passed !== null ? Boolean(mark.is_passed) : null) : null,
        teacherRemarks: mark?.teacher_remarks || null,
        status: mark?.status || MARK_STATUS.DRAFT
      };
    });

    return {
      paper: {
        id: paper.id,
        examId: paper.exam_id,
        examTitle: paper.examTitle,
        classId: paper.class_id,
        className: paper.className,
        subjectId: paper.subject_id,
        subjectName: paper.subjectName,
        subjectCode: paper.subjectCode,
        paperDate: paper.paper_date,
        startTime: paper.start_time,
        endTime: paper.end_time,
        maxTheoryMarks: Number(paper.max_theory_marks),
        maxPracticalMarks: Number(paper.max_practical_marks),
        totalMarks: Number(paper.total_marks),
        passingMarks: Number(paper.passing_marks),
        status: paper.status
      },
      roster
    };
  },

  /**
   * Teacher marks entry / submission for an exam paper.
   */
  async submitPaperMarks(paperId, { action, marks }, user) {
    const paper = await examRepository.getPaperById(Number(paperId));
    if (!paper) throw new AppError('Exam paper not found', 404, ErrorCodes.NOT_FOUND);

    if (paper.status === PAPER_STATUS.LOCKED) {
      throw new AppError('This paper is locked. Marks cannot be modified.', 409, ErrorCodes.INVALID_STATE);
    }

    if (user.role === 'TEACHER') {
      const scope = await getTeacherScope(user.id);
      if (!scope.teacher || (paper.marking_teacher_id && Number(paper.marking_teacher_id) !== Number(scope.teacher.id))) {
        if (!scope.pairs.has(`${paper.class_id}-${paper.subject_id}`)) {
          throw forbidden('You are not assigned to grade this exam paper.');
        }
      }
    } else if (!isStaff(user)) {
      throw forbidden();
    }

    const students = await examRepository.getEnrolledStudentsForClass(paper.class_id, paper.sessionId);
    const enrollmentMap = new Map(students.map((s) => [Number(s.studentId), s.enrollmentId]));

    const policy = await academicRepository.getEffectivePolicy(paper.sessionId);
    const absentPolicy = policy?.absent_policy || 'FAIL';

    const newPaperStatus = action === 'SUBMIT' ? PAPER_STATUS.MARKS_SUBMITTED : paper.status;
    const newMarkStatus = action === 'SUBMIT' ? MARK_STATUS.SUBMITTED : MARK_STATUS.DRAFT;

    let updatedCount = 0;

    await db.transaction(async (trx) => {
      for (const item of marks) {
        const studentId = Number(item.studentId);
        const enrollmentId = enrollmentMap.get(studentId);
        if (!enrollmentId) continue;

        const evaluated = evaluatePaperMarks({
          theoryObtained: item.theoryObtained,
          practicalObtained: item.practicalObtained,
          maxTheory: paper.max_theory_marks,
          maxPractical: paper.max_practical_marks,
          passingMarks: paper.passing_marks,
          isAbsent: item.isAbsent,
          isExempt: item.isExempt,
          absentPolicy
        });

        const markRecord = {
          paper_id: paper.id,
          student_id: studentId,
          enrollment_id: enrollmentId,
          theory_obtained: item.isAbsent || item.isExempt ? null : item.theoryObtained ?? null,
          practical_obtained: item.isAbsent || item.isExempt ? null : item.practicalObtained ?? null,
          total_obtained: evaluated.totalObtained,
          percentage: evaluated.percentage,
          grade: evaluated.grade,
          is_absent: item.isAbsent ? 1 : 0,
          is_exempt: item.isExempt ? 1 : 0,
          is_passed: evaluated.isPassed,
          teacher_remarks: item.teacherRemarks || null,
          entered_by: user.id,
          status: newMarkStatus
        };

        const result = await examRepository.upsertMark(markRecord, trx);
        updatedCount += 1;

        await examRepository.recordAudit(
          {
            mark_id: result.id,
            actor_id: user.id,
            action: result.isUpdate ? AUDIT_ACTIONS.UPDATE : AUDIT_ACTIONS.CREATE,
            old_theory: result.oldMark?.theory_obtained ?? null,
            new_theory: markRecord.theory_obtained,
            old_practical: result.oldMark?.practical_obtained ?? null,
            new_practical: markRecord.practical_obtained,
            old_absent: result.oldMark?.is_absent ?? null,
            new_absent: markRecord.is_absent,
            change_reason: action === 'SUBMIT' ? 'Marks submitted by teacher' : 'Draft marks updated'
          },
          trx
        );
      }

      await examRepository.updatePaper(paper.id, { status: newPaperStatus }, trx);
    });

    if (action === 'SUBMIT') {
      notificationService.notify({
        title: 'Exam Marks Submitted',
        message: `Marks for ${paper.className} - ${paper.subjectName} have been submitted by ${user.username || user.full_name}.`,
        type: 'Marks Submitted',
        targetRole: 'PRINCIPAL',
        relatedRecordId: String(paper.id),
        relatedRecordType: 'TerminalExamPaper',
        priority: 'Medium'
      });
    }

    return {
      paperId: paper.id,
      status: newPaperStatus,
      updatedCount,
      submittedAt: new Date().toISOString()
    };
  },

  /**
   * Principal/Coordinator marks verification & lock for a class in an exam.
   */
  async verifyClassMarks(examId, classId, actor) {
    if (!isStaff(actor)) throw forbidden('Only principals and administrators can verify marks.');

    const exam = await examRepository.getExamById(Number(examId));
    if (!exam) throw new AppError('Examination not found', 404, ErrorCodes.NOT_FOUND);

    const papers = await examRepository.getExamPapersByClass(exam.id, Number(classId));
    if (papers.length === 0) {
      throw new AppError('No papers configured for this class in this exam', 422, ErrorCodes.VALIDATION_ERROR);
    }

    await db.transaction(async (trx) => {
      for (const p of papers) {
        await examRepository.updatePaper(p.id, { status: PAPER_STATUS.VERIFIED }, trx);
        await trx('terminal_exam_marks')
          .where({ paper_id: p.id })
          .update({
            status: MARK_STATUS.VERIFIED,
            verified_by: actor.id,
            verified_at: db.fn.now(3)
          });
      }
    });

    return {
      success: true,
      examId: exam.id,
      classId: Number(classId),
      verifiedPapersCount: papers.length
    };
  },

  /**
   * Calculates overall class terminal results across all subjects and synchronizes
   * to final_results and final_result_subjects.
   */
  async calculateResults(examId, classId, actor) {
    if (!isStaff(actor)) throw forbidden('Only staff can calculate exam results.');

    const exam = await examRepository.getExamById(Number(examId));
    if (!exam) throw new AppError('Examination not found', 404, ErrorCodes.NOT_FOUND);

    let classIds = [];
    if (!classId || classId === 'ALL') {
      const papers = await examRepository.listPapersByExam(exam.id, {});
      classIds = [...new Set(papers.map((p) => Number(p.class_id)))];
    } else {
      classIds = [Number(classId)];
    }

    if (classIds.length === 0) {
      throw new AppError('No classes found with papers in this exam', 422, ErrorCodes.VALIDATION_ERROR);
    }

    const policy = await academicRepository.getEffectivePolicy(exam.session_id);
    let totalCalculated = 0;
    let passedCount = 0;
    let failedCount = 0;
    let suppCount = 0;

    await db.transaction(async (trx) => {
      for (const cId of classIds) {
        const papers = await examRepository.getExamPapersByClass(exam.id, cId, trx);
        const marks = await examRepository.getMarksForExamAndClass(exam.id, cId, trx);
        const students = await examRepository.getEnrolledStudentsForClass(cId, exam.session_id, trx);

        // Group marks by studentId
        const marksByStudent = new Map();
        for (const m of marks) {
          if (!marksByStudent.has(Number(m.student_id))) {
            marksByStudent.set(Number(m.student_id), []);
          }
          marksByStudent.get(Number(m.student_id)).push(m);
        }

        for (const student of students) {
          const studentMarks = marksByStudent.get(Number(student.studentId)) || [];
          let studentTotalMax = 0;
          let studentTotalObtained = 0;
          let failedSubjectsCount = 0;
          let absentSubjectsCount = 0;
          let gradedSubjectsCount = 0;
          const subjectRows = [];

          for (const paper of papers) {
            const paperMark = studentMarks.find((m) => Number(m.paper_id) === Number(paper.id));
            const paperTotal = Number(paper.total_marks || 100);
            const obtained = paperMark && paperMark.total_obtained !== null ? Number(paperMark.total_obtained) : null;
            const isAbsent = paperMark ? Boolean(paperMark.is_absent) : false;
            const isExempt = paperMark ? Boolean(paperMark.is_exempt) : false;

            if (isAbsent) absentSubjectsCount += 1;
            if (obtained !== null && !isAbsent) gradedSubjectsCount += 1;

            const isPassed = paperMark && paperMark.is_passed !== null ? Number(paperMark.is_passed) : 0;
            if (!isPassed && !isExempt) failedSubjectsCount += 1;

            if (!isExempt) {
              studentTotalMax += paperTotal;
              studentTotalObtained += obtained !== null ? Math.max(0, obtained) : 0;
            }

            subjectRows.push({
              subject_id: paper.subject_id,
              total_marks: paperTotal,
              obtained_marks: obtained,
              percentage: paperMark?.percentage ?? null,
              grade: paperMark?.grade ?? null,
              is_absent: isAbsent ? 1 : 0,
              passed: isPassed,
              source: 'MANUAL',
              teacher_remarks: paperMark?.teacher_remarks ?? null
            });
          }

          const overallEval = evaluateOverallExamStatus({
            totalMarks: studentTotalMax,
            obtainedMarks: studentTotalObtained,
            failedCount: failedSubjectsCount,
            absentCount: absentSubjectsCount,
            policy
          });

          if (overallEval.passStatus === 'PASSED') passedCount += 1;
          else if (overallEval.passStatus === 'FAILED') failedCount += 1;
          else if (overallEval.passStatus === 'SUPPLEMENTARY') suppCount += 1;

          const finalResultHeader = {
            enrollment_id: student.enrollmentId,
            student_id: student.studentId,
            class_id: cId,
            session_id: exam.session_id,
            term_id: exam.term_id,
            total_marks: studentTotalMax,
            obtained_marks: studentTotalObtained,
            percentage: overallEval.percentage,
            overall_grade: overallEval.overallGrade,
            subjects_count: papers.length,
            graded_subjects_count: gradedSubjectsCount,
            failed_subjects_count: failedSubjectsCount,
            absent_subjects_count: absentSubjectsCount,
            result_status: 'APPROVED',
            pass_status: overallEval.passStatus,
            approved_by: actor.id,
            approved_at: db.fn.now(3),
            computed_at: db.fn.now(3)
          };

          await examRepository.syncFinalResultHeaderAndSubjects({
            header: finalResultHeader,
            subjectRows
          }, trx);

          totalCalculated += 1;
        }

        // Lock paper status
        for (const p of papers) {
          await examRepository.updatePaper(p.id, { status: PAPER_STATUS.LOCKED }, trx);
        }
      }

      await examRepository.updateExam(exam.id, { status: EXAM_STATUS.MARKING }, trx);
    });

    return {
      examId: exam.id,
      totalCalculated,
      passed: passedCount,
      failed: failedCount,
      supplementary: suppCount
    };
  },

  /**
   * Formally publishes results, releasing report cards to Parent and Student portals.
   */
  async publishExam(examId, classId, actor) {
    if (!isStaff(actor)) throw forbidden('Only staff can publish exam results.');

    const exam = await examRepository.getExamById(Number(examId));
    if (!exam) throw new AppError('Examination not found', 404, ErrorCodes.NOT_FOUND);

    await db.transaction(async (trx) => {
      let query = trx('final_results')
        .where('session_id', exam.session_id)
        .where('term_id', exam.term_id);

      if (classId && classId !== 'ALL') {
        query = query.where('class_id', Number(classId));
      }

      await query.update({
        result_status: 'PUBLISHED',
        published_at: db.fn.now(3)
      });

      await examRepository.updateExam(
        exam.id,
        {
          status: EXAM_STATUS.COMPLETED,
          is_published: 1,
          published_at: db.fn.now(3)
        },
        trx
      );
    });

    notificationService.notify({
      title: 'Examination Results Published',
      message: `Results for ${exam.title} have been published. Report cards are now available.`,
      type: 'Results Published',
      targetRole: 'PARENT',
      priority: 'High'
    });

    return {
      success: true,
      examId: exam.id,
      isPublished: true,
      publishedAt: new Date().toISOString()
    };
  },

  /**
   * Official student report card detail for an examination.
   */
  async getStudentReportCard(examId, studentId, user) {
    const exam = await examRepository.getExamById(Number(examId));
    if (!exam) throw new AppError('Examination not found', 404, ErrorCodes.NOT_FOUND);

    studentId = Number(studentId);
    if (!isStaff(user)) {
      await assertCanViewStudent(user, studentId);
      if (!exam.is_published) {
        throw forbidden('Examination results have not been published yet.');
      }
    }

    const result = await db('final_results as fr')
      .join('students as st', 'fr.student_id', 'st.id')
      .join('users as u', 'st.user_id', 'u.id')
      .join('classes as c', 'fr.class_id', 'c.id')
      .join('academic_sessions as s', 'fr.session_id', 's.id')
      .join('academic_terms as t', 'fr.term_id', 't.id')
      .where('fr.session_id', exam.session_id)
      .where('fr.term_id', exam.term_id)
      .where('fr.student_id', studentId)
      .select(
        'fr.*',
        'st.admission_no as admissionNumber',
        'u.full_name as studentName',
        'c.name as className',
        's.name as sessionName',
        't.name as termName'
      )
      .first();

    if (!result) {
      throw new AppError('Report card not generated or calculated yet for this student', 404, ErrorCodes.NOT_FOUND);
    }

    const subjects = await resultsRepository.getResultSubjects(result.id);

    return {
      reportCard: {
        id: result.id,
        studentId: result.student_id,
        studentName: result.studentName,
        admissionNumber: result.admissionNumber,
        className: result.className,
        sessionName: result.sessionName,
        termName: result.termName,
        examTitle: exam.title,
        totalMarks: Number(result.total_marks),
        obtainedMarks: Number(result.obtained_marks),
        percentage: Number(result.percentage),
        overallGrade: result.overall_grade,
        passStatus: result.pass_status,
        resultStatus: result.result_status,
        publishedAt: result.published_at,
        subjects: subjects.map((s) => ({
          subjectId: s.subject_id,
          subjectName: s.subjectName,
          subjectCode: s.subjectCode,
          totalMarks: Number(s.total_marks),
          obtainedMarks: s.obtained_marks !== null ? Number(s.obtained_marks) : null,
          percentage: s.percentage !== null ? Number(s.percentage) : null,
          grade: s.grade,
          isAbsent: Boolean(s.is_absent),
          passed: Boolean(s.passed),
          teacherRemarks: s.teacher_remarks
        }))
      }
    };
  }
};
