import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Grid3x3 } from 'lucide-react';
import { RootState } from '../../store';
import { requestApi } from '../../services/api';
import { useSocketEvent } from '../../hooks/useSocket';
import { RealtimeEvents } from '../../services/socketService';
import { schoolWallTimeToDate, formatTimeInZone, dateKeyInZone } from '../../lib/timezone';

interface WeeklySlot {
  id: number;
  className: string;
  subjectCode?: string;
  subjectName: string;
  teacherName: string;
  weekday: number; // 1 = Monday … 7 = Sunday (school timezone)
  startTime: string; // school wall-clock "HH:MM:SS"
  endTime: string;
}

interface PlacedSlot extends WeeklySlot {
  day: number; // weekday in the student's timezone
  startLabel: string;
  endLabel: string;
  sortKey: string;
}

const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHORT_TO_ISO: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

function isoWeekdayInZone(date: Date, timeZone: string): number {
  const short = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone }).format(date);
  return SHORT_TO_ISO[short] || 1;
}

function hhmmInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(date);
}

/** Date key (YYYY-MM-DD, school calendar) of the given ISO weekday in the current school week. */
function schoolDateForWeekday(weekday: number, schoolTz: string): string {
  const todayKey = dateKeyInZone(new Date(), schoolTz);
  const [y, m, d] = todayKey.split('-').map(Number);
  const todayUtc = Date.UTC(y, m - 1, d);
  const todayWd = isoWeekdayInZone(new Date(), schoolTz);
  return new Date(todayUtc + (weekday - todayWd) * 86400000).toISOString().slice(0, 10);
}

/**
 * Weekly recurring timetable of the student's class, shown as a day × time grid.
 * Periods are defined in the school timezone and displayed in the student's timezone,
 * so a period can move to another day/time for students abroad.
 */
export default function WeeklyTimetableMatrix() {
  const timezone = useSelector((state: RootState) => state.classes.timezone);
  const schoolTimezone = useSelector((state: RootState) => state.classes.schoolTimezone);
  const [slots, setSlots] = useState<WeeklySlot[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    requestApi<WeeklySlot[]>('/api/v1/timetable/my-slots')
      .then((rows) => setSlots(Array.isArray(rows) ? rows : []))
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useSocketEvent(RealtimeEvents.TIMETABLE_CHANGE, load);

  const placed: PlacedSlot[] = useMemo(
    () =>
      slots.map((s) => {
        const date = schoolDateForWeekday(Number(s.weekday), schoolTimezone);
        const start = schoolWallTimeToDate(`${date} ${s.startTime}`, schoolTimezone);
        const end = schoolWallTimeToDate(`${date} ${s.endTime}`, schoolTimezone);
        if (!start || !end) {
          return { ...s, day: Number(s.weekday), startLabel: s.startTime.slice(0, 5), endLabel: s.endTime.slice(0, 5), sortKey: s.startTime };
        }
        return {
          ...s,
          day: isoWeekdayInZone(start, timezone),
          startLabel: formatTimeInZone(start, timezone),
          endLabel: formatTimeInZone(end, timezone),
          sortKey: hhmmInZone(start, timezone)
        };
      }),
    [slots, timezone, schoolTimezone]
  );

  // Monday–Saturday always; Sunday only if a period lands on it
  const days = useMemo(() => {
    const list = [1, 2, 3, 4, 5, 6];
    if (placed.some((p) => p.day === 7)) list.push(7);
    return list;
  }, [placed]);

  // One row per distinct start time (in the student's timezone)
  const rows = useMemo(() => {
    const map = new Map<string, { sortKey: string; startLabel: string; endLabel: string }>();
    for (const p of placed) {
      if (!map.has(p.sortKey)) map.set(p.sortKey, { sortKey: p.sortKey, startLabel: p.startLabel, endLabel: p.endLabel });
    }
    return Array.from(map.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [placed]);

  const today = isoWeekdayInZone(new Date(), timezone);
  const className = slots[0]?.className;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Grid3x3 className="w-5 h-5" />
          </div>
          <div>
            <div className="font-headings font-bold text-base text-foreground">Weekly Class Timetable</div>
            <div className="text-xs text-muted-foreground">Your regular periods across the week</div>
          </div>
        </div>
        {className && (
          <span className="text-xs font-bold text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full">
            {className}
          </span>
        )}
      </div>

      <div className="bg-card border border-border rounded-md shadow-sm overflow-x-auto">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading weekly timetable…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No weekly timetable has been published for your class yet.</div>
        ) : (
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="bg-muted/60">
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground text-center w-28">Time</th>
                {days.map((d) => (
                  <th
                    key={d}
                    className={`px-3 py-3 text-xs font-bold uppercase tracking-wide text-center ${
                      d === today ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    {DAY_NAMES[d]}
                    {d === today ? ' (Today)' : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.sortKey} className="border-t border-border">
                  <td className="px-4 py-3 text-center align-middle">
                    <div className="font-mono font-bold text-sm text-foreground">{row.startLabel}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">– {row.endLabel}</div>
                  </td>
                  {days.map((d) => {
                    const cell = placed.filter((p) => p.day === d && p.sortKey === row.sortKey);
                    return (
                      <td key={d} className={`p-2 align-top ${d === today ? 'bg-primary/[0.03]' : ''}`}>
                        {cell.length === 0 ? (
                          <div className="h-full min-h-[84px] rounded-md border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground/60">
                            Free Period
                          </div>
                        ) : (
                          cell.map((p) => (
                            <div
                              key={p.id}
                              className={`min-h-[84px] rounded-md border p-2.5 shadow-sm ${
                                d === today ? 'border-primary/40 bg-card' : 'border-border bg-card'
                              }`}
                            >
                              {p.subjectCode && (
                                <span className="inline-block text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-sm mb-1">
                                  {p.subjectCode}
                                </span>
                              )}
                              <div className="font-headings font-bold text-sm text-foreground leading-tight">{p.subjectName}</div>
                              <div className="text-xs text-muted-foreground truncate">{p.teacherName}</div>
                              <div className="text-[10px] text-muted-foreground mt-1">
                                {p.startLabel} – {p.endLabel}
                              </div>
                            </div>
                          ))
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Times are shown in your timezone ({timezone}). Holidays and cancelled lessons appear in the daily view above.
      </p>
    </div>
  );
}
