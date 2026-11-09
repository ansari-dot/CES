/**
 * Migration 27: Principal-approved password reset requests (OTP based)
 *
 * Flow: a teacher/student/parent submits a reset request from the login
 * screen → the Principal approves it → a single-use, hashed, 15-minute OTP
 * is emailed → the user sets a new password with email + OTP.
 */
export async function up(knex) {
  if (!(await knex.schema.hasTable('password_reset_requests'))) {
    await knex.schema.createTable('password_reset_requests', (table) => {
      table.bigIncrements('id').primary();
      table.bigInteger('user_id').unsigned().notNullable();
      table.string('role_code', 20).notNullable();
      table.string('email', 190).notNullable();
      table
        .enu('status', ['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'EXPIRED'])
        .notNullable()
        .defaultTo('PENDING');
      // Argon2 hash of the 6-digit OTP; never stored or logged in plain text
      table.string('otp_hash', 255).nullable();
      table.specificType('otp_expires_at', 'DATETIME(3)').nullable();
      table.tinyint('attempt_count').unsigned().notNullable().defaultTo(0);
      table.bigInteger('reviewed_by').unsigned().nullable();
      table.specificType('reviewed_at', 'DATETIME(3)').nullable();
      table.specificType('completed_at', 'DATETIME(3)').nullable();
      table.specificType('created_at', 'DATETIME(3)').defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
      table
        .specificType('updated_at', 'DATETIME(3)')
        .defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

      table.index(['status'], 'ix_prr_status');
      table.index(['user_id', 'status'], 'ix_prr_user_status');
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.foreign('reviewed_by').references('id').inTable('users').onDelete('SET NULL');
    });
  }
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('password_reset_requests');
}
