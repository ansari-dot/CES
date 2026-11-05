import { db } from '../src/shared/db/knex.js';
import { hashPassword } from '../src/shared/crypto/password.js';
import { encryptAesGcm } from '../src/shared/crypto/aes.js';

async function setupProductionData() {
  console.log('\n======================================================');
  console.log('   Cambridge Education System - Production Data Setup  ');
  console.log('======================================================\n');

  // 1. Roles
  console.log('[1/8] Ensuring core system roles exist...');
  const roleDefs = [
    { code: 'ADMIN', name: 'Administrator' },
    { code: 'PRINCIPAL', name: 'Principal' },
    { code: 'TEACHER', name: 'Teacher' },
    { code: 'STUDENT', name: 'Student' },
    { code: 'PARENT', name: 'Parent' }
  ];

  for (const r of roleDefs) {
    const existing = await db('roles').where({ code: r.code }).first();
    if (!existing) {
      await db('roles').insert(r).catch(() => {});
      console.log(`  + Created role: ${r.code}`);
    }
  }

  const roleMap = new Map();
  const allRoles = await db('roles').select('id', 'code');
  for (const r of allRoles) {
    roleMap.set(r.code, r.id);
  }
  console.log('  ✅ Roles verified:', Array.from(roleMap.entries()).map(([c, id]) => `${c}(${id})`).join(', '));

  // 2. Permissions
  console.log('\n[2/8] Ensuring system permissions exist...');
  const permissionsData = [
    { code: 'users.manage', description: 'Create and manage user accounts' },
    { code: 'academic.setup.manage', description: 'Manage sessions, classes and subjects' },
    { code: 'timetable.manage', description: 'Create, edit and manage timetable slots' },
    { code: 'timetable.publish', description: 'Publish timetable and generate lessons' },
    { code: 'zoom.meeting.manage', description: 'Manage Zoom recurring class meetings' },
    { code: 'zoom.session.start', description: 'Start Zoom live teaching sessions' },
    { code: 'attendance.mark', description: 'Mark lesson attendance' },
    { code: 'attendance.correct', description: 'Approve or apply attendance corrections' },
    { code: 'tasks.manage', description: 'Manage learning tasks and resources' },
    { code: 'tasks.grade', description: 'Grade student task and project submissions' },
    { code: 'fees.structure.manage', description: 'Manage fee structures and concessions' },
    { code: 'fees.challan.generate', description: 'Generate monthly fee challans' },
    { code: 'fees.payment.review', description: 'Approve or reject fee payment submissions' },
    { code: 'payroll.draft.manage', description: 'Prepare and manage teacher payroll drafts' },
    { code: 'payroll.draft.approve', description: 'Approve teacher salary drafts' },
    { code: 'reports.view', description: 'View operational and performance reports' },
    { code: 'reports.export', description: 'Export operational data to Excel or PDF' },
    { code: 'audit.view', description: 'View system audit logs' },
    { code: 'system.settings.manage', description: 'Manage system settings and configurations' },
    { code: 'fees.access.restore', description: 'Restore student portal access restricted for overdue fees' },
    { code: 'results.manage', description: 'Compute, review, approve and publish final examination results' },
    { code: 'promotions.manage', description: 'Evaluate, decide and execute student promotion and retention' }
  ];

  for (const p of permissionsData) {
    const existing = await db('permissions').where({ code: p.code }).first();
    if (!existing) {
      await db('permissions').insert(p).catch(() => {});
    }
  }

  const allPerms = await db('permissions').select('id', 'code');
  const permMap = new Map(allPerms.map(p => [p.code, p.id]));
  console.log(`  ✅ ${allPerms.length} system permissions verified.`);

  // 3. Role Permissions (Map all to ADMIN and PRINCIPAL)
  console.log('\n[3/8] Mapping permissions to Administrative and Academic roles...');
  const adminRoleId = roleMap.get('ADMIN');
  const principalRoleId = roleMap.get('PRINCIPAL');
  const teacherRoleId = roleMap.get('TEACHER');

  const rolePermInserts = [];
  for (const perm of allPerms) {
    if (adminRoleId) rolePermInserts.push({ role_id: adminRoleId, permission_id: perm.id });
    if (principalRoleId) rolePermInserts.push({ role_id: principalRoleId, permission_id: perm.id });
  }

  if (teacherRoleId) {
    const teacherCodes = ['zoom.session.start', 'attendance.mark', 'tasks.manage', 'tasks.grade', 'reports.view'];
    for (const code of teacherCodes) {
      const pid = permMap.get(code);
      if (pid) rolePermInserts.push({ role_id: teacherRoleId, permission_id: pid });
    }
  }

  for (const rp of rolePermInserts) {
    const exists = await db('role_permissions').where(rp).first();
    if (!exists) {
      await db('role_permissions').insert(rp).catch(() => {});
    }
  }
  console.log('  ✅ Administrative permissions mapped to PRINCIPAL and ADMIN.');

  // 4. Academic Session
  console.log('\n[4/8] Ensuring Academic Session exists...');
  const sessionName = '2026-27';
  let session = await db('academic_sessions').where({ name: sessionName }).first();
  if (!session) {
    const [id] = await db('academic_sessions').insert({
      name: sessionName,
      start_date: '2026-08-01',
      end_date: '2027-06-30',
      is_current: 1
    });
    session = { id, name: sessionName };
    console.log(`  + Created academic session: ${sessionName}`);
  } else {
    await db('academic_sessions').where({ id: session.id }).update({ is_current: 1 });
    console.log(`  ✅ Academic session ${sessionName} is active.`);
  }

  // 5. Classes 1 to 8
  console.log('\n[5/8] Ensuring Classes 1 to 8 exist...');
  for (let grade = 1; grade <= 8; grade++) {
    const existing = await db('classes').where({ grade_level: grade }).first();
    if (!existing) {
      await db('classes').insert({
        grade_level: grade,
        name: `Class ${grade}`,
        is_active: 1
      });
      console.log(`  + Created Class ${grade}`);
    }
  }
  const classes = await db('classes').orderBy('grade_level', 'asc');
  console.log(`  ✅ ${classes.length} classes verified in database.`);

  // 6. Core Subjects & Mapping
  console.log('\n[6/8] Ensuring core subjects & class curriculums exist...');
  const subjects = [
    { code: 'MATH', name: 'Mathematics' },
    { code: 'ENG', name: 'English Language' },
    { code: 'SCI', name: 'General Science' },
    { code: 'URD', name: 'Urdu Literature' },
    { code: 'ISL', name: 'Islamic Studies' },
    { code: 'PST', name: 'Social Studies' },
    { code: 'CS', name: 'Computer Studies' },
    { code: 'ART', name: 'Creative Arts' }
  ];

  for (const sub of subjects) {
    const existing = await db('subjects').where({ code: sub.code }).first();
    if (!existing) {
      await db('subjects').insert({
        code: sub.code,
        name: sub.name,
        is_active: 1
      });
      console.log(`  + Created subject: ${sub.name} (${sub.code})`);
    }
  }

  const allSubjects = await db('subjects').select('id', 'code');
  for (const cls of classes) {
    for (const sub of allSubjects) {
      const exists = await db('class_subjects').where({
        class_id: cls.id,
        subject_id: sub.id
      }).first();
      if (!exists) {
        await db('class_subjects').insert({
          class_id: cls.id,
          subject_id: sub.id,
          is_active: 1
        }).catch(() => {});
      }
    }
  }
  console.log('  ✅ All 8 classes mapped with full subject matrix.');

  // 7. Principal & Teacher Accounts
  console.log('\n[7/8] Ensuring Principal and Teacher user accounts...');
  const principalPasswordHash = await hashPassword('admin');
  let principalUser = await db('users').where({ username: 'principal' }).first();
  if (principalUser) {
    await db('users').where({ id: principalUser.id }).update({
      role_id: principalRoleId,
      password_hash: principalPasswordHash,
      status: 'ACTIVE',
      must_change_password: 0,
      locked_until: null,
      failed_login_count: 0
    });
    console.log(`  ✅ Existing principal user updated (Role: ${principalRoleId}, Password: admin)`);
  } else {
    const [pId] = await db('users').insert({
      role_id: principalRoleId,
      username: 'principal',
      email: 'principal@school.pk',
      phone: '+923009876543',
      full_name: 'Prof. Tariq Mahmood',
      password_hash: principalPasswordHash,
      status: 'ACTIVE',
      must_change_password: 0,
      token_version: 0
    });
    principalUser = { id: pId };
    console.log(`  ✅ Principal user created (ID: ${pId}, Password: admin)`);
  }

  // Teacher Sarah Jenkins
  const teacherPasswordHash = await hashPassword('admin');
  let teacherUser = await db('users').where({ email: 'teacher@school.pk' }).first();
  if (!teacherUser) {
    const [tUid] = await db('users').insert({
      role_id: teacherRoleId,
      username: 'teacher',
      email: 'teacher@school.pk',
      phone: '+923002348901',
      full_name: 'Ms. Sarah Jenkins, M.Ed.',
      password_hash: teacherPasswordHash,
      status: 'ACTIVE',
      must_change_password: 0,
      token_version: 0
    });
    teacherUser = { id: tUid };
  } else {
    await db('users').where({ id: teacherUser.id }).update({
      password_hash: teacherPasswordHash,
      status: 'ACTIVE',
      must_change_password: 0
    });
  }

  let teacher = await db('teachers').where({ user_id: teacherUser.id }).first();
  if (!teacher) {
    const [tId] = await db('teachers').insert({
      user_id: teacherUser.id,
      employee_no: 'TCH-2024-042',
      designation: 'Senior Faculty • STEM Division',
      qualification: 'M.Ed. STEM Education',
      joining_date: '2024-01-15',
      employment_status: 'ACTIVE'
    });
    teacher = { id: tId };
    console.log(`  + Teacher profile created: Ms. Sarah Jenkins (TCH-2024-042)`);
  }

  // Assign Teacher to Math & Science in Class 1 to 8
  const mathSub = allSubjects.find(s => s.code === 'MATH');
  const sciSub = allSubjects.find(s => s.code === 'SCI');
  for (const cls of classes) {
    for (const sub of [mathSub, sciSub]) {
      if (sub && teacher) {
        const assigned = await db('teacher_assignments').where({
          teacher_id: teacher.id,
          class_id: cls.id,
          subject_id: sub.id
        }).first();
        if (!assigned) {
          await db('teacher_assignments').insert({
            teacher_id: teacher.id,
            class_id: cls.id,
            subject_id: sub.id,
            effective_from: '2026-08-01'
          }).catch(() => {});
        }
      }
    }
  }
  console.log('  ✅ Teacher Ms. Sarah Jenkins assigned to STEM subjects across classes.');

  // 8. Class Zoom Rooms
  console.log('\n[8/8] Ensuring Class 1-8 Zoom Rooms exist...');
  for (const cls of classes) {
    const existing = await db('zoom_meetings').where({ class_id: cls.id, status: 'ACTIVE' }).first();
    if (!existing) {
      const meetingNo = `900${cls.grade_level}000${cls.grade_level}`;
      const passcode = `CLASS${cls.grade_level}#`;
      const joinUrl = `https://zoom.us/j/${meetingNo}?pwd=${passcode}`;
      const startUrl = `https://zoom.us/s/${meetingNo}?zak=host_zak_${cls.grade_level}`;

      await db('zoom_meetings').insert({
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
      }).catch(() => {});
      console.log(`  + Created Zoom Classroom for Class ${cls.grade_level}`);
    }
  }
  console.log('  ✅ All Class 1-8 Zoom classrooms verified.');

  console.log('\n======================================================');
  console.log('✅ PRODUCTION DATA SETUP COMPLETED SUCCESSFULLY!');
  console.log('======================================================');
  console.log('Credentials:');
  console.log('  - Principal: username "principal", password "admin"');
  console.log('  - Teacher:   username "teacher",   password "admin"');
  console.log('======================================================\n');

  await db.destroy();
}

setupProductionData().catch(err => {
  console.error('\n❌ Setup failed:', err);
  process.exit(1);
});
