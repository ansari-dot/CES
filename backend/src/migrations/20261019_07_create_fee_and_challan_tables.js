/**
 * Migration: Module 6 - Fee Management, Concessions, Challans & Payment Proof Verification
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // 1. Fee Structures table
  await knex.schema.createTable('fee_structures', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('session_id').unsigned().notNullable();
    table.bigInteger('class_id').unsigned().notNullable();
    table.decimal('total_monthly_recurring', 10, 2).notNullable().defaultTo(0.00);
    table.date('effective_from').notNullable();
    table.enu('status', ['ACTIVE', 'ARCHIVED']).notNullable().defaultTo('ACTIVE');
    table.bigInteger('created_by').unsigned().notNullable();
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

    table.unique(['session_id', 'class_id'], 'uq_session_class_fee');
    table.foreign('session_id').references('id').inTable('academic_sessions').onDelete('CASCADE');
    table.foreign('class_id').references('id').inTable('classes').onDelete('CASCADE');
    table.foreign('created_by').references('id').inTable('users');
  });

  // 2. Fee Structure Heads table
  await knex.schema.createTable('fee_structure_heads', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('fee_structure_id').unsigned().notNullable();
    table.enu('head_type', ['TUITION', 'ADMISSION', 'TECHNOLOGY', 'BOOKS', 'EXAMINATION', 'OTHER']).notNullable();
    table.decimal('amount', 10, 2).notNullable().defaultTo(0.00);
    table.boolean('is_recurring').notNullable().defaultTo(true);
    table.string('description', 255).nullable();

    table.foreign('fee_structure_id').references('id').inTable('fee_structures').onDelete('CASCADE');
  });

  // 3. Student Concessions table
  await knex.schema.createTable('student_concessions', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('student_id').unsigned().notNullable();
    table.bigInteger('session_id').unsigned().notNullable();
    table.enu('concession_type', ['PERCENTAGE', 'FIXED_AMOUNT', 'SIBLING_DISCOUNT', 'MERIT_SCHOLARSHIP', 'NEED_BASED']).notNullable();
    table.decimal('value', 10, 2).notNullable(); // e.g. 20.00 (% or PKR)
    table.string('reason', 255).notNullable();
    table.bigInteger('approved_by').unsigned().notNullable();
    table.enu('status', ['ACTIVE', 'REVOKED']).notNullable().defaultTo('ACTIVE');
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

    table.index(['student_id', 'status'], 'ix_concession_student');
    table.foreign('student_id').references('id').inTable('students').onDelete('CASCADE');
    table.foreign('session_id').references('id').inTable('academic_sessions').onDelete('CASCADE');
    table.foreign('approved_by').references('id').inTable('users');
  });

  // 4. Monthly Fee Challans table (with 10-digit 1Link Consumer Number)
  await knex.schema.createTable('fee_challans', (table) => {
    table.bigIncrements('id').primary();
    table.string('challan_number', 50).notNullable().unique();
    table.string('consumer_number', 20).notNullable().unique(); // 10-digit 1Link consumer ID
    table.bigInteger('session_id').unsigned().notNullable();
    table.bigInteger('class_id').unsigned().notNullable();
    table.bigInteger('student_id').unsigned().notNullable();
    table.string('billing_month', 20).notNullable(); // e.g. "April 2026" or "2026-04"
    table.date('issue_date').notNullable();
    table.date('due_date').notNullable();
    table.date('valid_until').notNullable();
    table.integer('grace_period_days').notNullable().defaultTo(5);

    // Fee breakdown items
    table.decimal('tuition_amount', 10, 2).notNullable().defaultTo(0.00);
    table.decimal('technology_amount', 10, 2).notNullable().defaultTo(0.00);
    table.decimal('examination_amount', 10, 2).notNullable().defaultTo(0.00);
    table.decimal('books_amount', 10, 2).notNullable().defaultTo(0.00);
    table.decimal('admission_amount', 10, 2).notNullable().defaultTo(0.00);
    table.decimal('other_amount', 10, 2).notNullable().defaultTo(0.00);

    table.decimal('gross_amount', 10, 2).notNullable().defaultTo(0.00);
    table.decimal('concession_amount', 10, 2).notNullable().defaultTo(0.00);
    table.decimal('arrears_amount', 10, 2).notNullable().defaultTo(0.00);
    table.decimal('late_fee_amount', 10, 2).notNullable().defaultTo(0.00);
    table.decimal('total_payable', 10, 2).notNullable().defaultTo(0.00);
    table.decimal('paid_amount', 10, 2).notNullable().defaultTo(0.00);

    table.enu('status', ['UNPAID', 'PENDING_VERIFICATION', 'PARTIALLY_PAID', 'PAID', 'OVERDUE']).notNullable().defaultTo('UNPAID');
    table.integer('reminders_sent_count').notNullable().defaultTo(0);
    table.specificType('last_reminder_at', 'DATETIME(3)').nullable();

    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

    table.unique(['student_id', 'billing_month', 'session_id'], 'uq_student_month_session');
    table.index(['student_id', 'status'], 'ix_challan_student_status');
    table.index(['class_id', 'billing_month'], 'ix_challan_class_month');
    table.index(['status'], 'ix_challan_status');

    table.foreign('session_id').references('id').inTable('academic_sessions').onDelete('CASCADE');
    table.foreign('class_id').references('id').inTable('classes').onDelete('CASCADE');
    table.foreign('student_id').references('id').inTable('students').onDelete('CASCADE');
  });

  // 5. Payment Proof Submissions table
  await knex.schema.createTable('fee_payment_proofs', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('challan_id').unsigned().notNullable();
    table.bigInteger('student_id').unsigned().notNullable();
    table.bigInteger('parent_id').unsigned().nullable();
    table.decimal('submitted_amount', 10, 2).notNullable();
    table.string('bank_or_wallet', 100).notNullable();
    table.string('transaction_reference', 100).notNullable();
    table.date('payment_date').notNullable();
    table.string('proof_document_url', 500).nullable();
    table.enu('status', ['PENDING', 'APPROVED', 'REJECTED', 'RESUBMIT_REQUESTED']).notNullable().defaultTo('PENDING');
    table.bigInteger('reviewed_by').unsigned().nullable();
    table.specificType('reviewed_at', 'DATETIME(3)').nullable();
    table.string('review_decision_note', 500).nullable();
    table.decimal('verified_amount', 10, 2).nullable();
    table.string('receipt_number', 100).nullable();
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));

    table.index(['challan_id'], 'ix_proof_challan');
    table.index(['status'], 'ix_proof_status');
    table.foreign('challan_id').references('id').inTable('fee_challans').onDelete('CASCADE');
    table.foreign('student_id').references('id').inTable('students').onDelete('CASCADE');
    table.foreign('parent_id').references('id').inTable('parents').onDelete('SET NULL');
    table.foreign('reviewed_by').references('id').inTable('users').onDelete('SET NULL');
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('fee_payment_proofs');
  await knex.schema.dropTableIfExists('fee_challans');
  await knex.schema.dropTableIfExists('student_concessions');
  await knex.schema.dropTableIfExists('fee_structure_heads');
  await knex.schema.dropTableIfExists('fee_structures');
}
