/**
 * Migration 19: Academic year lifecycle, terms, final results and promotions
 *
 * Builds the year-end workflow on top of the existing academic_sessions and
 * enrollments tables:
 *  - academic_sessions gains an explicit lifecycle status (DRAFT → UPCOMING →
 *    ACTIVE → CLOSING → CLOSED) and close metadata. Closing never deletes data.
 *  - enrollments.status gains RETAINED and GRADUATED outcomes.
 *  - academic_terms: terms + examination periods inside a session.
 *  - promotion_policies: configurable passing/promotion criteria per session.
 *  - marks_submissions: a teacher's "marks complete" hand-off per
 *    (term, class, subject), feeding the principal's review dashboard.
 *  - final_results (+ final_result_subjects): the computed, reviewable and
 *    publishable term result per enrollment.
 *  - promotion_records: the per-student promotion decision and its execution,
 *    idempotent via new_enrollment_id and enrollments' uq_student_session.
 *  - permissions 21 results.manage and 22 promotions.manage (PRINCIPAL;
 *    ADMIN bypasses permission checks).
 */
export async function up(knex) {
  // ------------------------------------------------------------------
  // academic_sessions lifecycle
  // ------------------------------------------------------------------
  if (!(await knex.schema.hasColumn('academic_sessions', 'status'))) {
    await knex.schema.alterTable('academic_sessions', (table) => {
      table.enu('status', ['DRAFT', 'UPCOMING', 'ACTIVE', 'CLOSING', 'CLOSED']).notNullable().defaultTo('DRAFT');
      table.specificType('closed_at', 'DATETIME(3)').nullable();
      table.bigInteger('closed_by').unsigned().nullable();
    });
    // Backfill: the current session is ACTIVE; past sessions CLOSED; future UPCOMING.
    await knex('academic_sessions').where({ is_current: 1 }).update({ status: 'ACTIVE' });
    await knex('academic_sessions')
      .where({ is_current: 0 })
      .where('end_date', '<', knex.fn.now())
      .update({ status: 'CLOSED' });
    await knex('academic_sessions')
      .where({ is_current: 0 })
      .where('end_date', '>=', knex.fn.now())
      .update({ status: 'UPCOMING' });
  }

  // ------------------------------------------------------------------
  // enrollments outcome statuses
  // ------------------------------------------------------------------
  await knex.raw(
    "ALTER TABLE enrollments MODIFY status ENUM('ACTIVE','PROMOTED','RETAINED','GRADUATED','TRANSFERRED','WITHDRAWN') NOT NULL DEFAULT 'ACTIVE'"
  );

  // ------------------------------------------------------------------
  // academic_terms
  // ------------------------------------------------------------------
  if (!(await knex.schema.hasTable('academic_terms'))) {
    await knex.schema.createTable('academic_terms', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('session_id').unsigned().notNullable();
      table.string('name', 50).notNullable(); // e.g. "Term 1", "Final Term"
      table.date('start_date').notNullable();
      table.date('end_date').notNullable();
      table.date('exam_start_date').nullable();
      table.date('exam_end_date').nullable();
      // The final term's published results drive promotion eligibility.
      table.boolean('is_final').notNullable().defaultTo(false);
      table.tinyint('sort_order').unsigned().notNullable().defaultTo(1);
      table.enu('status', ['UPCOMING', 'ACTIVE', 'COMPLETED']).notNullable().defaultTo('UPCOMING');
      table.specificType('created_at', 'DATETIME(3)').defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
      table
        .specificType('updated_at', 'DATETIME(3)')
        .defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

      table.unique(['session_id', 'name'], 'uq_term_session_name');
      table.index(['session_id', 'sort_order'], 'ix_term_session_order');
      table.foreign('session_id').references('id').inTable('academic_sessions').onDelete('CASCADE');
    });
  }

  // ------------------------------------------------------------------
  // promotion_policies
  // ------------------------------------------------------------------
  if (!(await knex.schema.hasTable('promotion_policies'))) {
    await knex.schema.createTable('promotion_policies', (table) => {
      table.bigIncrements('id').primary();
      // NULL session_id = school default policy used when no session override exists.
      table.bigInteger('session_id').unsigned().nullable();
      table.decimal('min_overall_percentage', 5, 2).notNullable().defaultTo(50.0);
      table.decimal('min_subject_percentage', 5, 2).notNullable().defaultTo(40.0);
      // Up to this many failed subjects still count as PASSED.
      table.tinyint('max_failed_subjects').unsigned().notNullable().defaultTo(0);
      table.boolean('supplementary_allowed').notNullable().defaultTo(true);
      // Failed-subject count up to this (and above max_failed_subjects) routes
      // to SUPPLEMENTARY instead of FAILED.
      table.tinyint('max_supplementary_subjects').unsigned().notNullable().defaultTo(2);
      // How a subject with no marks at all is treated when computing results.
      table.enu('absent_policy', ['FAIL', 'ZERO', 'EXCLUDE']).notNullable().defaultTo('ZERO');
      table.boolean('auto_graduate_final_grade').notNullable().defaultTo(true);
      table.string('notes', 500).nullable();
      table.bigInteger('created_by').unsigned().nullable();
      table.specificType('created_at', 'DATETIME(3)').defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
      table
        .specificType('updated_at', 'DATETIME(3)')
        .defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

      table.unique(['session_id'], 'uq_policy_session');
      table.foreign('session_id').references('id').inTable('academic_sessions').onDelete('CASCADE');
    });
  }

  // ------------------------------------------------------------------
  // marks_submissions — teacher hand-off per (term, class, subject)
  // ------------------------------------------------------------------
  if (!(await knex.schema.hasTable('marks_submissions'))) {
    await knex.schema.createTable('marks_submissions', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('session_id').unsigned().notNullable();
      table.bigInteger('term_id').unsigned().notNullable();
      table.bigInteger('class_id').unsigned().notNullable();
      table.bigInteger('subject_id').unsigned().notNullable();
      table.bigInteger('teacher_id').unsigned().nullable();
      table.bigInteger('submitted_by').unsigned().notNullable(); // user id
      table.enu('status', ['SUBMITTED', 'REOPENED']).notNullable().defaultTo('SUBMITTED');
      table.string('note', 500).nullable();
      table.specificType('submitted_at', 'DATETIME(3)').defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
      table
        .specificType('updated_at', 'DATETIME(3)')
        .defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

      table.unique(['term_id', 'class_id', 'subject_id'], 'uq_marks_term_class_subject');
      table.index(['session_id', 'class_id'], 'ix_marks_session_class');
      table.foreign('session_id').references('id').inTable('academic_sessions').onDelete('CASCADE');
      table.foreign('term_id').references('id').inTable('academic_terms').onDelete('CASCADE');
      table.foreign('class_id').references('id').inTable('classes').onDelete('CASCADE');
      table.foreign('subject_id').references('id').inTable('subjects').onDelete('CASCADE');
      table.foreign('teacher_id').references('id').inTable('teachers').onDelete('SET NULL');
    });
  }

  // ------------------------------------------------------------------
  // final_results — one computed result per enrollment per term
  // ------------------------------------------------------------------
  if (!(await knex.schema.hasTable('final_results'))) {
    await knex.schema.createTable('final_results', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('enrollment_id').unsigned().notNullable();
      table.bigInteger('student_id').unsigned().notNullable();
      table.bigInteger('class_id').unsigned().notNullable();
      table.bigInteger('session_id').unsigned().notNullable();
      table.bigInteger('term_id').unsigned().notNullable();
      table.decimal('total_marks', 8, 2).notNullable().defaultTo(0);
      table.decimal('obtained_marks', 8, 2).notNullable().defaultTo(0);
      table.decimal('percentage', 5, 2).nullable();
      table.string('overall_grade', 5).nullable();
      table.tinyint('subjects_count').unsigned().notNullable().defaultTo(0);
      table.tinyint('graded_subjects_count').unsigned().notNullable().defaultTo(0);
      table.tinyint('failed_subjects_count').unsigned().notNullable().defaultTo(0);
      table.tinyint('absent_subjects_count').unsigned().notNullable().defaultTo(0);
      table
        .enu('result_status', ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED', 'INCOMPLETE'])
        .notNullable()
        .defaultTo('DRAFT');
      table
        .enu('pass_status', ['PENDING', 'PASSED', 'FAILED', 'SUPPLEMENTARY', 'ABSENT'])
        .notNullable()
        .defaultTo('PENDING');
      table.string('remarks', 500).nullable();
      table.specificType('computed_at', 'DATETIME(3)').nullable();
      table.bigInteger('approved_by').unsigned().nullable();
      table.specificType('approved_at', 'DATETIME(3)').nullable();
      table.specificType('published_at', 'DATETIME(3)').nullable();
      table.specificType('created_at', 'DATETIME(3)').defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
      table
        .specificType('updated_at', 'DATETIME(3)')
        .defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

      table.unique(['enrollment_id', 'term_id'], 'uq_result_enrollment_term');
      table.index(['session_id', 'class_id', 'term_id', 'result_status'], 'ix_result_class_term');
      table.index(['student_id', 'session_id'], 'ix_result_student_session');
      table.foreign('enrollment_id').references('id').inTable('enrollments').onDelete('CASCADE');
      table.foreign('student_id').references('id').inTable('students').onDelete('CASCADE');
      table.foreign('class_id').references('id').inTable('classes').onDelete('CASCADE');
      table.foreign('session_id').references('id').inTable('academic_sessions').onDelete('CASCADE');
      table.foreign('term_id').references('id').inTable('academic_terms').onDelete('CASCADE');
      table.foreign('approved_by').references('id').inTable('users').onDelete('SET NULL');
    });
  }

  if (!(await knex.schema.hasTable('final_result_subjects'))) {
    await knex.schema.createTable('final_result_subjects', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('final_result_id').unsigned().notNullable();
      table.bigInteger('subject_id').unsigned().notNullable();
      table.decimal('total_marks', 8, 2).notNullable().defaultTo(0);
      // NULL obtained_marks = no marks recorded (absent / missing).
      table.decimal('obtained_marks', 8, 2).nullable();
      table.decimal('percentage', 5, 2).nullable();
      table.string('grade', 5).nullable();
      table.boolean('is_absent').notNullable().defaultTo(false);
      table.boolean('passed').nullable();
      table.string('teacher_remarks', 500).nullable();
      // TASKS = aggregated from EXAM-type learning_tasks; MANUAL = entered or
      // corrected by an authorized user and preserved across recomputes.
      table.enu('source', ['TASKS', 'MANUAL']).notNullable().defaultTo('TASKS');
      table.specificType('created_at', 'DATETIME(3)').defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
      table
        .specificType('updated_at', 'DATETIME(3)')
        .defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

      table.unique(['final_result_id', 'subject_id'], 'uq_result_subject');
      table.foreign('final_result_id').references('id').inTable('final_results').onDelete('CASCADE');
      table.foreign('subject_id').references('id').inTable('subjects').onDelete('CASCADE');
    });
  }

  // ------------------------------------------------------------------
  // promotion_records — decision + execution per student per year
  // ------------------------------------------------------------------
  if (!(await knex.schema.hasTable('promotion_records'))) {
    await knex.schema.createTable('promotion_records', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('session_id').unsigned().notNullable(); // year being closed
      table.bigInteger('to_session_id').unsigned().nullable(); // year being opened
      table.bigInteger('student_id').unsigned().notNullable();
      table.bigInteger('enrollment_id').unsigned().notNullable();
      table.bigInteger('from_class_id').unsigned().notNullable();
      table.bigInteger('to_class_id').unsigned().nullable(); // NULL = retained-in-place or graduated
      table.bigInteger('final_result_id').unsigned().nullable();
      table
        .enu('eligibility', [
          'ELIGIBLE',
          'NOT_ELIGIBLE',
          'PENDING_RESULT',
          'SUPPLEMENTARY_REQUIRED',
          'GRADUATING',
          'WITHDRAWN'
        ])
        .notNullable()
        .defaultTo('PENDING_RESULT');
      table
        .enu('decision', [
          'PENDING',
          'UNDER_REVIEW',
          'PROMOTE',
          'RETAIN',
          'GRADUATE',
          'WITHHOLD',
          'WITHDRAW'
        ])
        .notNullable()
        .defaultTo('PENDING');
      table.boolean('is_override').notNullable().defaultTo(false);
      table.string('override_reason', 500).nullable();
      table.enu('status', ['DRAFT', 'DECIDED', 'EXECUTED']).notNullable().defaultTo('DRAFT');
      table.bigInteger('decided_by').unsigned().nullable();
      table.specificType('decided_at', 'DATETIME(3)').nullable();
      table.specificType('executed_at', 'DATETIME(3)').nullable();
      table.bigInteger('executed_by').unsigned().nullable();
      // The enrollment created in the next session; set exactly once (idempotency).
      table.bigInteger('new_enrollment_id').unsigned().nullable();
      table.specificType('created_at', 'DATETIME(3)').defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
      table
        .specificType('updated_at', 'DATETIME(3)')
        .defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

      table.unique(['student_id', 'session_id'], 'uq_promotion_student_session');
      table.index(['session_id', 'from_class_id', 'status'], 'ix_promotion_class_status');
      table.foreign('session_id').references('id').inTable('academic_sessions').onDelete('CASCADE');
      table.foreign('to_session_id').references('id').inTable('academic_sessions').onDelete('SET NULL');
      table.foreign('student_id').references('id').inTable('students').onDelete('CASCADE');
      table.foreign('enrollment_id').references('id').inTable('enrollments').onDelete('CASCADE');
      table.foreign('from_class_id').references('id').inTable('classes').onDelete('CASCADE');
      table.foreign('to_class_id').references('id').inTable('classes').onDelete('SET NULL');
      table.foreign('final_result_id').references('id').inTable('final_results').onDelete('SET NULL');
      table.foreign('new_enrollment_id').references('id').inTable('enrollments').onDelete('SET NULL');
    });
  }

  // ------------------------------------------------------------------
  // Permissions 21/22 (pinned ids; seeds/01 maps them to PRINCIPAL too)
  // ------------------------------------------------------------------
  const wanted = [
    { id: 21, code: 'results.manage', description: 'Compute, review, approve and publish final examination results' },
    { id: 22, code: 'promotions.manage', description: 'Evaluate, decide and execute student promotion and retention' }
  ];
  const principalRole = await knex('roles').where({ code: 'PRINCIPAL' }).first();
  for (const perm of wanted) {
    const existing = await knex('permissions').where({ code: perm.code }).first();
    let permissionId = perm.id;
    if (!existing) {
      await knex('permissions').insert(perm);
    } else {
      permissionId = existing.id;
    }
    if (principalRole) {
      const mapped = await knex('role_permissions')
        .where({ role_id: principalRole.id, permission_id: permissionId })
        .first();
      if (!mapped) {
        await knex('role_permissions').insert({ role_id: principalRole.id, permission_id: permissionId });
      }
    }
  }
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('promotion_records');
  await knex.schema.dropTableIfExists('final_result_subjects');
  await knex.schema.dropTableIfExists('final_results');
  await knex.schema.dropTableIfExists('marks_submissions');
  await knex.schema.dropTableIfExists('promotion_policies');
  await knex.schema.dropTableIfExists('academic_terms');
  for (const code of ['results.manage', 'promotions.manage']) {
    const perm = await knex('permissions').where({ code }).first();
    if (perm) {
      await knex('role_permissions').where({ permission_id: perm.id }).del();
      await knex('permissions').where({ id: perm.id }).del();
    }
  }
  await knex.raw(
    "ALTER TABLE enrollments MODIFY status ENUM('ACTIVE','PROMOTED','TRANSFERRED','WITHDRAWN') NOT NULL DEFAULT 'ACTIVE'"
  );
  if (await knex.schema.hasColumn('academic_sessions', 'status')) {
    await knex.schema.alterTable('academic_sessions', (table) => {
      table.dropColumn('status');
      table.dropColumn('closed_at');
      table.dropColumn('closed_by');
    });
  }
}
