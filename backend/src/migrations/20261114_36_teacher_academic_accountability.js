/**
 * Migration 36: Teacher Academic Accountability.
 *
 * Reuses existing work records (learning_tasks, task_submissions, monthly_tests,
 * test_attempts, terminal_exam_papers, teacher_assignments). Only adds what does not exist:
 *
 *  - teacher_academic_policies          principal-defined workload & grading policy (scoped)
 *  - teacher_academic_policy_versions   immutable snapshot of every policy version
 *  - teacher_work_requirements          monthly targets per teacher/class/subject, frozen with the
 *                                       policy version that applied (history is never rewritten)
 *  - teacher_grading_obligations        one row per submission / attempt / exam paper to grade,
 *                                       with original and (separately) extended deadline
 *  - teacher_work_exceptions            audited extensions and excusals (reason mandatory)
 *
 * Additive and idempotent (hasTable guards).
 */

export async function up(knex) {
  if (!(await knex.schema.hasTable('teacher_academic_policies'))) {
    await knex.schema.createTable('teacher_academic_policies', (t) => {
      t.bigIncrements('id').primary();
      t.string('name', 150).notNullable();
      // SCHOOL | CLASS | CLASS_SUBJECT | SUBJECT | TEACHER
      t.string('scope_type', 20).notNullable().defaultTo('SCHOOL');
      t.bigInteger('class_id').unsigned().nullable().references('id').inTable('classes').onDelete('CASCADE');
      t.bigInteger('subject_id').unsigned().nullable().references('id').inTable('subjects').onDelete('CASCADE');
      t.bigInteger('teacher_id').unsigned().nullable().references('id').inTable('teachers').onDelete('CASCADE');
      t.bigInteger('session_id').unsigned().nullable().references('id').inTable('academic_sessions').onDelete('SET NULL');
      t.bigInteger('term_id').unsigned().nullable().references('id').inTable('academic_terms').onDelete('SET NULL');
      t.integer('required_quizzes').unsigned().notNullable().defaultTo(0);
      t.integer('required_assignments').unsigned().notNullable().defaultTo(0);
      t.integer('required_tests').unsigned().notNullable().defaultTo(0);
      t.boolean('count_drafts').notNullable().defaultTo(false);
      t.integer('assignment_grading_days').unsigned().nullable();
      t.integer('quiz_grading_days').unsigned().nullable();
      t.integer('marks_upload_days').unsigned().nullable();
      t.boolean('feedback_required').notNullable().defaultTo(false);
      t.integer('due_soon_hours').unsigned().notNullable().defaultTo(24);
      t.boolean('notify_teacher').notNullable().defaultTo(true);
      t.boolean('notify_principal').notNullable().defaultTo(true);
      t.date('effective_from').notNullable();
      t.date('effective_to').nullable();
      t.boolean('is_active').notNullable().defaultTo(true);
      t.integer('version').unsigned().notNullable().defaultTo(1);
      t.bigInteger('created_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      t.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
      t.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));
      t.index(['is_active', 'scope_type'], 'ix_tap_active_scope');
      t.index(['teacher_id'], 'ix_tap_teacher');
      t.index(['class_id', 'subject_id'], 'ix_tap_class_subject');
    });
  }

  if (!(await knex.schema.hasTable('teacher_academic_policy_versions'))) {
    await knex.schema.createTable('teacher_academic_policy_versions', (t) => {
      t.bigIncrements('id').primary();
      t.bigInteger('policy_id').unsigned().notNullable().references('id').inTable('teacher_academic_policies').onDelete('CASCADE');
      t.integer('version').unsigned().notNullable();
      t.json('snapshot').notNullable();
      t.string('change_reason', 255).nullable();
      t.bigInteger('changed_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      t.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
      t.unique(['policy_id', 'version'], 'uq_tapv_policy_version');
    });
  }

  if (!(await knex.schema.hasTable('teacher_work_requirements'))) {
    await knex.schema.createTable('teacher_work_requirements', (t) => {
      t.bigIncrements('id').primary();
      t.bigInteger('teacher_id').unsigned().notNullable().references('id').inTable('teachers').onDelete('CASCADE');
      t.bigInteger('class_id').unsigned().notNullable().references('id').inTable('classes').onDelete('CASCADE');
      t.bigInteger('subject_id').unsigned().notNullable().references('id').inTable('subjects').onDelete('CASCADE');
      t.string('period', 7).notNullable(); // YYYY-MM (school calendar)
      t.bigInteger('policy_id').unsigned().nullable().references('id').inTable('teacher_academic_policies').onDelete('SET NULL');
      t.integer('policy_version').unsigned().nullable();
      t.integer('required_quizzes').unsigned().notNullable().defaultTo(0);
      t.integer('required_assignments').unsigned().notNullable().defaultTo(0);
      t.integer('required_tests').unsigned().notNullable().defaultTo(0);
      t.boolean('count_drafts').notNullable().defaultTo(false);
      t.date('assigned_from').nullable(); // proration when assigned mid-month
      t.date('due_date').notNullable(); // last day of the month
      t.boolean('is_closed').notNullable().defaultTo(false); // month finished: targets frozen
      t.integer('final_quizzes').unsigned().nullable();
      t.integer('final_assignments').unsigned().nullable();
      t.integer('final_tests').unsigned().nullable();
      t.boolean('is_excused').notNullable().defaultTo(false);
      t.string('excuse_reason', 255).nullable();
      t.specificType('reminder_sent_at', 'DATETIME(3)').nullable();
      t.specificType('missed_notified_at', 'DATETIME(3)').nullable();
      t.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
      t.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));
      t.unique(['teacher_id', 'class_id', 'subject_id', 'period'], 'uq_twr_teacher_class_subject_period');
      t.index(['period'], 'ix_twr_period');
    });
  }

  if (!(await knex.schema.hasTable('teacher_grading_obligations'))) {
    await knex.schema.createTable('teacher_grading_obligations', (t) => {
      t.bigIncrements('id').primary();
      // ASSIGNMENT_GRADING | QUIZ_MANUAL_GRADING | MARKS_UPLOAD
      t.string('obligation_type', 30).notNullable();
      // task_submission | test_attempt | terminal_exam_paper
      t.string('source_type', 30).notNullable();
      t.bigInteger('source_id').unsigned().notNullable();
      t.bigInteger('parent_id').unsigned().nullable(); // task / test / terminal exam
      t.string('parent_title', 255).nullable();
      t.bigInteger('teacher_id').unsigned().notNullable().references('id').inTable('teachers').onDelete('CASCADE');
      t.bigInteger('class_id').unsigned().nullable();
      t.bigInteger('subject_id').unsigned().nullable();
      t.bigInteger('student_id').unsigned().nullable();
      t.specificType('received_at', 'DATETIME(3)').notNullable(); // submission / exam date (UTC)
      t.specificType('original_deadline', 'DATETIME(3)').notNullable();
      t.specificType('extended_deadline', 'DATETIME(3)').nullable();
      t.specificType('completed_at', 'DATETIME(3)').nullable();
      // PENDING | COMPLETED | RETURNED | EXCUSED
      t.string('status', 20).notNullable().defaultTo('PENDING');
      t.boolean('feedback_missing').notNullable().defaultTo(false);
      t.bigInteger('policy_id').unsigned().nullable().references('id').inTable('teacher_academic_policies').onDelete('SET NULL');
      t.integer('policy_version').unsigned().nullable();
      t.specificType('due_soon_notified_at', 'DATETIME(3)').nullable();
      t.specificType('overdue_notified_at', 'DATETIME(3)').nullable();
      t.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
      t.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));
      t.unique(['source_type', 'source_id'], 'uq_tgo_source');
      t.index(['teacher_id', 'status'], 'ix_tgo_teacher_status');
      t.index(['parent_id', 'obligation_type'], 'ix_tgo_parent');
    });
  }

  if (!(await knex.schema.hasTable('teacher_work_exceptions'))) {
    await knex.schema.createTable('teacher_work_exceptions', (t) => {
      t.bigIncrements('id').primary();
      // EXTENSION | EXCUSE
      t.string('exception_type', 20).notNullable();
      // OBLIGATION | REQUIREMENT
      t.string('target_type', 20).notNullable();
      t.bigInteger('target_id').unsigned().notNullable();
      t.bigInteger('teacher_id').unsigned().notNullable().references('id').inTable('teachers').onDelete('CASCADE');
      t.specificType('original_deadline', 'DATETIME(3)').nullable();
      t.specificType('new_deadline', 'DATETIME(3)').nullable();
      t.string('reason', 500).notNullable();
      t.bigInteger('approved_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
      t.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
      t.index(['target_type', 'target_id'], 'ix_twe_target');
      t.index(['teacher_id'], 'ix_twe_teacher');
    });
  }
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('teacher_work_exceptions');
  await knex.schema.dropTableIfExists('teacher_grading_obligations');
  await knex.schema.dropTableIfExists('teacher_work_requirements');
  await knex.schema.dropTableIfExists('teacher_academic_policy_versions');
  await knex.schema.dropTableIfExists('teacher_academic_policies');
}
