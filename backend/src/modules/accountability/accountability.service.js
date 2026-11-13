import { db } from '../../shared/db/knex.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { parseDbDate } from '../../shared/utils/date.js';
import { auditRepository } from '../audit/audit.repository.js';
import { notificationService } from '../../shared/services/notificationService.js';
import { getSocketServer } from '../../shared/realtime/socket.js';
import { RealtimeEvents } from '../../shared/realtime/eventEmitter.js';
import { getCurrentSessionId, getTeacherByUserId } from '../../shared/services/accessScope.js';
import {
  PERIOD_RE,
  currentPeriod,
  monthBounds,
  schoolDate,
  daysBetween,
  addDays,
  loadPolicies,
  resolvePolicy,
  getAllocations,
  getWorkItems,
  ensureRequirements,
  closePeriod,
  filterDrafts,
  categoryStatus,
  syncObligations,
  obligationView
} from './accountability.engine.js';

const SCOPES = ['SCHOOL', 'CLASS', 'SUBJECT', 'CLASS_SUBJECT', 'TEACHER'];
const STATUS_RANK = { OVERDUE: 5, DUE_SOON: 4, PENDING: 3, ON_TRACK: 2, EXCUSED: 1, COMPLETED: 0, NOT_REQUIRED: -1 };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const validation = (m) => new AppError(m, 422, ErrorCodes.VALIDATION_ERROR);
const notFound = (m) => new AppError(m, 404, ErrorCodes.NOT_FOUND);
const keyOf = (v) => (v ? String(v).slice(0, 10) : null);
const worst = (statuses) => statuses.reduce((w, s) => ((STATUS_RANK[s] ?? -1) > (STATUS_RANK[w] ?? -1) ? s : w), 'NOT_REQUIRED');

function resolvePeriod(period) {
  const p = period || currentPeriod();
  if (!PERIOD_RE.test(p)) throw validation('period must be YYYY-MM');
  if (p > currentPeriod()) throw validation('Future months have no requirements yet');
  return p;
}

// ─── Notifications helper (existing notification infrastructure) ──────────────

async function notify(userIds, { title, message, type = 'Academic Work', relatedRecordType = 'AcademicWork', relatedRecordId = null, priority = 'Medium' }) {
  const ids = Array.from(new Set((userIds || []).map(Number).filter(Boolean)));
  if (ids.length === 0) return;
  await notificationService.notifyUsers(ids, { title, message, type, targetRole: 'ALL', relatedRecordType, relatedRecordId, priority });
  const io = getSocketServer();
  if (io) {
    io.to(ids.map((id) => `user:${id}`)).emit(RealtimeEvents.NOTIFICATION_CREATED, {
      title, message, type, priority: String(priority).toUpperCase(), relatedRecordType, createdAt: new Date().toISOString()
    });
  }
}

async function staffUserIds() {
  return (await db('users')
    .join('roles', 'users.role_id', 'roles.id')
    .whereRaw("UPPER(roles.name) IN ('PRINCIPAL','ADMIN')")
    .whereNot('users.status', 'DEACTIVATED')
    .pluck('users.id')).map(Number);
}

async function teacherUserId(teacherId) {
  const t = await db('teachers').where({ id: teacherId }).first();
  return t ? Number(t.user_id) : null;
}

// ─── Lookups ──────────────────────────────────────────────────────────────────

async function namesMaps() {
  const [teachers, classes, subjects] = await Promise.all([
    db('teachers').join('users', 'teachers.user_id', 'users.id').select('teachers.id', 'users.full_name', 'teachers.employee_no'),
    db('classes').select('id', 'name'),
    db('subjects').select('id', 'name')
  ]);
  return {
    teacher: new Map(teachers.map((t) => [Number(t.id), { name: t.full_name, employeeNo: t.employee_no }])),
    klass: new Map(classes.map((c) => [Number(c.id), c.name])),
    subject: new Map(subjects.map((s) => [Number(s.id), s.name]))
  };
}

// ─── Policies ─────────────────────────────────────────────────────────────────

function mapPolicy(p, names) {
  return {
    id: p.id,
    name: p.name,
    scopeType: p.scope_type,
    classId: p.class_id,
    className: p.class_id ? names?.klass.get(Number(p.class_id)) || null : null,
    subjectId: p.subject_id,
    subjectName: p.subject_id ? names?.subject.get(Number(p.subject_id)) || null : null,
    teacherId: p.teacher_id,
    teacherName: p.teacher_id ? names?.teacher.get(Number(p.teacher_id))?.name || null : null,
    sessionId: p.session_id,
    termId: p.term_id,
    requiredQuizzes: p.required_quizzes,
    requiredAssignments: p.required_assignments,
    requiredTests: p.required_tests,
    countDrafts: Boolean(Number(p.count_drafts)),
    assignmentGradingDays: p.assignment_grading_days,
    quizGradingDays: p.quiz_grading_days,
    marksUploadDays: p.marks_upload_days,
    feedbackRequired: Boolean(Number(p.feedback_required)),
    dueSoonHours: p.due_soon_hours,
    notifyTeacher: Boolean(Number(p.notify_teacher)),
    notifyPrincipal: Boolean(Number(p.notify_principal)),
    effectiveFrom: keyOf(p.effective_from),
    effectiveTo: keyOf(p.effective_to),
    isActive: Boolean(Number(p.is_active)),
    version: p.version,
    updatedAt: p.updated_at
  };
}

async function buildPolicyColumns(input, existing = null) {
  const pick = (k, col) => (input[k] !== undefined ? input[k] : existing ? existing[col] : undefined);
  const name = String(pick('name', 'name') || '').trim();
  if (!name) throw validation('Policy name is required');
  const scopeType = String(pick('scopeType', 'scope_type') || 'SCHOOL').toUpperCase();
  if (!SCOPES.includes(scopeType)) throw validation(`Scope must be one of: ${SCOPES.join(', ')}`);

  const id = (v) => (v === undefined || v === null || v === '' ? null : Number(v));
  const classId = id(pick('classId', 'class_id'));
  const subjectId = id(pick('subjectId', 'subject_id'));
  const teacherId = id(pick('teacherId', 'teacher_id'));
  if (['CLASS', 'CLASS_SUBJECT'].includes(scopeType) && !classId) throw validation('Select the class for this policy');
  if (['SUBJECT', 'CLASS_SUBJECT'].includes(scopeType) && !subjectId) throw validation('Select the subject for this policy');
  if (scopeType === 'TEACHER' && !teacherId) throw validation('Select the teacher for this policy');

  const count = (k, col) => {
    const v = Number(pick(k, col) ?? 0);
    if (!Number.isInteger(v) || v < 0 || v > 100) throw validation('Monthly targets must be whole numbers between 0 and 100');
    return v;
  };
  const days = (k, col) => {
    const raw = pick(k, col);
    if (raw === undefined || raw === null || raw === '') return null;
    const v = Number(raw);
    if (!Number.isInteger(v) || v < 0 || v > 60) throw validation('Deadlines must be whole numbers of days between 0 and 60');
    return v;
  };

  const effectiveFrom = keyOf(pick('effectiveFrom', 'effective_from'));
  const effectiveTo = keyOf(pick('effectiveTo', 'effective_to'));
  if (!effectiveFrom || !DATE_RE.test(effectiveFrom)) throw validation('Effective start date is required (YYYY-MM-DD)');
  if (effectiveTo && (!DATE_RE.test(effectiveTo) || effectiveTo < effectiveFrom)) throw validation('Effective end date must be on or after the start date');

  const dueSoon = Number(pick('dueSoonHours', 'due_soon_hours') ?? 24);
  if (!Number.isInteger(dueSoon) || dueSoon < 1 || dueSoon > 168) throw validation('Due-soon reminder must be between 1 and 168 hours');

  const bool = (k, col, d) => {
    const v = pick(k, col);
    return v === undefined || v === null ? d : Boolean(Number(v) || v === true || v === 'true');
  };

  return {
    name: name.slice(0, 150),
    scope_type: scopeType,
    class_id: ['CLASS', 'CLASS_SUBJECT', 'TEACHER'].includes(scopeType) ? classId : null,
    subject_id: ['SUBJECT', 'CLASS_SUBJECT', 'TEACHER'].includes(scopeType) ? subjectId : null,
    teacher_id: scopeType === 'TEACHER' ? teacherId : null,
    session_id: id(pick('sessionId', 'session_id')) || (existing ? existing.session_id : await getCurrentSessionId()),
    term_id: id(pick('termId', 'term_id')),
    required_quizzes: count('requiredQuizzes', 'required_quizzes'),
    required_assignments: count('requiredAssignments', 'required_assignments'),
    required_tests: count('requiredTests', 'required_tests'),
    count_drafts: bool('countDrafts', 'count_drafts', false) ? 1 : 0,
    assignment_grading_days: days('assignmentGradingDays', 'assignment_grading_days'),
    quiz_grading_days: days('quizGradingDays', 'quiz_grading_days'),
    marks_upload_days: days('marksUploadDays', 'marks_upload_days'),
    feedback_required: bool('feedbackRequired', 'feedback_required', false) ? 1 : 0,
    due_soon_hours: dueSoon,
    notify_teacher: bool('notifyTeacher', 'notify_teacher', true) ? 1 : 0,
    notify_principal: bool('notifyPrincipal', 'notify_principal', true) ? 1 : 0,
    effective_from: effectiveFrom,
    effective_to: effectiveTo
  };
}

/** Teachers (user ids) currently covered by a policy's scope. */
async function teachersInScope(policyRow) {
  const { start, end } = monthBounds(currentPeriod());
  const allocations = await getAllocations(start, end);
  const policies = await loadPolicies();
  const sessionId = await getCurrentSessionId();
  const today = schoolDate();
  const teacherIds = new Set();
  for (const a of allocations) {
    const resolved = resolvePolicy(policies, { teacherId: a.teacherId, classId: a.classId, subjectId: a.subjectId, dateKey: today, sessionId });
    if (resolved && Number(resolved.id) === Number(policyRow.id)) teacherIds.add(a.teacherId);
  }
  if (teacherIds.size === 0) return [];
  return (await db('teachers').whereIn('id', Array.from(teacherIds)).pluck('user_id')).map(Number);
}

async function announcePolicy(policyRow, verb) {
  if (!Number(policyRow.is_active) || !Number(policyRow.notify_teacher)) return;
  const users = await teachersInScope(policyRow);
  const parts = [];
  if (policyRow.required_quizzes) parts.push(`${policyRow.required_quizzes} quiz(zes)`);
  if (policyRow.required_assignments) parts.push(`${policyRow.required_assignments} assignment(s)`);
  if (policyRow.required_tests) parts.push(`${policyRow.required_tests} test(s)`);
  const grading = [];
  if (policyRow.assignment_grading_days !== null) grading.push(`assignments within ${policyRow.assignment_grading_days} day(s)`);
  if (policyRow.quiz_grading_days !== null) grading.push(`written quiz answers within ${policyRow.quiz_grading_days} day(s)`);
  if (policyRow.marks_upload_days !== null) grading.push(`exam marks within ${policyRow.marks_upload_days} day(s)`);
  await notify(users, {
    title: `Academic work requirements ${verb}`,
    message: `${policyRow.name}: ${parts.length ? `publish ${parts.join(', ')} per month per class/subject` : 'no monthly publishing target'}${grading.length ? `; grade ${grading.join(', ')}` : ''}. Effective from ${keyOf(policyRow.effective_from)}.`,
    relatedRecordId: policyRow.id
  });
}

export const accountabilityService = {
  async listPolicies() {
    const [rows, names] = await Promise.all([
      db('teacher_academic_policies').orderBy('is_active', 'desc').orderBy('effective_from', 'desc'),
      namesMaps()
    ]);
    const versions = await db('teacher_academic_policy_versions').select('policy_id', 'version', 'change_reason', 'created_at').orderBy('version', 'desc');
    return rows.map((p) => ({
      ...mapPolicy(p, names),
      history: versions.filter((v) => Number(v.policy_id) === Number(p.id)).map((v) => ({ version: v.version, reason: v.change_reason, at: v.created_at }))
    }));
  },

  async createPolicy(input, actorId) {
    const columns = await buildPolicyColumns(input);
    const id = await db.transaction(async (trx) => {
      const [newId] = await trx('teacher_academic_policies').insert({ ...columns, version: 1, is_active: 1, created_by: actorId || null });
      await trx('teacher_academic_policy_versions').insert({ policy_id: newId, version: 1, snapshot: JSON.stringify(columns), change_reason: 'Created', changed_by: actorId || null });
      await auditRepository.logAction(trx, {
        actorId, action: 'ACADEMIC_POLICY_CREATED', recordType: 'teacher_academic_policies', recordIdentifier: `Policy #${newId}: ${columns.name}`, newValue: columns
      });
      return newId;
    });
    const row = await db('teacher_academic_policies').where({ id }).first();
    await announcePolicy(row, 'published');
    return mapPolicy(row, await namesMaps());
  },

  /** Edits create a new version; closed months keep the version that applied to them. */
  async updatePolicy(id, input, actorId) {
    const existing = await db('teacher_academic_policies').where({ id }).first();
    if (!existing) throw notFound('Policy not found');
    const columns = await buildPolicyColumns(input, existing);
    const version = Number(existing.version) + 1;
    await db.transaction(async (trx) => {
      await trx('teacher_academic_policies').where({ id }).update({ ...columns, version });
      await trx('teacher_academic_policy_versions').insert({
        policy_id: id, version, snapshot: JSON.stringify(columns), change_reason: String(input.changeReason || 'Updated').slice(0, 255), changed_by: actorId || null
      });
      await auditRepository.logAction(trx, {
        actorId, action: 'ACADEMIC_POLICY_UPDATED', recordType: 'teacher_academic_policies', recordIdentifier: `Policy #${id}: ${columns.name} (v${version})`,
        reason: input.changeReason || null, previousValue: existing, newValue: columns
      });
    });
    const row = await db('teacher_academic_policies').where({ id }).first();
    await announcePolicy(row, 'updated');
    return mapPolicy(row, await namesMaps());
  },

  async setPolicyActive(id, active, actorId, reason = null) {
    const existing = await db('teacher_academic_policies').where({ id }).first();
    if (!existing) throw notFound('Policy not found');
    await db.transaction(async (trx) => {
      await trx('teacher_academic_policies').where({ id }).update({ is_active: active ? 1 : 0 });
      await auditRepository.logAction(trx, {
        actorId, action: active ? 'ACADEMIC_POLICY_ACTIVATED' : 'ACADEMIC_POLICY_DEACTIVATED', recordType: 'teacher_academic_policies',
        recordIdentifier: `Policy #${id}: ${existing.name}`, reason
      });
    });
    const row = await db('teacher_academic_policies').where({ id }).first();
    if (active) await announcePolicy(row, 'activated');
    return mapPolicy(row, await namesMaps());
  },

  // ─── Calculations shared by dashboard, teacher view and reports ─────────────

  async buildTeacherData(period, { teacherId = null } = {}) {
    await ensureRequirements(period, { teacherId });
    await syncObligations({ teacherId });

    const { start, end } = monthBounds(period);
    const isCurrent = period === currentPeriod();
    let rq = db('teacher_work_requirements').where({ period });
    if (teacherId) rq = rq.where('teacher_id', teacherId);
    const requirements = await rq;
    const work = await getWorkItems(start, end, { teacherId, includeDrafts: true });

    const startUtc = new Date(`${start}T00:00:00Z`).getTime() - 14 * 3600000;
    const endUtc = new Date(`${end}T23:59:59Z`).getTime() + 14 * 3600000;
    let oq = db('teacher_grading_obligations').where((w) => {
      w.whereIn('status', ['PENDING', 'RETURNED']).orWhereBetween('received_at', [new Date(startUtc), new Date(endUtc)])
        .orWhereBetween('completed_at', [new Date(startUtc), new Date(endUtc)]);
    });
    if (teacherId) oq = oq.where('teacher_id', teacherId);
    if (!isCurrent) {
      // past months: only obligations that belong to that month
      oq = db('teacher_grading_obligations').whereBetween('received_at', [new Date(startUtc), new Date(endUtc)]);
      if (teacherId) oq = oq.where('teacher_id', teacherId);
    }
    const obligations = await oq;
    const policyMap = new Map((await db('teacher_academic_policies').select('id', 'due_soon_hours')).map((p) => [Number(p.id), p.due_soon_hours]));
    const views = obligations.map((o) => ({ row: o, view: obligationView(o, policyMap.get(Number(o.policy_id)) || 24) }));

    return { requirements, work, views, start, end, isCurrent };
  },

  requirementView(r, work, period) {
    const items = filterDrafts(work.get(`${r.teacher_id}-${r.class_id}-${r.subject_id}`), Number(r.count_drafts));
    const closed = Boolean(Number(r.is_closed));
    const excused = Boolean(Number(r.is_excused));
    const categories = {};
    for (const [key, reqCol, finalCol] of [
      ['quizzes', 'required_quizzes', 'final_quizzes'],
      ['assignments', 'required_assignments', 'final_assignments'],
      ['tests', 'required_tests', 'final_tests']
    ]) {
      const required = Number(r[reqCol] || 0);
      const completed = closed && r[finalCol] !== null ? Number(r[finalCol]) : items[key].length;
      categories[key] = { required, completed, ...categoryStatus(required, completed, { closed, excused, period }), items: items[key] };
    }
    return {
      id: r.id,
      teacherId: r.teacher_id,
      classId: r.class_id,
      subjectId: r.subject_id,
      period: r.period,
      policyId: r.policy_id,
      policyVersion: r.policy_version,
      dueDate: keyOf(r.due_date),
      assignedFrom: keyOf(r.assigned_from),
      isClosed: closed,
      isExcused: excused,
      excuseReason: r.excuse_reason,
      categories,
      status: worst(Object.values(categories).map((c) => c.status))
    };
  },

  // ─── Principal overview ─────────────────────────────────────────────────────

  async overview({ period, teacherId, classId, subjectId, status }) {
    const p = resolvePeriod(period);
    const names = await namesMaps();
    const { requirements, work, views } = await this.buildTeacherData(p, { teacherId: teacherId ? Number(teacherId) : null });

    const teachers = new Map();
    const ensure = (id) => {
      if (!teachers.has(id)) {
        const t = names.teacher.get(id) || {};
        teachers.set(id, {
          teacherId: id, teacherName: t.name || `Teacher #${id}`, employeeNo: t.employeeNo || null,
          classes: new Set(), subjects: new Set(),
          quizzes: { required: 0, completed: 0 }, assignments: { required: 0, completed: 0 }, tests: { required: 0, completed: 0 },
          pendingGrading: 0, overdueGrading: 0, dueSoonGrading: 0, completedGrading: 0, onTimeGrading: 0,
          missedRequirements: 0, remainingUnits: 0, statuses: []
        });
      }
      return teachers.get(id);
    };

    for (const r of requirements) {
      if (classId && Number(r.class_id) !== Number(classId)) continue;
      if (subjectId && Number(r.subject_id) !== Number(subjectId)) continue;
      const v = this.requirementView(r, work, p);
      const t = ensure(Number(r.teacher_id));
      t.classes.add(names.klass.get(Number(r.class_id)) || `Class #${r.class_id}`);
      t.subjects.add(names.subject.get(Number(r.subject_id)) || `Subject #${r.subject_id}`);
      for (const k of ['quizzes', 'assignments', 'tests']) {
        t[k].required += v.categories[k].required;
        t[k].completed += Math.min(v.categories[k].completed, v.categories[k].required);
        if (v.categories[k].status === 'OVERDUE') t.missedRequirements += v.categories[k].remaining;
        if (v.categories[k].status !== 'EXCUSED') t.remainingUnits += v.categories[k].remaining;
      }
      t.statuses.push(v.status);
    }

    for (const { row, view } of views) {
      if (classId && Number(row.class_id) !== Number(classId)) continue;
      if (subjectId && Number(row.subject_id) !== Number(subjectId)) continue;
      const t = ensure(Number(row.teacher_id));
      if (row.class_id) t.classes.add(names.klass.get(Number(row.class_id)) || `Class #${row.class_id}`);
      if (row.subject_id) t.subjects.add(names.subject.get(Number(row.subject_id)) || `Subject #${row.subject_id}`);
      if (view.status === 'OVERDUE') t.overdueGrading++;
      if (view.status === 'DUE_SOON') t.dueSoonGrading++;
      if (['PENDING', 'DUE_SOON', 'OVERDUE', 'RETURNED'].includes(view.status)) t.pendingGrading++;
      if (view.status === 'COMPLETED') {
        t.completedGrading++;
        if (view.onTime) t.onTimeGrading++;
      }
      t.statuses.push(view.status === 'RETURNED' ? 'PENDING' : view.status);
    }

    let rows = Array.from(teachers.values()).map((t) => {
      const overall = worst(t.statuses);
      return {
        teacherId: t.teacherId,
        teacherName: t.teacherName,
        employeeNo: t.employeeNo,
        classes: Array.from(t.classes),
        subjects: Array.from(t.subjects),
        quizzes: t.quizzes,
        assignments: t.assignments,
        tests: t.tests,
        pendingGrading: t.pendingGrading,
        overdueGrading: t.overdueGrading,
        dueSoonGrading: t.dueSoonGrading,
        onTimeRate: t.completedGrading ? Math.round((t.onTimeGrading / t.completedGrading) * 100) : null,
        gradedCount: t.completedGrading,
        missedRequirements: t.missedRequirements,
        outstanding: t.pendingGrading + t.remainingUnits,
        status: overall === 'NOT_REQUIRED' ? 'COMPLETED' : overall
      };
    });
    if (status && status !== 'ALL') rows = rows.filter((r) => r.status === status);
    rows.sort((a, b) => (STATUS_RANK[b.status] ?? 0) - (STATUS_RANK[a.status] ?? 0) || a.teacherName.localeCompare(b.teacherName));
    return { period: p, rows };
  },

  // ─── Teacher detail (evidence) ──────────────────────────────────────────────

  async teacherDetail(teacherId, { period } = {}) {
    const p = resolvePeriod(period);
    const id = Number(teacherId);
    const names = await namesMaps();
    if (!names.teacher.has(id)) throw notFound('Teacher not found');
    const { requirements, work, views, start, end } = await this.buildTeacherData(p, { teacherId: id });

    const studentIds = Array.from(new Set(views.map((v) => v.row.student_id).filter(Boolean)));
    const students = studentIds.length
      ? await db('students').join('users', 'students.user_id', 'users.id').whereIn('students.id', studentIds).select('students.id', 'users.full_name', 'students.roll_no')
      : [];
    const studentMap = new Map(students.map((s) => [Number(s.id), { name: s.full_name, rollNo: s.roll_no }]));

    const reqViews = requirements.map((r) => ({
      ...this.requirementView(r, work, p),
      className: names.klass.get(Number(r.class_id)) || `Class #${r.class_id}`,
      subjectName: names.subject.get(Number(r.subject_id)) || `Subject #${r.subject_id}`
    }));

    // Grading responsibilities grouped by assignment / quiz / exam paper
    const groups = new Map();
    for (const { row, view } of views) {
      const key = `${row.obligation_type}-${row.parent_id}-${row.class_id}-${row.subject_id}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          type: row.obligation_type,
          parentId: row.parent_id,
          title: row.parent_title,
          classId: row.class_id,
          className: names.klass.get(Number(row.class_id)) || null,
          subjectName: names.subject.get(Number(row.subject_id)) || null,
          total: 0, graded: 0, pending: 0, overdue: 0, excused: 0, returned: 0,
          earliestOriginalDeadline: null, earliestEffectiveDeadline: null, maxOverdueMs: 0, lateCompletions: 0,
          items: []
        });
      }
      const g = groups.get(key);
      g.total++;
      if (view.status === 'COMPLETED') {
        g.graded++;
        if (!view.onTime) g.lateCompletions++;
      } else if (view.status === 'EXCUSED') g.excused++;
      else if (view.status === 'RETURNED') g.returned++;
      else {
        g.pending++;
        if (view.status === 'OVERDUE') {
          g.overdue++;
          g.maxOverdueMs = Math.max(g.maxOverdueMs, view.overdueByMs);
        }
        if (!g.earliestEffectiveDeadline || view.effectiveDeadline < g.earliestEffectiveDeadline) {
          g.earliestEffectiveDeadline = view.effectiveDeadline;
          g.earliestOriginalDeadline = view.originalDeadline;
        }
      }
      const student = row.student_id ? studentMap.get(Number(row.student_id)) : null;
      g.items.push({ ...view, studentName: student?.name || null, rollNo: student?.rollNo || null });
    }
    const grading = Array.from(groups.values()).map((g) => ({
      ...g,
      status: g.overdue ? 'OVERDUE' : g.pending && g.items.some((i) => i.status === 'DUE_SOON') ? 'DUE_SOON' : g.pending || g.returned ? 'PENDING' : g.total === g.excused ? 'EXCUSED' : 'COMPLETED'
    }));
    grading.sort((a, b) => (STATUS_RANK[b.status] ?? 0) - (STATUS_RANK[a.status] ?? 0));

    const exceptions = await db('teacher_work_exceptions as x')
      .leftJoin('users as u', 'x.approved_by', 'u.id')
      .where('x.teacher_id', id)
      .orderBy('x.created_at', 'desc')
      .limit(50)
      .select('x.*', 'u.full_name as approvedByName');

    // Context for fair reading (approved leave, school holidays) in this month
    const leave = (await db.schema.hasTable('teacher_checkin_checkout'))
      ? await db('teacher_checkin_checkout').where({ teacher_id: id, attendance_status: 'ON_LEAVE' }).whereBetween('duty_date', [start, end]).pluck('duty_date')
      : [];
    const holidays = await db('academic_holidays').where('start_date', '<=', end).andWhere('end_date', '>=', start).select('title', 'start_date', 'end_date', 'classes_suspended');

    const teacher = names.teacher.get(id);
    return {
      period: p,
      teacher: { id, name: teacher.name, employeeNo: teacher.employeeNo },
      requirements: reqViews,
      grading,
      exceptions: exceptions.map((x) => ({
        id: x.id,
        type: x.exception_type,
        targetType: x.target_type,
        targetId: x.target_id,
        originalDeadline: x.original_deadline ? parseDbDate(x.original_deadline).toISOString() : null,
        newDeadline: x.new_deadline ? parseDbDate(x.new_deadline).toISOString() : null,
        reason: x.reason,
        approvedBy: x.approvedByName,
        createdAt: x.created_at ? parseDbDate(x.created_at).toISOString() : null
      })),
      context: {
        leaveDays: leave.map(keyOf),
        holidays: holidays
          .filter((h) => h.classes_suspended === null || Number(h.classes_suspended))
          .map((h) => ({ title: h.title, startDate: keyOf(h.start_date), endDate: keyOf(h.end_date) }))
      }
    };
  },

  async myWork(user, { period } = {}) {
    const teacher = await getTeacherByUserId(user.id);
    if (!teacher) throw new AppError('Teacher profile not found', 403, ErrorCodes.FORBIDDEN);
    return await this.teacherDetail(teacher.id, { period });
  },

  // ─── Exceptions (always audited, original deadline preserved) ───────────────

  async extendObligations({ obligationIds, newDeadline, reason }, actorId) {
    if (!reason || !String(reason).trim()) throw validation('A reason is required for a deadline extension');
    const deadline = new Date(newDeadline);
    if (Number.isNaN(deadline.getTime())) throw validation('A valid new deadline is required');
    const ids = Array.from(new Set((obligationIds || []).map(Number).filter(Boolean)));
    if (ids.length === 0) throw validation('Select at least one grading item to extend');

    const rows = await db('teacher_grading_obligations').whereIn('id', ids);
    const open = rows.filter((r) => !['COMPLETED', 'EXCUSED'].includes(r.status));
    if (open.length === 0) throw validation('These items are already completed or excused');
    if (open.some((r) => deadline <= parseDbDate(r.original_deadline))) throw validation('The new deadline must be after the original deadline');

    await db.transaction(async (trx) => {
      for (const r of open) {
        await trx('teacher_grading_obligations').where({ id: r.id }).update({ extended_deadline: deadline, due_soon_notified_at: null });
        await trx('teacher_work_exceptions').insert({
          exception_type: 'EXTENSION', target_type: 'OBLIGATION', target_id: r.id, teacher_id: r.teacher_id,
          original_deadline: parseDbDate(r.original_deadline), new_deadline: deadline, reason: String(reason).trim().slice(0, 500), approved_by: actorId || null
        });
      }
      await auditRepository.logAction(trx, {
        actorId, action: 'GRADING_DEADLINE_EXTENDED', recordType: 'teacher_grading_obligations',
        recordIdentifier: `${open.length} item(s): ${open.map((r) => `#${r.id}`).join(', ')}`.slice(0, 200),
        reason: String(reason).trim(), newValue: { newDeadline: deadline.toISOString(), obligations: open.map((r) => ({ id: r.id, originalDeadline: r.original_deadline })) }
      });
    });

    const byTeacher = new Map();
    open.forEach((r) => byTeacher.set(Number(r.teacher_id), [...(byTeacher.get(Number(r.teacher_id)) || []), r]));
    for (const [tid, list] of byTeacher) {
      await notify([await teacherUserId(tid)], {
        title: 'Grading deadline extended',
        message: `The Principal extended the grading deadline for ${list.length} item(s) of "${list[0].parent_title}" to ${schoolDate(deadline)}. Reason: ${String(reason).trim()}`,
        relatedRecordId: list[0].parent_id
      });
    }
    return { extended: open.length };
  },

  async excuseObligations({ obligationIds, reason }, actorId) {
    if (!reason || !String(reason).trim()) throw validation('A reason is required to excuse grading work');
    const ids = Array.from(new Set((obligationIds || []).map(Number).filter(Boolean)));
    const rows = await db('teacher_grading_obligations').whereIn('id', ids).whereNotIn('status', ['COMPLETED', 'EXCUSED']);
    if (rows.length === 0) throw validation('Nothing to excuse');
    await db.transaction(async (trx) => {
      for (const r of rows) {
        await trx('teacher_grading_obligations').where({ id: r.id }).update({ status: 'EXCUSED' });
        await trx('teacher_work_exceptions').insert({
          exception_type: 'EXCUSE', target_type: 'OBLIGATION', target_id: r.id, teacher_id: r.teacher_id,
          original_deadline: parseDbDate(r.original_deadline), reason: String(reason).trim().slice(0, 500), approved_by: actorId || null
        });
      }
      await auditRepository.logAction(trx, {
        actorId, action: 'GRADING_OBLIGATION_EXCUSED', recordType: 'teacher_grading_obligations',
        recordIdentifier: `${rows.length} item(s): ${rows.map((r) => `#${r.id}`).join(', ')}`.slice(0, 200), reason: String(reason).trim()
      });
    });
    return { excused: rows.length };
  },

  async excuseRequirement(id, reason, actorId) {
    if (!reason || !String(reason).trim()) throw validation('A reason is required to excuse a monthly requirement');
    const r = await db('teacher_work_requirements').where({ id }).first();
    if (!r) throw notFound('Requirement not found');
    await db.transaction(async (trx) => {
      await trx('teacher_work_requirements').where({ id }).update({ is_excused: 1, excuse_reason: String(reason).trim().slice(0, 255) });
      await trx('teacher_work_exceptions').insert({
        exception_type: 'EXCUSE', target_type: 'REQUIREMENT', target_id: id, teacher_id: r.teacher_id,
        original_deadline: new Date(`${keyOf(r.due_date)}T23:59:59Z`), reason: String(reason).trim().slice(0, 500), approved_by: actorId || null
      });
      await auditRepository.logAction(trx, {
        actorId, action: 'MONTHLY_REQUIREMENT_EXCUSED', recordType: 'teacher_work_requirements',
        recordIdentifier: `Requirement #${id} (${r.period})`, reason: String(reason).trim(), previousValue: r
      });
    });
    await notify([await teacherUserId(r.teacher_id)], {
      title: 'Monthly requirement excused',
      message: `Your ${r.period} academic work requirement was excused by the Principal. Reason: ${String(reason).trim()}`,
      relatedRecordId: id
    });
    return { excused: true };
  },

  // ─── Reports ────────────────────────────────────────────────────────────────

  async report({ from, to }) {
    const end = resolvePeriod(to);
    const start = from && PERIOD_RE.test(from) ? from : end;
    if (start > end) throw validation('"from" must be before "to"');
    const periods = [];
    for (let p = start; p <= end; p = addDays(`${p}-01`, 32).slice(0, 7)) {
      periods.push(p);
      if (periods.length > 12) throw validation('Reports cover at most 12 months');
    }
    const names = await namesMaps();
    const out = [];
    for (const p of periods) {
      const { requirements, work, views } = await this.buildTeacherData(p);
      const { start: ps, end: pe } = monthBounds(p);
      const exceptions = await db('teacher_work_exceptions')
        .whereBetween('created_at', [`${ps} 00:00:00`, `${pe} 23:59:59`])
        .select('teacher_id');
      const byTeacher = new Map();
      const get = (tid) => {
        if (!byTeacher.has(tid)) {
          byTeacher.set(tid, {
            period: p, teacherId: tid, teacherName: names.teacher.get(tid)?.name || `Teacher #${tid}`,
            quizzesRequired: 0, quizzesCompleted: 0, assignmentsRequired: 0, assignmentsCompleted: 0, testsRequired: 0, testsCompleted: 0,
            graded: 0, gradedOnTime: 0, turnaroundHoursTotal: 0, pendingGrading: 0, overdueGrading: 0, exceptions: 0
          });
        }
        return byTeacher.get(tid);
      };
      for (const r of requirements) {
        const v = this.requirementView(r, work, p);
        const t = get(Number(r.teacher_id));
        t.quizzesRequired += v.categories.quizzes.required;
        t.quizzesCompleted += Math.min(v.categories.quizzes.completed, v.categories.quizzes.required);
        t.assignmentsRequired += v.categories.assignments.required;
        t.assignmentsCompleted += Math.min(v.categories.assignments.completed, v.categories.assignments.required);
        t.testsRequired += v.categories.tests.required;
        t.testsCompleted += Math.min(v.categories.tests.completed, v.categories.tests.required);
      }
      for (const { row, view } of views) {
        const t = get(Number(row.teacher_id));
        if (view.status === 'COMPLETED') {
          t.graded++;
          if (view.onTime) t.gradedOnTime++;
          const received = parseDbDate(row.received_at);
          const completed = parseDbDate(row.completed_at);
          if (received && completed) t.turnaroundHoursTotal += Math.max(0, (completed - received) / 3600000);
        } else if (['PENDING', 'DUE_SOON', 'RETURNED'].includes(view.status)) t.pendingGrading++;
        else if (view.status === 'OVERDUE') {
          t.pendingGrading++;
          t.overdueGrading++;
        }
      }
      for (const x of exceptions) get(Number(x.teacher_id)).exceptions++;
      for (const t of byTeacher.values()) {
        const required = t.quizzesRequired + t.assignmentsRequired + t.testsRequired;
        const done = t.quizzesCompleted + t.assignmentsCompleted + t.testsCompleted;
        out.push({
          ...t,
          requirementCompletionRate: required ? Math.round((done / required) * 100) : null,
          onTimeGradingRate: t.graded ? Math.round((t.gradedOnTime / t.graded) * 100) : null,
          avgTurnaroundHours: t.graded ? Math.round((t.turnaroundHoursTotal / t.graded) * 10) / 10 : null
        });
      }
    }
    out.sort((a, b) => a.period.localeCompare(b.period) || a.teacherName.localeCompare(b.teacherName));
    return { from: start, to: end, rows: out.map(({ turnaroundHoursTotal, ...rest }) => rest) };
  },

  // ─── Scheduled sweep: requirements, obligations, reminders (idempotent) ─────

  async runSweep() {
    const period = currentPeriod();
    const previous = addDays(`${period}-01`, -1).slice(0, 7);
    await ensureRequirements(previous);
    await ensureRequirements(period);
    await syncObligations();

    const policies = new Map((await db('teacher_academic_policies')).map((p) => [Number(p.id), p]));
    const staff = await staffUserIds();
    const names = await namesMaps();
    const now = new Date();

    // Grading obligations: due-soon (teacher) and overdue (teacher + principal), once each
    const pending = await db('teacher_grading_obligations').where('status', 'PENDING');
    const overdueByTeacher = new Map();
    for (const o of pending) {
      const policy = policies.get(Number(o.policy_id));
      const view = obligationView(o, policy?.due_soon_hours || 24, now);
      if (view.status === 'DUE_SOON' && !o.due_soon_notified_at && (!policy || Number(policy.notify_teacher))) {
        await notify([await teacherUserId(o.teacher_id)], {
          title: 'Grading due soon',
          message: `"${o.parent_title}" — grading is due by ${new Date(view.effectiveDeadline).toISOString().slice(0, 16).replace('T', ' ')} UTC.`,
          relatedRecordId: o.parent_id
        });
        await db('teacher_grading_obligations').where({ id: o.id }).update({ due_soon_notified_at: now });
      }
      if (view.status === 'OVERDUE' && !o.overdue_notified_at) {
        const list = overdueByTeacher.get(Number(o.teacher_id)) || [];
        list.push({ o, policy });
        overdueByTeacher.set(Number(o.teacher_id), list);
      }
    }
    for (const [tid, list] of overdueByTeacher) {
      const titles = Array.from(new Set(list.map((x) => x.o.parent_title))).slice(0, 3);
      const teacherName = names.teacher.get(tid)?.name || `Teacher #${tid}`;
      if (list.some((x) => !x.policy || Number(x.policy.notify_teacher))) {
        await notify([await teacherUserId(tid)], {
          title: 'Grading overdue',
          message: `${list.length} grading item(s) are past the deadline: ${titles.join(', ')}${list.length > titles.length ? '…' : ''}.`,
          priority: 'High'
        });
      }
      if (list.some((x) => !x.policy || Number(x.policy.notify_principal))) {
        await notify(staff, {
          title: `Overdue grading: ${teacherName}`,
          message: `${teacherName} has ${list.length} overdue grading item(s): ${titles.join(', ')}${list.length > titles.length ? '…' : ''}. Open Teachers → Academic Performance for details.`,
          priority: 'High'
        });
      }
      await db('teacher_grading_obligations').whereIn('id', list.map((x) => x.o.id)).update({ overdue_notified_at: now });
    }

    // Monthly targets: reminder 5 days before month end (teacher), missed month (teacher + principal)
    const { start, end } = monthBounds(period);
    const today = schoolDate(now);
    if (daysBetween(today, end) <= 5) {
      const work = await getWorkItems(start, end, { includeDrafts: true });
      const open = await db('teacher_work_requirements').where({ period, is_closed: 0, is_excused: 0 }).whereNull('reminder_sent_at');
      for (const r of open) {
        const v = this.requirementView(r, work, period);
        const remaining = Object.entries(v.categories).filter(([, c]) => c.remaining > 0).map(([k, c]) => `${c.remaining} ${k}`);
        const policy = policies.get(Number(r.policy_id));
        if (remaining.length && (!policy || Number(policy.notify_teacher))) {
          await notify([await teacherUserId(r.teacher_id)], {
            title: 'Monthly academic work due soon',
            message: `${names.klass.get(Number(r.class_id)) || 'Class'} · ${names.subject.get(Number(r.subject_id)) || 'Subject'}: ${remaining.join(', ')} still to publish by ${end}.`,
            relatedRecordId: r.id
          });
        }
        await db('teacher_work_requirements').where({ id: r.id }).update({ reminder_sent_at: now });
      }
    }

    const missed = await db('teacher_work_requirements').where({ is_closed: 1, is_excused: 0 }).whereNull('missed_notified_at');
    const missedByTeacher = new Map();
    for (const r of missed) {
      const short = [
        ['quizzes', r.required_quizzes, r.final_quizzes],
        ['assignments', r.required_assignments, r.final_assignments],
        ['tests', r.required_tests, r.final_tests]
      ].filter(([, req, fin]) => Number(fin) < Number(req)).map(([k, req, fin]) => `${Number(req) - Number(fin)} ${k}`);
      if (short.length) {
        const list = missedByTeacher.get(Number(r.teacher_id)) || [];
        list.push(`${names.klass.get(Number(r.class_id)) || 'Class'} ${names.subject.get(Number(r.subject_id)) || ''} (${r.period}): ${short.join(', ')}`);
        missedByTeacher.set(Number(r.teacher_id), list);
      }
      await db('teacher_work_requirements').where({ id: r.id }).update({ missed_notified_at: now });
    }
    for (const [tid, list] of missedByTeacher) {
      const teacherName = names.teacher.get(tid)?.name || `Teacher #${tid}`;
      await notify([await teacherUserId(tid)], { title: 'Monthly academic target missed', message: list.join('; '), priority: 'High' });
      await notify(staff, { title: `Monthly target missed: ${teacherName}`, message: list.join('; '), priority: 'High' });
    }

    return { ok: true };
  },

  async closeMonth(period) {
    return closePeriod(period);
  }
};
