/**
 * NO-OP MIGRATION.
 *
 * This file was found empty (0 bytes), which made Knex reject the entire
 * migration run ("must have both an up and down function") and blocked all
 * later migrations. It has been stubbed as a deliberate no-op to unblock
 * the pipeline.
 *
 * ⚠️ Do NOT add real schema changes here: once this no-op is recorded in
 * knex_migrations it will never run again. If terminal-exam tables are
 * needed, create a NEW migration file (e.g. 20261110_29_...) instead.
 */
export async function up() {
  // intentionally empty
}

export async function down() {
  // intentionally empty
}
