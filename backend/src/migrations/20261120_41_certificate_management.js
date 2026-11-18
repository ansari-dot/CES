/**
 * Migration 41: Certificate Management
 *
 * Certificates are separate from badges (student_achievements is untouched):
 *  - certificate_categories   configurable categories (15 seeded if absent)
 *  - certificate_templates    reusable designs rendered to PDF (one starter template per category)
 *  - certificate_batches      one row per issuance request (idempotency / retry protection)
 *  - student_certificates     one row + one stored PDF per student per issuance
 *  - certificate_events       issuance / revocation / template & category audit history
 *
 * Idempotent: every table and seed row is created only when missing. No existing data is modified.
 * Students are never hard-deleted in CES, so certificates RESTRICT student/template deletion to
 * preserve historical records.
 *
 * @param { import("knex").Knex } knex
 */

const CATEGORIES = [
  ['Academic Excellence', 'Outstanding overall academic results.'],
  ['Best Student', 'Recognition as the best all-round student.'],
  ['Best Performance', 'Best performance in an assessment, term or event.'],
  ['Subject Excellence', 'Excellence in a specific subject.'],
  ['Attendance Excellence', 'Exemplary attendance and punctuality.'],
  ['Sports Achievement', 'Achievement in sports and physical education.'],
  ['Art & Creativity', 'Creativity in art, craft, writing or performance.'],
  ['Leadership Award', 'Demonstrated leadership and responsibility.'],
  ['Discipline Award', 'Exemplary discipline and conduct.'],
  ['Participation Certificate', 'Participation in a school activity or event.'],
  ['Competition Achievement', 'Position or achievement in a competition.'],
  ['Appreciation Certificate', 'Appreciation for effort or contribution.'],
  ['Character & Behavior', 'Outstanding character and behaviour.'],
  ['Special Achievement', 'A special or notable achievement.'],
  ['Other / Custom Certificate', 'Any other recognition.']
];

// [category, template name, certificate title, design preset, primary colour, accent colour, body text]
const STARTER_TEMPLATES = {
  'Academic Excellence': ['Certificate of Academic Excellence', 'CLASSIC', '#1b1a47', '#c9a227'],
  'Best Student': ['Best Student Award', 'ELEGANT', '#1b1a47', '#c9a227'],
  'Best Performance': ['Certificate of Best Performance', 'MODERN', '#36348e', '#ffc53a'],
  'Subject Excellence': ['Certificate of Subject Excellence', 'CLASSIC', '#14532d', '#c9a227'],
  'Attendance Excellence': ['Certificate of Perfect Attendance', 'MODERN', '#0c4a6e', '#38bdf8'],
  'Sports Achievement': ['Certificate of Sports Achievement', 'MODERN', '#7c2d12', '#f59e0b'],
  'Art & Creativity': ['Certificate of Art & Creativity', 'ELEGANT', '#701a75', '#f0abfc'],
  'Leadership Award': ['Leadership Award', 'CLASSIC', '#1b1a47', '#c9a227'],
  'Discipline Award': ['Certificate of Discipline', 'CLASSIC', '#1e3a8a', '#93c5fd'],
  'Participation Certificate': ['Certificate of Participation', 'MODERN', '#36348e', '#ffc53a'],
  'Competition Achievement': ['Certificate of Achievement', 'ELEGANT', '#7f1d1d', '#c9a227'],
  'Appreciation Certificate': ['Certificate of Appreciation', 'ELEGANT', '#1b1a47', '#ffc53a'],
  'Character & Behavior': ['Certificate of Good Character', 'CLASSIC', '#064e3b', '#6ee7b7'],
  'Special Achievement': ['Certificate of Special Achievement', 'ELEGANT', '#1b1a47', '#c9a227'],
  'Other / Custom Certificate': ['Certificate of Recognition', 'MODERN', '#36348e', '#ffc53a']
};

const STARTER_BODY =
  'This certificate is proudly presented to {{student_name}} of {{class_name}} in recognition of ' +
  '{{achievement_title}}. {{achievement_description}}';

export async function up(knex) {
  const ts = (t) => {
    t.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
    t.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));
  };

  if (!(await knex.schema.hasTable('certificate_categories'))) {
    await knex.schema.createTable('certificate_categories', (t) => {
      t.bigIncrements('id').primary();
      t.string('name', 100).notNullable();
      t.string('description', 500).nullable();
      t.integer('sort_order').notNullable().defaultTo(0);
      t.boolean('is_active').notNullable().defaultTo(true);
      t.bigInteger('created_by').unsigned().nullable();
      ts(t);
      t.unique(['name'], 'uq_cert_category_name');
      t.index(['is_active', 'sort_order'], 'ix_cert_category_active');
      t.foreign('created_by').references('id').inTable('users').onDelete('SET NULL');
    });
  }

  if (!(await knex.schema.hasTable('certificate_templates'))) {
    await knex.schema.createTable('certificate_templates', (t) => {
      t.bigIncrements('id').primary();
      t.bigInteger('category_id').unsigned().notNullable();
      t.string('name', 150).notNullable();
      t.string('certificate_title', 150).notNullable();
      t.string('description', 500).nullable();
      t.enu('design_preset', ['CLASSIC', 'MODERN', 'ELEGANT']).notNullable().defaultTo('CLASSIC');
      t.enu('orientation', ['LANDSCAPE', 'PORTRAIT']).notNullable().defaultTo('LANDSCAPE');
      t.enu('page_size', ['A4', 'LETTER']).notNullable().defaultTo('A4');
      t.string('primary_color', 7).notNullable().defaultTo('#1b1a47');
      t.string('accent_color', 7).notNullable().defaultTo('#c9a227');
      t.text('body_text').notNullable();
      t.boolean('show_teacher_signature').notNullable().defaultTo(true);
      t.boolean('show_principal_signature').notNullable().defaultTo(true);
      t.string('principal_name', 150).nullable();
      // Private uploaded assets (storage keys are never returned to clients)
      t.string('background_storage_key', 255).nullable();
      t.string('logo_storage_key', 255).nullable();
      t.string('principal_signature_storage_key', 255).nullable();
      t.enu('status', ['ACTIVE', 'INACTIVE', 'ARCHIVED']).notNullable().defaultTo('ACTIVE');
      t.integer('version').unsigned().notNullable().defaultTo(1);
      t.bigInteger('created_by').unsigned().nullable();
      t.bigInteger('updated_by').unsigned().nullable();
      ts(t);
      t.index(['category_id', 'status'], 'ix_cert_template_category_status');
      t.foreign('category_id').references('id').inTable('certificate_categories').onDelete('RESTRICT');
      t.foreign('created_by').references('id').inTable('users').onDelete('SET NULL');
      t.foreign('updated_by').references('id').inTable('users').onDelete('SET NULL');
    });
  }

  if (!(await knex.schema.hasTable('certificate_batches'))) {
    await knex.schema.createTable('certificate_batches', (t) => {
      t.bigIncrements('id').primary();
      t.bigInteger('issued_by_user_id').unsigned().notNullable();
      t.string('idempotency_key', 64).notNullable();
      t.string('request_fingerprint', 64).notNullable();
      t.bigInteger('template_id').unsigned().notNullable();
      t.bigInteger('class_id').unsigned().notNullable();
      t.integer('recipient_count').unsigned().notNullable().defaultTo(0);
      t.enu('status', ['PROCESSING', 'COMPLETED', 'FAILED']).notNullable().defaultTo('PROCESSING');
      t.string('error_message', 500).nullable();
      t.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
      t.specificType('completed_at', 'DATETIME(3)').nullable();
      t.unique(['issued_by_user_id', 'idempotency_key'], 'uq_cert_batch_idempotency');
      t.foreign('issued_by_user_id').references('id').inTable('users').onDelete('RESTRICT');
      t.foreign('template_id').references('id').inTable('certificate_templates').onDelete('RESTRICT');
      t.foreign('class_id').references('id').inTable('classes').onDelete('RESTRICT');
    });
  }

  if (!(await knex.schema.hasTable('student_certificates'))) {
    await knex.schema.createTable('student_certificates', (t) => {
      t.bigIncrements('id').primary();
      t.string('certificate_number', 40).notNullable();
      t.bigInteger('batch_id').unsigned().notNullable();
      t.bigInteger('template_id').unsigned().notNullable();
      t.bigInteger('category_id').unsigned().notNullable();
      t.bigInteger('student_id').unsigned().notNullable();
      t.bigInteger('class_id').unsigned().notNullable();
      t.bigInteger('subject_id').unsigned().nullable();
      t.bigInteger('session_id').unsigned().nullable();
      t.bigInteger('teacher_id').unsigned().nullable();
      t.bigInteger('issued_by_user_id').unsigned().notNullable();
      // Snapshots: what was printed at issue time (records stay correct if names change later)
      t.string('student_name', 150).notNullable();
      t.string('class_name', 60).notNullable();
      t.string('issuer_name', 150).notNullable();
      t.string('subject_name', 100).nullable();
      t.string('academic_year', 30).nullable();
      t.string('certificate_title', 150).notNullable();
      t.string('achievement_title', 150).notNullable();
      t.string('achievement_description', 600).nullable();
      t.string('remarks', 300).nullable();
      t.date('issue_date').notNullable();
      t.integer('template_version').unsigned().notNullable();
      t.json('template_snapshot').notNullable();
      // Stored PDF (private storage key, never exposed)
      t.string('pdf_storage_key', 255).notNullable();
      t.integer('pdf_size_bytes').unsigned().notNullable();
      t.string('pdf_sha256', 64).notNullable();
      t.enu('status', ['ACTIVE', 'REVOKED']).notNullable().defaultTo('ACTIVE');
      t.specificType('revoked_at', 'DATETIME(3)').nullable();
      t.bigInteger('revoked_by').unsigned().nullable();
      t.string('revoke_reason', 500).nullable();
      t.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));

      t.unique(['certificate_number'], 'uq_student_certificate_number');
      t.unique(['batch_id', 'student_id'], 'uq_student_certificate_batch_student');
      t.index(['student_id', 'status'], 'ix_student_cert_student');
      t.index(['teacher_id', 'issue_date'], 'ix_student_cert_teacher');
      t.index(['class_id'], 'ix_student_cert_class');
      t.index(['category_id'], 'ix_student_cert_category');
      t.index(['issue_date'], 'ix_student_cert_issue_date');
      t.foreign('batch_id').references('id').inTable('certificate_batches').onDelete('RESTRICT');
      t.foreign('template_id').references('id').inTable('certificate_templates').onDelete('RESTRICT');
      t.foreign('category_id').references('id').inTable('certificate_categories').onDelete('RESTRICT');
      t.foreign('student_id').references('id').inTable('students').onDelete('RESTRICT');
      t.foreign('class_id').references('id').inTable('classes').onDelete('RESTRICT');
      t.foreign('subject_id').references('id').inTable('subjects').onDelete('SET NULL');
      t.foreign('session_id').references('id').inTable('academic_sessions').onDelete('SET NULL');
      t.foreign('teacher_id').references('id').inTable('teachers').onDelete('SET NULL');
      t.foreign('issued_by_user_id').references('id').inTable('users').onDelete('RESTRICT');
      t.foreign('revoked_by').references('id').inTable('users').onDelete('SET NULL');
    });
  }

  if (!(await knex.schema.hasTable('certificate_events'))) {
    await knex.schema.createTable('certificate_events', (t) => {
      t.bigIncrements('id').primary();
      t.string('action', 50).notNullable(); // ISSUED | REVOKED | TEMPLATE_CREATED | TEMPLATE_UPDATED | TEMPLATE_STATUS | CATEGORY_CREATED | CATEGORY_UPDATED
      t.bigInteger('certificate_id').unsigned().nullable();
      t.bigInteger('batch_id').unsigned().nullable();
      t.bigInteger('template_id').unsigned().nullable();
      t.bigInteger('category_id').unsigned().nullable();
      t.bigInteger('actor_user_id').unsigned().nullable();
      t.string('actor_name', 150).nullable();
      t.string('actor_role', 30).nullable();
      t.string('reason', 500).nullable();
      t.json('details').nullable();
      t.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
      t.index(['certificate_id'], 'ix_cert_event_certificate');
      t.index(['template_id'], 'ix_cert_event_template');
      t.index(['created_at'], 'ix_cert_event_time');
      t.foreign('certificate_id').references('id').inTable('student_certificates').onDelete('RESTRICT');
      t.foreign('batch_id').references('id').inTable('certificate_batches').onDelete('RESTRICT');
      t.foreign('template_id').references('id').inTable('certificate_templates').onDelete('SET NULL');
      t.foreign('category_id').references('id').inTable('certificate_categories').onDelete('SET NULL');
      t.foreign('actor_user_id').references('id').inTable('users').onDelete('SET NULL');
    });
  }

  // ---- Seed categories that do not exist yet (matched case-insensitively by name)
  const existing = new Set((await knex('certificate_categories').pluck('name')).map((n) => String(n).toLowerCase()));
  let order = 10;
  for (const [name, description] of CATEGORIES) {
    if (!existing.has(name.toLowerCase())) {
      await knex('certificate_categories').insert({ name, description, sort_order: order, is_active: true });
    }
    order += 10;
  }

  // ---- One starter template for each seeded category that has no template yet
  for (const [categoryName, [title, preset, primary, accent]] of Object.entries(STARTER_TEMPLATES)) {
    const category = await knex('certificate_categories').whereRaw('LOWER(name) = ?', [categoryName.toLowerCase()]).first();
    if (!category) continue;
    const hasTemplate = await knex('certificate_templates').where({ category_id: category.id }).first();
    if (hasTemplate) continue;
    await knex('certificate_templates').insert({
      category_id: category.id,
      name: `${title} (Standard)`,
      certificate_title: title,
      description: `Standard ${categoryName.toLowerCase()} certificate.`,
      design_preset: preset,
      orientation: 'LANDSCAPE',
      page_size: 'A4',
      primary_color: primary,
      accent_color: accent,
      body_text: STARTER_BODY,
      show_teacher_signature: true,
      show_principal_signature: true,
      status: 'ACTIVE',
      version: 1
    });
  }
}

/**
 * Rollback drops the certificate tables. Issued certificates are historical records:
 * only roll back in development (PDF files in uploads/certificates are not removed).
 * @param { import("knex").Knex } knex
 */
export async function down(knex) {
  await knex.schema.dropTableIfExists('certificate_events');
  await knex.schema.dropTableIfExists('student_certificates');
  await knex.schema.dropTableIfExists('certificate_batches');
  await knex.schema.dropTableIfExists('certificate_templates');
  await knex.schema.dropTableIfExists('certificate_categories');
}
