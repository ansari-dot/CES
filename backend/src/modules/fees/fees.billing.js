/**
 * Monthly billing calendar policy (pure functions, no DB access).
 *
 * All dates are evaluated in the institution's billing timezone
 * (config.SCHOOL_TIMEZONE), never in a student's detected timezone.
 *
 *   - Invoice issued on the 1st of the billing month
 *   - Payment deadline: the 5th
 *   - Grace period: 6th – 10th (inclusive)
 *   - Restriction: from 00:00 on the 11th
 */

export const DUE_DAY = 5;
export const GRACE_END_DAY = 10;
export const GRACE_PERIOD_DAYS = GRACE_END_DAY - DUE_DAY;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const pad = (n) => String(n).padStart(2, '0');

/** Calendar date parts ({ year, month, day }) of an instant in the given IANA timezone. */
export function getZonedDateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

/** 'YYYY-MM-DD' of an instant in the given IANA timezone. */
export function toZonedDateString(date, timeZone) {
  const { year, month, day } = getZonedDateParts(date, timeZone);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Normalise the free-text billing month used by fee_challans to a 'YYYY-MM' key.
 * Accepts '2026-11', '2026/11', 'November 2026', 'Nov 2026', 'nov-2026'.
 * Returns null when the value cannot be interpreted.
 */
export function normalizeBillingMonth(value) {
  if (!value) return null;
  const str = String(value).trim();

  const iso = str.match(/^(\d{4})[-/](\d{1,2})$/);
  if (iso) {
    const month = Number(iso[2]);
    return month >= 1 && month <= 12 ? `${iso[1]}-${pad(month)}` : null;
  }

  const named = str.match(/^([A-Za-z]+)[\s,-]+(\d{4})$/);
  if (named) {
    const prefix = named[1].toLowerCase();
    const idx = MONTH_NAMES.findIndex((m) => prefix.length >= 3 && m.toLowerCase().startsWith(prefix));
    return idx >= 0 ? `${named[2]}-${pad(idx + 1)}` : null;
  }

  return null;
}

/** True when two billing-month strings refer to the same period. */
export function isSameBillingMonth(a, b) {
  const na = normalizeBillingMonth(a);
  const nb = normalizeBillingMonth(b);
  if (na && nb) return na === nb;
  return String(a).trim() === String(b).trim();
}

/** Billing period descriptor for a given year/month. */
export function getBillingPeriod(year, month) {
  const ym = `${year}-${pad(month)}`;
  return {
    key: ym,
    label: `${MONTH_NAMES[month - 1]} ${year}`, // matches the Principal portal's format
    issueDate: `${ym}-01`,
    dueDate: `${ym}-${pad(DUE_DAY)}`,
    validUntil: `${ym}-${pad(GRACE_END_DAY)}`,
    gracePeriodDays: GRACE_PERIOD_DAYS
  };
}

/** Billing period that is current at `now` in the billing timezone. */
export function getCurrentBillingPeriod(now, timeZone) {
  const { year, month } = getZonedDateParts(now, timeZone);
  return getBillingPeriod(year, month);
}

/** Add whole days to a 'YYYY-MM-DD' string (calendar arithmetic, timezone-free). */
export function addDays(dateStr, days) {
  const d = new Date(`${String(dateStr).slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Number(days));
  return d.toISOString().slice(0, 10);
}

/**
 * True when an invoice whose grace period ends on `validUntil` ('YYYY-MM-DD')
 * is past grace at `now`, i.e. it is 00:00 or later on the following day in the
 * billing timezone.
 */
export function isPastGrace(validUntil, now, timeZone) {
  if (!validUntil) return false;
  return toZonedDateString(now, timeZone) > String(validUntil).slice(0, 10);
}
