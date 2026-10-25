/**
 * Migration 14: Zoom automatic scheduling, 5-minute pre-class notifications,
 * teacher absence alerts, and handover tracking.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // 1. Add scheduling and handover audit columns to timetable_lessons
  await knex.schema.alterTable('timetable_lessons', (table) => {
    table.specificType('teacher_notified_at', 'DATETIME(3)').nullable();
    table.specificType('teacher_joined_at', 'DATETIME(3)').nullable();
    table.specificType('teacher_absence_alert_at', 'DATETIME(3)').nullable();
    table.specificType('handover_at', 'DATETIME(3)').nullable();
    table.string('handover_notes', 500).nullable();
    table.string('session_state', 40).notNullable().defaultTo('SCHEDULED');

    table.index(['session_state', 'start_at'], 'ix_tl_session_start');
    table.index(['teacher_notified_at'], 'ix_tl_notified');
    table.index(['teacher_absence_alert_at'], 'ix_tl_absence_alert');
  });

  // 2. Add config notes to zoom_meetings
  await knex.schema.alterTable('zoom_meetings', (table) => {
    table.text('config_notes').nullable();
  });

  // 3. Create zoom_schedule_locks table for idempotent cluster/restart-safe scheduler runs
  await knex.schema.createTable('zoom_schedule_locks', (table) => {
    table.string('job_name', 60).primary();
    table.specificType('locked_until', 'DATETIME(3)').nullable();
    table.specificType('last_run_at', 'DATETIME(3)').nullable();
    table.string('last_status', 50).nullable();
    table.text('last_error').nullable();
  });

  // Pre-populate scheduler job record
  await knex('zoom_schedule_locks').insert({
    job_name: 'ZOOM_CLASS_SCHEDULER',
    last_status: 'INITIALIZED'
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('zoom_schedule_locks');

  await knex.schema.alterTable('zoom_meetings', (table) => {
    table.dropColumn('config_notes');
  });

  await knex.schema.alterTable('timetable_lessons', (table) => {
    table.dropIndex(['session_state', 'start_at'], 'ix_tl_session_start');
    table.dropIndex(['teacher_notified_at'], 'ix_tl_notified');
    table.dropIndex(['teacher_absence_alert_at'], 'ix_tl_absence_alert');

    table.dropColumn('teacher_notified_at');
    table.dropColumn('teacher_joined_at');
    table.dropColumn('teacher_absence_alert_at');
    table.dropColumn('handover_at');
    table.dropColumn('handover_notes');
    table.dropColumn('session_state');
  });
}
