import { hashPassword } from '../shared/crypto/password.js';
import { encryptAesGcm } from '../shared/crypto/aes.js';

/**
 * Production-Ready School Seed Data
 * Seeds authenticated accounts, Classes 1-8 Zoom links, Class 5 roster, today's schedule, fee challans, tasks, and notices.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
  // 1. Ensure Principal Account (role_id: 2)
  const principalPwd = await hashPassword('PrincipalPassword123!');
  let principalUser = await knex('users').where({ username: 'principal' }).first();
  if (!principalUser) {
    const [pId] = await knex('users').insert({
      role_id: 2,
      username: 'principal',
      email: 'principal@school.pk',
      phone: '+923009876543',
      full_name: 'Prof. Tariq Mahmood',
      password_hash: principalPwd,
      status: 'ACTIVE',
      must_change_password: 0
    });
    principalUser = { id: pId };
  }

  // 2. Ensure Teacher Account (role_id: 3)
  const teacherPwd = await hashPassword('TeacherPassword123!');
  let teacherUser = await knex('users').where({ email: 'teacher@school.pk' }).first();
  if (!teacherUser) {
    const [tUid] = await knex('users').insert({
      role_id: 3,
      username: 'teacher',
      email: 'teacher@school.pk',
      phone: '+923002348901',
      full_name: 'Ms. Sarah Jenkins, M.Ed.',
      password_hash: teacherPwd,
      status: 'ACTIVE',
      must_change_password: 0
    });
    teacherUser = { id: tUid };
  }

  let teacher = await knex('teachers').where({ user_id: teacherUser.id }).first();
  if (!teacher) {
    const [tId] = await knex('teachers').insert({
      user_id: teacherUser.id,
      employee_no: 'TCH-2024-042',
      designation: 'Senior Faculty • STEM Division',
      qualification: 'M.Ed. STEM Education',
      joining_date: '2024-01-15',
      employment_status: 'ACTIVE'
    });
    teacher = { id: tId };
  }

  // 3. Ensure Academic Session
  let session = await knex('academic_sessions').where({ is_current: 1 }).first();
  if (!session) {
    const [sId] = await knex('academic_sessions').insert({
      name: '2026-27',
      start_date: '2026-08-01',
      end_date: '2027-06-30',
      is_current: 1
    });
    session = { id: sId };
  }

  // 4. Ensure All 8 Class Recurring Zoom Rooms Exist
  const classes = await knex('classes').orderBy('grade_level', 'asc');
  for (const cls of classes) {
    const existing = await knex('zoom_meetings').where({ class_id: cls.id, status: 'ACTIVE' }).first();
    if (!existing) {
      const meetingNo = `900${cls.grade_level}000${cls.grade_level}`;
      const passcode = `CLASS${cls.grade_level}#`;
      const joinUrl = `https://zoom.us/j/${meetingNo}?pwd=${passcode}`;
      const startUrl = `https://zoom.us/s/${meetingNo}?zak=host_zak_${cls.grade_level}`;

      await knex('zoom_meetings').insert({
        class_id: cls.id,
        zoom_meeting_id: meetingNo,
        topic: `Class ${cls.grade_level} Official Live Classroom`,
        join_url_enc: encryptAesGcm(joinUrl),
        passcode_enc: encryptAesGcm(passcode),
        start_url_enc: encryptAesGcm(startUrl),
        host_zoom_user_id: 'zoom_admin_master',
        host_mode: 'ALT_HOST',
        config_notes: `Host Key: 884422 | Account: zoom.class${cls.grade_level}@school.pk`,
        status: 'ACTIVE',
        last_health_status: 'HEALTHY',
        created_by: principalUser.id
      });
    }
  }

  // 5. Assign Teacher to Class 5 and Class 6
  const class5 = classes.find((c) => c.grade_level === 5) || classes[4] || classes[0];
  const class6 = classes.find((c) => c.grade_level === 6) || classes[5] || classes[0];

  const mathSubject = await knex('subjects').where({ code: 'MATH' }).first() || await knex('subjects').first();
  const sciSubject = await knex('subjects').where({ code: 'SCI' }).first() || mathSubject;

  const assignmentsToEnsure = [
    { class_id: class5.id, subject_id: mathSubject.id },
    { class_id: class5.id, subject_id: sciSubject.id },
    { class_id: class6.id, subject_id: sciSubject.id }
  ];

  for (const a of assignmentsToEnsure) {
    const existing = await knex('teacher_assignments').where({
      teacher_id: teacher.id,
      class_id: a.class_id,
      subject_id: a.subject_id
    }).first();

    if (!existing) {
      await knex('teacher_assignments').insert({
        teacher_id: teacher.id,
        class_id: a.class_id,
        subject_id: a.subject_id,
        session_id: session.id,
        effective_from: '2026-08-01',
        assigned_by: principalUser.id
      });
    }
  }

  // 6. Ensure Class 5 Students (Roster)
  const studentPwd = await hashPassword('StudentPassword123!');
  const demoStudents = [
    { name: 'Aiden Cooper', email: 'aiden.cooper@school.pk', admissionNo: 'ADM-5012', rollNo: '01', gender: 'MALE', dob: '2013-03-12' },
    { name: 'Bella Chen', email: 'student@school.pk', admissionNo: 'ADM-5019', rollNo: '02', gender: 'FEMALE', dob: '2013-05-18' },
    { name: 'Caleb Davis', email: 'caleb.davis@school.pk', admissionNo: 'ADM-5024', rollNo: '03', gender: 'MALE', dob: '2013-07-22' },
    { name: 'Daniel Evans', email: 'daniel.evans@school.pk', admissionNo: 'ADM-5031', rollNo: '04', gender: 'MALE', dob: '2013-09-14' },
    { name: 'Zainab Fatima', email: 'zainab.fatima@school.pk', admissionNo: 'ADM-5045', rollNo: '05', gender: 'FEMALE', dob: '2013-11-05' }
  ];

  const createdStudentIds = [];
  for (const s of demoStudents) {
    let u = await knex('users').where({ email: s.email }).first();
    if (!u) {
      const username = s.email.split('@')[0].replace(/[^a-z0-9]/g, '');
      const [uId] = await knex('users').insert({
        role_id: 4,
        username,
        email: s.email,
        phone: `+92300${Math.floor(1000000 + Math.random() * 9000000)}`,
        full_name: s.name,
        password_hash: studentPwd,
        status: 'ACTIVE',
        must_change_password: 0
      });
      u = { id: uId };
    }

    let std = await knex('students').where({ user_id: u.id }).first();
    if (!std) {
      const [sId] = await knex('students').insert({
        user_id: u.id,
        admission_no: s.admissionNo,
        roll_no: s.rollNo,
        date_of_birth: s.dob,
        gender: s.gender,
        admission_date: '2026-08-01',
        current_class_id: class5.id,
        status: 'ACTIVE'
      });
      std = { id: sId };
    }
    createdStudentIds.push(std.id);

    const enrollment = await knex('enrollments').where({ student_id: std.id, session_id: session.id }).first();
    if (!enrollment) {
      await knex('enrollments').insert({
        student_id: std.id,
        class_id: class5.id,
        session_id: session.id,
        roll_no: s.rollNo,
        status: 'ACTIVE',
        enrolled_on: '2026-08-01'
      });
    }
  }

  // 7. Ensure Parent Account and Link to Bella Chen & Aiden Cooper
  const parentPwd = await hashPassword('ParentPassword123!');
  let parentUser = await knex('users').where({ email: 'parent@school.pk' }).first();
  if (!parentUser) {
    const [pUid] = await knex('users').insert({
      role_id: 5,
      username: 'parent',
      email: 'parent@school.pk',
      phone: '+923005554321',
      full_name: 'Mr. Muhammad Tariq',
      password_hash: parentPwd,
      status: 'ACTIVE',
      must_change_password: 0
    });
    parentUser = { id: pUid };
  }

  let parent = await knex('parents').where({ user_id: parentUser.id }).first();
  if (!parent) {
    const [prnId] = await knex('parents').insert({
      user_id: parentUser.id,
      cnic_or_id_no: '35201-9876543-1',
      relation_default: 'FATHER',
      verification_status: 'APPROVED',
      verified_by: principalUser.id,
      verified_at: knex.fn.now()
    });
    parent = { id: prnId };
  }

  for (const sId of createdStudentIds.slice(0, 2)) {
    const link = await knex('parent_student').where({ parent_id: parent.id, student_id: sId }).first();
    if (!link) {
      await knex('parent_student').insert({
        parent_id: parent.id,
        student_id: sId,
        relation: 'FATHER',
        is_primary: 1,
        linked_by: principalUser.id
      });
    }
  }

  // 8. Ensure Today's Live Lessons in Timetable
  const todayStr = new Date().toISOString().split('T')[0];
  const meetingClass5 = await knex('zoom_meetings').where({ class_id: class5.id, status: 'ACTIVE' }).first();

  const existingTodayLesson = await knex('timetable_lessons').where({
    class_id: class5.id,
    lesson_date: todayStr
  }).first();

  if (!existingTodayLesson) {
    await knex('timetable_lessons').insert({
      class_id: class5.id,
      subject_id: mathSubject.id,
      teacher_id: teacher.id,
      zoom_meeting_id: meetingClass5 ? meetingClass5.id : null,
      lesson_date: todayStr,
      start_at: `${todayStr} 09:00:00`,
      end_at: `${todayStr} 23:59:00`,
      status: 'SCHEDULED'
    });
  }

  // 9. Ensure Class 5 Fee Structure and Monthly Challans
  let feeStructure = await knex('fee_structures').where({ class_id: class5.id, session_id: session.id }).first();
  if (!feeStructure) {
    const [fsId] = await knex('fee_structures').insert({
      class_id: class5.id,
      session_id: session.id,
      total_monthly_recurring: 7500.0,
      effective_from: '2026-08-01',
      status: 'ACTIVE',
      created_by: principalUser.id
    });
    feeStructure = { id: fsId };

    await knex('fee_structure_heads').insert([
      { fee_structure_id: fsId, head_type: 'TUITION', amount: 5000.0, is_recurring: 1 },
      { fee_structure_id: fsId, head_type: 'TECHNOLOGY', amount: 1500.0, is_recurring: 1 },
      { fee_structure_id: fsId, head_type: 'EXAMINATION', amount: 1000.0, is_recurring: 1 }
    ]);
  }

  for (let i = 0; i < createdStudentIds.length; i++) {
    const sId = createdStudentIds[i];
    const challan = await knex('fee_challans').where({ student_id: sId, billing_month: '2026-10' }).first();
    if (!challan) {
      await knex('fee_challans').insert({
        challan_number: `CHL-202610-${String(sId).padStart(4, '0')}`,
        consumer_number: `1000${String(sId).padStart(3, '0')}55${i}`,
        session_id: session.id,
        student_id: sId,
        class_id: class5.id,
        billing_month: '2026-10',
        issue_date: todayStr,
        due_date: '2026-10-31',
        valid_until: '2026-11-10',
        total_payable: 7500.0,
        paid_amount: i === 0 ? 7500.0 : 0.0,
        status: i === 0 ? 'PAID' : 'UNPAID'
      });
    }
  }

  // 10. Ensure Learning Tasks, Resources, and Notices
  const existingTask = await knex('learning_tasks').where({ class_id: class5.id }).first();
  if (!existingTask) {
    await knex('learning_tasks').insert({
      session_id: session.id,
      class_id: class5.id,
      subject_id: mathSubject.id,
      teacher_id: teacher.id,
      title: 'Assignment 4: Dividing Fractions Practice',
      instructions: 'Solve 10 problems on fraction division with step-by-step simplification. Invert divisor, multiply numerators and denominators, and express answers in lowest reduced terms.',
      assigned_date: todayStr,
      deadline: `${todayStr} 23:59:00`,
      total_marks: 20,
      grading_scale: 'NUMERIC',
      status: 'ACTIVE',
      created_by: teacherUser.id
    });
  }

  const existingNotice = await knex('school_notices').where({ title: 'Welcome to Academic Year 2026–27' }).first();
  if (!existingNotice) {
    await knex('school_notices').insert({
      title: 'Welcome to Academic Year 2026–27',
      content: 'Official online classes for Classes 1 to 8 have commenced. All daily timetables and Zoom live classrooms are now active on the portal.',
      audience: 'School-Wide',
      target_roles: JSON.stringify(['Teacher', 'Student', 'Parent']),
      priority: 'HIGH',
      status: 'PUBLISHED',
      publish_date: todayStr,
      created_by: principalUser.id
    });
  }
}
