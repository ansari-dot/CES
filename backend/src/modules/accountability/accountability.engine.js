/**
 * Teacher Academic Accountability: calculation engine.
 *
 * Everything here is derived from real records (learning_tasks, monthly_tests,
 * task_submissions, test_attempts, terminal_exam_papers, teacher_assignments) and is
 * idempotent: running it again never duplicates requirements or obligations.
 *
 * Dates: school calendar days and deadlines use the configured school timezone;
 * instants are stored in UTC.
 */
import { db } from '../../shared/db/knex.js';
import { config } from '../../config/index.js';
import { parseDbDate } from '../../shared/utils/date.js';
import { wallClockToUtc } from '../timetable/timetable.service.js';
import { getSchoolHolidayDates } from '../../shared/utils/teacherAttendance.js';
import { getCurrentSessionId } from '../../shared/services/accessScope.js';

// ─── Dates (school timezone) ──────────────────────────────────────────────────

export const schoolTz = () => config.SCHOOL_TIMEZONE || 'Asia/Karachi';

export function schoolDate(instant = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: schoolTz(), year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}

export function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function daysBetween(a, b) {
  const [ay, am, ad] = a.split('-').map(Number);
  const [by, bm, bd] = b.split('-').map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const currentPeriod = () => schoolDate().slice(0, 7);

export function monthBounds(period) {
  const [y, m] = period.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${period}-01`, end: `${period}-${String(last).padStart(2, '0')}`, days: last };
}

export function endOfSchoolDay(key) {
  return new Date(wallClockToUtc(key, '23:59:59', schoolTz()));
}

function dateKeysBetween(start, end) {
  const out = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

const maxKey = (a, b) => (a > b ? a : b);
const minKey = (a, b) => (a < b ? a : b);
const keyOf = (v) => (v ? String(v).slice(0, 10) : null);

// ─── Policies ─────────────────────────────────────────────────────────────────

export const SCOPE_LEVEL = { TEACHER: 1, CLASS_SUBJECT: 2, SUBJECT: 3, CLASS: 4, SCHOOL: 5 };

export async function loadPolicies(conn = db) {
  const policies = await conn('teacher_academic_policies').where('is_active', 1);
  const termIds = Array.from(new Set(policies.map((p) => p.term_id).filter(Boolean)));
  const terms = termIds.length ? await conn('academic_terms').whereIn('id', termIds) : [];
  const termMap = new Map(terms.map((t) => [Number(t.id), t]));
  return policies.map((p) => {
    const term = p.term_id ? termMap.get(Number(p.term_id)) : null;
    return { ...p, _termStart: keyOf(term?.start_date), _termEnd: keyOf(term?.end_date) };
  });
}

function policyCoversDate(p, dateKey, sessionId) {
  if (!Number(p.is_active)) return false;
  if (keyOf(p.effective_from) > dateKey) return false;
  if (p.effective_to && keyOf(p.effective_to) < dateKey) return false;
  if (p.session_id && sessionId && Number(p.session_id) !== Number(sessionId)) return false;
  if (p._termStart && (dateKey < p._termStart || (p._termEnd && dateKey > p._termEnd))) return false;
  return true;
}

function policyMatchesScope(p, teacherId, classId, subjectId) {
  const eq = (a, b) => Number(a) === Number(b);
  switch (p.scope_type) {
    case 'TEACHER':
      return eq(p.teacher_id, teacherId) && (!p.class_id || eq(p.class_id, classId)) && (!p.subject_id || eq(p.subject_id, subjectId));
    case 'CLASS_SUBJECT':
      return eq(p.class_id, classId) && eq(p.subject_id, subjectId);
    case 'SUBJECT':
      return eq(p.subject_id, subjectId);
    case 'CLASS':
      return eq(p.class_id, classId);
    case 'SCHOOL':
      return true;
    default:
      return false;
  }
}

/**
 * Most specific active policy for a teacher/class/subject on a date.
 * Precedence: teacher > class+subject > subject > class > school-wide; within a level the
 * most recently effective policy wins.
 */
export function resolvePolicy(policies, { teacherId, classId, subjectId, dateKey, sessionId }) {
  const candidates = policies.filter(
    (p) => policyCoversDate(p, dateKey, sessionId) && policyMatchesScope(p, teacherId, classId, subjectId)
  );
  candidates.sort(
    (a, b) =>
      (SCOPE_LEVEL[a.scope_type] || 9) - (SCOPE_LEVEL[b.scope_type] || 9) ||
      keyOf(b.effective_from).localeCompare(keyOf(a.effective_from)) ||
      Number(b.id) - Number(a.id)
  );
  return candidates[0] || null;
}

// ─── Teacher allocations (who teaches what, and when) ─────────────────────────

/**
 * Teacher / class / subject pairs active at any point in [start, end], with the dates the
 * teacher actually held the class (so replacements and reassignments are fair).
 */
export async function getAllocations(start, end, { teacherId = null } = {}) {
  let q = db('teacher_assignments as ta')
    .join('teachers as t', 'ta.teacher_id', 't.id')
    .join('users as u', 't.user_id', 'u.id')
    .where('ta.effective_from', '<=', end)
    .where((w) => w.whereNull('ta.effective_to').orWhere('ta.effective_to', '>=', start))
    .whereNot('u.status', 'DEACTIVATED')
    .select('ta.teacher_id', 'ta.class_id', 'ta.subject_id', 'ta.effective_from', 'ta.effective_to');
  if (teacherId) q = q.where('ta.teacher_id', teacherId);
  const assigned = await q;

  let sq = db('timetable_slots as ts')
    .join('teachers as t', 'ts.teacher_id', 't.id')
    .join('users as u', 't.user_id', 'u.id')
    .whereNot('ts.status', 'ARCHIVED')
    .whereNot('u.status', 'DEACTIVATED')
    .distinct('ts.teacher_id', 'ts.class_id', 'ts.subject_id');
  if (teacherId) sq = sq.where('ts.teacher_id', teacherId);
  const slotted = await sq;

  const map = new Map();
  for (const a of assigned) {
    const key = `${a.teacher_id}-${a.class_id}-${a.subject_id}`;
    const from = maxKey(start, keyOf(a.effective_from) || start);
    const to = a.effective_to ? minKey(end, keyOf(a.effective_to)) : end;
    const cur = map.get(key);
    if (!cur) map.set(key, { teacherId: Number(a.teacher_id), classId: Number(a.class_id), subjectId: Number(a.subject_id), from, to });
    else {
      cur.from = minKey(cur.from, from);
      cur.to = maxKey(cur.to, to);
    }
  }
  // Timetable-only pairs (no dated assignment row) count for the whole month
  for (const s of slotted) {
    const key = `${s.teacher_id}-${s.class_id}-${s.subject_id}`;
    if (!map.has(key)) {
      map.set(key, { teacherId: Number(s.teacher_id), classId: Number(s.class_id), subjectId: Number(s.subject_id), from: start, to: end });
    }
  }
  return Array.from(map.values());
}

async function leaveDatesByTeacher(start, end, teacherId = null) {
  const map = new Map();
  if (!(await db.schema.hasTable('teacher_checkin_checkout'))) return map;
  let q = db('teacher_checkin_checkout').where('attendance_status', 'ON_LEAVE').whereBetween('duty_date', [start, end]);
  if (teacherId) q = q.where('teacher_id', teacherId);
  for (const r of await q.select('teacher_id', 'duty_date')) {
    const id = Number(r.teacher_id);
    if (!map.has(id)) map.set(id, new Set());
    map.get(id).add(keyOf(r.duty_date));
  }
  return map;
}

/**
 * Fair share of the month: days the teacher actually held the class, minus approved leave
 * and school-wide holidays, relative to the month's working days.
 */
function availability({ start, end, from, to, holidays, leave }) {
  const monthDays = dateKeysBetween(start, end);
  const workingDays = monthDays.filter((d) => !holidays.has(d)).length;
  const held = dateKeysBetween(from, to);
  const leaveDays = held.filter((d) => leave?.has(d) && !holidays.has(d)).length;
  const holidayDays = held.filter((d) => holidays.has(d)).length;
  const available = held.length - leaveDays - holidayDays;
  const fraction = workingDays > 0 ? Math.max(0, Math.min(1, available / workingDays)) : 0;
  return { fraction, leaveDays, holidayDays, heldDays: held.length, workingDays };
}

const prorate = (target, fraction) => (fraction >= 1 ? Number(target) : Math.ceil(Number(target) * fraction));

// ─── Published work (evidence) ────────────────────────────────────────────────

/** Published quizzes / assignments / tests in [start, end], grouped by teacher-class-subject. */
export async function getWorkItems(start, end, { teacherId = null, includeDrafts = false } = {}) {
  const taskStatuses = includeDrafts ? ['ACTIVE', 'ARCHIVED', 'DRAFT'] : ['ACTIVE', 'ARCHIVED'];
  let tq = db('learning_tasks')
    .whereIn('status', taskStatuses)
    .whereRaw('COALESCE(assigned_date, DATE(created_at)) BETWEEN ? AND ?', [start, end])
    .select('id', 'title', 'task_type', 'status', 'assigned_date', 'created_at', 'deadline', 'teacher_id', 'class_id', 'subject_id');
  if (teacherId) tq = tq.where('teacher_id', teacherId);

  const testStatuses = includeDrafts ? ['PUBLISHED', 'CLOSED', 'RESULTS_PUBLISHED', 'DRAFT'] : ['PUBLISHED', 'CLOSED', 'RESULTS_PUBLISHED'];
  let mq = db('monthly_tests')
    .whereIn('exam_type', ['CLASS_QUIZ', 'MONTHLY_TEST'])
    .whereIn('status', testStatuses)
    // generous UTC window, then filtered by school date below
    .where('available_from', '>=', `${addDays(start, -1)} 00:00:00`)
    .where('available_from', '<=', `${addDays(end, 1)} 23:59:59`)
    .select('id', 'title', 'exam_type', 'status', 'available_from', 'teacher_id', 'class_id', 'subject_id');
  if (teacherId) mq = mq.where('teacher_id', teacherId);

  const [tasks, tests] = await Promise.all([tq, mq]);
  const grouped = new Map();
  const bucket = (t, c, s) => {
    const key = `${t}-${c}-${s}`;
    if (!grouped.has(key)) grouped.set(key, { quizzes: [], assignments: [], tests: [] });
    return grouped.get(key);
  };

  for (const t of tasks) {
    const date = keyOf(t.assigned_date) || schoolDate(parseDbDate(t.created_at));
    const item = { source: 'task', id: t.id, title: t.title, date, status: t.status, kind: t.task_type };
    const b = bucket(t.teacher_id, t.class_id, t.subject_id);
    if (t.task_type === 'ASSIGNMENT') b.assignments.push(item);
    else if (t.task_type === 'QUIZ') b.quizzes.push(item);
    else if (t.task_type === 'TEST') b.tests.push(item);
  }
  for (const m of tests) {
    const date = schoolDate(parseDbDate(m.available_from));
    if (date < start || date > end) continue;
    const item = { source: 'assessment', id: m.id, title: m.title, date, status: m.status, kind: m.exam_type };
    const b = bucket(m.teacher_id, m.class_id, m.subject_id);
    if (m.exam_type === 'CLASS_QUIZ') b.quizzes.push(item);
    else b.tests.push(item);
  }
  return grouped;
}

// ─── Monthly requirements ─────────────────────────────────────────────────────

/**
 * Create / refresh the monthly requirement rows for a period (idempotent).
 * Closed months are never rewritten; the policy version applied is stored on each row.
 */
export async function ensureRequirements(period, { teacherId = null } = {}) {
  if (!PERIOD_RE.test(period)) return;
  const nowPeriod = currentPeriod();
  if (period > nowPeriod) return;
  const { start, end } = monthBounds(period);

  const [policies, sessionId, holidays, leaveMap, allocations] = await Promise.all([
    loadPolicies(),
    getCurrentSessionId(),
    getSchoolHolidayDates(db, start, end),
    leaveDatesByTeacher(start, end, teacherId),
    getAllocations(start, end, { teacherId })
  ]);

  for (const a of allocations) {
    const existing = await db('teacher_work_requirements')
      .where({ teacher_id: a.teacherId, class_id: a.classId, subject_id: a.subjectId, period })
      .first();
    if (existing && Number(existing.is_closed)) continue;

    const policy = resolvePolicy(policies, { teacherId: a.teacherId, classId: a.classId, subjectId: a.subjectId, dateKey: a.from, sessionId })
      || resolvePolicy(policies, { teacherId: a.teacherId, classId: a.classId, subjectId: a.subjectId, dateKey: a.to, sessionId });
    if (!policy) continue; // no policy => no requirement => never overdue

    const av = availability({ start, end, from: a.from, to: a.to, holidays, leave: leaveMap.get(a.teacherId) });
    const row = {
      policy_id: policy.id,
      policy_version: policy.version,
      required_quizzes: prorate(policy.required_quizzes, av.fraction),
      required_assignments: prorate(policy.required_assignments, av.fraction),
      required_tests: prorate(policy.required_tests, av.fraction),
      count_drafts: Number(policy.count_drafts) ? 1 : 0,
      assigned_from: a.from,
      due_date: end
    };

    if (existing) {
      const changed = Object.keys(row).some((k) => String(keyOf(existing[k]) ?? existing[k]) !== String(row[k]));
      if (changed) await db('teacher_work_requirements').where({ id: existing.id }).update(row);
    } else {
      await db('teacher_work_requirements')
        .insert({ ...row, teacher_id: a.teacherId, class_id: a.classId, subject_id: a.subjectId, period })
        .onConflict(['teacher_id', 'class_id', 'subject_id', 'period'])
        .ignore();
    }
  }

  if (period < nowPeriod) await closePeriod(period, { teacherId });
}

/** Freeze a finished month: store the final counts so later changes cannot rewrite history. */
export async function closePeriod(period, { teacherId = null } = {}) {
  let q = db('teacher_work_requirements').where({ period, is_closed: 0 });
  if (teacherId) q = q.where('teacher_id', teacherId);
  const open = await q;
  if (open.length === 0) return [];
  const { start, end } = monthBounds(period);
  const work = await getWorkItems(start, end, { teacherId, includeDrafts: true });
  const closed = [];
  for (const r of open) {
    const items = filterDrafts(work.get(`${r.teacher_id}-${r.class_id}-${r.subject_id}`), Number(r.count_drafts));
    const update = {
      is_closed: 1,
      final_quizzes: items.quizzes.length,
      final_assignments: items.assignments.length,
      final_tests: items.tests.length
    };
    await db('teacher_work_requirements').where({ id: r.id, is_closed: 0 }).update(update);
    closed.push({ ...r, ...update });
  }
  return closed;
}

export function filterDrafts(items, countDrafts) {
  const empty = { quizzes: [], assignments: [], tests: [] };
  if (!items) return empty;
  if (countDrafts) return items;
  const published = (list) => list.filter((i) => i.status !== 'DRAFT');
  return { quizzes: published(items.quizzes), assignments: published(items.assignments), tests: published(items.tests) };
}

/** Status of one requirement category (quizzes / assignments / tests). */
export function categoryStatus(required, completed, { closed, excused, period }) {
  const remaining = Math.max(0, required - completed);
  if (required <= 0) return { status: 'NOT_REQUIRED', remaining: 0 };
  if (excused) return { status: 'EXCUSED', remaining };
  if (completed >= required) return { status: 'COMPLETED', remaining: 0 };
  const { start, end, days } = monthBounds(period);
  if (closed) return { status: 'OVERDUE', remaining, missedOn: end };
  const today = schoolDate();
  const daysLeft = daysBetween(today, end);
  const elapsed = Math.max(1, daysBetween(start, today) + 1);
  const expectedByNow = Math.floor((required * elapsed) / days);
  if (daysLeft <= 5) return { status: 'DUE_SOON', remaining, daysLeft };
  if (completed >= expectedByNow) return { status: 'ON_TRACK', remaining, daysLeft };
  return { status: 'PENDING', remaining, daysLeft, expectedByNow };
}

// ─── Grading obligations ──────────────────────────────────────────────────────

/** Deadline = N school days after receipt, skipping school holidays and the teacher's approved leave. */
export function computeDeadline(receivedAt, days, holidays, leave) {
  let d = schoolDate(receivedAt);
  let counted = 0;
  let guard = 0;
  while (counted < Number(days) && guard < 400) {
    d = addDays(d, 1);
    guard++;
    if (holidays.has(d) || leave?.has(d)) continue;
    counted++;
  }
  return endOfSchoolDay(d);
}

const COMPLETED_PAPER_STATUSES = ['MARKS_SUBMITTED', 'VERIFIED', 'LOCKED'];

/**
 * Create / update grading obligations from submissions, quiz attempts with written answers
 * and terminal exam papers (idempotent; unique per source record). No policy or no grading
 * window configured => no obligation (never overdue without a valid deadline).
 */
export async function syncObligations({ teacherId = null } = {}) {
  const today = schoolDate();
  const lookback = addDays(today, -150);
  const [policies, sessionId, holidays, leaveMap] = await Promise.all([
    loadPolicies(),
    getCurrentSessionId(),
    getSchoolHolidayDates(db, lookback, addDays(today, 120)),
    leaveDatesByTeacher(lookback, addDays(today, 120), teacherId)
  ]);
  const lookbackUtc = `${lookback} 00:00:00`;
  const now = new Date();

  const upsert = async (sourceType, sourceId, data, state) => {
    const existing = await db('teacher_grading_obligations').where({ source_type: sourceType, source_id: sourceId }).first();
    if (!existing) {
      await db('teacher_grading_obligations')
        .insert({ ...data, source_type: sourceType, source_id: sourceId, ...state })
        .onConflict(['source_type', 'source_id'])
        .ignore();
      return;
    }
    if (existing.status === 'EXCUSED') return;
    const received = parseDbDate(existing.received_at);
    const update = {};
    // A resubmission after "returned for revision" starts a fresh grading window
    if (data.received_at && received && data.received_at.getTime() > received.getTime() + 1000 && state.status !== 'COMPLETED') {
      Object.assign(update, {
        received_at: data.received_at,
        original_deadline: data.original_deadline,
        extended_deadline: null,
        due_soon_notified_at: null,
        overdue_notified_at: null
      });
    }
    if (existing.status !== state.status) update.status = state.status;
    if (Number(existing.feedback_missing) !== Number(state.feedback_missing || 0)) update.feedback_missing = state.feedback_missing ? 1 : 0;
    if (state.status === 'COMPLETED' && !existing.completed_at) update.completed_at = state.completed_at || now;
    if (state.status !== 'COMPLETED' && existing.completed_at) update.completed_at = null;
    if (Object.keys(update).length) await db('teacher_grading_obligations').where({ id: existing.id }).update(update);
  };

  // 1. Assignment / task submissions
  let sq = db('task_submissions as s')
    .join('learning_tasks as t', 's.task_id', 't.id')
    .whereIn('t.status', ['ACTIVE', 'ARCHIVED'])
    .whereNotNull('s.submitted_at')
    .where('s.submitted_at', '>=', lookbackUtc)
    .select(
      's.id', 's.status', 's.submitted_at', 's.graded_at', 's.marks_awarded', 's.feedback', 's.student_id',
      't.id as taskId', 't.title', 't.task_type', 't.teacher_id', 't.class_id', 't.subject_id'
    );
  if (teacherId) sq = sq.where('t.teacher_id', teacherId);
  for (const s of await sq) {
    const received = parseDbDate(s.submitted_at);
    const policy = resolvePolicy(policies, { teacherId: s.teacher_id, classId: s.class_id, subjectId: s.subject_id, dateKey: schoolDate(received), sessionId });
    const days = s.task_type === 'ASSIGNMENT' ? policy?.assignment_grading_days : policy?.quiz_grading_days ?? policy?.assignment_grading_days;
    if (!policy || days === null || days === undefined) continue;

    const graded = s.status === 'GRADED' && s.marks_awarded !== null && s.marks_awarded !== undefined;
    const feedbackMissing = Boolean(Number(policy.feedback_required)) && graded && !String(s.feedback || '').trim();
    const status = graded && !feedbackMissing ? 'COMPLETED' : s.status === 'RESUBMIT_REQUESTED' ? 'RETURNED' : 'PENDING';
    await upsert(
      'task_submission',
      s.id,
      {
        obligation_type: 'ASSIGNMENT_GRADING',
        parent_id: s.taskId,
        parent_title: s.title,
        teacher_id: s.teacher_id,
        class_id: s.class_id,
        subject_id: s.subject_id,
        student_id: s.student_id,
        received_at: received,
        original_deadline: computeDeadline(received, days, holidays, leaveMap.get(Number(s.teacher_id))),
        policy_id: policy.id,
        policy_version: policy.version
      },
      { status, feedback_missing: feedbackMissing ? 1 : 0, completed_at: status === 'COMPLETED' ? parseDbDate(s.graded_at) || now : null }
    );
  }

  // 2. Quiz / test attempts that contain manually graded (written) questions.
  //    MCQ-only assessments are auto-graded and create no obligation.
  let aq = db('test_attempts as a')
    .join('monthly_tests as m', 'a.test_id', 'm.id')
    .whereIn('a.status', ['SUBMITTED', 'GRADED'])
    .whereNotNull('a.submitted_at')
    .where('a.submitted_at', '>=', lookbackUtc)
    .whereNotIn('m.status', ['DRAFT', 'CANCELLED'])
    .whereExists(function manualQuestions() {
      this.select(db.raw(1)).from('test_questions as q').whereRaw('q.test_id = m.id').whereNot('q.question_type', 'MCQ');
    })
    .select('a.id', 'a.status', 'a.submitted_at', 'a.graded_at', 'a.teacher_remarks', 'a.student_id',
      'm.id as testId', 'm.title', 'm.teacher_id', 'm.class_id', 'm.subject_id');
  if (teacherId) aq = aq.where('m.teacher_id', teacherId);
  for (const a of await aq) {
    const received = parseDbDate(a.submitted_at);
    const policy = resolvePolicy(policies, { teacherId: a.teacher_id, classId: a.class_id, subjectId: a.subject_id, dateKey: schoolDate(received), sessionId });
    const days = policy?.quiz_grading_days;
    if (!policy || days === null || days === undefined) continue;
    const graded = a.status === 'GRADED';
    const feedbackMissing = Boolean(Number(policy.feedback_required)) && graded && !String(a.teacher_remarks || '').trim();
    const status = graded && !feedbackMissing ? 'COMPLETED' : 'PENDING';
    await upsert(
      'test_attempt',
      a.id,
      {
        obligation_type: 'QUIZ_MANUAL_GRADING',
        parent_id: a.testId,
        parent_title: a.title,
        teacher_id: a.teacher_id,
        class_id: a.class_id,
        subject_id: a.subject_id,
        student_id: a.student_id,
        received_at: received,
        original_deadline: computeDeadline(received, days, holidays, leaveMap.get(Number(a.teacher_id))),
        policy_id: policy.id,
        policy_version: policy.version
      },
      { status, feedback_missing: feedbackMissing ? 1 : 0, completed_at: status === 'COMPLETED' ? parseDbDate(a.graded_at) || now : null }
    );
  }

  // 3. Terminal exam marks upload (teacher responsibility ends at MARKS_SUBMITTED;
  //    Principal verification is not the teacher's deadline).
  let pq = db('terminal_exam_papers as p')
    .leftJoin('terminal_exams as e', 'p.exam_id', 'e.id')
    .leftJoin('subjects as s', 'p.subject_id', 's.id')
    .whereNotNull('p.paper_date')
    .where('p.paper_date', '>=', lookback)
    .where('p.paper_date', '<=', today)
    .select('p.id', 'p.status', 'p.paper_date', 'p.marking_teacher_id', 'p.class_id', 'p.subject_id', 'p.updated_at',
      'p.exam_id', 'e.title as examTitle', 's.name as subjectName');
  for (const p of await pq) {
    let responsible = p.marking_teacher_id ? Number(p.marking_teacher_id) : null;
    if (!responsible) {
      const ta = await db('teacher_assignments')
        .where({ class_id: p.class_id, subject_id: p.subject_id })
        .where('effective_from', '<=', keyOf(p.paper_date))
        .where((w) => w.whereNull('effective_to').orWhere('effective_to', '>=', keyOf(p.paper_date)))
        .first();
      responsible = ta ? Number(ta.teacher_id) : null;
    }
    if (!responsible || (teacherId && responsible !== Number(teacherId))) continue;
    const paperDay = keyOf(p.paper_date);
    const policy = resolvePolicy(policies, { teacherId: responsible, classId: p.class_id, subjectId: p.subject_id, dateKey: paperDay, sessionId });
    const days = policy?.marks_upload_days;
    if (!policy || days === null || days === undefined) continue;
    const received = endOfSchoolDay(paperDay);
    const done = COMPLETED_PAPER_STATUSES.includes(p.status);
    let completedAt = null;
    if (done) {
      const last = await db('terminal_exam_marks').where('paper_id', p.id).max('updated_at as at').first();
      completedAt = parseDbDate(last?.at) || parseDbDate(p.updated_at) || now;
    }
    await upsert(
      'terminal_exam_paper',
      p.id,
      {
        obligation_type: 'MARKS_UPLOAD',
        parent_id: p.exam_id,
        parent_title: `${p.examTitle || 'Terminal exam'} · ${p.subjectName || 'Paper'}`,
        teacher_id: responsible,
        class_id: p.class_id,
        subject_id: p.subject_id,
        student_id: null,
        received_at: received,
        original_deadline: computeDeadline(received, days, holidays, leaveMap.get(responsible)),
        policy_id: policy.id,
        policy_version: policy.version
      },
      { status: done ? 'COMPLETED' : 'PENDING', feedback_missing: 0, completed_at: completedAt }
    );
  }
}

/** Display status of an obligation, with exact lateness evidence. */
export function obligationView(o, dueSoonHours = 24, now = new Date()) {
  const original = parseDbDate(o.original_deadline);
  const extended = o.extended_deadline ? parseDbDate(o.extended_deadline) : null;
  const effective = extended || original;
  const base = {
    id: o.id,
    type: o.obligation_type,
    parentId: o.parent_id,
    parentTitle: o.parent_title,
    studentId: o.student_id,
    receivedAt: parseDbDate(o.received_at)?.toISOString() || null,
    originalDeadline: original?.toISOString() || null,
    extendedDeadline: extended?.toISOString() || null,
    effectiveDeadline: effective?.toISOString() || null,
    completedAt: o.completed_at ? parseDbDate(o.completed_at).toISOString() : null,
    feedbackMissing: Boolean(Number(o.feedback_missing))
  };
  if (o.status === 'COMPLETED') {
    const completed = parseDbDate(o.completed_at);
    const lateByMs = completed && effective && completed > effective ? completed - effective : 0;
    return { ...base, status: 'COMPLETED', onTime: lateByMs === 0, lateByMs };
  }
  if (o.status === 'EXCUSED') return { ...base, status: 'EXCUSED' };
  if (o.status === 'RETURNED') return { ...base, status: 'RETURNED' };
  if (effective && now > effective) return { ...base, status: 'OVERDUE', overdueByMs: now - effective };
  if (effective && effective - now <= Number(dueSoonHours || 24) * 3600000) {
    return { ...base, status: 'DUE_SOON', dueInMs: effective - now };
  }
  return { ...base, status: 'PENDING', dueInMs: effective ? effective - now : null };
}
