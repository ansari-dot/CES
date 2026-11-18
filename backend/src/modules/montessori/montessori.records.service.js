/**
 * Montessori daily records: attendance, learning activities, development progress,
 * reports, dashboards and the parent view.
 *
 * Teachers act only on sections they are actively assigned to; staff may read
 * everything and correct attendance. Corrections keep the previous values in
 * history tables; progress observations are appended, never overwritten.
 */
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { db } from '../../shared/db/knex.js';
import { UPLOAD_ROOT } from '../../shared/storage/upload.js';
import { notificationService } from '../../shared/services/notificationService.js';
import {
  assertSectionAccess,
  assertCanViewStudent,
  assertParentLink,
  teacherSectionIds,
  allocatedOn,
  forbidden,
  invalid,
  notFound,
  parseZod,
  schoolToday,
  isStaff
} from './montessori.access.js';

export const ATTENDANCE_STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'LEAVE'];
export const PROGRESS_STATUSES = ['EXCELLENT', 'COMPLETED', 'IMPROVING', 'NEEDS_PRACTICE', 'NOT_STARTED'];
const TEACHER_CORRECTION_DAYS = 7;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must be YYYY-MM-DD.');

function daysBetween(a, b) {
  return Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
}

function dateRange(query) {
  const from = isoDate.safeParse(query.from).success ? query.from : null;
  const to = isoDate.safeParse(query.to).success ? query.to : null;
  return { from, to };
}

/** Section ids the user may read (null = all, for staff). */
async function readableSectionIds(user) {
  if (isStaff(user)) return null;
  const { sectionIds } = await teacherSectionIds(user);
  if (user.role !== 'TEACHER') throw forbidden();
  return [...sectionIds];
}

// ---------------------------------------------------------------------------
// Teacher: my sections
// ---------------------------------------------------------------------------
export async function mySections(user) {
  const { teacher, sectionIds } = await teacherSectionIds(user);
  if (!teacher || !sectionIds.size) return [];
  const rows = await db('montessori_teacher_assignments as a')
    .join('montessori_sections as s', 'a.section_id', 's.id')
    .join('academic_sessions as ac', 's.session_id', 'ac.id')
    .where('a.teacher_id', teacher.id)
    .whereNull('a.ended_at')
    .where('s.is_active', 1)
    .select('s.id', 's.name', 's.description', 'ac.name as session_name', 'a.role', 'a.start_date')
    .orderBy('s.display_order');
  const today = schoolToday();
  const out = [];
  for (const r of rows) {
    const students = await allocatedOn(r.id, today);
    const marked = await db('montessori_attendance').where({ section_id: r.id, attendance_date: today }).count('id as n').first();
    out.push({
      id: r.id,
      name: r.name,
      description: r.description,
      sessionName: r.session_name,
      role: r.role,
      since: r.start_date,
      studentCount: students.length,
      attendanceMarkedToday: Number(marked.n) > 0
    });
  }
  return out;
}

export async function sectionStudents(user, sectionId) {
  await assertSectionAccess(user, sectionId);
  return allocatedOn(sectionId, schoolToday());
}

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------
export async function attendanceRoster(user, sectionId, date) {
  const day = isoDate.safeParse(date).success ? date : schoolToday();
  const { section } = await assertSectionAccess(user, sectionId);
  const [students, rows] = await Promise.all([
    allocatedOn(section.id, day),
    db('montessori_attendance as a').leftJoin('users as u', 'a.updated_by', 'u.id').where({ 'a.section_id': section.id, 'a.attendance_date': day }).select('a.*', 'u.full_name as updated_by_name')
  ]);
  const byStudent = new Map(rows.map((r) => [Number(r.student_id), r]));
  return {
    section: { id: section.id, name: section.name, isActive: Boolean(section.is_active) },
    date: day,
    isMarked: rows.length > 0,
    canEdit: canEditAttendance(user, day),
    students: students.map((s) => {
      const a = byStudent.get(Number(s.studentId));
      return { ...s, attendanceId: a?.id || null, status: a?.status || null, remarks: a?.remarks || null, updatedBy: a?.updated_by_name || null };
    })
  };
}

function canEditAttendance(user, day) {
  const today = schoolToday();
  if (day > today) return false;
  if (isStaff(user)) return true;
  return daysBetween(day, today) <= TEACHER_CORRECTION_DAYS;
}

const attendanceSchema = z.object({
  date: isoDate,
  reason: z.string().trim().max(300).optional(),
  records: z
    .array(
      z.object({
        studentId: z.coerce.number().int().positive(),
        status: z.enum(ATTENDANCE_STATUSES),
        remarks: z.string().trim().max(255).optional().nullable()
      })
    )
    .min(1, 'Mark at least one student.')
    .max(300)
});

/** Save (or correct) a day's attendance for a section. Corrections are logged with the previous value. */
export async function saveAttendance(user, sectionId, body) {
  const v = parseZod(attendanceSchema, body);
  const { section } = await assertSectionAccess(user, sectionId);
  if (!section.is_active) throw invalid('This section is inactive.');
  const today = schoolToday();
  if (v.date > today) throw invalid('Attendance cannot be marked for a future date.');
  if (!canEditAttendance(user, v.date)) {
    throw forbidden(`Teachers can mark or correct attendance for the last ${TEACHER_CORRECTION_DAYS} days only. Ask the Principal to correct older records.`);
  }
  const roster = new Set((await allocatedOn(section.id, v.date)).map((s) => Number(s.studentId)));
  const outside = v.records.filter((r) => !roster.has(Number(r.studentId))).map((r) => r.studentId);
  if (outside.length) throw invalid('Some students are not allocated to this section on that date. No attendance was saved.', { studentIds: outside });
  const ids = v.records.map((r) => Number(r.studentId));
  if (new Set(ids).size !== ids.length) throw invalid('Each student can appear only once.');

  let created = 0;
  let corrected = 0;
  await db.transaction(async (trx) => {
    const existing = await trx('montessori_attendance').whereIn('student_id', ids).where({ attendance_date: v.date }).forUpdate();
    const byStudent = new Map(existing.map((e) => [Number(e.student_id), e]));
    for (const r of v.records) {
      const prev = byStudent.get(Number(r.studentId));
      const remarks = r.remarks || null;
      if (!prev) {
        await trx('montessori_attendance').insert({
          section_id: section.id,
          student_id: r.studentId,
          session_id: section.session_id,
          attendance_date: v.date,
          status: r.status,
          remarks,
          marked_by: user.id,
          updated_by: user.id
        });
        created++;
      } else if (prev.status !== r.status || (prev.remarks || null) !== remarks) {
        if (Number(prev.section_id) !== Number(section.id) && !isStaff(user)) {
          throw forbidden('Attendance for one of these students was recorded by another section that day.');
        }
        await trx('montessori_attendance_history').insert({
          attendance_id: prev.id,
          previous_status: prev.status,
          new_status: r.status,
          previous_remarks: prev.remarks,
          new_remarks: remarks,
          reason: v.reason || null,
          changed_by: user.id
        });
        await trx('montessori_attendance').where({ id: prev.id }).update({ status: r.status, remarks, updated_by: user.id, section_id: section.id });
        corrected++;
      }
    }
  });
  return { created, corrected, roster: await attendanceRoster(user, section.id, v.date) };
}

/** Student-wise and day-wise attendance summary for a section (or one student). */
export async function attendanceReport(user, query = {}) {
  const readable = await readableSectionIds(user);
  const { from, to } = dateRange(query);
  let q = db('montessori_attendance as a')
    .join('students as s', 'a.student_id', 's.id')
    .join('users as u', 's.user_id', 'u.id')
    .join('montessori_sections as ms', 'a.section_id', 'ms.id');
  if (query.sectionId) {
    await assertSectionAccess(user, query.sectionId);
    q = q.where('a.section_id', Number(query.sectionId));
  } else if (readable) {
    if (!readable.length) return { students: [], days: [], totals: emptyTotals() };
    q = q.whereIn('a.section_id', readable);
  }
  if (query.studentId) q = q.where('a.student_id', Number(query.studentId));
  if (from) q = q.where('a.attendance_date', '>=', from);
  if (to) q = q.where('a.attendance_date', '<=', to);
  const rows = await q.select('a.student_id', 'u.full_name', 'a.status', 'a.attendance_date', 'ms.name as section_name', 'a.section_id').orderBy('a.attendance_date', 'desc');

  const students = new Map();
  const days = new Map();
  const totals = emptyTotals();
  for (const r of rows) {
    const s = students.get(r.student_id) || { studentId: r.student_id, name: r.full_name, sectionName: r.section_name, ...emptyTotals() };
    s[r.status]++;
    s.total++;
    students.set(r.student_id, s);
    const d = days.get(r.attendance_date) || { date: r.attendance_date, ...emptyTotals() };
    d[r.status]++;
    d.total++;
    days.set(r.attendance_date, d);
    totals[r.status]++;
    totals.total++;
  }
  const withRate = (o) => ({ ...o, attendanceRate: o.total ? Math.round(((o.PRESENT + o.LATE) / o.total) * 1000) / 10 : null });
  return {
    students: [...students.values()].map(withRate).sort((a, b) => a.name.localeCompare(b.name)),
    days: [...days.values()].map(withRate),
    totals: withRate(totals),
    records: query.studentId ? rows.map((r) => ({ date: r.attendance_date, status: r.status, sectionName: r.section_name })) : undefined
  };
}

function emptyTotals() {
  return { PRESENT: 0, ABSENT: 0, LATE: 0, LEAVE: 0, total: 0 };
}

// ---------------------------------------------------------------------------
// Learning activities
// ---------------------------------------------------------------------------
const activitySchema = z.object({
  sectionId: z.coerce.number().int().positive(),
  learningAreaId: z.coerce.number().int().positive(),
  title: z.string().trim().min(2, 'Activity title is required.').max(150),
  description: z.string().trim().max(4000).optional().nullable(),
  objectives: z.string().trim().max(4000).optional().nullable(),
  activityDate: isoDate,
  attachmentUrl: z.string().trim().max(500).optional().nullable(),
  attachmentName: z.string().trim().max(255).optional().nullable()
});

/** Attachments reuse the existing uploads endpoint; only those URLs (with a real file) are accepted. */
function validateAttachment(url) {
  if (!url) return null;
  const m = /^\/api\/v1\/uploads\/([A-Za-z0-9._-]+)$/.exec(url);
  if (!m || !fs.existsSync(path.join(UPLOAD_ROOT, m[1]))) throw invalid('Attach the file through the upload button before saving.');
  return url;
}

function toActivity(a) {
  return {
    id: a.id,
    sectionId: a.section_id,
    sectionName: a.section_name,
    learningAreaId: a.learning_area_id,
    learningAreaName: a.area_name,
    title: a.title,
    description: a.description,
    objectives: a.objectives,
    activityDate: a.activity_date,
    attachmentUrl: a.attachment_url,
    attachmentName: a.attachment_name,
    status: a.status,
    teacherName: a.teacher_name,
    progressCount: a.progress_count != null ? Number(a.progress_count) : undefined,
    updatedAt: a.updated_at
  };
}

function activityQuery() {
  return db('montessori_activities as a')
    .join('montessori_sections as s', 'a.section_id', 's.id')
    .join('montessori_learning_areas as la', 'a.learning_area_id', 'la.id')
    .leftJoin('teachers as t', 'a.teacher_id', 't.id')
    .leftJoin('users as u', 't.user_id', 'u.id')
    .select(
      'a.*',
      's.name as section_name',
      'la.name as area_name',
      'u.full_name as teacher_name',
      db.raw('(SELECT COUNT(*) FROM montessori_progress_records p WHERE p.activity_id = a.id) as progress_count')
    );
}

export async function listActivities(user, query = {}) {
  const readable = await readableSectionIds(user);
  const { from, to } = dateRange(query);
  let q = activityQuery();
  if (query.sectionId) {
    await assertSectionAccess(user, query.sectionId);
    q = q.where('a.section_id', Number(query.sectionId));
  } else if (readable) {
    if (!readable.length) return { items: [], total: 0, page: 1, limit: 20 };
    q = q.whereIn('a.section_id', readable);
  }
  if (query.learningAreaId) q = q.where('a.learning_area_id', Number(query.learningAreaId));
  if (query.status && ['ACTIVE', 'ARCHIVED'].includes(query.status)) q = q.where('a.status', query.status);
  else if (!query.status) q = q.where('a.status', 'ACTIVE');
  if (query.search) q = q.where('a.title', 'like', `%${String(query.search).slice(0, 100)}%`);
  if (from) q = q.where('a.activity_date', '>=', from);
  if (to) q = q.where('a.activity_date', '<=', to);
  const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
  const page = Math.max(Number(query.page) || 1, 1);
  const total = Number((await q.clone().clearSelect().count('a.id as n').first()).n);
  const rows = await q.orderBy('a.activity_date', 'desc').orderBy('a.id', 'desc').limit(limit).offset((page - 1) * limit);
  return { items: rows.map(toActivity), total, page, limit };
}

async function loadActivityForWrite(user, id) {
  const a = await db('montessori_activities').where({ id: Number(id) }).first();
  if (!a) throw notFound('Activity not found.');
  const { teacher } = await assertSectionAccess(user, a.section_id);
  if (!teacher) throw forbidden('Activities are managed by the section’s assigned teachers.');
  return { activity: a, teacher };
}

export async function createActivity(user, body) {
  const v = parseZod(activitySchema, body);
  const { section, teacher } = await assertSectionAccess(user, v.sectionId);
  if (!teacher) throw forbidden('Activities are created by the section’s assigned teachers.');
  if (!section.is_active) throw invalid('This section is inactive.');
  const area = await db('montessori_learning_areas').where({ id: v.learningAreaId, is_active: 1 }).first();
  if (!area) throw invalid('Select an active learning area.');
  const [id] = await db('montessori_activities').insert({
    section_id: section.id,
    session_id: section.session_id,
    learning_area_id: area.id,
    title: v.title,
    description: v.description || null,
    objectives: v.objectives || null,
    activity_date: v.activityDate,
    attachment_url: validateAttachment(v.attachmentUrl),
    attachment_name: v.attachmentUrl ? v.attachmentName || 'Attachment' : null,
    teacher_id: teacher.id,
    created_by: user.id,
    updated_by: user.id
  });
  return toActivity(await activityQuery().where('a.id', id).first());
}

export async function updateActivity(user, id, body) {
  const { activity } = await loadActivityForWrite(user, id);
  if (activity.status === 'ARCHIVED') throw invalid('Restore the activity before editing it.');
  const v = parseZod(activitySchema.omit({ sectionId: true }).partial(), body);
  const row = { updated_by: user.id };
  if (v.learningAreaId !== undefined) {
    const area = await db('montessori_learning_areas').where({ id: v.learningAreaId, is_active: 1 }).first();
    if (!area) throw invalid('Select an active learning area.');
    row.learning_area_id = area.id;
  }
  if (v.title !== undefined) row.title = v.title;
  if (v.description !== undefined) row.description = v.description || null;
  if (v.objectives !== undefined) row.objectives = v.objectives || null;
  if (v.activityDate !== undefined) row.activity_date = v.activityDate;
  if (v.attachmentUrl !== undefined) {
    row.attachment_url = validateAttachment(v.attachmentUrl);
    row.attachment_name = v.attachmentUrl ? v.attachmentName || 'Attachment' : null;
  }
  await db('montessori_activities').where({ id: activity.id }).update(row);
  return toActivity(await activityQuery().where('a.id', activity.id).first());
}

export async function setActivityStatus(user, id, status) {
  if (!['ACTIVE', 'ARCHIVED'].includes(status)) throw invalid('Status must be ACTIVE or ARCHIVED.');
  const { activity } = await loadActivityForWrite(user, id);
  await db('montessori_activities').where({ id: activity.id }).update({ status, updated_by: user.id });
  return toActivity(await activityQuery().where('a.id', activity.id).first());
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------
const progressItem = z.object({
  studentId: z.coerce.number().int().positive(),
  status: z.enum(PROGRESS_STATUSES),
  remarks: z.string().trim().max(1000).optional().nullable(),
  improvementSuggestions: z.string().trim().max(1000).optional().nullable(),
  observationNotes: z.string().trim().max(1000).optional().nullable(),
  completionDate: isoDate.optional().nullable()
});

function toProgress(p) {
  return {
    id: p.id,
    studentId: p.student_id,
    studentName: p.student_name,
    sectionId: p.section_id,
    sectionName: p.section_name,
    activityId: p.activity_id,
    activityTitle: p.activity_title,
    learningAreaName: p.area_name,
    status: p.status,
    remarks: p.remarks,
    improvementSuggestions: p.improvement_suggestions,
    observationNotes: p.observation_notes,
    completionDate: p.completion_date,
    observedOn: p.observed_on,
    teacherName: p.teacher_name,
    sessionName: p.session_name,
    corrected: p.correction_count != null ? Number(p.correction_count) > 0 : undefined,
    createdAt: p.created_at
  };
}

function progressQuery() {
  return db('montessori_progress_records as p')
    .join('students as s', 'p.student_id', 's.id')
    .join('users as su', 's.user_id', 'su.id')
    .join('montessori_sections as ms', 'p.section_id', 'ms.id')
    .join('montessori_activities as a', 'p.activity_id', 'a.id')
    .join('montessori_learning_areas as la', 'a.learning_area_id', 'la.id')
    .join('academic_sessions as ac', 'p.session_id', 'ac.id')
    .leftJoin('teachers as t', 'p.teacher_id', 't.id')
    .leftJoin('users as tu', 't.user_id', 'tu.id')
    .select(
      'p.*',
      'su.full_name as student_name',
      'ms.name as section_name',
      'a.title as activity_title',
      'la.name as area_name',
      'tu.full_name as teacher_name',
      'ac.name as session_name',
      db.raw('(SELECT COUNT(*) FROM montessori_progress_history h WHERE h.progress_id = p.id) as correction_count')
    );
}

/** Record observations for one activity (one or many students). Each call appends new records. */
export async function recordProgress(user, body) {
  const v = parseZod(
    z.object({ activityId: z.coerce.number().int().positive(), observedOn: isoDate.optional(), records: z.array(progressItem).min(1).max(300) }),
    body
  );
  const activity = await db('montessori_activities').where({ id: v.activityId }).first();
  if (!activity) throw notFound('Activity not found.');
  if (activity.status !== 'ACTIVE') throw invalid('This activity is archived.');
  const { section, teacher } = await assertSectionAccess(user, activity.section_id);
  if (!teacher) throw forbidden('Progress is recorded by the section’s assigned teachers.');
  const observedOn = v.observedOn || schoolToday();
  if (observedOn > schoolToday()) throw invalid('Observation date cannot be in the future.');
  const roster = new Set((await allocatedOn(section.id, observedOn)).map((s) => Number(s.studentId)));
  const outside = v.records.filter((r) => !roster.has(Number(r.studentId))).map((r) => r.studentId);
  if (outside.length) throw invalid('Some students are not allocated to this section. No progress was saved.', { studentIds: outside });

  const ids = await db.transaction(async (trx) => {
    const out = [];
    for (const r of v.records) {
      const [id] = await trx('montessori_progress_records').insert({
        student_id: r.studentId,
        section_id: section.id,
        activity_id: activity.id,
        session_id: activity.session_id,
        teacher_id: teacher.id,
        status: r.status,
        remarks: r.remarks || null,
        improvement_suggestions: r.improvementSuggestions || null,
        observation_notes: r.observationNotes || null,
        completion_date: r.completionDate || (['COMPLETED', 'EXCELLENT'].includes(r.status) ? observedOn : null),
        observed_on: observedOn,
        recorded_by: user.id,
        updated_by: user.id
      });
      out.push(id);
    }
    return out;
  });

  // Let linked parents know a teacher shared new progress (one notice per child)
  notifyParentsOfProgress(ids).catch(() => {});
  return (await progressQuery().whereIn('p.id', ids)).map(toProgress);
}

async function notifyParentsOfProgress(progressIds) {
  const rows = await db('montessori_progress_records as p')
    .join('montessori_activities as a', 'p.activity_id', 'a.id')
    .join('parent_student as ps', 'ps.student_id', 'p.student_id')
    .join('parents as pa', 'ps.parent_id', 'pa.id')
    .join('students as s', 'p.student_id', 's.id')
    .join('users as u', 's.user_id', 'u.id')
    .whereIn('p.id', progressIds)
    .select('p.id', 'pa.user_id', 'u.full_name', 'a.title');
  for (const r of rows) {
    await notificationService.notifyUsers([r.user_id], {
      title: `Montessori Progress: ${r.full_name}`,
      message: `The teacher recorded progress for ${r.full_name} in "${r.title}".`,
      type: 'Result Published',
      relatedRecordId: r.id,
      relatedRecordType: 'MontessoriProgress',
      priority: 'Low'
    });
  }
}

/** Correct a progress record; the previous values are kept in montessori_progress_history. */
export async function correctProgress(user, id, body) {
  const v = parseZod(progressItem.omit({ studentId: true }).partial().extend({ reason: z.string().trim().min(3, 'Enter the reason for this correction.').max(300) }), body);
  const record = await db('montessori_progress_records').where({ id: Number(id) }).first();
  if (!record) throw notFound('Progress record not found.');
  await assertSectionAccess(user, record.section_id);
  const row = { updated_by: user.id };
  if (v.status !== undefined) row.status = v.status;
  if (v.remarks !== undefined) row.remarks = v.remarks || null;
  if (v.improvementSuggestions !== undefined) row.improvement_suggestions = v.improvementSuggestions || null;
  if (v.observationNotes !== undefined) row.observation_notes = v.observationNotes || null;
  if (v.completionDate !== undefined) row.completion_date = v.completionDate || null;
  await db.transaction(async (trx) => {
    await trx('montessori_progress_history').insert({
      progress_id: record.id,
      previous_values: JSON.stringify({
        status: record.status,
        remarks: record.remarks,
        improvementSuggestions: record.improvement_suggestions,
        observationNotes: record.observation_notes,
        completionDate: record.completion_date
      }),
      reason: v.reason,
      changed_by: user.id
    });
    await trx('montessori_progress_records').where({ id: record.id }).update(row);
  });
  return toProgress(await progressQuery().where('p.id', record.id).first());
}

export async function progressHistoryOf(user, progressId) {
  const record = await db('montessori_progress_records').where({ id: Number(progressId) }).first();
  if (!record) throw notFound('Progress record not found.');
  await assertSectionAccess(user, record.section_id);
  const rows = await db('montessori_progress_history as h').leftJoin('users as u', 'h.changed_by', 'u.id').where('h.progress_id', record.id).orderBy('h.id').select('h.*', 'u.full_name');
  return rows.map((h) => ({ id: h.id, previousValues: typeof h.previous_values === 'string' ? JSON.parse(h.previous_values) : h.previous_values, reason: h.reason, changedBy: h.full_name, at: h.created_at }));
}

export async function listProgress(user, query = {}) {
  const readable = await readableSectionIds(user);
  const { from, to } = dateRange(query);
  let q = progressQuery();
  if (query.studentId) {
    await assertCanViewStudent(user, query.studentId);
    q = q.where('p.student_id', Number(query.studentId));
    if (readable) q = q.whereIn('p.section_id', readable.length ? readable : [0]);
  } else if (query.sectionId) {
    await assertSectionAccess(user, query.sectionId);
    q = q.where('p.section_id', Number(query.sectionId));
  } else if (readable) {
    if (!readable.length) return { items: [], total: 0, page: 1, limit: 30 };
    q = q.whereIn('p.section_id', readable);
  }
  if (query.activityId) q = q.where('p.activity_id', Number(query.activityId));
  if (query.status && PROGRESS_STATUSES.includes(query.status)) q = q.where('p.status', query.status);
  if (from) q = q.where('p.observed_on', '>=', from);
  if (to) q = q.where('p.observed_on', '<=', to);
  const limit = Math.min(Math.max(Number(query.limit) || 30, 1), 200);
  const page = Math.max(Number(query.page) || 1, 1);
  const total = Number((await q.clone().clearSelect().count('p.id as n').first()).n);
  const rows = await q.orderBy('p.observed_on', 'desc').orderBy('p.id', 'desc').limit(limit).offset((page - 1) * limit);
  return { items: rows.map(toProgress), total, page, limit };
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
const latestPerStudentActivity = (rows) => {
  const latest = new Map();
  for (const r of rows) {
    const key = `${r.student_id}:${r.activity_id}`;
    const cur = latest.get(key);
    if (!cur || r.observed_on > cur.observed_on || (r.observed_on === cur.observed_on && r.id > cur.id)) latest.set(key, r);
  }
  return [...latest.values()];
};

export async function sectionReport(user, sectionId, query = {}) {
  const { section } = await assertSectionAccess(user, sectionId);
  const { from, to } = dateRange(query);
  const range = (q, col) => {
    if (from) q = q.where(col, '>=', from);
    if (to) q = q.where(col, '<=', to);
    return q;
  };
  const [sessionRow, teachers, students, attendance, activities, progress] = await Promise.all([
    db('academic_sessions').where({ id: section.session_id }).first('name'),
    db('montessori_teacher_assignments as a').join('teachers as t', 'a.teacher_id', 't.id').join('users as u', 't.user_id', 'u.id').where('a.section_id', section.id).whereNull('a.ended_at').select('a.role', 'u.full_name'),
    allocatedOn(section.id, to || schoolToday()),
    attendanceReport(user, { sectionId: section.id, from, to }),
    range(db('montessori_activities as a').join('montessori_learning_areas as la', 'a.learning_area_id', 'la.id').where('a.section_id', section.id), 'a.activity_date').select('a.id', 'a.status', 'la.name as area_name'),
    range(db('montessori_progress_records').where({ section_id: section.id }), 'observed_on').select('id', 'student_id', 'activity_id', 'status', 'observed_on')
  ]);
  const latest = latestPerStudentActivity(progress);
  const statusCounts = Object.fromEntries(PROGRESS_STATUSES.map((s) => [s, latest.filter((p) => p.status === s).length]));
  const areaCounts = {};
  for (const a of activities) areaCounts[a.area_name] = (areaCounts[a.area_name] || 0) + 1;
  const attendanceBy = new Map(attendance.students.map((s) => [Number(s.studentId), s]));
  return {
    section: { id: section.id, name: section.name, sessionName: sessionRow?.name, isActive: Boolean(section.is_active) },
    period: { from, to },
    teachers: teachers.map((t) => ({ name: t.full_name, role: t.role })),
    totals: {
      students: students.length,
      activities: activities.length,
      activeActivities: activities.filter((a) => a.status === 'ACTIVE').length,
      progressRecords: progress.length
    },
    attendance: attendance.totals,
    activitiesByArea: Object.entries(areaCounts).map(([area, count]) => ({ area, count })),
    completionOverview: statusCounts,
    students: students.map((s) => {
      const mine = latest.filter((p) => Number(p.student_id) === Number(s.studentId));
      const att = attendanceBy.get(Number(s.studentId));
      return {
        studentId: s.studentId,
        name: s.name,
        admissionNo: s.admissionNo,
        attendanceRate: att?.attendanceRate ?? null,
        daysRecorded: att?.total || 0,
        completed: mine.filter((p) => ['COMPLETED', 'EXCELLENT'].includes(p.status)).length,
        needsImprovement: mine.filter((p) => ['NEEDS_PRACTICE', 'IMPROVING'].includes(p.status)).length,
        activitiesObserved: mine.length
      };
    })
  };
}

export async function studentReport(user, studentId, query = {}) {
  const student = await assertCanViewStudent(user, studentId);
  const { from, to } = dateRange(query);
  const readable = await (user.role === 'PARENT' ? Promise.resolve(null) : readableSectionIds(user));
  const info = await db('students as s')
    .join('users as u', 's.user_id', 'u.id')
    .leftJoin('classes as c', 's.current_class_id', 'c.id')
    .where('s.id', student.id)
    .first('s.id', 'u.full_name', 's.admission_no', 's.roll_no', 's.date_of_birth', 'c.name as class_name');
  const current = await db('montessori_student_allocations as al')
    .join('montessori_sections as s', 'al.section_id', 's.id')
    .join('academic_sessions as ac', 'al.session_id', 'ac.id')
    .where('al.student_id', student.id)
    .whereNull('al.ended_at')
    .first('s.id', 's.name', 'ac.name as session_name', 'al.start_date');
  const teachers = current
    ? await db('montessori_teacher_assignments as a').join('teachers as t', 'a.teacher_id', 't.id').join('users as u', 't.user_id', 'u.id').where('a.section_id', current.id).whereNull('a.ended_at').select('a.role', 'u.full_name')
    : [];

  let pq = progressQuery().where('p.student_id', student.id);
  if (readable) pq = pq.whereIn('p.section_id', readable.length ? readable : [0]);
  if (from) pq = pq.where('p.observed_on', '>=', from);
  if (to) pq = pq.where('p.observed_on', '<=', to);
  const progressRows = await pq.orderBy('p.observed_on', 'desc').orderBy('p.id', 'desc');
  const latest = latestPerStudentActivity(progressRows);

  let aq = db('montessori_attendance').where({ student_id: student.id });
  if (readable) aq = aq.whereIn('section_id', readable.length ? readable : [0]);
  if (from) aq = aq.where('attendance_date', '>=', from);
  if (to) aq = aq.where('attendance_date', '<=', to);
  const att = await aq.select('status', 'attendance_date').orderBy('attendance_date', 'desc');
  const totals = emptyTotals();
  for (const a of att) {
    totals[a.status]++;
    totals.total++;
  }
  totals.attendanceRate = totals.total ? Math.round(((totals.PRESENT + totals.LATE) / totals.total) * 1000) / 10 : null;

  return {
    student: { id: info.id, name: info.full_name, admissionNo: info.admission_no, rollNo: info.roll_no, regularClassName: info.class_name },
    currentSection: current ? { id: current.id, name: current.name, sessionName: current.session_name, since: current.start_date } : null,
    teachers: teachers.map((t) => ({ name: t.full_name, role: t.role })),
    period: { from, to },
    attendance: { ...totals, recent: att.slice(0, 31).map((a) => ({ date: a.attendance_date, status: a.status })) },
    completedActivities: latest.filter((p) => ['COMPLETED', 'EXCELLENT'].includes(p.status)).map(toProgress),
    needsImprovement: latest.filter((p) => ['NEEDS_PRACTICE', 'IMPROVING', 'NOT_STARTED'].includes(p.status)).map(toProgress),
    observations: progressRows.filter((p) => p.observation_notes || p.remarks).slice(0, 50).map(toProgress),
    history: progressRows.map(toProgress)
  };
}

// ---------------------------------------------------------------------------
// Principal dashboard
// ---------------------------------------------------------------------------
export async function dashboard({ sessionId = null } = {}) {
  const sid = sessionId || (await db('academic_sessions').where({ is_current: 1 }).first('id'))?.id || null;
  const today = schoolToday();
  let sq = db('montessori_sections').where('is_active', 1);
  if (sid) sq = sq.where('session_id', sid);
  const sections = await sq.orderBy('display_order');
  const ids = sections.map((s) => s.id);
  const none = ids.length ? ids : [0];
  const [students, teachers, todayAtt, recentActivities, recentProgress] = await Promise.all([
    db('montessori_student_allocations').whereIn('section_id', none).whereNull('ended_at').groupBy('section_id').select('section_id').count('id as n'),
    db('montessori_teacher_assignments').whereIn('section_id', none).whereNull('ended_at').select('section_id', 'teacher_id', 'role'),
    db('montessori_attendance').whereIn('section_id', none).where('attendance_date', today).groupBy('section_id', 'status').select('section_id', 'status').count('id as n'),
    activityQuery().whereIn('a.section_id', none).where('a.status', 'ACTIVE').orderBy('a.activity_date', 'desc').orderBy('a.id', 'desc').limit(8),
    progressQuery().whereIn('p.section_id', none).orderBy('p.id', 'desc').limit(10)
  ]);
  const needs = latestPerStudentActivity(
    await db('montessori_progress_records')
      .whereIn('section_id', none)
      .where('observed_on', '>=', new Date(Date.now() - 45 * 86400000).toISOString().slice(0, 10))
      .select('id', 'student_id', 'activity_id', 'status', 'observed_on')
  ).filter((p) => p.status === 'NEEDS_PRACTICE');
  const needIds = needs.slice(0, 50).map((n) => n.id);
  const needRows = needIds.length ? (await progressQuery().whereIn('p.id', needIds).orderBy('p.observed_on', 'desc')).slice(0, 10).map(toProgress) : [];

  const studentCount = new Map(students.map((s) => [Number(s.section_id), Number(s.n)]));
  const att = emptyTotals();
  const attBySection = new Map();
  for (const r of todayAtt) {
    att[r.status] += Number(r.n);
    att.total += Number(r.n);
    const s = attBySection.get(Number(r.section_id)) || emptyTotals();
    s[r.status] += Number(r.n);
    s.total += Number(r.n);
    attBySection.set(Number(r.section_id), s);
  }
  const totalStudents = [...studentCount.values()].reduce((a, b) => a + b, 0);
  return {
    date: today,
    totals: {
      sections: sections.length,
      students: totalStudents,
      teachers: new Set(teachers.map((t) => Number(t.teacher_id))).size,
      sectionsWithoutClassTeacher: sections.filter((s) => !teachers.some((t) => Number(t.section_id) === Number(s.id) && t.role === 'CLASS_TEACHER')).length
    },
    todayAttendance: { ...att, notMarked: Math.max(0, totalStudents - att.total) },
    sections: sections.map((s) => ({
      id: s.id,
      name: s.name,
      students: studentCount.get(Number(s.id)) || 0,
      hasClassTeacher: teachers.some((t) => Number(t.section_id) === Number(s.id) && t.role === 'CLASS_TEACHER'),
      attendanceToday: attBySection.get(Number(s.id)) || emptyTotals()
    })),
    recentActivities: recentActivities.map(toActivity),
    needsPractice: needRows,
    recentProgress: recentProgress.map(toProgress)
  };
}

// ---------------------------------------------------------------------------
// Parent view (read-only, linked children only)
// ---------------------------------------------------------------------------
export async function parentChildren(user) {
  if (user.role !== 'PARENT') throw forbidden();
  const rows = await db('parents as pa')
    .join('parent_student as ps', 'ps.parent_id', 'pa.id')
    .join('montessori_student_allocations as al', function () {
      this.on('al.student_id', '=', 'ps.student_id').andOnNull('al.ended_at');
    })
    .join('montessori_sections as s', 'al.section_id', 's.id')
    .where('pa.user_id', user.id)
    .select('ps.student_id', 's.id as section_id', 's.name as section_name');
  return rows.map((r) => ({ studentId: r.student_id, sectionId: r.section_id, sectionName: r.section_name }));
}

export async function parentChildView(user, studentId, query = {}) {
  await assertParentLink(user, studentId);
  const report = await studentReport(user, studentId, query);
  const recentActivities = report.currentSection
    ? (await activityQuery().where('a.section_id', report.currentSection.id).where('a.status', 'ACTIVE').orderBy('a.activity_date', 'desc').limit(20)).map(toActivity)
    : [];
  return { ...report, recentActivities };
}
