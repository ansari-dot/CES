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

/** Which parent sidebar section (route) a notification belongs to. */
export function parentSectionFor(type?: string, recordType?: string): string | null {
  const t = (type || '').toLowerCase();
  const r = (recordType || '').toLowerCase();

  // Related record first: a graded assignment is "Result Published" + Submission
  if (r === 'task' || r === 'submission') return '/parent/assignments';
  if (r === 'monthlytest' || r.includes('result') || r.startsWith('terminalexam') || r === 'promotion' || r === 'academicalert') {
    return '/parent/results';
  }
  if (r.includes('attendance')) return '/parent/attendance';
  if (r === 'achievement') return '/parent/achievements';
  if (r === 'notice') return '/parent/notices';
  if (r === 'calendarevent') return '/parent/dashboard';

  if (t.includes('assignment') || t.includes('submission')) return '/parent/assignments';
  if (t.includes('fee') || t.includes('challan') || t.includes('payment')) return '/parent/fees';
  if (t.includes('result') || t.includes('marks') || t.includes('test') || t.includes('exam') || t.includes('academic alert') || t.includes('promotion')) {
    return '/parent/results';
  }
  if (t.includes('attendance')) return '/parent/attendance';
  if (t.includes('achievement')) return '/parent/achievements';
  if (t.includes('notice')) return '/parent/notices';
  if (t.includes('holiday') || t.includes('calendar')) return '/parent/dashboard';
  return null;
}
