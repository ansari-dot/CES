/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // 1. Examination Date Sheets header table
  await knex.schema.createTable('examination_date_sheets', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('academic_session_id').unsigned().notNullable();
    table.enu('exam_type', ['MONTHLY_TEST', 'MID_TERM', 'FINAL_TERM']).notNullable();
    table.string('title', 150).notNullable();
    table.text('description').nullable();
    table.enu('status', ['DRAFT', 'PUBLISHED', 'HIDDEN']).notNullable().defaultTo('DRAFT');
    table.tinyint('is_published', 1).notNullable().defaultTo(0);
    table.specificType('published_at', 'DATETIME(3)').nullable();
    table.bigInteger('created_by').unsigned().notNullable();
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

    table.index(['academic_session_id', 'exam_type'], 'ix_eds_session_type');
    table.index(['is_published', 'status'], 'ix_eds_published_status');
    table.foreign('academic_session_id').references('id').inTable('academic_sessions').onDelete('CASCADE');
    table.foreign('created_by').references('id').inTable('users');
  });

  // 2. Date Sheet Entries table (class, subject, date, timings, teacher)
  await knex.schema.createTable('date_sheet_entries', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('date_sheet_id').unsigned().notNullable();
    table.bigInteger('class_id').unsigned().notNullable();
    table.bigInteger('subject_id').unsigned().notNullable();
    table.bigInteger('teacher_id').unsigned().nullable();
    table.date('exam_date').notNullable();
    table.string('day_of_week', 20).notNullable(); // e.g. "Monday", "Tuesday"
    table.string('start_time', 15).notNullable();  // e.g. "08:00 AM"
    table.string('end_time', 15).notNullable();    // e.g. "09:30 AM"
    table.string('subject_type', 50).notNullable().defaultTo('Scholastic'); // e.g. "Scholastic", "Co-Scholastic"
    table.string('instructions', 255).nullable();
    table.integer('order_index').unsigned().notNullable().defaultTo(0);
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

    table.index(['date_sheet_id'], 'ix_dse_datesheet');
    table.index(['class_id', 'exam_date'], 'ix_dse_class_date');
    table.index(['teacher_id', 'class_id', 'subject_id'], 'ix_dse_teacher_class_sub');
    table.foreign('date_sheet_id').references('id').inTable('examination_date_sheets').onDelete('CASCADE');
    table.foreign('class_id').references('id').inTable('classes').onDelete('CASCADE');
    table.foreign('subject_id').references('id').inTable('subjects').onDelete('CASCADE');
    table.foreign('teacher_id').references('id').inTable('teachers').onDelete('SET NULL');
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('date_sheet_entries');
  await knex.schema.dropTableIfExists('examination_date_sheets');
}

