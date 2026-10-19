/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // 1. School Notices table
  await knex.schema.createTable('school_notices', (table) => {
    table.bigIncrements('id').primary();
    table.string('title', 200).notNullable();
    table.text('content').notNullable();
    table.string('audience', 50).notNullable().defaultTo('School-Wide');
    table.json('target_roles').notNullable(); // e.g. ["Teacher", "Student", "Parent"]
    table.enu('priority', ['NORMAL', 'HIGH', 'URGENT']).notNullable().defaultTo('NORMAL');
    table.enu('status', ['DRAFT', 'PUBLISHED', 'ARCHIVED']).notNullable().defaultTo('PUBLISHED');
    table.date('publish_date').notNullable();
    table.date('expiry_date').nullable();
    table.bigInteger('created_by').unsigned().notNullable();
    table.integer('acknowledged_count').notNullable().defaultTo(0);
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

    table.index(['status', 'publish_date'], 'ix_sn_status_date');
    table.index(['audience'], 'ix_sn_audience');
    table.foreign('created_by').references('id').inTable('users');
  });

  // 2. Operational Notifications table
  await knex.schema.createTable('operational_notifications', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('user_id').unsigned().nullable();
    table.string('title', 200).notNullable();
    table.text('message').notNullable();
    table.string('type', 80).notNullable();
    table.string('target_role', 30).notNullable().defaultTo('ALL');
    table.string('related_record_id', 64).nullable();
    table.string('related_record_type', 64).nullable();
    table.enu('priority', ['LOW', 'MEDIUM', 'HIGH']).notNullable().defaultTo('MEDIUM');
    table.tinyint('is_read', 1).notNullable().defaultTo(0);
    table.specificType('read_at', 'DATETIME(3)').nullable();
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));

    table.index(['user_id', 'is_read'], 'ix_on_user_read');
    table.index(['target_role'], 'ix_on_role');
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
  });

  // 3. System Audit Logs table
  await knex.schema.createTable('audit_logs', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('actor_id').unsigned().nullable();
    table.string('actor_name', 150).notNullable();
    table.string('actor_role', 50).notNullable();
    table.string('action', 100).notNullable();
    table.string('record_type', 100).notNullable();
    table.string('record_identifier', 200).notNullable();
    table.text('reason').nullable();
    table.text('previous_value').nullable();
    table.text('new_value').nullable();
    table.string('ip_address', 100).nullable();
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));

    table.index(['record_type'], 'ix_al_type');
    table.index(['created_at'], 'ix_al_time');
    table.index(['actor_id'], 'ix_al_actor');
    table.foreign('actor_id').references('id').inTable('users').onDelete('SET NULL');
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('operational_notifications');
  await knex.schema.dropTableIfExists('school_notices');
}
