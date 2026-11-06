/**
 * Migration: Module - Production-Grade Monthly Test & Assessment Engine
 * Tables: monthly_tests, test_questions, test_attempts, test_attempt_answers
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // 1. Monthly Tests Table
  await knex.schema.createTable('monthly_tests', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('session_id').unsigned().notNullable();
    table.bigInteger('class_id').unsigned().notNullable();
    table.bigInteger('subject_id').unsigned().notNullable();
    table.bigInteger('teacher_id').unsigned().notNullable();
    table.string('title', 255).notNullable();
    table.text('description').nullable();
    table.string('month_name', 50).notNullable(); // e.g. "November 2026"
    table.integer('duration_minutes').unsigned().notNullable().defaultTo(45);
    table.decimal('total_marks', 6, 2).notNullable().defaultTo(20.00);
    table.decimal('passing_marks', 6, 2).notNullable().defaultTo(8.00);
    table.specificType('available_from', 'DATETIME(3)').notNullable();
    table.specificType('available_until', 'DATETIME(3)').notNullable();
    table.boolean('shuffle_questions').notNullable().defaultTo(false);
    table.boolean('shuffle_options').notNullable().defaultTo(false);
    table.integer('max_attempts').unsigned().notNullable().defaultTo(1);
    table.enu('status', ['DRAFT', 'PUBLISHED', 'CLOSED', 'CANCELLED', 'RESULTS_PUBLISHED']).notNullable().defaultTo('DRAFT');
    table.bigInteger('created_by').unsigned().notNullable();
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

    // Indexes
    table.index(['class_id', 'subject_id', 'status'], 'ix_mt_class_sub_status');
    table.index(['teacher_id', 'status'], 'ix_mt_teacher_status');
    table.index(['available_from', 'available_until'], 'ix_mt_availability');

    // Foreign Keys
    table.foreign('session_id').references('id').inTable('academic_sessions').onDelete('CASCADE');
    table.foreign('class_id').references('id').inTable('classes').onDelete('CASCADE');
    table.foreign('subject_id').references('id').inTable('subjects').onDelete('CASCADE');
    table.foreign('teacher_id').references('id').inTable('teachers').onDelete('CASCADE');
    table.foreign('created_by').references('id').inTable('users');
  });

  // 2. Test Questions Table
  await knex.schema.createTable('test_questions', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('test_id').unsigned().notNullable();
    table.integer('question_number').unsigned().notNullable();
    table.enu('question_type', ['MCQ', 'SHORT_ANSWER', 'LONG_ANSWER']).notNullable().defaultTo('MCQ');
    table.text('question_text').notNullable();
    table.string('image_url', 500).nullable();
    table.decimal('marks', 5, 2).notNullable().defaultTo(1.00);
    table.json('options').nullable(); // Array of { id: 'A', text: 'Option A' }
    table.string('correct_option', 10).nullable(); // 'A', 'B', etc. Masked in student endpoints!
    table.text('rubric_guide').nullable();
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

    // Constraints & Indexes
    table.foreign('test_id').references('id').inTable('monthly_tests').onDelete('CASCADE');
    table.unique(['test_id', 'question_number'], 'uq_tq_test_qnum');
    table.index(['test_id'], 'ix_tq_test');
  });

  // 3. Test Attempts Table
  await knex.schema.createTable('test_attempts', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('test_id').unsigned().notNullable();
    table.bigInteger('student_id').unsigned().notNullable();
    table.integer('attempt_number').unsigned().notNullable().defaultTo(1);
    table.specificType('started_at', 'DATETIME(3)').notNullable();
    table.specificType('expires_at', 'DATETIME(3)').notNullable();
    table.specificType('submitted_at', 'DATETIME(3)').nullable();
    table.enu('submission_trigger', ['MANUAL', 'AUTO_EXPIRED']).nullable();
    table.enu('status', ['IN_PROGRESS', 'SUBMITTED', 'GRADED']).notNullable().defaultTo('IN_PROGRESS');
    table.decimal('mcq_score', 6, 2).notNullable().defaultTo(0.00);
    table.decimal('subjective_score', 6, 2).nullable(); // NULL until teacher grades
    table.decimal('total_score', 6, 2).nullable(); // NULL until fully graded
    table.boolean('is_passed').nullable();
    table.text('teacher_remarks').nullable();
    table.bigInteger('graded_by').unsigned().nullable();
    table.specificType('graded_at', 'DATETIME(3)').nullable();
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

    // Constraints & Indexes
    table.foreign('test_id').references('id').inTable('monthly_tests').onDelete('RESTRICT'); // Prevent accidental wipe of historical tests
    table.foreign('student_id').references('id').inTable('students').onDelete('CASCADE');
    table.foreign('graded_by').references('id').inTable('users').onDelete('SET NULL');

    table.unique(['test_id', 'student_id', 'attempt_number'], 'uq_ta_test_student_attempt');
    table.index(['student_id', 'status'], 'ix_ta_student_status');
    table.index(['test_id', 'status'], 'ix_ta_test_status');
    table.index(['expires_at', 'status'], 'ix_ta_expiry_status');
  });

  // 4. Test Attempt Answers Table
  await knex.schema.createTable('test_attempt_answers', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('attempt_id').unsigned().notNullable();
    table.bigInteger('question_id').unsigned().notNullable();
    table.string('selected_option', 10).nullable();
    table.text('text_answer').nullable();
    table.string('attachment_url', 500).nullable();
    table.string('attachment_name', 255).nullable();
    table.boolean('is_correct').nullable();
    table.decimal('marks_awarded', 5, 2).nullable();
    table.text('teacher_feedback').nullable();
    table.specificType('saved_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

    // Constraints & Indexes
    table.foreign('attempt_id').references('id').inTable('test_attempts').onDelete('CASCADE');
    table.foreign('question_id').references('id').inTable('test_questions').onDelete('RESTRICT');
    table.unique(['attempt_id', 'question_id'], 'uq_taa_attempt_question');
    table.index(['attempt_id'], 'ix_taa_attempt');
  });
}

/**
 * Rollback Migration
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('test_attempt_answers');
  await knex.schema.dropTableIfExists('test_attempts');
  await knex.schema.dropTableIfExists('test_questions');
  await knex.schema.dropTableIfExists('monthly_tests');
}

