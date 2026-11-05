import { hashPassword } from '../shared/crypto/password.js';

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
  // 1. Insert/Ensure Roles
  const roles = [
    { id: 1, code: 'ADMIN', name: 'Administrator' },
    { id: 2, code: 'PRINCIPAL', name: 'Principal' },
    { id: 3, code: 'TEACHER', name: 'Teacher' },
    { id: 4, code: 'STUDENT', name: 'Student' },
    { id: 5, code: 'PARENT', name: 'Parent' }
  ];

  for (const r of roles) {
    const byCode = await knex('roles').where({ code: r.code }).first();
    if (!byCode) {
      const byId = await knex('roles').where({ id: r.id }).first();
      if (!byId) {
        await knex('roles').insert(r).catch(() => {});
      } else {
        await knex('roles').insert({ code: r.code, name: r.name }).catch(() => {});
      }
    }
  }

  // 2. Insert Core Permissions
  const permissionsData = [
    { id: 1, code: 'users.manage', description: 'Create and manage user accounts' },
    { id: 2, code: 'academic.setup.manage', description: 'Manage sessions, classes and subjects' },
    { id: 3, code: 'timetable.manage', description: 'Create, edit and manage timetable slots' },
    { id: 4, code: 'timetable.publish', description: 'Publish timetable and generate lessons' },
    { id: 5, code: 'zoom.meeting.manage', description: 'Manage Zoom recurring class meetings' },
    { id: 6, code: 'zoom.session.start', description: 'Start Zoom live teaching sessions' },
    { id: 7, code: 'attendance.mark', description: 'Mark lesson attendance' },
    { id: 8, code: 'attendance.correct', description: 'Approve or apply attendance corrections' },
    { id: 9, code: 'tasks.manage', description: 'Manage learning tasks and resources' },
    { id: 10, code: 'tasks.grade', description: 'Grade student task and project submissions' },
    { id: 11, code: 'fees.structure.manage', description: 'Manage fee structures and concessions' },
    { id: 12, code: 'fees.challan.generate', description: 'Generate monthly fee challans' },
    { id: 13, code: 'fees.payment.review', description: 'Approve or reject fee payment submissions' },
    { id: 14, code: 'payroll.draft.manage', description: 'Prepare and manage teacher payroll drafts' },
    { id: 15, code: 'payroll.draft.approve', description: 'Approve teacher salary drafts' },
    { id: 16, code: 'reports.view', description: 'View operational and performance reports' },
    { id: 17, code: 'reports.export', description: 'Export operational data to Excel or PDF' },
    { id: 18, code: 'audit.view', description: 'View system audit logs' },
    { id: 19, code: 'system.settings.manage', description: 'Manage system settings and configurations' },
    { id: 20, code: 'fees.access.restore', description: 'Restore student portal access restricted for overdue fees' },
    { id: 21, code: 'results.manage', description: 'Compute, review, approve and publish final examination results' },
    { id: 22, code: 'promotions.manage', description: 'Evaluate, decide and execute student promotion and retention' }
  ];

  for (const p of permissionsData) {
    const exists = await knex('permissions').where({ code: p.code }).first();
    if (!exists) {
      await knex('permissions').insert(p).catch(() => {});
    }
  }

  // 3. Map Permissions dynamically to Roles
  const adminRole = await knex('roles').where({ code: 'ADMIN' }).first();
  const principalRole = await knex('roles').where({ code: 'PRINCIPAL' }).first();
  const teacherRole = await knex('roles').where({ code: 'TEACHER' }).first();

  const allDbPerms = await knex('permissions').select('id', 'code');
  const permMap = new Map(allDbPerms.map(p => [p.code, p.id]));

  const allRolePerms = [];

  if (adminRole) {
    for (const p of permissionsData) {
      const pid = permMap.get(p.code) || p.id;
      allRolePerms.push({ role_id: adminRole.id, permission_id: pid });
    }
  }

  if (principalRole) {
    for (const p of permissionsData) {
      const pid = permMap.get(p.code) || p.id;
      allRolePerms.push({ role_id: principalRole.id, permission_id: pid });
    }
  }

  if (teacherRole) {
    const teacherPermCodes = ['zoom.session.start', 'attendance.mark', 'tasks.manage', 'tasks.grade', 'reports.view'];
    for (const code of teacherPermCodes) {
      const pid = permMap.get(code);
      if (pid) {
        allRolePerms.push({ role_id: teacherRole.id, permission_id: pid });
      }
    }
  }

  for (const rp of allRolePerms) {
    const exists = await knex('role_permissions').where({
      role_id: rp.role_id,
      permission_id: rp.permission_id
    }).first();
    if (!exists) {
      await knex('role_permissions').insert(rp).catch(() => {});
    }
  }

  // 4. Create Initial Root Administrator User if not exists
  const adminUser = await knex('users').where({ username: 'admin' }).first();
  if (!adminUser && adminRole) {
    const passwordHash = await hashPassword('AdminPassword123!');
    await knex('users').insert({
      role_id: adminRole.id,
      username: 'admin',
      email: 'admin@school.pk',
      phone: '+923001234567',
      full_name: 'System Administrator',
      password_hash: passwordHash,
      must_change_password: 0,
      status: 'ACTIVE',
      token_version: 0
    }).catch(() => {});
  }
}
