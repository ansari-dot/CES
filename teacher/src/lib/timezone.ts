/**
 * Timezone helpers for displaying the class schedule in the teacher's local time.
 *
 * Stored schedules are in UTC (for lessons) or in Asia/Karachi (for recurring slots).
 * All conversions use browser Intl with IANA timezone identifiers.
 */

export const DEFAULT_SCHOOL_TIMEZONE = 'Asia/Karachi';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

/**
 * Safely parse a database UTC timestamp (e.g. "2026-10-24T04:00:00.000Z" or
 * "2026-10-24 04:00:00") to a Date object representing that exact UTC instant.
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

export interface TimezoneOption {
  value: string;
  label: string;
  offset: string;
}

export const COMMON_TIMEZONES: TimezoneOption[] = [
  { value: 'Asia/Karachi', label: 'Pakistan (PKT)', offset: 'UTC+5' },
  { value: 'Asia/Dubai', label: 'UAE / Gulf (GST)', offset: 'UTC+4' },
  { value: 'Asia/Riyadh', label: 'Saudi Arabia (AST)', offset: 'UTC+3' },
  { value: 'Asia/Kolkata', label: 'India (IST)', offset: 'UTC+5:30' },
  { value: 'Asia/Dhaka', label: 'Bangladesh (BST)', offset: 'UTC+6' },
  { value: 'Europe/London', label: 'United Kingdom (GMT/BST)', offset: 'UTC+0/+1' },
  { value: 'Europe/Berlin', label: 'Central Europe (CET)', offset: 'UTC+1/+2' },
  { value: 'Europe/Istanbul', label: 'Turkey (TRT)', offset: 'UTC+3' },
  { value: 'America/New_York', label: 'US Eastern (EST/EDT)', offset: 'UTC-5/-4' },
  { value: 'America/Chicago', label: 'US Central (CST/CDT)', offset: 'UTC-6/-5' },
  { value: 'America/Denver', label: 'US Mountain (MST/MDT)', offset: 'UTC-7/-6' },
  { value: 'America/Los_Angeles', label: 'US Pacific (PST/PDT)', offset: 'UTC-8/-7' },
  { value: 'America/Toronto', label: 'Canada Eastern', offset: 'UTC-5/-4' },
  { value: 'Australia/Sydney', label: 'Australia Sydney (AEST)', offset: 'UTC+10/+11' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)', offset: 'UTC+8' },
  { value: 'Asia/Tokyo', label: 'Japan (JST)', offset: 'UTC+9' },
  { value: 'Africa/Cairo', label: 'Egypt (EET)', offset: 'UTC+2' },
  { value: 'Africa/Johannesburg', label: 'South Africa (SAST)', offset: 'UTC+2' },
];

/** "09:00 AM" or "05:00 AM" in the given timezone (or 24h "14:30") */
export function formatTimeInZone(date: Date, timeZone: string, use24h: boolean = true): string {
  if (use24h) {
    return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone });
  }
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone });
}

export function formatTime24InZone(date: Date, timeZone: string): string {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone });
}

export function dayOfWeekInZone(date: Date, timeZone: string): string {
  return date.toLocaleDateString('en-US', { weekday: 'long', timeZone });
}

/** Local calendar date key "YYYY-MM-DD" of an instant in the given timezone */
export function dateKeyInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/**
 * Convert a recurring slot (defined in schoolTimezone, e.g. Monday 09:00 - 09:45 in Asia/Karachi)
 * to the target timezone. Handles date/weekday shifts when crossing midnight.
 */
export function convertRecurringSlotToZoned(
  slot: { weekday: number; startTime: string; endTime: string },
  schoolTimezone: string = DEFAULT_SCHOOL_TIMEZONE,
  targetTimezone: string = DEFAULT_SCHOOL_TIMEZONE
): { dayOfWeek: string; startTime: string; endTime: string } {
  const weekdayNames: Record<number, string> = {
    1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 7: 'Sunday'
  };

  if (!isValidTimeZone(targetTimezone) || targetTimezone === schoolTimezone) {
    const rawStart = String(slot.startTime).substring(0, 5);
    const rawEnd = String(slot.endTime).substring(0, 5);
    return {
      dayOfWeek: weekdayNames[slot.weekday] || 'Monday',
      startTime: rawStart,
      endTime: rawEnd
    };
  }

  // Reference week starting Monday 2026-10-19
  const refDay = 18 + Number(slot.weekday); // 1=19 (Mon) ... 7=25 (Sun)
  const dateStr = `2026-10-${String(refDay).padStart(2, '0')}`;
  const startPart = slot.startTime.length === 5 ? `${slot.startTime}:00` : slot.startTime;
  const endPart = slot.endTime.length === 5 ? `${slot.endTime}:00` : slot.endTime;

  // Find UTC instants for this occurrence in schoolTimezone
  function wallToDate(dStr: string, tStr: string): Date {
    const [y, m, d] = dStr.split('-').map(Number);
    const [h, mi, s = 0] = tStr.split(':').map(Number);
    const guessUtc = Date.UTC(y, m - 1, d, h, mi, s);

    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: schoolTimezone,
      hourCycle: 'h23',
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', second: 'numeric'
    });

    const getOffset = (inst: number) => {
      const parts = dtf.formatToParts(new Date(inst));
      const p: Record<string, number> = {};
      for (const part of parts) {
        if (part.type !== 'literal') p[part.type] = Number(part.value);
      }
      const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second);
      return asUtc - inst;
    };

    const offset1 = getOffset(guessUtc);
    let inst = guessUtc - offset1;
    const offset2 = getOffset(inst);
    if (offset2 !== offset1) inst = guessUtc - offset2;
    return new Date(inst);
  }

  const startInstant = wallToDate(dateStr, startPart);
  const endInstant = wallToDate(dateStr, endPart);

  const localizedWeekday = startInstant.toLocaleDateString('en-US', { weekday: 'long', timeZone: targetTimezone });
  const localizedStart = formatTimeInZone(startInstant, targetTimezone);
  const localizedEnd = formatTimeInZone(endInstant, targetTimezone);

  return {
    dayOfWeek: localizedWeekday,
    startTime: localizedStart,
    endTime: localizedEnd
  };
}

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

