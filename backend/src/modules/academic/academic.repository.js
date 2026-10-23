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

  async createSubject(subjectData) {
    const [id] = await db('subjects').insert(subjectData);
    return id;
  },

  // Class Subjects
  async getClassSubjects(classId) {
    return await db('class_subjects')
      .join('subjects', 'class_subjects.subject_id', 'subjects.id')
      .where('class_subjects.class_id', classId)
      .where('class_subjects.is_active', 1)
      .select('subjects.*');
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
    const [id] = await db('teacher_assignments').insert({
      teacher_id: teacherId,
      class_id: classId,
      subject_id: subjectId,
      session_id: sessionId,
      effective_from: effectiveFrom || db.fn.now(),
      effective_to: effectiveTo || null,
      assigned_by: assignedBy
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
  }
};
