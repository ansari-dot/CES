/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // 1. Classes table (Classes 1..8 with CHECK constraint)
  await knex.schema.createTable('classes', (table) => {
    table.bigIncrements('id').primary();
    table.specificType('grade_level', 'TINYINT UNSIGNED').notNullable().unique();
    table.string('name', 40).notNullable();
    table.tinyint('is_active', 1).notNullable().defaultTo(1);
    table.check('grade_level >= 1 AND grade_level <= 8', [], 'chk_grade_level');
  });

  // 2. Academic Sessions table
  await knex.schema.createTable('academic_sessions', (table) => {
    table.bigIncrements('id').primary();
    table.string('name', 30).notNullable().unique(); // e.g. "2026-27"
    table.date('start_date').notNullable();
    table.date('end_date').notNullable();
    table.tinyint('is_current', 1).notNullable().defaultTo(0);
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));
  });

  // 3. Subjects table
  await knex.schema.createTable('subjects', (table) => {
    table.bigIncrements('id').primary();
    table.string('code', 30).notNullable().unique();
    table.string('name', 60).notNullable();
    table.tinyint('is_active', 1).notNullable().defaultTo(1);
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
  });

  // 4. Class-Subjects table
  await knex.schema.createTable('class_subjects', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('class_id').unsigned().notNullable();
    table.bigInteger('subject_id').unsigned().notNullable();
    table.tinyint('is_active', 1).notNullable().defaultTo(1);

    table.unique(['class_id', 'subject_id'], 'uq_class_subject');
    table.foreign('class_id').references('id').inTable('classes').onDelete('CASCADE');
    table.foreign('subject_id').references('id').inTable('subjects').onDelete('CASCADE');
  });

  // 5. Students table
  await knex.schema.createTable('students', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('user_id').unsigned().notNullable().unique();
    table.string('admission_no', 50).notNullable().unique();
    table.string('roll_no', 30).nullable();
    table.date('date_of_birth').nullable();
    table.enu('gender', ['MALE', 'FEMALE', 'OTHER']).nullable();
    table.date('admission_date').notNullable();
    table.bigInteger('current_class_id').unsigned().notNullable();
    table.enu('status', ['ACTIVE', 'INACTIVE', 'GRADUATED']).notNullable().defaultTo('ACTIVE');
    table.text('notes').nullable();
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('current_class_id').references('id').inTable('classes');
  });

  // 6. Parents table
  await knex.schema.createTable('parents', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('user_id').unsigned().notNullable().unique();
    table.string('cnic_or_id_no', 100).nullable();
    table.string('relation_default', 30).nullable();
    table.enu('verification_status', ['PENDING', 'APPROVED', 'REJECTED']).notNullable().defaultTo('PENDING');
    table.bigInteger('verified_by').unsigned().nullable();
    table.specificType('verified_at', 'DATETIME(3)').nullable();
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

    table.index(['verification_status'], 'ix_parent_verification');
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('verified_by').references('id').inTable('users').onDelete('SET NULL');
  });

  // 7. Parent-Student relation table
  await knex.schema.createTable('parent_student', (table) => {
    table.bigInteger('parent_id').unsigned().notNullable();
    table.bigInteger('student_id').unsigned().notNullable();
    table.enu('relation', ['FATHER', 'MOTHER', 'GUARDIAN']).notNullable().defaultTo('GUARDIAN');
    table.tinyint('is_primary', 1).notNullable().defaultTo(0);
    table.bigInteger('linked_by').unsigned().notNullable();
    table.specificType('linked_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));

    table.primary(['parent_id', 'student_id']);
    table.index(['student_id'], 'ix_ps_student');
    table.foreign('parent_id').references('id').inTable('parents').onDelete('CASCADE');
    table.foreign('student_id').references('id').inTable('students').onDelete('CASCADE');
    table.foreign('linked_by').references('id').inTable('users');
  });

  // 8. Enrollments table
  await knex.schema.createTable('enrollments', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('student_id').unsigned().notNullable();
    table.bigInteger('class_id').unsigned().notNullable();
    table.bigInteger('session_id').unsigned().notNullable();
    table.string('roll_no', 30).nullable();
    table.enu('status', ['ACTIVE', 'PROMOTED', 'TRANSFERRED', 'WITHDRAWN']).notNullable().defaultTo('ACTIVE');
    table.date('enrolled_on').notNullable();
    table.date('ended_on').nullable();

    table.unique(['student_id', 'session_id'], 'uq_student_session');
    table.index(['class_id', 'session_id', 'status'], 'ix_enrollment_class_session');
    table.foreign('student_id').references('id').inTable('students').onDelete('CASCADE');
    table.foreign('class_id').references('id').inTable('classes');
    table.foreign('session_id').references('id').inTable('academic_sessions');
  });

  // 9. Teacher Assignments table
  await knex.schema.createTable('teacher_assignments', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('teacher_id').unsigned().notNullable();
    table.bigInteger('class_id').unsigned().notNullable();
    table.bigInteger('subject_id').unsigned().notNullable();
    table.bigInteger('session_id').unsigned().notNullable();
    table.date('effective_from').notNullable();
    table.date('effective_to').nullable();
    table.bigInteger('assigned_by').unsigned().notNullable();

    table.index(['teacher_id', 'class_id', 'subject_id'], 'ix_ta_teacher_class_sub');
    table.foreign('teacher_id').references('id').inTable('teachers').onDelete('CASCADE');
    table.foreign('class_id').references('id').inTable('classes').onDelete('CASCADE');
    table.foreign('subject_id').references('id').inTable('subjects').onDelete('CASCADE');
    table.foreign('session_id').references('id').inTable('academic_sessions').onDelete('CASCADE');
    table.foreign('assigned_by').references('id').inTable('users');
  });

  // 10. Teacher Zoom Accounts table
  await knex.schema.createTable('teacher_zoom_accounts', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('teacher_id').unsigned().notNullable().unique();
    table.string('zoom_user_id', 64).notNullable().unique();
    table.string('zoom_email', 190).notNullable();
    table.tinyint('is_licensed', 1).notNullable().defaultTo(1);
    table.enu('status', ['ACTIVE', 'INACTIVE']).notNullable().defaultTo('ACTIVE');
    table.specificType('verified_at', 'DATETIME(3)').nullable();

    table.foreign('teacher_id').references('id').inTable('teachers').onDelete('CASCADE');
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('teacher_zoom_accounts');
  await knex.schema.dropTableIfExists('teacher_assignments');
  await knex.schema.dropTableIfExists('enrollments');
  await knex.schema.dropTableIfExists('parent_student');
  await knex.schema.dropTableIfExists('parents');
  await knex.schema.dropTableIfExists('students');
  await knex.schema.dropTableIfExists('class_subjects');
  await knex.schema.dropTableIfExists('subjects');
  await knex.schema.dropTableIfExists('academic_sessions');
  await knex.schema.dropTableIfExists('classes');
}
