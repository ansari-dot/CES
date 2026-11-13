import { useEffect, useState } from 'react';

/**
 * Sidebar activity counters ("mini notification badges").
 *
 * A badge counts UNREAD notifications for a sidebar section that arrived after the user
 * last opened that section. Opening the section clears it; reading the notification in
 * the bell clears it too. "Last opened" is remembered per user on this device.
 */

const SEEN_EVENT = 'ces:section-seen';
const storageKey = (scope: string) => `ces_section_seen_${scope}`;

function readSeen(scope: string): Record<string, number> {
  if (!scope) return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(scope)) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function markSectionsSeen(scope: string, sections: string[]) {
  if (!scope || sections.length === 0) return;
  const seen = readSeen(scope);
  const now = Date.now();
  sections.forEach((s) => {
    seen[s] = now;
  });
  try {
    localStorage.setItem(storageKey(scope), JSON.stringify(seen));
  } catch {
    // storage unavailable: counters still work for this page view
  }
  window.dispatchEvent(new CustomEvent(SEEN_EVENT, { detail: scope }));
}

export function useSeenMap(scope: string): Record<string, number> {
  const [seen, setSeen] = useState<Record<string, number>>(() => readSeen(scope));
  useEffect(() => {
    setSeen(readSeen(scope));
    const refresh = () => setSeen(readSeen(scope));
    window.addEventListener(SEEN_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(SEEN_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [scope]);
  return seen;
}

export interface ActivityItem {
  section: string | null;
  createdAt: number;
  unread: boolean;
}

export function countActivity(items: ActivityItem[], seen: Record<string, number>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    if (!item.section || !item.unread) continue;
    if (item.createdAt && item.createdAt <= (seen[item.section] || 0)) continue;
    counts[item.section] = (counts[item.section] || 0) + 1;
  }
  return counts;
}

export function toMs(value: unknown): number {
  if (!value) return 0;
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

export const badgeLabel = (n: number): string => (n > 99 ? '99+' : String(n));

/** Which teacher sidebar tab a notification belongs to. */
export function teacherSectionFor(type?: string, recordType?: string): string | null {
  const t = (type || '').toLowerCase();
  const r = (recordType || '').toLowerCase();

  if (r === 'submission' || r === 'task') return 'submissions-grading';
  if (r === 'monthlytest') return 'monthly-tests';
  if (r.startsWith('terminalexam') || r === 'markssubmission' || r.includes('result')) return 'exam-results';
  if (r === 'attendancecorrection' || r.includes('attendance')) return 'student-attendance';
  if (r.includes('timetable') || r === 'calendarevent') return 'timetable';
  if (r === 'resource') return 'learning-resources';
  if (r === 'academicalert') return 'student-performance';

  if (t.includes('submission') || t.includes('assignment')) return 'submissions-grading';
  if (t.includes('exam_announcement') || t.includes('exam_rescheduled') || t.includes('date sheet') || t.includes('datesheet')) {
    return 'datesheet';
  }
  if (t.includes('monthly') || t.includes('quiz') || t.includes('test')) return 'monthly-tests';
  if (t.includes('invigilation') || t.includes('marks') || t.includes('result') || t === 'terminal' || t === 'exam created') {
    return 'exam-results';
  }
  if (t.includes('correction') || t.includes('attendance')) return 'student-attendance';
  if (t.includes('timetable') || t.includes('substitute') || t.includes('slot') || t.includes('holiday') || t.includes('calendar')) {
    return 'timetable';
  }
  if (t.includes('zoom')) return 'live-lessons';
  if (t.includes('payroll') || t.includes('salary')) return 'duty-salary';
  if (t.includes('resource')) return 'learning-resources';
  if (t.includes('academic alert') || t.includes('performance')) return 'student-performance';
  if (t.includes('notice')) return 'notices';
  return null;
}
