/**
 * Fee lifecycle scheduler
 *
 * Billing policy (dates evaluated in config.SCHOOL_TIMEZONE, see fees.billing.js):
 *   - Monthly invoices issued for the current billing month (due on the 5th)
 *   - Grace period: 6th – 10th inclusive
 *   - Restriction: from 00:00 on the 11th for invoices still outstanding
 *
 * Each run (hourly, idempotent – safe to repeat or run concurrently):
 *   1. On days 1–5 of the month, generate the month's invoices for classes with
 *      an ACTIVE fee structure in the current session. Duplicates are skipped by
 *      the existing generator (normalised billing month), so paid invoices are
 *      never recreated or reset.
 *   2. Lift restrictions whose restricting invoices have since been settled.
 *   3. Restrict students with outstanding invoices past grace that have no
 *      fee_restriction_events row yet. Challans already covered by a resolved
 *      event (e.g. Principal manual restore) are not re-restricted.
 */

import { db } from '../../shared/db/knex.js';
import { config } from '../../config/index.js';
import { feesRepository } from './fees.repository.js';
import { getZonedDateParts, getCurrentBillingPeriod, toZonedDateString, DUE_DAY } from './fees.billing.js';

const RUN_INTERVAL_MS = 60 * 60 * 1000;

export async function generateCurrentMonthInvoices(now = new Date()) {
  const tz = config.SCHOOL_TIMEZONE;
  const { day } = getZonedDateParts(now, tz);
  if (day > DUE_DAY) return { skipped: 'outside generation window', created: 0 };

  const session = await db('academic_sessions').where({ is_current: 1 }).first();
  if (!session) return { skipped: 'no current session', created: 0 };

  const period = getCurrentBillingPeriod(now, tz);
  if (period.issueDate < String(session.start_date).slice(0, 10) || period.issueDate > String(session.end_date).slice(0, 10)) {
    return { skipped: 'billing month outside current session', created: 0 };
  }

  const structures = await db('fee_structures').where({ session_id: session.id, status: 'ACTIVE' }).select('class_id');

  let created = 0;
  for (const { class_id: classId } of structures) {
    const result = await feesRepository.generateMonthlyChallans({
      sessionId: session.id,
      classId,
      billingMonth: period.label,
      issueDate: period.issueDate,
      dueDate: period.dueDate,
      validUntil: period.validUntil,
      gracePeriodDays: period.gracePeriodDays
    });
    created += result.createdCount;
  }
  return { billingMonth: period.label, created };
}

export async function liftSettledRestrictions(now = new Date()) {
  const settled = await feesRepository.findSettledOpenRestrictions();
  let lifted = 0;
  for (const s of settled) {
    if (await feesRepository.liftSettledRestriction({ ...s, now })) lifted += 1;
  }
  return lifted;
}

export async function applyOverdueRestrictions(now = new Date()) {
  const schoolToday = toZonedDateString(now, config.SCHOOL_TIMEZONE);
  const candidates = await feesRepository.findRestrictionCandidates(schoolToday);

  const byStudent = new Map();
  for (const c of candidates) {
    if (!byStudent.has(c.studentId)) byStudent.set(c.studentId, []);
    byStudent.get(c.studentId).push(c);
  }

  const outcomes = { RESTRICTED: 0, ATTACHED: 0, SKIPPED: 0, FAILED: 0 };
  for (const [studentId, challans] of byStudent) {
    try {
      const outcome = await feesRepository.applyFeeRestriction({
        studentId,
        userId: challans[0].userId,
        challans,
        now
      });
      outcomes[outcome] += 1;
    } catch (err) {
      // e.g. a concurrent run inserted the same event first (unique key) – retried next run
      outcomes.FAILED += 1;
      console.error(`[FeeScheduler] Restriction failed for student ${studentId}:`, err.message);
    }
  }
  return outcomes;
}

export async function runFeeLifecycle(now = new Date()) {
  const invoices = await generateCurrentMonthInvoices(now);
  const lifted = await liftSettledRestrictions(now);
  const restrictions = await applyOverdueRestrictions(now);
  return { invoices, lifted, restrictions };
}

let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const summary = await runFeeLifecycle();
    if (summary.invoices.created || summary.lifted || summary.restrictions.RESTRICTED) {
      console.log('[FeeScheduler]', JSON.stringify(summary));
    }
  } catch (err) {
    console.error('[FeeScheduler] Run failed:', err.message);
  } finally {
    running = false;
  }
}

// Simple interval-based scheduler (no Redis/BullMQ dependency)
export function startFeeScheduler() {
  tick();
  const timer = setInterval(tick, RUN_INTERVAL_MS);
  return () => clearInterval(timer);
}
