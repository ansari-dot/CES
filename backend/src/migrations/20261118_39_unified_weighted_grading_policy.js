/**
 * Migration 39: Unified Weighted Annual Grading Policy & Subject Breakdown Ledger
 * 
 * Target Environment: MySQL 8.0.46 / Knex / Node.js ESM
 * 
 * Enhancements:
 * 1. Adds `terminal_exam_weight` (default 50.00%) and `include_quizzes_in_assignments` (default true)
 *    to `academic_grading_policies`.
 * 2. Updates default policy weights to:
 *    - mid_term_weight: 25.00%
 *    - monthly_test_weight: 15.00%
 *    - homework_weight (Tasks/Assignments): 10.00%
 *    - terminal_exam_weight: 50.00%
 *    - quiz_weight: 0.00% (quizzes counted under Tasks/Assignments if configured)
 *    Total = 100.00%
 * 3. Adds `category_breakdown` JSON column and queryable category percentage columns
 *    to `final_result_subjects`.
 * 
 * Historical Safety:
 * - Completely preserves all previous final_results and final_result_subjects records.
 * - Columns are nullable so previous terms render without issue.
 */

export async function up(knex) {
  // 1. Alter academic_grading_policies
  const hasPoliciesTable = await knex.schema.hasTable('academic_grading_policies');
  if (hasPoliciesTable) {
    // Drop existing check constraints that do not account for terminal_exam_weight
    try {
      await knex.raw('ALTER TABLE academic_grading_policies DROP CONSTRAINT chk_agp_weights_sum');
    } catch (_) {}
    try {
      await knex.raw('ALTER TABLE academic_grading_policies DROP CONSTRAINT chk_agp_weights_positive');
    } catch (_) {}

    const hasTerminalWeight = await knex.schema.hasColumn('academic_grading_policies', 'terminal_exam_weight');
    if (!hasTerminalWeight) {
      await knex.schema.alterTable('academic_grading_policies', (table) => {
        table.decimal('terminal_exam_weight', 5, 2).notNullable().defaultTo(50.00);
      });
    }

    const hasQuizToggle = await knex.schema.hasColumn('academic_grading_policies', 'include_quizzes_in_assignments');
    if (!hasQuizToggle) {
      await knex.schema.alterTable('academic_grading_policies', (table) => {
        table.boolean('include_quizzes_in_assignments').notNullable().defaultTo(true);
      });
    }

    // Update active GLOBAL policy or insert official default if none
    const existingActive = await knex('academic_grading_policies')
      .where({ scope: 'GLOBAL', status: 'ACTIVE' })
      .first();

    if (existingActive) {
      await knex('academic_grading_policies')
        .where({ id: existingActive.id })
        .update({
          policy_name: 'Unified Weighted Annual Grading Policy (25/15/10/50)',
          mid_term_weight: 25.00,
          monthly_test_weight: 15.00,
          homework_weight: 10.00,
          quiz_weight: 0.00,
          terminal_exam_weight: 50.00,
          include_quizzes_in_assignments: true,
          updated_at: knex.fn.now(3)
        });
    } else {
      await knex('academic_grading_policies').insert({
        scope: 'GLOBAL',
        session_id: null,
        version: 'v2.0.0',
        policy_name: 'Unified Weighted Annual Grading Policy (25/15/10/50)',
        mid_term_weight: 25.00,
        monthly_test_weight: 15.00,
        homework_weight: 10.00,
        quiz_weight: 0.00,
        terminal_exam_weight: 50.00,
        include_quizzes_in_assignments: true,
        critical_risk_threshold: 40.00,
        attention_threshold: 60.00,
        good_standing_threshold: 75.00,
        excellent_threshold: 90.00,
        status: 'ACTIVE',
        effective_from: '2026-01-01',
        created_by: null
      });
    }

    // Add updated check constraints that validate the 5-weight sum and positivity
    try {
      await knex.raw(`
        ALTER TABLE academic_grading_policies
          ADD CONSTRAINT chk_agp_weights_sum 
            CHECK (ROUND(monthly_test_weight + quiz_weight + mid_term_weight + homework_weight + terminal_exam_weight, 2) = 100.00),
          ADD CONSTRAINT chk_agp_weights_positive 
            CHECK (monthly_test_weight >= 0 AND quiz_weight >= 0 AND mid_term_weight >= 0 AND homework_weight >= 0 AND terminal_exam_weight >= 0)
      `);
    } catch (_) {}
  }

  // 2. Alter final_result_subjects to store transparent category breakdowns
  const hasResultSubjectsTable = await knex.schema.hasTable('final_result_subjects');
  if (hasResultSubjectsTable) {
    const hasCategoryBreakdown = await knex.schema.hasColumn('final_result_subjects', 'category_breakdown');
    if (!hasCategoryBreakdown) {
      await knex.schema.alterTable('final_result_subjects', (table) => {
        table.json('category_breakdown').nullable();
        table.decimal('mid_term_pct', 5, 2).nullable();
        table.decimal('monthly_test_pct', 5, 2).nullable();
        table.decimal('assignment_pct', 5, 2).nullable();
        table.decimal('terminal_pct', 5, 2).nullable();
        table.bigInteger('policy_id').unsigned().nullable();
      });
    }
  }
}

export async function down(knex) {
  const hasResultSubjectsTable = await knex.schema.hasTable('final_result_subjects');
  if (hasResultSubjectsTable) {
    const hasCategoryBreakdown = await knex.schema.hasColumn('final_result_subjects', 'category_breakdown');
    if (hasCategoryBreakdown) {
      await knex.schema.alterTable('final_result_subjects', (table) => {
        table.dropColumn('category_breakdown');
        table.dropColumn('mid_term_pct');
        table.dropColumn('monthly_test_pct');
        table.dropColumn('assignment_pct');
        table.dropColumn('terminal_pct');
        table.dropColumn('policy_id');
      });
    }
  }

  const hasPoliciesTable = await knex.schema.hasTable('academic_grading_policies');
  if (hasPoliciesTable) {
    const hasTerminalWeight = await knex.schema.hasColumn('academic_grading_policies', 'terminal_exam_weight');
    if (hasTerminalWeight) {
      await knex.schema.alterTable('academic_grading_policies', (table) => {
        table.dropColumn('terminal_exam_weight');
      });
    }
    const hasQuizToggle = await knex.schema.hasColumn('academic_grading_policies', 'include_quizzes_in_assignments');
    if (hasQuizToggle) {
      await knex.schema.alterTable('academic_grading_policies', (table) => {
        table.dropColumn('include_quizzes_in_assignments');
      });
    }
  }
}
