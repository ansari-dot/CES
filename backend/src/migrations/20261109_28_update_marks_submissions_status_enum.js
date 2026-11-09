/**
 * Migration: Expand marks_submissions status ENUM to support full review lifecycle
 * (SUBMITTED -> APPROVED -> PUBLISHED / REOPENED)
 */
export async function up(knex) {
  await knex.raw("ALTER TABLE marks_submissions MODIFY COLUMN status ENUM('SUBMITTED', 'APPROVED', 'PUBLISHED', 'REOPENED') NOT NULL DEFAULT 'SUBMITTED'");
}

export async function down(knex) {
  await knex.raw("ALTER TABLE marks_submissions MODIFY COLUMN status ENUM('SUBMITTED', 'REOPENED') NOT NULL DEFAULT 'SUBMITTED'");
}

