/**
 * Migration: Academic module completion (assessment types, resource file names,
 * achievement visibility, class-targeted notices and per-user notice read state).
 * Additive only — no existing columns or rows are modified or removed.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // 1. Assessment type on learning tasks (assignment, quiz, test, examination)
  if (!(await knex.schema.hasColumn('learning_tasks', 'task_type'))) {
    await knex.schema.alterTable('learning_tasks', (table) => {
      table.enu('task_type', ['ASSIGNMENT', 'QUIZ', 'TEST', 'EXAM']).notNullable().defaultTo('ASSIGNMENT');
      table.index(['class_id', 'task_type'], 'ix_tasks_class_type');
    });
  }

  // 2. Original file name of uploaded learning resources
  if (!(await knex.schema.hasColumn('learning_resources', 'file_name'))) {
    await knex.schema.alterTable('learning_resources', (table) => {
      table.string('file_name', 255).nullable();
    });
  }

  // 3. Achievement / feedback context and visibility
  if (!(await knex.schema.hasColumn('student_achievements', 'visibility'))) {
    await knex.schema.alterTable('student_achievements', (table) => {
      table.bigInteger('subject_id').unsigned().nullable();
      table.bigInteger('session_id').unsigned().nullable();
      table.enu('visibility', ['PUBLISHED', 'INTERNAL']).notNullable().defaultTo('PUBLISHED');
      table.specificType('updated_at', 'DATETIME(3)').nullable();

      table.foreign('subject_id').references('id').inTable('subjects').onDelete('SET NULL');
      table.foreign('session_id').references('id').inTable('academic_sessions').onDelete('SET NULL');
    });
  }

  // 4. Class targeting and category on school notices
  if (!(await knex.schema.hasColumn('school_notices', 'target_class_ids'))) {
    await knex.schema.alterTable('school_notices', (table) => {
      table.json('target_class_ids').nullable(); // null = school-wide
      table.string('category', 80).nullable();
    });
  }

  // 5. Per-user read state for notices
  if (!(await knex.schema.hasTable('notice_reads'))) {
    await knex.schema.createTable('notice_reads', (table) => {
      table.bigInteger('notice_id').unsigned().notNullable();
      table.bigInteger('user_id').unsigned().notNullable();
      table.specificType('read_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));

      table.primary(['notice_id', 'user_id']);
      table.index(['user_id'], 'ix_nr_user');
      table.foreign('notice_id').references('id').inTable('school_notices').onDelete('CASCADE');
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    });
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('notice_reads');

  if (await knex.schema.hasColumn('school_notices', 'target_class_ids')) {
    await knex.schema.alterTable('school_notices', (table) => {
      table.dropColumn('target_class_ids');
      table.dropColumn('category');
    });
  }

  if (await knex.schema.hasColumn('student_achievements', 'visibility')) {
    await knex.schema.alterTable('student_achievements', (table) => {
      table.dropForeign(['subject_id']);
      table.dropForeign(['session_id']);
      table.dropColumn('subject_id');
      table.dropColumn('session_id');
      table.dropColumn('visibility');
      table.dropColumn('updated_at');
    });
  }

  if (await knex.schema.hasColumn('learning_resources', 'file_name')) {
    await knex.schema.alterTable('learning_resources', (table) => {
      table.dropColumn('file_name');
    });
  }

  if (await knex.schema.hasColumn('learning_tasks', 'task_type')) {
    await knex.schema.alterTable('learning_tasks', (table) => {
      table.dropIndex(['class_id', 'task_type'], 'ix_tasks_class_type');
      table.dropColumn('task_type');
    });
  }
}
