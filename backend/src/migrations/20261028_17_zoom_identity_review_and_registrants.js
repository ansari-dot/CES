/**
 * Migration 17: Zoom teacher-identity evidence, attendance review workflow, per-person registrants.
 *
 * Additive and safe for an existing database: no historical rows are deleted.
 *  - zoom_meetings.host_zoom_user_id becomes nullable so we never have to fabricate a host id.
 *  - zoom_participant_log gains Zoom's participant/registrant identifiers, a meeting-instance
 *    UUID and review columns; joined_at becomes nullable so an out-of-order "left" event can be
 *    stored honestly (no join time is invented).
 *  - zoom_registrants stores per-person Zoom registrant ids (account-less teacher identity).
 *
 * @param { import("knex").Knex } knex
 */
export async function up(knex) {
  // 1. zoom_meetings
  await knex.raw('ALTER TABLE `zoom_meetings` MODIFY `host_zoom_user_id` VARCHAR(64) NULL');
  await knex.schema.alterTable('zoom_meetings', (table) => {
    table.tinyint('registration_required', 1).notNullable().defaultTo(0);
    table.string('provisioned_via', 20).notNullable().defaultTo('MANUAL');
    table.specificType('api_verified_at', 'DATETIME(3)').nullable();
    table.specificType('last_meeting_started_at', 'DATETIME(3)').nullable();
  });

  // 2. zoom_participant_log
  await knex.raw('ALTER TABLE `zoom_participant_log` MODIFY `joined_at` DATETIME(3) NULL');
  await knex.raw("ALTER TABLE `zoom_participant_log` MODIFY `source` ENUM('PORTAL','WEBHOOK','REPORT','REVIEW') NOT NULL");
  await knex.raw(
    "ALTER TABLE `zoom_participant_log` MODIFY `verification_status` " +
      "ENUM('VERIFIED','UNVERIFIED','FLAGGED','REQUIRES_REVIEW','REJECTED') NOT NULL DEFAULT 'UNVERIFIED'"
  );
  await knex.schema.alterTable('zoom_participant_log', (table) => {
    table.string('meeting_uuid', 64).nullable();
    table.string('participant_uuid', 64).nullable();
    table.string('registrant_id', 64).nullable();
    table.string('identity_method', 30).nullable();
    table.bigInteger('reviewed_by').unsigned().nullable();
    table.specificType('reviewed_at', 'DATETIME(3)').nullable();
    table.string('review_note', 500).nullable();
    table.index(['meeting_uuid', 'participant_uuid'], 'ix_zpl_instance_participant');
    table.index(['registrant_id'], 'ix_zpl_registrant');
  });

  // 3. zoom_events
  await knex.schema.alterTable('zoom_events', (table) => {
    table.string('meeting_uuid', 64).nullable();
    table.string('error_message', 500).nullable();
  });

  // 4. timetable_lessons
  await knex.raw(
    "ALTER TABLE `timetable_lessons` MODIFY `attendance_verification_status` " +
      "ENUM('VERIFIED','UNVERIFIED','FLAGGED','ABSENT','PENDING','REQUIRES_REVIEW') NOT NULL DEFAULT 'PENDING'"
  );
  await knex.schema.alterTable('timetable_lessons', (table) => {
    table.string('meeting_instance_uuid', 64).nullable();
  });

  // 5. Per-person Zoom registrants (teacher identity without a Zoom account)
  await knex.schema.createTable('zoom_registrants', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('zoom_meeting_row_id').unsigned().notNullable();
    table.bigInteger('user_id').unsigned().notNullable();
    table.enu('role', ['TEACHER', 'STUDENT']).notNullable();
    table.string('zoom_registrant_id', 64).notNullable();
    table.specificType('join_url_enc', 'VARBINARY(2048)').notNullable();
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));

    table.unique(['zoom_meeting_row_id', 'user_id'], 'uq_zreg_meeting_user');
    table.unique(['zoom_meeting_row_id', 'zoom_registrant_id'], 'uq_zreg_meeting_registrant');
    table.index(['zoom_registrant_id'], 'ix_zreg_registrant');
    table.foreign('zoom_meeting_row_id').references('id').inTable('zoom_meetings').onDelete('CASCADE');
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
  });
}

/**
 * Rollback. Rows that use the newly added enum values are first mapped back to legacy values.
 * Review-state information (REQUIRES_REVIEW / REJECTED) is lost on rollback.
 *
 * @param { import("knex").Knex } knex
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('zoom_registrants');

  await knex.schema.alterTable('timetable_lessons', (table) => {
    table.dropColumn('meeting_instance_uuid');
  });
  await knex('timetable_lessons').where({ attendance_verification_status: 'REQUIRES_REVIEW' }).update({ attendance_verification_status: 'FLAGGED' });
  await knex.raw(
    "ALTER TABLE `timetable_lessons` MODIFY `attendance_verification_status` " +
      "ENUM('VERIFIED','UNVERIFIED','FLAGGED','ABSENT','PENDING') NOT NULL DEFAULT 'PENDING'"
  );

  await knex.schema.alterTable('zoom_events', (table) => {
    table.dropColumn('meeting_uuid');
    table.dropColumn('error_message');
  });

  await knex.schema.alterTable('zoom_participant_log', (table) => {
    table.dropIndex(['meeting_uuid', 'participant_uuid'], 'ix_zpl_instance_participant');
    table.dropIndex(['registrant_id'], 'ix_zpl_registrant');
    table.dropColumn('meeting_uuid');
    table.dropColumn('participant_uuid');
    table.dropColumn('registrant_id');
    table.dropColumn('identity_method');
    table.dropColumn('reviewed_by');
    table.dropColumn('reviewed_at');
    table.dropColumn('review_note');
  });
  await knex('zoom_participant_log').whereIn('verification_status', ['REQUIRES_REVIEW', 'REJECTED']).update({ verification_status: 'FLAGGED' });
  await knex.raw(
    "ALTER TABLE `zoom_participant_log` MODIFY `verification_status` ENUM('VERIFIED','UNVERIFIED','FLAGGED') NOT NULL DEFAULT 'UNVERIFIED'"
  );
  await knex('zoom_participant_log').whereIn('source', ['REPORT', 'REVIEW']).update({ source: 'WEBHOOK' });
  await knex.raw("ALTER TABLE `zoom_participant_log` MODIFY `source` ENUM('PORTAL','WEBHOOK') NOT NULL");
  // joined_at stays nullable on rollback only if orphan rows exist; restore NOT NULL when safe.
  await knex('zoom_participant_log').whereNull('joined_at').delete();
  await knex.raw('ALTER TABLE `zoom_participant_log` MODIFY `joined_at` DATETIME(3) NOT NULL');

  await knex.schema.alterTable('zoom_meetings', (table) => {
    table.dropColumn('registration_required');
    table.dropColumn('provisioned_via');
    table.dropColumn('api_verified_at');
    table.dropColumn('last_meeting_started_at');
  });
  await knex('zoom_meetings').whereNull('host_zoom_user_id').update({ host_zoom_user_id: 'UNKNOWN' });
  await knex.raw('ALTER TABLE `zoom_meetings` MODIFY `host_zoom_user_id` VARCHAR(64) NOT NULL');
}
