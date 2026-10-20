import { db } from '../src/shared/db/knex.js';

async function cleanResetDatabase() {
  console.log('--- Starting Database Clean Reset ---');

  const tablesToClear = [
    'refresh_tokens',
    'zoom_participant_log',
    'zoom_events',
    'zoom_alt_hosts',
    'task_submissions',
    'learning_tasks',
    'learning_resources',
    'student_achievements',
    'lesson_attendance',
    'lesson_attendance_submissions',
    'attendance_corrections',
    'timetable_change_log',
    'timetable_lessons',
    'timetable_slots',
    'teacher_salary_adjustments',
    'teacher_payroll_drafts',
    'fee_payment_proofs',
    'fee_challans',
    'student_concessions',
    'fee_structure_heads',
    'fee_structures',
    'parent_student',
    'enrollments',
    'students',
    'parents',
    'teacher_assignments',
    'teacher_salary_profiles',
    'teacher_zoom_accounts',
    'teachers',
    'account_status_history',
    'class_academic_evaluations',
    'operational_notifications',
    'school_notices',
    'report_export_logs',
    'audit_logs'
  ];

  await db.raw('SET FOREIGN_KEY_CHECKS = 0');

  for (const table of tablesToClear) {
    try {
      await db(table).truncate();
      console.log(`✓ Cleared table: ${table}`);
    } catch (err) {
      console.error(`Failed to truncate ${table}:`, err.message);
    }
  }

  // Delete all users except administrator
  const deletedUsers = await db('users')
    .whereNot({ username: 'admin' })
    .whereNot({ role_id: 1 })
    .del();
  console.log(`✓ Deleted ${deletedUsers} non-admin users. Only root admin remains.`);

  await db.raw('SET FOREIGN_KEY_CHECKS = 1');

  // Verify remaining users
  const remainingUsers = await db('users').select('id', 'username', 'email', 'full_name', 'role_id');
  console.log('\n--- Verification ---');
  console.log('Remaining users in database:');
  console.table(remainingUsers);

  // Check counts of wiped tables
  console.log('\nSample table counts after reset:');
  for (const table of ['teachers', 'students', 'parents', 'learning_tasks', 'fee_challans', 'lesson_attendance', 'refresh_tokens']) {
    const [{ count }] = await db(table).count('* as count');
    console.log(`- ${table}: ${count}`);
  }

  // Check preserved tables
  console.log('\nPreserved setup tables:');
  for (const table of ['roles', 'permissions', 'classes', 'subjects', 'academic_sessions']) {
    const [{ count }] = await db(table).count('* as count');
    console.log(`- ${table}: ${count}`);
  }

  console.log('\n--- Clean Reset Successfully Completed ---');
  process.exit(0);
}

cleanResetDatabase().catch((err) => {
  console.error('Fatal cleanup error:', err);
  process.exit(1);
});
