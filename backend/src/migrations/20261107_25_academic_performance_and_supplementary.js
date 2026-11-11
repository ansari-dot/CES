/**
 * Migration 25: Academic Performance Monitoring, Supplementary Exam Ledger & Transactional Outbox
 * 
 * Target Environment: MySQL 8.0.46 / Knex (Declared ^3.1.0, Installed 3.3.0) / Node.js ESM
 * Module Syntax: ECMAScript Modules (ESM)
 */

export async function up(knex) {
  // If a previous migration attempt failed midway, safely drop partial tables in reverse dependency order
  try {
    await knex.raw('DROP TRIGGER IF EXISTS trg_supp_prevent_delete');
    await knex.raw('DROP TRIGGER IF EXISTS trg_supp_prevent_update');
    await knex.raw('DROP TRIGGER IF EXISTS trg_supp_before_insert');
    await knex.schema.dropTableIfExists('academic_alert_outbox');
    await knex.schema.dropTableIfExists('academic_alert_recipients');
    await knex.schema.dropTableIfExists('academic_parent_alerts');
    await knex.schema.dropTableIfExists('academic_alert_cooldowns');
    await knex.schema.dropTableIfExists('supplementary_exam_results');
    await knex.schema.dropTableIfExists('academic_grading_policies');
    await knex.schema.dropTableIfExists('migration_25_schema_ownership');
  } catch (_) {}

  // =========================================================================
  // 0. OWNERSHIP TRACKING & PRE-REQUISITE COMPOSITE KEYS
  // =========================================================================
  await knex.schema.createTable('migration_25_schema_ownership', (table) => {
    table.string('target_table', 64).notNullable();
    table.string('index_name', 64).notNullable();
    table.primary(['target_table', 'index_name']);
  });

  // Check and add uq_fr_ident on final_results (id, student_id, session_id, class_id)
  const [frIndexes] = await knex.raw(`
    SELECT 1 FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'final_results' 
      AND index_name = 'uq_fr_ident'
  `);
  if (!frIndexes || frIndexes.length === 0) {
    await knex.schema.alterTable('final_results', (table) => {
      table.unique(['id', 'student_id', 'session_id', 'class_id'], 'uq_fr_ident');
    });
    await knex('migration_25_schema_ownership').insert({
      target_table: 'final_results',
      index_name: 'uq_fr_ident'
    });
  }

  // Check and add uq_frs_triplet on final_result_subjects (id, final_result_id, subject_id)
  const [frsIndexes] = await knex.raw(`
    SELECT 1 FROM information_schema.statistics 
    WHERE table_schema = DATABASE() 
      AND table_name = 'final_result_subjects' 
      AND index_name = 'uq_frs_triplet'
  `);
  if (!frsIndexes || frsIndexes.length === 0) {
    await knex.schema.alterTable('final_result_subjects', (table) => {
      table.unique(['id', 'final_result_id', 'subject_id'], 'uq_frs_triplet');
    });
    await knex('migration_25_schema_ownership').insert({
      target_table: 'final_result_subjects',
      index_name: 'uq_frs_triplet'
    });
  }

  // =========================================================================
  // 1. ACADEMIC GRADING POLICIES (Continuous Monitoring Engine Only)
  // =========================================================================
  await knex.schema.createTable('academic_grading_policies', (table) => {
    table.bigIncrements('id').primary();
    table.enu('scope', ['GLOBAL', 'SESSION']).notNullable().defaultTo('GLOBAL');
    table.bigInteger('session_id').unsigned().nullable();
    table.string('version', 20).notNullable().defaultTo('v1.0.0');
    table.string('policy_name', 100).notNullable();

    // Formative weights (Sum to 100.00%)
    table.decimal('monthly_test_weight', 5, 2).notNullable().defaultTo(40.00);
    table.decimal('quiz_weight', 5, 2).notNullable().defaultTo(20.00);
    table.decimal('mid_term_weight', 5, 2).notNullable().defaultTo(30.00);
    table.decimal('homework_weight', 5, 2).notNullable().defaultTo(10.00);

    // Monitoring alert thresholds (0 to 100 bounds)
    table.decimal('critical_risk_threshold', 5, 2).notNullable().defaultTo(40.00);
    table.decimal('attention_threshold', 5, 2).notNullable().defaultTo(60.00);
    table.decimal('good_standing_threshold', 5, 2).notNullable().defaultTo(75.00);
    table.decimal('excellent_threshold', 5, 2).notNullable().defaultTo(90.00);

    table.enu('status', ['DRAFT', 'ACTIVE', 'ARCHIVED']).notNullable().defaultTo('DRAFT');
    table.date('effective_from').notNullable();
    table.date('effective_until').nullable();
    table.bigInteger('created_by').unsigned().nullable();
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

    table.foreign('session_id', 'fk_agp_session').references('id').inTable('academic_sessions').onDelete('RESTRICT');
    table.foreign('created_by', 'fk_agp_created_by').references('id').inTable('users').onDelete('SET NULL');

    // MySQL 8 Stored Columns for NULL-safe Version and Active Status Uniqueness
    table.specificType(
      'policy_scope_version_key',
      "VARCHAR(128) GENERATED ALWAYS AS (CONCAT(scope, ':', IFNULL(CAST(session_id AS CHAR), 'GLOBAL'), ':', version)) STORED"
    );
    table.unique(['policy_scope_version_key'], 'uq_policy_scope_version');

    table.specificType(
      'active_policy_scope_key',
      "VARCHAR(64) GENERATED ALWAYS AS (IF(status = 'ACTIVE', CONCAT(scope, ':', IFNULL(CAST(session_id AS CHAR), 'GLOBAL')), NULL)) STORED"
    );
    table.unique(['active_policy_scope_key'], 'uq_active_policy_scope');
  });

  await knex.raw(`
    ALTER TABLE academic_grading_policies
      ADD CONSTRAINT chk_agp_weights_sum 
        CHECK (ROUND(monthly_test_weight + quiz_weight + mid_term_weight + homework_weight, 2) = 100.00),
      ADD CONSTRAINT chk_agp_weights_positive 
        CHECK (monthly_test_weight >= 0 AND quiz_weight >= 0 AND mid_term_weight >= 0 AND homework_weight >= 0),
      ADD CONSTRAINT chk_agp_threshold_hierarchy 
        CHECK (critical_risk_threshold >= 0 AND critical_risk_threshold <= 100 AND
               attention_threshold >= 0 AND attention_threshold <= 100 AND
               good_standing_threshold >= 0 AND good_standing_threshold <= 100 AND
               excellent_threshold >= 0 AND excellent_threshold <= 100 AND
               critical_risk_threshold < attention_threshold AND 
               attention_threshold < good_standing_threshold AND 
               good_standing_threshold < excellent_threshold),
      ADD CONSTRAINT chk_agp_dates_order 
        CHECK (effective_until IS NULL OR effective_until >= effective_from),
      ADD CONSTRAINT chk_agp_scope_session_match 
        CHECK ((scope = 'GLOBAL' AND session_id IS NULL) OR (scope = 'SESSION' AND session_id IS NOT NULL));
  `);

  // =========================================================================
  // 2. SUPPLEMENTARY EXAMINATION RESULTS (Authoritative Re-sit Ledger)
  // =========================================================================
  await knex.schema.createTable('supplementary_exam_results', (table) => {
    table.bigIncrements('id').primary();

    // Dual composite parent linkage
    table.bigInteger('final_result_subject_id').unsigned().notNullable();
    table.bigInteger('final_result_id').unsigned().notNullable();
    table.bigInteger('subject_id').unsigned().notNullable();
    table.bigInteger('student_id').unsigned().notNullable();
    table.bigInteger('session_id').unsigned().notNullable();
    table.bigInteger('class_id').unsigned().notNullable();

    // Scheduling routes (Mode A vs Mode B)
    table.bigInteger('date_sheet_entry_id').unsigned().nullable();
    table.bigInteger('monthly_test_id').unsigned().nullable();

    // Original Terminal Exam failure snapshot
    table.decimal('original_obtained_marks', 8, 2).nullable(); // NULL if absent
    table.decimal('original_max_marks', 8, 2).notNullable();
    table.string('original_grade', 5).nullable();
    table.boolean('original_is_absent').notNullable().defaultTo(false);
    table.boolean('original_subject_passed').notNullable().defaultTo(false); // Must be 0 (FALSE)

    // Promotion policy snapshot
    table.bigInteger('promotion_policy_id').unsigned().nullable();
    table.json('promotion_policy_snapshot').notNullable();

    // Attempt & Version tracking
    table.integer('attempt_number').unsigned().notNullable().defaultTo(1);
    table.integer('correction_version').unsigned().notNullable().defaultTo(0);
    table.bigInteger('supersedes_id').unsigned().nullable();
    table.string('correction_reason', 500).nullable();

    // Exam outcome
    table.date('exam_date').nullable();
    table.decimal('obtained_marks', 8, 2).nullable();
    table.decimal('max_marks', 8, 2).notNullable();
    table.string('grade', 5).nullable();
    table.boolean('is_passed').notNullable().defaultTo(false);
    table.boolean('is_absent').notNullable().defaultTo(false);

    // Lifecycle status
    table.enu('status', [
      'AWAITING_SCHEDULE',
      'SCHEDULED',
      'DRAFT',
      'SUBMITTED',
      'APPROVED',
      'PUBLISHED',
      'SUPERSEDED',
      'CANCELLED'
    ]).notNullable().defaultTo('AWAITING_SCHEDULE');

    table.string('cancellation_reason', 255).nullable();
    table.bigInteger('cancelled_by').unsigned().nullable();
    table.specificType('cancelled_at', 'DATETIME(3)').nullable();

    table.text('remarks').nullable();
    table.bigInteger('conducted_by').unsigned().nullable();
    table.bigInteger('approved_by').unsigned().nullable();
    table.specificType('approved_at', 'DATETIME(3)').nullable();
    table.bigInteger('published_by').unsigned().nullable();
    table.specificType('published_at', 'DATETIME(3)').nullable();
    table.bigInteger('superseded_by_id').unsigned().nullable().unique();

    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

    // Foreign Keys using RESTRICT to allow CHECK constraints and protect academic integrity
    table.foreign('date_sheet_entry_id', 'fk_supp_date_sheet').references('id').inTable('date_sheet_entries').onDelete('RESTRICT');
    table.foreign('monthly_test_id', 'fk_supp_monthly_test').references('id').inTable('monthly_tests').onDelete('RESTRICT');
    table.foreign('promotion_policy_id', 'fk_supp_prom_policy').references('id').inTable('promotion_policies').onDelete('RESTRICT');
    table.foreign('supersedes_id', 'fk_supp_supersedes').references('id').inTable('supplementary_exam_results').onDelete('RESTRICT');
    table.foreign('conducted_by', 'fk_supp_conducted_by').references('id').inTable('users').onDelete('RESTRICT');
    table.foreign('approved_by', 'fk_supp_approved_by').references('id').inTable('users').onDelete('RESTRICT');
    table.foreign('published_by', 'fk_supp_published_by').references('id').inTable('users').onDelete('RESTRICT');
    table.foreign('cancelled_by', 'fk_supp_cancelled_by').references('id').inTable('users').onDelete('RESTRICT');

    // Dual composite foreign keys guaranteeing entity ownership
    table.foreign(['final_result_subject_id', 'final_result_id', 'subject_id'], 'fk_supp_frs_triplet')
      .references(['id', 'final_result_id', 'subject_id'])
      .inTable('final_result_subjects')
      .onDelete('RESTRICT');

    table.foreign(['final_result_id', 'student_id', 'session_id', 'class_id'], 'fk_supp_fr_ident')
      .references(['id', 'student_id', 'session_id', 'class_id'])
      .inTable('final_results')
      .onDelete('RESTRICT');

    // Unique keys for attempt tracking
    table.unique(['final_result_subject_id', 'attempt_number', 'correction_version'], 'uq_supp_subject_attempt_version');

    table.specificType(
      'active_attempt_key',
      "VARCHAR(64) GENERATED ALWAYS AS (IF(status IN ('AWAITING_SCHEDULE', 'SCHEDULED', 'DRAFT', 'SUBMITTED', 'APPROVED', 'PUBLISHED'), CONCAT(final_result_subject_id, ':', attempt_number), NULL)) STORED"
    );
    table.unique(['active_attempt_key'], 'uq_supp_active_attempt');

    table.index(['student_id', 'session_id', 'status'], 'ix_supp_student_session_status');
  });

  await knex.raw(`
    ALTER TABLE supplementary_exam_results
      ADD CONSTRAINT chk_supp_scheduling_modes 
        CHECK ((date_sheet_entry_id IS NULL) OR (monthly_test_id IS NULL)),
      ADD CONSTRAINT chk_supp_awaiting_schedule 
        CHECK (status != 'AWAITING_SCHEDULE' OR (date_sheet_entry_id IS NULL AND monthly_test_id IS NULL AND exam_date IS NULL)),
      ADD CONSTRAINT chk_supp_active_has_exact_schedule 
        CHECK (status IN ('AWAITING_SCHEDULE', 'SUPERSEDED', 'CANCELLED') 
          OR ((date_sheet_entry_id IS NOT NULL AND monthly_test_id IS NULL) 
           OR (date_sheet_entry_id IS NULL AND monthly_test_id IS NOT NULL))),
      ADD CONSTRAINT chk_supp_exam_date_required 
        CHECK (status IN ('AWAITING_SCHEDULE', 'CANCELLED') OR exam_date IS NOT NULL),
      ADD CONSTRAINT chk_supp_max_marks_positive 
        CHECK (max_marks > 0 AND original_max_marks > 0),
      ADD CONSTRAINT chk_supp_orig_marks_range 
        CHECK ((original_obtained_marks IS NULL) OR (original_obtained_marks >= 0 AND original_obtained_marks <= original_max_marks)),
      ADD CONSTRAINT chk_supp_orig_absence_consistency 
        CHECK ((original_is_absent = 0) OR (original_obtained_marks IS NULL)),
      ADD CONSTRAINT chk_supp_orig_must_be_failed 
        CHECK (original_subject_passed = 0),
      ADD CONSTRAINT chk_supp_marks_range 
        CHECK ((obtained_marks IS NULL) OR (obtained_marks >= 0 AND obtained_marks <= max_marks)),
      ADD CONSTRAINT chk_supp_absence_consistency 
        CHECK ((is_absent = 0) OR (obtained_marks IS NULL AND is_passed = 0)),
      ADD CONSTRAINT chk_supp_published_outcome 
        CHECK (status != 'PUBLISHED' OR (is_absent = 1 AND obtained_marks IS NULL) OR (is_absent = 0 AND obtained_marks IS NOT NULL)),
      ADD CONSTRAINT chk_supp_approval_audit 
        CHECK (status NOT IN ('APPROVED', 'PUBLISHED') OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)),
      ADD CONSTRAINT chk_supp_published_audit 
        CHECK (status != 'PUBLISHED' OR (published_by IS NOT NULL AND published_at IS NOT NULL)),
      ADD CONSTRAINT chk_supp_cancellation_audit 
        CHECK (status != 'CANCELLED' OR (cancellation_reason IS NOT NULL AND TRIM(cancellation_reason) != '' AND cancelled_by IS NOT NULL AND cancelled_at IS NOT NULL));
  `);

  // Triggers for Database-Level Immutability and Self-Supersession Prevention
  try {
    // Attempt to set trust function creators in session if permitted
    try {
      await knex.raw('SET SESSION log_bin_trust_function_creators = 1');
    } catch (_) {}

    await knex.raw(`
      CREATE TRIGGER trg_supp_before_insert
      BEFORE INSERT ON supplementary_exam_results
      FOR EACH ROW
      BEGIN
        IF NEW.supersedes_id IS NOT NULL AND NEW.supersedes_id = NEW.id THEN
          SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'A supplementary record cannot supersede itself.';
        END IF;
      END;
    `);

    await knex.raw(`
      CREATE TRIGGER trg_supp_prevent_update
      BEFORE UPDATE ON supplementary_exam_results
      FOR EACH ROW
      BEGIN
        IF NEW.supersedes_id IS NOT NULL AND NEW.supersedes_id = NEW.id THEN
          SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'A supplementary record cannot supersede itself.';
        END IF;

        IF OLD.status = 'SUPERSEDED' THEN
          SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'Superseded supplementary records are permanently immutable.';
        END IF;

        IF OLD.status = 'PUBLISHED' THEN
          IF NEW.status = 'SUPERSEDED' AND NEW.superseded_by_id IS NOT NULL THEN
            IF NOT (
              NEW.final_result_subject_id <=> OLD.final_result_subject_id AND
              NEW.final_result_id <=> OLD.final_result_id AND
              NEW.subject_id <=> OLD.subject_id AND
              NEW.student_id <=> OLD.student_id AND
              NEW.session_id <=> OLD.session_id AND
              NEW.class_id <=> OLD.class_id AND
              NEW.date_sheet_entry_id <=> OLD.date_sheet_entry_id AND
              NEW.monthly_test_id <=> OLD.monthly_test_id AND
              NEW.original_obtained_marks <=> OLD.original_obtained_marks AND
              NEW.original_max_marks <=> OLD.original_max_marks AND
              NEW.original_grade <=> OLD.original_grade AND
              NEW.original_is_absent <=> OLD.original_is_absent AND
              NEW.original_subject_passed <=> OLD.original_subject_passed AND
              NEW.promotion_policy_id <=> OLD.promotion_policy_id AND
              NEW.promotion_policy_snapshot <=> OLD.promotion_policy_snapshot AND
              NEW.attempt_number <=> OLD.attempt_number AND
              NEW.correction_version <=> OLD.correction_version AND
              NEW.supersedes_id <=> OLD.supersedes_id AND
              NEW.correction_reason <=> OLD.correction_reason AND
              NEW.exam_date <=> OLD.exam_date AND
              NEW.obtained_marks <=> OLD.obtained_marks AND
              NEW.max_marks <=> OLD.max_marks AND
              NEW.grade <=> OLD.grade AND
              NEW.is_passed <=> OLD.is_passed AND
              NEW.is_absent <=> OLD.is_absent AND
              NEW.cancellation_reason <=> OLD.cancellation_reason AND
              NEW.remarks <=> OLD.remarks AND
              NEW.conducted_by <=> OLD.conducted_by AND
              NEW.approved_by <=> OLD.approved_by AND
              NEW.approved_at <=> OLD.approved_at AND
              NEW.published_by <=> OLD.published_by AND
              NEW.published_at <=> OLD.published_at AND
              NEW.created_at <=> OLD.created_at
            ) THEN
              SIGNAL SQLSTATE '45000'
              SET MESSAGE_TEXT = 'Protected fields cannot be modified during supersession.';
            END IF;
          ELSE
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Published supplementary results cannot be modified. Issue an auditable correction.';
          END IF;
        END IF;
      END;
    `);

    await knex.raw(`
      CREATE TRIGGER trg_supp_prevent_delete
      BEFORE DELETE ON supplementary_exam_results
      FOR EACH ROW
      BEGIN
        IF OLD.status IN ('PUBLISHED', 'SUPERSEDED') THEN
          SIGNAL SQLSTATE '45000'
          SET MESSAGE_TEXT = 'Published or superseded supplementary results cannot be deleted.';
        END IF;
      END;
    `);
  } catch (triggerErr) {
    console.warn('[Migration 25 Warning] Database triggers skipped (binary logging enabled without SUPER privilege). Immutability is enforced at application layer:', triggerErr.message);
  }

  // =========================================================================
  // 3. ACADEMIC ALERT COOLDOWNS (School-wide 48h Student+Subject Throttling)
  // =========================================================================
  await knex.schema.createTable('academic_alert_cooldowns', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('student_id').unsigned().notNullable();
    table.bigInteger('subject_id').unsigned().notNullable();
    table.string('last_alert_type', 50).notNullable();
    table.specificType('last_alert_at', 'DATETIME(3)').notNullable();
    table.specificType('cooldown_expires_at', 'DATETIME(3)').notNullable();
    table.boolean('last_was_urgent').notNullable().defaultTo(false);
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

    table.foreign('student_id', 'fk_aac_student').references('id').inTable('students').onDelete('RESTRICT');
    table.foreign('subject_id', 'fk_aac_subject').references('id').inTable('subjects').onDelete('RESTRICT');

    table.unique(['student_id', 'subject_id'], 'uq_student_subject_cooldown');
    table.index(['cooldown_expires_at'], 'ix_cooldown_expiry');
  });

  // =========================================================================
  // 4. ACADEMIC PARENT ALERTS (Intervention Event Header)
  // =========================================================================
  await knex.schema.createTable('academic_parent_alerts', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('session_id').unsigned().notNullable();
    table.bigInteger('student_id').unsigned().notNullable();
    table.bigInteger('subject_id').unsigned().notNullable();

    // Attribution
    table.enu('alert_source', ['TEACHER', 'SYSTEM']).notNullable().defaultTo('TEACHER');
    table.bigInteger('teacher_id').unsigned().nullable();
    table.bigInteger('triggered_by_user_id').unsigned().nullable();

    table.bigInteger('grading_policy_id').unsigned().nullable();
    table.string('grading_policy_version', 20).notNullable();

    table.enu('alert_category', ['CRITICAL_RISK', 'ATTENTION_NEEDED', 'HOMEWORK_DEFICIT', 'ATTENDANCE_DEFICIT'])
      .notNullable();
    table.decimal('calculated_score', 5, 2).notNullable();
    table.decimal('threshold_applied', 5, 2).notNullable();
    table.string('title', 255).notNullable();
    table.text('message_body').notNullable();
    table.boolean('is_urgent').notNullable().defaultTo(false);
    table.string('override_reason', 500).nullable();
    table.json('metric_snapshot').notNullable();

    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

    table.foreign('session_id', 'fk_apa_session').references('id').inTable('academic_sessions').onDelete('RESTRICT');
    table.foreign('student_id', 'fk_apa_student').references('id').inTable('students').onDelete('RESTRICT');
    table.foreign('subject_id', 'fk_apa_subject').references('id').inTable('subjects').onDelete('RESTRICT');
    table.foreign('teacher_id', 'fk_apa_teacher').references('id').inTable('teachers').onDelete('RESTRICT');
    table.foreign('triggered_by_user_id', 'fk_apa_triggered_by').references('id').inTable('users').onDelete('SET NULL');
    table.foreign('grading_policy_id', 'fk_apa_grading_policy').references('id').inTable('academic_grading_policies').onDelete('RESTRICT');

    table.unique(['id', 'student_id'], 'uq_apa_id_student');
    table.index(['student_id', 'created_at'], 'ix_apa_student_history');
    table.index(['session_id', 'subject_id'], 'ix_apa_session_subject');
  });

  await knex.raw(`
    ALTER TABLE academic_parent_alerts
      ADD CONSTRAINT chk_apa_source_attribution 
        CHECK ((alert_source = 'TEACHER' AND teacher_id IS NOT NULL) OR (alert_source = 'SYSTEM')),
      ADD CONSTRAINT chk_apa_urgent_reason 
        CHECK (is_urgent = 0 OR (override_reason IS NOT NULL AND TRIM(override_reason) != ''));
  `);

  // =========================================================================
  // 5. ACADEMIC ALERT RECIPIENTS (Verified Parent Deliveries)
  // =========================================================================
  await knex.schema.createTable('academic_alert_recipients', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('alert_id').unsigned().notNullable();
    table.bigInteger('parent_id').unsigned().notNullable();
    table.bigInteger('student_id').unsigned().notNullable();
    table.enu('relationship_type', ['FATHER', 'MOTHER', 'GUARDIAN']).notNullable(); // No default value

    table.enu('status', ['PENDING', 'SENT', 'FAILED', 'READ']).notNullable().defaultTo('PENDING');
    table.specificType('sent_at', 'DATETIME(3)').nullable();
    table.specificType('read_at', 'DATETIME(3)').nullable();
    table.string('failure_reason', 500).nullable();
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

    // Dual composite foreign keys guaranteeing recipient belongs to the alert and student
    table.foreign(['alert_id', 'student_id'], 'fk_aar_alert_student')
      .references(['id', 'student_id'])
      .inTable('academic_parent_alerts')
      .onDelete('RESTRICT');

    table.foreign(['parent_id', 'student_id'], 'fk_aar_parent_student')
      .references(['parent_id', 'student_id'])
      .inTable('parent_student')
      .onDelete('RESTRICT');

    table.unique(['alert_id', 'parent_id'], 'uq_alert_parent_recipient');
    table.unique(['id', 'alert_id'], 'uq_aar_id_alert');
    table.index(['parent_id', 'status'], 'ix_aar_parent_status');
  });

  // =========================================================================
  // 6. ACADEMIC ALERT OUTBOX (Guaranteed Delivery Transactional Queue)
  // =========================================================================
  await knex.schema.createTable('academic_alert_outbox', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('alert_id').unsigned().notNullable();
    table.bigInteger('recipient_id').unsigned().notNullable();
    table.string('idempotency_key', 128).notNullable().unique();
    table.json('payload').notNullable();

    table.enu('status', ['PENDING', 'PROCESSING', 'DELIVERED', 'FAILED', 'DEAD_LETTER'])
      .notNullable()
      .defaultTo('PENDING');

    table.integer('retry_count').unsigned().notNullable().defaultTo(0);
    table.integer('max_retries').unsigned().notNullable().defaultTo(5);
    table.specificType('next_retry_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('delivered_at', 'DATETIME(3)').nullable();

    table.string('lease_token', 64).nullable();
    table.specificType('locked_at', 'DATETIME(3)').nullable();
    table.specificType('lock_expires_at', 'DATETIME(3)').nullable();

    table.text('last_error').nullable();
    table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    table.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

    // Composite foreign key ensuring outbox alert_id matches recipient alert_id
    table.foreign(['recipient_id', 'alert_id'], 'fk_aao_rcpt_alert')
      .references(['id', 'alert_id'])
      .inTable('academic_alert_recipients')
      .onDelete('RESTRICT');

    table.index(['status', 'next_retry_at', 'lock_expires_at'], 'ix_aao_dispatch_poll');
  });
}

export async function down(knex) {
  // Drop triggers first
  await knex.raw('DROP TRIGGER IF EXISTS trg_supp_prevent_delete');
  await knex.raw('DROP TRIGGER IF EXISTS trg_supp_prevent_update');
  await knex.raw('DROP TRIGGER IF EXISTS trg_supp_before_insert');

  // Drop tables in reverse dependency order
  await knex.schema.dropTableIfExists('academic_alert_outbox');
  await knex.schema.dropTableIfExists('academic_alert_recipients');
  await knex.schema.dropTableIfExists('academic_parent_alerts');
  await knex.schema.dropTableIfExists('academic_alert_cooldowns');
  await knex.schema.dropTableIfExists('supplementary_exam_results');
  await knex.schema.dropTableIfExists('academic_grading_policies');

  // Safely drop indexes only if Migration 25 owned and created them
  const [ownedIndexes] = await knex.raw(`
    SELECT target_table, index_name FROM migration_25_schema_ownership
  `);

  if (ownedIndexes && ownedIndexes.length > 0) {
    for (const record of ownedIndexes) {
      const [exists] = await knex.raw(`
        SELECT 1 FROM information_schema.statistics 
        WHERE table_schema = DATABASE() 
          AND table_name = ? 
          AND index_name = ?
      `, [record.target_table, record.index_name]);

      if (exists && exists.length > 0) {
        await knex.schema.alterTable(record.target_table, (table) => {
          table.dropUnique([], record.index_name);
        });
      }
    }
  }

  await knex.schema.dropTableIfExists('migration_25_schema_ownership');
}
