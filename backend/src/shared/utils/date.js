/**
 * Date utility to normalize MySQL DATETIME strings and Date objects to UTC Dates
 */
export function parseDbDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  const str = String(val).trim();
  if (str.endsWith('Z')) return new Date(str);
  // If formatted like '2026-10-19 16:05:00', append Z as it is stored in UTC
  const isoStr = str.replace(' ', 'T');
  return new Date(isoStr.endsWith('Z') ? isoStr : `${isoStr}Z`);
}
