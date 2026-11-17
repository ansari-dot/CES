/**
 * Migration 40: Challan payment-detail revisions + QR, AI quiz generation log,
 * quiz result publication / correction audit and parent notification ledger.
 *
 * Idempotent: every step checks for the table/column first. Nothing is deleted
 * and no existing financial value is modified.
 *
 * 1. fee_challan_payment_details
 *    Immutable, per-challan revisions of the recipient/payment details printed on
 *    a challan (account title, bank, account number, IBAN, method, instructions,
 *    optional QR image). Exactly one row per challan is `is_current = 1`.
 *    Existing challans are backfilled with revision 1 (source ISSUED_SNAPSHOT)
 *    copied from the bank account they currently reference, so later edits to a
 *    shared school_bank_accounts row no longer rewrite issued/paid challans.
 *
 * 2. ai_quiz_generations
 *    One row per AI generation request (idempotency key per user), recording
 *    parameters, provider/model, validated output and status.
 *
 * 3. monthly_tests: ai_generation_id (unique), ai_review_status,
 *    results_published_at, results_published_by.
 *
 * 4. test_attempt_grade_revisions
 *    Audit history of grade changes made after results were published.
 *
 * 5. assessment_result_notifications
 *    Dedup ledger so a publication / correction event notifies each parent once.
 *
 * @param { import("knex").Knex } knex
 */
export async function up(knex) {
  // ---------------------------------------------------------------------------
  // 1. Challan payment detail revisions
  // ---------------------------------------------------------------------------
  if (!(await knex.schema.hasTable('fee_challan_payment_details'))) {
    await knex.schema.createTable('fee_challan_payment_details', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('challan_id').unsigned().notNullable();
      table.integer('revision_no').unsigned().notNullable();
      table.boolean('is_current').notNullable().defaultTo(true);
      table
        .enu('source', ['ISSUED_SNAPSHOT', 'PRINCIPAL_EDIT', 'BANK_REASSIGNMENT'])
        .notNullable()
        .defaultTo('ISSUED_SNAPSHOT');
      // Bank account the details were copied from (informational; details are frozen here)
      table.bigInteger('bank_account_id').unsigned().nullable();
      table.string('account_title', 150).notNullable();
      table.string('bank_name', 100).nullable();
      table.string('branch_name', 150).nullable();
      table.string('account_number', 50).nullable();
      table.string('iban', 50).nullable();
      table.string('payment_method', 60).nullable();
      table.string('payment_instructions', 1000).nullable();
      // QR code (private storage; never exposed as a path)
      table.boolean('qr_enabled').notNullable().defaultTo(false);
      table.string('qr_storage_key', 255).nullable();
      table.string('qr_mime_type', 50).nullable();
      table.integer('qr_size_bytes').unsigned().nullable();
      table.string('qr_sha256', 64).nullable();
      table.string('qr_label', 150).nullable(); // recipient the principal attests the QR pays
      table.bigInteger('qr_attested_by').unsigned().nullable();
      table.specificType('qr_attested_at', 'DATETIME(3)').nullable();
      table.string('change_reason', 500).nullable();
      table.bigInteger('created_by').unsigned().nullable();
      table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));

      table.unique(['challan_id', 'revision_no'], 'uq_fcpd_challan_revision');
      table.index(['challan_id', 'is_current'], 'ix_fcpd_challan_current');
      table.foreign('challan_id').references('id').inTable('fee_challans').onDelete('CASCADE');
      table.foreign('created_by').references('id').inTable('users').onDelete('SET NULL');
      table.foreign('qr_attested_by').references('id').inTable('users').onDelete('SET NULL');
    });
  }

  // Backfill revision 1 for every challan that has none, frozen from the bank
  // account it references today (or the default account when unassigned).
  const hasBankTable = await knex.schema.hasTable('school_bank_accounts');
  const hasChallanBankCol = await knex.schema.hasColumn('fee_challans', 'bank_account_id');
  if (hasBankTable && hasChallanBankCol) {
    const defaultAccount =
      (await knex('school_bank_accounts').where({ is_default: true, status: 'ACTIVE' }).first()) ||
      (await knex('school_bank_accounts').where({ status: 'ACTIVE' }).orderBy('id', 'asc').first()) ||
      null;
    await knex.raw(
      `
      INSERT INTO fee_challan_payment_details
        (challan_id, revision_no, is_current, source, bank_account_id, account_title, bank_name,
         branch_name, account_number, iban, payment_method, payment_instructions, qr_enabled,
         change_reason, created_by)
      SELECT fc.id, 1, 1, 'ISSUED_SNAPSHOT', sba.id, sba.account_title, sba.bank_name,
             sba.branch_name, sba.account_number, sba.iban, 'Bank Deposit / Online Transfer',
             sba.instructions, 0,
             'Snapshot of payment details as issued (migration 40 backfill)', NULL
      FROM fee_challans fc
      JOIN school_bank_accounts sba ON sba.id = COALESCE(fc.bank_account_id, ?)
      WHERE NOT EXISTS (SELECT 1 FROM fee_challan_payment_details d WHERE d.challan_id = fc.id)
      `,
      [defaultAccount ? defaultAccount.id : null]
    );
  }

  // ---------------------------------------------------------------------------
  // 2. AI quiz generation log
  // ---------------------------------------------------------------------------
  if (!(await knex.schema.hasTable('ai_quiz_generations'))) {
    await knex.schema.createTable('ai_quiz_generations', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('requested_by').unsigned().notNullable();
      table.string('idempotency_key', 64).notNullable();
      table.enu('kind', ['FULL_QUIZ', 'SINGLE_QUESTION']).notNullable().defaultTo('FULL_QUIZ');
      table.bigInteger('class_id').unsigned().notNullable();
      table.bigInteger('subject_id').unsigned().notNullable();
      table.string('difficulty', 20).notNullable();
      table.integer('question_count').unsigned().notNullable();
      table.decimal('total_marks', 6, 2).nullable();
      table.json('request_params').notNullable();
      table.string('provider', 30).nullable();
      table.string('model', 100).nullable();
      table.enu('status', ['PENDING', 'SUCCEEDED', 'FAILED']).notNullable().defaultTo('PENDING');
      table.json('result_questions').nullable();
      table.string('error_code', 50).nullable();
      table.string('error_message', 500).nullable();
      table.integer('attempts').unsigned().notNullable().defaultTo(0);
      table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
      table.specificType('completed_at', 'DATETIME(3)').nullable();

      table.unique(['requested_by', 'idempotency_key'], 'uq_aiqg_user_key');
      table.index(['requested_by', 'created_at'], 'ix_aiqg_user_time');
      table.foreign('requested_by').references('id').inTable('users').onDelete('CASCADE');
      table.foreign('class_id').references('id').inTable('classes').onDelete('CASCADE');
      table.foreign('subject_id').references('id').inTable('subjects').onDelete('CASCADE');
    });
  }

  // ---------------------------------------------------------------------------
  // 3. monthly_tests: AI provenance + result publication stamp
  // ---------------------------------------------------------------------------
  if (!(await knex.schema.hasColumn('monthly_tests', 'ai_generation_id'))) {
    await knex.schema.alterTable('monthly_tests', (table) => {
      table.bigInteger('ai_generation_id').unsigned().nullable();
      table.unique(['ai_generation_id'], 'uq_mt_ai_generation');
      table.foreign('ai_generation_id').references('id').inTable('ai_quiz_generations').onDelete('SET NULL');
    });
  }
  if (!(await knex.schema.hasColumn('monthly_tests', 'ai_review_status'))) {
    await knex.schema.alterTable('monthly_tests', (table) => {
      table
        .enu('ai_review_status', ['NOT_APPLICABLE', 'PENDING_REVIEW', 'REVIEWED'])
        .notNullable()
        .defaultTo('NOT_APPLICABLE');
    });
  }
  if (!(await knex.schema.hasColumn('monthly_tests', 'results_published_at'))) {
    await knex.schema.alterTable('monthly_tests', (table) => {
      table.specificType('results_published_at', 'DATETIME(3)').nullable();
      table.bigInteger('results_published_by').unsigned().nullable();
      table.foreign('results_published_by').references('id').inTable('users').onDelete('SET NULL');
    });
    // Best-effort stamp for already-published tests (last update time is the closest record).
    await knex('monthly_tests')
      .where('status', 'RESULTS_PUBLISHED')
      .whereNull('results_published_at')
      .update({ results_published_at: knex.ref('updated_at') });
  }

  // ---------------------------------------------------------------------------
  // 4. Post-publication grade correction history
  // ---------------------------------------------------------------------------
  if (!(await knex.schema.hasTable('test_attempt_grade_revisions'))) {
    await knex.schema.createTable('test_attempt_grade_revisions', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('attempt_id').unsigned().notNullable();
      table.bigInteger('test_id').unsigned().notNullable();
      table.integer('revision_no').unsigned().notNullable();
      table.decimal('previous_subjective_score', 6, 2).nullable();
      table.decimal('previous_total_score', 6, 2).nullable();
      table.boolean('previous_is_passed').nullable();
      table.text('previous_remarks').nullable();
      table.decimal('new_subjective_score', 6, 2).nullable();
      table.decimal('new_total_score', 6, 2).nullable();
      table.boolean('new_is_passed').nullable();
      table.text('new_remarks').nullable();
      table.json('answer_changes').nullable();
      table.string('reason', 500).notNullable();
      table.bigInteger('changed_by').unsigned().nullable();
      table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));

      table.unique(['attempt_id', 'revision_no'], 'uq_tagr_attempt_rev');
      table.foreign('attempt_id').references('id').inTable('test_attempts').onDelete('CASCADE');
      table.foreign('test_id').references('id').inTable('monthly_tests').onDelete('CASCADE');
      table.foreign('changed_by').references('id').inTable('users').onDelete('SET NULL');
    });
  }

  // ---------------------------------------------------------------------------
  // 5. Parent result-notification dedup ledger
  // ---------------------------------------------------------------------------
  if (!(await knex.schema.hasTable('assessment_result_notifications'))) {
    await knex.schema.createTable('assessment_result_notifications', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('test_id').unsigned().notNullable();
      table.bigInteger('student_id').unsigned().notNullable();
      table.bigInteger('recipient_user_id').unsigned().notNullable();
      table.string('event_key', 80).notNullable(); // RESULTS_PUBLISHED | RESULT_CORRECTED:<revisionId>
      table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));

      table.unique(['test_id', 'student_id', 'recipient_user_id', 'event_key'], 'uq_arn_event');
      table.foreign('test_id').references('id').inTable('monthly_tests').onDelete('CASCADE');
      table.foreign('student_id').references('id').inTable('students').onDelete('CASCADE');
      table.foreign('recipient_user_id').references('id').inTable('users').onDelete('CASCADE');
    });
  }
}

/**
 * Rollback drops only the structures this migration created. Payment-detail
 * revisions are historical records: rolling back discards them, so only roll
 * back in development.
 * @param { import("knex").Knex } knex
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('assessment_result_notifications');
  await knex.schema.dropTableIfExists('test_attempt_grade_revisions');

  if (await knex.schema.hasColumn('monthly_tests', 'results_published_at')) {
    await knex.schema.alterTable('monthly_tests', (table) => {
      table.dropForeign(['results_published_by']);
      table.dropColumn('results_published_by');
      table.dropColumn('results_published_at');
    });
  }
  if (await knex.schema.hasColumn('monthly_tests', 'ai_review_status')) {
    await knex.schema.alterTable('monthly_tests', (table) => table.dropColumn('ai_review_status'));
  }
  if (await knex.schema.hasColumn('monthly_tests', 'ai_generation_id')) {
    await knex.schema.alterTable('monthly_tests', (table) => {
      table.dropForeign(['ai_generation_id']);
      table.dropUnique(['ai_generation_id'], 'uq_mt_ai_generation');
      table.dropColumn('ai_generation_id');
    });
  }
  await knex.schema.dropTableIfExists('ai_quiz_generations');
  await knex.schema.dropTableIfExists('fee_challan_payment_details');
}
