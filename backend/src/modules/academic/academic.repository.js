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

  async removeTeacherAssignment({ teacherId, classId, subjectId }) {
    return await db('teacher_assignments')
      .where({
        teacher_id: teacherId,
        class_id: classId,
        subject_id: subjectId
      })
      .delete();
  }
};
