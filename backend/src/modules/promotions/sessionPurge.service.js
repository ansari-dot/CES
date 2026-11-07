import fs from 'fs/promises';
import path from 'path';
import { db } from '../../shared/db/knex.js';
import { UPLOAD_ROOT } from '../../shared/storage/upload.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { isStaff } from '../../shared/services/accessScope.js';

function extractFilename(fileUrl) {
  if (!fileUrl || typeof fileUrl !== 'string') return null;
  const clean = fileUrl.trim();
  if (!clean) return null;
  const basename = path.basename(clean);
  return basename || null;
}

export const sessionPurgeService = {
  /**
   * Preview the purge manifest (Dry Run).
   * Validates preconditions and returns summary counts without deleting anything.
   */
  async previewPurge({ fromSessionId, toSessionId }, actor, trx = db) {
    if (!isStaff(actor)) {
      throw new AppError('Forbidden: Principal or Admin authorization required', 403, ErrorCodes.FORBIDDEN);
    }

    const fromSession = await trx('academic_sessions').where({ id: Number(fromSessionId) }).first();
    const toSession = await trx('academic_sessions').where({ id: Number(toSessionId) }).first();

    if (!fromSession) throw new AppError('Source academic session not found', 404, ErrorCodes.NOT_FOUND);
    if (!toSession) throw new AppError('Target academic session not found', 404, ErrorCodes.NOT_FOUND);
    if (fromSession.id === toSession.id) {
      throw new AppError('Source and target academic sessions must be distinct', 422, ErrorCodes.VALIDATION_ERROR);
    }

    // 1. Precondition checks
    // Check if there are active enrollments that haven't been promoted/decided
    const unexecutedPromotions = await trx('promotion_records')
      .where({ session_id: fromSession.id })
      .whereNot({ status: 'EXECUTED' })
      .count({ count: '*' });

    const totalEnrollments = await trx('enrollments')
      .where({ session_id: fromSession.id })
      .count({ count: '*' });

    // Check if terminal results are published
    const unpublishedFinalResults = await trx('final_results')
      .where({ session_id: fromSession.id })
      .whereNot({ result_status: 'PUBLISHED' })
      .count({ count: '*' });

    // Check if there are any active/unresolved supplementary exams
    const activeSupplementaryExams = await trx('supplementary_exam_results')
      .where({ session_id: fromSession.id })
      .whereIn('status', ['AWAITING_SCHEDULE', 'SCHEDULED', 'DRAFT', 'SUBMITTED', 'APPROVED'])
      .count({ count: '*' });

    const warnings = [];
    if (Number(unpublishedFinalResults[0]?.count || 0) > 0) {
      warnings.push(`${unpublishedFinalResults[0].count} final result cards are not yet published.`);
    }
    if (Number(unexecutedPromotions[0]?.count || 0) > 0) {
      warnings.push(`${unexecutedPromotions[0].count} promotion records are not yet executed.`);
    }
    if (Number(activeSupplementaryExams[0]?.count || 0) > 0) {
      warnings.push(`${activeSupplementaryExams[0].count} supplementary exam results are still pending.`);
    }

    // 2. Counts of Ephemeral Records to be Purged
    // Task submissions & learning tasks
    const [taskCount] = await trx('learning_tasks').where({ session_id: fromSession.id }).count({ count: '*' });
    const [subCount] = await trx('task_submissions as ts')
      .join('learning_tasks as lt', 'ts.task_id', 'lt.id')
      .where('lt.session_id', fromSession.id)
      .count({ count: '*' });

    // Learning resources tagged with this session
    const [resCount] = await trx('learning_resources')
      .where({ session_id: fromSession.id })
      .count({ count: '*' });

    // Tests, attempts, questions (excluding tests linked to supplementary exams)
    const [monthlyTestsCount] = await trx('monthly_tests')
      .where('session_id', fromSession.id)
      .whereIn('exam_type', ['MONTHLY_TEST', 'MID_TERM', 'CLASS_QUIZ'])
      .whereNotIn('id', function () {
        this.select('monthly_test_id').from('supplementary_exam_results').whereNotNull('monthly_test_id');
      })
      .count({ count: '*' });

    const [testAttemptsCount] = await trx('test_attempts as ta')
      .join('monthly_tests as mt', 'ta.test_id', 'mt.id')
      .where('mt.session_id', fromSession.id)
      .whereIn('mt.exam_type', ['MONTHLY_TEST', 'MID_TERM', 'CLASS_QUIZ'])
      .whereNotIn('mt.id', function () {
        this.select('monthly_test_id').from('supplementary_exam_results').whereNotNull('monthly_test_id');
      })
      .count({ count: '*' });

    // Daily attendance, timetable delivery, zoom logs
    const [lessonsCount] = await trx('timetable_lessons as tl')
      .join('timetable_slots as ts', 'tl.slot_id', 'ts.id')
      .where('ts.session_id', fromSession.id)
      .count({ count: '*' });

    const [attendanceCount] = await trx('lesson_attendance as la')
      .join('timetable_lessons as tl', 'la.lesson_id', 'tl.id')
      .join('timetable_slots as ts', 'tl.slot_id', 'ts.id')
      .where('ts.session_id', fromSession.id)
      .count({ count: '*' });

    const [slotsCount] = await trx('timetable_slots').where({ session_id: fromSession.id }).count({ count: '*' });

    // Continuous alerts
    const [alertsCount] = await trx('academic_parent_alerts').where({ session_id: fromSession.id }).count({ count: '*' });

    // 3. Counts of Preserved Immortal Records
    const [terminalCardsCount] = await trx('final_results').where({ session_id: fromSession.id }).count({ count: '*' });
    const [terminalSubjectsCount] = await trx('final_result_subjects as frs')
      .join('final_results as fr', 'frs.final_result_id', 'fr.id')
      .where('fr.session_id', fromSession.id)
      .count({ count: '*' });
    const [suppPreservedCount] = await trx('supplementary_exam_results').where({ session_id: fromSession.id }).count({ count: '*' });

    // 4. File counts
    const submissionFiles = await trx('task_submissions as ts')
      .join('learning_tasks as lt', 'ts.task_id', 'lt.id')
      .where('lt.session_id', fromSession.id)
      .whereNotNull('ts.file_url')
      .select('ts.file_url');

    const handoutFiles = await trx('learning_tasks')
      .where({ session_id: fromSession.id })
      .whereNotNull('handout_url')
      .select('handout_url');

    const totalFilesToClean = submissionFiles.length + handoutFiles.length;

    const safeName = String(fromSession.name).replace(/[^A-Za-z0-9]/g, '_').toUpperCase();
    const challengePhrase = `CONFIRM_PURGE_SESSION_${safeName}`;

    return {
      sessions: {
        from: { id: fromSession.id, name: fromSession.name, status: fromSession.status },
        to: { id: toSession.id, name: toSession.name, status: toSession.status }
      },
      preconditionStatus: {
        canProceed: warnings.length === 0,
        warnings,
        totalEnrollments: Number(totalEnrollments[0]?.count || 0),
        unexecutedPromotions: Number(unexecutedPromotions[0]?.count || 0),
        unpublishedFinalResults: Number(unpublishedFinalResults[0]?.count || 0),
        activeSupplementaryExams: Number(activeSupplementaryExams[0]?.count || 0)
      },
      recordsToBePermanentlyPurged: {
        learningTasks: Number(taskCount[0]?.count || 0),
        taskSubmissions: Number(subCount[0]?.count || 0),
        sessionLearningResources: Number(resCount[0]?.count || 0),
        monthlyTestsAndQuizzes: Number(monthlyTestsCount[0]?.count || 0),
        testAttempts: Number(testAttemptsCount[0]?.count || 0),
        dailyAttendanceMarks: Number(attendanceCount[0]?.count || 0),
        timetableLessons: Number(lessonsCount[0]?.count || 0),
        timetableSlots: Number(slotsCount[0]?.count || 0),
        continuousAlerts: Number(alertsCount[0]?.count || 0)
      },
      recordsPreservedInPerpetuity: {
        terminalResultCards: Number(terminalCardsCount[0]?.count || 0),
        subjectTerminalMarks: Number(terminalSubjectsCount[0]?.count || 0),
        supplementaryResitLedger: Number(suppPreservedCount[0]?.count || 0),
        historicalEnrollments: Number(totalEnrollments[0]?.count || 0),
        academicSessionRecord: 'Preserved with status CLOSED',
        studentsAndMasterCatalogs: 'Preserved completely'
      },
      storageCleanup: {
        estimatedFilesQueued: totalFilesToClean
      },
      challengePhrase
    };
  },

  /**
   * Confirmed Execution: Phase 1 (Atomic Database Purge) + Phase 2 (Post-Commit File Cleanup)
   */
  async executePurge({ fromSessionId, toSessionId, confirmationPhrase }, actor) {
    if (!isStaff(actor)) {
      throw new AppError('Forbidden: Principal or Admin authorization required', 403, ErrorCodes.FORBIDDEN);
    }

    const fromSession = await db('academic_sessions').where({ id: Number(fromSessionId) }).first();
    const toSession = await db('academic_sessions').where({ id: Number(toSessionId) }).first();

    if (!fromSession || !toSession) {
      throw new AppError('Specified academic session not found', 404, ErrorCodes.NOT_FOUND);
    }

    const safeName = String(fromSession.name).replace(/[^A-Za-z0-9]/g, '_').toUpperCase();
    const expectedPhrase = `CONFIRM_PURGE_SESSION_${safeName}`;
    if (String(confirmationPhrase || '').trim() !== expectedPhrase) {
      throw new AppError(
        `Invalid confirmation phrase. Expected: "${expectedPhrase}"`,
        422,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    // PHASE 1: ATOMIC DATABASE TRANSACTION
    let purgedSummary = {};
    let queuedFilesCount = 0;
    let terminalCardsPreserved = 0;

    await db.transaction(async (trx) => {
      // 1. Gather all file URLs to stage into purge_file_cleanup_queue
      const submissionRows = await trx('task_submissions as ts')
        .join('learning_tasks as lt', 'ts.task_id', 'lt.id')
        .where('lt.session_id', fromSession.id)
        .whereNotNull('ts.file_url')
        .select('ts.file_url');

      const handoutRows = await trx('learning_tasks')
        .where({ session_id: fromSession.id })
        .whereNotNull('handout_url')
        .select('handout_url');

      const resourceRows = await trx('learning_resources')
        .where({ session_id: fromSession.id })
        .whereNotNull('file_url')
        .select('file_url');

      const questionImageRows = await trx('test_questions as tq')
        .join('monthly_tests as mt', 'tq.test_id', 'mt.id')
        .where('mt.session_id', fromSession.id)
        .whereIn('mt.exam_type', ['MONTHLY_TEST', 'MID_TERM', 'CLASS_QUIZ'])
        .whereNotNull('tq.image_url')
        .select('tq.image_url');

      const fileQueueEntries = [];
      const seenPaths = new Set();

      const addEntry = (url, type) => {
        const fn = extractFilename(url);
        if (fn && !seenPaths.has(fn)) {
          seenPaths.add(fn);
          fileQueueEntries.push({
            session_id: fromSession.id,
            file_type: type,
            file_path: fn,
            status: 'PENDING'
          });
        }
      };

      submissionRows.forEach((r) => addEntry(r.file_url, 'SUBMISSION'));
      handoutRows.forEach((r) => addEntry(r.handout_url, 'HANDOUT'));
      resourceRows.forEach((r) => addEntry(r.file_url, 'RESOURCE'));
      questionImageRows.forEach((r) => addEntry(r.image_url, 'QUESTION_IMAGE'));

      if (fileQueueEntries.length > 0) {
        // Insert ignoring existing duplicate paths
        for (const entry of fileQueueEntries) {
          await trx.raw(
            `INSERT INTO purge_file_cleanup_queue (session_id, file_type, file_path, status)
             VALUES (?, ?, ?, 'PENDING')
             ON DUPLICATE KEY UPDATE status = VALUES(status)`,
            [entry.session_id, entry.file_type, entry.file_path]
          );
        }
      }
      queuedFilesCount = fileQueueEntries.length;

      // 2. Perform Bottom-Up Hard Deletion of Ephemeral Tables

      // A. Test questions and attempts answers
      const subqueryPurgedTests = trx('monthly_tests')
        .where('session_id', fromSession.id)
        .whereIn('exam_type', ['MONTHLY_TEST', 'MID_TERM', 'CLASS_QUIZ'])
        .whereNotIn('id', function () {
          this.select('monthly_test_id').from('supplementary_exam_results').whereNotNull('monthly_test_id');
        })
        .select('id');

      const subqueryPurgedAttempts = trx('test_attempts')
        .whereIn('test_id', subqueryPurgedTests)
        .select('id');

      const deletedAnswers = await trx('test_attempt_answers')
        .whereIn('attempt_id', subqueryPurgedAttempts)
        .delete();

      const deletedAttempts = await trx('test_attempts')
        .whereIn('test_id', subqueryPurgedTests)
        .delete();

      const deletedQuestions = await trx('test_questions')
        .whereIn('test_id', subqueryPurgedTests)
        .delete();

      const deletedMonthlyTests = await trx('monthly_tests')
        .where('session_id', fromSession.id)
        .whereIn('exam_type', ['MONTHLY_TEST', 'MID_TERM', 'CLASS_QUIZ'])
        .whereNotIn('id', function () {
          this.select('monthly_test_id').from('supplementary_exam_results').whereNotNull('monthly_test_id');
        })
        .delete();

      // B. Tasks & submissions
      const subqueryTasks = trx('learning_tasks').where({ session_id: fromSession.id }).select('id');

      const deletedSubmissions = await trx('task_submissions')
        .whereIn('task_id', subqueryTasks)
        .delete();

      const deletedTasks = await trx('learning_tasks')
        .where({ session_id: fromSession.id })
        .delete();

      // C. Session-specific learning resources
      const deletedResources = await trx('learning_resources')
        .where({ session_id: fromSession.id })
        .delete();

      // D. Attendance & Daily Delivery Logs
      const subquerySlots = trx('timetable_slots').where({ session_id: fromSession.id }).select('id');
      const subqueryLessons = trx('timetable_lessons').whereIn('slot_id', subquerySlots).select('id');

      const deletedAttendanceCorrections = await trx('attendance_corrections')
        .whereIn('lesson_id', subqueryLessons)
        .delete();

      const deletedLessonAttendance = await trx('lesson_attendance')
        .whereIn('lesson_id', subqueryLessons)
        .delete();

      const deletedAttendanceSubmissions = await trx('lesson_attendance_submissions')
        .whereIn('lesson_id', subqueryLessons)
        .delete();

      const deletedDutySessions = await trx('teacher_duty_sessions')
        .whereIn('lesson_id', subqueryLessons)
        .delete();

      const deletedZoomParticipantLogs = await trx('zoom_participant_log')
        .whereIn('lesson_id', subqueryLessons)
        .delete();

      const deletedZoomEvents = await trx('zoom_events')
        .whereIn('lesson_id', subqueryLessons)
        .delete();

      const deletedTimetableChangeLogs = await trx('timetable_change_log')
        .whereIn('slot_id', subquerySlots)
        .orWhereIn('lesson_id', subqueryLessons)
        .delete();

      const deletedLessons = await trx('timetable_lessons')
        .whereIn('slot_id', subquerySlots)
        .delete();

      const deletedSlots = await trx('timetable_slots')
        .where({ session_id: fromSession.id })
        .delete();

      // E. Continuous alerts & expired cooldowns
      const deletedAlerts = await trx('academic_parent_alerts')
        .where({ session_id: fromSession.id })
        .delete();

      const deletedCooldowns = await trx('academic_alert_cooldowns')
        .where('cooldown_expires_at', '<=', fromSession.end_date)
        .delete();

      const deletedAchievements = await trx('student_achievements')
        .where({ session_id: fromSession.id })
        .delete();

      purgedSummary = {
        testAttemptAnswers: deletedAnswers,
        testAttempts: deletedAttempts,
        testQuestions: deletedQuestions,
        monthlyTests: deletedMonthlyTests,
        taskSubmissions: deletedSubmissions,
        learningTasks: deletedTasks,
        learningResources: deletedResources,
        attendanceCorrections: deletedAttendanceCorrections,
        lessonAttendanceMarks: deletedLessonAttendance,
        lessonAttendanceSubmissions: deletedAttendanceSubmissions,
        teacherDutySessions: deletedDutySessions,
        zoomParticipantLogs: deletedZoomParticipantLogs,
        zoomEvents: deletedZoomEvents,
        timetableLessons: deletedLessons,
        timetableSlots: deletedSlots,
        timetableChangeLogs: deletedTimetableChangeLogs,
        academicParentAlerts: deletedAlerts,
        academicAlertCooldowns: deletedCooldowns,
        studentAchievements: deletedAchievements
      };

      // 3. Count preserved terminal cards
      const [tcCount] = await trx('final_results')
        .where({ session_id: fromSession.id })
        .count({ count: '*' });
      terminalCardsPreserved = Number(tcCount?.count || 0);

      // 4. Atomic Session Transition: Close old, Activate new
      await trx('academic_sessions')
        .where({ id: fromSession.id })
        .update({
          is_current: 0,
          status: 'CLOSED',
          closed_at: trx.fn.now(3),
          closed_by: actor.id
        });

      await trx('academic_sessions')
        .where({ id: toSession.id })
        .update({
          is_current: 1,
          status: 'ACTIVE'
        });

      // 5. Insert receipt into session_purge_history
      await trx('session_purge_history').insert({
        session_id: fromSession.id,
        session_name: fromSession.name,
        target_session_id: toSession.id,
        target_session_name: toSession.name,
        executed_by: actor.id,
        executed_at: trx.fn.now(3),
        records_purged_summary: JSON.stringify(purgedSummary),
        terminal_cards_preserved: terminalCardsPreserved,
        files_queued_for_cleanup: queuedFilesCount,
        challenge_phrase_used: confirmationPhrase,
        status: 'COMPLETED'
      });

      // 6. Audit Log
      await trx('audit_logs').insert({
        actor_id: actor.id,
        actor_name: actor.username || actor.name || 'Principal',
        actor_role: actor.role || 'PRINCIPAL',
        action: 'EXECUTE_PERMANENT_SESSION_PURGE',
        record_type: 'Academic Session',
        record_identifier: `${fromSession.name} -> ${toSession.name}`,
        new_value: JSON.stringify({
          purgedSummary,
          terminalCardsPreserved,
          filesQueued: queuedFilesCount
        })
      });
    });

    // PHASE 2: POST-COMMIT PHYSICAL FILE CLEANUP (Retryable out-of-band)
    const cleanupResults = await this.cleanupPurgedFiles(fromSession.id);

    return {
      success: true,
      message: `Academic Year "${fromSession.name}" records permanently purged. "${toSession.name}" is now ACTIVE.`,
      sessionRollover: {
        closedSession: fromSession.name,
        activeSession: toSession.name
      },
      terminalCardsPreserved,
      purgedSummary,
      fileCleanup: cleanupResults
    };
  },

  /**
   * Phase 2: Post-commit retryable file unlinking from disk storage.
   */
  async cleanupPurgedFiles(sessionId) {
    const queue = await db('purge_file_cleanup_queue')
      .where({ session_id: sessionId, status: 'PENDING' })
      .limit(1000);

    let deletedCount = 0;
    let failedCount = 0;

    for (const item of queue) {
      const fullPath = path.join(UPLOAD_ROOT, item.file_path);
      try {
        await fs.unlink(fullPath);
        await db('purge_file_cleanup_queue')
          .where({ id: item.id })
          .update({
            status: 'DELETED',
            deleted_at: db.fn.now(3)
          });
        deletedCount += 1;
      } catch (err) {
        if (err.code === 'ENOENT') {
          // File was already missing on disk; mark DELETED
          await db('purge_file_cleanup_queue')
            .where({ id: item.id })
            .update({
              status: 'DELETED',
              deleted_at: db.fn.now(3)
            });
          deletedCount += 1;
        } else {
          // Failure (permission, lock, etc.)
          await db('purge_file_cleanup_queue')
            .where({ id: item.id })
            .update({
              status: 'FAILED',
              retry_count: item.retry_count + 1,
              error_message: String(err.message).slice(0, 500)
            });
          failedCount += 1;
        }
      }
    }

    return {
      totalProcessed: queue.length,
      deletedCount,
      failedCount
    };
  },

  /**
   * List history of permanent session purges.
   */
  async getPurgeHistory() {
    return await db('session_purge_history as sph')
      .join('users as u', 'sph.executed_by', 'u.id')
      .leftJoin('roles as r', 'u.role_id', 'r.id')
      .select(
        'sph.id',
        'sph.session_id as sessionId',
        'sph.session_name as sessionName',
        'sph.target_session_id as targetSessionId',
        'sph.target_session_name as targetSessionName',
        'sph.executed_at as executedAt',
        'sph.records_purged_summary as recordsPurgedSummary',
        'sph.terminal_cards_preserved as terminalCardsPreserved',
        'sph.files_queued_for_cleanup as filesQueuedForCleanup',
        'sph.challenge_phrase_used as challengePhraseUsed',
        'sph.status',
        'u.full_name as executedByName',
        'r.code as executedByRole'
      )
      .orderBy('sph.executed_at', 'desc');
  }
};
