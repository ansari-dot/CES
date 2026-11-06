/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  const exists = await knex.schema.hasTable('user_sessions');
  if (!exists) {
    await knex.schema.createTable('user_sessions', (table) => {
      table.bigIncrements('id').primary();
      table.string('session_id', 64).notNullable().unique();
      table.bigInteger('user_id').unsigned().notNullable();
      table.string('role_code', 30).notNullable();
      table.string('ip_address', 45).nullable();
      table.string('user_agent', 255).nullable();
      table.boolean('is_remember').notNullable().defaultTo(false);
      table.specificType('idle_expires_at', 'DATETIME(3)').notNullable();
      table.specificType('absolute_expires_at', 'DATETIME(3)').notNullable();
      table.specificType('revoked_at', 'DATETIME(3)').nullable();
      table.string('revoke_reason', 50).nullable();
      table.specificType('last_activity_at', 'DATETIME(3)').notNullable();
      table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));

      table.index(['user_id'], 'ix_user_sessions_user_id');
      table.index(['session_id'], 'ix_user_sessions_session_id');
      table.index(['idle_expires_at'], 'ix_user_sessions_idle_expires');
      table.index(['revoked_at'], 'ix_user_sessions_revoked_at');
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    });
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('user_sessions');
}
