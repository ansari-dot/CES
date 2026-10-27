import { db } from '../../shared/db/knex.js';
import { config } from '../../config/index.js';

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

function mapNoticeStatusToBackend(s) {
  const u = String(s || 'PUBLISHED').toUpperCase();
  return ['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(u) ? u : 'PUBLISHED';
}

function toDateString(value) {
  if (!value) return undefined;
  if (value instanceof Date) {
    // DATE columns come back as local-midnight Date objects
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return String(value).split('T')[0];
}

function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/** Today's date (YYYY-MM-DD) in the school's timezone. */
export function schoolToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: config.SCHOOL_TIMEZONE || 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function mapNoticeRow(r) {
  const roles = parseJson(r.targetRolesRaw, ['Teacher', 'Student', 'Parent']);
  let classIds = parseJson(r.targetClassIdsRaw, null);

  // Notices created before class targeting existed store "Class N" in audience
  if (!classIds && typeof r.audience === 'string') {
    const m = r.audience.match(/^Class\s+(\d+)$/i);
    if (m && r.legacyClassId) classIds = [Number(r.legacyClassId)];
  }

  return {
    id: String(r.id),
    title: r.title,
    content: r.content,
    audience: r.audience,
    targetRoles: Array.isArray(roles) ? roles : ['Teacher', 'Student', 'Parent'],
    targetClassIds: Array.isArray(classIds) ? classIds.map(Number) : null,
    category: r.category || null,
    priority: mapPriorityToFrontend(r.rawPriority),
    status: mapNoticeStatusToFrontend(r.rawStatus),
    publishDate: toDateString(r.publishDate),
    expiryDate: toDateString(r.expiryDate),
    createdBy: r.createdBy,
    createdById: Number(r.createdById),
    createdAt: r.createdAt,
    acknowledgedCount: Number(r.readCount || 0)
  };
}

function baseNoticeQuery() {
  return db('school_notices')
    .join('users', 'school_notices.created_by', 'users.id')
    .leftJoin('classes as legacy_class', function joinLegacyClass() {
      this.on(db.raw("school_notices.audience = CONCAT('Class ', legacy_class.grade_level)"));
    })
    .select(
      'school_notices.id',
      'school_notices.title',
      'school_notices.content',
      'school_notices.audience',
      'school_notices.target_roles as targetRolesRaw',
      'school_notices.target_class_ids as targetClassIdsRaw',
      'school_notices.category',
      'school_notices.priority as rawPriority',
      'school_notices.status as rawStatus',
      'school_notices.publish_date as publishDate',
      'school_notices.expiry_date as expiryDate',
      'school_notices.created_by as createdById',
      'school_notices.created_at as createdAt',
      'users.full_name as createdBy',
      'legacy_class.id as legacyClassId',
      db.raw('(SELECT COUNT(*) FROM notice_reads nr WHERE nr.notice_id = school_notices.id) as readCount')
    )
    .orderBy('school_notices.publish_date', 'desc')
    .orderBy('school_notices.created_at', 'desc');
}

function mapNotificationRow(r) {
  return {
    id: String(r.id),
    title: r.title,
    message: r.message,
    type: r.type,
    targetRole: r.target_role,
    relatedRecordId: r.related_record_id || undefined,
    relatedRecordType: r.related_record_type || undefined,
    timestamp: r.created_at,
    createdAt: r.created_at,
    isRead: Boolean(r.is_read),
    priority: mapNotificationPriorityToFrontend(r.priority)
  };
}

export const noticesRepository = {
  // 1. School Notices
  async createNotice({
    title,
    content,
    audience = 'School-Wide',
    targetRoles = ['Teacher', 'Student', 'Parent'],
    targetClassIds = null,
    category = null,
    priority = 'Normal',
    status = 'Published',
    publishDate = null,
    expiryDate = null,
    userId
  }) {
    const [id] = await db('school_notices').insert({
      title,
      content,
      audience: audience || 'School-Wide',
      target_roles: JSON.stringify(targetRoles),
      target_class_ids: targetClassIds && targetClassIds.length > 0 ? JSON.stringify(targetClassIds) : null,
      category: category || null,
      priority: mapPriorityToBackend(priority),
      status: mapNoticeStatusToBackend(status),
      publish_date: publishDate || schoolToday(),
      expiry_date: expiryDate || null,
      created_by: userId,
      acknowledged_count: 0
    });

    return await this.findNoticeById(id);
  },

  async updateNotice(id, fields) {
    const updates = { updated_at: db.fn.now(3) };
    if (fields.title !== undefined) updates.title = fields.title;
    if (fields.content !== undefined) updates.content = fields.content;
    if (fields.audience !== undefined) updates.audience = fields.audience;
    if (fields.targetRoles !== undefined) updates.target_roles = JSON.stringify(fields.targetRoles);
    if (fields.targetClassIds !== undefined) {
      updates.target_class_ids =
        fields.targetClassIds && fields.targetClassIds.length > 0 ? JSON.stringify(fields.targetClassIds) : null;
    }
    if (fields.category !== undefined) updates.category = fields.category || null;
    if (fields.priority !== undefined) updates.priority = mapPriorityToBackend(fields.priority);
    if (fields.status !== undefined) updates.status = mapNoticeStatusToBackend(fields.status);
    if (fields.publishDate !== undefined && fields.publishDate) updates.publish_date = fields.publishDate;
    if (fields.expiryDate !== undefined) updates.expiry_date = fields.expiryDate || null;

    await db('school_notices').where({ id }).update(updates);
    return await this.findNoticeById(id);
  },

  async getNotices({ audience = null, role = null, status = null, search = null, publishedOnly = false, createdBy = null } = {}) {
    let query = baseNoticeQuery();

    if (audience && audience !== 'All') {
      query = query.where((q) => {
        q.where('school_notices.audience', audience).orWhere('school_notices.audience', 'School-Wide');
      });
    }

    if (publishedOnly) {
      const today = schoolToday();
      query = query
        .where('school_notices.status', 'PUBLISHED')
        .where('school_notices.publish_date', '<=', today)
        .where((q) => {
          q.whereNull('school_notices.expiry_date').orWhere('school_notices.expiry_date', '>=', today);
        });
    } else if (status && status !== 'All') {
      query = query.where('school_notices.status', mapNoticeStatusToBackend(status));
    }

    if (createdBy) query = query.where('school_notices.created_by', createdBy);

    if (search) {
      query = query.where((q) => {
        q.where('school_notices.title', 'like', `%${search}%`).orWhere('school_notices.content', 'like', `%${search}%`);
      });
    }

    const rows = await query;
    return rows
      .map(mapNoticeRow)
      .filter((n) => !(role && role !== 'All') || n.targetRoles.includes(role));
  },

  async findNoticeById(id) {
    const row = await baseNoticeQuery().where('school_notices.id', id).first();
    return row ? mapNoticeRow(row) : null;
  },

  async archiveNotice(id) {
    await db('school_notices').where({ id }).update({
      status: 'ARCHIVED',
      updated_at: db.fn.now(3)
    });
    return await this.findNoticeById(id);
  },

  async getReadNoticeIds(userId, noticeIds) {
    if (!noticeIds || noticeIds.length === 0) return new Set();
    const rows = await db('notice_reads').where('user_id', userId).whereIn('notice_id', noticeIds).select('notice_id');
    return new Set(rows.map((r) => String(r.notice_id)));
  },

  async getNoticeReadTimes(userId, noticeIds) {
    if (!noticeIds || noticeIds.length === 0) return new Map();
    const rows = await db('notice_reads')
      .where('user_id', userId)
      .whereIn('notice_id', noticeIds)
      .select('notice_id', 'read_at');
    return new Map(rows.map((r) => [String(r.notice_id), r.read_at]));
  },

  async markNoticesRead(userId, noticeIds) {
    const ids = Array.from(new Set((noticeIds || []).map(Number).filter(Boolean)));
    if (ids.length === 0) return 0;
    await db('notice_reads')
      .insert(ids.map((noticeId) => ({ notice_id: noticeId, user_id: userId })))
      .onConflict(['notice_id', 'user_id'])
      .ignore();
    return ids.length;
  },

  // 2. Operational Notifications
  async createNotification({ userId = null, title, message, type, targetRole = 'ALL', relatedRecordId = null, relatedRecordType = null, priority = 'Medium' }) {
    const normPriority = priority ? priority.toUpperCase() : 'MEDIUM';

    const [id] = await db('operational_notifications').insert({
      user_id: userId,
      title,
      message,
      type: type || 'Operational Update',
      target_role: (targetRole || 'ALL').toUpperCase(),
      related_record_id: relatedRecordId ? String(relatedRecordId) : null,
      related_record_type: relatedRecordType || null,
      priority: normPriority === 'HIGH' || normPriority === 'LOW' ? normPriority : 'MEDIUM',
      is_read: 0
    });

    const row = await db('operational_notifications').where({ id }).first();
    return mapNotificationRow(row);
  },

  async createNotificationsForUsers(userIds, { title, message, type, targetRole = 'ALL', relatedRecordId = null, relatedRecordType = null, priority = 'Medium' }) {
    const normPriority = priority ? priority.toUpperCase() : 'MEDIUM';
    const rows = userIds.map((uid) => ({
      user_id: uid,
      title: String(title).slice(0, 200),
      message,
      type: type || 'Operational Update',
      target_role: (targetRole || 'ALL').toUpperCase(),
      related_record_id: relatedRecordId ? String(relatedRecordId) : null,
      related_record_type: relatedRecordType || null,
      priority: normPriority === 'HIGH' || normPriority === 'LOW' ? normPriority : 'MEDIUM',
      is_read: 0
    }));
    if (rows.length === 0) return 0;
    await db('operational_notifications').insert(rows);
    return rows.length;
  },

  /**
   * Notifications addressed to this user, or broadcast to their role.
   * Notice announcements are served from school_notices (see service), so the
   * legacy notice broadcast rows are excluded here to avoid duplicates.
   */
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
        q.where('target_role', uRole).orWhere('target_role', 'ALL').orWhere('user_id', userId || 0);
      });
    }

    query = query.where((q) => {
      q.whereNull('related_record_type').orWhereNot('related_record_type', 'Notice');
    });

    if (isRead !== null) {
      query = query.where('is_read', isRead ? 1 : 0);
    }

    const rows = await query.limit(200);
    return rows.map(mapNotificationRow);
  },

  async markNotificationRead(id, userId = null) {
    let query = db('operational_notifications').where({ id });
    if (userId) {
      query = query.where((q) => q.where('user_id', userId).orWhereNull('user_id'));
    }
    const updated = await query.update({
      is_read: 1,
      read_at: db.fn.now(3)
    });
    return { id: String(id), isRead: updated > 0 };
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
        q.where('target_role', uRole).orWhere('target_role', 'ALL').orWhere('user_id', userId || 0);
      });
    }
    await query.update({
      is_read: 1,
      read_at: db.fn.now(3)
    });
    return { success: true };
  }
};
