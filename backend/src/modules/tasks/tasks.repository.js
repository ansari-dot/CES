import { db } from '../../shared/db/knex.js';

export const tasksRepository = {
  // Tasks
  async createTask(data) {
    const [id] = await db('learning_tasks').insert(data);
    return id;
  },

  async getTasks({ classId = null, subjectId = null, teacherId = null, status = null, sessionId = null } = {}) {
    let query = db('learning_tasks')
      .join('classes', 'learning_tasks.class_id', 'classes.id')
      .join('subjects', 'learning_tasks.subject_id', 'subjects.id')
      .join('teachers', 'learning_tasks.teacher_id', 'teachers.id')
      .join('users as teacher_users', 'teachers.user_id', 'teacher_users.id')
      .select(
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
        'learning_tasks.assigned_date as assignedDate',
        'learning_tasks.deadline',
        'learning_tasks.total_marks as totalMarks',
        'learning_tasks.grading_scale as gradingScale',
        'learning_tasks.rubric_criteria as rubricCriteria',
        'learning_tasks.handout_url as handoutUrl',
        'learning_tasks.handout_name as handoutName',
        'learning_tasks.status',
        'learning_tasks.created_at as createdAt'
      )
      .orderBy('learning_tasks.deadline', 'desc');

    if (classId) query = query.where('learning_tasks.class_id', classId);
    if (subjectId) query = query.where('learning_tasks.subject_id', subjectId);
    if (teacherId) query = query.where('learning_tasks.teacher_id', teacherId);
    if (status) query = query.where('learning_tasks.status', status);
    if (sessionId) query = query.where('learning_tasks.session_id', sessionId);

    const tasks = await query;

    // Attach submission counts for each task
    const enrichedTasks = await Promise.all(
      tasks.map(async (task) => {
        const totalStudentsRow = await db('students')
          .where({ current_class_id: task.classId, status: 'ACTIVE' })
          .count('id as count')
          .first();
        const totalStudents = Number(totalStudentsRow?.count || 0);

        const submissions = await db('task_submissions').where({ task_id: task.id });
        const submittedCount = submissions.length;
        const gradedCount = submissions.filter((s) => s.status === 'GRADED').length;
        const pendingCount = submissions.filter((s) => s.status === 'PENDING' || s.status === 'LATE').length;
        const lateCount = submissions.filter((s) => s.is_late === 1 || s.is_late === true).length;
        const missingCount = Math.max(0, totalStudents - submittedCount);

        return {
          ...task,
          totalStudents,
          submittedCount,
          gradedCount,
          pendingCount,
          lateCount,
          missingCount
        };
      })
    );

    return enrichedTasks;
  },

  async findTaskById(id) {
    const task = await db('learning_tasks')
      .join('classes', 'learning_tasks.class_id', 'classes.id')
      .join('subjects', 'learning_tasks.subject_id', 'subjects.id')
      .join('teachers', 'learning_tasks.teacher_id', 'teachers.id')
      .join('users as teacher_users', 'teachers.user_id', 'teacher_users.id')
      .where('learning_tasks.id', id)
      .select(
        'learning_tasks.id',
        'learning_tasks.session_id as sessionId',
        'learning_tasks.class_id as classId',
        'learning_tasks.class_id',
        'classes.grade_level as classNumber',
        'classes.name as className',
        'learning_tasks.subject_id as subjectId',
        'learning_tasks.subject_id',
        'subjects.code as subjectCode',
        'subjects.name as subjectName',
        'learning_tasks.teacher_id as teacherId',
        'learning_tasks.teacher_id',
        'teacher_users.full_name as teacherName',
        'learning_tasks.title',
        'learning_tasks.instructions',
        'learning_tasks.assigned_date as assignedDate',
        'learning_tasks.deadline',
        'learning_tasks.total_marks as totalMarks',
        'learning_tasks.total_marks',
        'learning_tasks.grading_scale as gradingScale',
        'learning_tasks.rubric_criteria as rubricCriteria',
        'learning_tasks.handout_url as handoutUrl',
        'learning_tasks.handout_name as handoutName',
        'learning_tasks.status',
        'learning_tasks.created_at as createdAt'
      )
      .first();

    if (!task) return null;

    const classId = task.classId || task.class_id;
    const totalStudentsRow = await db('students')
      .where({ current_class_id: classId, status: 'ACTIVE' })
      .count('id as count')
      .first();
    const totalStudents = Number(totalStudentsRow?.count || 0);

    const submissions = await db('task_submissions').where({ task_id: task.id });
    const submittedCount = submissions.length;
    const gradedCount = submissions.filter((s) => s.status === 'GRADED').length;
    const pendingCount = submissions.filter((s) => s.status === 'PENDING' || s.status === 'LATE').length;
    const lateCount = submissions.filter((s) => s.is_late === 1 || s.is_late === true).length;
    const missingCount = Math.max(0, totalStudents - submittedCount);

    return {
      ...task,
      totalStudents,
      submittedCount,
      gradedCount,
      pendingCount,
      lateCount,
      missingCount
    };
  },

  async updateTask(id, updates) {
    return await db('learning_tasks').where({ id }).update(updates);
  },

  // Submissions
  async submitTask({ taskId, studentId, fileUrl, fileName, fileSize, studentNotes, isLate }) {
    const existing = await db('task_submissions').where({ task_id: taskId, student_id: studentId }).first();

    if (existing) {
      await db('task_submissions')
        .where({ id: existing.id })
        .update({
          file_url: fileUrl || existing.file_url,
          file_name: fileName || existing.file_name,
          file_size: fileSize || existing.file_size,
          student_notes: studentNotes !== undefined ? studentNotes : existing.student_notes,
          submitted_at: db.fn.now(3),
          is_late: isLate ? 1 : 0,
          status: isLate ? 'LATE' : 'PENDING'
        });
      return existing.id;
    } else {
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
    }
  },

  async getSubmissions({ taskId = null, studentId = null, status = null } = {}) {
    let query = db('task_submissions')
      .join('learning_tasks', 'task_submissions.task_id', 'learning_tasks.id')
      .join('students', 'task_submissions.student_id', 'students.id')
      .join('users as student_users', 'students.user_id', 'student_users.id')
      .leftJoin('users as grader_users', 'task_submissions.graded_by', 'grader_users.id')
      .select(
        'task_submissions.id',
        'task_submissions.task_id as taskId',
        'learning_tasks.title as taskTitle',
        'learning_tasks.total_marks as maxMarks',
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
        'task_submissions.graded_at as gradedAt'
      )
      .orderBy('task_submissions.submitted_at', 'desc');

    if (taskId) query = query.where('task_submissions.task_id', taskId);
    if (studentId) query = query.where('task_submissions.student_id', studentId);
    if (status) query = query.where('task_submissions.status', status);

    return await query;
  },

  async findSubmissionById(id) {
    return await db('task_submissions')
      .join('learning_tasks', 'task_submissions.task_id', 'learning_tasks.id')
      .join('students', 'task_submissions.student_id', 'students.id')
      .join('users as student_users', 'students.user_id', 'student_users.id')
      .leftJoin('users as grader_users', 'task_submissions.graded_by', 'grader_users.id')
      .where('task_submissions.id', id)
      .select(
        'task_submissions.id',
        'task_submissions.task_id as taskId',
        'task_submissions.task_id',
        'task_submissions.student_id as studentId',
        'task_submissions.student_id',
        'task_submissions.submitted_at as submittedAt',
        'task_submissions.file_url as fileUrl',
        'task_submissions.file_name as fileName',
        'task_submissions.file_size as fileSize',
        'task_submissions.student_notes as studentNotes',
        'task_submissions.status',
        'task_submissions.is_late as isLate',
        'task_submissions.is_late',
        'task_submissions.marks_awarded as marksAwarded',
        'task_submissions.marks_awarded',
        'task_submissions.rubric_scores as rubricScores',
        'task_submissions.feedback',
        'task_submissions.graded_by as gradedBy',
        'task_submissions.graded_at as gradedAt',
        'learning_tasks.title as taskTitle',
        'learning_tasks.total_marks as maxMarks',
        'student_users.full_name as studentName',
        'students.roll_no as studentRoll',
        'students.admission_no as admissionId',
        'grader_users.full_name as gradedByName'
      )
      .first();
  },

  async gradeSubmission({ submissionId, marksAwarded, rubricScores, feedback, gradedBy }) {
    await db('task_submissions')
      .where({ id: submissionId })
      .update({
        marks_awarded: marksAwarded,
        rubric_scores: rubricScores ? JSON.stringify(rubricScores) : null,
        feedback: feedback || null,
        graded_by: gradedBy,
        graded_at: db.fn.now(3),
        status: 'GRADED'
      });

    return await this.findSubmissionById(submissionId);
  },

  // Learning Resources
  async createResource(data) {
    const [id] = await db('learning_resources').insert(data);
    return id;
  },

  async getResources({ classId = null, subjectId = null, resourceType = null } = {}) {
    let query = db('learning_resources')
      .join('classes', 'learning_resources.class_id', 'classes.id')
      .join('subjects', 'learning_resources.subject_id', 'subjects.id')
      .join('users', 'learning_resources.uploaded_by', 'users.id')
      .select(
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
        'learning_resources.file_size as fileSize',
        'learning_resources.is_published as isPublished',
        'users.full_name as uploadedByName',
        'learning_resources.created_at as createdAt'
      )
      .orderBy('learning_resources.created_at', 'desc');

    if (classId) query = query.where('learning_resources.class_id', classId);
    if (subjectId) query = query.where('learning_resources.subject_id', subjectId);
    if (resourceType) query = query.where('learning_resources.resource_type', resourceType);

    return await query;
  },

  async deleteResource(id) {
    return await db('learning_resources').where({ id }).del();
  },

  // Achievements & Recognition (SRS Section 8.3 & 12)
  async awardAchievement({ studentId, teacherId, classId, badgeType = 'star', title, reason, starsCount = 3 }) {
    const [id] = await db('student_achievements').insert({
      student_id: studentId,
      teacher_id: teacherId,
      class_id: classId,
      badge_type: badgeType,
      title,
      reason,
      stars_count: starsCount
    });
    return id;
  },

  async getAchievements({ studentId = null, classId = null, teacherId = null } = {}) {
    let query = db('student_achievements')
      .join('students', 'student_achievements.student_id', 'students.id')
      .join('users as student_users', 'students.user_id', 'student_users.id')
      .join('teachers', 'student_achievements.teacher_id', 'teachers.id')
      .join('users as teacher_users', 'teachers.user_id', 'teacher_users.id')
      .join('classes', 'student_achievements.class_id', 'classes.id')
      .select(
        'student_achievements.id',
        'student_achievements.student_id as studentId',
        'student_users.full_name as studentName',
        'students.roll_no as rollNumber',
        'student_achievements.class_id as classId',
        'classes.name as className',
        'student_achievements.teacher_id as teacherId',
        'teacher_users.full_name as awardedByTeacher',
        'student_achievements.badge_type as badgeType',
        'student_achievements.title',
        'student_achievements.reason',
        'student_achievements.stars_count as starsCount',
        'student_achievements.created_at as awardedAt'
      )
      .orderBy('student_achievements.created_at', 'desc');

    if (studentId) query = query.where('student_achievements.student_id', studentId);
    if (classId) query = query.where('student_achievements.class_id', classId);
    if (teacherId) query = query.where('student_achievements.teacher_id', teacherId);

    return await query;
  }
};
