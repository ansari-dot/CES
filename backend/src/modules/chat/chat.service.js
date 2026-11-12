import { db } from '../../shared/db/knex.js';
import { chatRepository } from './chat.repository.js';
import { sanitizeChatMessage } from './chat.dlp.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { getSocketServer } from '../../shared/realtime/socket.js';

export const chatService = {
  /**
   * Helper: Get current active academic session
   */
  async getCurrentSessionId() {
    const session = await db('academic_sessions').where('is_current', 1).first();
    return session ? session.id : 1;
  },

  /**
   * Strict Academic Relationship Validation:
   * 1. Teacher must teach this class and subject.
   * 2. Student must be actively enrolled in this class.
   */
  async validateAssignmentScope({ teacherId, studentId, classId, subjectId, sessionId }) {
    // 1. Verify Teacher assignment (direct or via timetable)
    const isTeacherAssigned = await db('teacher_assignments')
      .where({
        teacher_id: teacherId,
        class_id: classId,
        subject_id: subjectId
      })
      .first();

    const isSlotAssigned = isTeacherAssigned ? true : await db('timetable_slots')
      .where({
        teacher_id: teacherId,
        class_id: classId,
        subject_id: subjectId
      })
      .first();

    if (!isTeacherAssigned && !isSlotAssigned) {
      throw new AppError(
        'Teacher is not officially assigned to teach this class and subject.',
        403,
        ErrorCodes.FORBIDDEN
      );
    }

    // 2. Verify Student enrollment or current class
    const enrollment = await db('enrollments')
      .where({
        student_id: studentId,
        class_id: classId,
        status: 'ACTIVE'
      })
      .first();

    const studentRecord = enrollment ? true : await db('students')
      .where({
        id: studentId,
        current_class_id: classId,
        status: 'ACTIVE'
      })
      .first();

    if (!enrollment && !studentRecord) {
      throw new AppError(
        'Student is not actively enrolled in this class.',
        403,
        ErrorCodes.FORBIDDEN
      );
    }

    return true;
  },

  /**
   * Start or retrieve a conversation thread between an authorized teacher and student
   */
  async getOrCreateThread({ userId, userRole, classId, subjectId, targetStudentId, targetTeacherId }) {
    const sessionId = await this.getCurrentSessionId();

    let teacherId = null;
    let studentId = null;

    if (userRole === 'TEACHER') {
      const teacher = await db('teachers').where({ user_id: userId }).first();
      if (!teacher) throw new AppError('Teacher profile not found', 404, ErrorCodes.NOT_FOUND);
      teacherId = teacher.id;
      studentId = Number(targetStudentId);
      if (!studentId) throw new AppError('Student ID is required', 400, ErrorCodes.BAD_REQUEST);
    } else if (userRole === 'STUDENT') {
      const student = await db('students').where({ user_id: userId }).first();
      if (!student) throw new AppError('Student profile not found', 404, ErrorCodes.NOT_FOUND);
      studentId = student.id;
      teacherId = Number(targetTeacherId);
      if (!teacherId) throw new AppError('Teacher ID is required', 400, ErrorCodes.BAD_REQUEST);
    } else {
      throw new AppError('Only teachers and students can create direct chat threads.', 403, ErrorCodes.FORBIDDEN);
    }

    await this.validateAssignmentScope({
      teacherId,
      studentId,
      classId: Number(classId),
      subjectId: Number(subjectId),
      sessionId
    });

    let thread = await chatRepository.findThreadByScope({
      sessionId,
      classId: Number(classId),
      subjectId: Number(subjectId),
      teacherId,
      studentId
    });

    if (!thread) {
      thread = await chatRepository.createThread({
        sessionId,
        classId: Number(classId),
        subjectId: Number(subjectId),
        teacherId,
        studentId
      });
    } else {
      thread = await chatRepository.findThreadById(thread.id);
    }

    return thread;
  },

  /**
   * Get all conversation threads for the logged-in teacher
   */
  async getTeacherThreads(userId, { classId, isArchived } = {}) {
    const teacher = await db('teachers').where({ user_id: userId }).first();
    if (!teacher) throw new AppError('Teacher record not found', 404, ErrorCodes.NOT_FOUND);

    const sessionId = await this.getCurrentSessionId();
    const threads = await chatRepository.getTeacherThreads(teacher.id, {
      sessionId,
      classId: classId ? Number(classId) : undefined,
      isArchived: Boolean(isArchived)
    });

    // 1. Direct assignments from teacher_assignments
    const directAssignments = await db('teacher_assignments as ta')
      .join('classes as c', 'ta.class_id', 'c.id')
      .join('subjects as s', 'ta.subject_id', 's.id')
      .where('ta.teacher_id', teacher.id)
      .select('c.id as classId', 'c.name as className', 'c.grade_level as gradeLevel', 's.id as subjectId', 's.name as subjectName', 's.code as subjectCode');

    // 2. Slot assignments from timetable_slots
    const slotAssignments = await db('timetable_slots as ts')
      .join('classes as c', 'ts.class_id', 'c.id')
      .join('subjects as s', 'ts.subject_id', 's.id')
      .where('ts.teacher_id', teacher.id)
      .select('c.id as classId', 'c.name as className', 'c.grade_level as gradeLevel', 's.id as subjectId', 's.name as subjectName', 's.code as subjectCode');

    const merged = new Map();
    for (const a of [...directAssignments, ...slotAssignments]) {
      const key = `${a.classId}-${a.subjectId}`;
      if (!merged.has(key)) {
        merged.set(key, a);
      }
    }
    const taughtSubjects = Array.from(merged.values());

    return { threads, taughtSubjects };
  },

  /**
   * Get all conversation threads and available teachers for the logged-in student
   */
  async getStudentThreads(userId, { isArchived } = {}) {
    const student = await db('students').where({ user_id: userId }).first();
    if (!student) throw new AppError('Student record not found', 404, ErrorCodes.NOT_FOUND);

    const sessionId = await this.getCurrentSessionId();
    const threads = await chatRepository.getStudentThreads(student.id, {
      sessionId,
      isArchived: Boolean(isArchived)
    });

    // Find student's active enrolled class
    const enrollment = await db('enrollments as e')
      .join('classes as c', 'e.class_id', 'c.id')
      .where({ 'e.student_id': student.id, 'e.session_id': sessionId, 'e.status': 'ACTIVE' })
      .select('c.id as classId', 'c.name as className', 'c.grade_level as gradeLevel')
      .first();

    // Find all faculty assigned to teach subjects in the student's class (direct or via timetable)
    let availableTeachers = [];
    if (enrollment) {
      const directTeachers = await db('teacher_assignments as ta')
        .join('subjects as s', 'ta.subject_id', 's.id')
        .join('teachers as t', 'ta.teacher_id', 't.id')
        .join('users as u', 't.user_id', 'u.id')
        .where({ 'ta.class_id': enrollment.classId, 'ta.session_id': sessionId })
        .select(
          'ta.class_id as classId',
          't.id as teacherId',
          'u.full_name as teacherName',
          't.designation as teacherDesignation',
          's.id as subjectId',
          's.name as subjectName',
          's.code as subjectCode'
        );

      const slotTeachers = await db('timetable_slots as ts')
        .join('subjects as s', 'ts.subject_id', 's.id')
        .join('teachers as t', 'ts.teacher_id', 't.id')
        .join('users as u', 't.user_id', 'u.id')
        .where({ 'ts.class_id': enrollment.classId })
        .select(
          'ts.class_id as classId',
          't.id as teacherId',
          'u.full_name as teacherName',
          't.designation as teacherDesignation',
          's.id as subjectId',
          's.name as subjectName',
          's.code as subjectCode'
        );

      const teacherMap = new Map();
      for (const t of [...directTeachers, ...slotTeachers]) {
        const key = `${t.teacherId}-${t.subjectId}`;
        if (!teacherMap.has(key)) {
          teacherMap.set(key, t);
        }
      }
      availableTeachers = Array.from(teacherMap.values());
    }

    return { threads, enrollment, availableTeachers };
  },

  /**
   * Get enrolled students for a teacher's class
   */
  async getClassStudents(userId, classId) {
    const teacher = await db('teachers').where({ user_id: userId }).first();
    if (!teacher) throw new AppError('Teacher record not found', 404, ErrorCodes.NOT_FOUND);

    // Verify teacher is assigned to this class (direct or via timetable)
    const isTeacherAssigned = await db('teacher_assignments')
      .where({ teacher_id: teacher.id, class_id: Number(classId) })
      .first();

    const isSlotAssigned = isTeacherAssigned ? true : await db('timetable_slots')
      .where({ teacher_id: teacher.id, class_id: Number(classId) })
      .first();

    if (!isTeacherAssigned && !isSlotAssigned) {
      throw new AppError('You are not assigned to this class.', 403, ErrorCodes.FORBIDDEN);
    }

    const students = await db('students as st')
      .join('users as u', 'st.user_id', 'u.id')
      .where(function () {
        this.where('st.current_class_id', Number(classId))
          .orWhereExists(function () {
            this.select('*')
              .from('enrollments as e')
              .whereRaw('e.student_id = st.id')
              .where('e.class_id', Number(classId))
              .where('e.status', 'ACTIVE');
          });
      })
      .where('st.status', 'ACTIVE')
      .select(
        'st.id as studentId',
        'st.roll_no as rollNumber',
        'st.admission_no as admissionNo',
        'u.full_name as studentName',
        'u.email as studentEmail',
        'u.id as userId'
      )
      .orderBy('studentName', 'asc');

    // Ensure rollNumber has a fallback for clean display
    return students.map((s) => ({
      ...s,
      rollNumber: s.rollNumber || s.admissionNo || `ST-${s.studentId}`
    }));
  },

  /**
   * Get paginated messages for a thread after strict role verification
   */
  async getThreadMessages({ threadId, userId, userRole, page = 1, limit = 50, beforeId = null, ipAddress = null }) {
    const thread = await chatRepository.findThreadById(threadId);
    if (!thread) {
      throw new AppError('Conversation thread not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Role-based verification
    if (userRole === 'TEACHER') {
      const teacher = await db('teachers').where({ user_id: userId }).first();
      if (!teacher || Number(teacher.id) !== Number(thread.teacher_id)) {
        throw new AppError('You are not authorized to view this conversation.', 403, ErrorCodes.FORBIDDEN);
      }
    } else if (userRole === 'STUDENT') {
      const student = await db('students').where({ user_id: userId }).first();
      if (!student || Number(student.id) !== Number(thread.student_id)) {
        throw new AppError('You are not authorized to view this conversation.', 403, ErrorCodes.FORBIDDEN);
      }
    } else if (userRole === 'PRINCIPAL' || userRole === 'ADMIN') {
      // Oversight access allowed -> Record audit log
      await chatRepository.logAuditAction({
        actorUserId: userId,
        actorRole: userRole,
        action: 'THREAD_ACCESSED',
        threadId: thread.id,
        details: { threadScope: `${thread.className} - ${thread.subjectName}`, teacher: thread.teacherName, student: thread.studentName },
        ipAddress
      });
    } else {
      throw new AppError('Access denied.', 403, ErrorCodes.FORBIDDEN);
    }

    const messages = await chatRepository.getThreadMessages(threadId, { page, limit, beforeId });
    return { thread, messages };
  },

  /**
   * Send a text message with automatic DLP phone number masking & policy enforcement
   */
  async sendMessage({ threadId, userId, userRole, content }) {
    if (!content || typeof content !== 'string' || !content.trim()) {
      throw new AppError('Message content cannot be empty.', 400, ErrorCodes.BAD_REQUEST);
    }

    const trimmed = content.trim();
    if (trimmed.length > 2000) {
      throw new AppError('Message exceeds maximum allowed length of 2,000 characters.', 400, ErrorCodes.BAD_REQUEST);
    }

    const thread = await chatRepository.findThreadById(threadId);
    if (!thread) {
      throw new AppError('Conversation thread not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Authorization
    let senderRole = null;
    let recipientUserId = null;

    if (userRole === 'TEACHER') {
      const teacher = await db('teachers').where({ user_id: userId }).first();
      if (!teacher || Number(teacher.id) !== Number(thread.teacher_id)) {
        throw new AppError('You are not authorized to send messages in this thread.', 403, ErrorCodes.FORBIDDEN);
      }
      senderRole = 'TEACHER';
      recipientUserId = thread.studentUserId;
    } else if (userRole === 'STUDENT') {
      const student = await db('students').where({ user_id: userId }).first();
      if (!student || Number(student.id) !== Number(thread.student_id)) {
        throw new AppError('You are not authorized to send messages in this thread.', 403, ErrorCodes.FORBIDDEN);
      }
      senderRole = 'STUDENT';
      recipientUserId = thread.teacherUserId;
    } else {
      throw new AppError('Administrative users have read-only oversight and cannot send messages.', 403, ErrorCodes.FORBIDDEN);
    }

    // Apply DLP phone number masking engine (original is NEVER stored or broadcast)
    const dlpResult = sanitizeChatMessage(trimmed);

    const message = await chatRepository.createMessage({
      threadId: thread.id,
      senderUserId: userId,
      senderRole,
      content: dlpResult.cleanContent,
      wasMasked: dlpResult.hasViolation,
      hasPolicyViolation: dlpResult.hasViolation,
      policyViolationType: dlpResult.violationType
    });

    // Real-time broadcast via Socket.IO
    const io = getSocketServer();
    if (io) {
      const payload = {
        threadId: thread.id,
        message,
        senderRole,
        senderUserId: userId
      };

      // 1. Broadcast to thread room
      io.to(`chat:thread:${thread.id}`).emit('chat:message', payload);

      // 2. Broadcast unread update to recipient's personal user room
      if (recipientUserId) {
        io.to(`user:${recipientUserId}`).emit('chat:unread_update', {
          threadId: thread.id,
          lastMessagePreview: message.content.substring(0, 80),
          lastMessageAt: message.created_at,
          senderName: message.senderName
        });
      }
    }

    let policyWarning = null;
    if (dlpResult.hasViolation) {
      policyWarning = 'Personal contact details and phone numbers are restricted by Cambridge School safety policy. The phone number was masked with *** before sending.';
    }

    return { message, policyWarning };
  },

  /**
   * Mark all unread messages in a thread as read
   */
  async markAsRead({ threadId, userId, userRole }) {
    const thread = await chatRepository.findThreadById(threadId);
    if (!thread) throw new AppError('Thread not found', 404, ErrorCodes.NOT_FOUND);

    let readerRole = null;
    let senderUserId = null;

    if (userRole === 'TEACHER') {
      const teacher = await db('teachers').where({ user_id: userId }).first();
      if (!teacher || Number(teacher.id) !== Number(thread.teacher_id)) {
        throw new AppError('Unauthorized', 403, ErrorCodes.FORBIDDEN);
      }
      readerRole = 'TEACHER';
      senderUserId = thread.studentUserId;
    } else if (userRole === 'STUDENT') {
      const student = await db('students').where({ user_id: userId }).first();
      if (!student || Number(student.id) !== Number(thread.student_id)) {
        throw new AppError('Unauthorized', 403, ErrorCodes.FORBIDDEN);
      }
      readerRole = 'STUDENT';
      senderUserId = thread.teacherUserId;
    } else {
      return { success: true };
    }

    await chatRepository.markThreadAsRead(thread.id, readerRole, userId);

    // Broadcast read receipt over socket
    const io = getSocketServer();
    if (io) {
      io.to(`chat:thread:${thread.id}`).emit('chat:read', {
        threadId: thread.id,
        readByRole: readerRole,
        readAt: new Date().toISOString()
      });
      if (senderUserId) {
        io.to(`user:${senderUserId}`).emit('chat:read_receipt', {
          threadId: thread.id,
          readByRole: readerRole
        });
      }
    }

    return { success: true };
  },

  /**
   * Principal & Administrative Oversight
   */
  async getPrincipalOversight({ userId, userRole, filters = {}, ipAddress = null }) {
    if (userRole !== 'PRINCIPAL' && userRole !== 'ADMIN') {
      throw new AppError('Unauthorized oversight access.', 403, ErrorCodes.FORBIDDEN);
    }

    const sessionId = filters.sessionId ? Number(filters.sessionId) : await this.getCurrentSessionId();

    const data = await chatRepository.getPrincipalThreads({
      sessionId,
      classId: filters.classId ? Number(filters.classId) : undefined,
      subjectId: filters.subjectId ? Number(filters.subjectId) : undefined,
      teacherId: filters.teacherId ? Number(filters.teacherId) : undefined,
      studentId: filters.studentId ? Number(filters.studentId) : undefined,
      hasViolationsOnly: Boolean(filters.hasViolationsOnly),
      page: filters.page ? Number(filters.page) : 1,
      limit: filters.limit ? Number(filters.limit) : 50
    });

    // Summary statistics for Principal
    const [totalThreadsRow] = await db('chat_threads').count('id as total');
    const [totalMessagesRow] = await db('chat_messages').count('id as total');
    const [totalViolationsRow] = await db('chat_messages').where('has_policy_violation', 1).count('id as total');

    await chatRepository.logAuditAction({
      actorUserId: userId,
      actorRole: userRole,
      action: 'REPORT_VIEWED',
      details: { filters, totalThreads: totalThreadsRow?.total },
      ipAddress
    });

    return {
      ...data,
      metrics: {
        totalThreads: Number(totalThreadsRow?.total || 0),
        totalMessages: Number(totalMessagesRow?.total || 0),
        totalViolations: Number(totalViolationsRow?.total || 0)
      }
    };
  }
};

