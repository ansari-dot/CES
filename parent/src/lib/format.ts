export const rupees = (value: number | null | undefined) => `Rs. ${Math.round(Number(value || 0)).toLocaleString()}`;

export const pct = (value: number | null | undefined) => (value == null ? '—' : `${value}%`);

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const str = String(value);
  // DATE columns arrive as YYYY-MM-DD; parse as a local date to avoid timezone shifts
  const d = /^\d{4}-\d{2}-\d{2}$/.test(str) ? new Date(`${str}T00:00:00`) : new Date(str);
  if (Number.isNaN(d.getTime())) return str;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const TASK_TYPE_LABELS: Record<string, string> = {
  ASSIGNMENT: 'Assignment',
  QUIZ: 'Quiz',
  TEST: 'Test',
  EXAM: 'Examination',
};

export const CHALLAN_STATUS_LABELS: Record<string, string> = {
  UNPAID: 'Unpaid',
  PENDING_VERIFICATION: 'Pending Verification',
  PARTIALLY_PAID: 'Partially Paid',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
};
