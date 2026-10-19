/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // 1. Roles table
  await knex.schema.createTable('roles', (table) => {
    table.specificType('id', 'TINYINT UNSIGNED AUTO_INCREMENT').primary();
    table.string('code', 30).notNullable().unique();
    table.string('name', 60).notNullable();
  });

  // 2. Permissions table
  await knex.schema.createTable('permissions', (table) => {
    table.specificType('id', 'SMALLINT UNSIGNED AUTO_INCREMENT').primary();
    table.string('code', 80).notNullable().unique();
    table.string('description', 255).nullable();
  });

  // 3. Role-Permissions join table
  await knex.schema.createTable('role_permissions', (table) => {
    table.specificType('role_id', 'TINYINT UNSIGNED').notNullable();
    table.specificType('permission_id', 'SMALLINT UNSIGNED').notNullable();
    table.primary(['role_id', 'permission_id']);
    table.foreign('role_id').references('id').inTable('roles').onDelete('CASCADE');
    table.foreign('permission_id').references('id').inTable('permissions').onDelete('CASCADE');
  });

  // 4. Users table
  await knex.schema.createTable('users', (table) => {
    table.bigIncrements('id').primary();
    table.specificType('role_id', 'TINYINT UNSIGNED').notNullable();
    table.string('username', 60).notNullable().unique();
    table.string('email', 190).nullable().unique();
    table.string('phone', 32).nullable().unique();
    table.specificType('email_verified_at', 'DATETIME(3)').nullable();
    table.string('full_name', 150).notNullable();
    table.string('password_hash', 255).notNullable();
    table.tinyint('must_change_password', 1).notNullable().defaultTo(1);
    table.enu('status', ['ACTIVE', 'SUSPENDED', 'DEACTIVATED']).notNullable().defaultTo('ACTIVE');
    table.specificType('token_version', 'INT UNSIGNED').notNullable().defaultTo(0);
    table.specificType('failed_login_count', 'SMALLINT UNSIGNED').notNullable().defaultTo(0);
    table.specificType('locked_until', 'DATETIME(3)').nullable();
    table.specificType('last_login_at', 'DATETIME(3)').nullable();
    table.specificType('password_changed_at', 'DATETIME(3)').nullable();
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

    table.index(['role_id', 'status'], 'ix_users_role_status');
    table.foreign('role_id').references('id').inTable('roles');
  });

  // 5. Refresh Tokens table
  await knex.schema.createTable('refresh_tokens', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('user_id').unsigned().notNullable();
    table.string('family_id', 36).notNullable();
    table.bigInteger('parent_id').unsigned().nullable();
    table.string('token_hash', 64).notNullable().unique();
    table.string('user_agent', 255).nullable();
    table.string('ip_address', 45).nullable();
    table.specificType('issued_at', 'DATETIME(3)').notNullable();
    table.specificType('idle_expires_at', 'DATETIME(3)').notNullable();
    table.specificType('absolute_expires_at', 'DATETIME(3)').notNullable();
    table.specificType('used_at', 'DATETIME(3)').nullable();
    table.specificType('revoked_at', 'DATETIME(3)').nullable();
    table.string('revoke_reason', 40).nullable();

    table.index(['user_id'], 'ix_rt_user');
    table.index(['family_id'], 'ix_rt_family');
    table.foreign('user_id').references('id').inTable('users');
  });

  // 6. Account Status History table
  await knex.schema.createTable('account_status_history', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('user_id').unsigned().notNullable();
    table.string('old_status', 20).notNullable();
    table.string('new_status', 20).notNullable();
    table.string('reason_code', 30).notNullable();
    table.string('reason_text', 500).nullable();
    table.specificType('effective_from', 'DATETIME(3)').notNullable();
    table.specificType('effective_until', 'DATETIME(3)').nullable();
    table.bigInteger('changed_by').unsigned().notNullable();
    table.bigInteger('reactivated_by').unsigned().nullable();
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));

    table.index(['user_id'], 'ix_ash_user');
    table.foreign('user_id').references('id').inTable('users');
    table.foreign('changed_by').references('id').inTable('users');
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('account_status_history');
  await knex.schema.dropTableIfExists('refresh_tokens');
  await knex.schema.dropTableIfExists('users');
  await knex.schema.dropTableIfExists('role_permissions');
  await knex.schema.dropTableIfExists('permissions');
  await knex.schema.dropTableIfExists('roles');
}
