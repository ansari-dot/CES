import { db } from '../../shared/db/knex.js';
import { parseDbDate } from '../../shared/utils/date.js';

function parseRubric(value) {
  if (!value) return null;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Status of a task from the point of view of one student. Marks and feedback
 * are only released once the teacher publishes the grade (status GRADED).
 */
export function studentTaskView(task, submission) {
  const deadline = parseDbDate(task.deadline);
  const pastDeadline = deadline ? Date.now() > deadline.getTime() : false;

  let submissionStatus;
  if (!submission) submissionStatus = pastDeadline ? 'OVERDUE' : 'PENDING';
  else if (submission.status === 'GRADED') submissionStatus = 'GRADED';
  else if (submission.status === 'RESUBMIT_REQUESTED') submissionStatus = pastDeadline ? 'OVERDUE' : 'PENDING';
  else submissionStatus = 'SUBMITTED';

  const published = submission?.status === 'GRADED';
  const resubmitRequested = submission?.status === 'RESUBMIT_REQUESTED';

  return {
    submissionStatus,
    resubmitRequested,
    submissionId: submission ? submission.id : null,
    marksObtained: published && submission.marks_awarded != null ? Number(submission.marks_awarded) : null,
    marksAwarded: published && submission.marks_awarded != null ? Number(submission.marks_awarded) : null,
    feedback: published || resubmitRequested ? submission.feedback || '' : '',
    submittedAt: submission ? submission.submitted_at : null,
    submittedFileName: submission ? submission.file_name || null : null,
    submittedFileUrl: submission ? submission.file_url || null : null,
    isLate: submission ? Boolean(submission.is_late) : false,
    gradedAt: published ? submission.graded_at : null,
    rubricScores: published ? parseRubric(submission.rubric_scores) : null
  };
}

const TASK_COLUMNS = [
  'learning_tasks.id',
  'learning_tasks.session_id as sessionId',
  'learning_tasks.class_id as classId',
  'classes.grade_level as classNumber',
  'classes.name as className',
  'learning_tasks.subject_id as subjectId',
  'subjects.code as subjectCode',
  'subjects.name as subjectName',
  'learning_tasks.teacher_id as teacherId',
  'teacher_users.full_name as teacherName',
  'learning_tasks.title',
  'learning_tasks.instructions',
  'learning_tasks.task_type as taskType',
  'learning_tasks.assigned_date as assignedDate',
  'learning_tasks.deadline',
  'learning_tasks.total_marks as totalMarks',
  'learning_tasks.grading_scale as gradingScale',
  'learning_tasks.rubric_criteria as rubricCriteria',
  'learning_tasks.handout_url as handoutUrl',
  'learning_tasks.handout_name as handoutName',
  'learning_tasks.status',
  'learning_tasks.created_at as createdAt'
];

function baseTaskQuery() {
  return db('learning_tasks')
    .join('classes', 'learning_tasks.class_id', 'classes.id')
    .join('subjects', 'learning_tasks.subject_id', 'subjects.id')
    .join('teachers', 'learning_tasks.teacher_id', 'teachers.id')
    .join('users as teacher_users', 'teachers.user_id', 'teacher_users.id');
}

async function attachSubmissionCounts(tasks) {
  if (tasks.length === 0) return [];
  const taskIds = tasks.map((t) => t.id);
  const classIds = Array.from(new Set(tasks.map((t) => t.classId)));

  const [classCounts, submissions] = await Promise.all([
    db('students')
      .whereIn('current_class_id', classIds)
      .where('status', 'ACTIVE')
      .groupBy('current_class_id')
      .select('current_class_id', db.raw('count(id) as count')),
    db('task_submissions').whereIn('task_id', taskIds).select('task_id', 'status', 'is_late')
  ]);

  const studentsByClass = new Map(classCounts.map((r) => [Number(r.current_class_id), Number(r.count)]));
  const subsByTask = new Map();
  for (const s of submissions) {
    if (!subsByTask.has(s.task_id)) subsByTask.set(s.task_id, []);
    subsByTask.get(s.task_id).push(s);
  }

  return tasks.map((task) => {
    const subs = subsByTask.get(task.id) || [];
    const totalStudents = studentsByClass.get(Number(task.classId)) || 0;
    const submittedCount = subs.length;
    return {
      ...task,
      totalStudents,
      submittedCount,
      gradedCount: subs.filter((s) => s.status === 'GRADED').length,
      pendingCount: subs.filter((s) => s.status === 'PENDING' || s.status === 'LATE').length,
      lateCount: subs.filter((s) => s.is_late === 1 || s.is_late === true).length,
      missingCount: Math.max(0, totalStudents - submittedCount)
    };
  });
}

const SUBMISSION_COLUMNS = [
  'task_submissions.id',
  'task_submissions.task_id as taskId',
  'learning_tasks.title as taskTitle',
  'learning_tasks.task_type as taskType',
  'learning_tasks.total_marks as maxMarks',
  'learning_tasks.teacher_id as teacherId',
  'learning_tasks.class_id as classId',
  'learning_tasks.subject_id as subjectId',
  'subjects.name as subjectName',
  'classes.name as className',
  'task_submissions.student_id as studentId',
  'student_users.full_name as studentName',
  'students.roll_no as studentRoll',
  'students.admission_no as admissionId',
  'task_submissions.submitted_at as submittedAt',
  'task_submissions.file_url as fileUrl',
  'task_submissions.file_name as fileName',
  'task_submissions.file_size as fileSize',
  'task_submissions.student_notes as studentNotes',
  'task_submissions.status',
  'task_submissions.is_late as isLate',
  'task_submissions.marks_awarded as marksAwarded',
  'task_submissions.rubric_scores as rubricScores',
  'task_submissions.feedback',
  'grader_users.full_name as gradedByName',
  'task_submissions.graded_by as gradedBy',
  'task_submissions.graded_at as gradedAt'
];

function baseSubmissionQuery() {
  return db('task_submissions')
    .join('learning_tasks', 'task_submissions.task_id', 'learning_tasks.id')
    .join('subjects', 'learning_tasks.subject_id', 'subjects.id')
    .join('classes', 'learning_tasks.class_id', 'classes.id')
    .join('students', 'task_submissions.student_id', 'students.id')
    .join('users as student_users', 'students.user_id', 'student_users.id')
    .leftJoin('users as grader_users', 'task_submissions.graded_by', 'grader_users.id');
}

const RESOURCE_COLUMNS = [
  'learning_resources.id',
  'learning_resources.class_id as classId',
  'classes.name as className',
  'classes.grade_level as classNumber',
  'learning_resources.subject_id as subjectId',
  'subjects.name as subjectName',
  'learning_resources.title',
  'learning_resources.description',
  'learning_resources.resource_type as resourceType',
  'learning_resources.file_url as fileUrl',
  'learning_resources.file_name as fileName',
  'learning_resources.file_size as fileSize',
  'learning_resources.is_published as isPublished',
  'learning_resources.uploaded_by as uploadedBy',
  'users.full_name as uploadedByName',
  'learning_resources.created_at as createdAt'
];

const ACHIEVEMENT_COLUMNS = [
  'student_achievements.id',
  'student_achievements.student_id as studentId',
  'student_users.full_name as studentName',
  'students.roll_no as rollNumber',
  'student_achievements.class_id as classId',
  'classes.name as className',
  'student_achievements.subject_id as subjectId',
  'subjects.name as subjectName',
  'student_achievements.teacher_id as teacherId',
  'teacher_users.full_name as awardedByTeacher',
  'student_achievements.badge_type as badgeType',
  'student_achievements.title',
  'student_achievements.reason',
  'student_achievements.stars_count as starsCount',
  'student_achievements.visibility',
  'student_achievements.created_at as awardedAt',
  'student_achievements.created_at as createdAt',
  'student_achievements.updated_at as updatedAt'
];

function baseAchievementQuery() {
  return db('student_achievements')
    .join('students', 'student_achievements.student_id', 'students.id')
    .join('users as student_users', 'students.user_id', 'student_users.id')
    .join('teachers', 'student_achievements.teacher_id', 'teachers.id')
    .join('users as teacher_users', 'teachers.user_id', 'teacher_users.id')
    .join('classes', 'student_achievements.class_id', 'classes.id')
    .leftJoin('subjects', 'student_achievements.subject_id', 'subjects.id');
}

export const tasksRepository = {
  // Tasks
  async createTask(data) {
    const [id] = await db('learning_tasks').insert(data);
    return id;
  },

  async getTasks({
    classId = null,
    subjectId = null,
    teacherId = null,
    status = null,
    statuses = null,
    taskType = null,
    sessionId = null,
    studentId = null
  } = {}) {
    let query = baseTaskQuery().select(TASK_COLUMNS).orderBy('learning_tasks.deadline', 'desc');

    if (classId) query = query.where('learning_tasks.class_id', classId);
    if (subjectId) query = query.where('learning_tasks.subject_id', subjectId);
    if (teacherId) query = query.where('learning_tasks.teacher_id', teacherId);
    if (status) query = query.where('learning_tasks.status', status);
    if (statuses) query = query.whereIn('learning_tasks.status', statuses);
    if (taskType) query = query.where('learning_tasks.task_type', taskType);
    if (sessionId) query = query.where('learning_tasks.session_id', sessionId);

    const tasks = await attachSubmissionCounts(await query);
    if (!studentId) return tasks;

    const mySubs = await db('task_submissions')
      .where('student_id', studentId)
      .whereIn('task_id', tasks.map((t) => t.id));
    const subMap = new Map(mySubs.map((s) => [s.task_id, s]));

    return tasks.map((task) => ({ ...task, ...studentTaskView(task, subMap.get(task.id)) }));
  },

  async findTaskById(id) {
    const task = await baseTaskQuery()
      .where('learning_tasks.id', id)
      .select([
        ...TASK_COLUMNS,
        'learning_tasks.class_id',
        'learning_tasks.subject_id',
        'learning_tasks.teacher_id',
        'learning_tasks.total_marks'
      ])
      .first();

    if (!task) return null;
    const [enriched] = await attachSubmissionCounts([task]);
    return enriched;
  },

  async updateTask(id, updates) {
    return await db('learning_tasks').where({ id }).update(updates);
  },

  // Submissions
  async findSubmissionByTaskAndStudent(taskId, studentId) {
    return await db('task_submissions').where({ task_id: taskId, student_id: studentId }).first();
  },

  async submitTask({ taskId, studentId, fileUrl, fileName, fileSize, studentNotes, isLate }) {
    const existing = await this.findSubmissionByTaskAndStudent(taskId, studentId);

    if (existing) {
      // Resubmission (only reached when the teacher requested it): previous draft
      // marks and the return note are cleared for the new attempt.
      await db('task_submissions')
        .where({ id: existing.id })
        .update({
          file_url: fileUrl || existing.file_url,
          file_name: fileName || existing.file_name,
          file_size: fileSize || existing.file_size,
          student_notes: studentNotes !== undefined ? studentNotes : existing.student_notes,
          submitted_at: db.fn.now(3),
          is_late: isLate ? 1 : 0,
          status: isLate ? 'LATE' : 'PENDING',
          marks_awarded: null,
          rubric_scores: null,
          feedback: null,
          graded_by: null,
          graded_at: null
        });
      return existing.id;
    }

    const [id] = await db('task_submissions').insert({
      task_id: taskId,
      student_id: studentId,
      file_url: fileUrl || null,
      file_name: fileName || null,
      file_size: fileSize || null,
      student_notes: studentNotes || null,
      submitted_at: db.fn.now(3),
      is_late: isLate ? 1 : 0,
      status: isLate ? 'LATE' : 'PENDING'
    });
    return id;
  },

  async getSubmissions({ taskId = null, studentId = null, status = null, teacherId = null, classId = null } = {}) {
    let query = baseSubmissionQuery().select(SUBMISSION_COLUMNS).orderBy('task_submissions.submitted_at', 'desc');

    if (taskId) query = query.where('task_submissions.task_id', taskId);
    if (studentId) query = query.where('task_submissions.student_id', studentId);
    if (status) query = query.where('task_submissions.status', status);
    if (teacherId) query = query.where('learning_tasks.teacher_id', teacherId);
    if (classId) query = query.where('learning_tasks.class_id', classId);

    return await query;
  },

  async findSubmissionById(id) {
    return await baseSubmissionQuery()
      .where('task_submissions.id', id)
      .select([
        ...SUBMISSION_COLUMNS,
        'task_submissions.task_id',
        'task_submissions.student_id',
        'task_submissions.is_late',
        'task_submissions.marks_awarded'
      ])
      .first();
  },

  /**
   * Saves marks and feedback. When publish is false the grade is kept as a
   * draft: the submission status is unchanged, so students and parents do not
   * see the marks until the teacher publishes.
   */
  async gradeSubmission({ submissionId, marksAwarded, rubricScores, feedback, gradedBy, publish = true, currentStatus }) {
    const draftStatus = currentStatus === 'LATE' ? 'LATE' : 'PENDING';
    await db('task_submissions')
      .where({ id: submissionId })
      .update({
        marks_awarded: marksAwarded,
        rubric_scores: rubricScores ? JSON.stringify(rubricScores) : null,
        feedback: feedback || null,
        graded_by: gradedBy,
        graded_at: publish ? db.fn.now(3) : null,
        status: publish ? 'GRADED' : draftStatus
      });

    return await this.findSubmissionById(submissionId);
  },

  async returnSubmission({ submissionId, note, gradedBy }) {
    await db('task_submissions').where({ id: submissionId }).update({
      status: 'RESUBMIT_REQUESTED',
      feedback: note,
      marks_awarded: null,
      rubric_scores: null,
      graded_by: gradedBy,
      graded_at: null
    });
    return await this.findSubmissionById(submissionId);
  },

  /** Class roster for a task with each student's current submission / marks. */
  async getTaskRoster(task) {
    const students = await db('students')
      .join('users', 'students.user_id', 'users.id')
      .where({ 'students.current_class_id': task.classId, 'students.status': 'ACTIVE' })
      .select('students.id as studentId', 'users.full_name as studentName', 'students.roll_no as rollNo', 'students.admission_no as admissionNo')
      .orderBy('students.roll_no', 'asc');

    const subs = await db('task_submissions').where('task_id', task.id);
    const subMap = new Map(subs.map((s) => [Number(s.student_id), s]));

    return students.map((s) => {
      const sub = subMap.get(Number(s.studentId));
      return {
        ...s,
        submissionId: sub ? sub.id : null,
        status: sub ? sub.status : 'NOT_SUBMITTED',
        hasFile: Boolean(sub?.file_url),
        marksAwarded: sub?.marks_awarded != null ? Number(sub.marks_awarded) : null,
        feedback: sub?.feedback || ''
      };
    });
  },

  /**
   * Records marks for several students of one assessment (e.g. a quiz or test
   * taken in class). Uses the unique (task_id, student_id) row so a student can
   * never receive two grade records for the same assessment.
   */
  async upsertMarks({ taskId, entries, gradedBy, publish }) {
    return await db.transaction(async (trx) => {
      let saved = 0;
      for (const entry of entries) {
        const existing = await trx('task_submissions')
          .where({ task_id: taskId, student_id: entry.studentId })
          .first();

        const gradeFields = {
          marks_awarded: entry.marksAwarded,
          feedback: entry.feedback || null,
          graded_by: gradedBy,
          graded_at: publish ? trx.fn.now(3) : null
        };

        if (existing) {
          const draftStatus = existing.status === 'LATE' ? 'LATE' : 'PENDING';
          await trx('task_submissions')
            .where({ id: existing.id })
            .update({ ...gradeFields, status: publish ? 'GRADED' : draftStatus });
        } else {
          await trx('task_submissions').insert({
            task_id: taskId,
            student_id: entry.studentId,
            submitted_at: trx.fn.now(3),
            is_late: 0,
            ...gradeFields,
            status: publish ? 'GRADED' : 'PENDING'
          });
        }
        saved += 1;
      }
      return saved;
    });
  },

  // Learning Resources
  async createResource(data) {
    const [id] = await db('learning_resources').insert(data);
    return id;
  },

  async findResourceById(id) {
    return await db('learning_resources')
      .join('classes', 'learning_resources.class_id', 'classes.id')
      .join('subjects', 'learning_resources.subject_id', 'subjects.id')
      .join('users', 'learning_resources.uploaded_by', 'users.id')
      .where('learning_resources.id', id)
      .select(RESOURCE_COLUMNS)
      .first();
  },

  async getResources({ classId = null, classIds = null, subjectId = null, resourceType = null, uploadedBy = null, publishedOnly = false } = {}) {
    let query = db('learning_resources')
      .join('classes', 'learning_resources.class_id', 'classes.id')
      .join('subjects', 'learning_resources.subject_id', 'subjects.id')
      .join('users', 'learning_resources.uploaded_by', 'users.id')
      .select(RESOURCE_COLUMNS)
      .orderBy('learning_resources.created_at', 'desc');

    if (classId) query = query.where('learning_resources.class_id', classId);
    if (classIds) query = query.whereIn('learning_resources.class_id', classIds);
    if (subjectId) query = query.where('learning_resources.subject_id', subjectId);
    if (resourceType) query = query.where('learning_resources.resource_type', resourceType);
    if (uploadedBy) query = query.where('learning_resources.uploaded_by', uploadedBy);
    if (publishedOnly) query = query.where('learning_resources.is_published', 1);

    return await query;
  },

  async updateResource(id, updates) {
    await db('learning_resources').where({ id }).update(updates);
    return await this.findResourceById(id);
  },

  async deleteResource(id) {
    return await db('learning_resources').where({ id }).del();
  },

  // Achievements & Recognition (SRS Section 8.3 & 12)
  async awardAchievement({ studentId, teacherId, classId, subjectId = null, sessionId = null, badgeType = 'star', title, reason, starsCount = 3, visibility = 'PUBLISHED' }) {
    const [id] = await db('student_achievements').insert({
      student_id: studentId,
      teacher_id: teacherId,
      class_id: classId,
      subject_id: subjectId,
      session_id: sessionId,
      badge_type: badgeType,
      title,
      reason,
      stars_count: starsCount,
      visibility
    });
    return id;
  },

  async findAchievementById(id) {
    return await baseAchievementQuery().where('student_achievements.id', id).select(ACHIEVEMENT_COLUMNS).first();
  },

  async updateAchievement(id, updates) {
    await db('student_achievements')
      .where({ id })
      .update({ ...updates, updated_at: db.fn.now(3) });
    return await this.findAchievementById(id);
  },

  async deleteAchievement(id) {
    return await db('student_achievements').where({ id }).del();
  },

  async getAchievements({ studentId = null, classId = null, teacherId = null, publishedOnly = false } = {}) {
    let query = baseAchievementQuery().select(ACHIEVEMENT_COLUMNS).orderBy('student_achievements.created_at', 'desc');

    if (studentId) query = query.where('student_achievements.student_id', studentId);
    if (classId) query = query.where('student_achievements.class_id', classId);
    if (teacherId) query = query.where('student_achievements.teacher_id', teacherId);
    if (publishedOnly) query = query.where('student_achievements.visibility', 'PUBLISHED');

    return await query;
  }
};
