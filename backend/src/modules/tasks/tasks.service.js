import fs from 'fs';
import path from 'path';
import { tasksRepository, studentTaskView } from './tasks.repository.js';
import { parseDbDate } from '../../shared/utils/date.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { notificationService } from '../../shared/services/notificationService.js';
import { UPLOAD_ROOT } from '../../shared/storage/upload.js';
import { db } from '../../shared/db/knex.js';
import {
  isStaff,
  forbidden,
  getTeacherScope,
  getStudentByUserId,
  getCurrentSessionId,
  getClassAudienceUserIds
} from '../../shared/services/accessScope.js';

const TASK_TYPES = ['ASSIGNMENT', 'QUIZ', 'TEST', 'EXAM'];
const TASK_TYPE_LABELS = { ASSIGNMENT: 'Assignment', QUIZ: 'Quiz', TEST: 'Test', EXAM: 'Examination' };
const RESOURCE_TYPES = ['SLIDES', 'PDF', 'RECORDING', 'DOCUMENT', 'LINK'];
const BADGE_TYPES = ['star', 'medal', 'trophy', 'certificate', 'feedback'];

function validationError(message) {
  return new AppError(message, 422, ErrorCodes.VALIDATION_ERROR);
}

function notFound(message) {
  return new AppError(message, 404, ErrorCodes.NOT_FOUND);
}

function toBool(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
}

function parseMarks(value, maxMarks) {
  if (value === undefined || value === null || value === '') {
    throw validationError('Marks are required');
  }
  const num = Number(value);
  if (!Number.isFinite(num)) throw validationError('Marks must be a number');
  if (num < 0 || num > Number(maxMarks)) {
    throw validationError(`Marks (${num}) must be between 0 and the maximum marks (${maxMarks})`);
  }
  return Math.round(num * 100) / 100;
}

function removeUploadedFile(fileUrl) {
  if (!fileUrl || !String(fileUrl).startsWith('/api/v1/uploads/')) return;
  const filePath = path.join(UPLOAD_ROOT, path.basename(fileUrl));
  fs.promises.unlink(filePath).catch(() => {});
}

/** The teacher who will own a record for the given class/subject. */
async function resolveOwningTeacher(user, classId, subjectId, explicitTeacherId = null) {
  if (user.role === 'TEACHER') {
    const scope = await getTeacherScope(user.id);
    if (!scope.teacher) throw forbidden('Teacher profile not found for this account.');
    if (!scope.pairs.has(`${classId}-${subjectId}`)) {
      throw forbidden('You are not assigned to teach this subject in the selected class.');
    }
    return scope.teacher.id;
  }

  if (isStaff(user)) {
    if (explicitTeacherId) return Number(explicitTeacherId);
    const assignment = await db('teacher_assignments')
      .where({ class_id: classId, subject_id: subjectId })
      .orderBy('id', 'desc')
      .first();
    if (!assignment) throw validationError('No teacher is assigned to this class and subject.');
    return assignment.teacher_id;
  }

  throw forbidden('Your role cannot manage coursework.');
}

async function assertTaskManager(user, task) {
  if (isStaff(user)) return;
  if (user.role === 'TEACHER') {
    const teacher = await db('teachers').where({ user_id: user.id }).first();
    if (teacher && Number(teacher.id) === Number(task.teacherId)) return;
    throw forbidden('You can only manage assessments you created.');
  }
  throw forbidden();
}

async function notifyTaskPublished(task, { notifyParents = true } = {}) {
  const typeLabel = TASK_TYPE_LABELS[task.taskType] || 'Assignment';
  const deadline = parseDbDate(task.deadline);
  const recipients = await getClassAudienceUserIds([task.classId], { includeStudents: true, includeParents: notifyParents });
  await notificationService.notifyUsers(recipients, {
    title: `New ${typeLabel} Published`,
    message: `${task.subjectName}: "${task.title}" for ${task.className}.${
      deadline ? ` Due ${deadline.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.` : ''
    }`,
    type: 'Assignment Published',
    targetRole: 'ALL',
    relatedRecordId: task.id,
    relatedRecordType: 'Task',
    priority: 'Medium'
  });
}

async function notifyGradePublished(submission) {
  const recipients = await getClassAudienceUserIds([], {
    includeStudents: true,
    includeParents: true,
    studentIds: [submission.studentId]
  });
  await notificationService.notifyUsers(recipients, {
    title: 'Result Published',
    message: `${submission.subjectName}: "${submission.taskTitle}" graded ${Number(submission.marksAwarded)}/${submission.maxMarks}.`,
    type: 'Result Published',
    targetRole: 'ALL',
    relatedRecordId: submission.id,
    relatedRecordType: 'Submission',
    priority: 'Medium'
  });
}

function maskForStudent(submission) {
  if (submission.status === 'GRADED') return submission;
  return {
    ...submission,
    marksAwarded: null,
    rubricScores: null,
    feedback: submission.status === 'RESUBMIT_REQUESTED' ? submission.feedback : null
  };
}

export const tasksService = {
  async createTask(user, payload, file = null) {
    const title = String(payload.title || '').trim();
    const instructions = String(payload.instructions || '').trim();
    if (!title) throw validationError('Task title is required');
    if (!instructions) throw validationError('Task instructions are required');

    const classId = Number(payload.classId);
    const subjectId = Number(payload.subjectId);
    if (!classId || !subjectId) throw validationError('Class and subject are required');

    if (!payload.deadline || Number.isNaN(new Date(payload.deadline).getTime())) {
      throw validationError('A valid due date and time is required');
    }

    const totalMarks = Number(payload.totalMarks ?? 20);
    if (!Number.isInteger(totalMarks) || totalMarks < 1 || totalMarks > 1000) {
      throw validationError('Maximum marks must be a whole number between 1 and 1000');
    }

    const taskType = String(payload.taskType || 'ASSIGNMENT').toUpperCase();
    if (!TASK_TYPES.includes(taskType)) throw validationError('Invalid assessment type');

    const status = String(payload.status || 'ACTIVE').toUpperCase() === 'DRAFT' ? 'DRAFT' : 'ACTIVE';
    const gradingScale = ['NUMERIC', 'RUBRIC', 'LETTER'].includes(String(payload.gradingScale || '').toUpperCase())
      ? String(payload.gradingScale).toUpperCase()
      : 'NUMERIC';

    const teacherId = await resolveOwningTeacher(user, classId, subjectId, payload.teacherId);
    const sessionId = (isStaff(user) && payload.sessionId ? Number(payload.sessionId) : null) || (await getCurrentSessionId());
    if (!sessionId) throw validationError('No academic session is configured');

    const taskId = await tasksRepository.createTask({
      session_id: sessionId,
      class_id: classId,
      subject_id: subjectId,
      teacher_id: teacherId,
      title,
      instructions,
      task_type: taskType,
      assigned_date: payload.assignedDate || new Date().toISOString().split('T')[0],
      deadline: new Date(payload.deadline),
      total_marks: totalMarks,
      grading_scale: gradingScale,
      rubric_criteria: payload.rubricCriteria ? JSON.stringify(payload.rubricCriteria) : null,
      handout_url: file ? `/api/v1/uploads/${file.filename}` : null,
      handout_name: file ? file.originalname : null,
      status,
      created_by: user.id
    });

    const createdTask = await tasksRepository.findTaskById(taskId);
    if (status === 'ACTIVE') {
      notifyTaskPublished(createdTask, { notifyParents: toBool(payload.notifyParents, true) });
    }
    return createdTask;
  },

  async getTasks(user, filters = {}) {
    if (user.role === 'STUDENT') {
      const student = await getStudentByUserId(user.id);
      if (!student) return [];
      return await tasksRepository.getTasks({
        classId: student.current_class_id,
        subjectId: filters.subjectId,
        taskType: filters.taskType,
        statuses: ['ACTIVE', 'ARCHIVED'],
        studentId: student.id
      });
    }

    if (user.role === 'TEACHER') {
      const teacher = await db('teachers').where({ user_id: user.id }).first();
      if (!teacher) return [];
      return await tasksRepository.getTasks({ ...filters, teacherId: teacher.id, studentId: null });
    }

    if (isStaff(user)) {
      return await tasksRepository.getTasks({ ...filters, studentId: null });
    }

    throw forbidden('Use the parent portal endpoints to view your child\'s assignments.');
  },

  async getTaskById(user, id) {
    const task = await tasksRepository.findTaskById(id);
    if (!task) throw notFound('Task not found');

    if (user.role === 'STUDENT') {
      const student = await getStudentByUserId(user.id);
      if (!student || Number(student.current_class_id) !== Number(task.classId) || task.status === 'DRAFT') {
        throw notFound('Task not found');
      }
      const sub = await tasksRepository.findSubmissionByTaskAndStudent(task.id, student.id);
      return { ...task, ...studentTaskView(task, sub) };
    }

    await assertTaskManager(user, task);
    return task;
  },

  async updateTaskStatus(user, id, status) {
    const task = await tasksRepository.findTaskById(id);
    if (!task) throw notFound('Task not found');
    await assertTaskManager(user, task);

    const next = String(status || '').toUpperCase();
    if (!['DRAFT', 'ACTIVE', 'ARCHIVED'].includes(next)) throw validationError('Invalid task status');
    if (next === 'DRAFT' && task.submittedCount > 0) {
      throw validationError('A task that already has submissions cannot be moved back to draft');
    }

    await tasksRepository.updateTask(id, { status: next });
    const updated = await tasksRepository.findTaskById(id);
    if (task.status === 'DRAFT' && next === 'ACTIVE') notifyTaskPublished(updated);
    return updated;
  },

  async submitTask(user, taskId, { file = null, studentNotes = null }) {
    if (user.role !== 'STUDENT') throw forbidden('Only students can submit assignments.');
    const student = await getStudentByUserId(user.id);
    if (!student) throw notFound('Student profile not found');

    const task = await tasksRepository.findTaskById(taskId);
    if (!task || Number(task.classId) !== Number(student.current_class_id) || task.status === 'DRAFT') {
      throw notFound('Task not found');
    }
    if (task.status !== 'ACTIVE') {
      throw new AppError('Task is no longer accepting submissions', 422, ErrorCodes.POLICY_VIOLATION);
    }

    const notes = studentNotes ? String(studentNotes).trim() : '';
    if (!file && !notes) throw validationError('Attach your work or add a note before submitting');

    const existing = await tasksRepository.findSubmissionByTaskAndStudent(task.id, student.id);
    if (existing && existing.status === 'GRADED') {
      throw new AppError('This assignment has already been graded and cannot be resubmitted.', 409, ErrorCodes.CONFLICT);
    }
    if (existing && existing.status !== 'RESUBMIT_REQUESTED') {
      throw new AppError(
        'You have already submitted this assignment. You can submit again only if your teacher returns it for resubmission.',
        409,
        ErrorCodes.CONFLICT
      );
    }

    const deadline = parseDbDate(task.deadline);
    const isLate = deadline ? Date.now() > deadline.getTime() : false;

    const previousFileUrl = existing?.file_url || null;
    const subId = await tasksRepository.submitTask({
      taskId: task.id,
      studentId: student.id,
      fileUrl: file ? `/api/v1/uploads/${file.filename}` : null,
      fileName: file ? file.originalname : null,
      fileSize: file ? `${(file.size / (1024 * 1024)).toFixed(1)} MB` : null,
      studentNotes: notes || null,
      isLate
    });
    if (file && previousFileUrl) removeUploadedFile(previousFileUrl);

    const teacher = await db('teachers').where({ id: task.teacherId }).first();
    if (teacher) {
      notificationService.notifyUsers([teacher.user_id], {
        title: existing ? 'Assignment Resubmitted' : 'Student Submission Received',
        message: `A submission was turned in for "${task.title}" (${task.className}).${isLate ? ' Submitted after the deadline.' : ''}`,
        type: 'Submission Received',
        targetRole: 'TEACHER',
        relatedRecordId: subId,
        relatedRecordType: 'Submission',
        priority: 'Medium'
      });
    }

    const saved = await tasksRepository.findSubmissionById(subId);
    return maskForStudent(saved);
  },

  async getSubmissions(user, { taskId = null, studentId = null, status = null } = {}) {
    if (user.role === 'STUDENT') {
      const student = await getStudentByUserId(user.id);
      if (!student) return [];
      const subs = await tasksRepository.getSubmissions({ taskId, studentId: student.id, status });
      return subs.map(maskForStudent);
    }

    if (user.role === 'TEACHER') {
      const teacher = await db('teachers').where({ user_id: user.id }).first();
      if (!teacher) return [];
      return await tasksRepository.getSubmissions({ taskId, studentId, status, teacherId: teacher.id });
    }

    if (isStaff(user)) {
      return await tasksRepository.getSubmissions({ taskId, studentId, status });
    }

    throw forbidden('Use the parent portal endpoints to view your child\'s work.');
  },

  async gradeSubmission(user, submissionId, { marksAwarded, rubricScores, feedback, publish = true }) {
    const submission = await tasksRepository.findSubmissionById(submissionId);
    if (!submission) throw notFound('Submission not found');
    await assertTaskManager(user, submission);

    const marks = parseMarks(marksAwarded, submission.maxMarks);
    const shouldPublish = toBool(publish, true);
    const text = feedback ? String(feedback).trim().slice(0, 2000) : null;

    const updated = await tasksRepository.gradeSubmission({
      submissionId: submission.id,
      marksAwarded: marks,
      rubricScores: rubricScores || null,
      feedback: text,
      gradedBy: user.id,
      publish: shouldPublish,
      currentStatus: submission.status
    });

    if (shouldPublish) notifyGradePublished(updated);
    return updated;
  },

  async returnSubmission(user, submissionId, note) {
    const submission = await tasksRepository.findSubmissionById(submissionId);
    if (!submission) throw notFound('Submission not found');
    await assertTaskManager(user, submission);

    const text = String(note || '').trim();
    if (!text) throw validationError('Please add instructions for the resubmission');

    const updated = await tasksRepository.returnSubmission({ submissionId: submission.id, note: text.slice(0, 2000), gradedBy: user.id });

    const recipients = await getClassAudienceUserIds([], { includeStudents: true, studentIds: [submission.studentId] });
    notificationService.notifyUsers(recipients, {
      title: 'Resubmission Requested',
      message: `Your teacher returned "${submission.taskTitle}" for resubmission: ${text.slice(0, 200)}`,
      type: 'Assignment Returned',
      targetRole: 'STUDENT',
      relatedRecordId: submission.taskId,
      relatedRecordType: 'Task',
      priority: 'High'
    });

    return updated;
  },

  async getTaskRoster(user, taskId) {
    const task = await tasksRepository.findTaskById(taskId);
    if (!task) throw notFound('Task not found');
    await assertTaskManager(user, task);
    return { task, students: await tasksRepository.getTaskRoster(task) };
  },

  async recordMarks(user, taskId, { entries, publish }) {
    const task = await tasksRepository.findTaskById(taskId);
    if (!task) throw notFound('Task not found');
    await assertTaskManager(user, task);

    if (!Array.isArray(entries) || entries.length === 0) throw validationError('Enter marks for at least one student');

    const roster = await tasksRepository.getTaskRoster(task);
    const rosterIds = new Set(roster.map((r) => Number(r.studentId)));
    const seen = new Set();

    const clean = entries.map((e) => {
      const studentId = Number(e.studentId);
      if (!rosterIds.has(studentId)) throw validationError(`Student ${e.studentId} is not enrolled in ${task.className}`);
      if (seen.has(studentId)) throw validationError('Each student can only appear once');
      seen.add(studentId);
      return {
        studentId,
        marksAwarded: parseMarks(e.marksAwarded, task.totalMarks),
        feedback: e.feedback ? String(e.feedback).trim().slice(0, 2000) : null
      };
    });

    const shouldPublish = toBool(publish, true);
    const saved = await tasksRepository.upsertMarks({ taskId: task.id, entries: clean, gradedBy: user.id, publish: shouldPublish });

    if (shouldPublish) {
      const recipients = await getClassAudienceUserIds([], {
        includeStudents: true,
        includeParents: true,
        studentIds: clean.map((c) => c.studentId)
      });
      notificationService.notifyUsers(recipients, {
        title: 'Result Published',
        message: `${task.subjectName}: results for "${task.title}" are now available.`,
        type: 'Result Published',
        targetRole: 'ALL',
        relatedRecordId: task.id,
        relatedRecordType: 'Task',
        priority: 'Medium'
      });
    }

    return { saved, published: shouldPublish, students: await tasksRepository.getTaskRoster(task) };
  },

  // Resources
  async createResource(user, payload, file = null) {
    const title = String(payload.title || '').trim();
    if (!title) throw validationError('Resource title is required');

    const classId = Number(payload.classId);
    const subjectId = Number(payload.subjectId);
    if (!classId || !subjectId) throw validationError('Class and subject are required');

    let resourceType = String(payload.resourceType || '').toUpperCase();
    if (resourceType === 'NOTES') resourceType = 'DOCUMENT';

    let fileUrl;
    let fileName = null;
    let fileSize = null;

    if (file) {
      fileUrl = `/api/v1/uploads/${file.filename}`;
      fileName = file.originalname;
      fileSize = `${(file.size / (1024 * 1024)).toFixed(1)} MB`;
      if (!RESOURCE_TYPES.includes(resourceType) || resourceType === 'LINK') {
        const mime = file.mimetype || '';
        resourceType = mime.startsWith('video')
          ? 'RECORDING'
          : mime.includes('presentation') || mime.includes('powerpoint')
          ? 'SLIDES'
          : mime === 'application/pdf'
          ? 'PDF'
          : 'DOCUMENT';
      }
    } else {
      const link = String(payload.fileUrl || '').trim();
      if (!/^https?:\/\/\S+$/i.test(link)) {
        throw validationError('Attach a file, or provide a valid http(s) link for link resources');
      }
      fileUrl = link;
      resourceType = 'LINK';
    }

    await resolveOwningTeacher(user, classId, subjectId);

    const id = await tasksRepository.createResource({
      class_id: classId,
      subject_id: subjectId,
      uploaded_by: user.id,
      title,
      description: payload.description ? String(payload.description).trim() : null,
      resource_type: resourceType,
      file_url: fileUrl,
      file_name: fileName,
      file_size: fileSize,
      is_published: toBool(payload.isPublished, true) ? 1 : 0
    });

    const resource = await tasksRepository.findResourceById(id);
    if (resource.isPublished) {
      const recipients = await getClassAudienceUserIds([classId], { includeStudents: true });
      notificationService.notifyUsers(recipients, {
        title: 'New Learning Resource',
        message: `${resource.subjectName}: "${resource.title}" was shared with ${resource.className}.`,
        type: 'Learning Resource',
        targetRole: 'STUDENT',
        relatedRecordId: id,
        relatedRecordType: 'Resource',
        priority: 'Low'
      });
    }
    return resource;
  },

  async getResources(user, filters = {}) {
    if (user.role === 'STUDENT') {
      const student = await getStudentByUserId(user.id);
      if (!student) return [];
      return await tasksRepository.getResources({
        classId: student.current_class_id,
        subjectId: filters.subjectId,
        resourceType: filters.resourceType,
        publishedOnly: true
      });
    }

    if (user.role === 'TEACHER') {
      return await tasksRepository.getResources({ ...filters, uploadedBy: user.id });
    }

    if (isStaff(user)) return await tasksRepository.getResources(filters);

    throw forbidden('Use the parent portal endpoints to view your child\'s resources.');
  },

  async updateResource(user, id, { isPublished, title, description }) {
    const resource = await tasksRepository.findResourceById(id);
    if (!resource) throw notFound('Resource not found');
    if (!isStaff(user) && Number(resource.uploadedBy) !== Number(user.id)) {
      throw forbidden('You can only manage resources you uploaded.');
    }

    const updates = {};
    if (isPublished !== undefined) updates.is_published = toBool(isPublished, true) ? 1 : 0;
    if (title !== undefined) {
      if (!String(title).trim()) throw validationError('Resource title is required');
      updates.title = String(title).trim();
    }
    if (description !== undefined) updates.description = description ? String(description).trim() : null;
    if (Object.keys(updates).length === 0) return resource;

    return await tasksRepository.updateResource(id, updates);
  },

  async deleteResource(user, id) {
    const resource = await tasksRepository.findResourceById(id);
    if (!resource) throw notFound('Resource not found');
    if (!isStaff(user) && Number(resource.uploadedBy) !== Number(user.id)) {
      throw forbidden('You can only delete resources you uploaded.');
    }
    await tasksRepository.deleteResource(id);
    removeUploadedFile(resource.fileUrl);
    return { deleted: true, id: Number(id) };
  },

  // Achievements, feedback & recognition (SRS Section 8.3 & 12)
  async awardAchievement(user, payload) {
    if (user.role !== 'TEACHER') throw forbidden('Only teachers can record achievements and feedback.');
    const scope = await getTeacherScope(user.id);
    if (!scope.teacher) throw forbidden('Teacher profile not found for this account.');

    const fields = await this.validateAchievementFields(scope, payload, true);
    const id = await tasksRepository.awardAchievement({
      ...fields,
      teacherId: scope.teacher.id,
      sessionId: await getCurrentSessionId()
    });

    const achievement = await tasksRepository.findAchievementById(id);
    if (achievement.visibility === 'PUBLISHED') {
      const recipients = await getClassAudienceUserIds([], {
        includeStudents: true,
        includeParents: true,
        studentIds: [achievement.studentId]
      });
      notificationService.notifyUsers(recipients, {
        title: fields.badgeType === 'feedback' ? 'New Teacher Feedback' : 'New Achievement Awarded',
        message: `${achievement.awardedByTeacher}: "${achievement.title}"`,
        type: 'Achievement',
        targetRole: 'ALL',
        relatedRecordId: id,
        relatedRecordType: 'Achievement',
        priority: 'Low'
      });
    }
    return achievement;
  },

  async validateAchievementFields(scope, payload, isCreate) {
    const out = {};

    if (isCreate || payload.studentId !== undefined) {
      const student = await db('students').where({ id: Number(payload.studentId) }).first();
      if (!student) throw validationError('Select a valid student');
      if (!scope.classIds.has(Number(student.current_class_id))) {
        throw forbidden('This student is not in a class assigned to you.');
      }
      out.studentId = student.id;
      out.classId = student.current_class_id;
    }

    if (isCreate || payload.title !== undefined) {
      const title = String(payload.title || '').trim();
      if (!title) throw validationError('Achievement title is required');
      out.title = title.slice(0, 255);
    }

    if (isCreate || payload.reason !== undefined) {
      const reason = String(payload.reason || '').trim();
      if (!reason) throw validationError('Achievement reason or feedback text is required');
      out.reason = reason;
    }

    if (isCreate || payload.badgeType !== undefined) {
      const badgeType = String(payload.badgeType || 'star').toLowerCase();
      if (!BADGE_TYPES.includes(badgeType)) throw validationError('Invalid badge type');
      out.badgeType = badgeType;
    }

    if (isCreate || payload.starsCount !== undefined) {
      const stars = Number(payload.starsCount ?? 0);
      if (!Number.isInteger(stars) || stars < 0 || stars > 10) throw validationError('Stars must be between 0 and 10');
      out.starsCount = stars;
    }

    if (isCreate || payload.visibility !== undefined) {
      out.visibility = String(payload.visibility || 'PUBLISHED').toUpperCase() === 'INTERNAL' ? 'INTERNAL' : 'PUBLISHED';
    }

    if (payload.subjectId !== undefined) {
      if (payload.subjectId === null || payload.subjectId === '') {
        out.subjectId = null;
      } else {
        const subjectId = Number(payload.subjectId);
        const classId = out.classId ?? payload.classIdForSubject;
        if (!scope.subjectIdsByClass.get(Number(classId))?.has(subjectId)) {
          throw forbidden('You do not teach the selected subject in this student\'s class.');
        }
        out.subjectId = subjectId;
      }
    }

    return out;
  },

  async updateAchievement(user, id, payload) {
    if (user.role !== 'TEACHER') throw forbidden('Only the awarding teacher can edit this record.');
    const scope = await getTeacherScope(user.id);
    const existing = await tasksRepository.findAchievementById(id);
    if (!existing) throw notFound('Achievement not found');
    if (!scope.teacher || Number(existing.teacherId) !== Number(scope.teacher.id)) {
      throw forbidden('You can only edit records you created.');
    }

    const fields = await this.validateAchievementFields(
      scope,
      { ...payload, classIdForSubject: existing.classId },
      false
    );

    const updates = {};
    if (fields.studentId !== undefined) {
      updates.student_id = fields.studentId;
      updates.class_id = fields.classId;
    }
    if (fields.title !== undefined) updates.title = fields.title;
    if (fields.reason !== undefined) updates.reason = fields.reason;
    if (fields.badgeType !== undefined) updates.badge_type = fields.badgeType;
    if (fields.starsCount !== undefined) updates.stars_count = fields.starsCount;
    if (fields.visibility !== undefined) updates.visibility = fields.visibility;
    if (fields.subjectId !== undefined) updates.subject_id = fields.subjectId;

    return await tasksRepository.updateAchievement(id, updates);
  },

  async deleteAchievement(user, id) {
    const existing = await tasksRepository.findAchievementById(id);
    if (!existing) throw notFound('Achievement not found');
    if (!isStaff(user)) {
      const teacher = user.role === 'TEACHER' ? await db('teachers').where({ user_id: user.id }).first() : null;
      if (!teacher || Number(teacher.id) !== Number(existing.teacherId)) {
        throw forbidden('You can only delete records you created.');
      }
    }
    await tasksRepository.deleteAchievement(id);
    return { deleted: true, id: Number(id) };
  },

  async getAchievements(user, filters = {}) {
    if (user.role === 'STUDENT') {
      const student = await getStudentByUserId(user.id);
      if (!student) return [];
      return await tasksRepository.getAchievements({ studentId: student.id, publishedOnly: true });
    }

    if (user.role === 'TEACHER') {
      const teacher = await db('teachers').where({ user_id: user.id }).first();
      if (!teacher) return [];
      return await tasksRepository.getAchievements({ ...filters, teacherId: teacher.id });
    }

    if (isStaff(user)) return await tasksRepository.getAchievements(filters);

    throw forbidden('Use the parent portal endpoints to view your child\'s achievements.');
  }
};
