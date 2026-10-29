/**
 * Loads one teacher's lessons + verified attendance logs for a date range and runs the single shared
 * duty calculation. Used by BOTH the teacher dashboard and payroll so the numbers can never diverge.
 *
 * "Effective teacher" rule: a lesson belongs to its substitute when one is assigned, otherwise to the
 * timetable teacher. Attendance logs are additionally filtered by the teacher's user id, so a log that
 * belongs to a different person can never be credited to this teacher.
 */
import { calculateTeacherPeriodDuty } from './dutyCalculation.js';

export async function loadTeacherLessonsAndLogs(dbOrTrx, { teacherId, startDate = null, endDate = null }) {
  const teacher = await dbOrTrx('teachers')
    .join('users', 'teachers.user_id', 'users.id')
    .where('teachers.id', teacherId)
    .select('teachers.id', 'teachers.user_id as userId', 'teachers.employee_no as staffIdentifier', 'users.full_name as teacherName')
    .first();

  if (!teacher) return null;

  let lessonsQuery = dbOrTrx('timetable_lessons')
    .leftJoin('classes', 'timetable_lessons.class_id', 'classes.id')
    .leftJoin('subjects', 'timetable_lessons.subject_id', 'subjects.id')
    .where((qb) => {
      qb.where('timetable_lessons.substitute_teacher_id', teacher.id).orWhere((inner) => {
        inner.where('timetable_lessons.teacher_id', teacher.id).whereNull('timetable_lessons.substitute_teacher_id');
      });
    })
    .select(
      'timetable_lessons.*',
      'classes.name as className',
      'classes.grade_level as classNumber',
      'subjects.name as subjectName'
    )
    .orderBy('timetable_lessons.start_at', 'asc');

  if (startDate) lessonsQuery = lessonsQuery.where('timetable_lessons.lesson_date', '>=', startDate);
  if (endDate) lessonsQuery = lessonsQuery.where('timetable_lessons.lesson_date', '<=', endDate);

  const lessons = await lessonsQuery;
  const lessonIds = lessons.map((l) => l.id);
  const logs = lessonIds.length > 0 ? await dbOrTrx('zoom_participant_log').whereIn('lesson_id', lessonIds) : [];

  return { teacher, lessons, logs };
}

export async function getTeacherDutyForPeriod(dbOrTrx, { teacherId, startDate = null, endDate = null, now = new Date(), policy = null }) {
  const data = await loadTeacherLessonsAndLogs(dbOrTrx, { teacherId, startDate, endDate });
  if (!data) return null;

  const duty = calculateTeacherPeriodDuty({
    lessons: data.lessons,
    participantLogs: data.logs,
    teacherUserId: data.teacher.userId,
    now,
    policy
  });

  return { teacher: data.teacher, lessons: data.lessons, duty };
}
