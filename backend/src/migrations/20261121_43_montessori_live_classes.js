/**
 * Migration 43: Montessori Live Classes
 *
 * Regular live classes are timetable lessons bound to a permanent per-class Zoom room
 * (`class_zoom_meetings`, `timetable_lessons`), and `classes` only holds grades 1–8.
 * Montessori sections therefore get their own scheduled live classes here, kept
 * separate from the regular records while using the same Zoom account/integration.
 *
 *  - class_date / start_time / end_time: school wall-clock values as entered
 *  - start_at / end_at: the same instants in UTC (the convention used by timetable_lessons)
 *  - No host credentials (start URL, host key) are stored.
 *
 * Idempotent; nothing existing is modified.
 *
 * @param { import("knex").Knex } knex
 */
export async function up(knex) {
  if (await knex.schema.hasTable('montessori_live_classes')) return;
  await knex.schema.createTable('montessori_live_classes', (t) => {
    t.bigIncrements('id').primary();
    t.bigInteger('section_id').unsigned().notNullable();
    t.bigInteger('session_id').unsigned().notNullable();
    t.bigInteger('teacher_id').unsigned().notNullable();
    t.string('title', 150).notNullable();
    t.text('description').nullable();
    t.date('class_date').notNullable();
    t.time('start_time').notNullable();
    t.time('end_time').notNullable();
    t.dateTime('start_at').notNullable();
    t.dateTime('end_at').notNullable();
    t.enu('meeting_source', ['MANUAL', 'ZOOM_API']).notNullable().defaultTo('MANUAL');
    t.string('zoom_meeting_id', 40).nullable();
    t.string('join_url', 1000).notNullable();
    t.string('passcode', 50).nullable();
    t.enu('status', ['SCHEDULED', 'CANCELLED']).notNullable().defaultTo('SCHEDULED');
    t.specificType('cancelled_at', 'DATETIME(3)').nullable();
    t.bigInteger('cancelled_by').unsigned().nullable();
    t.string('cancel_reason', 300).nullable();
    t.bigInteger('created_by').unsigned().nullable();
    t.bigInteger('updated_by').unsigned().nullable();
    t.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    t.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));
    t.index(['section_id', 'start_at'], 'ix_mont_live_section_start');
    t.index(['teacher_id', 'start_at'], 'ix_mont_live_teacher_start');
    t.index(['status', 'end_at'], 'ix_mont_live_status_end');
    t.foreign('section_id').references('id').inTable('montessori_sections').onDelete('RESTRICT');
    t.foreign('session_id').references('id').inTable('academic_sessions').onDelete('RESTRICT');
    t.foreign('teacher_id').references('id').inTable('teachers').onDelete('RESTRICT');
    t.foreign('cancelled_by').references('id').inTable('users').onDelete('SET NULL');
    t.foreign('created_by').references('id').inTable('users').onDelete('SET NULL');
    t.foreign('updated_by').references('id').inTable('users').onDelete('SET NULL');
  });
}

/** Development rollback only: drops the Montessori live class records. */
export async function down(knex) {
  await knex.schema.dropTableIfExists('montessori_live_classes');
}
