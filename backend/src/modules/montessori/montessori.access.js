/**
 * Montessori access rules (enforced for every request, never trusted from the client).
 *
 *  - Principal / Admin: full access.
 *  - Teacher: only sections where they hold an ACTIVE assignment (class teacher or assistant)
 *    on an active section. Regular subject assignments grant nothing here.
 *  - Parent: read-only, linked children only.
 */
import { db } from '../../shared/db/knex.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { isStaff, getTeacherByUserId, getParentByUserId } from '../../shared/services/accessScope.js';
import { config } from '../../config/index.js';

export const forbidden = (m = 'You are not assigned to this Montessori section.') => new AppError(m, 403, ErrorCodes.FORBIDDEN);
export const notFound = (m = 'Record not found.') => new AppError(m, 404, ErrorCodes.NOT_FOUND);
export const invalid = (m, details = null) => new AppError(m, 422, ErrorCodes.VALIDATION_ERROR, details);
export const conflict = (m, details = null) => new AppError(m, 409, ErrorCodes.CONFLICT, details);

/** classes.grade_level of the "Montessori" admission level (Classes 1–8 are regular). */
export const MONTESSORI_GRADE_LEVEL = 0;

/** YYYY-MM-DD in the school's timezone. */
export function schoolToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: config.SCHOOL_TIMEZONE || 'Asia/Karachi' }).format(new Date());
}

export function parseZod(schema, body) {
  const r = schema.safeParse(body || {});
  if (!r.success) {
    const first = r.error.issues[0];
    throw invalid(first?.message || 'Invalid request.', { issues: r.error.issues.map((i) => ({ field: i.path.join('.'), issue: i.message })) });
  }
  return r.data;
}

/** Active Montessori section ids for a teacher user (empty for non-teachers). */
export async function teacherSectionIds(user) {
  if (user.role !== 'TEACHER') return { teacher: null, sectionIds: new Set() };
  const teacher = await getTeacherByUserId(user.id);
  if (!teacher) return { teacher: null, sectionIds: new Set() };
  const rows = await db('montessori_teacher_assignments as a')
    .join('montessori_sections as s', 'a.section_id', 's.id')
    .where('a.teacher_id', teacher.id)
    .whereNull('a.ended_at')
    .where('s.is_active', 1)
    .select('a.section_id');
  return { teacher, sectionIds: new Set(rows.map((r) => Number(r.section_id))) };
}

/**
 * Ensures the user may work with a section. Returns { section, teacher }.
 * Staff may read any section; writes by staff are allowed where the caller permits it.
 */
export async function assertSectionAccess(user, sectionId) {
  const section = await db('montessori_sections').where({ id: Number(sectionId) }).first();
  if (!section) throw notFound('Montessori section not found.');
  if (isStaff(user)) return { section, teacher: null };
  const { teacher, sectionIds } = await teacherSectionIds(user);
  if (teacher && sectionIds.has(Number(section.id))) return { section, teacher };
  throw forbidden();
}

/** Ensures a parent is linked to the student. */
export async function assertParentLink(user, studentId) {
  if (user.role !== 'PARENT') throw forbidden('Only parents can use this view.');
  const parent = await getParentByUserId(user.id);
  const link = parent ? await db('parent_student').where({ parent_id: parent.id, student_id: Number(studentId) }).first() : null;
  if (!link) throw forbidden('Access denied. Student is not linked to your parent account.');
  return parent;
}

/**
 * May the user view this student's Montessori records?
 * Staff: yes. Teacher: the student is (or was) allocated to a section they currently teach.
 * Parent: linked child. Students have no Montessori endpoints.
 */
export async function assertCanViewStudent(user, studentId) {
  const student = await db('students').where({ id: Number(studentId) }).first();
  if (!student) throw notFound('Student not found.');
  if (isStaff(user)) return student;
  if (user.role === 'PARENT') {
    await assertParentLink(user, studentId);
    return student;
  }
  if (user.role === 'TEACHER') {
    const { sectionIds } = await teacherSectionIds(user);
    if (sectionIds.size) {
      const alloc = await db('montessori_student_allocations')
        .where({ student_id: student.id })
        .whereIn('section_id', [...sectionIds])
        .first();
      if (alloc) return student;
    }
  }
  throw forbidden('This student is not in a Montessori section assigned to you.');
}

/** Students allocated to the section on a given date (allocation active that day). */
export function allocatedOn(sectionId, date) {
  return db('montessori_student_allocations as al')
    .join('students as s', 'al.student_id', 's.id')
    .join('users as u', 's.user_id', 'u.id')
    .leftJoin('classes as c', 's.current_class_id', 'c.id')
    .where('al.section_id', Number(sectionId))
    .where('al.start_date', '<=', date)
    // Date range only, so past rosters still include students who were later transferred
    .where((q) => q.whereNull('al.end_date').orWhere('al.end_date', '>=', date))
    .select(
      's.id as studentId',
      'u.full_name as name',
      's.admission_no as admissionNo',
      's.roll_no as rollNo',
      's.status as studentStatus',
      'c.name as regularClassName',
      'al.id as allocationId',
      'al.start_date as allocatedFrom'
    )
    .orderBy('u.full_name');
}

export { isStaff };
