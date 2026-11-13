import { useEffect, useMemo } from 'react';
import { useAppSelector } from '../store';
import { countActivity, markSectionsSeen, teacherSectionFor, toMs, useSeenMap } from '../lib/sectionBadges';

const CHAT_TAB = 'student-chat';

/**
 * Per-tab activity counts for the teacher sidebar: unread notifications from students,
 * the school and the principal (submissions, attendance corrections, timetable changes,
 * exam duties, payroll, notices …) that arrived after the teacher last opened that tab,
 * plus unread student chat messages.
 */
export function useSectionBadges(): Record<string, number> {
  const currentTab = useAppSelector((state) => state.ui.currentTab) as string;
  const username = useAppSelector((state) => state.auth.username);
  const notifications = useAppSelector((state) => state.ui.notifications);
  const notices = useAppSelector((state) => state.notices.notices);
  const chatUnread = useAppSelector((state) => (state as any).chat?.totalUnreadCount || 0) as number;
  const scope = `teacher_${username || 'me'}`;
  const seen = useSeenMap(scope);

  const counts = useMemo(() => {
    const items = notifications
      .filter((n) => !n.id.startsWith('remind-')) // local pre-lesson reminders are not activity
      .map((n) => ({
        section: teacherSectionFor(n.rawType, n.recordType),
        createdAt: toMs(n.createdAt),
        unread: !n.read
      }));
    // School notices addressed to the teacher (not their own) that are still unread
    for (const notice of notices) {
      if (notice.canManage || notice.isRead !== false || notice.isPublished === false) continue;
      items.push({ section: 'notices', createdAt: toMs(notice.publishedAt), unread: true });
    }
    const result = countActivity(items, seen);
    if (chatUnread > 0) result[CHAT_TAB] = chatUnread;
    return result;
  }, [notifications, notices, seen, chatUnread]);

  // Opening a tab (or receiving activity while on it) clears its counter
  useEffect(() => {
    if (currentTab && currentTab !== CHAT_TAB && counts[currentTab]) markSectionsSeen(scope, [currentTab]);
  }, [currentTab, counts, scope]);

  return counts;
}
