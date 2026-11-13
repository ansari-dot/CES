/**
 * Migration 35: Integration columns for the five-feature extension.
 *
 * Purely additive and idempotent (every change is guarded by hasColumn/hasTable),
 * so it is safe whether or not migration 34 has already been applied.
 *
 * 1. timetable_lessons.holiday_event_id
 *      Date-specific timetable exception marker. A lesson cancelled by a calendar
 *      event is tagged with that event's id so it can be restored precisely when the
 *      event is edited or cancelled. The recurring timetable_slots are never touched.
 *
 * 2. teacher_salary_profiles (table already exists since migration 02 — migration 34's
 *    hasTable guard skipped it, so the duty-configuration columns are added here).
 *
 * 3. student_concessions: term scope + revocation audit columns.
 *
 * 4. fee_challans.concession_details: snapshot of which concession(s) were applied to a
 *    challan at generation time (immutable history, no silent recalculation).
 *
 * 5. teacher_payroll_drafts: attendance figures used for fixed-salary payroll.
 */

async function addColumnIfMissing(knex, tableName, columnName, builder) {
  const exists = await knex.schema.hasColumn(tableName, columnName);
  if (!exists) {
    await knex.schema.alterTable(tableName, (table) => builder(table));
  }
}

export async function up(knex) {
  // ─── 1. Timetable date-specific exceptions ────────────────────────────────
  if (await knex.schema.hasTable('timetable_lessons')) {
    await addColumnIfMissing(knex, 'timetable_lessons', 'holiday_event_id', (table) => {
      table.bigInteger('holiday_event_id').unsigned().nullable();
      table.index(['holiday_event_id'], 'ix_tl_holiday_event');
      table
        .foreign('holiday_event_id', 'fk_tl_holiday_event')
        .references('id')
        .inTable('academic_holidays')
        .onDelete('SET NULL');
    });
  }

  // ─── 2. Teacher salary profile duty configuration ─────────────────────────
  if (await knex.schema.hasTable('teacher_salary_profiles')) {
    await addColumnIfMissing(knex, 'teacher_salary_profiles', 'configured_by', (table) => {
      table.bigInteger('configured_by').unsigned().nullable();
      table.foreign('configured_by', 'fk_tsp_configured_by').references('id').inTable('users').onDelete('SET NULL');
    });
    await addColumnIfMissing(knex, 'teacher_salary_profiles', 'expected_duty_days', (table) => {
      table.integer('expected_duty_days').unsigned().nullable();
    });
    await addColumnIfMissing(knex, 'teacher_salary_profiles', 'expected_duty_hours', (table) => {
      table.decimal('expected_duty_hours', 8, 2).nullable();
    });
    await addColumnIfMissing(knex, 'teacher_salary_profiles', 'working_days', (table) => {
      // ISO weekdays, e.g. [1,2,3,4,5] = Monday-Friday
      table.json('working_days').nullable();
    });
    await addColumnIfMissing(knex, 'teacher_salary_profiles', 'duty_start_time', (table) => {
      table.time('duty_start_time').nullable();
    });
    await addColumnIfMissing(knex, 'teacher_salary_profiles', 'duty_end_time', (table) => {
      table.time('duty_end_time').nullable();
    });
    await addColumnIfMissing(knex, 'teacher_salary_profiles', 'late_grace_minutes', (table) => {
      table.integer('late_grace_minutes').unsigned().notNullable().defaultTo(0);
    });
    await addColumnIfMissing(knex, 'teacher_salary_profiles', 'academic_session_id', (table) => {
      table.bigInteger('academic_session_id').unsigned().nullable();
      table
        .foreign('academic_session_id', 'fk_tsp_session')
        .references('id')
        .inTable('academic_sessions')
        .onDelete('SET NULL');
    });
    await addColumnIfMissing(knex, 'teacher_salary_profiles', 'updated_at', (table) => {
      table
        .specificType('updated_at', 'DATETIME(3)')
        .nullable()
        .defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));
    });
  }

  // ─── 3. Student concession scope + revocation audit ───────────────────────
  if (await knex.schema.hasTable('student_concessions')) {
    // Defensive: in case migration 34's section was skipped on some database.
    await addColumnIfMissing(knex, 'student_concessions', 'effective_start_date', (t) => t.date('effective_start_date').nullable());
    await addColumnIfMissing(knex, 'student_concessions', 'effective_end_date', (t) => t.date('effective_end_date').nullable());
    await addColumnIfMissing(knex, 'student_concessions', 'fee_component', (t) => t.string('fee_component', 50).nullable());
    await addColumnIfMissing(knex, 'student_concessions', 'admin_notes', (t) => t.text('admin_notes').nullable());

    await addColumnIfMissing(knex, 'student_concessions', 'term_id', (table) => {
      table.bigInteger('term_id').unsigned().nullable();
      table.foreign('term_id', 'fk_sc_term').references('id').inTable('academic_terms').onDelete('SET NULL');
    });
    await addColumnIfMissing(knex, 'student_concessions', 'revoked_by', (table) => {
      table.bigInteger('revoked_by').unsigned().nullable();
      table.foreign('revoked_by', 'fk_sc_revoked_by').references('id').inTable('users').onDelete('SET NULL');
    });
    await addColumnIfMissing(knex, 'student_concessions', 'revoked_at', (table) => {
      table.specificType('revoked_at', 'DATETIME(3)').nullable();
    });
    await addColumnIfMissing(knex, 'student_concessions', 'revoke_reason', (table) => {
      table.string('revoke_reason', 255).nullable();
    });
  }

  // ─── 4. Challan concession snapshot ───────────────────────────────────────
  if (await knex.schema.hasTable('fee_challans')) {
    await addColumnIfMissing(knex, 'fee_challans', 'concession_details', (table) => {
      table.json('concession_details').nullable();
    });
  }

  // ─── 5. Payroll attendance figures (fixed-salary teachers) ────────────────
  if (await knex.schema.hasTable('teacher_payroll_drafts')) {
    await addColumnIfMissing(knex, 'teacher_payroll_drafts', 'duty_days', (t) => t.integer('duty_days').unsigned().notNullable().defaultTo(0));
    await addColumnIfMissing(knex, 'teacher_payroll_drafts', 'absent_days', (t) => t.integer('absent_days').unsigned().notNullable().defaultTo(0));
    await addColumnIfMissing(knex, 'teacher_payroll_drafts', 'late_days', (t) => t.integer('late_days').unsigned().notNullable().defaultTo(0));
    await addColumnIfMissing(knex, 'teacher_payroll_drafts', 'early_departure_days', (t) => t.integer('early_departure_days').unsigned().notNullable().defaultTo(0));
    await addColumnIfMissing(knex, 'teacher_payroll_drafts', 'duty_minutes', (t) => t.integer('duty_minutes').unsigned().notNullable().defaultTo(0));
    await addColumnIfMissing(knex, 'teacher_payroll_drafts', 'attendance_deduction', (t) => t.decimal('attendance_deduction', 12, 2).notNullable().defaultTo(0));
  }
}

export async function down(knex) {
  const dropIfExists = async (tableName, columns, foreignKeys = []) => {
    if (!(await knex.schema.hasTable(tableName))) return;
    for (const fk of foreignKeys) {
      if (await knex.schema.hasColumn(tableName, fk.column)) {
        try {
          await knex.schema.alterTable(tableName, (t) => t.dropForeign([fk.column], fk.name));
        } catch (_) {
          // FK may not exist on databases where it was never created
        }
      }
    }
    for (const col of columns) {
      if (await knex.schema.hasColumn(tableName, col)) {
        await knex.schema.alterTable(tableName, (t) => t.dropColumn(col));
      }
    }
  };

  await dropIfExists('teacher_payroll_drafts', [
    'duty_days', 'absent_days', 'late_days', 'early_departure_days', 'duty_minutes', 'attendance_deduction'
  ]);
  await dropIfExists('fee_challans', ['concession_details']);
  await dropIfExists(
    'student_concessions',
    ['term_id', 'revoked_by', 'revoked_at', 'revoke_reason'],
    [{ column: 'term_id', name: 'fk_sc_term' }, { column: 'revoked_by', name: 'fk_sc_revoked_by' }]
  );
  await dropIfExists(
    'teacher_salary_profiles',
    ['configured_by', 'expected_duty_days', 'expected_duty_hours', 'working_days', 'duty_start_time',
      'duty_end_time', 'late_grace_minutes', 'academic_session_id', 'updated_at'],
    [{ column: 'configured_by', name: 'fk_tsp_configured_by' }, { column: 'academic_session_id', name: 'fk_tsp_session' }]
  );
  await dropIfExists('timetable_lessons', ['holiday_event_id'], [{ column: 'holiday_event_id', name: 'fk_tl_holiday_event' }]);
}
