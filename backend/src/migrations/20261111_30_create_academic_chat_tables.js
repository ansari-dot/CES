/**
 * Migration 30: Academic Chat Module (Teacher <-> Student Scoped Messaging & Audit Logs)
 *
 * Implements:
 * 1. chat_threads (Class + Subject + Teacher + Student + Session scoping)
 * 2. chat_messages (Sanitized text messaging with phone number policy violation tracking)
 * 3. chat_audit_logs (Principal and administrative oversight tracking)
 */

export async function up(knex) {
  await knex.schema.dropTableIfExists('chat_audit_logs');
  await knex.schema.dropTableIfExists('chat_messages');
  await knex.schema.dropTableIfExists('chat_threads');

  await knex.schema.createTable('chat_threads', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('academic_session_id').unsigned().notNullable()
      .references('id').inTable('academic_sessions').onDelete('CASCADE');
    table.bigInteger('class_id').unsigned().notNullable()
      .references('id').inTable('classes').onDelete('CASCADE');
    table.bigInteger('subject_id').unsigned().notNullable()
      .references('id').inTable('subjects').onDelete('CASCADE');
    table.bigInteger('teacher_id').unsigned().notNullable()
      .references('id').inTable('teachers').onDelete('CASCADE');
    table.bigInteger('student_id').unsigned().notNullable()
      .references('id').inTable('students').onDelete('CASCADE');

    table.datetime('last_message_at', { precision: 3 }).nullable();
    table.string('last_message_preview', 255).nullable();
    table.integer('teacher_unread_count').unsigned().defaultTo(0);
    table.integer('student_unread_count').unsigned().defaultTo(0);
    table.boolean('is_archived').defaultTo(false);

    table.datetime('created_at', { precision: 3 }).defaultTo(knex.fn.now(3));
    table.datetime('updated_at', { precision: 3 }).defaultTo(knex.fn.now(3));

    table.unique(
      ['academic_session_id', 'class_id', 'subject_id', 'teacher_id', 'student_id'],
      'uq_chat_thread_session'
    );
    table.index(['teacher_id', 'is_archived'], 'idx_chat_thread_teacher');
    table.index(['student_id', 'is_archived'], 'idx_chat_thread_student');
  });

  await knex.schema.createTable('chat_messages', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('thread_id').unsigned().notNullable()
      .references('id').inTable('chat_threads').onDelete('CASCADE');
    table.bigInteger('sender_user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.enum('sender_role', ['TEACHER', 'STUDENT']).notNullable();
    table.text('content').notNullable();
    table.boolean('was_masked').defaultTo(false);
    table.boolean('has_policy_violation').defaultTo(false);
    table.string('policy_violation_type', 50).nullable();

    table.datetime('delivered_at', { precision: 3 }).nullable();
    table.datetime('read_at', { precision: 3 }).nullable();
    table.datetime('created_at', { precision: 3 }).defaultTo(knex.fn.now(3));

    table.index(['thread_id', 'created_at'], 'idx_chat_messages_thread_time');
    table.index(['has_policy_violation'], 'idx_chat_messages_violation');
  });

  await knex.schema.createTable('chat_audit_logs', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('actor_user_id').unsigned().notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.string('actor_role', 50).notNullable();
    table.enum('action', ['THREAD_ACCESSED', 'FLAGGED_MESSAGE_REVIEWED', 'REPORT_VIEWED']).notNullable();
    table.bigInteger('thread_id').unsigned().nullable();
    table.bigInteger('message_id').unsigned().nullable();
    table.json('details').nullable();
    table.string('ip_address', 45).nullable();
    table.datetime('created_at', { precision: 3 }).defaultTo(knex.fn.now(3));

    table.index(['thread_id'], 'idx_chat_audit_thread');
    table.index(['actor_user_id'], 'idx_chat_audit_actor');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('chat_audit_logs');
  await knex.schema.dropTableIfExists('chat_messages');
  await knex.schema.dropTableIfExists('chat_threads');
}
