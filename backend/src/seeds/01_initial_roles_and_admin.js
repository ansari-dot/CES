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
    const exists = await knex('roles').where({ id: r.id }).first();
    if (!exists) {
      await knex('roles').insert(r);
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
    { id: 19, code: 'system.settings.manage', description: 'Manage system settings and configurations' }
  ];

  for (const p of permissionsData) {
    const exists = await knex('permissions').where({ id: p.id }).first();
    if (!exists) {
      await knex('permissions').insert(p);
    }
  }

  // 3. Map Permissions to Roles
  const adminRolePerms = permissionsData.map((p) => ({ role_id: 1, permission_id: p.id }));
  const principalPermIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  const principalRolePerms = principalPermIds.map((pid) => ({ role_id: 2, permission_id: pid }));
  const teacherPermIds = [6, 7, 9, 10, 16];
  const teacherRolePerms = teacherPermIds.map((pid) => ({ role_id: 3, permission_id: pid }));

  const allRolePerms = [...adminRolePerms, ...principalRolePerms, ...teacherRolePerms];
  for (const rp of allRolePerms) {
    const exists = await knex('role_permissions').where({
      role_id: rp.role_id,
      permission_id: rp.permission_id
    }).first();
    if (!exists) {
      await knex('role_permissions').insert(rp);
    }
  }

  // 4. Create Initial Root Administrator User if not exists
  const adminUser = await knex('users').where({ username: 'admin' }).first();
  if (!adminUser) {
    const passwordHash = await hashPassword('AdminPassword123!');
    await knex('users').insert({
      id: 1,
      role_id: 1, // ADMIN
      username: 'admin',
      email: 'admin@school.pk',
      phone: '+923001234567',
      full_name: 'System Administrator',
      password_hash: passwordHash,
      must_change_password: 0,
      status: 'ACTIVE',
      token_version: 0
    });
  }
}
