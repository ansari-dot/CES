import { db } from '../src/shared/db/knex.js';
import { hashPassword } from '../src/shared/crypto/password.js';

async function createPrincipal() {
  const args = process.argv.slice(2);
  const username = args[0] || 'principal';
  const password = args[1] || 'PrincipalPassword123!';
  const email = args[2] || 'principal@school.pk';
  const fullName = args[3] || 'Prof. Tariq Mahmood';
  const phone = args[4] || '+923009876543';

  console.log(`\n===========================================`);
  console.log(`   ONLINE SCHOOL - PRINCIPAL ACCOUNT SCRIPT`);
  console.log(`===========================================`);
  console.log(`Setting up Principal user: [${username}] ...`);

  // Ensure role PRINCIPAL exists
  let principalRole = await db('roles').where({ code: 'PRINCIPAL' }).first();
  if (!principalRole) {
    const [roleId] = await db('roles').insert({
      code: 'PRINCIPAL',
      name: 'Principal'
    });
    principalRole = { id: roleId };
  }

  // Hash password using Argon2id per SRS Section 4.6
  const passwordHash = await hashPassword(password);

  // Check if user already exists
  const existingUser = await db('users')
    .where({ username })
    .orWhere({ email })
    .first();

  let userId;
  if (existingUser) {
    await db('users')
      .where({ id: existingUser.id })
      .update({
        username,
        email,
        phone,
        full_name: fullName,
        password_hash: passwordHash,
        role_id: principalRole.id,
        status: 'ACTIVE',
        must_change_password: 0,
        locked_until: null,
        failed_login_count: 0
      });
    userId = existingUser.id;
    console.log(`\n✅ Existing user updated successfully!`);
  } else {
    const [insertedId] = await db('users').insert({
      role_id: principalRole.id,
      username,
      email,
      phone,
      full_name: fullName,
      password_hash: passwordHash,
      must_change_password: 0,
      status: 'ACTIVE',
      token_version: 0
    });
    userId = insertedId;
    console.log(`\n✅ Principal user created successfully!`);
  }

  console.log(`\nUser Details:`);
  console.log(`-------------------------------------------`);
  console.log(`ID:        ${userId}`);
  console.log(`Username:  ${username}`);
  console.log(`Email:     ${email}`);
  console.log(`Full Name: ${fullName}`);
  console.log(`Role:      PRINCIPAL (Role ID: ${principalRole.id})`);
  console.log(`Password:  ${password}`);
  console.log(`-------------------------------------------`);
  console.log(`You can now log in using either the username or email.\n`);

  await db.destroy();
}

createPrincipal().catch((err) => {
  console.error('Failed to create Principal:', err);
  process.exit(1);
});
