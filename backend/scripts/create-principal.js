import { db } from '../src/shared/db/knex.js';
import { hashPassword } from '../src/shared/crypto/password.js';

async function createPrincipal() {
  const args = process.argv.slice(2);
  const username = args[0] || 'principal';
  const password = args[1] || 'PrincipalPassword123!';
  const email = args[2] || 'principal@school.pk';
  const fullName = args[3] || 'Prof. Tariq Mahmood';
  const phone = args[4] || '+923009876543';

  console.log(`\n===========================================`);
  console.log(`   ONLINE SCHOOL - PRINCIPAL ACCOUNT SCRIPT`);
  console.log(`===========================================`);
  console.log(`Setting up Principal user: [${username}] ...`);

  // 1. Ensure core roles exist
  const roles = [
    { id: 1, code: 'ADMIN', name: 'Administrator' },
    { id: 2, code: 'PRINCIPAL', name: 'Principal' },
    { id: 3, code: 'TEACHER', name: 'Teacher' },
    { id: 4, code: 'STUDENT', name: 'Student' },
    { id: 5, code: 'PARENT', name: 'Parent' }
  ];
  for (const r of roles) {
    const exists = await db('roles').where({ code: r.code }).first();
    if (!exists) {
      await db('roles').insert(r).catch(() => {});
    }
  }

  // Ensure role PRINCIPAL exists
  let principalRole = await db('roles').where({ code: 'PRINCIPAL' }).first();
  if (!principalRole) {
    const [roleId] = await db('roles').insert({
      code: 'PRINCIPAL',
      name: 'Principal'
    });
    principalRole = { id: roleId };
  }

  // 2. Ensure all core permissions exist and are mapped to PRINCIPAL
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
    let perm = await db('permissions').where({ code: p.code }).first();
    if (!perm) {
      try {
        const [newId] = await db('permissions').insert(p);
        perm = { id: newId };
      } catch {
        perm = await db('permissions').where({ code: p.code }).first();
      }
    }
    if (perm && perm.id) {
      const rolePerm = await db('role_permissions').where({
        role_id: principalRole.id,
        permission_id: perm.id
      }).first();
      if (!rolePerm) {
        await db('role_permissions').insert({
          role_id: principalRole.id,
          permission_id: perm.id
        }).catch(() => {});
      }
    }
  }
  console.log(`✅ Roles and administrative permissions synced for PRINCIPAL.`);

  // Hash password using Argon2id per SRS Section 4.6
  const passwordHash = await hashPassword(password);

  // Check if user already exists
  const existingUser = await db('users')
    .where({ username })
    .orWhere({ email })
    .first();

  let userId;
  if (existingUser) {
    await db('users')
      .where({ id: existingUser.id })
      .update({
        username,
        email,
        phone,
        full_name: fullName,
        password_hash: passwordHash,
        role_id: principalRole.id,
        status: 'ACTIVE',
        must_change_password: 0,
        locked_until: null,
        failed_login_count: 0
      });
    userId = existingUser.id;
    console.log(`\n✅ Existing user updated successfully!`);
  } else {
    const [insertedId] = await db('users').insert({
      role_id: principalRole.id,
      username,
      email,
      phone,
      full_name: fullName,
      password_hash: passwordHash,
      must_change_password: 0,
      status: 'ACTIVE',
      token_version: 0
    });
    userId = insertedId;
    console.log(`\n✅ Principal user created successfully!`);
  }

  console.log(`\nUser Details:`);
  console.log(`-------------------------------------------`);
  console.log(`ID:        ${userId}`);
  console.log(`Username:  ${username}`);
  console.log(`Email:     ${email}`);
  console.log(`Full Name: ${fullName}`);
  console.log(`Role:      PRINCIPAL (Role ID: ${principalRole.id})`);
  console.log(`Password:  ${password}`);
  console.log(`-------------------------------------------`);
  console.log(`You can now log in using either the username or email.\n`);

  await db.destroy();
}

createPrincipal().catch((err) => {
  console.error('Failed to create Principal:', err);
  process.exit(1);
});
