/**
 * Migration 32: Deduplicate teacher_assignments table and enforce uniqueness
 */
export async function up(knex) {
  // 1. Remove duplicates keeping the lowest id
  await knex.raw(`
    DELETE ta1 FROM teacher_assignments ta1
    INNER JOIN teacher_assignments ta2 
    WHERE ta1.id > ta2.id 
      AND ta1.teacher_id = ta2.teacher_id 
      AND ta1.class_id = ta2.class_id 
      AND ta1.subject_id = ta2.subject_id 
      AND (ta1.session_id = ta2.session_id OR (ta1.session_id IS NULL AND ta2.session_id IS NULL))
  `);

  // 2. Add unique constraint if not already present
  const [rows] = await knex.raw(`
    SELECT COUNT(1) as cnt 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE table_schema = DATABASE() 
      AND table_name = 'teacher_assignments' 
      AND index_name = 'uq_ta_teacher_class_sub_session'
  `);

  const count = rows?.[0]?.cnt ?? rows?.[0]?.CNT ?? 0;
  if (!count) {
    try {
      await knex.schema.alterTable('teacher_assignments', (table) => {
        table.unique(['teacher_id', 'class_id', 'subject_id', 'session_id'], 'uq_ta_teacher_class_sub_session');
      });
    } catch (_) {}
  }
}

export async function down(knex) {
  try {
    await knex.schema.alterTable('teacher_assignments', (table) => {
      table.dropUnique(['teacher_id', 'class_id', 'subject_id', 'session_id'], 'uq_ta_teacher_class_sub_session');
    });
  } catch (_) {}
}
