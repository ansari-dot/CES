/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // 1. Teachers table
  await knex.schema.createTable('teachers', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('user_id').unsigned().notNullable().unique();
    table.string('employee_no', 50).notNullable().unique();
    table.string('designation', 100).nullable();
    table.date('joining_date').notNullable();
    table.enu('employment_status', ['ACTIVE', 'ON_LEAVE', 'RESIGNED']).notNullable().defaultTo('ACTIVE');
    table.string('qualification', 255).nullable();
    table.text('bank_account').nullable();
    table.json('documents').nullable();
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
  });

  // 2. Teacher Salary Profiles table
  await knex.schema.createTable('teacher_salary_profiles', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('teacher_id').unsigned().notNullable();
    table.enu('model', ['FIXED', 'PER_LESSON', 'PER_HOUR', 'HYBRID']).notNullable().defaultTo('FIXED');
    table.decimal('base_amount', 12, 2).notNullable().defaultTo(0);
    table.decimal('per_lesson_rate', 12, 2).notNullable().defaultTo(0);
    table.decimal('per_hour_rate', 12, 2).notNullable().defaultTo(0);
    table.json('rules').nullable(); // e.g. { allowances, deductions, standardDeductions }
    table.date('effective_from').notNullable();
    table.date('effective_to').nullable();
    table.bigInteger('approved_by').unsigned().nullable();
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));

    table.index(['teacher_id', 'effective_from'], 'ix_tsp_teacher_effective');
    table.foreign('teacher_id').references('id').inTable('teachers').onDelete('CASCADE');
    table.foreign('approved_by').references('id').inTable('users').onDelete('SET NULL');
  });
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('teacher_salary_profiles');
  await knex.schema.dropTableIfExists('teachers');
}
