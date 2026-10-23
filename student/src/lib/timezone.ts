/**
 * Timezone helpers for displaying the class schedule in the student's local time.
 *
 * The authoritative schedule is entered in the school's timezone: lessons are
 * stored as school wall-clock times converted to UTC (e.g. "2026-11-02T04:00:00.000Z"
 * = 9:00 AM in Asia/Karachi). We format that UTC instant in the student's
 * timezone. All offsets come from the browser's IANA database (Intl), so DST
 * transitions are respected and no fixed country offsets are hard-coded.
 * The original values are never modified.
 */

export const DEFAULT_SCHOOL_TIMEZONE = 'Asia/Karachi';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function getBrowserTimeZone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isValidTimeZone(tz) ? tz : null;
  } catch {
    return null;
  }
}

// Offset (ms) of `timeZone` from UTC at the given instant
function zoneOffsetMs(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instantMs));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(instantMs / 1000) * 1000;
}

/**
 * Safely parse a database UTC timestamp (e.g. "2026-10-24T04:00:00.000Z" or
 * "2026-10-24 04:00:00") to a Date object representing that exact UTC instant.
 * Does NOT apply a second timezone conversion to an already-UTC timestamp.
 */
export function parseUtcInstant(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const str = String(value).trim();
  if (!str) return null;
  const normalized = str.includes('T') ? str : str.replace(' ', 'T');
  const utcStr = normalized.endsWith('Z') || /[+-]\d{2}(?::?\d{2})?$/.test(normalized)
    ? normalized
    : `${normalized}Z`;
  const d = new Date(utcStr);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Convert a school wall-clock datetime string ("YYYY-MM-DD HH:MM[:SS]")
 * to the actual instant, using the school timezone rules for that date.
 */
export function schoolWallTimeToDate(value: string, schoolTimeZone: string): Date | null {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const wallAsUtc = Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s || 0));
  // Two passes resolve the offset correctly around DST changes
  let instant = wallAsUtc - zoneOffsetMs(wallAsUtc, schoolTimeZone);
  const corrected = wallAsUtc - zoneOffsetMs(instant, schoolTimeZone);
  if (corrected !== instant) instant = corrected;
  return new Date(instant);
}

/** "5:00 PM" in the given timezone */
export function formatTimeInZone(date: Date, timeZone: string): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone });
}

/** Local calendar date key "YYYY-MM-DD" of an instant in the given timezone */
export function dateKeyInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** "Mon 19" for a "YYYY-MM-DD" key */
export function dayLabelFromKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}`;
}

/** "19 Oct 2026" for a "YYYY-MM-DD" key */
export function longDateFromKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Short zone name for display, e.g. "GMT", "BST", "GMT+5" */
export function zoneAbbreviation(timeZone: string, at: Date = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName');
    return part?.value || timeZone;
  } catch {
    return timeZone;
  }
}
