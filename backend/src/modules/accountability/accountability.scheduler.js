import { accountabilityService } from './accountability.service.js';

/**
 * Periodic accountability sweep (same pattern as the assessment expiry scheduler):
 * generates monthly requirements, closes finished months, syncs grading obligations and
 * sends reminders. Idempotent and guarded against overlapping runs; pages also compute
 * live status on open, so correctness never depends on this timer.
 */
let isRunning = false;
let timer = null;

export async function runAccountabilitySweep() {
  if (isRunning) return { skipped: true };
  isRunning = true;
  try {
    return await accountabilityService.runSweep();
  } catch (err) {
    console.warn('[AccountabilityScheduler] sweep warning:', err.message);
    return { ok: false };
  } finally {
    isRunning = false;
  }
}

export function startAccountabilityScheduler(intervalMs = 30 * 60 * 1000) {
  if (timer) return stopAccountabilityScheduler;
  setTimeout(() => runAccountabilitySweep(), 60 * 1000);
  timer = setInterval(() => runAccountabilitySweep(), intervalMs);
  return stopAccountabilityScheduler;
}

export function stopAccountabilityScheduler() {
  if (timer) clearInterval(timer);
  timer = null;
}
