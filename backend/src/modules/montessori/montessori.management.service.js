/**
 * Montessori management (Principal / Admin): sections, learning areas,
 * teacher assignments and student allocations. Every change is audited and
 * history rows are ended, never deleted.
 */
import { z } from 'zod';
import { db } from '../../shared/db/knex.js';
import { getCurrentSessionId } from '../../shared/services/accessScope.js';
import { auditRepository } from '../audit/audit.repository.js';
import { invalid, conflict, notFound, parseZod, schoolToday, MONTESSORI_GRADE_LEVEL } from './montessori.access.js';

const dupError = (err) => err?.code === 'ER_DUP_ENTRY' || err?.errno === 1062;

function yesterday(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

async function audit(trx, user, action, recordType, recordIdentifier, { reason = null, previousValue = null, newValue = null } = {}) {
  await auditRepository.logAction(trx, { actorId: user.id, action, recordType, recordIdentifier, reason, previousValue, newValue });
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------
const sectionSchema = z.object({
  name: z.string().trim().min(2, 'Section name must be at least 2 characters.').max(100),
  description: z.string().trim().max(500).optional().nullable(),
  displayOrder: z.coerce.number().int().min(0).max(100000).optional(),
  sessionId: z.coerce.number().int().positive().optional()
});

export async function listSections({ sessionId = null, includeInactive = false } = {}) {
  const sid = sessionId ? Number(sessionId) : await getCurrentSessionId();
  let q = db('montessori_sections as s')
    .join('academic_sessions as ac', 's.session_id', 'ac.id')
    .select('s.*', 'ac.name as session_name', 'ac.is_current as session_is_current')
    .orderBy([{ column: 's.display_order' }, { column: 's.name' }]);
  if (sid) q = q.where('s.session_id', sid);
  if (!includeInactive) q = q.where('s.is_active', 1);
  const sections = await q;
  if (!sections.length) return [];
  const ids = sections.map((s) => s.id);
  const [counts, teachers] = await Promise.all([
    db('montessori_student_allocations').whereIn('section_id', ids).whereNull('ended_at').groupBy('section_id').select('section_id').count('id as n'),
    db('montessori_teacher_assignments as a')
      .join('teachers as t', 'a.teacher_id', 't.id')
      .join('users as u', 't.user_id', 'u.id')
      .whereIn('a.section_id', ids)
      .whereNull('a.ended_at')
      .select('a.id', 'a.section_id', 'a.role', 'a.teacher_id', 'a.start_date', 'u.full_name')
  ]);
  const countBy = new Map(counts.map((c) => [Number(c.section_id), Number(c.n)]));
  return sections.map((s) => {
    const assigned = teachers.filter((t) => Number(t.section_id) === Number(s.id));
    const classTeacher = assigned.find((t) => t.role === 'CLASS_TEACHER');
    return {
      id: s.id,
      name: s.name,
      description: s.description,
      displayOrder: s.display_order,
      isActive: Boolean(s.is_active),
      sessionId: s.session_id,
      sessionName: s.session_name,
      sessionIsCurrent: Boolean(s.session_is_current),
      studentCount: countBy.get(Number(s.id)) || 0,
      classTeacher: classTeacher ? { assignmentId: classTeacher.id, teacherId: classTeacher.teacher_id, name: classTeacher.full_name, since: classTeacher.start_date } : null,
      assistants: assigned
        .filter((t) => t.role === 'ASSISTANT')
        .map((t) => ({ assignmentId: t.id, teacherId: t.teacher_id, name: t.full_name, since: t.start_date }))
    };
  });
}

export async function createSection(user, body) {
  const v = parseZod(sectionSchema, body);
  const sessionId = v.sessionId || (await getCurrentSessionId());
  if (!sessionId || !(await db('academic_sessions').where({ id: sessionId }).first())) throw invalid('Select a valid academic year.');
  try {
    return await db.transaction(async (trx) => {
      const maxOrder = await trx('montessori_sections').where({ session_id: sessionId }).max('display_order as m').first();
      const [id] = await trx('montessori_sections').insert({
        session_id: sessionId,
        name: v.name,
        description: v.description || null,
        display_order: v.displayOrder ?? Number(maxOrder?.m || 0) + 10,
        is_active: true,
        created_by: user.id,
        updated_by: user.id
      });
      await audit(trx, user, 'MONTESSORI_SECTION_CREATED', 'montessori_sections', `Section #${id} (${v.name})`, { newValue: { ...v, sessionId } });
      return id;
    });
  } catch (err) {
    if (dupError(err)) throw conflict(`An active section named "${v.name}" already exists in this academic year.`);
    throw err;
  }
}

export async function updateSection(user, id, body) {
  const v = parseZod(sectionSchema.omit({ sessionId: true }).partial(), body);
  const before = await db('montessori_sections').where({ id: Number(id) }).first();
  if (!before) throw notFound('Montessori section not found.');
  const row = {};
  if (v.name !== undefined) row.name = v.name;
  if (v.description !== undefined) row.description = v.description || null;
  if (v.displayOrder !== undefined) row.display_order = v.displayOrder;
  if (!Object.keys(row).length) throw invalid('Nothing to update.');
  try {
    await db.transaction(async (trx) => {
      await trx('montessori_sections').where({ id: before.id }).update({ ...row, updated_by: user.id });
      await audit(trx, user, 'MONTESSORI_SECTION_UPDATED', 'montessori_sections', `Section #${before.id} (${before.name})`, {
        previousValue: { name: before.name, description: before.description, displayOrder: before.display_order },
        newValue: v
      });
    });
  } catch (err) {
    if (dupError(err)) throw conflict(`An active section named "${v.name}" already exists in this academic year.`);
    throw err;
  }
}

/** Deactivate / reactivate. Deactivation requires the section to have no active students or teachers. */
export async function setSectionStatus(user, id, isActive, reason = null) {
  const before = await db('montessori_sections').where({ id: Number(id) }).first();
  if (!before) throw notFound('Montessori section not found.');
  if (Boolean(before.is_active) === Boolean(isActive)) return;
  if (!isActive) {
    const [students, teachers] = await Promise.all([
      db('montessori_student_allocations').where({ section_id: before.id }).whereNull('ended_at').count('id as n').first(),
      db('montessori_teacher_assignments').where({ section_id: before.id }).whereNull('ended_at').count('id as n').first()
    ]);
    if (Number(students.n) || Number(teachers.n)) {
      throw conflict(
        `Move or remove the ${students.n} active student(s) and end the ${teachers.n} active teacher assignment(s) before deactivating this section. Its history is kept.`
      );
    }
  }
  try {
    await db.transaction(async (trx) => {
      await trx('montessori_sections').where({ id: before.id }).update({ is_active: Boolean(isActive), updated_by: user.id });
      await audit(trx, user, isActive ? 'MONTESSORI_SECTION_REACTIVATED' : 'MONTESSORI_SECTION_DEACTIVATED', 'montessori_sections', `Section #${before.id} (${before.name})`, { reason });
    });
  } catch (err) {
    if (dupError(err)) throw conflict(`Another active section is already named "${before.name}" in this academic year. Rename one of them first.`);
    throw err;
  }
}

export async function reorderSections(user, orderedIds) {
  const ids = z.array(z.coerce.number().int().positive()).min(1).max(200).parse(orderedIds || []);
  await db.transaction(async (trx) => {
    for (let i = 0; i < ids.length; i++) {
      await trx('montessori_sections').where({ id: ids[i] }).update({ display_order: (i + 1) * 10, updated_by: user.id });
    }
    await audit(trx, user, 'MONTESSORI_SECTIONS_REORDERED', 'montessori_sections', 'Display order', { newValue: ids });
  });
}

// ---------------------------------------------------------------------------
// Learning areas
// ---------------------------------------------------------------------------
export async function listLearningAreas({ includeInactive = false } = {}) {
  let q = db('montessori_learning_areas').orderBy([{ column: 'display_order' }, { column: 'name' }]);
  if (!includeInactive) q = q.where('is_active', 1);
  return (await q).map((a) => ({ id: a.id, name: a.name, description: a.description, displayOrder: a.display_order, isActive: Boolean(a.is_active) }));
}

export async function saveLearningArea(user, id, body) {
  const schema = z.object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(300).optional().nullable(),
    displayOrder: z.coerce.number().int().min(0).max(100000).optional(),
    isActive: z.boolean().optional()
  });
  const v = parseZod(id ? schema.partial() : schema, body);
  const row = {};
  if (v.name !== undefined) row.name = v.name;
  if (v.description !== undefined) row.description = v.description || null;
  if (v.displayOrder !== undefined) row.display_order = v.displayOrder;
  if (v.isActive !== undefined) row.is_active = v.isActive;
  try {
    return await db.transaction(async (trx) => {
      let areaId = id ? Number(id) : null;
      if (areaId) {
        if (!(await trx('montessori_learning_areas').where({ id: areaId }).first())) throw notFound('Learning area not found.');
        await trx('montessori_learning_areas').where({ id: areaId }).update(row);
      } else {
        [areaId] = await trx('montessori_learning_areas').insert(row);
      }
      await audit(trx, user, id ? 'MONTESSORI_AREA_UPDATED' : 'MONTESSORI_AREA_CREATED', 'montessori_learning_areas', `Area #${areaId}`, { newValue: v });
      return areaId;
    });
  } catch (err) {
    if (dupError(err)) throw conflict('A learning area with this name already exists.');
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Teacher assignments
// ---------------------------------------------------------------------------
/** All CES teachers with their active Montessori assignments (and regular assignment count). */
export async function listTeachers() {
  const today = schoolToday();
  const [teachers, montessori, regular] = await Promise.all([
    db('teachers as t').join('users as u', 't.user_id', 'u.id').select('t.id', 't.employee_no', 't.employment_status', 'u.full_name', 'u.status as account_status').orderBy('u.full_name'),
    db('montessori_teacher_assignments as a')
      .join('montessori_sections as s', 'a.section_id', 's.id')
      .whereNull('a.ended_at')
      .select('a.id', 'a.teacher_id', 'a.role', 'a.section_id', 's.name as section_name', 'a.start_date'),
    db('teacher_assignments')
      .where((q) => q.whereNull('effective_to').orWhere('effective_to', '>=', today))
      .groupBy('teacher_id')
      .select('teacher_id')
      .count('id as n')
  ]);
  const counts = await db('montessori_student_allocations').whereNull('ended_at').groupBy('section_id').select('section_id').count('id as n');
  const studentsBySection = new Map(counts.map((c) => [Number(c.section_id), Number(c.n)]));
  const regularBy = new Map(regular.map((r) => [Number(r.teacher_id), Number(r.n)]));
  return teachers.map((t) => {
    const mine = montessori.filter((a) => Number(a.teacher_id) === Number(t.id));
    return {
      id: t.id,
      name: t.full_name,
      employeeNo: t.employee_no,
      employmentStatus: t.employment_status,
      accountStatus: t.account_status,
      regularAssignmentCount: regularBy.get(Number(t.id)) || 0,
      montessoriAssignments: mine.map((a) => ({
        assignmentId: a.id,
        sectionId: a.section_id,
        sectionName: a.section_name,
        role: a.role,
        since: a.start_date,
        studentCount: studentsBySection.get(Number(a.section_id)) || 0
      }))
    };
  });
}

export async function assignmentHistory({ sectionId = null, teacherId = null } = {}) {
  let q = db('montessori_teacher_assignments as a')
    .join('montessori_sections as s', 'a.section_id', 's.id')
    .join('teachers as t', 'a.teacher_id', 't.id')
    .join('users as u', 't.user_id', 'u.id')
    .leftJoin('users as ab', 'a.assigned_by', 'ab.id')
    .leftJoin('users as eb', 'a.ended_by', 'eb.id')
    .select('a.*', 's.name as section_name', 'u.full_name as teacher_name', 'ab.full_name as assigned_by_name', 'eb.full_name as ended_by_name')
    .orderBy('a.id', 'desc')
    .limit(500);
  if (sectionId) q = q.where('a.section_id', Number(sectionId));
  if (teacherId) q = q.where('a.teacher_id', Number(teacherId));
  return (await q).map((a) => ({
    id: a.id,
    sectionId: a.section_id,
    sectionName: a.section_name,
    teacherId: a.teacher_id,
    teacherName: a.teacher_name,
    role: a.role,
    startDate: a.start_date,
    endDate: a.end_date,
    active: !a.ended_at,
    endReason: a.end_reason,
    assignedBy: a.assigned_by_name,
    endedBy: a.ended_by_name
  }));
}

const assignSchema = z.object({
  teacherId: z.coerce.number().int().positive(),
  role: z.enum(['CLASS_TEACHER', 'ASSISTANT']).default('CLASS_TEACHER'),
  replaceExisting: z.boolean().optional().default(false),
  reason: z.string().trim().max(300).optional()
});

/** Assign a teacher. With replaceExisting, the current class teacher's assignment is ended first (same transaction). */
export async function assignTeacher(user, sectionId, body) {
  const v = parseZod(assignSchema, body);
  const section = await db('montessori_sections').where({ id: Number(sectionId) }).first();
  if (!section) throw notFound('Montessori section not found.');
  if (!section.is_active) throw invalid('Reactivate this section before assigning teachers.');
  const teacher = await db('teachers as t').join('users as u', 't.user_id', 'u.id').where('t.id', v.teacherId).first('t.id', 'u.full_name', 'u.status');
  if (!teacher) throw invalid('Selected teacher does not exist.');
  if (teacher.status === 'DEACTIVATED') throw invalid('This teacher account is deactivated.');
  const today = schoolToday();
  try {
    return await db.transaction(async (trx) => {
      if (v.role === 'CLASS_TEACHER' && v.replaceExisting) {
        const current = await trx('montessori_teacher_assignments').where({ section_id: section.id, role: 'CLASS_TEACHER' }).whereNull('ended_at').forUpdate().first();
        if (current) {
          if (Number(current.teacher_id) === Number(v.teacherId)) throw conflict('This teacher is already the class teacher of this section.');
          await trx('montessori_teacher_assignments').where({ id: current.id }).update({
            ended_at: trx.raw('CURRENT_TIMESTAMP(3)'),
            end_date: today,
            ended_by: user.id,
            end_reason: v.reason || 'Class teacher changed'
          });
        }
      }
      const [id] = await trx('montessori_teacher_assignments').insert({
        section_id: section.id,
        teacher_id: v.teacherId,
        role: v.role,
        start_date: today,
        assigned_by: user.id
      });
      await audit(trx, user, 'MONTESSORI_TEACHER_ASSIGNED', 'montessori_teacher_assignments', `Assignment #${id}`, {
        reason: v.reason || null,
        newValue: { sectionId: section.id, sectionName: section.name, teacherId: v.teacherId, teacherName: teacher.full_name, role: v.role }
      });
      return id;
    });
  } catch (err) {
    if (dupError(err)) {
      const msg = String(err.sqlMessage || err.message);
      if (msg.includes('uq_mont_assign_one_class_teacher')) {
        throw conflict('This section already has a class teacher. Choose "replace" to change the class teacher, or add this teacher as an assistant.');
      }
      throw conflict('This teacher is already assigned to this section.');
    }
    throw err;
  }
}

export async function endAssignment(user, assignmentId, reason) {
  const text = String(reason || '').trim();
  if (text.length < 3) throw invalid('Enter a reason for ending this assignment.');
  await db.transaction(async (trx) => {
    const a = await trx('montessori_teacher_assignments').where({ id: Number(assignmentId) }).forUpdate().first();
    if (!a) throw notFound('Assignment not found.');
    if (a.ended_at) throw conflict('This assignment has already ended.');
    await trx('montessori_teacher_assignments').where({ id: a.id }).update({
      ended_at: trx.raw('CURRENT_TIMESTAMP(3)'),
      end_date: schoolToday(),
      ended_by: user.id,
      end_reason: text.slice(0, 300)
    });
    await audit(trx, user, 'MONTESSORI_TEACHER_UNASSIGNED', 'montessori_teacher_assignments', `Assignment #${a.id}`, { reason: text, previousValue: a });
  });
}

// ---------------------------------------------------------------------------
// Student allocations
// ---------------------------------------------------------------------------
/**
 * Students admitted to the Montessori class level, with their current section allocation
 * (search by name / admission no). Students of Classes 1–8 are not offered; a regular-class
 * student who was allocated before this rule existed stays listed so they can still be managed.
 */
export async function availableStudents({ search = '', unallocatedOnly = false, page = 1, limit = 50 } = {}) {
  let q = db('students as s')
    .join('users as u', 's.user_id', 'u.id')
    .leftJoin('classes as c', 's.current_class_id', 'c.id')
    .leftJoin('montessori_student_allocations as al', function () {
      this.on('al.student_id', '=', 's.id').andOnNull('al.ended_at');
    })
    .leftJoin('montessori_sections as ms', 'al.section_id', 'ms.id')
    .where('s.status', 'ACTIVE')
    .where((w) => w.where('c.grade_level', MONTESSORI_GRADE_LEVEL).orWhereNotNull('al.id'));
  if (search) {
    const term = `%${String(search).trim().slice(0, 100)}%`;
    q = q.where((w) => w.where('u.full_name', 'like', term).orWhere('s.admission_no', 'like', term));
  }
  if (unallocatedOnly) q = q.whereNull('al.id');
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const pg = Math.max(Number(page) || 1, 1);
  const total = Number((await q.clone().count('s.id as n').first()).n);
  const rows = await q
    .select('s.id', 'u.full_name', 's.admission_no', 's.roll_no', 'c.name as class_name', 'al.id as allocation_id', 'ms.id as section_id', 'ms.name as section_name')
    .orderBy('u.full_name')
    .limit(lim)
    .offset((pg - 1) * lim);
  return {
    items: rows.map((r) => ({
      id: r.id,
      name: r.full_name,
      admissionNo: r.admission_no,
      rollNo: r.roll_no,
      regularClassName: r.class_name,
      currentAllocation: r.allocation_id ? { allocationId: r.allocation_id, sectionId: r.section_id, sectionName: r.section_name } : null
    })),
    total,
    page: pg,
    limit: lim
  };
}

const idsSchema = z.array(z.coerce.number().int().positive()).min(1, 'Select at least one student.').max(200);

async function loadActiveStudents(trx, ids, { montessoriOnly = false } = {}) {
  const rows = await trx('students as s')
    .join('users as u', 's.user_id', 'u.id')
    .leftJoin('classes as c', 's.current_class_id', 'c.id')
    .whereIn('s.id', ids)
    .select('s.id', 's.status', 'u.full_name', 'c.grade_level', 'c.name as class_name');
  const byId = new Map(rows.map((r) => [Number(r.id), r]));
  const problems = [];
  for (const id of ids) {
    const r = byId.get(id);
    if (!r) problems.push({ studentId: id, reason: 'Student not found' });
    else if (r.status !== 'ACTIVE') problems.push({ studentId: id, studentName: r.full_name, reason: `Student status is ${r.status}` });
    else if (montessoriOnly && Number(r.grade_level) !== MONTESSORI_GRADE_LEVEL) {
      problems.push({ studentId: id, studentName: r.full_name, reason: `Admitted to ${r.class_name || 'a regular class'}, not Montessori` });
    }
  }
  return { byId, problems };
}

/** Allocate students who have no active Montessori allocation (all-or-nothing). */
export async function allocateStudents(user, sectionId, body) {
  const ids = [...new Set(parseZod(z.object({ studentIds: idsSchema }), body).studentIds.map(Number))];
  const section = await db('montessori_sections').where({ id: Number(sectionId) }).first();
  if (!section) throw notFound('Montessori section not found.');
  if (!section.is_active) throw invalid('This section is inactive.');
  const today = schoolToday();
  try {
    return await db.transaction(async (trx) => {
      const { byId, problems } = await loadActiveStudents(trx, ids, { montessoriOnly: true });
      const active = await trx('montessori_student_allocations as al')
        .join('montessori_sections as s', 'al.section_id', 's.id')
        .whereIn('al.student_id', ids)
        .whereNull('al.ended_at')
        .forUpdate()
        .select('al.student_id', 's.name');
      for (const a of active) {
        problems.push({ studentId: Number(a.student_id), studentName: byId.get(Number(a.student_id))?.full_name, reason: `Already allocated to ${a.name}. Use transfer instead.` });
      }
      if (problems.length) throw invalid(`${problems.length} student(s) cannot be allocated. No changes were made.`, { problems });
      for (const id of ids) {
        await trx('montessori_student_allocations').insert({ student_id: id, section_id: section.id, session_id: section.session_id, start_date: today, allocated_by: user.id });
      }
      await audit(trx, user, 'MONTESSORI_STUDENTS_ALLOCATED', 'montessori_student_allocations', `Section #${section.id} (${section.name})`, { newValue: { studentIds: ids } });
      return { allocated: ids.length };
    });
  } catch (err) {
    if (dupError(err)) throw conflict('One of these students was just allocated by another request. Refresh and try again.');
    throw err;
  }
}

/** Move students from their current section to another (ends the old allocation, keeps history). */
export async function transferStudents(user, body) {
  const v = parseZod(z.object({ studentIds: idsSchema, toSectionId: z.coerce.number().int().positive(), reason: z.string().trim().min(3, 'Enter a reason for the transfer.').max(300) }), body);
  const ids = [...new Set(v.studentIds.map(Number))];
  const target = await db('montessori_sections').where({ id: v.toSectionId }).first();
  if (!target) throw notFound('Target section not found.');
  if (!target.is_active) throw invalid('The target section is inactive.');
  const today = schoolToday();
  return db.transaction(async (trx) => {
    const { byId, problems } = await loadActiveStudents(trx, ids);
    const current = await trx('montessori_student_allocations').whereIn('student_id', ids).whereNull('ended_at').forUpdate();
    const byStudent = new Map(current.map((a) => [Number(a.student_id), a]));
    for (const id of ids) {
      const a = byStudent.get(id);
      if (!a) problems.push({ studentId: id, studentName: byId.get(id)?.full_name, reason: 'Not allocated to any section. Use allocate instead.' });
      else if (Number(a.section_id) === Number(target.id)) problems.push({ studentId: id, studentName: byId.get(id)?.full_name, reason: 'Already in the target section.' });
    }
    if (problems.length) throw invalid(`${problems.length} student(s) cannot be transferred. No changes were made.`, { problems });
    for (const id of ids) {
      const a = byStudent.get(id);
      await trx('montessori_student_allocations').where({ id: a.id }).update({
        ended_at: trx.raw('CURRENT_TIMESTAMP(3)'),
        end_date: yesterday(today),
        end_reason: 'TRANSFERRED',
        ended_by: user.id,
        notes: v.reason
      });
      await trx('montessori_student_allocations').insert({ student_id: id, section_id: target.id, session_id: target.session_id, start_date: today, allocated_by: user.id, notes: v.reason });
    }
    await audit(trx, user, 'MONTESSORI_STUDENTS_TRANSFERRED', 'montessori_student_allocations', `To section #${target.id} (${target.name})`, {
      reason: v.reason,
      newValue: { studentIds: ids, from: ids.map((id) => byStudent.get(id).section_id) }
    });
    return { transferred: ids.length };
  });
}

export async function removeAllocation(user, allocationId, reason) {
  const text = String(reason || '').trim();
  if (text.length < 3) throw invalid('Enter a reason for removing this student from the section.');
  await db.transaction(async (trx) => {
    const a = await trx('montessori_student_allocations').where({ id: Number(allocationId) }).forUpdate().first();
    if (!a) throw notFound('Allocation not found.');
    if (a.ended_at) throw conflict('This allocation has already ended.');
    await trx('montessori_student_allocations').where({ id: a.id }).update({
      ended_at: trx.raw('CURRENT_TIMESTAMP(3)'),
      end_date: yesterday(schoolToday()),
      end_reason: 'REMOVED',
      ended_by: user.id,
      notes: text.slice(0, 300)
    });
    await audit(trx, user, 'MONTESSORI_STUDENT_REMOVED', 'montessori_student_allocations', `Allocation #${a.id}`, { reason: text, previousValue: a });
  });
}

export async function studentAllocationHistory(studentId) {
  const rows = await db('montessori_student_allocations as al')
    .join('montessori_sections as s', 'al.section_id', 's.id')
    .join('academic_sessions as ac', 'al.session_id', 'ac.id')
    .leftJoin('users as ab', 'al.allocated_by', 'ab.id')
    .where('al.student_id', Number(studentId))
    .orderBy('al.id', 'desc')
    .select('al.*', 's.name as section_name', 'ac.name as session_name', 'ab.full_name as allocated_by_name');
  return rows.map((r) => ({
    id: r.id,
    sectionId: r.section_id,
    sectionName: r.section_name,
    sessionName: r.session_name,
    startDate: r.start_date,
    endDate: r.end_date,
    active: !r.ended_at,
    endReason: r.end_reason,
    notes: r.notes,
    allocatedBy: r.allocated_by_name
  }));
}
