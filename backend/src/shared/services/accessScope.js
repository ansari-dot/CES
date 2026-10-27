import { db } from '../db/knex.js';
import { AppError } from '../errors/AppError.js';
import { ErrorCodes } from '../errors/errorCodes.js';

/**
 * Resolves what a signed-in user is allowed to see or manage, based on the
 * existing relationships: teacher_assignments / timetable_slots for teachers,
 * students.current_class_id for students and parent_student for parents.
 */

export const STAFF_ROLES = ['ADMIN', 'PRINCIPAL'];

export function isStaff(user) {
  return Boolean(user && STAFF_ROLES.includes(user.role));
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, ErrorCodes.UNAUTHENTICATED));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Forbidden: this action is not available for your role', 403, ErrorCodes.FORBIDDEN));
    }
    next();
  };
}

export function forbidden(message = 'Access denied') {
  return new AppError(message, 403, ErrorCodes.FORBIDDEN);
}

export async function getTeacherByUserId(userId) {
  return (await db('teachers').where({ user_id: userId }).first()) || null;
}

export async function getStudentByUserId(userId) {
  return (await db('students').where({ user_id: userId }).first()) || null;
}

export async function getParentByUserId(userId) {
  return (await db('parents').where({ user_id: userId }).first()) || null;
}

/**
 * Class/subject pairs a teacher is assigned to (direct assignments that are
 * still effective, plus non-archived timetable slots).
 */
export async function getTeacherScope(userId) {
  const teacher = await getTeacherByUserId(userId);
  if (!teacher) return { teacher: null, pairs: new Set(), classIds: new Set(), subjectIdsByClass: new Map() };

  const today = new Date().toISOString().split('T')[0];
  const [direct, slots] = await Promise.all([
    db('teacher_assignments')
      .where('teacher_id', teacher.id)
      .where((q) => q.whereNull('effective_to').orWhere('effective_to', '>=', today))
      .select('class_id', 'subject_id'),
    db('timetable_slots')
      .where('teacher_id', teacher.id)
      .whereNot('status', 'ARCHIVED')
      .select('class_id', 'subject_id')
  ]);

  const pairs = new Set();
  const classIds = new Set();
  const subjectIdsByClass = new Map();
  for (const row of [...direct, ...slots]) {
    const classId = Number(row.class_id);
    const subjectId = Number(row.subject_id);
    pairs.add(`${classId}-${subjectId}`);
    classIds.add(classId);
    if (!subjectIdsByClass.has(classId)) subjectIdsByClass.set(classId, new Set());
    subjectIdsByClass.get(classId).add(subjectId);
  }

  return { teacher, pairs, classIds, subjectIdsByClass };
}

export async function getParentChildren(userId) {
  const parent = await getParentByUserId(userId);
  if (!parent) return { parent: null, children: [] };
  const children = await db('parent_student')
    .join('students', 'parent_student.student_id', 'students.id')
    .where('parent_student.parent_id', parent.id)
    .select('students.id', 'students.current_class_id as classId', 'students.user_id as userId');
  return { parent, children };
}

/**
 * Returns the student row when the given user may view that student's records.
 * Staff: any student. Teacher: students in a class they teach. Student: self.
 * Parent: linked children only. Throws 403/404 otherwise.
 */
export async function assertCanViewStudent(user, studentId) {
  const student = await db('students').where({ id: Number(studentId) }).first();
  if (!student) throw new AppError('Student not found', 404, ErrorCodes.NOT_FOUND);

  if (isStaff(user)) return student;

  if (user.role === 'STUDENT') {
    if (Number(student.user_id) === Number(user.id)) return student;
    throw forbidden('You can only view your own records.');
  }

  if (user.role === 'PARENT') {
    const parent = await getParentByUserId(user.id);
    const link = parent
      ? await db('parent_student').where({ parent_id: parent.id, student_id: student.id }).first()
      : null;
    if (link) return student;
    throw forbidden('Access denied. Student is not linked to your parent account.');
  }

  if (user.role === 'TEACHER') {
    const scope = await getTeacherScope(user.id);
    if (scope.classIds.has(Number(student.current_class_id))) return student;
    throw forbidden('This student is not in a class assigned to you.');
  }

  throw forbidden();
}

export async function getCurrentSessionId() {
  const session = await db('academic_sessions').where({ is_current: 1 }).first();
  if (session) return session.id;
  const latest = await db('academic_sessions').orderBy('start_date', 'desc').first();
  return latest ? latest.id : null;
}

/**
 * User ids of the active students of the given classes and (optionally) their
 * linked parents. Used for targeted in-app notifications.
 */
export async function getClassAudienceUserIds(classIds, { includeStudents = true, includeParents = false, studentIds = null } = {}) {
  const ids = Array.from(classIds || []).map(Number).filter(Boolean);
  if (ids.length === 0 && !studentIds) return [];

  let studentQuery = db('students').where('students.status', 'ACTIVE');
  if (studentIds) studentQuery = studentQuery.whereIn('students.id', studentIds);
  else studentQuery = studentQuery.whereIn('students.current_class_id', ids);
  const students = await studentQuery.select('students.id', 'students.user_id');

  const userIds = new Set();
  if (includeStudents) students.forEach((s) => userIds.add(Number(s.user_id)));

  if (includeParents && students.length > 0) {
    const parents = await db('parent_student')
      .join('parents', 'parent_student.parent_id', 'parents.id')
      .whereIn('parent_student.student_id', students.map((s) => s.id))
      .select('parents.user_id');
    parents.forEach((p) => userIds.add(Number(p.user_id)));
  }

  return Array.from(userIds);
}
