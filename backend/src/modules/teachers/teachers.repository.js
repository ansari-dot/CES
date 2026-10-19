import { db } from '../../shared/db/knex.js';

export const teachersRepository = {
  async getAllTeachers() {
    const rows = await db('teachers')
      .join('users', 'teachers.user_id', 'users.id')
      .leftJoin('teacher_salary_profiles', 'teachers.id', 'teacher_salary_profiles.teacher_id')
      .select(
        'teachers.id',
        'teachers.user_id',
        'teachers.employee_no as staffIdentifier',
        'teachers.designation',
        'teachers.joining_date as joiningDate',
        'teachers.employment_status as employmentStatus',
        'teachers.qualification',
        'users.full_name as name',
        'users.email',
        'users.phone',
        'users.status as accountStatus',
        'teacher_salary_profiles.model as salaryModel',
        'teacher_salary_profiles.base_amount as baseMonthlySalary',
        'teacher_salary_profiles.per_lesson_rate as perLessonRate',
        'teacher_salary_profiles.per_hour_rate as perHourRate',
        'teacher_salary_profiles.rules as salaryRules'
      )
      .orderBy('teachers.id', 'desc');

    const teacherIds = rows.map((r) => r.id);
    let assignmentsMap = {};
    if (teacherIds.length > 0) {
      const assignments = await db('teacher_assignments')
        .join('classes', 'teacher_assignments.class_id', 'classes.id')
        .join('subjects', 'teacher_assignments.subject_id', 'subjects.id')
        .whereIn('teacher_assignments.teacher_id', teacherIds)
        .select(
          'teacher_assignments.id',
          'teacher_assignments.teacher_id',
          'classes.grade_level as classNumber',
          'classes.name as className',
          'subjects.id as subjectId',
          'subjects.name as subjectName'
        );

      for (const a of assignments) {
        if (!assignmentsMap[a.teacher_id]) assignmentsMap[a.teacher_id] = [];
        assignmentsMap[a.teacher_id].push(a);
      }
    }

    return rows.map((r) => {
      let rules = {};
      if (typeof r.salaryRules === 'string') {
        try {
          rules = JSON.parse(r.salaryRules);
        } catch {
          rules = {};
        }
      } else if (r.salaryRules) {
        rules = r.salaryRules;
      }

      const assignedList = assignmentsMap[r.id] || [];
      const classesAssigned = [...new Set(assignedList.map((a) => `Class ${a.classNumber} - ${a.subjectName}`))];
      const assignments = assignedList.map((a) => ({
        id: `ASG-${a.id}`,
        classNumber: a.classNumber,
        subjectId: String(a.subjectId),
        subjectName: a.subjectName,
        assignedDate: r.joiningDate ? String(r.joiningDate).split('T')[0] : '2026-08-01'
      }));

      return {
        id: `TCH-${String(r.id).padStart(2, '0')}`,
        rawId: r.id,
        userId: r.user_id,
        name: r.name,
        staffIdentifier: r.staffIdentifier,
        email: r.email,
        phone: r.phone || '',
        designation: r.designation || 'Faculty Member',
        joiningDate: r.joiningDate ? String(r.joiningDate).split('T')[0] : '',
        employmentStatus: r.employmentStatus === 'ACTIVE' ? 'Full-Time' : r.employmentStatus,
        accountStatus: r.accountStatus === 'ACTIVE' ? 'Active' : r.accountStatus === 'SUSPENDED' ? 'Temporarily Suspended' : 'Deactivated',
        salaryConfig: {
          model: r.salaryModel === 'FIXED' ? 'Fixed monthly' : r.salaryModel === 'PER_LESSON' ? 'Per-lesson model' : r.salaryModel === 'PER_HOUR' ? 'Hourly verified rate' : 'Hybrid fixed + lesson bonus',
          baseMonthlySalary: Number(r.baseMonthlySalary) || 0,
          perLessonRate: Number(r.perLessonRate) || 0,
          perHourRate: Number(r.perHourRate) || 0,
          allowances: Number(rules.allowances) || 0,
          standardDeductions: Number(rules.standardDeductions) || 0
        },
        classesAssigned,
        assignments
      };
    });
  },

  async findTeacherById(rawId) {
    return await db('teachers').where({ id: rawId }).first();
  },

  async createTeacherWithUser({ user, teacher, salaryProfile }) {
    return await db.transaction(async (trx) => {
      // 1. Insert user
      const [userId] = await trx('users').insert({
        role_id: user.role_id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        full_name: user.full_name,
        password_hash: user.password_hash,
        status: user.status || 'ACTIVE',
        must_change_password: 1
      });

      // 2. Insert teacher
      const [teacherId] = await trx('teachers').insert({
        user_id: userId,
        employee_no: teacher.employee_no,
        designation: teacher.designation,
        joining_date: teacher.joining_date,
        employment_status: teacher.employment_status || 'ACTIVE',
        qualification: teacher.qualification
      });

      // 3. Insert salary profile
      if (salaryProfile) {
        await trx('teacher_salary_profiles').insert({
          teacher_id: teacherId,
          model: salaryProfile.model,
          base_amount: salaryProfile.base_amount || 0,
          per_lesson_rate: salaryProfile.per_lesson_rate || 0,
          per_hour_rate: salaryProfile.per_hour_rate || 0,
          rules: JSON.stringify(salaryProfile.rules || {}),
          effective_from: salaryProfile.effective_from || new Date().toISOString().split('T')[0],
          approved_by: salaryProfile.approved_by || null
        });
      }

      return { userId, teacherId };
    });
  },

  async updateTeacher(rawId, updates) {
    return await db('teachers').where({ id: rawId }).update(updates);
  },

  async updateTeacherStatus(teacherId, userId, newStatus, reason, changedBy) {
    return await db.transaction(async (trx) => {
      const user = await trx('users').where({ id: userId }).first();
      const oldStatus = user ? user.status : 'ACTIVE';

      // Update user status
      await trx('users').where({ id: userId }).update({
        status: newStatus,
        token_version: trx.raw('token_version + 1')
      });

      // Revoke sessions if suspended or deactivated
      if (newStatus !== 'ACTIVE') {
        await trx('refresh_tokens')
          .where({ user_id: userId, revoked_at: null })
          .update({
            revoked_at: trx.fn.now(3),
            revoke_reason: newStatus === 'SUSPENDED' ? 'SUSPENDED' : 'DEACTIVATED'
          });
      }

      // Record in account_status_history
      await trx('account_status_history').insert({
        user_id: userId,
        old_status: oldStatus,
        new_status: newStatus,
        reason_code: newStatus === 'SUSPENDED' ? 'DISCIPLINARY' : newStatus === 'DEACTIVATED' ? 'ADMIN_HOLD' : 'REACTIVATION',
        reason_text: reason,
        effective_from: trx.fn.now(3),
        changed_by: changedBy
      });
    });
  }
};
