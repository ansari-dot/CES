import { db } from '../../shared/db/knex.js';

export const academicRepository = {
  // Academic Sessions
  async getAllSessions() {
    return await db('academic_sessions').orderBy('start_date', 'desc');
  },

  async getCurrentSession() {
    return await db('academic_sessions').where({ is_current: 1 }).first();
  },

  async createSession(sessionData) {
    if (sessionData.is_current) {
      await db('academic_sessions').update({ is_current: 0 });
    }
    const [id] = await db('academic_sessions').insert(sessionData);
    return id;
  },

  // Classes
  async getAllClasses() {
    return await db('classes').orderBy('grade_level', 'asc');
  },

  async getClassById(id) {
    return await db('classes').where({ id }).first();
  },

  // Subjects
  async getAllSubjects() {
    return await db('subjects').orderBy('name', 'asc');
  },

  async getSubjectByCode(code) {
    return await db('subjects').where({ code }).first();
  },

  async createSubject(subjectData) {
    const [id] = await db('subjects').insert(subjectData);
    return id;
  },

  // Class Subjects
  async getClassSubjects(classId) {
    const subjects = await db('class_subjects')
      .join('subjects', 'class_subjects.subject_id', 'subjects.id')
      .where('class_subjects.class_id', classId)
      .where('class_subjects.is_active', 1)
      .select('subjects.*');

    const assignments = await db('teacher_assignments')
      .where('class_id', classId)
      .select('subject_id', 'teacher_id');

    return subjects.map((sub) => {
      const assignedTeacherIds = assignments
        .filter((a) => a.subject_id === sub.id)
        .map((a) => String(a.teacher_id));

      return {
        ...sub,
        assignedTeacherIds
      };
    });
  },

  async addSubjectToClass(classId, subjectId) {
    const exists = await db('class_subjects')
      .where({ class_id: classId, subject_id: subjectId })
      .first();

    if (!exists) {
      await db('class_subjects').insert({
        class_id: classId,
        subject_id: subjectId,
        is_active: 1
      });
    } else if (!exists.is_active) {
      await db('class_subjects')
        .where({ id: exists.id })
        .update({ is_active: 1 });
    }
    return true;
  },

  async setClassSubjects(classId, subjectIds) {
    return await db.transaction(async (trx) => {
      await trx('class_subjects').where({ class_id: classId }).delete();
      if (subjectIds.length > 0) {
        const rows = subjectIds.map((subId) => ({
          class_id: classId,
          subject_id: subId,
          is_active: 1
        }));
        await trx('class_subjects').insert(rows);
      }
    });
  },

  // Teacher Assignments
  async getTeacherAssignments(teacherId, sessionId = null) {
    let query = db('teacher_assignments')
      .join('classes', 'teacher_assignments.class_id', 'classes.id')
      .join('subjects', 'teacher_assignments.subject_id', 'subjects.id')
      .join('academic_sessions', 'teacher_assignments.session_id', 'academic_sessions.id')
      .where('teacher_assignments.teacher_id', teacherId)
      .select(
        'teacher_assignments.id',
        'teacher_assignments.teacher_id',
        'teacher_assignments.class_id',
        'classes.grade_level as classNumber',
        'classes.name as className',
        'teacher_assignments.subject_id',
        'subjects.code as subjectCode',
        'subjects.name as subjectName',
        'teacher_assignments.session_id',
        'academic_sessions.name as sessionName',
        'teacher_assignments.effective_from as startDate',
        'teacher_assignments.effective_to as endDate'
      );

    if (sessionId) {
      query = query.where('teacher_assignments.session_id', sessionId);
    }
    return await query;
  },

  async assignTeacher({ teacherId, classId, subjectId, sessionId, effectiveFrom, effectiveTo, assignedBy }) {
    let finalSessionId = sessionId;
    if (!finalSessionId) {
      const current = await this.getCurrentSession();
      finalSessionId = current ? current.id : 1;
    }

    // Ensure subject is in class_subjects
    const csExists = await db('class_subjects')
      .where({ class_id: classId, subject_id: subjectId })
      .first();

    if (!csExists) {
      await db('class_subjects').insert({
        class_id: classId,
        subject_id: subjectId,
        is_active: 1
      });
    } else if (!csExists.is_active) {
      await db('class_subjects')
        .where({ id: csExists.id })
        .update({ is_active: 1 });
    }

    // Check if assignment already exists
    const existing = await db('teacher_assignments')
      .where({
        teacher_id: teacherId,
        class_id: classId,
        subject_id: subjectId,
        session_id: finalSessionId
      })
      .first();

    if (existing) {
      return existing.id;
    }

    const [id] = await db('teacher_assignments').insert({
      teacher_id: teacherId,
      class_id: classId,
      subject_id: subjectId,
      session_id: finalSessionId,
      effective_from: effectiveFrom || db.fn.now(),
      effective_to: effectiveTo || null,
      assigned_by: assignedBy || 1
    });
    return id;
  },

  async getClassAssignments(classId) {
    return await db('teacher_assignments')
      .join('subjects', 'teacher_assignments.subject_id', 'subjects.id')
      .join('teachers', 'teacher_assignments.teacher_id', 'teachers.id')
      .join('users', 'teachers.user_id', 'users.id')
      .where('teacher_assignments.class_id', classId)
      .select(
        'teacher_assignments.subject_id as subjectId',
        'subjects.name as subjectName',
        'teacher_assignments.teacher_id as teacherId',
        'users.full_name as teacherName'
      );
  },

  async removeTeacherAssignment({ teacherId, classId, subjectId }) {
    return await db('teacher_assignments')
      .where({
        teacher_id: teacherId,
        class_id: classId,
        subject_id: subjectId
      })
      .delete();
  },

  // ── Academic year lifecycle ────────────────────────────────────────

  async getSessionById(id) {
    return await db('academic_sessions').where({ id }).first();
  },

  async findOverlappingSession({ startDate, endDate, excludeId = null }) {
    let query = db('academic_sessions')
      .where('start_date', '<=', endDate)
      .where('end_date', '>=', startDate);
    if (excludeId) query = query.whereNot('id', excludeId);
    return await query.first();
  },

  async updateSession(id, data) {
    await db('academic_sessions').where({ id }).update(data);
    return await this.getSessionById(id);
  },

  async activateSession(id, actor) {
    await db.transaction(async (trx) => {
      const session = await trx('academic_sessions').where({ id }).first();
      // The previously active year moves to CLOSING (it still needs
      // result approval / promotion before being formally closed).
      await trx('academic_sessions')
        .whereNot('id', id)
        .where({ is_current: 1 })
        .update({ is_current: 0, status: 'CLOSING' });
      await trx('academic_sessions').where({ id }).update({ is_current: 1, status: 'ACTIVE' });
      await trx('audit_logs').insert({
        actor_id: actor?.id || null,
        actor_name: actor?.username || 'System',
        actor_role: actor?.role || 'SYSTEM',
        action: 'ACTIVATE_ACADEMIC_YEAR',
        record_type: 'Academic Session',
        record_identifier: session ? session.name : String(id),
        previous_value: session ? session.status : null,
        new_value: 'ACTIVE'
      });
    });
    return await this.getSessionById(id);
  },

  async closeSession(id, actor) {
    await db.transaction(async (trx) => {
      const session = await trx('academic_sessions').where({ id }).first();
      await trx('academic_sessions')
        .where({ id })
        .update({ is_current: 0, status: 'CLOSED', closed_at: db.fn.now(3), closed_by: actor?.id || null });
      await trx('audit_logs').insert({
        actor_id: actor?.id || null,
        actor_name: actor?.username || 'System',
        actor_role: actor?.role || 'SYSTEM',
        action: 'CLOSE_ACADEMIC_YEAR',
        record_type: 'Academic Session',
        record_identifier: session ? session.name : String(id),
        previous_value: session ? session.status : null,
        new_value: 'CLOSED'
      });
    });
    return await this.getSessionById(id);
  },

  async getSessionStats(sessionId) {
    const byStatus = await db('enrollments')
      .where({ session_id: sessionId })
      .groupBy('status')
      .select('status')
      .count({ count: '*' });

    const byClass = await db('enrollments')
      .join('classes', 'enrollments.class_id', 'classes.id')
      .where('enrollments.session_id', sessionId)
      .groupBy('classes.id', 'classes.grade_level', 'classes.name')
      .orderBy('classes.grade_level')
      .select('classes.grade_level as classNumber', 'classes.name as className')
      .count({ students: '*' });

    const resultCounts = await db('final_results')
      .where({ session_id: sessionId })
      .groupBy('result_status')
      .select('result_status')
      .count({ count: '*' });

    const promotionCounts = await db('promotion_records')
      .where({ session_id: sessionId })
      .groupBy('status')
      .select('status')
      .count({ count: '*' });

    return {
      enrollmentsByStatus: byStatus.map((r) => ({ status: r.status, count: Number(r.count) })),
      enrollmentsByClass: byClass.map((r) => ({
        classNumber: r.classNumber,
        className: r.className,
        students: Number(r.students)
      })),
      resultsByStatus: resultCounts.map((r) => ({ status: r.result_status, count: Number(r.count) })),
      promotionsByStatus: promotionCounts.map((r) => ({ status: r.status, count: Number(r.count) }))
    };
  },

  // ── Academic terms ─────────────────────────────────────────────────

  async getTermsBySession(sessionId) {
    return await db('academic_terms').where({ session_id: sessionId }).orderBy('sort_order').orderBy('start_date');
  },

  async getTermById(id) {
    return await db('academic_terms').where({ id }).first();
  },

  async createTerm(data) {
    return await db.transaction(async (trx) => {
      if (data.is_final) {
        await trx('academic_terms').where({ session_id: data.session_id }).update({ is_final: 0 });
      }
      const [id] = await trx('academic_terms').insert(data);
      return id;
    });
  },

  async updateTerm(id, data) {
    await db.transaction(async (trx) => {
      if (data.is_final) {
        const term = await trx('academic_terms').where({ id }).first();
        if (term) {
          await trx('academic_terms').where({ session_id: term.session_id }).update({ is_final: 0 });
        }
      }
      await trx('academic_terms').where({ id }).update(data);
    });
    return await this.getTermById(id);
  },

  // ── Promotion policy ───────────────────────────────────────────────

  async getPolicyRow(sessionId) {
    return await db('promotion_policies')
      .where({ session_id: sessionId === null ? null : sessionId })
      .first();
  },

  /** Session override if present, else the school default (session_id NULL), else built-in defaults. */
  async getEffectivePolicy(sessionId) {
    const specific = sessionId ? await this.getPolicyRow(sessionId) : null;
    if (specific) return { ...specific, source: 'SESSION' };
    const fallback = await this.getPolicyRow(null);
    if (fallback) return { ...fallback, source: 'DEFAULT' };
    return {
      id: null,
      session_id: sessionId || null,
      min_overall_percentage: 50,
      min_subject_percentage: 40,
      max_failed_subjects: 0,
      supplementary_allowed: 1,
      max_supplementary_subjects: 2,
      absent_policy: 'ZERO',
      auto_graduate_final_grade: 1,
      notes: null,
      source: 'BUILT_IN'
    };
  },

  async upsertPolicy(sessionId, data, actorId) {
    const existing = await this.getPolicyRow(sessionId);
    if (existing) {
      await db('promotion_policies').where({ id: existing.id }).update(data);
      return await db('promotion_policies').where({ id: existing.id }).first();
    }
    const [id] = await db('promotion_policies').insert({
      ...data,
      session_id: sessionId || null,
      created_by: actorId || null
    });
    return await db('promotion_policies').where({ id }).first();
  }
};
