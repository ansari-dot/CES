/**
 * Migration: Student Achievements & Recognition Badges (SRS Section 8.3 & 12)
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  await knex.schema.createTable('student_achievements', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('student_id').unsigned().notNullable();
    table.bigInteger('teacher_id').unsigned().notNullable();
    table.bigInteger('class_id').unsigned().notNullable();
    table.string('badge_type', 50).notNullable().defaultTo('star');
    table.string('title', 255).notNullable();
    table.text('reason').notNullable();
    table.integer('stars_count').notNullable().defaultTo(3);
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));

    table.foreign('student_id').references('id').inTable('students').onDelete('CASCADE');
    table.foreign('teacher_id').references('id').inTable('teachers').onDelete('CASCADE');
    table.foreign('class_id').references('id').inTable('classes').onDelete('CASCADE');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('student_achievements');
}
