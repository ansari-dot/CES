import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  addNotification,
  addToast,
  fetchTeacherNotificationsThunk
} from '../store/slices/uiSlice';
import { TimetableLesson } from '../types';

function parseLessonStartMs(lesson: TimetableLesson): number | null {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const lessonDate = lesson.date || todayStr;
    let timeStr = (lesson.startTime || '').trim();

    if (!timeStr) return null;

    if (timeStr.includes('AM') || timeStr.includes('PM')) {
      const [time, modifier] = timeStr.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (modifier === 'PM' && hours < 12) hours += 12;
      if (modifier === 'AM' && hours === 12) hours = 0;
      timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
    } else if (timeStr.length === 5) {
      timeStr = `${timeStr}:00`;
    }

    const d = new Date(`${lessonDate}T${timeStr}`);
    return isNaN(d.getTime()) ? null : d.getTime();
  } catch {
    return null;
  }
}

export function useLessonReminderTicker() {
  const dispatch = useAppDispatch();
  const lessons = useAppSelector((state) => state.timetable.lessons);
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const notifiedKeysRef = useRef<Set<string>>(new Set());
  const seenNotifIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  // 1. Fast operational notification polling ticker (every 5 seconds)
  useEffect(() => {
    if (!isAuthenticated) return;

    const pollNotifications = async () => {
      try {
        const actionResult = await dispatch(fetchTeacherNotificationsThunk()).unwrap();
        if (Array.isArray(actionResult)) {
          const unreadList = actionResult.filter((n) => !n.read);

          if (!isInitialLoadRef.current) {
            for (const notif of unreadList) {
              if (!seenNotifIdsRef.current.has(notif.id)) {
                // Instantly pop toast for newly arrived operational notification
                dispatch(
                  addToast({
                    title: notif.title,
                    message: notif.message,
                    type: 'info'
                  })
                );
              }
            }
          } else {
            isInitialLoadRef.current = false;
          }

          seenNotifIdsRef.current = new Set(actionResult.map((n) => n.id));
        }
      } catch {
        // Quiet fallback
      }
    };

    pollNotifications();
    const interval = setInterval(pollNotifications, 5000);
    return () => clearInterval(interval);
  }, [isAuthenticated, dispatch]);

  // 2. 5-minute advance live lesson reminder ticker
  useEffect(() => {
    if (!isAuthenticated || !lessons || lessons.length === 0) return;

    const checkReminders = () => {
      const now = Date.now();

      for (const lesson of lessons) {
        if (lesson.status === 'completed') continue;

        const startMs = parseLessonStartMs(lesson);
        if (!startMs) continue;

        const diffMinutes = (startMs - now) / 60000;

        // Trigger 5-minute advance notification window: 0 to 5 minutes before scheduled start
        if (diffMinutes > 0 && diffMinutes <= 5.0) {
          const notifKey = `remind-5m-${lesson.id}-${lesson.date}`;
          if (!notifiedKeysRef.current.has(notifKey)) {
            notifiedKeysRef.current.add(notifKey);

            dispatch(
              addNotification({
                id: notifKey,
                title: 'Live Lesson Starts in 5 Minutes',
                message: `Your live lesson for ${lesson.className} (${lesson.subject}) starts in 5 minutes. Prepare to launch the classroom link.`,
                type: 'zoom',
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                read: false,
                targetTab: 'dashboard',
              })
            );

            dispatch(
              addToast({
                title: 'Class in 5 Minutes',
                message: `Your live lesson for ${lesson.className} (${lesson.subject}) starts in 5 minutes!`,
                type: 'info',
              })
            );
          }
        }
      }
    };

    // Run check immediately and every 15 seconds
    checkReminders();
    const interval = setInterval(checkReminders, 15000);
    return () => clearInterval(interval);
  }, [isAuthenticated, lessons, dispatch]);
}
