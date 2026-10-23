import { db } from '../../shared/db/knex.js';

export const authRepository = {
  async findUserByIdentifier(identifier) {
    // Try username, email, phone first
    let user = await db('users')
      .join('roles', 'users.role_id', 'roles.id')
      .where('users.username', identifier)
      .orWhere('users.email', identifier)
      .orWhere('users.phone', identifier)
      // Credential emails give students their admission number and teachers
      // their staff ID, so those are accepted as login identifiers too.
      .orWhereIn('users.id', db('students').select('user_id').where('admission_no', identifier))
      .orWhereIn('users.id', db('teachers').select('user_id').where('employee_no', identifier))
      .select('users.*', 'roles.code as role_code', 'roles.name as role_name')
      .first();

    // If not found, try matching against student admission_no (students log in
    // with the admission number shown in their welcome email)
    if (!user) {
      const student = await db('students')
        .where('admission_no', identifier)
        .select('user_id')
        .first();
      if (student) {
        user = await db('users')
          .join('roles', 'users.role_id', 'roles.id')
          .where('users.id', student.user_id)
          .select('users.*', 'roles.code as role_code', 'roles.name as role_name')
          .first();
      }
    }

    return user || null;
  },

  async findUserById(id) {
    return await db('users')
      .join('roles', 'users.role_id', 'roles.id')
      .where('users.id', id)
      .select(
        'users.*',
        'roles.code as role_code',
        'roles.name as role_name'
      )
      .first();
  },

  async updateFailedLogin(id, count, lockedUntil = null) {
    return await db('users')
      .where({ id })
      .update({
        failed_login_count: count,
        locked_until: lockedUntil
      });
  },

  async resetFailedLoginAndSetLastLogin(id) {
    return await db('users')
      .where({ id })
      .update({
        failed_login_count: 0,
        locked_until: null,
        last_login_at: db.fn.now(3)
      });
  },

  async updateUserPassword(id, passwordHash) {
    return await db.transaction(async (trx) => {
      // 1. Update user password, clear must_change_password, and bump token_version to invalidate old sessions
      await trx('users')
        .where({ id })
        .update({
          password_hash: passwordHash,
          must_change_password: 0,
          token_version: db.raw('token_version + 1'),
          password_changed_at: trx.fn.now(3)
        });

      // 2. Revoke all existing refresh tokens
      await trx('refresh_tokens')
        .where({ user_id: id, revoked_at: null })
        .update({
          revoked_at: trx.fn.now(3),
          revoke_reason: 'PASSWORD_CHANGE'
        });
    });
  },

  async createRefreshToken(tokenData, trx = db) {
    const [id] = await trx('refresh_tokens').insert(tokenData);
    return id;
  },

  async findRefreshTokenByHash(tokenHash, trx = db) {
    return await trx('refresh_tokens')
      .where({ token_hash: tokenHash })
      .first();
  },

  async rotateRefreshToken(oldTokenId, newTokenData) {
    return await db.transaction(async (trx) => {
      // Mark old token as used
      await trx('refresh_tokens')
        .where({ id: oldTokenId })
        .update({
          used_at: trx.fn.now(3)
        });

      // Insert new token in same family
      const [newId] = await trx('refresh_tokens').insert(newTokenData);
      return newId;
    });
  },

  async revokeFamilyTokens(familyId, reason, trx = db) {
    return await trx('refresh_tokens')
      .where({ family_id: familyId, revoked_at: null })
      .update({
        revoked_at: trx.fn.now(3),
        revoke_reason: reason
      });
  },

  async revokeAllUserTokens(userId, reason, trx = db) {
    return await trx('refresh_tokens')
      .where({ user_id: userId, revoked_at: null })
      .update({
        revoked_at: trx.fn.now(3),
        revoke_reason: reason
      });
  },

  async getRolePermissions(roleId) {
    const rows = await db('role_permissions')
      .join('permissions', 'role_permissions.permission_id', 'permissions.id')
      .where('role_permissions.role_id', roleId)
      .select('permissions.code');

    return rows.map((r) => r.code);
  }
};
