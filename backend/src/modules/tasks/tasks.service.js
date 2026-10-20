import { tasksRepository } from './tasks.repository.js';
import { parseDbDate } from '../../shared/utils/date.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { notificationService } from '../../shared/services/notificationService.js';
import { db } from '../../shared/db/knex.js';

export const tasksService = {
  async createTask({
    sessionId,
    classId,
    subjectId,
    teacherId,
    title,
    instructions,
    assignedDate,
    deadline,
    totalMarks = 20,
    gradingScale = 'NUMERIC',
    rubricCriteria = null,
    handoutUrl = null,
    handoutName = null,
    createdBy
  }) {
    if (!title || !title.trim()) {
      throw new AppError('Task title is required', 422, ErrorCodes.VALIDATION_ERROR);
    }
    if (!instructions || !instructions.trim()) {
      throw new AppError('Task instructions are required', 422, ErrorCodes.VALIDATION_ERROR);
    }
    if (!deadline) {
      throw new AppError('Deadline is required', 422, ErrorCodes.VALIDATION_ERROR);
    }

    const taskId = await tasksRepository.createTask({
      session_id: sessionId,
      class_id: classId,
      subject_id: subjectId,
      teacher_id: teacherId,
      title,
      instructions,
      assigned_date: assignedDate || new Date().toISOString().split('T')[0],
      deadline: new Date(deadline),
      total_marks: totalMarks,
      grading_scale: gradingScale,
      rubric_criteria: rubricCriteria ? JSON.stringify(rubricCriteria) : null,
      handout_url: handoutUrl,
      handout_name: handoutName,
      status: 'ACTIVE',
      created_by: createdBy
    });

    const createdTask = await tasksRepository.findTaskById(taskId);

    notificationService.notify({
      title: 'New Assignment Published',
      message: `Assignment "${title}" has been published for Class ${classId}. Deadline: ${new Date(deadline).toLocaleDateString()}.`,
      type: 'Operational Update',
      targetRole: 'ALL',
      relatedRecordId: taskId,
      relatedRecordType: 'Task',
      priority: 'Medium'
    });

    return createdTask;
  },

  async getTasks(filters) {
    return await tasksRepository.getTasks(filters);
  },

  async getTaskById(id) {
    const task = await tasksRepository.findTaskById(id);
    if (!task) {
      throw new AppError('Task not found', 404, ErrorCodes.NOT_FOUND);
    }
    return task;
  },

  async submitTask({ taskId, studentId, fileUrl, fileName, fileSize, studentNotes }) {
    const task = await tasksRepository.findTaskById(taskId);
    if (!task) {
      throw new AppError('Task not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (task.status !== 'ACTIVE') {
      throw new AppError('Task is no longer accepting submissions', 422, ErrorCodes.POLICY_VIOLATION);
    }

    // Determine if submission is late
    const now = Date.now();
    const deadlineMs = parseDbDate(task.deadline).getTime();
    const isLate = now > deadlineMs;

    const subId = await tasksRepository.submitTask({
      taskId,
      studentId,
      fileUrl,
      fileName,
      fileSize,
      studentNotes,
      isLate
    });

    let teacherUserId = null;
    try {
      const teacher = await db('teachers').where({ id: task.teacher_id }).first();
      teacherUserId = teacher?.user_id;
    } catch (_) {}

    notificationService.notify({
      userId: teacherUserId,
      title: 'Student Submission Received',
      message: `A coursework submission was turned in for "${task.title}".`,
      type: 'Operational Update',
      targetRole: 'TEACHER',
      relatedRecordId: subId,
      relatedRecordType: 'Task',
      priority: 'Medium'
    });

    return await tasksRepository.findSubmissionById(subId);
  },

  async getSubmissions(filters) {
    return await tasksRepository.getSubmissions(filters);
  },

  async gradeSubmission({ submissionId, marksAwarded, rubricScores, feedback, gradedBy }) {
    const submission = await tasksRepository.findSubmissionById(submissionId);
    if (!submission) {
      throw new AppError('Submission not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (marksAwarded !== undefined && marksAwarded !== null) {
      const numMarks = Number(marksAwarded);
      if (numMarks < 0 || numMarks > Number(submission.maxMarks)) {
        throw new AppError(
          `Marks awarded (${numMarks}) must be between 0 and total marks (${submission.maxMarks})`,
          422,
          ErrorCodes.VALIDATION_ERROR
        );
      }
    }

    const updated = await tasksRepository.gradeSubmission({
      submissionId,
      marksAwarded: marksAwarded !== undefined ? Number(marksAwarded) : null,
      rubricScores,
      feedback,
      gradedBy
    });

    return updated;
  },

  // Resources
  async createResource({ classId, subjectId, title, description, resourceType, fileUrl, fileSize, isPublished, uploadedBy }) {
    if (!title || !title.trim()) {
      throw new AppError('Resource title is required', 422, ErrorCodes.VALIDATION_ERROR);
    }
    if (!fileUrl || !fileUrl.trim()) {
      throw new AppError('Resource file URL or link is required', 422, ErrorCodes.VALIDATION_ERROR);
    }

    const id = await tasksRepository.createResource({
      class_id: classId,
      subject_id: subjectId,
      uploaded_by: uploadedBy,
      title,
      description: description || null,
      resource_type: (resourceType || 'PDF').toUpperCase(),
      file_url: fileUrl,
      file_size: fileSize || null,
      is_published: isPublished !== undefined ? (isPublished ? 1 : 0) : 1
    });

    return { id, title, fileUrl };
  },

  async getResources(filters) {
    return await tasksRepository.getResources(filters);
  },

  async deleteResource(id) {
    return await tasksRepository.deleteResource(id);
  },

  // Achievements & Recognition (SRS Section 8.3 & 12)
  async awardAchievement({ studentId, teacherUserId, classId, badgeType, title, reason, starsCount }) {
    if (!title || !title.trim()) {
      throw new AppError('Achievement title is required', 422, ErrorCodes.VALIDATION_ERROR);
    }
    if (!reason || !reason.trim()) {
      throw new AppError('Achievement reason or description is required', 422, ErrorCodes.VALIDATION_ERROR);
    }

    let teacherId = teacherUserId;
    const teacherRow = await db('teachers').where({ user_id: teacherUserId }).first();
    if (teacherRow) {
      teacherId = teacherRow.id;
    }

    const id = await tasksRepository.awardAchievement({
      studentId: Number(studentId),
      teacherId,
      classId: Number(classId),
      badgeType: badgeType || 'star',
      title,
      reason,
      starsCount: starsCount ? Number(starsCount) : 3
    });

    return { id, studentId, teacherId, classId, badgeType, title, starsCount };
  },

  async getAchievements(filters = {}) {
    return await tasksRepository.getAchievements(filters);
  }
};
