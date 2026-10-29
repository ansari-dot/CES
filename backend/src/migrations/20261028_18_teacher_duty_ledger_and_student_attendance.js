/**
 * Migration 18: Teacher Duty Ledger, Period Occurrence Identity, and Automated Student Attendance
 *
 * Implements:
 * 1. Dedicated `teacher_duty_sessions` audit ledger with verified/payable duty hours,
 *    period occurrence mapping, and transaction-safe concurrency.
 * 2. `period_occurrence_id` in `timetable_lessons` for deterministic scheduled period identity.
 * 3. Verified presence metrics in `lesson_attendance` (source, first_joined_at, last_left_at, verified_minutes).
 * 4. Zoom identity matching fields for `students` (zoom_email, zoom_user_id).
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // 1. Extend timetable_lessons with period_occurrence_id
  const hasPeriodOccCol = await knex.schema.hasColumn('timetable_lessons', 'period_occurrence_id');
  if (!hasPeriodOccCol) {
    await knex.schema.alterTable('timetable_lessons', (table) => {
      table.string('period_occurrence_id', 100).nullable();
      table.index(['period_occurrence_id'], 'ix_tl_period_occ');
    });
  }

  // 2. Create teacher_duty_sessions table
  const hasDutyTable = await knex.schema.hasTable('teacher_duty_sessions');
  if (!hasDutyTable) {
    await knex.schema.createTable('teacher_duty_sessions', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('teacher_id').unsigned().notNullable();
      table.bigInteger('class_id').unsigned().notNullable();
      table.bigInteger('lesson_id').unsigned().notNullable();
      table.string('period_occurrence_id', 100).notNullable();
      table.string('zoom_meeting_id', 30).notNullable();
      table.string('meeting_instance_uuid', 64).nullable();
      table.specificType('session_start', 'DATETIME(3)').notNullable();
      table.specificType('session_end', 'DATETIME(3)').nullable();
      table.decimal('total_verified_minutes', 8, 2).notNullable().defaultTo(0.00);
      table.decimal('payable_minutes', 8, 2).notNullable().defaultTo(0.00);
      table
        .enu('session_status', [
          'IN_PROGRESS',
          'COMPLETED',
          'AWAITING_VERIFICATION',
          'REQUIRES_REVIEW',
          'FLAGGED',
          'MISSED',
          'CANCELLED'
        ])
        .notNullable()
        .defaultTo('IN_PROGRESS');
      table
        .enu('reconciliation_status', [
          'NOT_RECONCILED',
          'RECONCILED',
          'DISCREPANCY_FOUND',
          'REPORT_UNAVAILABLE'
        ])
        .notNullable()
        .defaultTo('NOT_RECONCILED');
      table.json('source_event_refs').nullable();
      table.text('audit_note').nullable();
      table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
      table
        .specificType('updated_at', 'DATETIME(3)')
        .notNullable()
        .defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

      table.unique(['teacher_id', 'lesson_id'], 'uq_duty_teacher_lesson');
      table.index(['lesson_id'], 'ix_tds_lesson');
      table.index(['teacher_id', 'session_start'], 'ix_tds_teacher_start');
      table.index(['class_id', 'session_start'], 'ix_tds_class_start');
      table.index(['session_status'], 'ix_tds_status');
      table.index(['period_occurrence_id'], 'ix_tds_period_occ');

      table.foreign('teacher_id').references('id').inTable('teachers').onDelete('CASCADE');
      table.foreign('class_id').references('id').inTable('classes').onDelete('CASCADE');
      table.foreign('lesson_id').references('id').inTable('timetable_lessons').onDelete('CASCADE');
    });
  }

  // 3. Extend lesson_attendance with source, verified duration, and timestamps
  const hasAttSource = await knex.schema.hasColumn('lesson_attendance', 'source');
  if (!hasAttSource) {
    await knex.schema.alterTable('lesson_attendance', (table) => {
      table
        .enu('source', ['PORTAL', 'WEBHOOK', 'MANUAL', 'RECONCILIATION'])
        .notNullable()
        .defaultTo('MANUAL');
      table.decimal('verified_minutes', 8, 2).notNullable().defaultTo(0.00);
      table.specificType('first_joined_at', 'DATETIME(3)').nullable();
      table.specificType('last_left_at', 'DATETIME(3)').nullable();

      table.index(['source'], 'ix_la_source');
    });
  }

  // 4. Extend students with Zoom identity attributes
  const hasStdZoomEmail = await knex.schema.hasColumn('students', 'zoom_email');
  if (!hasStdZoomEmail) {
    await knex.schema.alterTable('students', (table) => {
      table.string('zoom_email', 190).nullable();
      table.string('zoom_user_id', 64).nullable();

      table.index(['zoom_email'], 'ix_std_zoom_email');
      table.index(['zoom_user_id'], 'ix_std_zoom_uid');
    });
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  const hasStdZoomEmail = await knex.schema.hasColumn('students', 'zoom_email');
  if (hasStdZoomEmail) {
    await knex.schema.alterTable('students', (table) => {
      table.dropIndex(['zoom_email'], 'ix_std_zoom_email');
      table.dropIndex(['zoom_user_id'], 'ix_std_zoom_uid');
      table.dropColumn('zoom_email');
      table.dropColumn('zoom_user_id');
    });
  }

  const hasAttSource = await knex.schema.hasColumn('lesson_attendance', 'source');
  if (hasAttSource) {
    await knex.schema.alterTable('lesson_attendance', (table) => {
      table.dropIndex(['source'], 'ix_la_source');
      table.dropColumn('source');
      table.dropColumn('verified_minutes');
      table.dropColumn('first_joined_at');
      table.dropColumn('last_left_at');
    });
  }

  await knex.schema.dropTableIfExists('teacher_duty_sessions');

  const hasPeriodOccCol = await knex.schema.hasColumn('timetable_lessons', 'period_occurrence_id');
  if (hasPeriodOccCol) {
    await knex.schema.alterTable('timetable_lessons', (table) => {
      table.dropIndex(['period_occurrence_id'], 'ix_tl_period_occ');
      table.dropColumn('period_occurrence_id');
    });
  }
}
