/**
 * Migration 44: Montessori class level
 *
 * Students are admitted into a class (Classes 1–8). Montessori children need their own
 * admission level so that only they are offered for Montessori KG section allocation.
 *
 *  - relaxes chk_grade_level from 1..8 to 0..8 (grade_level 0 = Montessori)
 *  - adds the "Montessori" class row (grade_level 0) when missing
 *
 * Existing classes, students and enrolments are not modified. Idempotent.
 *
 * @param { import("knex").Knex } knex
 */
export const MONTESSORI_GRADE_LEVEL = 0;

async function hasCheck(knex) {
  const [rows] = await knex.raw(
    "SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'classes' AND CONSTRAINT_TYPE = 'CHECK' AND CONSTRAINT_NAME = 'chk_grade_level'"
  );
  return rows.length > 0;
}

export async function up(knex) {
  if (await hasCheck(knex)) await knex.raw('ALTER TABLE `classes` DROP CHECK `chk_grade_level`');
  await knex.raw('ALTER TABLE `classes` ADD CONSTRAINT `chk_grade_level` CHECK (`grade_level` >= 0 AND `grade_level` <= 8)');

  const existing = await knex('classes').where({ grade_level: MONTESSORI_GRADE_LEVEL }).first();
  if (!existing) await knex('classes').insert({ grade_level: MONTESSORI_GRADE_LEVEL, name: 'Montessori', is_active: 1 });
}

/**
 * Development rollback only. The Montessori class is removed only when nothing references it;
 * otherwise it is kept (with the relaxed constraint) so no student record is lost.
 */
export async function down(knex) {
  const cls = await knex('classes').where({ grade_level: MONTESSORI_GRADE_LEVEL }).first();
  if (cls) {
    const used = await knex('students').where({ current_class_id: cls.id }).first('id');
    if (used) return;
    try {
      await knex('classes').where({ id: cls.id }).del();
    } catch {
      return; // referenced elsewhere (enrolments, fee structures…): keep it
    }
  }
  if (await hasCheck(knex)) await knex.raw('ALTER TABLE `classes` DROP CHECK `chk_grade_level`');
  await knex.raw('ALTER TABLE `classes` ADD CONSTRAINT `chk_grade_level` CHECK (`grade_level` >= 1 AND `grade_level` <= 8)');
}
