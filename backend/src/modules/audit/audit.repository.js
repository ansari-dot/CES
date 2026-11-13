import { db } from '../../shared/db/knex.js';

export const auditRepository = {
  /**
   * Write an audit entry, optionally inside a transaction. Actor name/role are resolved
   * from the users table. Values are JSON-serialised when they are objects.
   */
  async logAction(conn, { actorId = null, action, recordType, recordIdentifier, reason = null, previousValue = null, newValue = null, ipAddress = null }) {
    const q = conn || db;
    let actorName = 'System';
    let actorRole = 'System';
    if (actorId) {
      const actor = await q('users')
        .leftJoin('roles', 'users.role_id', 'roles.id')
        .where('users.id', Number(actorId))
        .select('users.full_name', 'roles.name as roleName')
        .first();
      if (actor) {
        actorName = actor.full_name || actorName;
        actorRole = actor.roleName ? String(actor.roleName).toUpperCase() : actorRole;
      }
    }
    const serialise = (v) => (v === null || v === undefined ? null : typeof v === 'string' ? v : JSON.stringify(v));
    await q('audit_logs').insert({
      actor_id: actorId ? Number(actorId) : null,
      actor_name: String(actorName).slice(0, 150),
      actor_role: String(actorRole).slice(0, 50),
      action: String(action).slice(0, 100),
      record_type: String(recordType).slice(0, 100),
      record_identifier: String(recordIdentifier).slice(0, 200),
      reason: reason || null,
      previous_value: serialise(previousValue),
      new_value: serialise(newValue),
      ip_address: ipAddress || null
    });
  },

  async recordAuditLog({
    actorId = null,
    actorName,
    actorRole,
    action,
    recordType,
    recordIdentifier,
    reason = '',
    previousValue = null,
    newValue = null,
    ipAddress = null
  }) {
    const [id] = await db('audit_logs').insert({
      actor_id: actorId ? Number(actorId) : null,
      actor_name: actorName || 'System',
      actor_role: actorRole || 'System',
      action,
      record_type: recordType,
      record_identifier: recordIdentifier,
      reason: reason || null,
      previous_value: previousValue ? String(previousValue) : null,
      new_value: newValue ? String(newValue) : null,
      ip_address: ipAddress || null
    });

    const row = await db('audit_logs').where({ id }).first();
    return {
      id: `AUD-${row.id}`,
      actorName: row.actor_name,
      actorRole: row.actor_role,
      action: row.action,
      recordType: row.record_type,
      recordIdentifier: row.record_identifier,
      timestamp: row.created_at,
      reason: row.reason || '',
      previousValue: row.previous_value || undefined,
      newValue: row.new_value || undefined,
      ipAddress: row.ip_address || undefined
    };
  },

  async getAuditLogs({ recordType = null, action = null, limit = 150 } = {}) {
    let query = db('audit_logs').orderBy('created_at', 'desc').limit(limit);

    if (recordType && recordType !== 'All') {
      query = query.where('record_type', recordType);
    }

    if (action) {
      query = query.where('action', 'like', `%${action}%`);
    }

    const rows = await query;

    return rows.map((row) => ({
      id: `AUD-${row.id}`,
      actorName: row.actor_name,
      actorRole: row.actor_role,
      action: row.action,
      recordType: row.record_type,
      recordIdentifier: row.record_identifier,
      timestamp: row.created_at,
      reason: row.reason || '',
      previousValue: row.previous_value || undefined,
      newValue: row.new_value || undefined,
      ipAddress: row.ip_address || undefined
    }));
  }
};
