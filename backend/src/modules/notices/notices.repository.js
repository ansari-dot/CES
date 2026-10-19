import { db } from '../../shared/db/knex.js';

function mapPriorityToFrontend(p) {
  if (p === 'HIGH') return 'High';
  if (p === 'URGENT') return 'Urgent';
  return 'Normal';
}

function mapPriorityToBackend(p) {
  if (!p) return 'NORMAL';
  const u = p.toUpperCase();
  if (u === 'HIGH' || u === 'URGENT') return u;
  return 'NORMAL';
}

function mapNotificationPriorityToFrontend(p) {
  if (p === 'HIGH') return 'High';
  if (p === 'LOW') return 'Low';
  return 'Medium';
}

function mapNoticeStatusToFrontend(s) {
  if (s === 'DRAFT') return 'Draft';
  if (s === 'ARCHIVED') return 'Archived';
  return 'Published';
}

export const noticesRepository = {
  // 1. School Notices
  async createNotice({ title, content, audience = 'School-Wide', targetRoles = ['Teacher', 'Student', 'Parent'], priority = 'Normal', status = 'Published', expiryDate = null, userId }) {
    const publishDate = new Date().toISOString().split('T')[0];
    const backendPriority = mapPriorityToBackend(priority);
    const backendStatus = status ? status.toUpperCase() : 'PUBLISHED';
    const rolesJson = JSON.stringify(targetRoles);

    const [id] = await db('school_notices').insert({
      title,
      content,
      audience: audience || 'School-Wide',
      target_roles: rolesJson,
      priority: backendPriority,
      status: backendStatus,
      publish_date: publishDate,
      expiry_date: expiryDate || null,
      created_by: userId,
      acknowledged_count: 0
    });

    return await this.findNoticeById(id);
  },

  async getNotices({ audience = null, role = null, status = null, search = null } = {}) {
    let query = db('school_notices')
      .join('users', 'school_notices.created_by', 'users.id')
      .select(
        'school_notices.id',
        'school_notices.title',
        'school_notices.content',
        'school_notices.audience',
        'school_notices.target_roles as targetRolesRaw',
        'school_notices.priority as rawPriority',
        'school_notices.status as rawStatus',
        'school_notices.publish_date as publishDate',
        'school_notices.expiry_date as expiryDate',
        'users.full_name as createdBy',
        'school_notices.acknowledged_count as acknowledgedCount'
      )
      .orderBy('school_notices.created_at', 'desc');

    if (audience && audience !== 'All') {
      query = query.where((q) => {
        q.where('school_notices.audience', audience).orWhere('school_notices.audience', 'School-Wide');
      });
    }

    if (status && status !== 'All') {
      query = query.where('school_notices.status', status.toUpperCase());
    }

    if (search) {
      query = query.where((q) => {
        q.where('school_notices.title', 'like', `%${search}%`)
          .orWhere('school_notices.content', 'like', `%${search}%`);
      });
    }

    const rows = await query;

    return rows
      .map((r) => {
        let roles = ['Teacher', 'Student', 'Parent'];
        try {
          roles = typeof r.targetRolesRaw === 'string' ? JSON.parse(r.targetRolesRaw) : r.targetRolesRaw;
        } catch {
          // fallback
        }

        const pubDateStr = r.publishDate instanceof Date ? r.publishDate.toISOString().split('T')[0] : String(r.publishDate).split('T')[0];
        const expDateStr = r.expiryDate ? (r.expiryDate instanceof Date ? r.expiryDate.toISOString().split('T')[0] : String(r.expiryDate).split('T')[0]) : undefined;

        return {
          id: String(r.id),
          title: r.title,
          content: r.content,
          audience: r.audience,
          targetRoles: roles,
          priority: mapPriorityToFrontend(r.rawPriority),
          status: mapNoticeStatusToFrontend(r.rawStatus),
          publishDate: pubDateStr,
          expiryDate: expDateStr,
          createdBy: r.createdBy,
          acknowledgedCount: Number(r.acknowledgedCount || 0)
        };
      })
      .filter((n) => {
        if (role && role !== 'All') {
          return n.targetRoles.includes(role);
        }
        return true;
      });
  },

  async findNoticeById(id) {
    const list = await this.getNotices();
    return list.find((n) => n.id === String(id)) || null;
  },

  async archiveNotice(id) {
    await db('school_notices').where({ id }).update({
      status: 'ARCHIVED',
      updated_at: db.fn.now(3)
    });
    return await this.findNoticeById(id);
  },

  // 2. Operational Notifications
  async createNotification({ userId = null, title, message, type, targetRole = 'ALL', relatedRecordId = null, relatedRecordType = null, priority = 'Medium' }) {
    const normPriority = priority ? priority.toUpperCase() : 'MEDIUM';

    const [id] = await db('operational_notifications').insert({
      user_id: userId,
      title,
      message,
      type: type || 'Operational Update',
      target_role: targetRole.toUpperCase(),
      related_record_id: relatedRecordId ? String(relatedRecordId) : null,
      related_record_type: relatedRecordType || null,
      priority: normPriority === 'HIGH' || normPriority === 'LOW' ? normPriority : 'MEDIUM',
      is_read: 0
    });

    const row = await db('operational_notifications').where({ id }).first();
    return {
      id: String(row.id),
      title: row.title,
      message: row.message,
      type: row.type,
      targetRole: row.target_role,
      relatedRecordId: row.related_record_id || undefined,
      relatedRecordType: row.related_record_type || undefined,
      timestamp: row.created_at,
      isRead: Boolean(row.is_read),
      priority: mapNotificationPriorityToFrontend(row.priority)
    };
  },

  async getNotifications({ userId = null, role = null, isRead = null } = {}) {
    let query = db('operational_notifications').orderBy('created_at', 'desc');

    if (userId) {
      query = query.where((q) => {
        q.where('user_id', userId).orWhereNull('user_id');
      });
    }

    if (role && role !== 'ALL') {
      const uRole = role.toUpperCase();
      query = query.where((q) => {
        q.where('target_role', uRole).orWhere('target_role', 'ALL');
      });
    }

    if (isRead !== null) {
      query = query.where('is_read', isRead ? 1 : 0);
    }

    const rows = await query;

    return rows.map((r) => ({
      id: String(r.id),
      title: r.title,
      message: r.message,
      type: r.type,
      targetRole: r.target_role,
      relatedRecordId: r.related_record_id || undefined,
      relatedRecordType: r.related_record_type || undefined,
      timestamp: r.created_at,
      isRead: Boolean(r.is_read),
      priority: mapNotificationPriorityToFrontend(r.priority)
    }));
  },

  async markNotificationRead(id) {
    await db('operational_notifications').where({ id }).update({
      is_read: 1,
      read_at: db.fn.now(3)
    });
    return { id: String(id), isRead: true };
  },

  async markAllNotificationsRead({ userId = null, role = null } = {}) {
    let query = db('operational_notifications').where('is_read', 0);
    if (userId) {
      query = query.where((q) => {
        q.where('user_id', userId).orWhereNull('user_id');
      });
    }
    if (role && role !== 'ALL') {
      const uRole = role.toUpperCase();
      query = query.where((q) => {
        q.where('target_role', uRole).orWhere('target_role', 'ALL');
      });
    }
    await query.update({
      is_read: 1,
      read_at: db.fn.now(3)
    });
    return { success: true };
  }
};
