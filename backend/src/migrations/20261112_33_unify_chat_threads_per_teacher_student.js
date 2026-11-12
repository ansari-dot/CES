/**
 * Migration 33: Unify chat threads per Teacher <-> Student relationship
 * Eliminates subject-level chat fragmentation so that one teacher and one student
 * share a single unified conversation thread even if the teacher teaches multiple subjects.
 */
export async function up(knex) {
  // 1. Reassign messages from duplicate threads to the primary thread (lowest id)
  await knex.raw(`
    UPDATE chat_messages cm
    INNER JOIN chat_threads ct ON cm.thread_id = ct.id
    INNER JOIN (
      SELECT MIN(id) as primary_id, academic_session_id, class_id, teacher_id, student_id
      FROM chat_threads
      GROUP BY academic_session_id, class_id, teacher_id, student_id
    ) prim ON ct.academic_session_id = prim.academic_session_id
          AND ct.class_id = prim.class_id
          AND ct.teacher_id = prim.teacher_id
          AND ct.student_id = prim.student_id
    SET cm.thread_id = prim.primary_id
    WHERE ct.id != prim.primary_id
  `);

  // 2. Remove duplicate threads
  await knex.raw(`
    DELETE ct1 FROM chat_threads ct1
    INNER JOIN chat_threads ct2 
    WHERE ct1.id > ct2.id 
      AND ct1.academic_session_id = ct2.academic_session_id
      AND ct1.class_id = ct2.class_id
      AND ct1.teacher_id = ct2.teacher_id
      AND ct1.student_id = ct2.student_id
  `);

  // 3. Drop old unique index if exists
  try {
    await knex.schema.alterTable('chat_threads', (table) => {
      table.dropUnique(
        ['academic_session_id', 'class_id', 'subject_id', 'teacher_id', 'student_id'],
        'uq_chat_thread_session'
      );
    });
  } catch (_) {
    try {
      await knex.raw('ALTER TABLE chat_threads DROP INDEX uq_chat_thread_session');
    } catch (_) {}
  }

  // 4. Make subject_id nullable
  try {
    await knex.raw('ALTER TABLE chat_threads MODIFY subject_id BIGINT UNSIGNED NULL');
  } catch (_) {}

  // 5. Add new unique index per teacher-student pair
  const [rows] = await knex.raw(`
    SELECT COUNT(1) as cnt 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE table_schema = DATABASE() 
      AND table_name = 'chat_threads' 
      AND index_name = 'uq_chat_thread_teacher_student'
  `);
  const count = rows?.[0]?.cnt ?? rows?.[0]?.CNT ?? 0;
  if (!count) {
    try {
      await knex.schema.alterTable('chat_threads', (table) => {
        table.unique(
          ['academic_session_id', 'class_id', 'teacher_id', 'student_id'],
          'uq_chat_thread_teacher_student'
        );
      });
    } catch (_) {}
  }
}

export async function down(knex) {
  try {
    await knex.schema.alterTable('chat_threads', (table) => {
      table.dropUnique(
        ['academic_session_id', 'class_id', 'teacher_id', 'student_id'],
        'uq_chat_thread_teacher_student'
      );
    });
  } catch (_) {}
}
