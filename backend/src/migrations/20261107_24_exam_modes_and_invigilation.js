/**
 * Migration 24: Two Examination Modes (DEDICATED_EXAM vs TIMETABLE_ASSESSMENT) & Invigilation Tracking
 * 
 * MODE A: DEDICATED_EXAM (MID_TERM, FINAL_TERM)
 *   - School-wide exam period (start_date to end_date)
 *   - Suppresses regular lectures, handovers, and false absences
 *   - One subject per class per day enforcement
 *   - Dedicated invigilator Zoom tracking
 * 
 * MODE B: TIMETABLE_ASSESSMENT (MONTHLY_TEST, CLASS_QUIZ)
 *   - Conducted within regular teaching timetable periods
 *   - START_OF_LECTURE, END_OF_LECTURE, or ENTIRE_LECTURE
 *   - Regular Zoom classroom remains active, normal duty tracking continues
 */

export async function up(knex) {
  // 1. Extend examination_date_sheets
  await knex.schema.alterTable('examination_date_sheets', (table) => {
    table.date('start_date').nullable().after('title');
    table.date('end_date').nullable().after('start_date');
    table.enu('scheduling_mode', ['DEDICATED_EXAM', 'TIMETABLE_ASSESSMENT']).notNullable().defaultTo('DEDICATED_EXAM').after('exam_type');
    table.index(['start_date', 'end_date'], 'ix_ds_period');
    table.index(['scheduling_mode'], 'ix_ds_mode');
  });

  // 2. Extend date_sheet_entries
  await knex.schema.alterTable('date_sheet_entries', (table) => {
    table.bigInteger('timetable_slot_id').unsigned().nullable().after('teacher_id');
    table.enu('assessment_timing', ['START_OF_LECTURE', 'END_OF_LECTURE', 'ENTIRE_LECTURE', 'STANDALONE']).notNullable().defaultTo('STANDALONE').after('timetable_slot_id');
    table.integer('duration_minutes').unsigned().nullable().after('assessment_timing');
    table.boolean('is_date_changed').notNullable().defaultTo(false).after('instructions');
    table.date('previous_exam_date').nullable().after('is_date_changed');
    table.string('previous_start_time', 10).nullable().after('previous_exam_date');
    table.string('previous_end_time', 10).nullable().after('previous_start_time');

    table.foreign('timetable_slot_id').references('id').inTable('timetable_slots').onDelete('SET NULL');
    table.index(['exam_date', 'class_id'], 'ix_dse_date_class');
  });

  // 3. Extend monthly_tests
  await knex.schema.alterTable('monthly_tests', (table) => {
    table.enu('scheduling_mode', ['DEDICATED_EXAM', 'TIMETABLE_ASSESSMENT']).notNullable().defaultTo('DEDICATED_EXAM').after('exam_type');
    table.bigInteger('timetable_slot_id').unsigned().nullable().after('date_sheet_entry_id');
    table.enu('assessment_timing', ['START_OF_LECTURE', 'END_OF_LECTURE', 'ENTIRE_LECTURE', 'STANDALONE']).notNullable().defaultTo('STANDALONE').after('timetable_slot_id');

    table.foreign('timetable_slot_id').references('id').inTable('timetable_slots').onDelete('SET NULL');
    table.index(['scheduling_mode'], 'ix_mt_mode');
  });

  // 4. Extend teacher_duty_sessions for verified invigilation duty
  await knex.schema.alterTable('teacher_duty_sessions', (table) => {
    table.bigInteger('lesson_id').unsigned().nullable().alter();
    table.enu('duty_type', ['REGULAR_LESSON', 'EXAM_INVIGILATION']).notNullable().defaultTo('REGULAR_LESSON').after('reconciliation_status');
    table.bigInteger('date_sheet_entry_id').unsigned().nullable().after('lesson_id');

    table.foreign('date_sheet_entry_id').references('id').inTable('date_sheet_entries').onDelete('SET NULL');
    table.index(['duty_type'], 'ix_tds_duty_type');
  });

  // 5. Extend zoom_participant_log for invigilation presence
  await knex.schema.alterTable('zoom_participant_log', (table) => {
    table.bigInteger('date_sheet_entry_id').unsigned().nullable().after('lesson_id');

    table.foreign('date_sheet_entry_id').references('id').inTable('date_sheet_entries').onDelete('SET NULL');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('zoom_participant_log', (table) => {
    table.dropForeign(['date_sheet_entry_id']);
    table.dropColumn('date_sheet_entry_id');
  });

  await knex.schema.alterTable('teacher_duty_sessions', (table) => {
    table.dropForeign(['date_sheet_entry_id']);
    table.dropIndex(['duty_type'], 'ix_tds_duty_type');
    table.dropColumn('date_sheet_entry_id');
    table.dropColumn('duty_type');
  });

  await knex.schema.alterTable('monthly_tests', (table) => {
    table.dropForeign(['timetable_slot_id']);
    table.dropIndex(['scheduling_mode'], 'ix_mt_mode');
    table.dropColumn('assessment_timing');
    table.dropColumn('timetable_slot_id');
    table.dropColumn('scheduling_mode');
  });

  await knex.schema.alterTable('date_sheet_entries', (table) => {
    table.dropForeign(['timetable_slot_id']);
    table.dropIndex(['exam_date', 'class_id'], 'ix_dse_date_class');
    table.dropColumn('previous_end_time');
    table.dropColumn('previous_start_time');
    table.dropColumn('previous_exam_date');
    table.dropColumn('is_date_changed');
    table.dropColumn('duration_minutes');
    table.dropColumn('assessment_timing');
    table.dropColumn('timetable_slot_id');
  });

  await knex.schema.alterTable('examination_date_sheets', (table) => {
    table.dropIndex(['scheduling_mode'], 'ix_ds_mode');
    table.dropIndex(['start_date', 'end_date'], 'ix_ds_period');
    table.dropColumn('scheduling_mode');
    table.dropColumn('end_date');
    table.dropColumn('start_date');
  });
}
