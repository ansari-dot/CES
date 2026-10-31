import { db } from '../src/shared/db/knex.js';

/**
 * Idempotent Database Synchronizer
 * 
 * Safely inspects the current database and applies any missing tables,
 * columns, enums, and indexes without touching or altering existing code.
 * Ensures the database matches what the entire backend codebase expects,
 * and synchronizes the Knex migration tracking state.
 */
async function syncDatabase() {
  console.log('=====================================================');
  console.log('   Cambridge Education System - Database Sync Tool   ');
  console.log('=====================================================\n');

  try {
    // ------------------------------------------------------------------
    // 1. STUDENTS table extensions
    // ------------------------------------------------------------------
    console.log('[1/6] Synchronizing `students` table...');
    if (await db.schema.hasTable('students')) {
      const studentCols = await db('students').columnInfo();

      await db.schema.alterTable('students', (table) => {
        if (!studentCols['father_name']) {
          table.string('father_name', 150).nullable();
          console.log('  + Added `students.father_name`');
        }
        if (!studentCols['father_email']) {
          table.string('father_email', 190).nullable();
          console.log('  + Added `students.father_email`');
        }
        if (!studentCols['permanent_address']) {
          table.text('permanent_address').nullable();
          console.log('  + Added `students.permanent_address`');
        }
        if (!studentCols['zoom_email']) {
          table.string('zoom_email', 190).nullable();
          table.index(['zoom_email'], 'ix_std_zoom_email');
          console.log('  + Added `students.zoom_email` and index');
        }
        if (!studentCols['zoom_user_id']) {
          table.string('zoom_user_id', 64).nullable();
          table.index(['zoom_user_id'], 'ix_std_zoom_uid');
          console.log('  + Added `students.zoom_user_id` and index');
        }
      });
    }

    // ------------------------------------------------------------------
    // 2. TEACHERS table extensions
    // ------------------------------------------------------------------
    console.log('[2/6] Synchronizing `teachers` table...');
    if (await db.schema.hasTable('teachers')) {
      const teacherCols = await db('teachers').columnInfo();

      await db.schema.alterTable('teachers', (table) => {
        if (!teacherCols['zoom_email']) {
          table.string('zoom_email', 190).nullable();
          table.index(['zoom_email'], 'ix_tch_zoom_email');
          console.log('  + Added `teachers.zoom_email` and index');
        }
        if (!teacherCols['zoom_user_id']) {
          table.string('zoom_user_id', 64).nullable();
          table.index(['zoom_user_id'], 'ix_tch_zoom_user_id');
          console.log('  + Added `teachers.zoom_user_id` and index');
        }
      });
    }

    // ------------------------------------------------------------------
    // 3. ZOOM_MEETINGS and ZOOM_EVENTS extensions
    // ------------------------------------------------------------------
    console.log('[3/6] Synchronizing `zoom_meetings` & `zoom_events`...');
    if (await db.schema.hasTable('zoom_meetings')) {
      const zmCols = await db('zoom_meetings').columnInfo();

      // Ensure host_zoom_user_id is nullable per migration 17
      await db.raw('ALTER TABLE `zoom_meetings` MODIFY `host_zoom_user_id` VARCHAR(64) NULL');

      await db.schema.alterTable('zoom_meetings', (table) => {
        if (!zmCols['host_email']) {
          table.string('host_email', 190).nullable();
          table.index(['host_email'], 'ix_zm_host_email');
          console.log('  + Added `zoom_meetings.host_email`');
        }
        if (!zmCols['host_name']) {
          table.string('host_name', 150).nullable();
          console.log('  + Added `zoom_meetings.host_name`');
        }
        if (!zmCols['account_id']) {
          table.string('account_id', 64).nullable();
          console.log('  + Added `zoom_meetings.account_id`');
        }
        if (!zmCols['concurrency_slot']) {
          table.specificType('concurrency_slot', 'TINYINT UNSIGNED').nullable();
          console.log('  + Added `zoom_meetings.concurrency_slot`');
        }
        if (!zmCols['last_webhook_event_at']) {
          table.specificType('last_webhook_event_at', 'DATETIME(3)').nullable();
          console.log('  + Added `zoom_meetings.last_webhook_event_at`');
        }
        if (!zmCols['webhook_verified_at']) {
          table.specificType('webhook_verified_at', 'DATETIME(3)').nullable();
          console.log('  + Added `zoom_meetings.webhook_verified_at`');
        }
        if (!zmCols['registration_required']) {
          table.tinyint('registration_required', 1).notNullable().defaultTo(0);
          console.log('  + Added `zoom_meetings.registration_required`');
        }
        if (!zmCols['provisioned_via']) {
          table.string('provisioned_via', 20).notNullable().defaultTo('MANUAL');
          console.log('  + Added `zoom_meetings.provisioned_via`');
        }
        if (!zmCols['api_verified_at']) {
          table.specificType('api_verified_at', 'DATETIME(3)').nullable();
          console.log('  + Added `zoom_meetings.api_verified_at`');
        }
        if (!zmCols['last_meeting_started_at']) {
          table.specificType('last_meeting_started_at', 'DATETIME(3)').nullable();
          console.log('  + Added `zoom_meetings.last_meeting_started_at`');
        }
      });

      // Safely ensure index ix_zm_host_user_id exists
      const [zmIdx] = await db.raw("SHOW INDEX FROM `zoom_meetings` WHERE Key_name = 'ix_zm_host_user_id'");
      if (zmIdx.length === 0) {
        await db.schema.alterTable('zoom_meetings', (table) => {
          table.index(['host_zoom_user_id'], 'ix_zm_host_user_id');
          console.log('  + Added index `ix_zm_host_user_id` on zoom_meetings');
        });
      }
    }

    if (await db.schema.hasTable('zoom_events')) {
      const zeCols = await db('zoom_events').columnInfo();
      await db.schema.alterTable('zoom_events', (table) => {
        if (!zeCols['account_id']) {
          table.string('account_id', 64).nullable();
          console.log('  + Added `zoom_events.account_id`');
        }
        if (!zeCols['signature_verified']) {
          table.tinyint('signature_verified', 1).notNullable().defaultTo(1);
          console.log('  + Added `zoom_events.signature_verified`');
        }
        if (!zeCols['meeting_uuid']) {
          table.string('meeting_uuid', 64).nullable();
          console.log('  + Added `zoom_events.meeting_uuid`');
        }
        if (!zeCols['error_message']) {
          table.string('error_message', 500).nullable();
          console.log('  + Added `zoom_events.error_message`');
        }
      });
    }

    // ------------------------------------------------------------------
    // 4. ZOOM_PARTICIPANT_LOG & TIMETABLE_LESSONS & LESSON_ATTENDANCE
    // ------------------------------------------------------------------
    console.log('[4/6] Synchronizing `zoom_participant_log` & `timetable_lessons`...');
    if (await db.schema.hasTable('zoom_participant_log')) {
      const zplCols = await db('zoom_participant_log').columnInfo();

      await db.raw('ALTER TABLE `zoom_participant_log` MODIFY `joined_at` DATETIME(3) NULL');
      await db.raw("ALTER TABLE `zoom_participant_log` MODIFY `source` ENUM('PORTAL','WEBHOOK','REPORT','REVIEW') NOT NULL");

      await db.schema.alterTable('zoom_participant_log', (table) => {
        if (!zplCols['zoom_user_id']) {
          table.string('zoom_user_id', 64).nullable();
          console.log('  + Added `zoom_participant_log.zoom_user_id`');
        }
        if (!zplCols['role']) {
          table.enu('role', ['TEACHER', 'STUDENT', 'CLASSROOM_HOST', 'UNKNOWN']).notNullable().defaultTo('UNKNOWN');
          console.log('  + Added `zoom_participant_log.role`');
        }
        if (!zplCols['verification_status']) {
          table.enu('verification_status', ['VERIFIED', 'UNVERIFIED', 'FLAGGED', 'REQUIRES_REVIEW', 'REJECTED']).notNullable().defaultTo('UNVERIFIED');
          console.log('  + Added `zoom_participant_log.verification_status`');
        }
        if (!zplCols['verification_reason']) {
          table.string('verification_reason', 255).nullable();
          console.log('  + Added `zoom_participant_log.verification_reason`');
        }
        if (!zplCols['duration_seconds']) {
          table.integer('duration_seconds').nullable();
          console.log('  + Added `zoom_participant_log.duration_seconds`');
        }
        if (!zplCols['meeting_uuid']) {
          table.string('meeting_uuid', 64).nullable();
          console.log('  + Added `zoom_participant_log.meeting_uuid`');
        }
        if (!zplCols['participant_uuid']) {
          table.string('participant_uuid', 64).nullable();
          console.log('  + Added `zoom_participant_log.participant_uuid`');
        }
        if (!zplCols['registrant_id']) {
          table.string('registrant_id', 64).nullable();
          console.log('  + Added `zoom_participant_log.registrant_id`');
        }
        if (!zplCols['identity_method']) {
          table.string('identity_method', 30).nullable();
          console.log('  + Added `zoom_participant_log.identity_method`');
        }
        if (!zplCols['reviewed_by']) {
          table.bigInteger('reviewed_by').unsigned().nullable();
          console.log('  + Added `zoom_participant_log.reviewed_by`');
        }
        if (!zplCols['reviewed_at']) {
          table.specificType('reviewed_at', 'DATETIME(3)').nullable();
          console.log('  + Added `zoom_participant_log.reviewed_at`');
        }
        if (!zplCols['review_note']) {
          table.string('review_note', 500).nullable();
          console.log('  + Added `zoom_participant_log.review_note`');
        }
      });

      // Indexes for zoom_participant_log
      const [zplIndexes] = await db.raw("SHOW INDEX FROM `zoom_participant_log`");
      const indexNames = zplIndexes.map(i => i.Key_name);
      await db.schema.alterTable('zoom_participant_log', (table) => {
        if (!indexNames.includes('ix_zpl_role_verif')) {
          table.index(['role', 'verification_status'], 'ix_zpl_role_verif');
        }
        if (!indexNames.includes('ix_zpl_zoom_uid')) {
          table.index(['zoom_user_id'], 'ix_zpl_zoom_uid');
        }
        if (!indexNames.includes('ix_zpl_instance_participant')) {
          table.index(['meeting_uuid', 'participant_uuid'], 'ix_zpl_instance_participant');
        }
        if (!indexNames.includes('ix_zpl_registrant')) {
          table.index(['registrant_id'], 'ix_zpl_registrant');
        }
      });
    }

    if (await db.schema.hasTable('timetable_lessons')) {
      const tlCols = await db('timetable_lessons').columnInfo();

      await db.schema.alterTable('timetable_lessons', (table) => {
        if (!tlCols['verified_duty_minutes']) {
          table.decimal('verified_duty_minutes', 8, 2).notNullable().defaultTo(0.00);
          console.log('  + Added `timetable_lessons.verified_duty_minutes`');
        }
        if (!tlCols['attendance_verification_status']) {
          table.enu('attendance_verification_status', ['VERIFIED', 'UNVERIFIED', 'FLAGGED', 'ABSENT', 'PENDING', 'REQUIRES_REVIEW']).notNullable().defaultTo('PENDING');
          console.log('  + Added `timetable_lessons.attendance_verification_status`');
        }
        if (!tlCols['verification_notes']) {
          table.string('verification_notes', 255).nullable();
          console.log('  + Added `timetable_lessons.verification_notes`');
        }
        if (!tlCols['reconciliation_status']) {
          table.enu('reconciliation_status', ['NOT_RECONCILED', 'RECONCILED', 'DISCREPANCY_FOUND', 'REPORT_UNAVAILABLE']).notNullable().defaultTo('NOT_RECONCILED');
          console.log('  + Added `timetable_lessons.reconciliation_status`');
        }
        if (!tlCols['reconciliation_notes']) {
          table.text('reconciliation_notes').nullable();
          console.log('  + Added `timetable_lessons.reconciliation_notes`');
        }
        if (!tlCols['reconciled_at']) {
          table.specificType('reconciled_at', 'DATETIME(3)').nullable();
          console.log('  + Added `timetable_lessons.reconciled_at`');
        }
        if (!tlCols['meeting_instance_uuid']) {
          table.string('meeting_instance_uuid', 64).nullable();
          console.log('  + Added `timetable_lessons.meeting_instance_uuid`');
        }
        if (!tlCols['period_occurrence_id']) {
          table.string('period_occurrence_id', 100).nullable();
          console.log('  + Added `timetable_lessons.period_occurrence_id`');
        }
      });

      // Indexes for timetable_lessons
      const [tlIndexes] = await db.raw("SHOW INDEX FROM `timetable_lessons`");
      const tlIdxNames = tlIndexes.map(i => i.Key_name);
      await db.schema.alterTable('timetable_lessons', (table) => {
        if (!tlIdxNames.includes('ix_tl_att_status')) {
          table.index(['attendance_verification_status'], 'ix_tl_att_status');
        }
        if (!tlIdxNames.includes('ix_tl_reconcile_status')) {
          table.index(['reconciliation_status'], 'ix_tl_reconcile_status');
        }
        if (!tlIdxNames.includes('ix_tl_period_occ')) {
          table.index(['period_occurrence_id'], 'ix_tl_period_occ');
        }
      });
    }

    if (await db.schema.hasTable('lesson_attendance')) {
      const laCols = await db('lesson_attendance').columnInfo();
      await db.schema.alterTable('lesson_attendance', (table) => {
        if (!laCols['source']) {
          table.enu('source', ['PORTAL', 'WEBHOOK', 'MANUAL', 'RECONCILIATION']).notNullable().defaultTo('MANUAL');
          console.log('  + Added `lesson_attendance.source`');
        }
        if (!laCols['verified_minutes']) {
          table.decimal('verified_minutes', 8, 2).notNullable().defaultTo(0.00);
          console.log('  + Added `lesson_attendance.verified_minutes`');
        }
        if (!laCols['first_joined_at']) {
          table.specificType('first_joined_at', 'DATETIME(3)').nullable();
          console.log('  + Added `lesson_attendance.first_joined_at`');
        }
        if (!laCols['last_left_at']) {
          table.specificType('last_left_at', 'DATETIME(3)').nullable();
          console.log('  + Added `lesson_attendance.last_left_at`');
        }
      });

      const [laIndexes] = await db.raw("SHOW INDEX FROM `lesson_attendance`");
      const laIdxNames = laIndexes.map(i => i.Key_name);
      if (!laIdxNames.includes('ix_la_source')) {
        await db.schema.alterTable('lesson_attendance', (table) => {
          table.index(['source'], 'ix_la_source');
        });
      }
    }

    // ------------------------------------------------------------------
    // 5. Create Missing Tables: zoom_registrants & teacher_duty_sessions
    // ------------------------------------------------------------------
    console.log('[5/6] Ensuring all required tables exist...');

    // 5a. zoom_registrants
    const hasZoomRegistrants = await db.schema.hasTable('zoom_registrants');
    if (!hasZoomRegistrants) {
      await db.schema.createTable('zoom_registrants', (table) => {
        table.bigIncrements('id').primary();
        table.bigInteger('zoom_meeting_row_id').unsigned().notNullable();
        table.bigInteger('user_id').unsigned().notNullable();
        table.enu('role', ['TEACHER', 'STUDENT']).notNullable();
        table.string('zoom_registrant_id', 64).notNullable();
        table.specificType('join_url_enc', 'VARBINARY(2048)').notNullable();
        table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(db.raw('CURRENT_TIMESTAMP(3)'));

        table.unique(['zoom_meeting_row_id', 'user_id'], 'uq_zreg_meeting_user');
        table.unique(['zoom_meeting_row_id', 'zoom_registrant_id'], 'uq_zreg_meeting_registrant');
        table.index(['zoom_registrant_id'], 'ix_zreg_registrant');
        table.foreign('zoom_meeting_row_id').references('id').inTable('zoom_meetings').onDelete('CASCADE');
        table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
      });
      console.log('  ✅ Created table: `zoom_registrants`');
    } else {
      console.log('  ✓ Table `zoom_registrants` already exists');
    }

    // 5b. teacher_duty_sessions
    const hasDutyTable = await db.schema.hasTable('teacher_duty_sessions');
    if (!hasDutyTable) {
      await db.schema.createTable('teacher_duty_sessions', (table) => {
        table.bigIncrements('id').primary();
        table.bigInteger('teacher_id').unsigned().notNullable();
        table.bigInteger('class_id').unsigned().notNullable();
        table.bigInteger('lesson_id').unsigned().notNullable();
        table.string('period_occurrence_id', 100).notNullable();
        table.string('zoom_meeting_id', 30).notNullable();
        table.string('meeting_instance_uuid', 64).nullable();
        table.specificType('session_start', 'DATETIME(3)').notNullable();
        table.specificType('session_end', 'DATETIME(3)').nullable();
        table.decimal('total_verified_minutes', 8, 2).notNullable().defaultTo(0.00);
        table.decimal('payable_minutes', 8, 2).notNullable().defaultTo(0.00);
        table
          .enu('session_status', [
            'IN_PROGRESS',
            'COMPLETED',
            'AWAITING_VERIFICATION',
            'REQUIRES_REVIEW',
            'FLAGGED',
            'MISSED',
            'CANCELLED'
          ])
          .notNullable()
          .defaultTo('IN_PROGRESS');
        table
          .enu('reconciliation_status', [
            'NOT_RECONCILED',
            'RECONCILED',
            'DISCREPANCY_FOUND',
            'REPORT_UNAVAILABLE'
          ])
          .notNullable()
          .defaultTo('NOT_RECONCILED');
        table.json('source_event_refs').nullable();
        table.text('audit_note').nullable();
        table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(db.raw('CURRENT_TIMESTAMP(3)'));
        table
          .specificType('updated_at', 'DATETIME(3)')
          .notNullable()
          .defaultTo(db.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

        table.unique(['teacher_id', 'lesson_id'], 'uq_duty_teacher_lesson');
        table.index(['lesson_id'], 'ix_tds_lesson');
        table.index(['teacher_id', 'session_start'], 'ix_tds_teacher_start');
        table.index(['class_id', 'session_start'], 'ix_tds_class_start');
        table.index(['session_status'], 'ix_tds_status');
        table.index(['period_occurrence_id'], 'ix_tds_period_occ');

        table.foreign('teacher_id').references('id').inTable('teachers').onDelete('CASCADE');
        table.foreign('class_id').references('id').inTable('classes').onDelete('CASCADE');
        table.foreign('lesson_id').references('id').inTable('timetable_lessons').onDelete('CASCADE');
      });
      console.log('  ✅ Created table: `teacher_duty_sessions`');
    } else {
      console.log('  ✓ Table `teacher_duty_sessions` already exists');
    }

    // ------------------------------------------------------------------
    // 6. Synchronize Knex Migration Registry
    // ------------------------------------------------------------------
    console.log('[6/6] Synchronizing Knex migration table...');
    const migrationsToRecord = [
      '20261026_15_add_student_personal_details.js',
      '20261028_16_class_based_zoom_hosting_and_duty.js',
      '20261028_17_zoom_identity_review_and_registrants.js',
      '20261028_18_teacher_duty_ledger_and_student_attendance.js'
    ];

    const currentMigrations = await db('knex_migrations').select('name');
    const existingNames = new Set(currentMigrations.map(m => m.name));

    const maxBatchRow = await db('knex_migrations').max('batch as maxBatch').first();
    const nextBatch = (maxBatchRow?.maxBatch || 0) + 1;

    for (const name of migrationsToRecord) {
      if (!existingNames.has(name)) {
        await db('knex_migrations').insert({
          name,
          batch: nextBatch,
          migration_time: new Date()
        });
        console.log(`  + Recorded migration completion: ${name}`);
      } else {
        console.log(`  ✓ Migration already recorded: ${name}`);
      }
    }

    console.log('\n=====================================================');
    console.log('✅ All missing tables and columns successfully synced!');
    console.log('✅ Database schema is now 100% complete and consistent!');
    console.log('=====================================================\n');
  } catch (error) {
    console.error('\n❌ Database sync failed:', error);
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}

syncDatabase();

