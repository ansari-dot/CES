/**
 * Migration: Generalize Monthly Tests into Unified Tests & Examinations Engine
 * Adds:
 *  - monthly_tests: exam_type, date_sheet_entry_id, term_name
 *  - test_questions: section_name, section_instructions
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // 1. Update monthly_tests table
  await knex.schema.alterTable('monthly_tests', (table) => {
    table
      .enu('exam_type', ['MONTHLY_TEST', 'MID_TERM', 'FINAL_TERM', 'CLASS_QUIZ'])
      .notNullable()
      .defaultTo('MONTHLY_TEST')
      .after('subject_id');

    table
      .bigInteger('date_sheet_entry_id')
      .unsigned()
      .nullable()
      .after('exam_type');

    table
      .string('term_name', 100)
      .nullable()
      .after('month_name');

    // Index for exam_type queries
    table.index(['exam_type', 'status'], 'ix_mt_exam_type_status');
    table.index(['date_sheet_entry_id'], 'ix_mt_date_sheet_entry');

    // Foreign key to date_sheet_entries if exists
    table
      .foreign('date_sheet_entry_id')
      .references('id')
      .inTable('date_sheet_entries')
      .onDelete('SET NULL');
  });

  // 2. Update test_questions table
  await knex.schema.alterTable('test_questions', (table) => {
    table
      .string('section_name', 100)
      .notNullable()
      .defaultTo('Section A')
      .after('question_number');

    table
      .text('section_instructions')
      .nullable()
      .after('section_name');
  });
}

export async function down(knex) {
  await knex.schema.alterTable('test_questions', (table) => {
    table.dropColumn('section_instructions');
    table.dropColumn('section_name');
  });

  await knex.schema.alterTable('monthly_tests', (table) => {
    table.dropForeign(['date_sheet_entry_id']);
    table.dropIndex(['date_sheet_entry_id'], 'ix_mt_date_sheet_entry');
    table.dropIndex(['exam_type', 'status'], 'ix_mt_exam_type_status');
    table.dropColumn('term_name');
    table.dropColumn('date_sheet_entry_id');
    table.dropColumn('exam_type');
  });
}

