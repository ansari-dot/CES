/**
 * Migration 13: Fee restriction lifecycle tracking
 *
 * One row per (student, overdue challan) that caused – or was covered by – a
 * portal restriction. Once a row is resolved (Principal manual restore or the
 * invoice being settled) the scheduler never re-restricts for that challan,
 * so a Principal's restore is not undone on the next scheduler run. A new
 * month's overdue challan has no row yet and is evaluated afresh.
 *
 * Also:
 *  - adds the `fees.access.restore` permission (granted to PRINCIPAL; ADMIN bypasses checks)
 *  - makes account_status_history.changed_by nullable so automated (system)
 *    status changes are not attributed to a person
 */
export async function up(knex) {
  await knex.schema.createTable('fee_restriction_events', (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('student_id').unsigned().notNullable();
    table.bigInteger('user_id').unsigned().notNullable(); // student's user account
    table.bigInteger('challan_id').unsigned().notNullable();
    table.bigInteger('session_id').unsigned().notNullable();
    table.string('billing_month', 20).notNullable(); // copied from the challan for display
    table.string('reason', 255).notNullable();
    table.specificType('restricted_at', 'DATETIME(3)').notNullable();
    // NULL = restriction still open
    table.specificType('resolved_at', 'DATETIME(3)').nullable();
    table.bigInteger('resolved_by').unsigned().nullable(); // Principal user id; NULL when system-resolved
    table.enu('resolution', ['PRINCIPAL_MANUAL_RESTORE', 'INVOICE_SETTLED']).nullable();
    table.string('resolve_reason', 255).nullable();

    table.unique(['student_id', 'challan_id'], 'uq_fre_student_challan');
    table.index(['resolved_at'], 'ix_fre_resolved');
    table.foreign('student_id').references('id').inTable('students').onDelete('CASCADE');
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('challan_id').references('id').inTable('fee_challans').onDelete('CASCADE');
    table.foreign('resolved_by').references('id').inTable('users').onDelete('SET NULL');
  });

  await knex.raw('ALTER TABLE account_status_history MODIFY changed_by BIGINT UNSIGNED NULL');

  // Pinned to id 20 to match seeds/01 (which checks existence by id). On a fresh
  // install this runs before the seeds; the seed then maps it to PRINCIPAL.
  const permissionId = 20;
  const existing = await knex('permissions').where({ code: 'fees.access.restore' }).first();
  if (!existing) {
    await knex('permissions').insert({
      id: permissionId,
      code: 'fees.access.restore',
      description: 'Restore student portal access restricted for overdue fees'
    });
  } else if (existing.id !== permissionId) {
    throw new Error(`fees.access.restore exists with unexpected id ${existing.id}`);
  }
  const principalRole = await knex('roles').where({ code: 'PRINCIPAL' }).first();
  if (principalRole) {
    const mapped = await knex('role_permissions')
      .where({ role_id: principalRole.id, permission_id: permissionId })
      .first();
    if (!mapped) {
      await knex('role_permissions').insert({ role_id: principalRole.id, permission_id: permissionId });
    }
  }
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('fee_restriction_events');
  const perm = await knex('permissions').where({ code: 'fees.access.restore' }).first();
  if (perm) {
    await knex('role_permissions').where({ permission_id: perm.id }).del();
    await knex('permissions').where({ id: perm.id }).del();
  }
  // changed_by is left nullable: system-authored rows may exist and cannot be re-attributed.
}
