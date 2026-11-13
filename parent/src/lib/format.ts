export const rupees = (value: number | null | undefined) => `Rs. ${Math.round(Number(value || 0)).toLocaleString()}`;

export const pct = (value: number | null | undefined) => (value == null ? '—' : `${value}%`);

// ─── User-specific timezone ─────────────────────────────────────────────────
// Instants are displayed in the parent's timezone (saved preference, else the browser zone).
// Date-only values (holidays, due dates) are school calendar dates and are never shifted.

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Karachi';
  } catch {
    return 'Asia/Karachi';
  }
}

let userTimeZone = browserTimeZone();

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function getUserTimeZone() {
  return userTimeZone;
}

export function setUserTimeZone(tz: string | null | undefined) {
  userTimeZone = isValidTimeZone(tz) ? tz : browserTimeZone();
}

export { browserTimeZone as getBrowserTimeZone };

/** Server instants: naive "YYYY-MM-DD HH:MM:SS" strings are UTC. */
function parseInstant(str: string): Date {
  const iso = str.includes('T') ? str : str.replace(' ', 'T');
  return new Date(/([zZ]|[+-]\d{2}:?\d{2})$/.test(iso) ? iso : `${iso}Z`);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const str = String(value);
  // DATE columns arrive as YYYY-MM-DD: a calendar date, formatted without timezone conversion
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
      new Date(Date.UTC(y, m - 1, d))
    );
  }
  const d = parseInstant(str);
  if (Number.isNaN(d.getTime())) return str;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: userTimeZone });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = parseInstant(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: userTimeZone
  });
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = parseInstant(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: userTimeZone });
}

export const COMMON_TIMEZONES: { value: string; label: string }[] = [
  { value: 'Asia/Karachi', label: 'Pakistan (Asia/Karachi)' },
  { value: 'Asia/Dubai', label: 'UAE (Asia/Dubai)' },
  { value: 'Asia/Riyadh', label: 'Saudi Arabia (Asia/Riyadh)' },
  { value: 'Europe/London', label: 'United Kingdom (Europe/London)' },
  { value: 'America/New_York', label: 'USA Eastern (America/New_York)' },
  { value: 'America/Chicago', label: 'USA Central (America/Chicago)' },
  { value: 'America/Los_Angeles', label: 'USA Pacific (America/Los_Angeles)' },
  { value: 'America/Toronto', label: 'Canada Eastern (America/Toronto)' },
  { value: 'Australia/Sydney', label: 'Australia (Australia/Sydney)' }
];

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
