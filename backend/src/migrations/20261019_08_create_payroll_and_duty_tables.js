/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // 1. Teacher Payroll Drafts table
  await knex.schema.createTable('teacher_payroll_drafts', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('teacher_id').unsigned().notNullable();
    table.string('payroll_month', 30).notNullable(); // e.g. "April 2026"
    table.enu('salary_model', ['FIXED', 'PER_LESSON', 'PER_HOUR', 'HYBRID']).notNullable().defaultTo('FIXED');

    // Duty metrics for the month
    table.integer('scheduled_lessons').notNullable().defaultTo(0);
    table.integer('completed_lessons').notNullable().defaultTo(0);
    table.integer('cancelled_lessons').notNullable().defaultTo(0);
    table.integer('missed_lessons').notNullable().defaultTo(0);
    table.integer('approved_leave_days').notNullable().defaultTo(0);
    table.decimal('verified_hours', 8, 2).notNullable().defaultTo(0.0);

    // Financial Calculation components
    table.decimal('base_pay', 12, 2).notNullable().defaultTo(0.0);
    table.decimal('rate_per_unit', 12, 2).notNullable().defaultTo(0.0);
    table.decimal('lesson_or_hourly_earning', 12, 2).notNullable().defaultTo(0.0);
    table.decimal('allowances', 12, 2).notNullable().defaultTo(0.0);
    table.decimal('standard_deductions', 12, 2).notNullable().defaultTo(0.0);
    table.string('calculation_formula', 500).notNullable();
    table.decimal('gross_amount', 12, 2).notNullable().defaultTo(0.0);
    table.decimal('net_payable', 12, 2).notNullable().defaultTo(0.0);

    // Workflow status & review
    table
      .enu('status', [
        'DRAFT',
        'SUBMITTED_FOR_APPROVAL',
        'APPROVED',
        'RETURNED_FOR_CORRECTION',
        'REJECTED',
        'PAID'
      ])
      .notNullable()
      .defaultTo('SUBMITTED_FOR_APPROVAL');

    table.bigInteger('generated_by').unsigned().notNullable();
    table.bigInteger('reviewed_by').unsigned().nullable();
    table.specificType('reviewed_at', 'DATETIME(3)').nullable();
    table.text('review_remarks').nullable();
    table.string('salary_slip_number', 60).nullable();

    // Payment settlement record
    table.string('payment_method', 50).nullable();
    table.string('payment_reference', 100).nullable();
    table.specificType('paid_at', 'DATETIME(3)').nullable();
    table.decimal('paid_amount', 12, 2).nullable();

    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

    table.unique(['teacher_id', 'payroll_month'], 'uq_teacher_month_payroll');
    table.index(['payroll_month'], 'ix_tpd_month');
    table.index(['status'], 'ix_tpd_status');
    table.foreign('teacher_id').references('id').inTable('teachers').onDelete('CASCADE');
    table.foreign('generated_by').references('id').inTable('users');
    table.foreign('reviewed_by').references('id').inTable('users').onDelete('SET NULL');
  });

  // 2. Teacher Salary Adjustments table (Additions / Deductions per draft)
  await knex.schema.createTable('teacher_salary_adjustments', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('payroll_draft_id').unsigned().notNullable();
    table.enu('type', ['ADDITION', 'DEDUCTION']).notNullable();
    table.string('title', 150).notNullable();
    table.decimal('amount', 12, 2).notNullable();
    table.text('reason').notNullable();
    table.bigInteger('authorized_by').unsigned().notNullable();
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));

    table.index(['payroll_draft_id'], 'ix_tsa_draft');
    table.foreign('payroll_draft_id').references('id').inTable('teacher_payroll_drafts').onDelete('CASCADE');
    table.foreign('authorized_by').references('id').inTable('users');
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('teacher_salary_adjustments');
  await knex.schema.dropTableIfExists('teacher_payroll_drafts');
}
