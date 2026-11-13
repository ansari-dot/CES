/**
 * User-specific timezone display for the Principal / Admin portal.
 *
 * - The server stores instants in UTC. MySQL DATETIME values often arrive as naive strings
 *   ("2026-11-13 09:00:00"); those are UTC and are parsed as such (never as local time).
 * - Instants are displayed in the signed-in user's timezone (saved preference, else the
 *   browser's zone). DST is handled by the Intl API — no fixed offsets are added.
 * - Date-only school calendar values ("2026-11-16") are NOT instants and must be shown with
 *   formatDateOnly so a holiday never shifts to another day.
 */

export const DEFAULT_SCHOOL_TIMEZONE = 'Asia/Karachi';

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function getBrowserTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(tz) ? tz : DEFAULT_SCHOOL_TIMEZONE;
  } catch {
    return DEFAULT_SCHOOL_TIMEZONE;
  }
}

let activeTimeZone: string = getBrowserTimeZone();
const listeners = new Set<(tz: string) => void>();

export function getUserTimeZone(): string {
  return activeTimeZone;
}

export function setUserTimeZone(tz: string) {
  if (!isValidTimeZone(tz) || tz === activeTimeZone) return;
  activeTimeZone = tz;
  listeners.forEach((fn) => fn(tz));
}

export function onTimeZoneChange(fn: (tz: string) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Parse a server instant. Naive "YYYY-MM-DD HH:MM:SS" strings are UTC. */
export function parseUtcInstant(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') return new Date(value);
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return null; // date-only: not an instant
  const iso = s.includes('T') ? s : s.replace(' ', 'T');
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(iso);
  const d = new Date(hasZone ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateTime(
  value: string | number | Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  timeZone: string = activeTimeZone
): string {
  const d = parseUtcInstant(value);
  if (!d) return '—';
  return new Intl.DateTimeFormat('en-GB', { ...opts, timeZone }).format(d);
}

export function formatTime(value: string | number | Date | null | undefined, timeZone: string = activeTimeZone): string {
  return formatDateTime(value, { hour: '2-digit', minute: '2-digit' }, timeZone);
}

/** Date-only values (holidays, duty dates): format without any timezone conversion. */
export function formatDateOnly(
  key: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }
): string {
  if (!key) return '—';
  const m = String(key).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return String(key);
  return new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'UTC' }).format(
    new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  );
}

export function zoneAbbreviation(timeZone: string = activeTimeZone, at: Date = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName');
    return part?.value || timeZone;
  } catch {
    return timeZone;
  }
}

export const COMMON_TIMEZONES: { value: string; label: string }[] = [
  { value: 'Asia/Karachi', label: 'Pakistan (Asia/Karachi)' },
  { value: 'Asia/Dubai', label: 'UAE (Asia/Dubai)' },
  { value: 'Asia/Riyadh', label: 'Saudi Arabia (Asia/Riyadh)' },
  { value: 'Europe/London', label: 'United Kingdom (Europe/London)' },
  { value: 'Europe/Berlin', label: 'Central Europe (Europe/Berlin)' },
  { value: 'America/New_York', label: 'USA Eastern (America/New_York)' },
  { value: 'America/Chicago', label: 'USA Central (America/Chicago)' },
  { value: 'America/Denver', label: 'USA Mountain (America/Denver)' },
  { value: 'America/Los_Angeles', label: 'USA Pacific (America/Los_Angeles)' },
  { value: 'America/Toronto', label: 'Canada Eastern (America/Toronto)' },
  { value: 'Australia/Sydney', label: 'Australia (Australia/Sydney)' },
  { value: 'Asia/Kolkata', label: 'India (Asia/Kolkata)' },
  { value: 'Asia/Shanghai', label: 'China (Asia/Shanghai)' },
  { value: 'Asia/Tokyo', label: 'Japan (Asia/Tokyo)' }
];
