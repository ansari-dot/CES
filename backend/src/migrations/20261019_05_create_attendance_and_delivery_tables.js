/**
 * Migration: Module 4 - Daily Operations (Lesson Delivery & Attendance)
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // 1. Add Lesson Delivery logging columns to timetable_lessons
  await knex.schema.alterTable('timetable_lessons', (table) => {
    table.specificType('actual_start_at', 'DATETIME(3)').nullable();
    table.specificType('actual_end_at', 'DATETIME(3)').nullable();
    table.string('topic_covered', 255).nullable();
    table.text('teaching_notes').nullable();
    table.string('resource_url', 500).nullable();
    table.enu('problem_category', ['NONE', 'TECHNICAL', 'ATTENDANCE', 'OTHER']).notNullable().defaultTo('NONE');
    table.specificType('delivery_logged_at', 'DATETIME(3)').nullable();
    table.bigInteger('delivery_logged_by').unsigned().nullable();

    table.foreign('delivery_logged_by').references('id').inTable('users').onDelete('SET NULL');
  });

  // 2. Create lesson_attendance table
  await knex.schema.createTable('lesson_attendance', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('lesson_id').unsigned().notNullable();
    table.bigInteger('student_id').unsigned().notNullable();
    table.enu('status', ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']).notNullable().defaultTo('PRESENT');
    table.bigInteger('marked_by_user_id').unsigned().notNullable();
    table.string('remarks', 255).nullable();
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

    table.unique(['lesson_id', 'student_id'], 'uq_lesson_student');
    table.index(['student_id', 'status'], 'ix_la_student_status');
    table.foreign('lesson_id').references('id').inTable('timetable_lessons').onDelete('CASCADE');
    table.foreign('student_id').references('id').inTable('students').onDelete('CASCADE');
    table.foreign('marked_by_user_id').references('id').inTable('users');
  });

  // 3. Create lesson_attendance_submissions table (Locking & Summary per SRS Section 9.4)
  await knex.schema.createTable('lesson_attendance_submissions', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('lesson_id').unsigned().notNullable().unique();
    table.bigInteger('submitted_by_user_id').unsigned().notNullable();
    table.specificType('submitted_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.boolean('is_locked').notNullable().defaultTo(true);
    table.integer('present_count').notNullable().defaultTo(0);
    table.integer('absent_count').notNullable().defaultTo(0);
    table.integer('late_count').notNullable().defaultTo(0);
    table.integer('excused_count').notNullable().defaultTo(0);
    table.integer('total_enrolled').notNullable().defaultTo(0);

    table.foreign('lesson_id').references('id').inTable('timetable_lessons').onDelete('CASCADE');
    table.foreign('submitted_by_user_id').references('id').inTable('users');
  });

  // 4. Create attendance_corrections table (Audit Vouchers per SRS Section 9.5)
  await knex.schema.createTable('attendance_corrections', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('lesson_id').unsigned().notNullable();
    table.bigInteger('student_id').unsigned().notNullable();
    table.bigInteger('attendance_record_id').unsigned().notNullable();
    table.bigInteger('requested_by_user_id').unsigned().notNullable();
    table.enu('original_status', ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']).notNullable();
    table.enu('proposed_status', ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']).notNullable();
    table.text('reason').notNullable();
    table.enu('status', ['PENDING', 'APPROVED', 'REJECTED']).notNullable().defaultTo('PENDING');
    table.bigInteger('reviewed_by_user_id').unsigned().nullable();
    table.string('review_remarks', 255).nullable();
    table.specificType('reviewed_at', 'DATETIME(3)').nullable();
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));

    table.index(['lesson_id'], 'ix_ac_lesson');
    table.index(['status'], 'ix_ac_status');
    table.foreign('lesson_id').references('id').inTable('timetable_lessons').onDelete('CASCADE');
    table.foreign('student_id').references('id').inTable('students').onDelete('CASCADE');
    table.foreign('attendance_record_id').references('id').inTable('lesson_attendance').onDelete('CASCADE');
    table.foreign('requested_by_user_id').references('id').inTable('users');
    table.foreign('reviewed_by_user_id').references('id').inTable('users');
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('attendance_corrections');
  await knex.schema.dropTableIfExists('lesson_attendance_submissions');
  await knex.schema.dropTableIfExists('lesson_attendance');
  await knex.schema.alterTable('timetable_lessons', (table) => {
    table.dropForeign(['delivery_logged_by']);
    table.dropColumns([
      'actual_start_at',
      'actual_end_at',
      'topic_covered',
      'teaching_notes',
      'resource_url',
      'problem_category',
      'delivery_logged_at',
      'delivery_logged_by'
    ]);
  });
}
