import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { RootState } from '../store';
import { studentChatApi } from '../services/chatApi';
import { getSocket } from '../services/socketService';
import { countActivity, markSectionsSeen, studentSectionFor, toMs, useSeenMap } from '../lib/sectionBadges';

const CHAT_PATH = '/student/chat';

/**
 * Per-route activity counts for the student sidebar:
 *  - unread notifications grouped by section (new assignment, grade, result, resource,
 *    attendance, timetable change …) that arrived after the student last opened it
 *  - unread teacher replies in "Ask Teacher"
 */
export function useSectionBadges(): Record<string, number> {
  const location = useLocation();
  const profile = useSelector((state: RootState) => state.student.profile);
  const notifications = useSelector((state: RootState) => state.notifications.items);
  const scope = `student_${profile.username || profile.rollNumber || 'me'}`;
  const seen = useSeenMap(scope);
  const [chatUnread, setChatUnread] = useState(0);

  const loadChatUnread = useCallback(() => {
    studentChatApi
      .getThreads()
      .then((res) => {
        const threads = Array.isArray(res?.threads) ? res.threads : [];
        setChatUnread(threads.reduce((sum, t: any) => sum + Number(t.student_unread_count || 0), 0));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    loadChatUnread();
  }, [loadChatUnread, location.pathname]);

  useEffect(() => {
    const socket = getSocket();
    const refresh = () => loadChatUnread();
    socket.on('chat:unread_update', refresh);
    socket.on('chat:message', refresh);
    socket.on('chat:read', refresh);
    return () => {
      socket.off('chat:unread_update', refresh);
      socket.off('chat:message', refresh);
      socket.off('chat:read', refresh);
    };
  }, [loadChatUnread]);

  const counts = useMemo(() => {
    const result = countActivity(
      notifications.map((n) => ({
        section: studentSectionFor(n.rawType, n.recordType),
        createdAt: toMs(n.createdAt),
        unread: !n.read
      })),
      seen
    );
    if (chatUnread > 0) result[CHAT_PATH] = chatUnread;
    return result;
  }, [notifications, seen, chatUnread]);

  // Opening a section (or receiving activity while on it) clears its counter
  useEffect(() => {
    const path = location.pathname;
    if (path !== CHAT_PATH && counts[path]) markSectionsSeen(scope, [path]);
  }, [location.pathname, counts, scope]);

  return counts;
}
