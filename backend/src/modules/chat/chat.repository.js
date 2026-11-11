import { db } from '../../shared/db/knex.js';

export const chatRepository = {
  async findThreadById(threadId) {
    return await db('chat_threads as ct')
      .join('classes as c', 'ct.class_id', 'c.id')
      .join('subjects as s', 'ct.subject_id', 's.id')
      .join('teachers as t', 'ct.teacher_id', 't.id')
      .join('users as tu', 't.user_id', 'tu.id')
      .join('students as st', 'ct.student_id', 'st.id')
      .join('users as su', 'st.user_id', 'su.id')
      .where('ct.id', threadId)
      .select(
        'ct.*',
        'c.name as className',
        'c.grade_level as gradeLevel',
        's.name as subjectName',
        's.code as subjectCode',
        't.employee_no as teacherEmployeeNo',
        't.designation as teacherDesignation',
        'tu.id as teacherUserId',
        'tu.full_name as teacherName',
        'st.admission_no as studentAdmissionNo',
        'st.roll_no as studentRollNo',
        'su.id as studentUserId',
        'su.full_name as studentName'
      )
      .first();
  },

  async findThreadByScope({ sessionId, classId, subjectId, teacherId, studentId }) {
    return await db('chat_threads')
      .where({
        academic_session_id: sessionId,
        class_id: classId,
        subject_id: subjectId,
        teacher_id: teacherId,
        student_id: studentId
      })
      .first();
  },

  async createThread(data) {
    const [id] = await db('chat_threads').insert({
      academic_session_id: data.sessionId,
      class_id: data.classId,
      subject_id: data.subjectId,
      teacher_id: data.teacherId,
      student_id: data.studentId,
      created_at: db.fn.now(3),
      updated_at: db.fn.now(3)
    });
    return this.findThreadById(id);
  },

  async getTeacherThreads(teacherId, { sessionId, classId, isArchived = false }) {
    let query = db('chat_threads as ct')
      .join('classes as c', 'ct.class_id', 'c.id')
      .join('subjects as s', 'ct.subject_id', 's.id')
      .join('students as st', 'ct.student_id', 'st.id')
      .join('users as su', 'st.user_id', 'su.id')
      .where('ct.teacher_id', teacherId)
      .where('ct.is_archived', isArchived ? 1 : 0);

    if (sessionId) query = query.where('ct.academic_session_id', sessionId);
    if (classId) query = query.where('ct.class_id', classId);

    return await query
      .select(
        'ct.*',
        'c.name as className',
        'c.grade_level as gradeLevel',
        's.name as subjectName',
        's.code as subjectCode',
        'st.admission_no as studentAdmissionNo',
        'st.roll_no as studentRollNo',
        'su.id as studentUserId',
        'su.full_name as studentName'
      )
      .orderByRaw('COALESCE(ct.last_message_at, ct.created_at) DESC');
  },

  async getStudentThreads(studentId, { sessionId, isArchived = false }) {
    let query = db('chat_threads as ct')
      .join('classes as c', 'ct.class_id', 'c.id')
      .join('subjects as s', 'ct.subject_id', 's.id')
      .join('teachers as t', 'ct.teacher_id', 't.id')
      .join('users as tu', 't.user_id', 'tu.id')
      .where('ct.student_id', studentId)
      .where('ct.is_archived', isArchived ? 1 : 0);

    if (sessionId) query = query.where('ct.academic_session_id', sessionId);

    return await query
      .select(
        'ct.*',
        'c.name as className',
        'c.grade_level as gradeLevel',
        's.name as subjectName',
        's.code as subjectCode',
        't.employee_no as teacherEmployeeNo',
        't.designation as teacherDesignation',
        'tu.id as teacherUserId',
        'tu.full_name as teacherName'
      )
      .orderByRaw('COALESCE(ct.last_message_at, ct.created_at) DESC');
  },

  async getPrincipalThreads({ sessionId, classId, subjectId, teacherId, studentId, hasViolationsOnly = false, page = 1, limit = 50 }) {
    let query = db('chat_threads as ct')
      .join('classes as c', 'ct.class_id', 'c.id')
      .join('subjects as s', 'ct.subject_id', 's.id')
      .join('teachers as t', 'ct.teacher_id', 't.id')
      .join('users as tu', 't.user_id', 'tu.id')
      .join('students as st', 'ct.student_id', 'st.id')
      .join('users as su', 'st.user_id', 'su.id');

    if (sessionId) query = query.where('ct.academic_session_id', sessionId);
    if (classId) query = query.where('ct.class_id', classId);
    if (subjectId) query = query.where('ct.subject_id', subjectId);
    if (teacherId) query = query.where('ct.teacher_id', teacherId);
    if (studentId) query = query.where('ct.student_id', studentId);

    if (hasViolationsOnly) {
      query = query.whereExists(function () {
        this.select('id')
          .from('chat_messages as cm')
          .whereRaw('cm.thread_id = ct.id')
          .andWhere('cm.has_policy_violation', 1);
      });
    }

    const offset = (Math.max(1, page) - 1) * limit;

    const [totalRow] = await query.clone().count('ct.id as total');
    const rows = await query
      .select(
        'ct.*',
        'c.name as className',
        'c.grade_level as gradeLevel',
        's.name as subjectName',
        's.code as subjectCode',
        'tu.full_name as teacherName',
        'tu.id as teacherUserId',
        'su.full_name as studentName',
        'su.id as studentUserId',
        'st.roll_no as studentRollNo'
      )
      .orderByRaw('COALESCE(ct.last_message_at, ct.created_at) DESC')
      .limit(limit)
      .offset(offset);

    return {
      threads: rows,
      total: Number(totalRow?.total || 0),
      page,
      limit
    };
  },

  async getThreadMessages(threadId, { page = 1, limit = 50, beforeId = null }) {
    let query = db('chat_messages as cm')
      .join('users as u', 'cm.sender_user_id', 'u.id')
      .where('cm.thread_id', threadId);

    if (beforeId) {
      query = query.where('cm.id', '<', beforeId);
    }

    const offset = (Math.max(1, page) - 1) * limit;
    const rows = await query
      .select(
        'cm.*',
        'u.full_name as senderName'
      )
      .orderBy('cm.id', 'desc')
      .limit(limit)
      .offset(offset);

    return rows.reverse();
  },

  async createMessage(data) {
    return await db.transaction(async (trx) => {
      const [msgId] = await trx('chat_messages').insert({
        thread_id: data.threadId,
        sender_user_id: data.senderUserId,
        sender_role: data.senderRole,
        content: data.content,
        was_masked: data.wasMasked ? 1 : 0,
        has_policy_violation: data.hasPolicyViolation ? 1 : 0,
        policy_violation_type: data.policyViolationType || null,
        created_at: db.fn.now(3)
      });

      const previewText = data.content.length > 100 ? `${data.content.substring(0, 97)}...` : data.content;

      const threadUpdates = {
        last_message_at: db.fn.now(3),
        last_message_preview: previewText,
        updated_at: db.fn.now(3)
      };

      if (data.senderRole === 'TEACHER') {
        threadUpdates.student_unread_count = db.raw('student_unread_count + 1');
      } else {
        threadUpdates.teacher_unread_count = db.raw('teacher_unread_count + 1');
      }

      await trx('chat_threads')
        .where('id', data.threadId)
        .update(threadUpdates);

      return await trx('chat_messages as cm')
        .join('users as u', 'cm.sender_user_id', 'u.id')
        .where('cm.id', msgId)
        .select('cm.*', 'u.full_name as senderName')
        .first();
    });
  },

  async markThreadAsRead(threadId, readerRole, readerUserId) {
    return await db.transaction(async (trx) => {
      const targetRole = readerRole === 'TEACHER' ? 'STUDENT' : 'TEACHER';

      await trx('chat_messages')
        .where('thread_id', threadId)
        .where('sender_role', targetRole)
        .whereNull('read_at')
        .update({
          read_at: db.fn.now(3),
          delivered_at: db.raw('COALESCE(delivered_at, ?)', [db.fn.now(3)])
        });

      const threadUpdate = {};
      if (readerRole === 'TEACHER') {
        threadUpdate.teacher_unread_count = 0;
      } else if (readerRole === 'STUDENT') {
        threadUpdate.student_unread_count = 0;
      }

      await trx('chat_threads')
        .where('id', threadId)
        .update(threadUpdate);

      return true;
    });
  },

  async logAuditAction(data) {
    try {
      await db('chat_audit_logs').insert({
        actor_user_id: data.actorUserId,
        actor_role: data.actorRole,
        action: data.action,
        thread_id: data.threadId || null,
        message_id: data.messageId || null,
        details: data.details ? JSON.stringify(data.details) : null,
        ip_address: data.ipAddress || null,
        created_at: db.fn.now(3)
      });
    } catch (e) {
      console.warn('[ChatAuditLog] Error recording oversight action:', e.message);
    }
  }
};

