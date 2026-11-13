/**
 * Student-specific recurring fee concessions.
 *
 * A concession belongs to ONE student and ONE academic session, with an optional
 * validity window (effective_start_date / effective_end_date, NULL = open-ended within the
 * session). It is applied automatically to every challan generated for a billing month
 * that overlaps that window. It never changes the class fee structure, never carries over
 * to another session, and never alters challans that were already generated.
 */

/** Fee heads that a concession can target (challan column per head). */
export const CONCESSION_COMPONENTS = {
  TUITION: 'tuition_amount',
  TECHNOLOGY: 'technology_amount',
  EXAMINATION: 'examination_amount',
  BOOKS: 'books_amount',
  ADMISSION: 'admission_amount',
  OTHER: 'other_amount'
};

export const CONCESSION_TYPES = ['PERCENTAGE', 'FIXED_AMOUNT', 'SIBLING_DISCOUNT', 'MERIT_SCHOLARSHIP', 'NEED_BASED'];

/** Types whose value is a percentage (all others are a fixed monthly amount in Rs.). */
export const PERCENT_CONCESSION_TYPES = ['PERCENTAGE', 'SIBLING_DISCOUNT'];

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function toDateKey(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

/** First/last calendar day of a "YYYY-MM" period key. */
export function periodBounds(periodKey) {
  if (!periodKey || !/^\d{4}-\d{2}$/.test(periodKey)) return null;
  const [y, m] = periodKey.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${periodKey}-01`, end: `${periodKey}-${String(last).padStart(2, '0')}` };
}

/**
 * ACTIVE concessions of a student in a session whose validity overlaps [periodStart, periodEnd].
 */
let validityColumnsAvailable = null;

export async function getApplicableConcessions(conn, { studentId, sessionId, periodStart, periodEnd }) {
  // Before migration 34 the validity columns do not exist: concessions then span the whole session
  if (validityColumnsAvailable !== true) {
    validityColumnsAvailable = await conn.schema.hasColumn('student_concessions', 'effective_start_date');
  }
  let query = conn('student_concessions')
    .where({ student_id: studentId, status: 'ACTIVE' })
    .orderBy('id', 'asc');
  if (sessionId) query = query.where('session_id', sessionId);
  if (validityColumnsAvailable) {
    if (periodEnd) query = query.where((q) => q.whereNull('effective_start_date').orWhere('effective_start_date', '<=', periodEnd));
    if (periodStart) query = query.where((q) => q.whereNull('effective_end_date').orWhere('effective_end_date', '>=', periodStart));
  }
  return await query.select('*');
}

/**
 * Compute the concession for a challan.
 *
 * @param {object[]} concessions  rows from student_concessions
 * @param {Record<string, number>} heads  amount per head key (TUITION, TECHNOLOGY, ...)
 * @returns {{ total: number, details: object[] }}
 *   - A component concession only reduces that head.
 *   - A whole-fee concession reduces the remaining amount across heads.
 *   - Each head (and therefore the total) is floored at zero, so the payable amount
 *     can never become negative and the same rupee is never discounted twice.
 */
export function computeConcession(concessions, heads) {
  const remaining = {};
  const original = {};
  for (const key of Object.keys(CONCESSION_COMPONENTS)) {
    original[key] = round2(heads[key] || 0);
    remaining[key] = original[key];
  }
  const originalGross = Object.values(original).reduce((a, b) => a + b, 0);

  const details = [];
  let total = 0;

  for (const c of concessions) {
    const value = Number(c.value) || 0;
    const isPercent = PERCENT_CONCESSION_TYPES.includes(c.concession_type);
    const component = c.fee_component && CONCESSION_COMPONENTS[c.fee_component] ? c.fee_component : null;

    const baseOriginal = component ? original[component] : originalGross;
    let wanted = isPercent ? (baseOriginal * Math.min(value, 100)) / 100 : value;
    wanted = round2(wanted);

    let applied = 0;
    if (component) {
      applied = Math.min(wanted, remaining[component]);
      remaining[component] = round2(remaining[component] - applied);
    } else {
      let left = wanted;
      for (const key of Object.keys(CONCESSION_COMPONENTS)) {
        if (left <= 0) break;
        const take = Math.min(left, remaining[key]);
        remaining[key] = round2(remaining[key] - take);
        left = round2(left - take);
        applied += take;
      }
    }
    applied = round2(applied);
    total = round2(total + applied);

    details.push({
      concessionId: c.id,
      type: c.concession_type,
      value,
      isPercentage: isPercent,
      feeComponent: component,
      amount: applied,
      effectiveStartDate: toDateKey(c.effective_start_date),
      effectiveEndDate: toDateKey(c.effective_end_date)
    });
  }

  return { total: Math.min(total, round2(originalGross)), details };
}
