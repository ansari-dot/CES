import { assessmentsRepository } from './assessments.repository.js';
import { assessmentsService } from './assessments.service.js';

let isRunning = false;

/**
 * Runs a periodic sweep over all expired in-progress test attempts
 * to guarantee that tests auto-submit server-side even if student closed tab.
 */
export async function runAssessmentExpirySweep() {
  if (isRunning) return { skipped: true, reason: 'ALREADY_RUNNING' };
  isRunning = true;

  try {
    const expiredAttempts = await assessmentsRepository.findExpiredInProgressAttempts(new Date());
    if (expiredAttempts.length === 0) {
      return { finalizedCount: 0 };
    }

    let finalizedCount = 0;
    for (const attempt of expiredAttempts) {
      try {
        await assessmentsService.finalizeAttempt(attempt.id, 'AUTO_EXPIRED');
        finalizedCount++;
      } catch (err) {
        console.warn(`[AssessmentScheduler] Failed to auto-finalize attempt #${attempt.id}:`, err.message);
      }
    }

    return { finalizedCount };
  } finally {
    isRunning = false;
  }
}

let intervalTimer = null;

export function startAssessmentExpiryScheduler(intervalMs = 30000) {
  if (intervalTimer) return;
  intervalTimer = setInterval(() => {
    runAssessmentExpirySweep().catch((err) => {
      console.warn('[AssessmentScheduler] Sweeper cycle error:', err.message);
    });
  }, intervalMs);

  // Unref timer so it doesn't prevent Node process from clean exit in test/scripts
  if (intervalTimer.unref) intervalTimer.unref();
}

export function stopAssessmentExpiryScheduler() {
  if (intervalTimer) {
    clearInterval(intervalTimer);
    intervalTimer = null;
  }
}

