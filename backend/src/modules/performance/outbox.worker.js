import crypto from 'crypto';
import { db } from '../../shared/db/knex.js';
import { notificationService } from '../../shared/services/notificationService.js';

let workerInterval = null;

export const outboxWorker = {
  /**
   * Process one batch of pending or failed outbox entries.
   */
  async processBatch(batchSize = 10) {
    const leaseToken = crypto.randomUUID();
    const now = new Date();

    // 1. Claim pending items using lease token
    const claimedCount = await db('academic_alert_outbox')
      .whereIn('status', ['PENDING', 'FAILED'])
      .andWhere('next_retry_at', '<=', now)
      .andWhere((builder) => {
        builder.whereNull('lock_expires_at').orWhere('lock_expires_at', '<', now);
      })
      .orderBy('id', 'asc')
      .limit(batchSize)
      .update({
        status: 'PROCESSING',
        lease_token: leaseToken,
        locked_at: trxRaw('CURRENT_TIMESTAMP(3)'),
        lock_expires_at: trxRaw('DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL 60 SECOND)'),
        updated_at: trxRaw('CURRENT_TIMESTAMP(3)')
      });

    if (!claimedCount) return { processed: 0, succeeded: 0, failed: 0 };

    // 2. Fetch the claimed records
    const items = await db('academic_alert_outbox')
      .where({ lease_token: leaseToken, status: 'PROCESSING' })
      .select('*');

    let succeeded = 0;
    let failed = 0;

    for (const item of items) {
      try {
        const payload = typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload;

        // Dispatch via existing notificationService (creates notice + sends websocket event)
        await notificationService.notifyUsers([payload.userId], {
          title: payload.title,
          message: payload.message,
          type: 'Academic Alert',
          priority: payload.isUrgent ? 'High' : 'Medium',
          relatedRecordId: item.alert_id,
          relatedRecordType: 'AcademicAlert'
        });

        // Dispatch alert email if parent email is provided
        const parentEmail = payload.parentEmail || payload.email;
        if (parentEmail) {
          try {
            const { emailService } = await import('../../shared/email/email.service.js');
            await emailService.sendMonthlyTestPerformanceAlert({
              to: parentEmail,
              parentName: payload.parentName,
              studentName: payload.studentName,
              testTitle: payload.testTitle || payload.title,
              subjectName: payload.subjectName || 'Academic Subject',
              totalMarks: payload.totalMarks || 100,
              passingMarks: payload.passingMarks || 40,
              obtainedMarks: payload.score,
              percentage: payload.score,
              isPassed: false,
              teacherRemarks: payload.message
            });
          } catch (emailErr) {
            console.warn('[OutboxWorker] Parent alert email dispatch warning:', emailErr.message);
          }
        }

        // Update outbox and recipient state transactionally
        await db.transaction(async (trx) => {
          await trx('academic_alert_outbox')
            .where({ id: item.id })
            .update({
              status: 'DELIVERED',
              delivered_at: trx.raw('CURRENT_TIMESTAMP(3)'),
              lease_token: null,
              locked_at: null,
              lock_expires_at: null,
              updated_at: trx.raw('CURRENT_TIMESTAMP(3)')
            });

          await trx('academic_alert_recipients')
            .where({ id: item.recipient_id })
            .update({
              status: 'SENT',
              sent_at: trx.raw('CURRENT_TIMESTAMP(3)'),
              updated_at: trx.raw('CURRENT_TIMESTAMP(3)')
            });
        });

        succeeded += 1;
      } catch (err) {
        failed += 1;
        const newRetryCount = Number(item.retry_count || 0) + 1;
        const isDeadLetter = newRetryCount >= Number(item.max_retries || 5);
        const backoffSeconds = Math.min(3600, 30 * Math.pow(2, newRetryCount));

        await db.transaction(async (trx) => {
          await trx('academic_alert_outbox')
            .where({ id: item.id })
            .update({
              status: isDeadLetter ? 'DEAD_LETTER' : 'FAILED',
              retry_count: newRetryCount,
              next_retry_at: trx.raw(`DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL ${backoffSeconds} SECOND)`),
              lease_token: null,
              locked_at: null,
              lock_expires_at: null,
              last_error: err.message,
              updated_at: trx.raw('CURRENT_TIMESTAMP(3)')
            });

          if (isDeadLetter) {
            await trx('academic_alert_recipients')
              .where({ id: item.recipient_id })
              .update({
                status: 'FAILED',
                failure_reason: `Max retries exceeded: ${err.message}`,
                updated_at: trx.raw('CURRENT_TIMESTAMP(3)')
              });
          }
        });
      }
    }

    return { processed: items.length, succeeded, failed };
  },

  start(intervalMs = 15000) {
    if (workerInterval) return;
    workerInterval = setInterval(async () => {
      try {
        await this.processBatch(15);
      } catch (err) {
        console.warn('[OutboxWorker] Batch processing warning:', err.message);
      }
    }, intervalMs);
    // Unref so process can cleanly exit during tests/shutdown
    if (workerInterval.unref) workerInterval.unref();
  },

  stop() {
    if (workerInterval) {
      clearInterval(workerInterval);
      workerInterval = null;
    }
  }
};

function trxRaw(sql) {
  return db.raw(sql);
}

