/**
 * Migration 29: store exam paper times as display strings.
 *
 * The exam module saves start/end times as 12-hour display strings such as
 * '09:00 AM' (see createPaperSchema: free string, max 15 chars), but
 * migration 28 created start_time/end_time as MySQL TIME columns, which
 * reject 'HH:MM AM/PM' values and broke paper initialization from the
 * teacher portal. Convert both columns to VARCHAR(15).
 */
export async function up(knex) {
  const hasTable = await knex.schema.hasTable('terminal_exam_papers');
  if (!hasTable) return;
  await knex.schema.alterTable('terminal_exam_papers', (table) => {
    table.string('start_time', 15).nullable().alter();
    table.string('end_time', 15).nullable().alter();
  });
}

export async function down(knex) {
  const hasTable = await knex.schema.hasTable('terminal_exam_papers');
  if (!hasTable) return;
  await knex.schema.alterTable('terminal_exam_papers', (table) => {
    table.time('start_time').nullable().alter();
    table.time('end_time').nullable().alter();
  });
}
