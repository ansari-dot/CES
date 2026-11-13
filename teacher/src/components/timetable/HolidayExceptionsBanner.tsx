import React, { useCallback, useEffect, useState } from 'react';
import { PartyPopper, CalendarX2 } from 'lucide-react';
import { requestApi } from '../../services/api';
import { useSocketEvent } from '../../hooks/useSocket';
import { RealtimeEvents } from '../../services/socketService';
import { useAppDispatch } from '../../store';
import { fetchTeacherLessonsThunk } from '../../store/slices/timetableSlice';

interface HolidayEvent {
  id: number;
  title: string;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  isFullDayHoliday: boolean;
  classesSuspended: boolean;
  affectsAllClasses: boolean;
}

/** School calendar dates are date-only: format without timezone shifting. */
function formatKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
}

/**
 * Date-specific timetable exceptions for the teacher: holidays in the next 14 days that
 * suspend the teacher's classes. The weekly timetable itself is never changed; affected
 * lessons on those dates are shown as cancelled with a holiday reason.
 */
export const HolidayExceptionsBanner: React.FC = () => {
  const dispatch = useAppDispatch();
  const [events, setEvents] = useState<HolidayEvent[]>([]);
  const [today, setToday] = useState('');

  const load = useCallback(() => {
    requestApi<{ today: string; events: HolidayEvent[] }>('/api/v1/calendar/events/upcoming?limitDays=14')
      .then((res) => {
        setToday(res?.today || '');
        setEvents((res?.events || []).filter((e) => e.classesSuspended));
      })
      .catch(() => setEvents([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = () => {
    load();
    dispatch(fetchTeacherLessonsThunk());
  };
  useSocketEvent('calendar.updated', refresh);
  useSocketEvent(RealtimeEvents.TIMETABLE_CHANGE, refresh);

  if (events.length === 0) return null;

  const todayEvent = events.find((e) => e.startDate <= today && e.endDate >= today && e.isFullDayHoliday);

  return (
    <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 shadow-xs space-y-2">
      <div className="flex items-center gap-2 text-rose-900">
        {todayEvent ? <PartyPopper className="w-4 h-4" /> : <CalendarX2 className="w-4 h-4" />}
        <span className="text-sm font-black">
          {todayEvent ? `Today is a school holiday: ${todayEvent.title}` : 'Upcoming holidays affecting your timetable'}
        </span>
      </div>
      <ul className="space-y-1">
        {events.map((e) => (
          <li key={e.id} className="text-xs text-rose-900 flex flex-wrap items-center gap-x-2">
            <span className="font-bold">
              {e.startDate === e.endDate ? formatKey(e.startDate) : `${formatKey(e.startDate)} – ${formatKey(e.endDate)}`}
            </span>
            <span>· {e.title}</span>
            <span className="text-rose-700">
              ·{' '}
              {e.isFullDayHoliday
                ? 'Holiday — regular classes suspended'
                : `Periods ${e.startTime}–${e.endTime} (school time) suspended`}
              {!e.affectsAllClasses && ' for selected classes'}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-rose-700">
        Your weekly timetable is unchanged. Lessons return automatically if a holiday is cancelled.
      </p>
    </div>
  );
};
