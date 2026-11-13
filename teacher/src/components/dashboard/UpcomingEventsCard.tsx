import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, PartyPopper } from 'lucide-react';
import { requestApi } from '../../services/api';
import { useSocketEvent } from '../../hooks/useSocket';

const RealtimeEvents = { CALENDAR_UPDATED: 'calendar.updated' } as const;

export interface SchoolCalendarEvent {
  id: number;
  title: string;
  eventType: string;
  isHoliday: boolean;
  startDate: string;
  endDate: string;
  totalDays: number;
  startTime: string | null;
  endTime: string | null;
  description: string | null;
  affectsAllClasses: boolean;
  classesSuspended: boolean;
  isFullDayHoliday: boolean;
}

interface UpcomingResponse {
  today: string;
  events: SchoolCalendarEvent[];
  nextHoliday: SchoolCalendarEvent | null;
}

const TYPE_LABELS: Record<string, string> = {
  VACATION: 'School Vacation',
  PUBLIC_HOLIDAY: 'Public Holiday',
  EMERGENCY_CLOSURE: 'Emergency Holiday',
  SPECIAL_HOLIDAY: 'Special Holiday',
  EXAMINATION: 'Examination',
  SCHOOL_EVENT: 'School Event',
  PARENT_MEETING: 'Parent Meeting',
  ANNOUNCEMENT: 'Announcement',
  INSTITUTIONAL_BREAK: 'Institutional Break',
  EXAM_PREP: 'Exam Preparation'
};

/** School calendar dates are date-only: format them without any timezone shift. */
function formatDateKey(key: string, opts: Intl.DateTimeFormatOptions) {
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}

function rangeLabel(e: SchoolCalendarEvent) {
  const start = formatDateKey(e.startDate, { day: 'numeric', month: 'short' });
  const range = e.startDate === e.endDate ? start : `${start} – ${formatDateKey(e.endDate, { day: 'numeric', month: 'short' })}`;
  return e.startTime && e.endTime ? `${range} · ${e.startTime}–${e.endTime}` : range;
}

export default function UpcomingEventsCard({ classId }: { classId?: number | null }) {
  const [view, setView] = useState<'upcoming' | 'year'>('upcoming');
  const [data, setData] = useState<UpcomingResponse | null>(null);
  const [yearEvents, setYearEvents] = useState<SchoolCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const qs = classId ? `&classId=${classId}` : '';
    try {
      const [upcoming, year] = await Promise.all([
        requestApi<UpcomingResponse>(`/api/v1/calendar/events/upcoming?limitDays=60${qs}`),
        requestApi<SchoolCalendarEvent[]>(`/api/v1/calendar/events${qs ? `?${qs.slice(1)}` : ''}`)
      ]);
      setData(upcoming);
      setYearEvents(Array.isArray(year) ? year : []);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    load();
  }, [load]);

  useSocketEvent(RealtimeEvents.CALENDAR_UPDATED, () => load());

  const today = data?.today || '';
  const todayHoliday = useMemo(
    () => (data?.events || []).find((e) => e.classesSuspended && e.isFullDayHoliday && e.startDate <= today && e.endDate >= today) || null,
    [data, today]
  );

  const yearByMonth = useMemo(() => {
    const groups: { key: string; label: string; events: SchoolCalendarEvent[] }[] = [];
    for (const e of yearEvents) {
      const key = e.startDate.slice(0, 7);
      let g = groups.find((x) => x.key === key);
      if (!g) {
        g = { key, label: formatDateKey(`${key}-01`, { month: 'long', year: 'numeric' }), events: [] };
        groups.push(g);
      }
      g.events.push(e);
    }
    return groups;
  }, [yearEvents]);

  const list = data?.events || [];

  return (
    <div className="bg-card border border-border rounded-md p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="font-headings font-bold text-base text-foreground flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" /> School calendar
        </div>
        <div className="flex bg-muted p-0.5 rounded-sm text-[11px] font-semibold">
          {(['upcoming', 'year'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2.5 py-1 rounded-sm cursor-pointer transition ${view === v ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}
            >
              {v === 'upcoming' ? 'Upcoming' : 'Full year'}
            </button>
          ))}
        </div>
      </div>

      {todayHoliday && (
        <div className="mb-3 rounded-sm border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900 flex items-center gap-2">
          <PartyPopper className="w-4 h-4 shrink-0" />
          <span>
            <span className="font-bold">Today is a school holiday:</span> {todayHoliday.title}. Regular classes are suspended.
          </span>
        </div>
      )}

      {!todayHoliday && data?.nextHoliday && view === 'upcoming' && (
        <div className="mb-3 rounded-sm border border-border bg-muted/50 px-3 py-2 text-xs text-foreground">
          <span className="font-bold">Next holiday:</span> {data.nextHoliday.title} · {rangeLabel(data.nextHoliday)}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading calendar…</p>
      ) : view === 'upcoming' ? (
        list.length === 0 ? (
          <p className="text-xs text-muted-foreground">No school events in the next 60 days.</p>
        ) : (
          <ul className="divide-y divide-border">
            {list.slice(0, 6).map((e) => (
              <EventRow key={e.id} e={e} />
            ))}
          </ul>
        )
      ) : yearByMonth.length === 0 ? (
        <p className="text-xs text-muted-foreground">No events have been published for this academic year.</p>
      ) : (
        <div className="max-h-96 overflow-y-auto pr-1 space-y-3">
          {yearByMonth.map((g) => (
            <div key={g.key}>
              <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1">{g.label}</div>
              <ul className="divide-y divide-border">
                {g.events.map((e) => (
                  <EventRow key={e.id} e={e} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EventRow({ e }: { e: SchoolCalendarEvent }) {
  return (
    <li className="py-2 flex items-start gap-3">
      <div className={`w-11 shrink-0 rounded-sm text-center py-1 ${e.isHoliday ? 'bg-rose-50 text-rose-800' : 'bg-muted text-foreground'}`}>
        <div className="text-sm font-bold leading-none">{formatDateKey(e.startDate, { day: 'numeric' })}</div>
        <div className="text-[10px] uppercase">{formatDateKey(e.startDate, { month: 'short' })}</div>
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-foreground truncate">{e.title}</div>
        <div className="text-[11px] text-muted-foreground">
          {TYPE_LABELS[e.eventType] || e.eventType} · {rangeLabel(e)}
          {!e.affectsAllClasses && ' · Selected classes'}
        </div>
        {e.classesSuspended && (
          <div className="text-[10px] font-semibold text-rose-700 mt-0.5">
            {e.isFullDayHoliday ? 'Classes suspended' : 'Some periods suspended'}
          </div>
        )}
      </div>
    </li>
  );
}
