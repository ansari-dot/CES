/**
 * Migration 16: Class-Based Zoom Hosting, Teacher Verification, and Duty Audit
 *
 * Configures 8 separately licensed Zoom classroom hosts, dedicated virtual classroom
 * meeting identities, participant identity verification, multi-interval attendance,
 * and reconciliation tracking.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // 1. Extend zoom_meetings with licensed classroom host identity & webhook verification
  await knex.schema.alterTable('zoom_meetings', (table) => {
    table.string('host_email', 190).nullable();
    table.string('host_name', 150).nullable();
    table.string('account_id', 64).nullable();
    table.specificType('concurrency_slot', 'TINYINT UNSIGNED').nullable();
    table.specificType('last_webhook_event_at', 'DATETIME(3)').nullable();
    table.specificType('webhook_verified_at', 'DATETIME(3)').nullable();

    table.index(['host_email'], 'ix_zm_host_email');
    table.index(['host_zoom_user_id'], 'ix_zm_host_user_id');
  });

  // 2. Extend teachers table with verified Zoom identity fields
  await knex.schema.alterTable('teachers', (table) => {
    table.string('zoom_email', 190).nullable();
    table.string('zoom_user_id', 64).nullable();

    table.index(['zoom_email'], 'ix_tch_zoom_email');
    table.index(['zoom_user_id'], 'ix_tch_zoom_user_id');
  });

  // 3. Extend zoom_participant_log with participant Zoom ID, role, and verification details
  await knex.schema.alterTable('zoom_participant_log', (table) => {
    table.string('zoom_user_id', 64).nullable();
    table.enu('role', ['TEACHER', 'STUDENT', 'CLASSROOM_HOST', 'UNKNOWN']).notNullable().defaultTo('UNKNOWN');
    table.enu('verification_status', ['VERIFIED', 'UNVERIFIED', 'FLAGGED']).notNullable().defaultTo('UNVERIFIED');
    table.string('verification_reason', 255).nullable();
    table.integer('duration_seconds').nullable();

    table.index(['role', 'verification_status'], 'ix_zpl_role_verif');
    table.index(['zoom_user_id'], 'ix_zpl_zoom_uid');
  });

  // 4. Extend timetable_lessons with verified duty duration and reconciliation status
  await knex.schema.alterTable('timetable_lessons', (table) => {
    table.decimal('verified_duty_minutes', 8, 2).notNullable().defaultTo(0.00);
    table.enu('attendance_verification_status', ['VERIFIED', 'UNVERIFIED', 'FLAGGED', 'ABSENT', 'PENDING']).notNullable().defaultTo('PENDING');
    table.string('verification_notes', 255).nullable();
    table.enu('reconciliation_status', ['NOT_RECONCILED', 'RECONCILED', 'DISCREPANCY_FOUND', 'REPORT_UNAVAILABLE']).notNullable().defaultTo('NOT_RECONCILED');
    table.text('reconciliation_notes').nullable();
    table.specificType('reconciled_at', 'DATETIME(3)').nullable();

    table.index(['attendance_verification_status'], 'ix_tl_att_status');
    table.index(['reconciliation_status'], 'ix_tl_reconcile_status');
  });

  // 5. Extend zoom_events with account_id and signature_verified
  await knex.schema.alterTable('zoom_events', (table) => {
    table.string('account_id', 64).nullable();
    table.tinyint('signature_verified', 1).notNullable().defaultTo(1);
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.alterTable('zoom_events', (table) => {
    table.dropColumn('account_id');
    table.dropColumn('signature_verified');
  });

  await knex.schema.alterTable('timetable_lessons', (table) => {
    table.dropIndex(['attendance_verification_status'], 'ix_tl_att_status');
    table.dropIndex(['reconciliation_status'], 'ix_tl_reconcile_status');
    table.dropColumn('verified_duty_minutes');
    table.dropColumn('attendance_verification_status');
    table.dropColumn('verification_notes');
    table.dropColumn('reconciliation_status');
    table.dropColumn('reconciliation_notes');
    table.dropColumn('reconciled_at');
  });

  await knex.schema.alterTable('zoom_participant_log', (table) => {
    table.dropIndex(['role', 'verification_status'], 'ix_zpl_role_verif');
    table.dropIndex(['zoom_user_id'], 'ix_zpl_zoom_uid');
    table.dropColumn('zoom_user_id');
    table.dropColumn('role');
    table.dropColumn('verification_status');
    table.dropColumn('verification_reason');
    table.dropColumn('duration_seconds');
  });

  await knex.schema.alterTable('teachers', (table) => {
    table.dropIndex(['zoom_email'], 'ix_tch_zoom_email');
    table.dropIndex(['zoom_user_id'], 'ix_tch_zoom_user_id');
    table.dropColumn('zoom_email');
    table.dropColumn('zoom_user_id');
  });

  await knex.schema.alterTable('zoom_meetings', (table) => {
    table.dropIndex(['host_email'], 'ix_zm_host_email');
    table.dropIndex(['host_zoom_user_id'], 'ix_zm_host_user_id');
    table.dropColumn('host_email');
    table.dropColumn('host_name');
    table.dropColumn('account_id');
    table.dropColumn('concurrency_slot');
    table.dropColumn('last_webhook_event_at');
    table.dropColumn('webhook_verified_at');
  });
}
