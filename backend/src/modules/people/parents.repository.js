import { db } from '../../shared/db/knex.js';

export const parentsRepository = {
  async getAllParents({ status = null } = {}) {
    let query = db('parents')
      .join('users', 'parents.user_id', 'users.id')
      .select(
        'parents.id',
        'parents.user_id',
        'parents.cnic_or_id_no as cnic',
        'parents.relation_default as relation',
        'parents.verification_status as verificationStatus',
        'parents.verified_at as verifiedAt',
        'users.full_name as name',
        'users.email',
        'users.phone',
        'users.status as accountStatus'
      )
      .orderBy('parents.id', 'desc');

    if (status) {
      query = query.where('parents.verification_status', status);
    }

    const parents = await query;
    if (parents.length === 0) return [];

    const parentIds = parents.map((p) => p.id);
    const links = await db('parent_student')
      .join('students', 'parent_student.student_id', 'students.id')
      .join('users', 'students.user_id', 'users.id')
      .join('classes', 'students.current_class_id', 'classes.id')
      .whereIn('parent_student.parent_id', parentIds)
      .select(
        'parent_student.parent_id',
        'students.id as studentId',
        'students.admission_no as admissionNo',
        'students.roll_no as rollNo',
        'users.full_name as studentName',
        'classes.name as className',
        'parent_student.relation',
        'parent_student.is_primary as isPrimary'
      );

    const linkMap = {};
    for (const link of links) {
      if (!linkMap[link.parent_id]) linkMap[link.parent_id] = [];
      linkMap[link.parent_id].push(link);
    }

    return parents.map((p) => {
      const children = linkMap[p.id] || [];
      return {
        ...p,
        id: p.id,
        code: `PRN-${String(p.id).padStart(2, '0')}`,
        rawId: p.id,
        verificationStatus: p.verificationStatus === 'APPROVED' ? 'Verified' : p.verificationStatus === 'REJECTED' ? 'Rejected' : 'Pending',
        children,
        linkedStudentIds: children.map((c) => `STD-${String(c.studentId).padStart(2, '0')}`),
        linkedStudentNames: children.map((c) => c.studentName)
      };
    });
  },

  async getParentById(id) {
    const parent = await db('parents')
      .join('users', 'parents.user_id', 'users.id')
      .where('parents.id', id)
      .select(
        'parents.id',
        'parents.user_id',
        'parents.cnic_or_id_no as cnic',
        'parents.relation_default as relation',
        'parents.verification_status as verificationStatus',
        'parents.verified_at as verifiedAt',
        'users.full_name as name',
        'users.email',
        'users.phone',
        'users.status as accountStatus'
      )
      .first();

    if (!parent) return null;

    const children = await db('parent_student')
      .join('students', 'parent_student.student_id', 'students.id')
      .join('users', 'students.user_id', 'users.id')
      .join('classes', 'students.current_class_id', 'classes.id')
      .where('parent_student.parent_id', id)
      .select(
        'students.id as studentId',
        'students.admission_no as admissionNo',
        'students.roll_no as rollNo',
        'users.full_name as studentName',
        'classes.name as className',
        'parent_student.relation',
        'parent_student.is_primary as isPrimary'
      );

    parent.children = children;
    return parent;
  },

  async registerParentWithUser({ user, parent }) {
    return await db.transaction(async (trx) => {
      // 1. Insert user (Role 5 = PARENT)
      const [userId] = await trx('users').insert({
        role_id: 5,
        username: user.username,
        email: user.email,
        phone: user.phone || null,
        full_name: user.full_name,
        password_hash: user.password_hash,
        status: 'ACTIVE',
        must_change_password: 0
      });

      // 2. Insert parent record
      const [parentId] = await trx('parents').insert({
        user_id: userId,
        cnic_or_id_no: parent.cnic || null,
        relation_default: parent.relation || 'GUARDIAN',
        verification_status: 'PENDING'
      });

      return { userId, parentId };
    });
  },

  async updateVerification(parentId, status, verifiedBy) {
    return await db('parents')
      .where({ id: parentId })
      .update({
        verification_status: status,
        verified_by: verifiedBy,
        verified_at: db.fn.now()
      });
  },

  async getParentByUserId(userId) {
    const parent = await db('parents')
      .join('users', 'parents.user_id', 'users.id')
      .where('parents.user_id', userId)
      .select(
        'parents.id',
        'parents.user_id',
        'parents.cnic_or_id_no as cnic',
        'parents.relation_default as relation',
        'parents.verification_status as verificationStatus',
        'users.full_name as name',
        'users.email',
        'users.phone',
        'users.status as accountStatus'
      )
      .first();

    return parent || null;
  },

  async getParentDashboard(userId) {
    const parent = await this.getParentByUserId(userId);
    if (!parent) return null;

    const childrenLinks = await db('parent_student')
      .join('students', 'parent_student.student_id', 'students.id')
      .join('users as student_users', 'students.user_id', 'student_users.id')
      .join('classes', 'students.current_class_id', 'classes.id')
      .where('parent_student.parent_id', parent.id)
      .select(
        'students.id as studentId',
        'student_users.full_name as studentName',
        'students.roll_no as rollNo',
        'students.admission_no as admissionNo',
        'students.current_class_id as classId',
        'classes.grade_level as classNumber',
        'classes.name as className',
        'students.status as enrollmentStatus',
        'student_users.status as accountStatus',
        'parent_student.relation',
        'parent_student.is_primary as isPrimary'
      );

    const children = await Promise.all(
      childrenLinks.map(async (child) => {
        // 1. Attendance stats
        const attRecords = await db('lesson_attendance').where('student_id', child.studentId);
        const presentCount = attRecords.filter((a) => a.status === 'PRESENT').length;
        const attRate = attRecords.length > 0 ? Math.round((presentCount / attRecords.length) * 100) : 100;

        // 2. Pending tasks
        const tasks = await db('learning_tasks').where({ class_id: child.classId, status: 'ACTIVE' });
        const subs = await db('task_submissions').where('student_id', child.studentId);
        const submittedTaskIds = new Set(subs.map((s) => s.task_id));
        const pendingTasksCount = tasks.filter((t) => !submittedTaskIds.has(t.id)).length;

        // 3. Fee challans
        const challans = await db('fee_challans')
          .where('student_id', child.studentId)
          .orderBy('created_at', 'desc');

        let totalOutstanding = 0;
        for (const ch of challans) {
          if (ch.status !== 'PAID') {
            totalOutstanding += Math.max(0, Number(ch.total_payable) - Number(ch.paid_amount));
          }
        }

        // 4. Today's schedule
        const todayStr = new Date().toISOString().split('T')[0];
        const schedule = await db('timetable_lessons')
          .join('subjects', 'timetable_lessons.subject_id', 'subjects.id')
          .join('teachers', 'timetable_lessons.teacher_id', 'teachers.id')
          .join('users as teacher_users', 'teachers.user_id', 'teacher_users.id')
          .where('timetable_lessons.class_id', child.classId)
          .where('timetable_lessons.lesson_date', todayStr)
          .select(
            'timetable_lessons.id',
            'timetable_lessons.lesson_date as lessonDate',
            'timetable_lessons.start_at as startAt',
            'timetable_lessons.end_at as endAt',
            'timetable_lessons.status',
            'subjects.name as subjectName',
            'teacher_users.full_name as teacherName'
          )
          .orderBy('timetable_lessons.start_at', 'asc');

        // 5. Achievements
        const achievements = await db('student_achievements')
          .join('teachers', 'student_achievements.teacher_id', 'teachers.id')
          .join('users as teacher_users', 'teachers.user_id', 'teacher_users.id')
          .where('student_achievements.student_id', child.studentId)
          .select(
            'student_achievements.id',
            'student_achievements.badge_type as badgeType',
            'student_achievements.title',
            'student_achievements.reason',
            'student_achievements.stars_count as starsCount',
            'teacher_users.full_name as awardedByTeacher',
            'student_achievements.created_at as awardedAt'
          )
          .orderBy('student_achievements.created_at', 'desc');

        return {
          ...child,
          attendanceRate: attRate,
          totalAttendanceLogs: attRecords.length,
          pendingTasksCount,
          totalOutstandingFee: totalOutstanding,
          challansCount: challans.length,
          recentChallans: challans.slice(0, 3).map((c) => ({
            id: c.id,
            challanNumber: c.challan_number,
            consumerNumber: c.consumer_number,
            billingMonth: c.billing_month,
            totalPayable: Number(c.total_payable),
            paidAmount: Number(c.paid_amount),
            status: c.status
          })),
          todaySchedule: schedule,
          achievements
        };
      })
    );

    return {
      parent,
      children
    };
  },

  async getChildChallans(parentId, studentId) {
    const link = await db('parent_student')
      .where({ parent_id: parentId, student_id: studentId })
      .first();

    if (!link) return null;

    const challans = await db('fee_challans')
      .join('classes', 'fee_challans.class_id', 'classes.id')
      .join('academic_sessions', 'fee_challans.session_id', 'academic_sessions.id')
      .where('fee_challans.student_id', studentId)
      .select(
        'fee_challans.id',
        'fee_challans.challan_number as challanNumber',
        'fee_challans.consumer_number as consumerNumber',
        'fee_challans.billing_month as billingMonth',
        'academic_sessions.name as academicSession',
        'fee_challans.issue_date as issueDate',
        'fee_challans.due_date as dueDate',
        'fee_challans.valid_until as validUntil',
        'fee_challans.total_payable as totalPayable',
        'fee_challans.paid_amount as paidAmount',
        'fee_challans.status'
      )
      .orderBy('fee_challans.created_at', 'desc');

    return challans.map((c) => ({
      ...c,
      totalPayable: Number(c.totalPayable),
      paidAmount: Number(c.paidAmount),
      outstandingBalance: Math.max(0, Number(c.totalPayable) - Number(c.paidAmount))
    }));
  },

  async verifyParentStudentLink(parentId, studentId) {
    const link = await db('parent_student')
      .where({ parent_id: parentId, student_id: studentId })
      .first();
    return Boolean(link);
  }
};
