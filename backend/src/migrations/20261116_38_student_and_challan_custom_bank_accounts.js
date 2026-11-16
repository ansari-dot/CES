/**
 * Migration: Student-Specific Custom Bank Account & Fee Challan Assignment
 * Supports custom bank accounts for students/challans with default account preservation.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
  // 1. Create school_bank_accounts table if not exists
  const hasBankAccountsTable = await knex.schema.hasTable('school_bank_accounts');
  if (!hasBankAccountsTable) {
    await knex.schema.createTable('school_bank_accounts', (table) => {
      table.bigIncrements('id').primary();
      table.string('bank_name', 100).notNullable();
      table.string('branch_name', 150).nullable();
      table.string('account_title', 150).notNullable();
      table.string('account_number', 50).notNullable();
      table.string('iban', 50).nullable();
      table.boolean('is_default').notNullable().defaultTo(false);
      table.enu('status', ['ACTIVE', 'ARCHIVED']).notNullable().defaultTo('ACTIVE');
      table.string('instructions', 500).nullable();
      table.specificType('created_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3)'));
      table.specificType('updated_at', 'DATETIME(3)').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'));

      table.index(['status'], 'ix_bank_account_status');
      table.index(['is_default'], 'ix_bank_account_default');
    });

    // Seed default Meezan Bank account and configured alternative accounts
    await knex('school_bank_accounts').insert([
      {
        bank_name: 'Meezan Bank',
        branch_name: 'F-11 Markaz, Islamabad',
        account_title: 'CAMBRIDGE EDUCATION SYSTEM',
        account_number: '03060114428178',
        iban: 'PK58MEZN0003060114428178',
        is_default: true,
        status: 'ACTIVE',
        instructions: 'Primary default fee collection account for Cambridge Education System.'
      },
      {
        bank_name: 'Habib Bank Limited (HBL)',
        branch_name: 'F-11 Markaz, Islamabad',
        account_title: 'CAMBRIDGE EDUCATION SYSTEM',
        account_number: '23817000192803',
        iban: 'PK36HABB0023817000192803',
        is_default: false,
        status: 'ACTIVE',
        instructions: 'Alternative bank account for parents using HBL / 1Link transfers.'
      },
      {
        bank_name: 'Allied Bank Limited (ABL)',
        branch_name: 'Islamabad Main Branch',
        account_title: 'CAMBRIDGE EDUCATION SYSTEM',
        account_number: '0010045612340019',
        iban: 'PK45ABPA0010045612340019',
        is_default: false,
        status: 'ACTIVE',
        instructions: 'Alternative bank account for parents using Allied Bank / Raast.'
      }
    ]);
  }

  // Get default bank account id
  const defaultAccount = await knex('school_bank_accounts').where({ is_default: true }).first();
  const defaultAccountId = defaultAccount ? defaultAccount.id : 1;

  // 2. Add custom_bank_account_id to students table
  const hasStudentCustomBank = await knex.schema.hasColumn('students', 'custom_bank_account_id');
  if (!hasStudentCustomBank) {
    await knex.schema.alterTable('students', (table) => {
      table.bigInteger('custom_bank_account_id').unsigned().nullable();
      table.foreign('custom_bank_account_id').references('id').inTable('school_bank_accounts').onDelete('SET NULL');
    });
  }

  // 3. Add bank_account_id to fee_challans table
  const hasChallanBank = await knex.schema.hasColumn('fee_challans', 'bank_account_id');
  if (!hasChallanBank) {
    await knex.schema.alterTable('fee_challans', (table) => {
      table.bigInteger('bank_account_id').unsigned().nullable();
      table.foreign('bank_account_id').references('id').inTable('school_bank_accounts').onDelete('SET NULL');
    });

    // Backfill existing challans with default bank account id
    if (defaultAccountId) {
      await knex('fee_challans').whereNull('bank_account_id').update({ bank_account_id: defaultAccountId });
    }
  }

  // 4. Add target_bank_account_id to fee_payment_proofs table
  const hasProofBank = await knex.schema.hasColumn('fee_payment_proofs', 'target_bank_account_id');
  if (!hasProofBank) {
    await knex.schema.alterTable('fee_payment_proofs', (table) => {
      table.bigInteger('target_bank_account_id').unsigned().nullable();
      table.foreign('target_bank_account_id').references('id').inTable('school_bank_accounts').onDelete('SET NULL');
    });

    // Backfill target_bank_account_id from fee_challans for existing proofs
    if (defaultAccountId) {
      await knex.raw(`
        UPDATE fee_payment_proofs fpp
        JOIN fee_challans fc ON fpp.challan_id = fc.id
        SET fpp.target_bank_account_id = COALESCE(fc.bank_account_id, ${defaultAccountId})
        WHERE fpp.target_bank_account_id IS NULL
      `);
    }
  }
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
  const hasProofBank = await knex.schema.hasColumn('fee_payment_proofs', 'target_bank_account_id');
  if (hasProofBank) {
    await knex.schema.alterTable('fee_payment_proofs', (table) => {
      table.dropForeign(['target_bank_account_id']);
      table.dropColumn('target_bank_account_id');
    });
  }

  const hasChallanBank = await knex.schema.hasColumn('fee_challans', 'bank_account_id');
  if (hasChallanBank) {
    await knex.schema.alterTable('fee_challans', (table) => {
      table.dropForeign(['bank_account_id']);
      table.dropColumn('bank_account_id');
    });
  }

  const hasStudentCustomBank = await knex.schema.hasColumn('students', 'custom_bank_account_id');
  if (hasStudentCustomBank) {
    await knex.schema.alterTable('students', (table) => {
      table.dropForeign(['custom_bank_account_id']);
      table.dropColumn('custom_bank_account_id');
    });
  }

  await knex.schema.dropTableIfExists('school_bank_accounts');
}
