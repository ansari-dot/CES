/**
 * Migration 42: Montessori Management
 *
 * Montessori sections live in their own table because `classes` is constrained to
 * grades 1–8. Students, teachers, parents and academic sessions are the existing CES
 * records (no duplicate accounts).
 *
 *  - montessori_sections               KG sections per academic session (names are data, not code)
 *  - montessori_learning_areas         configurable learning areas (seeded with common areas)
 *  - montessori_teacher_assignments    class teacher / assistant assignments with history
 *  - montessori_student_allocations    student ↔ section allocations with history (one active per student)
 *  - montessori_attendance             daily attendance (one row per student per date)
 *  - montessori_attendance_history     corrections audit
 *  - montessori_activities             daily learning activities
 *  - montessori_progress_records       development observations per student & activity (append-only)
 *  - montessori_progress_history       corrections audit
 *
 * "Only one active …" rules use virtual generated columns that are NULL for inactive rows,
 * with UNIQUE indexes on them (MySQL has no partial indexes).
 * Idempotent; nothing existing is modified. History tables RESTRICT deletes to preserve records.
 *
 * @param { import("knex").Knex } knex
 */

const LEARNING_AREAS = [
  ['English', 'Alphabet recognition, letter writing, vocabulary and basic words.'],
  ['Urdu', 'Urdu alphabet recognition, letter writing and basic words.'],
  ['Mathematics', 'Number recognition, counting, shapes and basic addition.'],
  ['General Knowledge', 'Animals, birds, fruits, vegetables, body parts and colours.'],
  ['Creative Activities', 'Drawing, colouring, painting and paper craft.'],
  ['Rhymes & Storytelling', 'Rhymes, poems and storytelling.'],
  ['Practical Life', 'Practical life and self-care activities.'],
  ['Social Skills', 'Group activities, sharing and social skills.'],
  ['Other', 'Any other learning activity.']
];

export async function up(knex) {
  const created = (t) => t.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
  const updated = (t) =>
    t.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

  if (!(await knex.schema.hasTable('montessori_sections'))) {
    await knex.schema.createTable('montessori_sections', (t) => {
      t.bigIncrements('id').primary();
      t.bigInteger('session_id').unsigned().notNullable();
      t.string('name', 100).notNullable();
      t.string('description', 500).nullable();
      t.integer('display_order').notNullable().defaultTo(0);
      t.boolean('is_active').notNullable().defaultTo(true);
      t.specificType('active_name', 'VARCHAR(100) GENERATED ALWAYS AS (IF(`is_active` = 1, LOWER(`name`), NULL)) VIRTUAL');
      t.bigInteger('created_by').unsigned().nullable();
      t.bigInteger('updated_by').unsigned().nullable();
      created(t);
      updated(t);
      t.unique(['session_id', 'active_name'], 'uq_mont_section_active_name');
      t.index(['session_id', 'is_active', 'display_order'], 'ix_mont_section_session');
      t.foreign('session_id').references('id').inTable('academic_sessions').onDelete('RESTRICT');
      t.foreign('created_by').references('id').inTable('users').onDelete('SET NULL');
      t.foreign('updated_by').references('id').inTable('users').onDelete('SET NULL');
    });
  }

  if (!(await knex.schema.hasTable('montessori_learning_areas'))) {
    await knex.schema.createTable('montessori_learning_areas', (t) => {
      t.bigIncrements('id').primary();
      t.string('name', 100).notNullable();
      t.string('description', 300).nullable();
      t.integer('display_order').notNullable().defaultTo(0);
      t.boolean('is_active').notNullable().defaultTo(true);
      created(t);
      updated(t);
      t.unique(['name'], 'uq_mont_area_name');
    });
  }

  if (!(await knex.schema.hasTable('montessori_teacher_assignments'))) {
    await knex.schema.createTable('montessori_teacher_assignments', (t) => {
      t.bigIncrements('id').primary();
      t.bigInteger('section_id').unsigned().notNullable();
      t.bigInteger('teacher_id').unsigned().notNullable();
      t.enu('role', ['CLASS_TEACHER', 'ASSISTANT']).notNullable().defaultTo('CLASS_TEACHER');
      t.date('start_date').notNullable();
      t.date('end_date').nullable();
      t.specificType('ended_at', 'DATETIME(3)').nullable();
      t.string('end_reason', 300).nullable();
      t.bigInteger('assigned_by').unsigned().nullable();
      t.bigInteger('ended_by').unsigned().nullable();
      t.specificType(
        'active_class_teacher_section',
        "BIGINT UNSIGNED GENERATED ALWAYS AS (IF(`ended_at` IS NULL AND `role` = 'CLASS_TEACHER', `section_id`, NULL)) VIRTUAL"
      );
      t.specificType(
        'active_teacher_key',
        "VARCHAR(50) GENERATED ALWAYS AS (IF(`ended_at` IS NULL, CONCAT(`section_id`, '-', `teacher_id`), NULL)) VIRTUAL"
      );
      created(t);
      t.unique(['active_class_teacher_section'], 'uq_mont_assign_one_class_teacher');
      t.unique(['active_teacher_key'], 'uq_mont_assign_teacher_section');
      t.index(['teacher_id', 'ended_at'], 'ix_mont_assign_teacher');
      t.index(['section_id', 'ended_at'], 'ix_mont_assign_section');
      t.foreign('section_id').references('id').inTable('montessori_sections').onDelete('RESTRICT');
      t.foreign('teacher_id').references('id').inTable('teachers').onDelete('RESTRICT');
      t.foreign('assigned_by').references('id').inTable('users').onDelete('SET NULL');
      t.foreign('ended_by').references('id').inTable('users').onDelete('SET NULL');
    });
  }

  if (!(await knex.schema.hasTable('montessori_student_allocations'))) {
    await knex.schema.createTable('montessori_student_allocations', (t) => {
      t.bigIncrements('id').primary();
      t.bigInteger('student_id').unsigned().notNullable();
      t.bigInteger('section_id').unsigned().notNullable();
      t.bigInteger('session_id').unsigned().notNullable();
      t.date('start_date').notNullable();
      t.date('end_date').nullable();
      t.specificType('ended_at', 'DATETIME(3)').nullable();
      t.enu('end_reason', ['TRANSFERRED', 'REMOVED']).nullable();
      t.string('notes', 300).nullable();
      t.bigInteger('allocated_by').unsigned().nullable();
      t.bigInteger('ended_by').unsigned().nullable();
      t.specificType('active_student', 'BIGINT UNSIGNED GENERATED ALWAYS AS (IF(`ended_at` IS NULL, `student_id`, NULL)) VIRTUAL');
      created(t);
      t.unique(['active_student'], 'uq_mont_alloc_one_active');
      t.index(['section_id', 'ended_at'], 'ix_mont_alloc_section');
      t.index(['student_id'], 'ix_mont_alloc_student');
      t.foreign('student_id').references('id').inTable('students').onDelete('RESTRICT');
      t.foreign('section_id').references('id').inTable('montessori_sections').onDelete('RESTRICT');
      t.foreign('session_id').references('id').inTable('academic_sessions').onDelete('RESTRICT');
      t.foreign('allocated_by').references('id').inTable('users').onDelete('SET NULL');
      t.foreign('ended_by').references('id').inTable('users').onDelete('SET NULL');
    });
  }

  if (!(await knex.schema.hasTable('montessori_attendance'))) {
    await knex.schema.createTable('montessori_attendance', (t) => {
      t.bigIncrements('id').primary();
      t.bigInteger('section_id').unsigned().notNullable();
      t.bigInteger('student_id').unsigned().notNullable();
      t.bigInteger('session_id').unsigned().notNullable();
      t.date('attendance_date').notNullable();
      t.enu('status', ['PRESENT', 'ABSENT', 'LATE', 'LEAVE']).notNullable();
      t.string('remarks', 255).nullable();
      t.bigInteger('marked_by').unsigned().nullable();
      t.bigInteger('updated_by').unsigned().nullable();
      created(t);
      updated(t);
      t.unique(['student_id', 'attendance_date'], 'uq_mont_att_student_date');
      t.index(['section_id', 'attendance_date'], 'ix_mont_att_section_date');
      t.foreign('section_id').references('id').inTable('montessori_sections').onDelete('RESTRICT');
      t.foreign('student_id').references('id').inTable('students').onDelete('RESTRICT');
      t.foreign('session_id').references('id').inTable('academic_sessions').onDelete('RESTRICT');
      t.foreign('marked_by').references('id').inTable('users').onDelete('SET NULL');
      t.foreign('updated_by').references('id').inTable('users').onDelete('SET NULL');
    });
  }

  if (!(await knex.schema.hasTable('montessori_attendance_history'))) {
    await knex.schema.createTable('montessori_attendance_history', (t) => {
      t.bigIncrements('id').primary();
      t.bigInteger('attendance_id').unsigned().notNullable();
      t.string('previous_status', 10).notNullable();
      t.string('new_status', 10).notNullable();
      t.string('previous_remarks', 255).nullable();
      t.string('new_remarks', 255).nullable();
      t.string('reason', 300).nullable();
      t.bigInteger('changed_by').unsigned().nullable();
      created(t);
      t.index(['attendance_id'], 'ix_mont_att_hist_att');
      t.foreign('attendance_id').references('id').inTable('montessori_attendance').onDelete('RESTRICT');
      t.foreign('changed_by').references('id').inTable('users').onDelete('SET NULL');
    });
  }

  if (!(await knex.schema.hasTable('montessori_activities'))) {
    await knex.schema.createTable('montessori_activities', (t) => {
      t.bigIncrements('id').primary();
      t.bigInteger('section_id').unsigned().notNullable();
      t.bigInteger('session_id').unsigned().notNullable();
      t.bigInteger('learning_area_id').unsigned().notNullable();
      t.string('title', 150).notNullable();
      t.text('description').nullable();
      t.text('objectives').nullable();
      t.date('activity_date').notNullable();
      t.string('attachment_url', 500).nullable();
      t.string('attachment_name', 255).nullable();
      t.enu('status', ['ACTIVE', 'ARCHIVED']).notNullable().defaultTo('ACTIVE');
      t.bigInteger('teacher_id').unsigned().nullable();
      t.bigInteger('created_by').unsigned().nullable();
      t.bigInteger('updated_by').unsigned().nullable();
      created(t);
      updated(t);
      t.index(['section_id', 'activity_date'], 'ix_mont_activity_section_date');
      t.index(['learning_area_id'], 'ix_mont_activity_area');
      t.foreign('section_id').references('id').inTable('montessori_sections').onDelete('RESTRICT');
      t.foreign('session_id').references('id').inTable('academic_sessions').onDelete('RESTRICT');
      t.foreign('learning_area_id').references('id').inTable('montessori_learning_areas').onDelete('RESTRICT');
      t.foreign('teacher_id').references('id').inTable('teachers').onDelete('SET NULL');
      t.foreign('created_by').references('id').inTable('users').onDelete('SET NULL');
      t.foreign('updated_by').references('id').inTable('users').onDelete('SET NULL');
    });
  }

  if (!(await knex.schema.hasTable('montessori_progress_records'))) {
    await knex.schema.createTable('montessori_progress_records', (t) => {
      t.bigIncrements('id').primary();
      t.bigInteger('student_id').unsigned().notNullable();
      t.bigInteger('section_id').unsigned().notNullable();
      t.bigInteger('activity_id').unsigned().notNullable();
      t.bigInteger('session_id').unsigned().notNullable();
      t.bigInteger('teacher_id').unsigned().nullable();
      t.enu('status', ['EXCELLENT', 'COMPLETED', 'IMPROVING', 'NEEDS_PRACTICE', 'NOT_STARTED']).notNullable();
      t.string('remarks', 1000).nullable();
      t.string('improvement_suggestions', 1000).nullable();
      t.string('observation_notes', 1000).nullable();
      t.date('completion_date').nullable();
      t.date('observed_on').notNullable();
      t.bigInteger('recorded_by').unsigned().nullable();
      t.bigInteger('updated_by').unsigned().nullable();
      created(t);
      updated(t);
      t.index(['student_id', 'observed_on'], 'ix_mont_progress_student');
      t.index(['activity_id'], 'ix_mont_progress_activity');
      t.index(['section_id', 'observed_on'], 'ix_mont_progress_section');
      t.foreign('student_id').references('id').inTable('students').onDelete('RESTRICT');
      t.foreign('section_id').references('id').inTable('montessori_sections').onDelete('RESTRICT');
      t.foreign('activity_id').references('id').inTable('montessori_activities').onDelete('RESTRICT');
      t.foreign('session_id').references('id').inTable('academic_sessions').onDelete('RESTRICT');
      t.foreign('teacher_id').references('id').inTable('teachers').onDelete('SET NULL');
      t.foreign('recorded_by').references('id').inTable('users').onDelete('SET NULL');
      t.foreign('updated_by').references('id').inTable('users').onDelete('SET NULL');
    });
  }

  if (!(await knex.schema.hasTable('montessori_progress_history'))) {
    await knex.schema.createTable('montessori_progress_history', (t) => {
      t.bigIncrements('id').primary();
      t.bigInteger('progress_id').unsigned().notNullable();
      t.json('previous_values').notNullable();
      t.string('reason', 300).notNullable();
      t.bigInteger('changed_by').unsigned().nullable();
      created(t);
      t.index(['progress_id'], 'ix_mont_progress_hist');
      t.foreign('progress_id').references('id').inTable('montessori_progress_records').onDelete('RESTRICT');
      t.foreign('changed_by').references('id').inTable('users').onDelete('SET NULL');
    });
  }

  // Seed learning areas only when missing (matched case-insensitively)
  const existing = new Set((await knex('montessori_learning_areas').pluck('name')).map((n) => String(n).toLowerCase()));
  let order = 10;
  for (const [name, description] of LEARNING_AREAS) {
    if (!existing.has(name.toLowerCase())) {
      await knex('montessori_learning_areas').insert({ name, description, display_order: order });
    }
    order += 10;
  }
}

/** Development rollback only: drops the Montessori tables and their records. */
export async function down(knex) {
  for (const table of [
    'montessori_progress_history',
    'montessori_progress_records',
    'montessori_activities',
    'montessori_attendance_history',
    'montessori_attendance',
    'montessori_student_allocations',
    'montessori_teacher_assignments',
    'montessori_learning_areas',
    'montessori_sections'
  ]) {
    await knex.schema.dropTableIfExists(table);
  }
}
