import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, PartyPopper, ChevronLeft, ChevronRight } from 'lucide-react';
import { requestApi } from '../services/api';
import { useSocketEvent, RealtimeEvents } from '../services/socketService';

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

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_INITIALS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

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

/** Today's local calendar date (YYYY-MM-DD) on this device. */
function localTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function UpcomingEventsCard({ classId }: { classId?: number | null }) {
  const [view, setView] = useState<'upcoming' | 'year'>('upcoming');
  const [data, setData] = useState<UpcomingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [yearEvents, setYearEvents] = useState<SchoolCalendarEvent[]>([]);
  const [yearLoading, setYearLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const classQs = classId ? `&classId=${classId}` : '';

  const loadUpcoming = useCallback(async () => {
    try {
      setData(await requestApi<UpcomingResponse>(`/api/v1/calendar/events/upcoming?limitDays=60${classQs}`));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [classQs]);

  const loadYear = useCallback(async () => {
    setYearLoading(true);
    try {
      const list = await requestApi<SchoolCalendarEvent[]>(`/api/v1/calendar/events?year=${year}${classQs}`);
      setYearEvents(Array.isArray(list) ? list : []);
    } catch {
      setYearEvents([]);
    } finally {
      setYearLoading(false);
    }
  }, [year, classQs]);

  useEffect(() => {
    loadUpcoming();
  }, [loadUpcoming]);

  useEffect(() => {
    if (view === 'year') loadYear();
  }, [view, loadYear]);

  useSocketEvent(RealtimeEvents.CALENDAR_UPDATED, () => {
    loadUpcoming();
    if (view === 'year') loadYear();
  });

  const today = data?.today || localTodayKey();
  const todayHoliday = useMemo(
    () => (data?.events || []).find((e) => e.classesSuspended && e.isFullDayHoliday && e.startDate <= today && e.endDate >= today) || null,
    [data, today]
  );

  // 12 mini month grids (Monday first), same layout as the Principal's year view
  const yearGrid = useMemo(
    () =>
      MONTH_NAMES.map((name, idx) => {
        const firstWeekday = new Date(Date.UTC(year, idx, 1)).getUTCDay(); // 0 = Sunday
        const offset = (firstWeekday + 6) % 7;
        const daysInMonth = new Date(Date.UTC(year, idx + 1, 0)).getUTCDate();
        const cells: ({ day: number; key: string; events: SchoolCalendarEvent[] } | null)[] = [];
        for (let i = 0; i < offset; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) {
          const key = `${year}-${String(idx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
          cells.push({ day: d, key, events: yearEvents.filter((e) => key >= e.startDate && key <= e.endDate) });
        }
        return { name, idx, cells };
      }),
    [year, yearEvents]
  );

  const selectedEvents = selectedDay ? yearEvents.filter((e) => selectedDay >= e.startDate && selectedDay <= e.endDate) : [];
  const list = data?.events || [];

  return (
    <div className="bg-card border border-border rounded-md p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="font-headings font-bold text-base text-foreground flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" /> School calendar
        </div>
        <div className="flex items-center gap-2">
          {view === 'year' && (
            <div className="flex items-center gap-1 text-xs font-bold text-foreground">
              <button
                onClick={() => {
                  setYear((y) => y - 1);
                  setSelectedDay(null);
                }}
                className="p-1 rounded-sm hover:bg-muted cursor-pointer"
                aria-label="Previous year"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="min-w-10 text-center">{year}</span>
              <button
                onClick={() => {
                  setYear((y) => y + 1);
                  setSelectedDay(null);
                }}
                className="p-1 rounded-sm hover:bg-muted cursor-pointer"
                aria-label="Next year"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
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
      </div>

      {todayHoliday && (
        <div className="mb-3 rounded-sm border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900 flex items-center gap-2">
          <PartyPopper className="w-4 h-4 shrink-0" />
          <span>
            <span className="font-bold">Today is a school holiday:</span> {todayHoliday.title}. Regular classes are suspended.
          </span>
        </div>
      )}

      {view === 'upcoming' ? (
        <>
          {!todayHoliday && data?.nextHoliday && (
            <div className="mb-3 rounded-sm border border-border bg-muted/50 px-3 py-2 text-xs text-foreground">
              <span className="font-bold">Next holiday:</span> {data.nextHoliday.title} · {rangeLabel(data.nextHoliday)}
            </div>
          )}
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading calendar…</p>
          ) : list.length === 0 ? (
            <p className="text-xs text-muted-foreground">No school events in the next 60 days.</p>
          ) : (
            <ul className="divide-y divide-border">
              {list.slice(0, 6).map((e) => (
                <EventRow key={e.id} e={e} />
              ))}
            </ul>
          )}
        </>
      ) : yearLoading && yearEvents.length === 0 ? (
        <p className="text-xs text-muted-foreground">Loading calendar…</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {yearGrid.map((m) => (
              <div key={m.name} className="border border-border rounded-md p-3 bg-card">
                <div className="text-xs font-bold text-foreground mb-2">{m.name}</div>
                <div className="grid grid-cols-7 gap-0.5 text-center text-[9px] font-bold text-muted-foreground mb-1">
                  {WEEKDAY_INITIALS.map((w, i) => (
                    <div key={i}>{w}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {m.cells.map((c, i) => {
                    if (!c) return <div key={`e-${i}`} />;
                    const suspended = c.events.some((e) => e.classesSuspended || e.isHoliday);
                    const hasEvent = c.events.length > 0;
                    const isToday = c.key === today;
                    const isSelected = c.key === selectedDay;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        title={c.events.map((e) => e.title).join(', ') || undefined}
                        onClick={() => setSelectedDay(isSelected ? null : c.key)}
                        className={`h-6 rounded-sm text-[10px] font-bold flex items-center justify-center cursor-pointer transition ${
                          suspended
                            ? 'bg-rose-100 text-rose-800 hover:bg-rose-200'
                            : hasEvent
                            ? 'bg-primary/10 text-primary hover:bg-primary/20'
                            : 'text-foreground/80 hover:bg-muted'
                        } ${isToday ? 'ring-1 ring-primary' : ''} ${isSelected ? 'ring-2 ring-primary' : ''}`}
                      >
                        {c.day}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[11px] font-semibold text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-rose-100" /> Holiday / classes suspended
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-primary/10" /> Event / examination
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm ring-1 ring-primary" /> Today
            </span>
            <span className="ml-auto font-normal">Tap a date to see its events.</span>
          </div>

          {selectedDay && (
            <div className="border border-border rounded-md p-3">
              <div className="text-xs font-bold text-foreground mb-1">
                {formatDateKey(selectedDay, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              {selectedEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground">No school events on this day.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {selectedEvents.map((e) => (
                    <EventRow key={e.id} e={e} />
                  ))}
                </ul>
              )}
            </div>
          )}
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
