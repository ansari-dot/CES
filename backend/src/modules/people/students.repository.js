import { db } from '../../shared/db/knex.js';

export const studentsRepository = {
  async getAllStudents({ classId = null, status = null } = {}) {
    let query = db('students')
      .join('users', 'students.user_id', 'users.id')
      .join('classes', 'students.current_class_id', 'classes.id')
      .select(
        'students.id',
        'students.user_id',
        'students.admission_no as admissionNo',
        'students.roll_no as rollNo',
        'students.date_of_birth as dateOfBirth',
        'students.gender',
        'students.admission_date as admissionDate',
        'students.current_class_id as currentClassId',
        'classes.grade_level as classNumber',
        'classes.name as className',
        'students.status as enrollmentStatus',
        'users.full_name as name',
        'users.email',
        'users.phone',
        'users.status as accountStatus'
      )
      .orderBy('students.id', 'desc');

    if (classId) {
      query = query.where('students.current_class_id', classId);
    }
    if (status) {
      query = query.where('students.status', status);
    }

    const students = await query;
    if (students.length === 0) return [];

    const studentIds = students.map((s) => s.id);
    const guardians = await db('parent_student')
      .join('parents', 'parent_student.parent_id', 'parents.id')
      .join('users', 'parents.user_id', 'users.id')
      .whereIn('parent_student.student_id', studentIds)
      .select(
        'parent_student.student_id as studentId',
        'parents.id as parentId',
        'users.full_name as guardianName',
        'parent_student.relation',
        'parent_student.is_primary as isPrimary'
      );

    const guardiansMap = new Map();
    for (const g of guardians) {
      if (!guardiansMap.has(g.studentId)) guardiansMap.set(g.studentId, []);
      guardiansMap.get(g.studentId).push(g);
    }

    return students.map((s) => {
      const gList = guardiansMap.get(s.id) || [];
      return {
        ...s,
        parentIds: gList.map((g) => String(g.parentId)),
        parentNames: gList.map((g) => g.guardianName),
        guardians: gList
      };
    });
  },

  async getStudentById(id) {
    const student = await db('students')
      .join('users', 'students.user_id', 'users.id')
      .join('classes', 'students.current_class_id', 'classes.id')
      .where('students.id', id)
      .select(
        'students.id',
        'students.user_id',
        'students.admission_no as admissionNo',
        'students.roll_no as rollNo',
        'students.date_of_birth as dateOfBirth',
        'students.gender',
        'students.admission_date as admissionDate',
        'students.current_class_id as currentClassId',
        'classes.grade_level as classNumber',
        'classes.name as className',
        'students.status as enrollmentStatus',
        'users.full_name as name',
        'users.email',
        'users.phone',
        'users.status as accountStatus'
      )
      .first();

    if (!student) return null;

    // Attach guardians
    const guardians = await db('parent_student')
      .join('parents', 'parent_student.parent_id', 'parents.id')
      .join('users', 'parents.user_id', 'users.id')
      .where('parent_student.student_id', id)
      .select(
        'parents.id as parentId',
        'users.full_name as guardianName',
        'users.email as guardianEmail',
        'users.phone as guardianPhone',
        'parent_student.relation',
        'parent_student.is_primary as isPrimary'
      );

    student.guardians = guardians;
    return student;
  },

  async createStudentWithUser({ user, student, enrollment }) {
    return await db.transaction(async (trx) => {
      // 1. Create user (Role 4 = STUDENT)
      const [userId] = await trx('users').insert({
        role_id: 4,
        username: user.username,
        email: user.email || null,
        phone: user.phone || null,
        full_name: user.full_name,
        password_hash: user.password_hash,
        status: user.status || 'ACTIVE',
        must_change_password: 1
      });

      // 2. Create student record
      const [studentId] = await trx('students').insert({
        user_id: userId,
        admission_no: student.admission_no,
        roll_no: student.roll_no || null,
        date_of_birth: student.date_of_birth || null,
        gender: student.gender || null,
        admission_date: student.admission_date || trx.fn.now(),
        current_class_id: student.current_class_id,
        status: student.status || 'ACTIVE'
      });

      // 3. Create initial enrollment
      if (enrollment) {
        await trx('enrollments').insert({
          student_id: studentId,
          class_id: student.current_class_id,
          session_id: enrollment.session_id,
          roll_no: student.roll_no || null,
          status: 'ACTIVE',
          enrolled_on: student.admission_date || trx.fn.now()
        });
      }

      return { userId, studentId };
    });
  },

  async enrollStudent({ studentId, classId, sessionId, rollNo, status = 'ACTIVE', enrolledOn }) {
    return await db.transaction(async (trx) => {
      // Update student current class
      await trx('students').where({ id: studentId }).update({
        current_class_id: classId,
        roll_no: rollNo || null,
        status
      });

      // Insert or update enrollment
      const existing = await trx('enrollments').where({
        student_id: studentId,
        session_id: sessionId
      }).first();

      if (existing) {
        await trx('enrollments').where({ id: existing.id }).update({
          class_id: classId,
          roll_no: rollNo || existing.roll_no,
          status
        });
        return existing.id;
      } else {
        const [id] = await trx('enrollments').insert({
          student_id: studentId,
          class_id: classId,
          session_id: sessionId,
          roll_no: rollNo || null,
          status,
          enrolled_on: enrolledOn || trx.fn.now()
        });
        return id;
      }
    });
  },

  async linkGuardian({ studentId, parentId, relation = 'GUARDIAN', isPrimary = 0, linkedBy }) {
    const existing = await db('parent_student')
      .where({ parent_id: parentId, student_id: studentId })
      .first();

    if (existing) {
      await db('parent_student')
        .where({ parent_id: parentId, student_id: studentId })
        .update({
          relation,
          is_primary: isPrimary
        });
    } else {
      await db('parent_student').insert({
        parent_id: parentId,
        student_id: studentId,
        relation,
        is_primary: isPrimary,
        linked_by: linkedBy
      });
    }
  },

  async getStudentByUserId(userId) {
    const student = await db('students')
      .join('users', 'students.user_id', 'users.id')
      .join('classes', 'students.current_class_id', 'classes.id')
      .where('students.user_id', userId)
      .select(
        'students.id',
        'students.user_id',
        'students.admission_no as admissionNo',
        'students.roll_no as rollNo',
        'students.date_of_birth as dateOfBirth',
        'students.gender',
        'students.admission_date as admissionDate',
        'students.current_class_id as currentClassId',
        'classes.grade_level as classNumber',
        'classes.name as className',
        'students.status as enrollmentStatus',
        'users.full_name as name',
        'users.email',
        'users.phone',
        'users.status as accountStatus'
      )
      .first();

    return student || null;
  },

  async getStudentDashboard(userId) {
    const student = await this.getStudentByUserId(userId);
    if (!student) return null;

    if (
      student.enrollmentStatus === 'SUSPENDED' ||
      student.accountStatus === 'SUSPENDED' ||
      student.enrollmentStatus === 'DEACTIVATED' ||
      student.accountStatus === 'DEACTIVATED'
    ) {
      // Fetch outstanding invoices so the restriction notice can show them
      const overdueChallans = await db('fee_challans')
        .where('student_id', student.id)
        .whereNotIn('status', ['PAID'])
        .select('id', 'billing_month', 'due_date', 'total_payable', 'paid_amount', 'status')
        .orderBy('due_date', 'asc');

      const outstandingInvoices = overdueChallans.map((c) => ({
        challanId: c.id,
        billingMonth: c.billing_month,
        dueDate: c.due_date ? String(c.due_date).split('T')[0] : null,
        outstanding: Math.max(0, Number(c.total_payable) - Number(c.paid_amount)),
        status: c.status
      }));
      const outstandingAmount = outstandingInvoices.reduce((s, i) => s + i.outstanding, 0);

      // Principal WhatsApp contact from env (optional)
      const principalWhatsapp = process.env.PRINCIPAL_WHATSAPP_NUMBER || null;

      return {
        accountStatus: student.accountStatus,
        isRestricted: true,
        suspensionReason: 'Your portal access has been temporarily restricted due to an outstanding fee balance.',
        resolutionMessage:
          'Please pay your outstanding fee and then contact the Principal via WhatsApp to restore access.',
        feeRestriction: { outstandingAmount, outstandingInvoices },
        principalContact: principalWhatsapp
          ? { whatsappUrl: `https://wa.me/${principalWhatsapp.replace(/\D/g, '')}` }
          : null
      };
    }

    // 1. Today's live lessons schedule
    const todayStr = new Date().toISOString().split('T')[0];
    const schedule = await db('timetable_lessons')
      .join('subjects', 'timetable_lessons.subject_id', 'subjects.id')
      .join('teachers', 'timetable_lessons.teacher_id', 'teachers.id')
      .join('users as teacher_users', 'teachers.user_id', 'teacher_users.id')
      .where('timetable_lessons.class_id', student.currentClassId)
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

    // 2. Active learning tasks & my submissions
    const tasks = await db('learning_tasks')
      .join('subjects', 'learning_tasks.subject_id', 'subjects.id')
      .where({ class_id: student.currentClassId, status: 'ACTIVE' })
      .select(
        'learning_tasks.id',
        'learning_tasks.title',
        'learning_tasks.instructions',
        'learning_tasks.deadline as dueDate',
        'learning_tasks.total_marks as maxMarks',
        'subjects.name as subjectName'
      )
      .orderBy('learning_tasks.deadline', 'asc');

    const subs = await db('task_submissions').where('student_id', student.id);
    const subsMap = new Map(subs.map((s) => [s.task_id, s]));

    const mappedTasks = tasks.map((t) => {
      const sub = subsMap.get(t.id);
      return {
        ...t,
        submissionStatus: sub ? sub.status : 'PENDING',
        marksObtained: sub?.marks_awarded !== null && sub?.marks_awarded !== undefined ? Number(sub.marks_awarded) : null,
        feedback: sub?.feedback || null
      };
    });

    // 3. Fee status
    const challans = await db('fee_challans').where('student_id', student.id);
    let totalOutstandingFee = 0;
    for (const c of challans) {
      if (c.status !== 'PAID') {
        totalOutstandingFee += Math.max(0, Number(c.total_payable) - Number(c.paid_amount));
      }
    }

    // 4. Attendance rate
    const attRecords = await db('lesson_attendance').where('student_id', student.id);
    const presentCount = attRecords.filter((a) => a.status === 'PRESENT').length;
    const attRate = attRecords.length > 0 ? Math.round((presentCount / attRecords.length) * 100) : 100;

    // 5. Achievements & badges (SRS Section 8.3 & 12)
    const achievements = await db('student_achievements')
      .join('teachers', 'student_achievements.teacher_id', 'teachers.id')
      .join('users as teacher_users', 'teachers.user_id', 'teacher_users.id')
      .where('student_achievements.student_id', student.id)
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
      accountStatus: 'ACTIVE',
      isRestricted: false,
      student,
      schedule,
      tasks: mappedTasks,
      totalOutstandingFee,
      attendanceRate: attRate,
      achievements
    };
  }
};
