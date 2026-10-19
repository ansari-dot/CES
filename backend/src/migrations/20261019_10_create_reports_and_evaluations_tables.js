/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // 1. Class Academic Evaluations table
  await knex.schema.createTable('class_academic_evaluations', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('class_id').unsigned().notNullable();
    table.bigInteger('session_id').unsigned().notNullable();
    table.string('evaluation_term', 50).notNullable().defaultTo('Mid-Year 2026');
    table.enu('published_status', ['DRAFT', 'PENDING_APPROVAL', 'PUBLISHED']).notNullable().defaultTo('DRAFT');
    table.bigInteger('approved_by').unsigned().nullable();
    table.specificType('approved_at', 'DATETIME(3)').nullable();
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

    table.unique(['class_id', 'session_id', 'evaluation_term'], 'uq_class_session_term');
    table.foreign('class_id').references('id').inTable('classes').onDelete('CASCADE');
    table.foreign('session_id').references('id').inTable('academic_sessions').onDelete('CASCADE');
    table.foreign('approved_by').references('id').inTable('users').onDelete('SET NULL');
  });

  // 2. Report Export Logs table
  await knex.schema.createTable('report_export_logs', (table) => {
    table.bigIncrements('id').primary();
    table.string('report_type', 60).notNullable();
    table.string('export_format', 20).notNullable().defaultTo('CSV'); // CSV, EXCEL, PDF
    table.json('filter_parameters').nullable();
    table.integer('row_count').notNullable().defaultTo(0);
    table.bigInteger('exported_by').unsigned().notNullable();
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));

    table.foreign('exported_by').references('id').inTable('users');
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('report_export_logs');
  await knex.schema.dropTableIfExists('class_academic_evaluations');
}
