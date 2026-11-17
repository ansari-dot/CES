import { db } from '../../shared/db/knex.js';
import { resultsRepository } from './results.repository.js';
import { academicRepository } from '../academic/academic.repository.js';
import { performanceRepository } from '../performance/performance.repository.js';
import { letterGrade } from '../people/students.repository.js';
import {
  calculateSubjectWeightedScore,
  calculateAnnualOverallResult,
  aggregateCategoryAssessments,
  DEFAULT_WEIGHTED_POLICY
} from './weightedGrading.calculator.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import {
  isStaff,
  forbidden,
  getTeacherScope,
  getStudentByUserId,
  assertCanViewStudent,
  getClassAudienceUserIds
} from '../../shared/services/accessScope.js';
import { notificationService } from '../../shared/services/notificationService.js';

const PROTECTED_STATUSES = ['APPROVED', 'PUBLISHED'];

function round2(n) {
  return Math.round(n * 100) / 100;
}

async function auditEntry(trx, actor, { action, recordType, recordIdentifier, reason, previousValue, newValue }) {
  await trx('audit_logs').insert({
    actor_id: actor?.id || null,
    actor_name: actor?.username || 'System',
    actor_role: actor?.role || 'SYSTEM',
    action,
    record_type: recordType,
    record_identifier: recordIdentifier,
    reason: reason || null,
    previous_value: previousValue != null ? String(previousValue).slice(0, 60000) : null,
    new_value: newValue != null ? String(newValue).slice(0, 60000) : null
  });
}

async function loadTermContext(termId) {
  let id = Number(termId);
  if (!id || Number.isNaN(id)) {
    const activeSession = await academicRepository.getCurrentSession();
    if (activeSession) {
      const term = await db('academic_terms').where({ session_id: activeSession.id }).first();
      if (term) id = term.id;
    }
  }
  const term = await resultsRepository.getTermById(Number(id));
  if (!term) throw new AppError('Term not found', 404, ErrorCodes.NOT_FOUND);
  const session = await academicRepository.getSessionById(term.session_id);
  if (!session) throw new AppError('Academic year not found', 404, ErrorCodes.NOT_FOUND);
  return { term, session };
}

export const resultsService = {
  /**
   * Computes (or recomputes) the term results of a class from graded
   * EXAM-type tasks. APPROVED/PUBLISHED results are never touched; manual
   * subject marks are preserved. Idempotent: one result per enrollment+term.
   */
  async computeClassResults({ classId, termId }, actor) {
    const { term, session } = await loadTermContext(termId);
    classId = Number(classId);
    if (session.status === 'CLOSED') {
      throw new AppError('Results of a closed academic year cannot be recomputed', 409, ErrorCodes.INVALID_STATE);
    }
    const subjects = await resultsRepository.getClassSubjects(classId);
    if (subjects.length === 0) {
      throw new AppError('This class has no active subjects configured', 422, ErrorCodes.VALIDATION_ERROR);
    }
    const policy = await academicRepository.getEffectivePolicy(session.id);
    const students = await resultsRepository.getClassStudentsWithEnrollment(classId, session.id);
    if (students.length === 0) {
      throw new AppError('No active students found in this class', 422, ErrorCodes.VALIDATION_ERROR);
    }

    const windowStart = term.exam_start_date || term.start_date;
    const windowEnd = term.exam_end_date || term.end_date;

    let gradingPolicy = await performanceRepository.findActivePolicy(session.id);
    if (!gradingPolicy) {
      gradingPolicy = DEFAULT_WEIGHTED_POLICY;
    }

    const { midTermRows, monthlyRows, assignmentRows, terminalRows } =
      await resultsRepository.getUnifiedCategoryAggregates({
        classId,
        sessionId: session.id,
        termStart: String(windowStart).slice(0, 10),
        termEnd: String(windowEnd).slice(0, 10),
        includeQuizzes: Boolean(gradingPolicy.include_quizzes_in_assignments ?? true)
      });

    let computed = 0;
    let skippedProtected = 0;
    let incomplete = 0;

    await db.transaction(async (trx) => {
      for (const student of students) {
        const enrollmentId =
          student.enrollmentId ||
          (await resultsRepository.ensureEnrollment(trx, {
            studentId: student.studentId,
            classId,
            sessionId: session.id,
            rollNo: student.rollNo
          }));

        const existing = await resultsRepository.getResultByEnrollmentTerm(trx, enrollmentId, term.id);
        if (existing && PROTECTED_STATUSES.includes(existing.result_status)) {
          skippedProtected += 1;
          continue;
        }

        // Manual subject rows survive a recompute.
        const manualBySubject = new Map();
        if (existing) {
          const subjectRows = await trx('final_result_subjects').where({ final_result_id: existing.id });
          for (const row of subjectRows) {
            if (row.source === 'MANUAL') manualBySubject.set(Number(row.subject_id), row);
          }
        }

        const subjectRows = [];
        let totalMarks = 0;
        let obtainedMarks = 0;
        let failedCount = 0;
        let absentCount = 0;
        let gradedSubjects = 0;
        let hasMissingCoverage = false;

        for (const subject of subjects) {
          const manual = manualBySubject.get(Number(subject.id));

          // Filter student category items
          const studentMT = midTermRows.filter((r) => r.studentId === student.studentId && r.subjectId === subject.id);
          const studentM = monthlyRows.filter((r) => r.studentId === student.studentId && r.subjectId === subject.id);
          const studentA = assignmentRows.filter((r) => r.studentId === student.studentId && r.subjectId === subject.id);
          const studentT = terminalRows.filter((r) => r.studentId === student.studentId && r.subjectId === subject.id);

          const mtAgg = aggregateCategoryAssessments(studentMT, { absentPolicy: policy.absent_policy });
          const mAgg = aggregateCategoryAssessments(studentM, { absentPolicy: policy.absent_policy });
          const aAgg = aggregateCategoryAssessments(studentA, { absentPolicy: policy.absent_policy });
          const tAgg = aggregateCategoryAssessments(studentT, { absentPolicy: policy.absent_policy });

          let weightedResult = calculateSubjectWeightedScore({
            midTerm: mtAgg,
            monthly: mAgg,
            assignments: aAgg,
            terminal: tAgg,
            policy: gradingPolicy,
            passingPolicy: policy
          });

          // If manual subject marks were preserved
          if (manual) {
            const manualTotal = Number(manual.total_marks || 100);
            const manualObtained = manual.obtained_marks !== null ? Number(manual.obtained_marks) : null;
            const manualPct = manualTotal > 0 && manualObtained !== null ? round2((manualObtained / manualTotal) * 100) : null;
            weightedResult = {
              ...weightedResult,
              percentage: manualPct,
              grade: letterGrade(manualPct),
              isPassed: manualPct !== null ? manualPct >= Number(policy.min_subject_percentage) : false,
              breakdown: {
                ...weightedResult.breakdown,
                manualOverride: true,
                manualObtained,
                manualTotal,
                finalPercentage: manualPct
              }
            };
          }

          if (weightedResult.isIncomplete) hasMissingCoverage = true;
          if (weightedResult.isAbsent) absentCount += 1;
          if (!weightedResult.isPassed && !weightedResult.isIncomplete) failedCount += 1;
          if (weightedResult.percentage !== null) gradedSubjects += 1;

          totalMarks += 100.00;
          obtainedMarks += weightedResult.percentage !== null ? weightedResult.percentage : 0;

          subjectRows.push({
            subject_id: subject.id,
            total_marks: 100.00,
            obtained_marks: weightedResult.percentage !== null ? weightedResult.percentage : 0,
            percentage: weightedResult.percentage,
            grade: weightedResult.grade,
            is_absent: weightedResult.isAbsent ? 1 : 0,
            passed: weightedResult.isPassed ? 1 : 0,
            source: manual ? 'MANUAL' : 'TASKS',
            teacher_remarks: manual ? manual.teacher_remarks : null,
            category_breakdown: JSON.stringify(weightedResult.breakdown),
            mid_term_pct: weightedResult.breakdown.midTerm?.percentage ?? null,
            monthly_test_pct: weightedResult.breakdown.monthly?.percentage ?? null,
            assignment_pct: weightedResult.breakdown.assignments?.percentage ?? null,
            terminal_pct: weightedResult.breakdown.terminal?.percentage ?? null,
            policy_id: gradingPolicy.id || null
          });
        }

        const overallResult = calculateAnnualOverallResult({
          subjectResults: subjectRows.map((r) => ({
            percentage: r.percentage,
            isPassed: Boolean(r.passed),
            isIncomplete:
              r.percentage === null ||
              (r.category_breakdown ? JSON.parse(r.category_breakdown).terminal?.status === 'MARKS_PENDING' : false),
            isAbsent: Boolean(r.is_absent)
          })),
          policy
        });

        const header = {
          enrollment_id: enrollmentId,
          student_id: student.studentId,
          class_id: classId,
          session_id: session.id,
          term_id: term.id,
          total_marks: round2(totalMarks),
          obtained_marks: round2(obtainedMarks),
          percentage: overallResult.overallPercentage,
          overall_grade: overallResult.overallGrade,
          subjects_count: subjects.length,
          graded_subjects_count: overallResult.gradedSubjects,
          failed_subjects_count: overallResult.failedSubjects,
          absent_subjects_count: overallResult.absentSubjects,
          result_status: hasMissingCoverage || overallResult.resultStatus === 'INCOMPLETE' ? 'INCOMPLETE' : 'DRAFT',
          pass_status: overallResult.passStatus,
          computed_at: db.fn.now(3)
        };

        let resultId;
        if (existing) {
          await trx('final_results').where({ id: existing.id }).update(header);
          await trx('final_result_subjects').where({ final_result_id: existing.id }).delete();
          resultId = existing.id;
        } else {
          const [id] = await trx('final_results').insert(header);
          resultId = id;
        }
        await trx('final_result_subjects').insert(
          subjectRows.map((row) => ({ ...row, final_result_id: resultId }))
        );

        computed += 1;
        if (resultStatus === 'INCOMPLETE') incomplete += 1;
      }

      await auditEntry(trx, actor, {
        action: 'COMPUTE_TERM_RESULTS',
        recordType: 'Final Result',
        recordIdentifier: `Class ${classId} · ${term.name} · ${session.name}`,
        newValue: `${computed} computed (${incomplete} incomplete, ${skippedProtected} protected)`
      });
    });

    return { computed, incomplete, skippedProtected, termName: term.name, sessionName: session.name };
  },

  async listResults(query, user) {
    if (!isStaff(user) && user.role !== 'TEACHER') throw forbidden();
    const filters = {
      sessionId: query.sessionId ? Number(query.sessionId) : null,
      termId: query.termId ? Number(query.termId) : null,
      classId: query.classId ? Number(query.classId) : null,
      statuses: query.status ? String(query.status).split(',') : null
    };
    if (user.role === 'TEACHER') {
      const scope = await getTeacherScope(user.id);
      if (!filters.classId || !scope.classIds.has(filters.classId)) {
        throw forbidden('You can only view results of classes assigned to you.');
      }
    }
    return await resultsRepository.listResults(filters);
  },

  async getResultDetail(id, user) {
    const result = await resultsRepository.getResultById(Number(id));
    if (!result) throw new AppError('Result not found', 404, ErrorCodes.NOT_FOUND);
    if (!isStaff(user)) {
      if (user.role === 'TEACHER') {
        const scope = await getTeacherScope(user.id);
        if (!scope.classIds.has(Number(result.class_id))) throw forbidden();
      } else {
        // Students/parents read via their own endpoints (published only).
        await assertCanViewStudent(user, result.student_id);
        if (result.result_status !== 'PUBLISHED') {
          throw forbidden('This result has not been published yet.');
        }
      }
    }
    return result;
  },

  /** Teacher hands off a (class, subject) as marks-complete for a term. */
  async submitMarks({ classId, subjectId, termId, note }, user) {
    const { term, session } = await loadTermContext(termId);
    classId = Number(classId);
    subjectId = Number(subjectId);
    let teacherId = null;
    if (user.role === 'TEACHER') {
      const scope = await getTeacherScope(user.id);
      if (!scope.pairs.has(`${classId}-${subjectId}`)) {
        throw forbidden('You are not assigned to this class and subject.');
      }
      teacherId = scope.teacher.id;
    } else if (!isStaff(user)) {
      throw forbidden();
    }
    const id = await resultsRepository.upsertMarksSubmission({
      sessionId: session.id,
      termId: term.id,
      classId,
      subjectId,
      teacherId,
      submittedBy: user.id,
      note
    });
    notificationService.notify({
      title: 'Examination Marks Submitted',
      message: `Marks for class ${classId} were submitted for review (${term.name}, ${session.name}).`,
      type: 'Marks Submitted',
      targetRole: 'PRINCIPAL',
      relatedRecordId: String(id),
      relatedRecordType: 'MarksSubmission',
      priority: 'Medium'
    });
    return { id, status: 'SUBMITTED' };
  },

  /**
   * A teacher's marks-entry status for a term: for each assigned
   * (class, subject): exam tasks, grading coverage and hand-off state.
   */
  async getTeacherTermStatus(termId, user) {
    const { term, session } = await loadTermContext(termId);
    const scope = await getTeacherScope(user.id);
    if (!scope.teacher) throw forbidden('Teacher profile not found for this account.');

    const windowStart = String(term.exam_start_date || term.start_date).slice(0, 10);
    const windowEnd = String(term.exam_end_date || term.end_date).slice(0, 10);

    const items = [];
    for (const classId of scope.classIds) {
      const { taskTotals, perStudent } = await resultsRepository.getExamAggregates({
        classId,
        sessionId: session.id,
        termStart: windowStart,
        termEnd: windowEnd
      });
      const students = await resultsRepository.getClassStudentsWithEnrollment(classId, session.id);
      const subjects = await resultsRepository.getClassSubjects(classId);
      const submissions = await resultsRepository.getMarksSubmissions(term.id, classId);
      for (const subjectId of scope.subjectIdsByClass.get(classId) || []) {
        const subject = subjects.find((s) => Number(s.id) === Number(subjectId));
        if (!subject) continue;
        const total = Number(taskTotals.get(subjectId) || 0);
        const gradedStudents = students.filter((st) => perStudent.get(st.studentId)?.has(subjectId)).length;
        const submission = submissions.find((ms) => Number(ms.subject_id) === subjectId);
        items.push({
          classId,
          subjectId,
          subjectName: subject.name,
          subjectCode: subject.code,
          examTotalMarks: total,
          hasExam: total > 0,
          totalStudents: students.length,
          gradedStudents,
          missingStudents: Math.max(students.length - gradedStudents, 0),
          submission: submission
            ? { status: submission.status, submittedAt: submission.submitted_at, note: submission.note }
            : null
        });
      }
    }
    return { term, session: { id: session.id, name: session.name, status: session.status }, items };
  },

  /** Principal review overview: per class marks hand-off + result states. */
  async getOverview(query, user) {
    if (!isStaff(user)) throw forbidden();
    const { term, session } = await loadTermContext(query.termId);
    const raw = await resultsRepository.getClassTermOverview(session.id, term.id);
    const submissions = await resultsRepository.getMarksSubmissions(term.id);

    const byClass = raw.classes.map((cls) => {
      const enrolled = raw.enrolled.find((e) => Number(e.classId) === Number(cls.id));
      const subjectCount = raw.subjectCounts.find((s) => Number(s.classId) === Number(cls.id));
      const classResults = raw.results.filter((r) => Number(r.classId) === Number(cls.id));
      const classSubs = submissions.filter((s) => Number(s.class_id) === Number(cls.id) && s.status === 'SUBMITTED');
      const count = (fn) => classResults.filter(fn).reduce((sum, r) => sum + Number(r.count), 0);
      return {
        classId: cls.id,
        classNumber: cls.grade_level,
        className: cls.name,
        enrolledStudents: enrolled ? Number(enrolled.count) : 0,
        subjectsConfigured: subjectCount ? Number(subjectCount.count) : 0,
        marksSubmitted: classSubs.length,
        resultsComputed: count(() => true),
        resultsIncomplete: count((r) => r.resultStatus === 'INCOMPLETE'),
        resultsApproved: count((r) => r.resultStatus === 'APPROVED'),
        resultsPublished: count((r) => r.resultStatus === 'PUBLISHED'),
        passed: count((r) => r.passStatus === 'PASSED'),
        failed: count((r) => r.passStatus === 'FAILED'),
        supplementary: count((r) => r.passStatus === 'SUPPLEMENTARY'),
        pending: count((r) => r.passStatus === 'PENDING')
      };
    });

    return {
      term,
      session: { id: session.id, name: session.name, status: session.status },
      classes: byClass,
      submissions: submissions.map((s) => ({
        id: s.id,
        sessionId: s.session_id,
        termId: s.term_id,
        classId: s.class_id,
        className: s.className,
        classNumber: s.classNumber,
        subjectId: s.subject_id,
        subjectName: s.subjectName,
        teacherId: s.teacher_id,
        teacherName: s.teacherName || 'Assigned Teacher',
        status: s.status,
        note: s.note,
        submittedAt: s.created_at || s.updated_at
      }))
    };
  },

  async approveClassResults({ classId, termId }, actor) {
    const { term, session } = await loadTermContext(termId);
    let classIdsToApprove = [];
    if (!classId || classId === 'ALL') {
      const overview = await resultsRepository.getClassTermOverview(session.id, term.id);
      classIdsToApprove = overview.classes.map((c) => Number(c.id));
    } else {
      classIdsToApprove = [Number(classId)];
    }

    let totalApproved = 0;
    for (const cId of classIdsToApprove) {
      let rows = await resultsRepository.listResults({
        termId: term.id,
        classId: cId,
        statuses: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'INCOMPLETE']
      });
      if (rows.length === 0) {
        try {
          await this.computeClassResults({ classId: cId, termId: term.id }, actor);
          rows = await resultsRepository.listResults({
            termId: term.id,
            classId: cId,
            statuses: ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'INCOMPLETE']
          });
        } catch {
          // No active subjects or exam tasks for this class yet
        }
      }
      if (rows.length > 0) {
        await db.transaction(async (trx) => {
          await resultsRepository.updateResultStatus(
            rows.map((r) => r.id),
            { result_status: 'APPROVED', approved_by: actor.id, approved_at: db.fn.now(3) },
            trx
          );
          await trx('marks_submissions')
            .where({ term_id: term.id, class_id: cId })
            .update({ status: 'APPROVED' });
          await auditEntry(trx, actor, {
            action: 'APPROVE_TERM_RESULTS',
            recordType: 'Final Result',
            recordIdentifier: `Class ${cId} · ${term.name} · ${session.name}`,
            newValue: `${rows.length} results approved`
          });
        });
        totalApproved += rows.length;
      }
    }

    return { approved: totalApproved };
  },

  async publishClassResults({ classId, termId }, actor) {
    const { term, session } = await loadTermContext(termId);
    let classIdsToPublish = [];
    if (!classId || classId === 'ALL') {
      const overview = await resultsRepository.getClassTermOverview(session.id, term.id);
      classIdsToPublish = overview.classes.map((c) => Number(c.id));
    } else {
      classIdsToPublish = [Number(classId)];
    }

    let totalPublished = 0;
    for (const cId of classIdsToPublish) {
      let rows = await resultsRepository.listResults({
        termId: term.id,
        classId: cId,
        statuses: ['APPROVED']
      });
      if (rows.length === 0) {
        await this.approveClassResults({ classId: cId, termId: term.id }, actor).catch(() => {});
        rows = await resultsRepository.listResults({
          termId: term.id,
          classId: cId,
          statuses: ['APPROVED']
        });
      }
      if (rows.length > 0) {
        await db.transaction(async (trx) => {
          await resultsRepository.updateResultStatus(
            rows.map((r) => r.id),
            { result_status: 'PUBLISHED', published_at: db.fn.now(3) },
            trx
          );
          await trx('marks_submissions')
            .where({ term_id: term.id, class_id: cId })
            .update({ status: 'PUBLISHED' });
          await auditEntry(trx, actor, {
            action: 'PUBLISH_TERM_RESULTS',
            recordType: 'Final Result',
            recordIdentifier: `Class ${cId} · ${term.name} · ${session.name}`,
            newValue: `${rows.length} results published`
          });
        });
        const recipients = await getClassAudienceUserIds([], {
          includeStudents: true,
          includeParents: true,
          studentIds: rows.map((r) => r.student_id)
        });
        if (recipients.length > 0) {
          notificationService.notifyUsers(recipients, {
            title: 'Term Results Published',
            message: `Your ${term.name} (${session.name}) result has been published. Open Results & Progress to view it.`,
            type: 'Result Published',
            targetRole: 'ALL',
            relatedRecordId: String(term.id),
            relatedRecordType: 'FinalResult',
            priority: 'High'
          });
        }
        totalPublished += rows.length;
      }
    }

    return { published: totalPublished };
  },

  /**
   * Manual subject-mark correction. After approval/publication it requires a
   * reason and is fully audited; the result header is recomputed.
   */
  async updateSubjectMarks(resultId, { subjectId, obtainedMarks, totalMarks, teacherRemarks, reason }, actor) {
    const result = await resultsRepository.getResultById(Number(resultId));
    if (!result) throw new AppError('Result not found', 404, ErrorCodes.NOT_FOUND);
    const isProtected = PROTECTED_STATUSES.includes(result.result_status);
    if (isProtected && (!reason || !String(reason).trim())) {
      throw new AppError(
        'A reason is required to correct an approved or published result',
        422,
        ErrorCodes.VALIDATION_ERROR
      );
    }
    const subjectRow = result.subjects.find((s) => Number(s.subject_id) === Number(subjectId));
    if (!subjectRow) throw new AppError('Subject not found on this result', 404, ErrorCodes.NOT_FOUND);

    const newTotal = totalMarks !== undefined && totalMarks !== null ? Number(totalMarks) : Number(subjectRow.total_marks);
    if (Number.isNaN(newTotal) || newTotal <= 0 || newTotal > 10000) {
      throw new AppError('Total marks must be a positive number', 422, ErrorCodes.VALIDATION_ERROR);
    }
    let newObtained = null;
    if (obtainedMarks !== null && obtainedMarks !== undefined && obtainedMarks !== '') {
      newObtained = Number(obtainedMarks);
      if (Number.isNaN(newObtained) || newObtained < 0 || newObtained > newTotal) {
        throw new AppError(`Obtained marks must be between 0 and ${newTotal}`, 422, ErrorCodes.VALIDATION_ERROR);
      }
    }

    const policy = await academicRepository.getEffectivePolicy(result.session_id);
    const pct = newObtained === null ? null : round2((newObtained / newTotal) * 100);

    await db.transaction(async (trx) => {
      await trx('final_result_subjects')
        .where({ id: subjectRow.id })
        .update({
          total_marks: newTotal,
          obtained_marks: newObtained,
          percentage: pct,
          grade: pct === null ? null : letterGrade(pct),
          is_absent: newObtained === null ? 1 : 0,
          passed: pct === null ? null : pct >= Number(policy.min_subject_percentage) ? 1 : 0,
          teacher_remarks: teacherRemarks !== undefined ? teacherRemarks : subjectRow.teacher_remarks,
          source: 'MANUAL'
        });

      // Recompute the header from the stored subject rows.
      const rows = await trx('final_result_subjects').where({ final_result_id: result.id });
      let total = 0;
      let obtained = 0;
      let failed = 0;
      let absent = 0;
      let graded = 0;
      let missingCoverage = false;
      for (const row of rows) {
        if (Number(row.total_marks) === 0) {
          missingCoverage = true;
          continue;
        }
        if (row.obtained_marks === null) {
          absent += 1;
          if (policy.absent_policy === 'EXCLUDE') continue;
          total += Number(row.total_marks);
          failed += 1;
          continue;
        }
        graded += 1;
        total += Number(row.total_marks);
        obtained += Number(row.obtained_marks);
        if (!row.passed) failed += 1;
      }
      const overallPct = total > 0 ? round2((obtained / total) * 100) : null;
      let passStatus = 'PENDING';
      if (!missingCoverage && overallPct !== null) {
        if (absent > 0 && policy.absent_policy === 'FAIL') passStatus = 'FAILED';
        else if (overallPct >= Number(policy.min_overall_percentage) && failed <= Number(policy.max_failed_subjects))
          passStatus = 'PASSED';
        else if (policy.supplementary_allowed && failed > 0 && failed <= Number(policy.max_supplementary_subjects))
          passStatus = 'SUPPLEMENTARY';
        else passStatus = 'FAILED';
      }
      await trx('final_results')
        .where({ id: result.id })
        .update({
          total_marks: round2(total),
          obtained_marks: round2(obtained),
          percentage: overallPct,
          overall_grade: overallPct === null ? null : letterGrade(overallPct),
          graded_subjects_count: graded,
          failed_subjects_count: failed,
          absent_subjects_count: absent,
          pass_status: passStatus,
          result_status: missingCoverage ? 'INCOMPLETE' : result.result_status === 'INCOMPLETE' ? 'DRAFT' : result.result_status
        });

      await auditEntry(trx, actor, {
        action: isProtected ? 'CORRECT_PUBLISHED_RESULT' : 'EDIT_RESULT_MARKS',
        recordType: 'Final Result',
        recordIdentifier: `${result.studentName} (${result.admissionNo}) · ${result.termName} · ${result.sessionName}`,
        reason: reason || null,
        previousValue: `Subject ${subjectRow.subjectName}: ${subjectRow.obtained_marks ?? 'absent'}/${subjectRow.total_marks}`,
        newValue: `Subject ${subjectRow.subjectName}: ${newObtained ?? 'absent'}/${newTotal}`
      });
    });

    return await resultsRepository.getResultById(result.id);
  },

  // ── Student / parent reads ─────────────────────────────────────────

  async getMyResults(user) {
    const student = await getStudentByUserId(user.id);
    if (!student) throw new AppError('Student profile not found', 404, ErrorCodes.NOT_FOUND);
    return await this.getStudentAcademicHistory(student.id, { isStaffUser: false });
  },

  async getChildResults(user, studentId) {
    const student = await assertCanViewStudent(user, studentId);
    return await this.getStudentAcademicHistory(student.id, { isStaffUser: false });
  },

  async getStudentAcademicHistory(studentId, { isStaffUser = false } = {}) {
    const [results, enrollments, promotions, supplementaryList] = await Promise.all([
      resultsRepository.getPublishedResultsForStudent(studentId, { isStaffUser }),
      resultsRepository.getEnrollmentHistory(studentId),
      resultsRepository.getPromotionStatusForStudent(studentId),
      db('supplementary_exam_results as ser')
        .where('ser.student_id', studentId)
        .andWhere('ser.status', 'PUBLISHED')
        .orderBy([
          { column: 'ser.is_passed', order: 'desc' },
          { column: 'ser.obtained_marks', order: 'desc' },
          { column: 'ser.attempt_number', order: 'desc' }
        ])
        .select(
          'ser.id',
          'ser.final_result_subject_id',
          'ser.is_passed',
          'ser.obtained_marks',
          'ser.max_marks',
          'ser.grade',
          'ser.is_absent',
          'ser.attempt_number',
          'ser.correction_version',
          'ser.published_at'
        )
    ]);

    const suppMap = new Map();
    for (const s of supplementaryList || []) {
      if (!suppMap.has(s.final_result_subject_id)) {
        suppMap.set(s.final_result_subject_id, s);
      }
    }

    const enrichedResults = (results || []).map((r) => {
      const enrichedSubjects = (r.subjects || []).map((sub) => {
        const supp = suppMap.get(sub.id) || null;
        return {
          ...sub,
          supplementary: supp
        };
      });
      return {
        ...r,
        subjects: enrichedSubjects
      };
    });

    return { results: enrichedResults, enrollments, promotions, supplementaryList };
  },

  /**
   * Unified Role-Based Student Annual Academic Performance Summary
   * Returns subject-wise summary table with all 5 category percentages,
   * annual weighted score, grade, teacher name, and student context.
   */
  async getStudentAnnualSubjectSummary({ studentId, sessionId = null, user }) {
    studentId = Number(studentId);
    const student = await resultsRepository.getStudentProfile(studentId);
    if (!student) throw new AppError('Student profile not found', 404, ErrorCodes.NOT_FOUND);

    // RBAC Authorization
    let teacherScope = null;
    if (user.role === 'STUDENT') {
      if (student.userId !== user.id) throw forbidden();
    } else if (user.role === 'PARENT') {
      await assertCanViewStudent(user, studentId);
    } else if (user.role === 'TEACHER') {
      teacherScope = await getTeacherScope(user.id);
      if (!teacherScope.classIds.has(Number(student.currentClassId))) {
        throw forbidden('You can only view students enrolled in your assigned classes.');
      }
    } else if (!isStaff(user)) {
      throw forbidden();
    }

    // Resolve academic session
    let session = null;
    if (sessionId) {
      session = await academicRepository.getSessionById(Number(sessionId));
    }
    if (!session) {
      session = (await academicRepository.getCurrentSession()) || (await db('academic_sessions').first());
    }
    if (!session) throw new AppError('Academic session not found', 404, ErrorCodes.NOT_FOUND);

    const allSessions = await db('academic_sessions').select('id', 'name', 'is_current').orderBy('start_date', 'desc');

    // Check enrollment for this session
    const enrollment = await db('enrollments')
      .where({ student_id: studentId, session_id: session.id })
      .first();

    const classId = enrollment?.class_id || student.currentClassId;
    let className = student.className;
    if (enrollment && enrollment.class_id !== student.currentClassId) {
      const cls = await db('classes').where({ id: enrollment.class_id }).first();
      if (cls) className = cls.name;
    }

    const classSubjects = await resultsRepository.getClassSubjects(classId);
    const policy = await academicRepository.getEffectivePolicy(session.id);
    let gradingPolicy = await performanceRepository.findActivePolicy(session.id);
    if (!gradingPolicy) gradingPolicy = DEFAULT_WEIGHTED_POLICY;

    const data = await resultsRepository.getStudentAnnualAssessments({
      studentId,
      classId,
      sessionId: session.id
    });

    const teacherMap = new Map();
    for (const ta of data.teacherAssignments) {
      teacherMap.set(Number(ta.subjectId), ta.teacherName);
    }

    const publishedMap = new Map();
    for (const ps of data.publishedSubjects) {
      publishedMap.set(Number(ps.subject_id), ps);
    }

    const suppMap = new Map();
    for (const sr of data.supplementaryResults) {
      suppMap.set(Number(sr.final_result_subject_id), sr);
    }

    const subjectRows = [];
    const isRestrictedAudience = user.role === 'STUDENT' || user.role === 'PARENT';

    for (const sub of classSubjects) {
      const subId = Number(sub.id);
      const teacherName = teacherMap.get(subId) || 'Unassigned';

      // 1. Quizzes
      const quizzes = [
        ...data.tests.filter((t) => Number(t.subject_id) === subId && t.exam_type === 'CLASS_QUIZ'),
        ...data.tasks.filter((t) => Number(t.subject_id) === subId && t.task_type === 'QUIZ')
      ];

      // 2. Assignments
      const assignments = data.tasks.filter(
        (t) => Number(t.subject_id) === subId && ['ASSIGNMENT', 'HOMEWORK', 'PROJECT'].includes(t.task_type)
      );

      // 3. Monthly Tests
      const monthlyTests = data.tests.filter(
        (t) => Number(t.subject_id) === subId && t.exam_type === 'MONTHLY_TEST'
      );

      // 4. Mid-Term
      const midTerm = [
        ...data.tests.filter((t) => Number(t.subject_id) === subId && t.exam_type === 'MID_TERM'),
        ...data.papers.filter(
          (p) =>
            Number(p.subject_id) === subId &&
            (p.exam_type === 'MID_TERM' || String(p.paper_name || p.exam_title || '').toLowerCase().includes('mid'))
        )
      ];

      // 5. Terminal Examination
      const terminal = [
        ...data.papers.filter(
          (p) =>
            Number(p.subject_id) === subId &&
            p.exam_type !== 'MID_TERM' &&
            !String(p.paper_name || p.exam_title || '').toLowerCase().includes('mid')
        ),
        ...data.tests.filter(
          (t) => Number(t.subject_id) === subId && ['FINAL_TERM', 'TERM_EXAM'].includes(t.exam_type)
        ),
        ...data.tasks.filter((t) => Number(t.subject_id) === subId && t.task_type === 'EXAM')
      ];

      const quizAgg = aggregateCategoryAssessments(
        quizzes.map((q) => ({
          totalMarks: q.total_marks,
          obtainedMarks: q.obtained_score ?? q.marks_awarded,
          status: q.attempt_status ?? q.submission_status,
          isAbsent: q.attempt_status === 'ABSENT' || q.submission_status === 'ABSENT'
        }))
      );

      const assignAgg = aggregateCategoryAssessments(
        assignments.map((a) => ({
          totalMarks: a.total_marks,
          obtainedMarks: a.marks_awarded,
          status: a.submission_status,
          isAbsent: a.submission_status === 'ABSENT'
        }))
      );

      const monthlyAgg = aggregateCategoryAssessments(
        monthlyTests.map((m) => ({
          totalMarks: m.total_marks,
          obtainedMarks: m.obtained_score,
          status: m.attempt_status,
          isAbsent: m.attempt_status === 'ABSENT'
        }))
      );

      const midTermAgg = aggregateCategoryAssessments(
        midTerm.map((mt) => ({
          totalMarks: mt.total_marks,
          obtainedMarks: mt.obtained_score ?? mt.total_obtained,
          status: mt.attempt_status ?? mt.mark_status,
          isAbsent: mt.attempt_status === 'ABSENT' || mt.is_absent === 1
        }))
      );

      const terminalAgg = aggregateCategoryAssessments(
        terminal.map((t) => ({
          totalMarks: t.total_marks,
          obtainedMarks: t.total_obtained ?? t.obtained_score ?? t.marks_awarded,
          status: t.mark_status ?? t.attempt_status ?? t.submission_status,
          isAbsent: t.is_absent === 1 || t.attempt_status === 'ABSENT' || t.submission_status === 'ABSENT'
        }))
      );

      // Tasks / Assignments category for 10% weight: includes quizzes if configured
      const tasksAndQuizzes = Boolean(gradingPolicy.include_quizzes_in_assignments ?? true)
        ? [...assignments, ...quizzes]
        : assignments;

      const tasksCategoryAgg = aggregateCategoryAssessments(
        tasksAndQuizzes.map((item) => ({
          totalMarks: item.total_marks,
          obtainedMarks: item.marks_awarded ?? item.obtained_score,
          status: item.submission_status ?? item.attempt_status,
          isAbsent: item.submission_status === 'ABSENT' || item.attempt_status === 'ABSENT'
        }))
      );

      const weightedCalc = calculateSubjectWeightedScore({
        midTerm: midTermAgg,
        monthly: monthlyAgg,
        assignments: tasksCategoryAgg,
        terminal: terminalAgg,
        policy: gradingPolicy,
        passingPolicy: policy
      });

      const publishedSubject = publishedMap.get(subId);
      const supp = publishedSubject ? suppMap.get(publishedSubject.id) : null;

      let finalPct = weightedCalc.percentage;
      let finalGrade = weightedCalc.grade;
      let isPassed = weightedCalc.isPassed;
      let status = 'DRAFT';

      if (publishedSubject) {
        status = 'PUBLISHED';
        if (supp?.is_passed) {
          finalPct = Math.round((supp.obtained_marks / supp.max_marks) * 100);
          finalGrade = supp.grade;
          isPassed = true;
        } else if (publishedSubject.percentage !== null) {
          finalPct = Number(publishedSubject.percentage);
          finalGrade = publishedSubject.grade;
          isPassed = Boolean(publishedSubject.passed);
        }
      } else if (weightedCalc.isIncomplete) {
        status = 'MARKS_PENDING';
      }

      const isTeacherAuthorized =
        user.role === 'PRINCIPAL' ||
        user.role === 'ADMIN' ||
        (user.role === 'TEACHER' && teacherScope?.pairs?.has(`${classId}-${subId}`));

      // If student/parent and terminal exam marks are unpublished, mask them as pending
      const terminalDisplayPct =
        isRestrictedAudience && !publishedSubject && terminalAgg.hasPendingMarks
          ? null
          : terminalAgg.percentage;

      subjectRows.push({
        subjectId: sub.id,
        subjectName: sub.name,
        subjectCode: sub.code,
        teacherName,
        quizzesPct: quizAgg.percentage,
        assignmentsPct: assignAgg.percentage,
        monthlyTestsPct: monthlyAgg.percentage,
        midTermPct: midTermAgg.percentage,
        terminalPct: terminalDisplayPct,
        annualPercentage: finalPct,
        grade: finalGrade,
        isPassed,
        status,
        isTeacherAuthorized,
        supplementary: supp ? { is_passed: supp.is_passed, grade: supp.grade } : null,
        breakdown: weightedCalc.breakdown
      });
    }

    const overall = calculateAnnualOverallResult({
      subjectResults: subjectRows.map((s) => ({
        percentage: s.annualPercentage,
        isPassed: s.isPassed,
        isIncomplete: s.status === 'MARKS_PENDING',
        isAbsent: false
      })),
      policy
    });

    return {
      student: {
        id: student.studentId,
        studentName: student.studentName,
        admissionNo: student.admissionNo,
        rollNo: student.rollNo,
        classId,
        className,
        classNumber: student.classNumber
      },
      session: {
        id: session.id,
        name: session.name,
        isCurrent: Boolean(session.is_current)
      },
      sessions: allSessions,
      subjects: subjectRows,
      overallPercentage: overall.overallPercentage,
      overallGrade: overall.overallGrade,
      passStatus: overall.passStatus,
      resultStatus: overall.resultStatus
    };
  },

  /**
   * Detailed Marks Page for a specific subject
   * Returns itemized lists for:
   * A. Quizzes
   * B. Assignments / Homework
   * C. Monthly Tests
   * D. Mid-Term Examination
   * E. Terminal Examination
   * F. Annual Weighted Result
   */
  async getStudentSubjectDetailedMarks({ studentId, subjectId, sessionId = null, user }) {
    studentId = Number(studentId);
    subjectId = Number(subjectId);

    const student = await resultsRepository.getStudentProfile(studentId);
    if (!student) throw new AppError('Student profile not found', 404, ErrorCodes.NOT_FOUND);

    let isTeacherAuthorized = false;
    if (user.role === 'STUDENT') {
      if (student.userId !== user.id) throw forbidden();
    } else if (user.role === 'PARENT') {
      await assertCanViewStudent(user, studentId);
    } else if (user.role === 'TEACHER') {
      const scope = await getTeacherScope(user.id);
      if (!scope.classIds.has(Number(student.currentClassId))) {
        throw forbidden('You can only view students enrolled in your assigned classes.');
      }
      isTeacherAuthorized = scope.pairs.has(`${student.currentClassId}-${subjectId}`);
    } else if (!isStaff(user)) {
      throw forbidden();
    } else {
      isTeacherAuthorized = true; // Staff / Principal
    }

    let session = null;
    if (sessionId) {
      session = await academicRepository.getSessionById(Number(sessionId));
    }
    if (!session) {
      session = (await academicRepository.getCurrentSession()) || (await db('academic_sessions').first());
    }
    if (!session) throw new AppError('Academic session not found', 404, ErrorCodes.NOT_FOUND);

    const enrollment = await db('enrollments')
      .where({ student_id: studentId, session_id: session.id })
      .first();

    const classId = enrollment?.class_id || student.currentClassId;
    const subject = await db('subjects').where({ id: subjectId }).first();
    if (!subject) throw new AppError('Subject not found', 404, ErrorCodes.NOT_FOUND);

    const policy = await academicRepository.getEffectivePolicy(session.id);
    let gradingPolicy = await performanceRepository.findActivePolicy(session.id);
    if (!gradingPolicy) gradingPolicy = DEFAULT_WEIGHTED_POLICY;

    const data = await resultsRepository.getStudentAnnualAssessments({
      studentId,
      classId,
      sessionId: session.id,
      subjectId
    });

    const teacherAssigned = data.teacherAssignments.find((ta) => Number(ta.subjectId) === subjectId);
    const teacherName = teacherAssigned?.teacherName || 'Unassigned';

    // Helper to format an assessment entry
    const formatItem = (item, { title, date, total, obtained, status, isAbsent, isExcused }) => {
      const tot = Number(total || 0);
      let obt = obtained !== null && obtained !== undefined ? Number(obtained) : null;
      let finalStatus = status || 'PUBLISHED';
      if (isExcused) finalStatus = 'EXCUSED';
      else if (isAbsent) finalStatus = 'ABSENT';
      else if (obt === null) finalStatus = 'MARKS_PENDING';

      // Security rule: Students and parents cannot see unapproved / draft marks
      if ((user.role === 'STUDENT' || user.role === 'PARENT') && ['DRAFT', 'SUBMITTED', 'PENDING'].includes(status)) {
        obt = null;
        finalStatus = 'MARKS_PENDING';
      }

      let pct = null;
      if (tot > 0 && obt !== null) {
        pct = round2((obt / tot) * 100);
      }

      return {
        id: item.id,
        title: title || item.title || item.paper_name || 'Assessment',
        date: date ? String(date).slice(0, 10) : '—',
        totalMarks: tot,
        obtainedMarks: obt,
        percentage: pct,
        status: finalStatus
      };
    };

    // A. Quizzes
    const rawQuizzes = [
      ...data.tests.filter((t) => t.exam_type === 'CLASS_QUIZ').map((t) =>
        formatItem(t, {
          title: t.title,
          date: t.available_from,
          total: t.total_marks,
          obtained: t.obtained_score,
          status: t.attempt_status,
          isAbsent: t.attempt_status === 'ABSENT'
        })
      ),
      ...data.tasks.filter((t) => t.task_type === 'QUIZ').map((t) =>
        formatItem(t, {
          title: t.title,
          date: t.deadline,
          total: t.total_marks,
          obtained: t.marks_awarded,
          status: t.submission_status,
          isAbsent: t.submission_status === 'ABSENT'
        })
      )
    ];

    // B. Assignments
    const rawAssignments = data.tasks
      .filter((t) => ['ASSIGNMENT', 'HOMEWORK', 'PROJECT'].includes(t.task_type))
      .map((t) =>
        formatItem(t, {
          title: t.title,
          date: t.deadline,
          total: t.total_marks,
          obtained: t.marks_awarded,
          status: t.submission_status,
          isAbsent: t.submission_status === 'ABSENT'
        })
      );

    // C. Monthly Tests
    const rawMonthly = data.tests
      .filter((t) => t.exam_type === 'MONTHLY_TEST')
      .map((t) =>
        formatItem(t, {
          title: t.title,
          date: t.available_from,
          total: t.total_marks,
          obtained: t.obtained_score,
          status: t.attempt_status,
          isAbsent: t.attempt_status === 'ABSENT'
        })
      );

    // D. Mid-Term
    const rawMidTerm = [
      ...data.tests.filter((t) => t.exam_type === 'MID_TERM').map((t) =>
        formatItem(t, {
          title: t.title,
          date: t.available_from,
          total: t.total_marks,
          obtained: t.obtained_score,
          status: t.attempt_status,
          isAbsent: t.attempt_status === 'ABSENT'
        })
      ),
      ...data.papers
        .filter((p) => p.exam_type === 'MID_TERM' || String(p.paper_name || p.exam_title || '').toLowerCase().includes('mid'))
        .map((p) =>
          formatItem(p, {
            title: p.paper_name || p.exam_title || 'Mid-Term Paper',
            date: p.exam_date,
            total: p.total_marks,
            obtained: p.total_obtained,
            status: p.mark_status,
            isAbsent: p.is_absent === 1
          })
        )
    ];

    // E. Terminal Examination
    const rawTerminal = [
      ...data.papers
        .filter((p) => p.exam_type !== 'MID_TERM' && !String(p.paper_name || p.exam_title || '').toLowerCase().includes('mid'))
        .map((p) =>
          formatItem(p, {
            title: p.paper_name || p.exam_title || 'Terminal Paper',
            date: p.exam_date,
            total: p.total_marks,
            obtained: p.total_obtained,
            status: p.mark_status,
            isAbsent: p.is_absent === 1
          })
        ),
      ...data.tests.filter((t) => ['FINAL_TERM', 'TERM_EXAM'].includes(t.exam_type)).map((t) =>
        formatItem(t, {
          title: t.title,
          date: t.available_from,
          total: t.total_marks,
          obtained: t.obtained_score,
          status: t.attempt_status,
          isAbsent: t.attempt_status === 'ABSENT'
        })
      ),
      ...data.tasks.filter((t) => t.task_type === 'EXAM').map((t) =>
        formatItem(t, {
          title: t.title,
          date: t.deadline,
          total: t.total_marks,
          obtained: t.marks_awarded,
          status: t.submission_status,
          isAbsent: t.submission_status === 'ABSENT'
        })
      )
    ];

    // Category aggregations
    const quizAgg = aggregateCategoryAssessments(rawQuizzes);
    const assignAgg = aggregateCategoryAssessments(rawAssignments);
    const monthlyAgg = aggregateCategoryAssessments(rawMonthly);
    const midTermAgg = aggregateCategoryAssessments(rawMidTerm);
    const terminalAgg = aggregateCategoryAssessments(rawTerminal);

    const includeQuizzes = Boolean(gradingPolicy.include_quizzes_in_assignments ?? true);
    const tasksCategoryItems = includeQuizzes ? [...rawAssignments, ...rawQuizzes] : rawAssignments;
    const taskCatAgg = aggregateCategoryAssessments(tasksCategoryItems);

    const weightedCalc = calculateSubjectWeightedScore({
      midTerm: midTermAgg,
      monthly: monthlyAgg,
      assignments: taskCatAgg,
      terminal: terminalAgg,
      policy: gradingPolicy,
      passingPolicy: policy
    });

    const publishedSubject = data.publishedSubjects.find((ps) => Number(ps.subject_id) === subjectId);
    const supp = publishedSubject
      ? data.supplementaryResults.find((sr) => Number(sr.final_result_subject_id) === publishedSubject.id)
      : null;

    let finalPct = weightedCalc.percentage;
    let finalGrade = weightedCalc.grade;
    let isPassed = weightedCalc.isPassed;
    let resultStatus = publishedSubject ? 'PUBLISHED' : weightedCalc.isIncomplete ? 'MARKS_PENDING' : 'DRAFT';

    if (publishedSubject) {
      if (supp?.is_passed) {
        finalPct = Math.round((supp.obtained_marks / supp.max_marks) * 100);
        finalGrade = supp.grade;
        isPassed = true;
      } else if (publishedSubject.percentage !== null) {
        finalPct = Number(publishedSubject.percentage);
        finalGrade = publishedSubject.grade;
        isPassed = Boolean(publishedSubject.passed);
      }
    }

    const breakdownList = [
      {
        category: 'Mid-Term Examination',
        weight: 25,
        studentPercentage: midTermAgg.categoryPercentage,
        contribution: weightedCalc.breakdown.midTerm.contribution,
        status: weightedCalc.breakdown.midTerm.status
      },
      {
        category: 'Monthly Tests',
        weight: 15,
        studentPercentage: monthlyAgg.categoryPercentage,
        contribution: weightedCalc.breakdown.monthly.contribution,
        status: weightedCalc.breakdown.monthly.status
      },
      {
        category: 'Tasks / Assignments',
        weight: 10,
        studentPercentage: taskCatAgg.categoryPercentage,
        contribution: weightedCalc.breakdown.assignments.contribution,
        status: weightedCalc.breakdown.assignments.status
      },
      {
        category: 'Terminal Examination',
        weight: 50,
        studentPercentage: terminalAgg.categoryPercentage,
        contribution: weightedCalc.breakdown.terminal.contribution,
        status: weightedCalc.breakdown.terminal.status
      }
    ];

    return {
      student: {
        id: student.studentId,
        studentName: student.studentName,
        admissionNo: student.admissionNo,
        rollNo: student.rollNo,
        classId,
        className: student.className
      },
      session: {
        id: session.id,
        name: session.name
      },
      subject: {
        id: subject.id,
        name: subject.name,
        code: subject.code,
        teacherName
      },
      teacherName,
      gradingPolicy,
      quizzes: {
        categoryPercentage: quizAgg.categoryPercentage,
        items: rawQuizzes,
        summary: quizAgg
      },
      assignments: {
        categoryPercentage: assignAgg.categoryPercentage,
        items: rawAssignments,
        summary: assignAgg
      },
      monthlyTests: {
        categoryPercentage: monthlyAgg.categoryPercentage,
        items: rawMonthly,
        summary: monthlyAgg
      },
      midTerm: {
        categoryPercentage: midTermAgg.categoryPercentage,
        items: rawMidTerm,
        summary: midTermAgg
      },
      terminal: {
        categoryPercentage: terminalAgg.categoryPercentage,
        items: rawTerminal,
        summary: terminalAgg
      },
      annualWeightedResult: {
        midTerm: weightedCalc.breakdown.midTerm,
        monthly: weightedCalc.breakdown.monthly,
        assignments: weightedCalc.breakdown.assignments,
        terminal: weightedCalc.breakdown.terminal,
        finalPercentage: finalPct,
        grade: finalGrade,
        isPassed,
        status: resultStatus,
        supplementary: supp ? { is_passed: supp.is_passed, grade: supp.grade, marks: supp.obtained_marks } : null
      },
      weightedCalculation: {
        finalPercentage: finalPct,
        grade: finalGrade,
        passStatus: isPassed ? 'PASSED' : 'FAILED',
        isPassed,
        status: resultStatus,
        breakdown: breakdownList
      },
      isTeacherAuthorized
    };
  }
};
