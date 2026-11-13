import { db } from '../../shared/db/knex.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { config } from '../../config/index.js';
import { auditRepository } from '../audit/audit.repository.js';
import { isStaff, getTeacherByUserId, forbidden } from '../../shared/services/accessScope.js';
import { getTeacherDutyForPeriod } from '../../shared/utils/teacherDutyQuery.js';
import { computeTeacherAttendance, getProfileForPeriod } from '../../shared/utils/teacherAttendance.js';
import { parseDbDate } from '../../shared/utils/date.js';

const SALARY_MODELS = ['FIXED', 'PER_HOUR', 'PER_LESSON', 'HYBRID'];
const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const PAYROLL_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const schoolTz = () => config.SCHOOL_TIMEZONE || 'Asia/Karachi';

function validation(message) {
  return new AppError(message, 422, ErrorCodes.VALIDATION_ERROR);
}

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function monthRange(month) {
  if (!MONTH_RE.test(month)) throw validation('month must be YYYY-MM');
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { startDate: `${month}-01`, endDate: `${month}-${String(last).padStart(2, '0')}`, year: y, month: m };
}

function schoolDateOf(instant) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: schoolTz(), year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}

function schoolTimeOf(instant) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: schoolTz(), hourCycle: 'h23', hour: '2-digit', minute: '2-digit' }).format(instant);
}

function currentMonthKey() {
  return schoolDateOf(new Date()).slice(0, 7);
}

/** Who may see which teacher: staff any; a teacher only themself; others nothing. */
async function resolveTeacherScope(user, requestedTeacherId) {
  if (isStaff(user)) return requestedTeacherId ? Number(requestedTeacherId) : null;
  if (user?.role === 'TEACHER') {
    const teacher = await getTeacherByUserId(user.id);
    if (!teacher) throw forbidden('Teacher profile not found');
    return Number(teacher.id);
  }
  throw forbidden('Teacher duty records are only available to staff and the teacher concerned.');
}

function mapProfile(r) {
  if (!r) return null;
  return {
    id: r.id,
    teacherId: r.teacher_id,
    teacherName: r.teacherName,
    employeeNo: r.employeeNo,
    model: r.model,
    salaryType: r.model === 'PER_HOUR' ? 'HOURLY' : r.model === 'FIXED' ? 'FIXED' : r.model,
    baseAmount: Number(r.base_amount || 0),
    perLessonRate: Number(r.per_lesson_rate || 0),
    perHourRate: Number(r.per_hour_rate || 0),
    expectedDutyDays: r.expected_duty_days ?? null,
    expectedDutyHours: r.expected_duty_hours !== undefined && r.expected_duty_hours !== null ? Number(r.expected_duty_hours) : null,
    workingDays: parseJson(r.working_days, null),
    dutyStartTime: r.duty_start_time ? String(r.duty_start_time).slice(0, 5) : null,
    dutyEndTime: r.duty_end_time ? String(r.duty_end_time).slice(0, 5) : null,
    lateGraceMinutes: Number(r.late_grace_minutes || 0),
    academicSessionId: r.academic_session_id ?? null,
    effectiveFrom: r.effective_from ? String(r.effective_from).slice(0, 10) : null,
    effectiveTo: r.effective_to ? String(r.effective_to).slice(0, 10) : null,
    rules: parseJson(r.rules, null),
    configuredByName: r.configuredByName || null,
    createdAt: r.created_at
  };
}

function minusOneDay(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) - 86400000).toISOString().slice(0, 10);
}

/** Validates salary configuration input; returns DB columns. No hardcoded salary values. */
async function buildProfileColumns(input, existing = null) {
  const pick = (k, col) => (input[k] !== undefined ? input[k] : existing ? existing[col] : undefined);

  let model = String(pick('model', 'model') || input.salaryType || '').toUpperCase();
  if (model === 'HOURLY') model = 'PER_HOUR';
  if (!SALARY_MODELS.includes(model)) throw validation(`Salary type must be one of: FIXED, HOURLY (PER_HOUR), PER_LESSON, HYBRID`);

  const num = (v) => (v === undefined || v === null || v === '' ? 0 : Number(v));
  const baseAmount = num(pick('baseAmount', 'base_amount'));
  const perHourRate = num(pick('perHourRate', 'per_hour_rate'));
  const perLessonRate = num(pick('perLessonRate', 'per_lesson_rate'));
  if ([baseAmount, perHourRate, perLessonRate].some((n) => !Number.isFinite(n) || n < 0)) {
    throw validation('Salary amounts must be zero or positive numbers');
  }
  if (model === 'FIXED' && baseAmount <= 0) throw validation('A fixed monthly salary amount is required');
  if (model === 'PER_HOUR' && perHourRate <= 0) throw validation('An hourly rate is required for hourly-based teachers');
  if (model === 'PER_LESSON' && perLessonRate <= 0) throw validation('A per-lesson rate is required');
  if (model === 'HYBRID' && (baseAmount <= 0 || perLessonRate <= 0)) throw validation('Hybrid salary needs both a base amount and a per-lesson rate');

  const effectiveFrom = pick('effectiveFrom', 'effective_from');
  const effectiveTo = input.effectiveTo !== undefined ? input.effectiveTo || null : existing?.effective_to || null;
  const fromKey = effectiveFrom ? String(effectiveFrom).slice(0, 10) : null;
  const toKey = effectiveTo ? String(effectiveTo).slice(0, 10) : null;
  if (!fromKey || !DATE_RE.test(fromKey)) throw validation('effectiveFrom (YYYY-MM-DD) is required');
  if (toKey && (!DATE_RE.test(toKey) || toKey < fromKey)) throw validation('effectiveTo must be a date on or after effectiveFrom');

  let workingDays = input.workingDays !== undefined ? input.workingDays : parseJson(existing?.working_days, null);
  if (workingDays !== null && workingDays !== undefined) {
    if (!Array.isArray(workingDays) || workingDays.some((d) => !Number.isInteger(Number(d)) || Number(d) < 1 || Number(d) > 7)) {
      throw validation('workingDays must be a list of ISO weekdays (1 = Monday … 7 = Sunday)');
    }
    workingDays = Array.from(new Set(workingDays.map(Number))).sort();
  }

  const dutyStart = input.dutyStartTime !== undefined ? input.dutyStartTime || null : existing?.duty_start_time || null;
  const dutyEnd = input.dutyEndTime !== undefined ? input.dutyEndTime || null : existing?.duty_end_time || null;
  if ((dutyStart && !TIME_RE.test(String(dutyStart))) || (dutyEnd && !TIME_RE.test(String(dutyEnd)))) {
    throw validation('Duty start/end time must be HH:MM');
  }
  if (dutyStart && dutyEnd && String(dutyStart).slice(0, 5) >= String(dutyEnd).slice(0, 5)) {
    throw validation('Duty end time must be after duty start time');
  }

  const rules = input.rules !== undefined ? input.rules : parseJson(existing?.rules, null);
  if (rules !== null && rules !== undefined && (typeof rules !== 'object' || Array.isArray(rules))) {
    throw validation('rules must be an object');
  }

  const columns = {
    model,
    base_amount: baseAmount,
    per_hour_rate: perHourRate,
    per_lesson_rate: perLessonRate,
    effective_from: fromKey,
    effective_to: toKey,
    rules: rules ? JSON.stringify(rules) : null,
    expected_duty_days: input.expectedDutyDays !== undefined ? (input.expectedDutyDays ? Number(input.expectedDutyDays) : null) : existing?.expected_duty_days ?? null,
    expected_duty_hours: input.expectedDutyHours !== undefined ? (input.expectedDutyHours ? Number(input.expectedDutyHours) : null) : existing?.expected_duty_hours ?? null,
    working_days: workingDays ? JSON.stringify(workingDays) : null,
    duty_start_time: dutyStart ? String(dutyStart).slice(0, 5) : null,
    duty_end_time: dutyEnd ? String(dutyEnd).slice(0, 5) : null,
    late_grace_minutes: input.lateGraceMinutes !== undefined ? Math.max(0, Number(input.lateGraceMinutes) || 0) : Number(existing?.late_grace_minutes || 0),
    academic_session_id: input.academicSessionId !== undefined ? (input.academicSessionId ? Number(input.academicSessionId) : null) : existing?.academic_session_id ?? null
  };

  // Only write columns that exist (migration 35 may not have run yet on an old database)
  const available = await db('teacher_salary_profiles').columnInfo();
  return Object.fromEntries(Object.entries(columns).filter(([k]) => available[k] !== undefined));
}

/** Late / early flags and minutes from check-in/out against the configured duty window. */
function evaluateDay({ dutyDate, checkIn, checkOut, profile }) {
  const result = { totalDutyMinutes: 0, isLate: false, isEarlyDeparture: false };
  const inAt = checkIn ? parseDbDate(checkIn) : null;
  const outAt = checkOut ? parseDbDate(checkOut) : null;
  if (inAt && outAt && outAt > inAt) result.totalDutyMinutes = Math.round((outAt - inAt) / 60000);
  const start = profile?.duty_start_time ? String(profile.duty_start_time).slice(0, 5) : null;
  const end = profile?.duty_end_time ? String(profile.duty_end_time).slice(0, 5) : null;
  const grace = Number(profile?.late_grace_minutes || 0);
  if (inAt && start && schoolDateOf(inAt) === dutyDate) {
    const [h, m] = start.split(':').map(Number);
    const allowed = h * 60 + m + grace;
    const [ih, im] = schoolTimeOf(inAt).split(':').map(Number);
    result.isLate = ih * 60 + im > allowed;
  }
  if (outAt && end && schoolDateOf(outAt) === dutyDate) {
    result.isEarlyDeparture = schoolTimeOf(outAt) < end;
  }
  return result;
}

export const dutyService = {
  // ─── Salary profiles ─────────────────────────────────────────────────────

  async listProfiles(user, teacherId) {
    const scopedId = await resolveTeacherScope(user, teacherId);
    let query = db('teacher_salary_profiles as tsp')
      .join('teachers as t', 'tsp.teacher_id', 't.id')
      .join('users as u', 't.user_id', 'u.id')
      .select('tsp.*', 'u.full_name as teacherName', 't.employee_no as employeeNo')
      .orderBy('tsp.effective_from', 'desc')
      .orderBy('tsp.id', 'desc');
    if (await db.schema.hasColumn('teacher_salary_profiles', 'configured_by')) {
      query = query.leftJoin('users as cfg', 'tsp.configured_by', 'cfg.id').select('cfg.full_name as configuredByName');
    }
    if (scopedId) query = query.where('tsp.teacher_id', scopedId);
    return (await query).map(mapProfile);
  },

  /** New salary configuration. The previous open profile is closed the day before (history kept). */
  async createProfile(input, actorId) {
    const teacherId = Number(input.teacherId);
    if (!teacherId) throw validation('teacherId is required');
    const teacher = await db('teachers').where({ id: teacherId }).first();
    if (!teacher) throw new AppError('Teacher not found', 404, ErrorCodes.NOT_FOUND);

    const columns = await buildProfileColumns(input);
    const available = await db('teacher_salary_profiles').columnInfo();

    const id = await db.transaction(async (trx) => {
      const clash = await trx('teacher_salary_profiles')
        .where({ teacher_id: teacherId, effective_from: columns.effective_from })
        .first();
      if (clash) throw new AppError('A salary profile already starts on this date. Edit it instead.', 409, ErrorCodes.CONFLICT);

      const open = await trx('teacher_salary_profiles')
        .where({ teacher_id: teacherId })
        .where('effective_from', '<', columns.effective_from)
        .where((q) => q.whereNull('effective_to').orWhere('effective_to', '>=', columns.effective_from))
        .forUpdate();
      for (const p of open) {
        await trx('teacher_salary_profiles').where({ id: p.id }).update({ effective_to: minusOneDay(columns.effective_from) });
      }

      const row = { ...columns, teacher_id: teacherId };
      if (available.configured_by !== undefined) row.configured_by = actorId || null;
      if (available.approved_by !== undefined) row.approved_by = actorId || null;
      const [newId] = await trx('teacher_salary_profiles').insert(row);

      await auditRepository.logAction(trx, {
        actorId,
        action: 'SALARY_PROFILE_CONFIGURED',
        recordType: 'teacher_salary_profiles',
        recordIdentifier: `Profile #${newId} (teacher #${teacherId})`,
        reason: open.length ? `Previous profile(s) #${open.map((p) => p.id).join(', #')} closed on ${minusOneDay(columns.effective_from)}` : null,
        newValue: row
      });
      return newId;
    });

    return (await this.listProfiles({ role: 'ADMIN' }, teacherId)).find((p) => p.id === id);
  },

  async updateProfile(id, input, actorId) {
    const existing = await db('teacher_salary_profiles').where({ id: Number(id) }).first();
    if (!existing) throw new AppError('Salary profile not found', 404, ErrorCodes.NOT_FOUND);

    // A profile already used by an approved/paid payroll month must not be rewritten silently
    const locked = await db('teacher_payroll_drafts')
      .where({ teacher_id: existing.teacher_id })
      .whereIn('status', ['APPROVED', 'PAID'])
      .select('payroll_month');
    const columns = await buildProfileColumns(input, existing);
    const rateChanged = ['model', 'base_amount', 'per_hour_rate', 'per_lesson_rate'].some(
      (k) => columns[k] !== undefined && String(Number(columns[k]) || columns[k]) !== String(Number(existing[k]) || existing[k])
    );
    if (rateChanged && locked.length > 0 && !input.changeReason) {
      throw new AppError(
        'This teacher has approved/paid payroll. Changing rates does not alter those records; provide changeReason to confirm, or create a new profile with a later effective date.',
        409,
        ErrorCodes.CONFLICT
      );
    }

    await db.transaction(async (trx) => {
      await trx('teacher_salary_profiles').where({ id: existing.id }).update(columns);
      await auditRepository.logAction(trx, {
        actorId,
        action: 'SALARY_PROFILE_UPDATED',
        recordType: 'teacher_salary_profiles',
        recordIdentifier: `Profile #${existing.id} (teacher #${existing.teacher_id})`,
        reason: input.changeReason || null,
        previousValue: existing,
        newValue: columns
      });
    });
    return (await this.listProfiles({ role: 'ADMIN' }, existing.teacher_id)).find((p) => p.id === existing.id);
  },

  // ─── Daily check-in / check-out ──────────────────────────────────────────

  async listCheckins(user, { teacherId, month, startDate, endDate }) {
    const scopedId = await resolveTeacherScope(user, teacherId);
    let query = db('teacher_checkin_checkout as tcc')
      .join('teachers as t', 'tcc.teacher_id', 't.id')
      .join('users as u', 't.user_id', 'u.id')
      .leftJoin('users as rec', 'tcc.recorded_by', 'rec.id')
      .select('tcc.*', 'u.full_name as teacherName', 't.employee_no as employeeNo', 'rec.full_name as recordedByName')
      .orderBy('tcc.duty_date', 'desc');
    if (scopedId) query = query.where('tcc.teacher_id', scopedId);
    if (month) {
      const r = monthRange(month);
      query = query.whereBetween('tcc.duty_date', [r.startDate, r.endDate]);
    } else if (startDate && endDate) {
      query = query.whereBetween('tcc.duty_date', [startDate, endDate]);
    }
    return (await query).map((r) => ({
      id: r.id,
      teacherId: r.teacher_id,
      teacherName: r.teacherName,
      employeeNo: r.employeeNo,
      dutyDate: String(r.duty_date).slice(0, 10),
      checkInTime: r.check_in_time ? parseDbDate(r.check_in_time).toISOString() : null,
      checkOutTime: r.check_out_time ? parseDbDate(r.check_out_time).toISOString() : null,
      totalDutyMinutes: Number(r.total_duty_minutes || 0),
      totalDutyHours: Math.round((Number(r.total_duty_minutes || 0) / 60) * 100) / 100,
      isLate: Boolean(Number(r.is_late)),
      isEarlyDeparture: Boolean(Number(r.is_early_departure)),
      attendanceStatus: r.attendance_status,
      leaveType: r.leave_type,
      notes: r.notes,
      recordedByName: r.recordedByName,
      updatedAt: r.updated_at
    }));
  },

  /**
   * Teacher self-service check-in / check-out. Times are always the server's clock
   * (never client-supplied), so the record is verifiable.
   */
  async selfCheck(user, action) {
    if (user?.role !== 'TEACHER') throw forbidden('Only teachers can check in for themselves');
    const teacher = await getTeacherByUserId(user.id);
    if (!teacher) throw forbidden('Teacher profile not found');
    const act = String(action || '').toUpperCase();
    if (!['CHECK_IN', 'CHECK_OUT'].includes(act)) throw validation('action must be CHECK_IN or CHECK_OUT');

    const now = new Date();
    const dutyDate = schoolDateOf(now);
    const profile = await getProfileForPeriod(db, teacher.id, dutyDate, dutyDate);

    return await db.transaction(async (trx) => {
      const existing = await trx('teacher_checkin_checkout').where({ teacher_id: teacher.id, duty_date: dutyDate }).forUpdate().first();

      if (act === 'CHECK_IN') {
        if (existing?.check_in_time) throw new AppError('You have already checked in today', 409, ErrorCodes.CONFLICT);
        const evald = evaluateDay({ dutyDate, checkIn: now, checkOut: null, profile });
        const row = {
          check_in_time: now,
          is_late: evald.isLate ? 1 : 0,
          attendance_status: evald.isLate ? 'LATE' : 'PRESENT',
          recorded_by: user.id
        };
        if (existing) await trx('teacher_checkin_checkout').where({ id: existing.id }).update(row);
        else await trx('teacher_checkin_checkout').insert({ ...row, teacher_id: teacher.id, duty_date: dutyDate, total_duty_minutes: 0 });
      } else {
        if (!existing?.check_in_time) throw new AppError('Check in first before checking out', 409, ErrorCodes.CONFLICT);
        const evald = evaluateDay({ dutyDate, checkIn: existing.check_in_time, checkOut: now, profile });
        // Final check-out wins (multiple check-outs extend the day; first check-in is kept)
        await trx('teacher_checkin_checkout').where({ id: existing.id }).update({
          check_out_time: now,
          total_duty_minutes: evald.totalDutyMinutes,
          is_early_departure: evald.isEarlyDeparture ? 1 : 0,
          recorded_by: user.id
        });
      }
      const fresh = await trx('teacher_checkin_checkout').where({ teacher_id: teacher.id, duty_date: dutyDate }).first();
      return { ...fresh, duty_date: dutyDate };
    });
  },

  /** Authorised manual entry / correction by Principal/Admin, with a mandatory reason (audited). */
  async recordByStaff(input, actorId) {
    const teacherId = Number(input.teacherId);
    const dutyDate = input.dutyDate ? String(input.dutyDate).slice(0, 10) : null;
    if (!teacherId || !dutyDate || !DATE_RE.test(dutyDate)) throw validation('teacherId and dutyDate (YYYY-MM-DD) are required');
    if (!input.reason || !String(input.reason).trim()) throw validation('A reason is required for manual duty entries');
    const status = input.attendanceStatus ? String(input.attendanceStatus).toUpperCase() : null;
    if (status && !ATTENDANCE_STATUSES.includes(status)) throw validation(`attendanceStatus must be one of: ${ATTENDANCE_STATUSES.join(', ')}`);
    const teacher = await db('teachers').where({ id: teacherId }).first();
    if (!teacher) throw new AppError('Teacher not found', 404, ErrorCodes.NOT_FOUND);

    const checkIn = input.checkInTime ? new Date(input.checkInTime) : null;
    const checkOut = input.checkOutTime ? new Date(input.checkOutTime) : null;
    if ((checkIn && Number.isNaN(checkIn.getTime())) || (checkOut && Number.isNaN(checkOut.getTime()))) {
      throw validation('Check-in/out must be valid ISO date-times');
    }
    if (checkIn && checkOut && checkOut <= checkIn) throw validation('Check-out must be after check-in');

    const profile = await getProfileForPeriod(db, teacherId, dutyDate, dutyDate);

    return await db.transaction(async (trx) => {
      const existing = await trx('teacher_checkin_checkout').where({ teacher_id: teacherId, duty_date: dutyDate }).forUpdate().first();
      const finalIn = input.checkInTime !== undefined ? checkIn : existing?.check_in_time || null;
      const finalOut = input.checkOutTime !== undefined ? checkOut : existing?.check_out_time || null;
      const evald = evaluateDay({ dutyDate, checkIn: finalIn, checkOut: finalOut, profile });

      let finalStatus = status || existing?.attendance_status || (finalIn ? (evald.isLate ? 'LATE' : 'PRESENT') : 'ABSENT');
      const row = {
        check_in_time: finalIn,
        check_out_time: finalOut,
        total_duty_minutes: ['ABSENT', 'ON_LEAVE', 'HOLIDAY'].includes(finalStatus) ? 0 : evald.totalDutyMinutes,
        is_late: evald.isLate ? 1 : 0,
        is_early_departure: evald.isEarlyDeparture ? 1 : 0,
        attendance_status: finalStatus,
        leave_type: input.leaveType !== undefined ? input.leaveType || null : existing?.leave_type || null,
        notes: String(input.reason).trim().slice(0, 1000),
        recorded_by: actorId || null
      };

      let id = existing?.id;
      if (existing) await trx('teacher_checkin_checkout').where({ id }).update(row);
      else [id] = await trx('teacher_checkin_checkout').insert({ ...row, teacher_id: teacherId, duty_date: dutyDate });

      await auditRepository.logAction(trx, {
        actorId,
        action: existing ? 'TEACHER_DUTY_CORRECTED' : 'TEACHER_DUTY_RECORDED',
        recordType: 'teacher_checkin_checkout',
        recordIdentifier: `Teacher #${teacherId} on ${dutyDate}`,
        reason: String(input.reason).trim(),
        previousValue: existing || null,
        newValue: row
      });
      return await trx('teacher_checkin_checkout').where({ id }).first();
    });
  },

  // ─── Reports ─────────────────────────────────────────────────────────────

  /** One teacher, one month: daily attendance + verified teaching sessions + payroll status. */
  async teacherMonthlyReport(user, { teacherId, month }) {
    const scopedId = await resolveTeacherScope(user, teacherId);
    if (!scopedId) throw validation('teacherId is required');
    const range = monthRange(month || currentMonthKey());

    const teacher = await db('teachers as t')
      .join('users as u', 't.user_id', 'u.id')
      .where('t.id', scopedId)
      .select('t.id', 't.employee_no', 'u.full_name', 'u.email')
      .first();
    if (!teacher) throw new AppError('Teacher not found', 404, ErrorCodes.NOT_FOUND);

    const profile = await getProfileForPeriod(db, scopedId, range.startDate, range.endDate);
    const hasCheckins = await db.schema.hasTable('teacher_checkin_checkout');
    const attendance = hasCheckins
      ? await computeTeacherAttendance(db, { teacherId: scopedId, startDate: range.startDate, endDate: range.endDate, profile })
      : null;

    // Verified teaching time: the same calculation payroll uses (merged reconnect segments,
    // clipped to the lesson window, cancelled lessons excluded).
    const dutyResult = await getTeacherDutyForPeriod(db, { teacherId: scopedId, startDate: range.startDate, endDate: range.endDate });
    const duty = dutyResult?.duty || null;
    const sessions = (duty?.detailedLessons || [])
      .filter((l) => l.status !== 'CANCELLED')
      .map((l) => ({
        lessonId: l.id,
        date: l.lessonDate,
        className: l.className,
        subjectName: l.subjectName,
        scheduledStart: l.scheduledStart,
        scheduledEnd: l.scheduledEnd,
        scheduledMinutes: l.scheduledMinutes,
        actualStart: l.actualJoinTime,
        actualEnd: l.actualLeaveTime,
        verifiedMinutes: l.trackedMinutes,
        payable: Boolean(l.isPayable),
        payableMinutes: l.isPayable ? l.trackedMinutes : 0,
        verificationStatus: l.verificationStatus,
        status: l.status
      }));
    const payableMinutes = sessions.reduce((a, s) => a + Number(s.payableMinutes || 0), 0);
    const hourlyRate = Number(profile?.per_hour_rate || 0);

    const draft = await db('teacher_payroll_drafts')
      .where({ teacher_id: scopedId })
      .whereIn('payroll_month', [`${range.year}-${String(range.month).padStart(2, '0')}`, `${PAYROLL_MONTH_NAMES[range.month - 1]} ${range.year}`])
      .first();

    return {
      teacher: { id: teacher.id, name: teacher.full_name, employeeNo: teacher.employee_no, email: teacher.email },
      month: `${range.year}-${String(range.month).padStart(2, '0')}`,
      salaryProfile: mapProfile(profile),
      attendance: attendance
        ? {
            scheduledWorkingDays: attendance.scheduledWorkingDays,
            recordedDays: attendance.recordedDays,
            presentDays: attendance.presentDays,
            absentDays: attendance.absentDays,
            absencesOnHolidaysIgnored: attendance.ignoredAbsences,
            lateDays: attendance.lateDays,
            earlyDepartures: attendance.earlyDays,
            leaveDays: attendance.leaveDays,
            halfDays: attendance.halfDays,
            totalDutyMinutes: attendance.dutyMinutes,
            totalDutyHours: attendance.dutyHours,
            projectedDeduction: attendance.deduction,
            deductionFormula: attendance.deductionFormula,
            deductionRuleConfigured: attendance.deductionRuleConfigured,
            holidayDates: attendance.holidayDates
          }
        : null,
      dailyRecords: attendance?.daily || [],
      teachingDuty: {
        sessionCount: sessions.length,
        verifiedTeachingMinutes: sessions.reduce((a, s) => a + Number(s.verifiedMinutes || 0), 0),
        payableMinutes,
        payableHours: Math.round((payableMinutes / 60) * 100) / 100,
        pendingReviewLessons: duty?.pendingReviewLessons || 0,
        hourlyRate,
        projectedHourlyAmount: profile?.model === 'PER_HOUR' ? Math.round((payableMinutes / 60) * hourlyRate * 100) / 100 : null,
        sessions
      },
      payroll: draft
        ? {
            draftId: draft.id,
            status: draft.status,
            grossAmount: Number(draft.gross_amount),
            netPayable: Number(draft.net_payable),
            calculationFormula: draft.calculation_formula
          }
        : null
    };
  },

  /** All teachers for a month (Teacher Duty Monitoring list), with filters. */
  async monthlySummary(user, { month, salaryType, attendanceStatus, teacherId }) {
    if (!isStaff(user)) throw forbidden('Only Principal/Admin can view the duty report for all teachers');
    const range = monthRange(month || currentMonthKey());
    const monthKeyAliases = [`${range.year}-${String(range.month).padStart(2, '0')}`, `${PAYROLL_MONTH_NAMES[range.month - 1]} ${range.year}`];

    let teachersQuery = db('teachers')
      .join('users', 'teachers.user_id', 'users.id')
      .whereNot('users.status', 'DEACTIVATED')
      .select('teachers.id', 'teachers.employee_no', 'users.full_name')
      .orderBy('users.full_name', 'asc');
    if (teacherId) teachersQuery = teachersQuery.where('teachers.id', Number(teacherId));
    const teachers = await teachersQuery;

    const hasCheckins = await db.schema.hasTable('teacher_checkin_checkout');
    const rows = [];
    for (const t of teachers) {
      const profile = await getProfileForPeriod(db, t.id, range.startDate, range.endDate);
      const type = profile ? (profile.model === 'PER_HOUR' ? 'HOURLY' : profile.model) : 'NOT_CONFIGURED';
      if (salaryType && salaryType !== 'ALL' && type !== String(salaryType).toUpperCase()) continue;

      const attendance = hasCheckins
        ? await computeTeacherAttendance(db, { teacherId: t.id, startDate: range.startDate, endDate: range.endDate, profile })
        : null;
      if (attendanceStatus === 'HAS_ABSENCES' && !(attendance?.absentDays > 0)) continue;
      if (attendanceStatus === 'HAS_LATE' && !(attendance?.lateDays > 0)) continue;
      if (attendanceStatus === 'PERFECT' && (attendance?.absentDays > 0 || attendance?.lateDays > 0)) continue;

      let payableHours = null;
      if (profile && profile.model !== 'FIXED') {
        const dutyResult = await getTeacherDutyForPeriod(db, { teacherId: t.id, startDate: range.startDate, endDate: range.endDate });
        payableHours = dutyResult?.duty?.verifiedTeachingHours ?? 0;
      }

      const draft = await db('teacher_payroll_drafts')
        .where({ teacher_id: t.id })
        .whereIn('payroll_month', monthKeyAliases)
        .first();
      const adjustments = draft
        ? await db('teacher_salary_adjustments').where({ payroll_draft_id: draft.id }).select('type', 'amount')
        : [];
      const adjustmentTotal = adjustments.reduce((a, x) => a + (x.type === 'DEDUCTION' ? -1 : 1) * Number(x.amount || 0), 0);

      let projected = null;
      if (profile?.model === 'FIXED') projected = Number(profile.base_amount) - (attendance?.deduction || 0);
      else if (profile?.model === 'PER_HOUR') projected = Math.round((payableHours || 0) * Number(profile.per_hour_rate) * 100) / 100;

      rows.push({
        teacherId: t.id,
        teacherName: t.full_name,
        employeeNo: t.employee_no,
        salaryType: type,
        presentDays: attendance?.presentDays ?? 0,
        absentDays: attendance?.absentDays ?? 0,
        lateDays: attendance?.lateDays ?? 0,
        earlyDepartures: attendance?.earlyDays ?? 0,
        leaveDays: attendance?.leaveDays ?? 0,
        dutyHours: attendance?.dutyHours ?? 0,
        teachingHours: payableHours,
        projectedAmount: projected,
        adjustments: Math.round(adjustmentTotal * 100) / 100,
        payrollStatus: draft ? draft.status : 'NOT_GENERATED',
        netPayable: draft ? Number(draft.net_payable) : null
      });
    }
    return { month: monthKeyAliases[0], rows };
  }
};
