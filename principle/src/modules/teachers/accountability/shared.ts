/** Shared labels and formatting for the teacher academic accountability screens. */

export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export const STATUS_META: Record<string, { label: string; variant: BadgeVariant }> = {
  ON_TRACK: { label: 'On Track', variant: 'info' },
  DUE_SOON: { label: 'Due Soon', variant: 'warning' },
  PENDING: { label: 'Pending', variant: 'warning' },
  OVERDUE: { label: 'Overdue', variant: 'danger' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  EXCUSED: { label: 'Excused', variant: 'neutral' },
  RETURNED: { label: 'Returned for Revision', variant: 'info' },
  UNDER_REVIEW: { label: 'Under Review', variant: 'info' },
  NOT_REQUIRED: { label: 'Not Required', variant: 'neutral' }
};

export const statusMeta = (s: string) => STATUS_META[s] || { label: s, variant: 'neutral' as BadgeVariant };

export const OBLIGATION_LABELS: Record<string, string> = {
  ASSIGNMENT_GRADING: 'Assignment grading',
  QUIZ_MANUAL_GRADING: 'Quiz / test written answers',
  MARKS_UPLOAD: 'Exam marks upload'
};

export const CATEGORY_LABELS: Record<string, string> = {
  quizzes: 'Quizzes',
  assignments: 'Assignments',
  tests: 'Tests'
};

/** "3 days 4 h", "5 h 20 min", "12 min" */
export function formatDuration(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return '—';
  const minutes = Math.round(ms / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days} day${days === 1 ? '' : 's'}${hours ? ` ${hours} h` : ''}`;
  if (hours > 0) return `${hours} h${mins ? ` ${mins} min` : ''}`;
  return `${mins} min`;
}

export const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export function downloadCsv(filename: string, header: string[], rows: (string | number | null | undefined)[][]) {
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [header.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
