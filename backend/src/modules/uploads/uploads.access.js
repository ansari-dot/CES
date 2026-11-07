import { db } from '../../shared/db/knex.js';
import {
  isStaff,
  getTeacherScope,
  getStudentByUserId,
  getParentChildren
} from '../../shared/services/accessScope.js';

/**
 * Decides whether the signed-in user may download an uploaded file, based on
 * the record that references it (submission, assignment handout, learning
 * resource, payment proof or lesson resource).
 */
export async function canAccessUploadedFile(user, fileUrl) {
  if (isStaff(user)) return true;

  const safeFilename = fileUrl ? fileUrl.split('/').pop() : '';

  const [submission, handoutTask, resource, proof, lesson] = await Promise.all([
    db('task_submissions')
      .join('learning_tasks', 'task_submissions.task_id', 'learning_tasks.id')
      .where(function () {
        this.where('task_submissions.file_url', fileUrl);
        if (safeFilename) {
          this.orWhere('task_submissions.file_url', 'like', `%${safeFilename}`);
        }
      })
      .select('task_submissions.student_id', 'learning_tasks.teacher_id', 'learning_tasks.class_id')
      .first(),
    db('learning_tasks')
      .where(function () {
        this.where('handout_url', fileUrl);
        if (safeFilename) {
          this.orWhere('handout_url', 'like', `%${safeFilename}`);
        }
      })
      .select('class_id', 'teacher_id', 'status')
      .first(),
    db('learning_resources')
      .where(function () {
        this.where('file_url', fileUrl);
        if (safeFilename) {
          this.orWhere('file_url', 'like', `%${safeFilename}`);
        }
      })
      .select('class_id', 'uploaded_by', 'is_published')
      .first(),
    db('fee_payment_proofs')
      .where(function () {
        this.where('proof_document_url', fileUrl);
        if (safeFilename) {
          this.orWhere('proof_document_url', 'like', `%${safeFilename}`);
        }
      })
      .select('student_id')
      .first(),
    db('timetable_lessons')
      .where(function () {
        this.where('resource_url', fileUrl);
        if (safeFilename) {
          this.orWhere('resource_url', 'like', `%${safeFilename}`);
        }
      })
      .select('class_id', 'teacher_id')
      .first()
  ]);

  // Files not linked to any record are only available to staff and teachers
  if (!submission && !handoutTask && !resource && !proof && !lesson) {
    return user.role === 'TEACHER';
  }

  if (user.role === 'TEACHER') {
    const scope = await getTeacherScope(user.id);
    const teacherId = scope.teacher ? Number(scope.teacher.id) : null;
    if (
      submission &&
      (Number(submission.teacher_id) === teacherId ||
        (submission.class_id && scope.classIds.has(Number(submission.class_id))))
    )
      return true;
    if (handoutTask && (Number(handoutTask.teacher_id) === teacherId || scope.classIds.has(Number(handoutTask.class_id)))) return true;
    if (resource && (Number(resource.uploaded_by) === Number(user.id) || scope.classIds.has(Number(resource.class_id)))) return true;
    if (lesson && (Number(lesson.teacher_id) === teacherId || scope.classIds.has(Number(lesson.class_id)))) return true;
    return false;
  }

  let studentRows = [];
  if (user.role === 'STUDENT') {
    const student = await getStudentByUserId(user.id);
    if (student) studentRows = [{ id: Number(student.id), classId: Number(student.current_class_id) }];
  } else if (user.role === 'PARENT') {
    const { children } = await getParentChildren(user.id);
    studentRows = children.map((c) => ({ id: Number(c.id), classId: Number(c.classId) }));
  }
  if (studentRows.length === 0) return false;

  const studentIds = new Set(studentRows.map((s) => s.id));
  const classIds = new Set(studentRows.map((s) => s.classId));

  if (submission && studentIds.has(Number(submission.student_id))) return true;
  if (proof && studentIds.has(Number(proof.student_id))) return true;
  if (handoutTask && handoutTask.status !== 'DRAFT' && classIds.has(Number(handoutTask.class_id))) return true;
  if (resource && resource.is_published && classIds.has(Number(resource.class_id))) return true;
  if (lesson && classIds.has(Number(lesson.class_id))) return true;
  return false;
}
