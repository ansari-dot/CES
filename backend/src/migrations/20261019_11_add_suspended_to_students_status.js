export async function up(knex) {
  await knex.raw("ALTER TABLE students MODIFY COLUMN status ENUM('ACTIVE', 'INACTIVE', 'GRADUATED', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE'");
}

export async function down(knex) {
  await knex.raw("ALTER TABLE students MODIFY COLUMN status ENUM('ACTIVE', 'INACTIVE', 'GRADUATED') NOT NULL DEFAULT 'ACTIVE'");
}
