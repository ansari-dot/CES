/**
 * Migration 28: Terminal Examination tables (real schema)
 *
 * The original 20261109_27_create_terminal_exam_tables.js was committed empty
 * and had to be stubbed as a no-op after it was already recorded as run, so
 * the actual tables are created here. Schema is derived from the exam module
 * (exam.repository.js / exam.service.js / exam.constants.js):
 *
 *   terminal_exams        — an examination series per session + term
 *   terminal_exam_papers  — one paper per class + subject with marks config
 *   terminal_exam_marks   — per-student marks per paper (teacher entry)
 *   terminal_exam_audits  — change audit trail per mark row
 */
export async function up(knex) {
  if (!(await knex.schema.hasTable('terminal_exams'))) {
    await knex.schema.createTable('terminal_exams', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('session_id').unsigned().notNullable();
      table.bigInteger('term_id').unsigned().notNullable();
      table.string('title', 200).notNullable();
      // EXAM_TYPES: TERMINAL | ANNUAL | MID_TERM | MOCK
      table.string('exam_type', 30).notNullable().defaultTo('TERMINAL');
      table.date('start_date').nullable();
      table.date('end_date').nullable();
      // EXAM_STATUS: DRAFT | SCHEDULED | ONGOING | MARKING | COMPLETED | CANCELLED
      table.string('status', 20).notNullable().defaultTo('SCHEDULED');
      table.tinyint('is_published').notNullable().defaultTo(0);
      table.specificType('published_at', 'DATETIME(3)').nullable();
      table.bigInteger('created_by').unsigned().notNullable();
      table.specificType('created_at', 'DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3)');
      table.specificType('updated_at', 'DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)');

      table.index(['session_id', 'term_id'], 'ix_te_session_term');
      table.foreign('session_id').references('id').inTable('academic_sessions').onDelete('CASCADE');
      table.foreign('term_id').references('id').inTable('academic_terms').onDelete('CASCADE');
      table.foreign('created_by').references('id').inTable('users').onDelete('CASCADE');
    });
  }

  if (!(await knex.schema.hasTable('terminal_exam_papers'))) {
    await knex.schema.createTable('terminal_exam_papers', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('exam_id').unsigned().notNullable();
      table.bigInteger('class_id').unsigned().notNullable();
      table.bigInteger('subject_id').unsigned().notNullable();
      // Optional link to a datesheet entry; no FK so either datesheet model works
      table.bigInteger('date_sheet_entry_id').unsigned().nullable();
      table.date('paper_date').nullable();
      table.time('start_time').nullable();
      table.time('end_time').nullable();
      table.decimal('max_theory_marks', 8, 2).notNullable().defaultTo(100);
      table.decimal('max_practical_marks', 8, 2).notNullable().defaultTo(0);
      table.decimal('total_marks', 8, 2).notNullable().defaultTo(100);
      table.decimal('passing_marks', 8, 2).notNullable().defaultTo(40);
      table.bigInteger('invigilator_teacher_id').unsigned().nullable();
      table.bigInteger('marking_teacher_id').unsigned().nullable();
      // PAPER_STATUS: SCHEDULED | CONDUCTED | MARKS_SUBMITTED | VERIFIED | LOCKED
      table.string('status', 20).notNullable().defaultTo('SCHEDULED');
      table.specificType('created_at', 'DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3)');
      table.specificType('updated_at', 'DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)');

      table.index(['exam_id', 'class_id'], 'ix_tep_exam_class');
      table.foreign('exam_id').references('id').inTable('terminal_exams').onDelete('CASCADE');
      table.foreign('class_id').references('id').inTable('classes').onDelete('CASCADE');
      table.foreign('subject_id').references('id').inTable('subjects').onDelete('CASCADE');
      table.foreign('invigilator_teacher_id').references('id').inTable('teachers').onDelete('SET NULL');
      table.foreign('marking_teacher_id').references('id').inTable('teachers').onDelete('SET NULL');
    });
  }

  if (!(await knex.schema.hasTable('terminal_exam_marks'))) {
    await knex.schema.createTable('terminal_exam_marks', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('paper_id').unsigned().notNullable();
      table.bigInteger('student_id').unsigned().notNullable();
      table.bigInteger('enrollment_id').unsigned().notNullable();
      table.decimal('theory_obtained', 8, 2).nullable();
      table.decimal('practical_obtained', 8, 2).nullable();
      table.decimal('total_obtained', 8, 2).nullable();
      table.decimal('percentage', 5, 2).nullable();
      table.string('grade', 5).nullable();
      table.tinyint('is_absent').notNullable().defaultTo(0);
      table.tinyint('is_exempt').notNullable().defaultTo(0);
      table.tinyint('is_passed').nullable();
      table.string('teacher_remarks', 500).nullable();
      table.bigInteger('entered_by').unsigned().nullable();
      // MARK_STATUS: DRAFT | SUBMITTED | VERIFIED | LOCKED
      table.string('status', 20).notNullable().defaultTo('DRAFT');
      table.bigInteger('verified_by').unsigned().nullable();
      table.specificType('verified_at', 'DATETIME(3)').nullable();
      table.specificType('created_at', 'DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3)');
      table.specificType('updated_at', 'DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)');

      table.unique(['paper_id', 'student_id'], 'uq_tem_paper_student');
      table.index(['student_id'], 'ix_tem_student');
      table.foreign('paper_id').references('id').inTable('terminal_exam_papers').onDelete('CASCADE');
      table.foreign('student_id').references('id').inTable('students').onDelete('CASCADE');
      table.foreign('enrollment_id').references('id').inTable('enrollments').onDelete('CASCADE');
      table.foreign('entered_by').references('id').inTable('users').onDelete('SET NULL');
      table.foreign('verified_by').references('id').inTable('users').onDelete('SET NULL');
    });
  }

  if (!(await knex.schema.hasTable('terminal_exam_audits'))) {
    await knex.schema.createTable('terminal_exam_audits', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('mark_id').unsigned().notNullable();
      table.bigInteger('actor_id').unsigned().nullable();
      // AUDIT_ACTIONS: CREATE | UPDATE | SUBMIT | VERIFY | LOCK | OVERRIDE
      table.string('action', 20).notNullable();
      table.decimal('old_theory', 8, 2).nullable();
      table.decimal('new_theory', 8, 2).nullable();
      table.decimal('old_practical', 8, 2).nullable();
      table.decimal('new_practical', 8, 2).nullable();
      table.tinyint('old_absent').nullable();
      table.tinyint('new_absent').nullable();
      table.string('change_reason', 255).nullable();
      table.specificType('created_at', 'DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3)');

      table.index(['mark_id'], 'ix_tea_mark');
      table.foreign('mark_id').references('id').inTable('terminal_exam_marks').onDelete('CASCADE');
      table.foreign('actor_id').references('id').inTable('users').onDelete('SET NULL');
    });
  }
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('terminal_exam_audits');
  await knex.schema.dropTableIfExists('terminal_exam_marks');
  await knex.schema.dropTableIfExists('terminal_exam_papers');
  await knex.schema.dropTableIfExists('terminal_exams');
}
