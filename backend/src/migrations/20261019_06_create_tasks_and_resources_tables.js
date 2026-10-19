/**
 * Migration: Module 5 - Learning Tasks, Submissions, Grading & Resources
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // 1. Learning Tasks table
  await knex.schema.createTable('learning_tasks', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('session_id').unsigned().notNullable();
    table.bigInteger('class_id').unsigned().notNullable();
    table.bigInteger('subject_id').unsigned().notNullable();
    table.bigInteger('teacher_id').unsigned().notNullable();
    table.string('title', 255).notNullable();
    table.text('instructions').notNullable();
    table.date('assigned_date').notNullable();
    table.specificType('deadline', 'DATETIME(3)').notNullable();
    table.integer('total_marks').notNullable().defaultTo(20);
    table.enu('grading_scale', ['NUMERIC', 'RUBRIC', 'LETTER']).notNullable().defaultTo('NUMERIC');
    table.json('rubric_criteria').nullable();
    table.string('handout_url', 500).nullable();
    table.string('handout_name', 255).nullable();
    table.enu('status', ['DRAFT', 'ACTIVE', 'ARCHIVED']).notNullable().defaultTo('ACTIVE');
    table.bigInteger('created_by').unsigned().notNullable();
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

    table.index(['class_id', 'subject_id'], 'ix_tasks_class_subject');
    table.index(['teacher_id'], 'ix_tasks_teacher');
    table.index(['deadline'], 'ix_tasks_deadline');

    table.foreign('session_id').references('id').inTable('academic_sessions').onDelete('CASCADE');
    table.foreign('class_id').references('id').inTable('classes').onDelete('CASCADE');
    table.foreign('subject_id').references('id').inTable('subjects').onDelete('CASCADE');
    table.foreign('teacher_id').references('id').inTable('teachers').onDelete('CASCADE');
    table.foreign('created_by').references('id').inTable('users');
  });

  // 2. Task Submissions table
  await knex.schema.createTable('task_submissions', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('task_id').unsigned().notNullable();
    table.bigInteger('student_id').unsigned().notNullable();
    table.specificType('submitted_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.string('file_url', 500).nullable();
    table.string('file_name', 255).nullable();
    table.string('file_size', 100).nullable();
    table.text('student_notes').nullable();
    table.enu('status', ['PENDING', 'GRADED', 'LATE', 'RESUBMIT_REQUESTED']).notNullable().defaultTo('PENDING');
    table.boolean('is_late').notNullable().defaultTo(false);
    table.decimal('marks_awarded', 5, 2).nullable();
    table.json('rubric_scores').nullable();
    table.text('feedback').nullable();
    table.bigInteger('graded_by').unsigned().nullable();
    table.specificType('graded_at', 'DATETIME(3)').nullable();
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

    table.unique(['task_id', 'student_id'], 'uq_task_student');
    table.index(['task_id', 'status'], 'ix_sub_task_status');
    table.index(['student_id'], 'ix_sub_student');

    table.foreign('task_id').references('id').inTable('learning_tasks').onDelete('CASCADE');
    table.foreign('student_id').references('id').inTable('students').onDelete('CASCADE');
    table.foreign('graded_by').references('id').inTable('users').onDelete('SET NULL');
  });

  // 3. Learning Resources table
  await knex.schema.createTable('learning_resources', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('class_id').unsigned().notNullable();
    table.bigInteger('subject_id').unsigned().notNullable();
    table.bigInteger('uploaded_by').unsigned().notNullable();
    table.string('title', 255).notNullable();
    table.text('description').nullable();
    table.enu('resource_type', ['SLIDES', 'PDF', 'RECORDING', 'DOCUMENT', 'LINK']).notNullable().defaultTo('PDF');
    table.string('file_url', 500).notNullable();
    table.string('file_size', 100).nullable();
    table.boolean('is_published').notNullable().defaultTo(true);
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

    table.index(['class_id', 'subject_id'], 'ix_res_class_subject');
    table.foreign('class_id').references('id').inTable('classes').onDelete('CASCADE');
    table.foreign('subject_id').references('id').inTable('subjects').onDelete('CASCADE');
    table.foreign('uploaded_by').references('id').inTable('users');
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('learning_resources');
  await knex.schema.dropTableIfExists('task_submissions');
  await knex.schema.dropTableIfExists('learning_tasks');
}
