/**
 * Preserved migration placeholder for local database compatibility.
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // Additive columns for student personal details if not already present
  if (!(await knex.schema.hasColumn('students', 'father_name'))) {
    await knex.schema.alterTable('students', (table) => {
      table.string('father_name', 150).nullable();
      table.string('father_email', 190).nullable();
      table.date('date_of_birth').nullable();
      table.text('permanent_address').nullable();
    });
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  // No-op for safety
}
