import {
  eventSuspendsClasses,
  eventAppliesToAllClasses,
  toDateKey
} from '../../modules/calendar/calendar.repository.js';

/**
 * Fixed-salary teacher attendance for a period, from verified daily check-in/check-out
 * records (teacher_checkin_checkout).
 *
 * Rules:
 *  - The monthly salary itself is NOT derived from minutes worked.
 *  - Approved leave (ON_LEAVE) is never deducted.
 *  - An ABSENT record on a school-wide full-day holiday or on a configured weekly off day is
 *    ignored (no deduction), and each date can only count once (unique per teacher/date).
 *  - Deductions are applied ONLY when the salary profile defines a rule in `rules`:
 *      absenceDeductionPerDay        fixed Rs. per absent day
 *      absenceDeductionMode: 'PRORATA'  base salary / expected duty days (or working days) per absent day
 *      lateDeductionPerInstance      fixed Rs. per late arrival beyond `lateGraceCount` free instances
 *      earlyDepartureDeductionPerInstance  fixed Rs. per early departure
 *    No rule configured => no deduction.
 */

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function isoWeekday(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

function eachDate(startDate, endDate) {
  const out = [];
  const [y, m, d] = startDate.split('-').map(Number);
  let t = Date.UTC(y, m - 1, d);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const end = Date.UTC(ey, em - 1, ed);
  while (t <= end) {
    out.push(new Date(t).toISOString().slice(0, 10));
    t += 86400000;
  }
  return out;
}

/** School-wide, full-day holidays (dates) in the period. */
export async function getSchoolHolidayDates(conn, startDate, endDate) {
  const rows = await conn('academic_holidays')
    .where('start_date', '<=', endDate)
    .andWhere('end_date', '>=', startDate);
  const dates = new Set();
  for (const r of rows) {
    const fullDay = r.is_full_day_holiday === undefined || r.is_full_day_holiday === null || Boolean(Number(r.is_full_day_holiday));
    if (!eventSuspendsClasses(r) || !eventAppliesToAllClasses(r) || !fullDay) continue;
    for (const day of eachDate(toDateKey(r.start_date) < startDate ? startDate : toDateKey(r.start_date), toDateKey(r.end_date) > endDate ? endDate : toDateKey(r.end_date))) {
      dates.add(day);
    }
  }
  return dates;
}

export async function computeTeacherAttendance(conn, { teacherId, startDate, endDate, profile = null }) {
  const records = await conn('teacher_checkin_checkout')
    .where('teacher_id', teacherId)
    .whereBetween('duty_date', [startDate, endDate])
    .orderBy('duty_date', 'asc');

  const holidayDates = await getSchoolHolidayDates(conn, startDate, endDate);
  const workingDays = parseJson(profile?.working_days, null);
  const workingSet = Array.isArray(workingDays) && workingDays.length > 0 ? new Set(workingDays.map(Number)) : null;

  const allDates = eachDate(startDate, endDate);
  const scheduledWorkingDays = allDates.filter(
    (d) => !holidayDates.has(d) && (!workingSet || workingSet.has(isoWeekday(d)))
  ).length;

  let presentDays = 0;
  let lateDays = 0;
  let earlyDays = 0;
  let leaveDays = 0;
  let halfDays = 0;
  let absentDays = 0;
  let ignoredAbsences = 0;
  let dutyMinutes = 0;

  const daily = records.map((r) => {
    const date = toDateKey(r.duty_date);
    const isHoliday = holidayDates.has(date);
    const isOffDay = workingSet ? !workingSet.has(isoWeekday(date)) : false;
    const status = r.attendance_status;
    const minutes = Number(r.total_duty_minutes || 0);
    dutyMinutes += minutes;

    if (status === 'PRESENT' || status === 'LATE') presentDays++;
    if (status === 'LATE' || Number(r.is_late)) lateDays++;
    if (Number(r.is_early_departure)) earlyDays++;
    if (status === 'ON_LEAVE') leaveDays++;
    if (status === 'HALF_DAY') halfDays++;
    if (status === 'ABSENT') {
      if (isHoliday || isOffDay) ignoredAbsences++;
      else absentDays++;
    }

    return {
      dutyDate: date,
      checkInTime: r.check_in_time,
      checkOutTime: r.check_out_time,
      totalDutyMinutes: minutes,
      attendanceStatus: status,
      isLate: Boolean(Number(r.is_late)) || status === 'LATE',
      isEarlyDeparture: Boolean(Number(r.is_early_departure)),
      leaveType: r.leave_type || null,
      notes: r.notes || null,
      isHoliday,
      isOffDay
    };
  });

  // Deductions: only from configured rules
  const rules = parseJson(profile?.rules, {}) || {};
  const base = Number(profile?.base_amount || 0);
  const parts = [];
  let deduction = 0;

  const perDay = Number(rules.absenceDeductionPerDay || 0);
  if (absentDays > 0 && perDay > 0) {
    deduction += absentDays * perDay;
    parts.push(`${absentDays} absent day(s) × Rs. ${perDay.toLocaleString()}`);
  } else if (absentDays > 0 && String(rules.absenceDeductionMode || '').toUpperCase() === 'PRORATA' && base > 0) {
    const divisor = Number(profile?.expected_duty_days) || scheduledWorkingDays;
    if (divisor > 0) {
      const dayRate = round2(base / divisor);
      deduction += absentDays * dayRate;
      parts.push(`${absentDays} absent day(s) × Rs. ${dayRate.toLocaleString()} (pro-rata of ${divisor} days)`);
    }
  }

  const latePer = Number(rules.lateDeductionPerInstance || 0);
  const lateFree = Number(rules.lateGraceCount || 0);
  const chargeableLate = Math.max(0, lateDays - lateFree);
  if (chargeableLate > 0 && latePer > 0) {
    deduction += chargeableLate * latePer;
    parts.push(`${chargeableLate} late arrival(s) × Rs. ${latePer.toLocaleString()}`);
  }

  const earlyPer = Number(rules.earlyDepartureDeductionPerInstance || 0);
  if (earlyDays > 0 && earlyPer > 0) {
    deduction += earlyDays * earlyPer;
    parts.push(`${earlyDays} early departure(s) × Rs. ${earlyPer.toLocaleString()}`);
  }

  deduction = round2(Math.min(deduction, base || deduction));

  return {
    scheduledWorkingDays,
    recordedDays: records.length,
    presentDays,
    absentDays,
    ignoredAbsences,
    lateDays,
    earlyDays,
    leaveDays,
    halfDays,
    dutyMinutes,
    dutyHours: round2(dutyMinutes / 60),
    holidayDates: Array.from(holidayDates).sort(),
    deduction,
    deductionFormula: parts.length ? parts.join(' + ') : null,
    deductionRuleConfigured: Boolean(perDay || rules.absenceDeductionMode || latePer || earlyPer),
    daily
  };
}

/** Salary profile in force during a period (effective_from <= end and effective_to >= start). */
export async function getProfileForPeriod(conn, teacherId, startDate, endDate) {
  return await conn('teacher_salary_profiles')
    .where('teacher_id', teacherId)
    .where('effective_from', '<=', endDate)
    .where((q) => q.whereNull('effective_to').orWhere('effective_to', '>=', startDate))
    .orderBy('effective_from', 'desc')
    .orderBy('id', 'desc')
    .first();
}
