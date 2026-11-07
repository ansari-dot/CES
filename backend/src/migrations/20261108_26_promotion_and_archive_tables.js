/**
 * Migration 26: Session Purge Queue, Audit History, and Resource Session Tagging
 * 
 * Target Environment: MySQL 8.0 / Knex (Declared ^3.1.0, Installed 3.3.0) / Node.js ESM
 * Module Syntax: ECMAScript Modules (ESM)
 */

export async function up(knex) {
  // 1. Add session_id to learning_resources to protect evergreen curriculum assets
  if (!(await knex.schema.hasColumn('learning_resources', 'session_id'))) {
    await knex.schema.alterTable('learning_resources', (table) => {
      table.bigInteger('session_id').unsigned().nullable().after('subject_id');
      table.foreign('session_id', 'fk_lr_session').references('id').inTable('academic_sessions').onDelete('SET NULL');
      table.index(['session_id', 'class_id'], 'ix_lr_session_class');
    });
  }

  // 2. Post-commit file deletion queue (idempotent & retryable)
  if (!(await knex.schema.hasTable('purge_file_cleanup_queue'))) {
    await knex.schema.createTable('purge_file_cleanup_queue', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('session_id').unsigned().notNullable();
      table.enu('file_type', ['SUBMISSION', 'HANDOUT', 'RESOURCE', 'QUESTION_IMAGE']).notNullable();
      table.string('file_path', 500).notNullable();
      table.enu('status', ['PENDING', 'DELETED', 'FAILED']).notNullable().defaultTo('PENDING');
      table.integer('retry_count').unsigned().notNullable().defaultTo(0);
      table.string('error_message', 500).nullable();
      table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
      table.specificType('deleted_at', 'DATETIME(3)').nullable();

      table.unique(['file_path'], 'uq_pfcq_file_path');
      table.index(['session_id', 'status'], 'ix_pfcq_session_status');
      table.foreign('session_id', 'fk_pfcq_session').references('id').inTable('academic_sessions').onDelete('CASCADE');
    });
  }

  // 3. Immutable administrative purge receipt
  if (!(await knex.schema.hasTable('session_purge_history'))) {
    await knex.schema.createTable('session_purge_history', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('session_id').unsigned().notNullable();
      table.string('session_name', 50).notNullable();
      table.bigInteger('target_session_id').unsigned().notNullable();
      table.string('target_session_name', 50).notNullable();
      table.bigInteger('executed_by').unsigned().notNullable();
      table.specificType('executed_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
      table.json('records_purged_summary').notNullable();
      table.integer('terminal_cards_preserved').unsigned().notNullable();
      table.integer('files_queued_for_cleanup').unsigned().notNullable();
      table.string('challenge_phrase_used', 100).notNullable();
      table.enu('status', ['COMPLETED', 'FAILED']).notNullable().defaultTo('COMPLETED');

      table.foreign('session_id', 'fk_sph_session').references('id').inTable('academic_sessions').onDelete('RESTRICT');
      table.foreign('target_session_id', 'fk_sph_target_session').references('id').inTable('academic_sessions').onDelete('RESTRICT');
      table.foreign('executed_by', 'fk_sph_executed_by').references('id').inTable('users').onDelete('RESTRICT');
      table.index(['session_id', 'executed_at'], 'ix_sph_session_time');
    });
  }
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('session_purge_history');
  await knex.schema.dropTableIfExists('purge_file_cleanup_queue');
  if (await knex.schema.hasColumn('learning_resources', 'session_id')) {
    await knex.schema.alterTable('learning_resources', (table) => {
      table.dropForeign('session_id', 'fk_lr_session');
      table.dropIndex(['session_id', 'class_id'], 'ix_lr_session_class');
      table.dropColumn('session_id');
    });
  }
}

