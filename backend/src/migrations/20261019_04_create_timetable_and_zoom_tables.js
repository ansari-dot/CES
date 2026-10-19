/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // 1. Timetable Slots table
  await knex.schema.createTable('timetable_slots', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('session_id').unsigned().notNullable();
    table.bigInteger('class_id').unsigned().notNullable();
    table.bigInteger('subject_id').unsigned().notNullable();
    table.bigInteger('teacher_id').unsigned().notNullable();
    table.specificType('weekday', 'TINYINT UNSIGNED').notNullable(); // 1=Mon .. 7=Sun
    table.time('start_time').notNullable();
    table.time('end_time').notNullable();
    table.date('effective_from').notNullable();
    table.date('effective_to').nullable();
    table.enu('status', ['DRAFT', 'PUBLISHED', 'ARCHIVED']).notNullable().defaultTo('DRAFT');
    table.bigInteger('created_by').unsigned().notNullable();
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));

    table.index(['class_id', 'weekday', 'start_time'], 'ix_slot_class');
    table.index(['teacher_id', 'weekday', 'start_time'], 'ix_slot_teacher');
    table.foreign('session_id').references('id').inTable('academic_sessions').onDelete('CASCADE');
    table.foreign('class_id').references('id').inTable('classes').onDelete('CASCADE');
    table.foreign('subject_id').references('id').inTable('subjects').onDelete('CASCADE');
    table.foreign('teacher_id').references('id').inTable('teachers').onDelete('CASCADE');
    table.foreign('created_by').references('id').inTable('users');
  });

  // 2. Zoom Meetings table (one active per class, AES-256-GCM encrypted URLs)
  await knex.schema.createTable('zoom_meetings', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('class_id').unsigned().notNullable();
    table.string('zoom_meeting_id', 20).notNullable();
    table.string('zoom_meeting_uuid', 64).nullable();
    table.string('topic', 200).notNullable();
    table.specificType('join_url_enc', 'VARBINARY(2048)').notNullable();
    table.specificType('passcode_enc', 'VARBINARY(256)').nullable();
    table.specificType('start_url_enc', 'VARBINARY(4096)').nullable();
    table.specificType('key_version', 'TINYINT UNSIGNED').notNullable().defaultTo(1);
    table.string('host_zoom_user_id', 64).notNullable();
    table.enu('host_mode', ['ALT_HOST', 'CENTRAL_HOST']).notNullable().defaultTo('ALT_HOST');
    table.enu('status', ['ACTIVE', 'UNUSABLE', 'EXPIRED', 'REVOKED', 'REPLACED']).notNullable().defaultTo('ACTIVE');
    table.string('last_health_status', 30).nullable();
    table.specificType('last_health_check_at', 'DATETIME(3)').nullable();
    table.specificType('last_used_at', 'DATETIME(3)').nullable();
    table.specificType('expires_hint_at', 'DATETIME(3)').nullable();
    table.bigInteger('replaced_by_id').unsigned().nullable();
    table.string('retire_reason', 255).nullable();
    table.bigInteger('created_by').unsigned().notNullable();
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('retired_at', 'DATETIME(3)').nullable();

    table.specificType('active_class_id', 'BIGINT UNSIGNED GENERATED ALWAYS AS (IF(status=\'ACTIVE\', class_id, NULL)) STORED');
    table.unique(['active_class_id'], 'uq_one_active_per_class');
    table.unique(['zoom_meeting_id'], 'uq_zoom_meeting_id');
    table.index(['class_id'], 'ix_zm_class');
    table.foreign('class_id').references('id').inTable('classes');
    table.foreign('created_by').references('id').inTable('users');
  });

  // 3. Timetable Lessons table
  await knex.schema.createTable('timetable_lessons', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('slot_id').unsigned().nullable();
    table.bigInteger('class_id').unsigned().notNullable();
    table.bigInteger('subject_id').unsigned().notNullable();
    table.bigInteger('teacher_id').unsigned().notNullable();
    table.bigInteger('substitute_teacher_id').unsigned().nullable();
    table.bigInteger('zoom_meeting_id').unsigned().nullable();
    table.date('lesson_date').notNullable();
    table.specificType('start_at', 'DATETIME(3)').notNullable();
    table.specificType('end_at', 'DATETIME(3)').notNullable();
    table.enu('status', ['SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED', 'MISSED', 'RESCHEDULED']).notNullable().defaultTo('SCHEDULED');
    table.bigInteger('rescheduled_to_id').unsigned().nullable();
    table.string('cancel_reason', 255).nullable();
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

    table.unique(['slot_id', 'lesson_date'], 'uq_slot_date');
    table.index(['class_id', 'start_at', 'end_at'], 'ix_les_class_time');
    table.index(['teacher_id', 'start_at', 'end_at'], 'ix_les_teacher_time');
    table.index(['status', 'start_at'], 'ix_les_status_time');

    table.foreign('slot_id').references('id').inTable('timetable_slots').onDelete('SET NULL');
    table.foreign('class_id').references('id').inTable('classes').onDelete('CASCADE');
    table.foreign('subject_id').references('id').inTable('subjects').onDelete('CASCADE');
    table.foreign('teacher_id').references('id').inTable('teachers').onDelete('CASCADE');
    table.foreign('substitute_teacher_id').references('id').inTable('teachers').onDelete('SET NULL');
    table.foreign('zoom_meeting_id').references('id').inTable('zoom_meetings').onDelete('SET NULL');
  });

  // 4. Timetable Change Log
  await knex.schema.createTable('timetable_change_log', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('lesson_id').unsigned().nullable();
    table.bigInteger('slot_id').unsigned().nullable();
    table.enu('change_type', ['CREATED', 'EDITED', 'CANCELLED', 'RESCHEDULED', 'SUBSTITUTED', 'PUBLISHED']).notNullable();
    table.json('old_values').nullable();
    table.json('new_values').nullable();
    table.string('reason', 500).nullable();
    table.bigInteger('changed_by').unsigned().notNullable();
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));

    table.index(['lesson_id'], 'ix_tcl_lesson');
    table.index(['slot_id'], 'ix_tcl_slot');
    table.foreign('changed_by').references('id').inTable('users');
  });

  // 5. Zoom Alternative Hosts table
  await knex.schema.createTable('zoom_alt_hosts', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('meeting_id').unsigned().notNullable();
    table.bigInteger('teacher_id').unsigned().notNullable();
    table.enu('sync_status', ['PENDING', 'SYNCED', 'FAILED']).notNullable().defaultTo('PENDING');
    table.specificType('synced_at', 'DATETIME(3)').nullable();
    table.string('error_message', 255).nullable();

    table.unique(['meeting_id', 'teacher_id'], 'uq_alt_host');
    table.foreign('meeting_id').references('id').inTable('zoom_meetings').onDelete('CASCADE');
    table.foreign('teacher_id').references('id').inTable('teachers').onDelete('CASCADE');
  });

  // 6. Zoom Events table (webhooks with idempotent hash)
  await knex.schema.createTable('zoom_events', (table) => {
    table.bigIncrements('id').primary();
    table.string('event_hash', 64).notNullable().unique();
    table.string('event_type', 60).notNullable();
    table.string('zoom_meeting_id', 30).notNullable();
    table.bigInteger('lesson_id').unsigned().nullable();
    table.json('payload').notNullable();
    table.specificType('received_at', 'DATETIME(3)').notNullable();
    table.specificType('processed_at', 'DATETIME(3)').nullable();
    table.enu('process_status', ['PENDING', 'PROCESSED', 'FAILED', 'IGNORED']).notNullable().defaultTo('PENDING');

    table.foreign('lesson_id').references('id').inTable('timetable_lessons').onDelete('SET NULL');
  });

  // 7. Zoom Participant Log
  await knex.schema.createTable('zoom_participant_log', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('lesson_id').unsigned().nullable();
    table.string('zoom_meeting_id', 30).notNullable();
    table.enu('source', ['PORTAL', 'WEBHOOK']).notNullable();
    table.bigInteger('user_id').unsigned().nullable();
    table.string('participant_name', 150).nullable();
    table.string('participant_email', 190).nullable();
    table.specificType('joined_at', 'DATETIME(3)').notNullable();
    table.specificType('left_at', 'DATETIME(3)').nullable();

    table.index(['lesson_id'], 'ix_zpl_lesson');
    table.index(['user_id'], 'ix_zpl_user');
    table.foreign('lesson_id').references('id').inTable('timetable_lessons').onDelete('SET NULL');
    table.foreign('user_id').references('id').inTable('users').onDelete('SET NULL');
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('zoom_participant_log');
  await knex.schema.dropTableIfExists('zoom_events');
  await knex.schema.dropTableIfExists('zoom_alt_hosts');
  await knex.schema.dropTableIfExists('timetable_change_log');
  await knex.schema.dropTableIfExists('timetable_lessons');
  await knex.schema.dropTableIfExists('zoom_meetings');
  await knex.schema.dropTableIfExists('timetable_slots');
}
