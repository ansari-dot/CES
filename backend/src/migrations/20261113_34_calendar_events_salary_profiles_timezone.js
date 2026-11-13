/**
 * Migration 34: Five-Feature Extension
 *
 * 1. Extend academic_holidays with full calendar event fields
 *    (event_type, start_time, end_time, target_audience, class_ids,
 *     is_full_day_holiday, classes_suspended, send_notification, is_published).
 *
 * 2. teacher_salary_profiles already exists (migration 02), so the guarded create below
 *    is a no-op on real databases; its extra duty columns are added by migration 35.
 *
 * 3. Create teacher_checkin_checkout for daily duty tracking.
 *
 * 4. Create user_timezone_preferences for per-user timezone storage.
 *
 * 5. Extend student_concessions with effective_start_date, effective_end_date,
 *    fee_component, admin_notes.
 *
 * All changes are additive and safe for existing databases.
 */

export async function up(knex) {
  // ─── 1. Extend academic_holidays with full calendar event fields ───────────
  const hasEventType = await knex.schema.hasColumn('academic_holidays', 'event_type');
  if (!hasEventType) {
    await knex.schema.alterTable('academic_holidays', (table) => {
      table.string('event_type', 60).nullable();
      table.time('start_time').nullable();
      table.time('end_time').nullable();
      table.string('target_audience', 30).notNullable().defaultTo('ALL');
      table.json('class_ids').nullable();
      table.boolean('is_full_day_holiday').notNullable().defaultTo(true);
      table.boolean('classes_suspended').notNullable().defaultTo(true);
      table.boolean('send_notification').notNullable().defaultTo(true);
      table.boolean('is_published').notNullable().defaultTo(true);
    });
  }

  // ─── 2. Create teacher_salary_profiles ────────────────────────────────────
  const hasSalaryProfiles = await knex.schema.hasTable('teacher_salary_profiles');
  if (!hasSalaryProfiles) {
    await knex.schema.createTable('teacher_salary_profiles', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('teacher_id').unsigned().notNullable()
        .references('id').inTable('teachers').onDelete('CASCADE');
      table.enu('model', ['FIXED', 'PER_LESSON', 'PER_HOUR', 'HYBRID']).notNullable().defaultTo('FIXED');
      table.decimal('base_amount', 12, 2).notNullable().defaultTo(0.00);
      table.decimal('per_lesson_rate', 12, 2).notNullable().defaultTo(0.00);
      table.decimal('per_hour_rate', 12, 2).notNullable().defaultTo(0.00);
      table.integer('expected_duty_days').unsigned().nullable();
      table.decimal('expected_duty_hours', 8, 2).nullable();
      table.date('effective_from').notNullable();
      table.date('effective_to').nullable();
      table.json('rules').nullable();
      table.bigInteger('configured_by').unsigned().nullable()
        .references('id').inTable('users').onDelete('SET NULL');
      table.specificType('created_at', 'DATETIME(3)').notNullable()
        .defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
      table.specificType('updated_at', 'DATETIME(3)').notNullable()
        .defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

      table.index(['teacher_id', 'effective_from'], 'ix_tsp_teacher_effective');
      table.index(['model'], 'ix_tsp_model');
    });
  }

  // ─── 3. Create teacher_checkin_checkout ───────────────────────────────────
  const hasCheckin = await knex.schema.hasTable('teacher_checkin_checkout');
  if (!hasCheckin) {
    await knex.schema.createTable('teacher_checkin_checkout', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('teacher_id').unsigned().notNullable()
        .references('id').inTable('teachers').onDelete('CASCADE');
      table.date('duty_date').notNullable();
      table.specificType('check_in_time', 'DATETIME(3)').nullable();
      table.specificType('check_out_time', 'DATETIME(3)').nullable();
      table.decimal('total_duty_minutes', 8, 2).notNullable().defaultTo(0.00);
      table.boolean('is_late').notNullable().defaultTo(false);
      table.boolean('is_early_departure').notNullable().defaultTo(false);
      table.enu('attendance_status', [
        'PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'ON_LEAVE', 'HOLIDAY'
      ]).notNullable().defaultTo('PRESENT');
      table.string('leave_type', 50).nullable();
      table.text('notes').nullable();
      table.bigInteger('recorded_by').unsigned().nullable()
        .references('id').inTable('users').onDelete('SET NULL');
      table.specificType('created_at', 'DATETIME(3)').notNullable()
        .defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
      table.specificType('updated_at', 'DATETIME(3)').notNullable()
        .defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

      table.unique(['teacher_id', 'duty_date'], 'uq_teacher_duty_date');
      table.index(['duty_date'], 'ix_tcc_date');
      table.index(['attendance_status'], 'ix_tcc_status');
    });
  }

  // ─── 4. Create user_timezone_preferences ──────────────────────────────────
  const hasTzPrefs = await knex.schema.hasTable('user_timezone_preferences');
  if (!hasTzPrefs) {
    await knex.schema.createTable('user_timezone_preferences', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('user_id').unsigned().notNullable().unique()
        .references('id').inTable('users').onDelete('CASCADE');
      table.string('timezone', 64).notNullable();
      table.enu('source', ['MANUAL', 'IP_DETECTED', 'BROWSER']).notNullable().defaultTo('BROWSER');
      table.specificType('updated_at', 'DATETIME(3)').notNullable()
        .defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

      table.index(['user_id'], 'ix_utp_user');
    });
  }

  // ─── 5. Extend student_concessions with date range + fee component ─────────
  const hasConcessionStartDate = await knex.schema.hasColumn('student_concessions', 'effective_start_date');
  if (!hasConcessionStartDate) {
    await knex.schema.alterTable('student_concessions', (table) => {
      table.date('effective_start_date').nullable();
      table.date('effective_end_date').nullable();
      table.string('fee_component', 50).nullable();
      table.text('admin_notes').nullable();
    });
  }
}

export async function down(knex) {
  const hasConcessionStartDate = await knex.schema.hasColumn('student_concessions', 'effective_start_date');
  if (hasConcessionStartDate) {
    await knex.schema.alterTable('student_concessions', (table) => {
      table.dropColumn('effective_start_date');
      table.dropColumn('effective_end_date');
      table.dropColumn('fee_component');
      table.dropColumn('admin_notes');
    });
  }

  await knex.schema.dropTableIfExists('user_timezone_preferences');
  await knex.schema.dropTableIfExists('teacher_checkin_checkout');
  // NOTE: teacher_salary_profiles is owned by migration 02 (it holds real salary data)
  // and must never be dropped by this migration's rollback.

  const hasEventType = await knex.schema.hasColumn('academic_holidays', 'event_type');
  if (hasEventType) {
    await knex.schema.alterTable('academic_holidays', (table) => {
      table.dropColumn('event_type');
      table.dropColumn('start_time');
      table.dropColumn('end_time');
      table.dropColumn('target_audience');
      table.dropColumn('class_ids');
      table.dropColumn('is_full_day_holiday');
      table.dropColumn('classes_suspended');
      table.dropColumn('send_notification');
      table.dropColumn('is_published');
    });
  }
}
