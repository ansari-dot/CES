import { noticesRepository, schoolToday } from './notices.repository.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { emitRealtimeEvent, RealtimeEvents } from '../../shared/realtime/eventEmitter.js';
import { db } from '../../shared/db/knex.js';
import {
  isStaff,
  forbidden,
  getTeacherScope,
  getStudentByUserId,
  getParentChildren
} from '../../shared/services/accessScope.js';

const ROLE_LABELS = { TEACHER: 'Teacher', STUDENT: 'Student', PARENT: 'Parent' };
const ALL_ROLE_LABELS = ['Teacher', 'Student', 'Parent'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateDate(value, label) {
  if (value === undefined || value === null || value === '') return null;
  if (!DATE_RE.test(String(value)) || Number.isNaN(new Date(value).getTime())) {
    throw new AppError(`${label} must be a valid date (YYYY-MM-DD)`, 422, ErrorCodes.VALIDATION_ERROR);
  }
  return String(value);
}

function normalizeRoles(targetRoles, allowed) {
  const list = Array.isArray(targetRoles) ? targetRoles : [];
  const normalized = Array.from(
    new Set(
      list
        .map((r) => String(r || '').trim().toLowerCase())
        .map((r) => (r.startsWith('teacher') ? 'Teacher' : r.startsWith('student') ? 'Student' : r.startsWith('parent') ? 'Parent' : null))
        .filter((r) => r && allowed.includes(r))
    )
  );
  return normalized;
}

async function classLabel(classIds) {
  const rows = await db('classes').whereIn('id', classIds).select('grade_level').orderBy('grade_level', 'asc');
  if (rows.length === 1) return `Class ${rows[0].grade_level}`;
  return `Classes ${rows.map((r) => r.grade_level).join(', ')}`;
}

/** Audience context for the viewer: which role label and classes notices may target. */
async function getViewerContext(user) {
  const roleLabel = ROLE_LABELS[user.role] || null;
  let classIds = [];

  if (user.role === 'STUDENT') {
    const student = await getStudentByUserId(user.id);
    if (student) classIds = [Number(student.current_class_id)];
  } else if (user.role === 'PARENT') {
    const { children } = await getParentChildren(user.id);
    classIds = Array.from(new Set(children.map((c) => Number(c.classId))));
  } else if (user.role === 'TEACHER') {
    const scope = await getTeacherScope(user.id);
    classIds = Array.from(scope.classIds);
  }

  return { roleLabel, classIds };
}

function isVisibleTo(notice, ctx) {
  if (!ctx.roleLabel || !notice.targetRoles.includes(ctx.roleLabel)) return false;
  if (!notice.targetClassIds) return true;
  return notice.targetClassIds.some((cid) => ctx.classIds.includes(Number(cid)));
}

function canManage(user, notice) {
  return isStaff(user) || Number(notice.createdById) === Number(user.id);
}

/**
 * Resolves audience label, target roles and target classes from the request,
 * enforcing what each role may address.
 */
async function resolveTargeting(user, { audience, targetRoles, targetClassIds, classId }) {
  if (isStaff(user)) {
    const roles = normalizeRoles(targetRoles ?? ALL_ROLE_LABELS, ALL_ROLE_LABELS);
    if (roles.length === 0) {
      throw new AppError('Select at least one recipient group (Students, Teachers or Parents)', 422, ErrorCodes.VALIDATION_ERROR);
    }

    let classIds = Array.isArray(targetClassIds) ? targetClassIds.map(Number).filter(Boolean) : [];
    if (classIds.length === 0 && typeof audience === 'string') {
      const m = audience.match(/^Class\s+(\d+)$/i);
      if (m) {
        const cls = await db('classes').where({ grade_level: Number(m[1]) }).first();
        if (!cls) throw new AppError(`Class ${m[1]} does not exist`, 422, ErrorCodes.VALIDATION_ERROR);
        classIds = [cls.id];
      }
    }
    if (classIds.length > 0) {
      const found = await db('classes').whereIn('id', classIds).count('id as c').first();
      if (Number(found.c) !== classIds.length) {
        throw new AppError('One or more target classes do not exist', 422, ErrorCodes.VALIDATION_ERROR);
      }
    }

    return {
      audience: classIds.length > 0 ? await classLabel(classIds) : 'School-Wide',
      targetRoles: roles,
      targetClassIds: classIds.length > 0 ? classIds : null
    };
  }

  if (user.role === 'TEACHER') {
    const scope = await getTeacherScope(user.id);
    if (scope.classIds.size === 0) {
      throw forbidden('You have no assigned classes to send notices to.');
    }

    let requested = Array.isArray(targetClassIds) ? targetClassIds.map(Number).filter(Boolean) : [];
    if (requested.length === 0 && classId && classId !== 'all') requested = [Number(classId)];
    if (requested.length === 0) requested = Array.from(scope.classIds);

    const outside = requested.filter((cid) => !scope.classIds.has(cid));
    if (outside.length > 0) {
      throw forbidden('You can only send notices to classes assigned to you.');
    }

    const roles = normalizeRoles(targetRoles ?? ['Student', 'Parent'], ['Student', 'Parent']);
    return {
      audience: await classLabel(requested),
      targetRoles: roles.length > 0 ? roles : ['Student', 'Parent'],
      targetClassIds: requested
    };
  }

  throw forbidden('Your role cannot publish notices.');
}

function withViewerFields(user, notice, readMap = null) {
  return {
    ...notice,
    canManage: canManage(user, notice),
    isRead: readMap ? readMap.has(notice.id) : undefined,
    readAt: readMap ? readMap.get(notice.id) || null : undefined
  };
}

function noticeToNotification(notice, readMap) {
  const message = notice.content.length > 280 ? `${notice.content.substring(0, 277)}...` : notice.content;
  const createdAt = notice.createdAt;
  return {
    id: `notice-${notice.id}`,
    title: notice.title,
    message,
    fullMessage: notice.content,
    type: 'School Notice',
    category: notice.category || undefined,
    targetRole: 'ALL',
    relatedRecordId: notice.id,
    relatedRecordType: 'Notice',
    timestamp: createdAt,
    createdAt,
    isRead: readMap.has(notice.id),
    priority: notice.priority === 'Urgent' || notice.priority === 'High' ? 'High' : 'Medium',
    audience: notice.audience,
    publishedBy: notice.createdBy,
    publishDate: notice.publishDate
  };
}

export const noticesService = {
  // Notices
  async createNotice(user, payload) {
    const { title, content, priority, status, category } = payload;
    if (!title || !String(title).trim()) {
      throw new AppError('Notice title is required', 422, ErrorCodes.VALIDATION_ERROR);
    }
    if (!content || !String(content).trim()) {
      throw new AppError('Notice content is required', 422, ErrorCodes.VALIDATION_ERROR);
    }

    const publishDate = validateDate(payload.publishDate, 'Publication date') || schoolToday();
    const expiryDate = validateDate(payload.expiryDate, 'Expiry date');
    if (expiryDate && expiryDate < publishDate) {
      throw new AppError('Expiry date cannot be before the publication date', 422, ErrorCodes.VALIDATION_ERROR);
    }

    const targeting = await resolveTargeting(user, payload);

    const notice = await noticesRepository.createNotice({
      title: String(title).trim(),
      content: String(content).trim(),
      ...targeting,
      category: category || null,
      priority,
      status: status || 'Published',
      publishDate,
      expiryDate,
      userId: user.id
    });

    return withViewerFields(user, notice);
  },

  async updateNotice(user, id, payload) {
    const existing = await noticesRepository.findNoticeById(id);
    if (!existing) throw new AppError('Notice not found', 404, ErrorCodes.NOT_FOUND);
    if (!canManage(user, existing)) throw forbidden('You can only edit notices you published.');

    if (payload.title !== undefined && !String(payload.title).trim()) {
      throw new AppError('Notice title is required', 422, ErrorCodes.VALIDATION_ERROR);
    }
    if (payload.content !== undefined && !String(payload.content).trim()) {
      throw new AppError('Notice content is required', 422, ErrorCodes.VALIDATION_ERROR);
    }

    const publishDate = validateDate(payload.publishDate, 'Publication date') || existing.publishDate;
    const expiryDate = payload.expiryDate !== undefined ? validateDate(payload.expiryDate, 'Expiry date') : existing.expiryDate || null;
    if (expiryDate && expiryDate < publishDate) {
      throw new AppError('Expiry date cannot be before the publication date', 422, ErrorCodes.VALIDATION_ERROR);
    }

    const targetingChanged =
      payload.audience !== undefined || payload.targetRoles !== undefined || payload.targetClassIds !== undefined;
    const targeting = targetingChanged
      ? await resolveTargeting(user, {
          audience: payload.audience ?? existing.audience,
          targetRoles: payload.targetRoles ?? existing.targetRoles,
          targetClassIds: payload.targetClassIds ?? (payload.audience !== undefined ? undefined : existing.targetClassIds)
        })
      : {};

    const updated = await noticesRepository.updateNotice(id, {
      title: payload.title !== undefined ? String(payload.title).trim() : undefined,
      content: payload.content !== undefined ? String(payload.content).trim() : undefined,
      category: payload.category,
      priority: payload.priority,
      status: payload.status,
      publishDate,
      expiryDate,
      ...targeting
    });

    return withViewerFields(user, updated);
  },

  async getNotices(user, filters = {}) {
    if (isStaff(user)) {
      const notices = await noticesRepository.getNotices(filters);
      return notices.map((n) => withViewerFields(user, n));
    }

    const ctx = await getViewerContext(user);
    const published = await noticesRepository.getNotices({ publishedOnly: true, search: filters.search || null });
    let visible = published.filter((n) => isVisibleTo(n, ctx));

    // Teachers also see every notice they authored (drafts, scheduled, archived)
    if (user.role === 'TEACHER') {
      const own = await noticesRepository.getNotices({ createdBy: user.id });
      const seen = new Set(visible.map((n) => n.id));
      visible = [...own.filter((n) => !seen.has(n.id)), ...visible];
      visible.sort((a, b) => String(b.publishDate).localeCompare(String(a.publishDate)));
    }

    const readMap = await noticesRepository.getNoticeReadTimes(user.id, visible.map((n) => Number(n.id)));
    return visible.map((n) => withViewerFields(user, n, readMap));
  },

  async getNoticeById(user, id) {
    const notice = await noticesRepository.findNoticeById(id);
    if (!notice) {
      throw new AppError('Notice not found', 404, ErrorCodes.NOT_FOUND);
    }
    if (isStaff(user) || canManage(user, notice)) return withViewerFields(user, notice);

    const ctx = await getViewerContext(user);
    const today = schoolToday();
    const active =
      notice.status === 'Published' &&
      notice.publishDate <= today &&
      (!notice.expiryDate || notice.expiryDate >= today);
    if (!active || !isVisibleTo(notice, ctx)) {
      throw new AppError('Notice not found', 404, ErrorCodes.NOT_FOUND);
    }
    const readMap = await noticesRepository.getNoticeReadTimes(user.id, [Number(notice.id)]);
    return withViewerFields(user, notice, readMap);
  },

  async markNoticeRead(user, id) {
    const notice = await this.getNoticeById(user, id);
    await noticesRepository.markNoticesRead(user.id, [Number(notice.id)]);
    return { id: notice.id, isRead: true };
  },

  async archiveNotice(user, id) {
    const notice = await noticesRepository.findNoticeById(id);
    if (!notice) {
      throw new AppError('Notice not found', 404, ErrorCodes.NOT_FOUND);
    }
    if (!canManage(user, notice)) throw forbidden('You can only archive notices you published.');
    const archived = await noticesRepository.archiveNotice(id);
    return withViewerFields(user, archived);
  },

  // Operational Notifications
  async createNotification({ userId, title, message, type, targetRole, relatedRecordId, relatedRecordType, priority }) {
    if (!title || !title.trim()) {
      throw new AppError('Notification title is required', 422, ErrorCodes.VALIDATION_ERROR);
    }
    if (!message || !message.trim()) {
      throw new AppError('Notification message is required', 422, ErrorCodes.VALIDATION_ERROR);
    }

    const created = await noticesRepository.createNotification({
      userId,
      title,
      message,
      type,
      targetRole,
      relatedRecordId,
      relatedRecordType,
      priority
    });

    // Push the notification to connected portals so they can toast in real time.
    emitRealtimeEvent(
      RealtimeEvents.NOTIFICATION_CREATED,
      {
        id: created?.id,
        title,
        message,
        type,
        priority,
        targetRole,
        userId,
        relatedRecordId,
        relatedRecordType,
        createdAt: new Date().toISOString()
      },
      {
        userIds: userId ? [userId] : undefined,
        roles: targetRole && targetRole !== 'ALL' ? [targetRole] : undefined
      }
    );

    return created;
  },

  /** Operational notifications plus the notices currently addressed to this user. */
  async getNotifications(user, { isRead = null } = {}) {
    const operational = await noticesRepository.getNotifications({ userId: user.id, role: user.role, isRead });
    if (isStaff(user)) return operational;

    const ctx = await getViewerContext(user);
    const published = await noticesRepository.getNotices({ publishedOnly: true });
    const visible = published.filter((n) => isVisibleTo(n, ctx) && Number(n.createdById) !== Number(user.id));
    const readMap = await noticesRepository.getNoticeReadTimes(user.id, visible.map((n) => Number(n.id)));

    let noticeItems = visible.map((n) => noticeToNotification(n, readMap));
    if (isRead !== null) noticeItems = noticeItems.filter((n) => n.isRead === isRead);

    return [...noticeItems, ...operational].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  },

  async markNotificationRead(user, id) {
    const raw = String(id);
    if (raw.startsWith('notice-')) {
      return await this.markNoticeRead(user, raw.slice('notice-'.length));
    }
    return await noticesRepository.markNotificationRead(raw, user.id);
  },

  async markAllNotificationsRead(user) {
    await noticesRepository.markAllNotificationsRead({ userId: user.id, role: user.role });
    if (!isStaff(user)) {
      const ctx = await getViewerContext(user);
      const published = await noticesRepository.getNotices({ publishedOnly: true });
      const visibleIds = published.filter((n) => isVisibleTo(n, ctx)).map((n) => Number(n.id));
      await noticesRepository.markNoticesRead(user.id, visibleIds);
    }
    return { success: true };
  }
};
