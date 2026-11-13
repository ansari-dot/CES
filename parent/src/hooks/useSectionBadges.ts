import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { requestApi } from '../services/api';
import { getSocket, RealtimeEvents } from '../services/socketService';
import { useParent } from '../context/ParentContext';
import { countActivity, markSectionsSeen, parentSectionFor, toMs, useSeenMap, ActivityItem } from '../lib/sectionBadges';

interface RawNotification {
  type?: string;
  relatedRecordType?: string;
  createdAt?: string;
  isRead?: boolean;
}

interface RawNotice {
  isRead?: boolean;
  createdAt?: string;
  publishDate?: string;
}

/**
 * Per-route activity counts for the parent sidebar: unread notifications about the
 * children (new assignments, grades, results, attendance, achievements …) and unread
 * school notices that arrived after the parent last opened that section.
 */
export function useSectionBadges(): Record<string, number> {
  const location = useLocation();
  const { user } = useParent();
  const scope = user ? `parent_${user.id}` : '';
  const seen = useSeenMap(scope);
  const [items, setItems] = useState<ActivityItem[]>([]);

  const load = useCallback(async () => {
    if (!user || user.mustChangePassword) return;
    const [notifications, notices] = await Promise.all([
      requestApi<RawNotification[]>('/api/v1/notices/notifications').catch(() => [] as RawNotification[]),
      requestApi<RawNotice[]>('/api/v1/notices').catch(() => [] as RawNotice[])
    ]);
    const next: ActivityItem[] = (Array.isArray(notifications) ? notifications : []).map((n) => ({
      section: parentSectionFor(n.type, n.relatedRecordType),
      createdAt: toMs(n.createdAt),
      unread: !n.isRead
    }));
    for (const notice of Array.isArray(notices) ? notices : []) {
      if (notice.isRead === false) {
        next.push({ section: '/parent/notices', createdAt: toMs(notice.createdAt || notice.publishDate), unread: true });
      }
    }
    setItems(next);
  }, [user]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load, location.pathname]);

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    const refresh = () => load();
    socket.on(RealtimeEvents.NOTIFICATION_CREATED, refresh);
    socket.on(RealtimeEvents.CALENDAR_UPDATED, refresh);
    return () => {
      socket.off(RealtimeEvents.NOTIFICATION_CREATED, refresh);
      socket.off(RealtimeEvents.CALENDAR_UPDATED, refresh);
    };
  }, [user, load]);

  const counts = useMemo(() => countActivity(items, seen), [items, seen]);

  // Opening a section (or receiving activity while on it) clears its counter
  useEffect(() => {
    const path = location.pathname;
    if (scope && counts[path]) markSectionsSeen(scope, [path]);
  }, [location.pathname, counts, scope]);

  return counts;
}
