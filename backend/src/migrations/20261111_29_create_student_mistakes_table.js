/**
 * Migration: Student Mistakes & Weak Areas Improvement Ledger
 * Centralized tracking for diagnostic evaluation, remediation, and learning progress.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  const exists = await knex.schema.hasTable('student_mistakes');
  if (!exists) {
    await knex.schema.createTable('student_mistakes', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('student_id').unsigned().notNullable();
      table.bigInteger('class_id').unsigned().notNullable();
      table.bigInteger('subject_id').unsigned().notNullable();
      table.bigInteger('teacher_id').unsigned().notNullable();
      table.bigInteger('session_id').unsigned().nullable();
      table.string('topic', 255).notNullable();
      table.enu('mistake_type', ['CONCEPTUAL', 'CALCULATION', 'CARELESS', 'INCOMPLETE', 'FORMAT', 'OTHER']).notNullable().defaultTo('CONCEPTUAL');
      table.enu('severity', ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).notNullable().defaultTo('MEDIUM');
      table.text('description').notNullable();
      table.text('remediation_plan').nullable();
      table.text('teacher_private_notes').nullable();
      table.enu('status', ['IDENTIFIED', 'PRACTICING', 'RETESTED', 'RESOLVED']).notNullable().defaultTo('IDENTIFIED');
      table.specificType('resolved_at', 'DATETIME(3)').nullable();
      table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
      table.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

      table.foreign('student_id').references('id').inTable('students').onDelete('CASCADE');
      table.foreign('class_id').references('id').inTable('classes').onDelete('CASCADE');
      table.foreign('subject_id').references('id').inTable('subjects').onDelete('CASCADE');
      table.foreign('teacher_id').references('id').inTable('teachers').onDelete('CASCADE');
      table.foreign('session_id').references('id').inTable('academic_sessions').onDelete('SET NULL');

      table.index(['student_id', 'subject_id']);
      table.index(['class_id', 'subject_id']);
      table.index(['status']);
    });
  }
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('student_mistakes');
}

