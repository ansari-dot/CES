import { db } from '../../shared/db/knex.js';
import { resultsRepository } from './results.repository.js';
import { academicRepository } from '../academic/academic.repository.js';
import { letterGrade } from '../people/students.repository.js';
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
    const { taskTotals, perStudent } = await resultsRepository.getExamAggregates({
      classId,
      sessionId: session.id,
      termStart: String(windowStart).slice(0, 10),
      termEnd: String(windowEnd).slice(0, 10)
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

        const studentMarks = perStudent.get(student.studentId) || new Map();
        const subjectRows = [];
        let totalMarks = 0;
        let obtainedMarks = 0;
        let failedCount = 0;
        let absentCount = 0;
        let gradedSubjects = 0;
        let hasMissingCoverage = false;

        for (const subject of subjects) {
          const manual = manualBySubject.get(Number(subject.id));
          const subjectTotal = manual ? Number(manual.total_marks) : Number(taskTotals.get(subject.id) || 0);
          let obtained = null;
          if (manual) {
            obtained = manual.obtained_marks === null ? null : Number(manual.obtained_marks);
          } else if (studentMarks.has(subject.id)) {
            obtained = studentMarks.get(subject.id).obtained;
          }

          if (subjectTotal === 0) {
            // No exam exists yet for this subject: coverage incomplete.
            hasMissingCoverage = true;
            subjectRows.push({
              subject_id: subject.id,
              total_marks: 0,
              obtained_marks: null,
              percentage: null,
              grade: null,
              is_absent: 0,
              passed: null,
              source: manual ? 'MANUAL' : 'TASKS',
              teacher_remarks: manual ? manual.teacher_remarks : null
            });
            continue;
          }

          const isAbsent = obtained === null;
          if (isAbsent) {
            absentCount += 1;
            if (policy.absent_policy === 'EXCLUDE') {
              subjectRows.push({
                subject_id: subject.id,
                total_marks: subjectTotal,
                obtained_marks: null,
                percentage: null,
                grade: null,
                is_absent: 1,
                passed: null,
                source: manual ? 'MANUAL' : 'TASKS',
                teacher_remarks: manual ? manual.teacher_remarks : null
              });
              continue;
            }
            obtained = 0; // ZERO and FAIL both count the subject at zero marks
          }

          const clamped = Math.min(Math.max(Number(obtained), 0), subjectTotal);
          const pct = round2((clamped / subjectTotal) * 100);
          const passed = pct >= Number(policy.min_subject_percentage) ? 1 : 0;
          if (!passed) failedCount += 1;
          if (!isAbsent) gradedSubjects += 1;
          totalMarks += subjectTotal;
          obtainedMarks += clamped;
          subjectRows.push({
            subject_id: subject.id,
            total_marks: subjectTotal,
            obtained_marks: clamped,
            percentage: pct,
            grade: letterGrade(pct),
            is_absent: isAbsent ? 1 : 0,
            passed,
            source: manual ? 'MANUAL' : 'TASKS',
            teacher_remarks: manual ? manual.teacher_remarks : null
          });
        }

        const percentage = totalMarks > 0 ? round2((obtainedMarks / totalMarks) * 100) : null;
        let passStatus = 'PENDING';
        let resultStatus = 'DRAFT';
        if (hasMissingCoverage) {
          resultStatus = 'INCOMPLETE';
        } else if (percentage !== null) {
          const failsOverall = percentage < Number(policy.min_overall_percentage);
          if (absentCount > 0 && policy.absent_policy === 'FAIL') {
            passStatus = 'FAILED';
          } else if (!failsOverall && failedCount <= Number(policy.max_failed_subjects)) {
            passStatus = 'PASSED';
          } else if (
            policy.supplementary_allowed &&
            failedCount > 0 &&
            failedCount <= Number(policy.max_supplementary_subjects)
          ) {
            passStatus = 'SUPPLEMENTARY';
          } else {
            passStatus = 'FAILED';
          }
        }

        const header = {
          enrollment_id: enrollmentId,
          student_id: student.studentId,
          class_id: classId,
          session_id: session.id,
          term_id: term.id,
          total_marks: round2(totalMarks),
          obtained_marks: round2(obtainedMarks),
          percentage,
          overall_grade: percentage !== null ? letterGrade(percentage) : null,
          subjects_count: subjects.length,
          graded_subjects_count: gradedSubjects,
          failed_subjects_count: failedCount,
          absent_subjects_count: absentCount,
          result_status: resultStatus,
          pass_status: passStatus,
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
  }
};
