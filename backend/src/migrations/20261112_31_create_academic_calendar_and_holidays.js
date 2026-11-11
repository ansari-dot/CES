/**
 * Migration 31: Academic Calendar & Holidays Module
 * Supports Principal-managed holiday breaks (e.g. Eid, Winter Vacation, Summer Break, Public Holidays)
 * and automatic class / timetable suppression during break dates.
 */

/**
 * @param {import('knex').Knex} knex
 */
export async function up(knex) {
  const hasHolidaysTable = await knex.schema.hasTable('academic_holidays');
  if (!hasHolidaysTable) {
    await knex.schema.createTable('academic_holidays', (table) => {
      table.bigIncrements('id').primary();
      table
        .bigInteger('session_id')
        .unsigned()
        .notNullable()
        .references('id')
        .inTable('academic_sessions')
        .onDelete('CASCADE');
      table.string('title', 120).notNullable();
      table.string('holiday_type', 50).notNullable().defaultTo('PUBLIC_HOLIDAY');
      table.date('start_date').notNullable();
      table.date('end_date').notNullable();
      table.string('description', 500).nullable();
      table.boolean('affects_all_classes').defaultTo(true);
      table.integer('auto_cancelled_lessons_count').defaultTo(0);
      table
        .bigInteger('created_by')
        .unsigned()
        .nullable()
        .references('id')
        .inTable('users')
        .onDelete('SET NULL');
      table.timestamps(true, true);

      table.index(['session_id', 'start_date', 'end_date'], 'idx_holidays_session_dates');
    });
  }
}

/**
 * @param {import('knex').Knex} knex
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('academic_holidays');
}

