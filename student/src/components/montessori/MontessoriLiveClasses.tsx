import React, { useCallback, useEffect, useState } from 'react';
import { Video, PhoneCall, Sparkles, XCircle, PlayCircle } from 'lucide-react';
import { requestApi } from '../../services/api';

interface LiveClass {
  id: number;
  sectionName: string;
  teacherName: string;
  title: string;
  description: string | null;
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
  state: 'UPCOMING' | 'LIVE' | 'COMPLETED' | 'CANCELLED';
  canJoin: boolean;
  joinUrl: string | null;
  passcode: string | null;
}
interface LiveData {
  section: { id: number; name: string } | null;
  upcoming: LiveClass[];
  previous: LiveClass[];
}

const fmtDate = (v: string) => new Date(`${v}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * Montessori live classes for the student's current KG section. Renders nothing for
 * students who are not allocated to a Montessori section, so the regular Live Classes
 * page is unchanged for them. The server releases the Zoom link only inside the join window.
 */
export default function MontessoriLiveClasses() {
  const [data, setData] = useState<LiveData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await requestApi<LiveData>('/api/v1/montessori/student/live-classes'));
      setError(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to load Montessori live classes');
    }
  }, []);

  useEffect(() => {
    load();
    // The join link becomes available shortly before the class starts
    const timer = window.setInterval(load, 60000);
    return () => window.clearInterval(timer);
  }, [load]);

  // Not a Montessori student (or not loaded): keep the regular page exactly as it is
  if (!data?.section) return null;

  return (
    <div className="space-y-4">
      <div className="font-headings font-bold text-base text-foreground flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <span>Montessori live classes · {data.section.name}</span>
      </div>

      {error && (
        <div className="bg-card border border-border rounded-md p-4 text-sm text-muted-foreground flex items-center justify-between gap-3">
          <span>{error}</span>
          <button onClick={load} className="text-xs font-semibold text-primary hover:underline cursor-pointer">Retry</button>
        </div>
      )}

      {data.upcoming.length === 0 ? (
        <div className="bg-card border border-border rounded-md p-6 text-center text-sm text-muted-foreground">
          No upcoming Montessori live classes for {data.section.name}.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.upcoming.map((c) => (
            <div key={c.id} className={`bg-card rounded-md p-5 flex flex-col gap-3 shadow-sm ${c.state === 'LIVE' ? 'border-2 border-success' : 'border border-border'}`}>
              <div className="flex gap-4 items-center">
                <div className="w-12 h-12 rounded-sm bg-secondary flex items-center justify-center shrink-0">
                  <Video className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-foreground truncate">{c.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {fmtDate(c.date)} · {c.startTime} – {c.endTime} · {c.teacherName}
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${c.state === 'LIVE' ? 'bg-success-bg text-success' : 'bg-secondary text-primary'}`}>
                  {c.state === 'LIVE' ? 'Live now' : 'Upcoming'}
                </span>
              </div>
              {c.description && <div className="text-xs text-muted-foreground">{c.description}</div>}
              {c.canJoin && c.joinUrl ? (
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={c.joinUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-success hover:bg-emerald-700 text-white text-sm font-bold px-5 py-2.5 rounded-sm inline-flex items-center gap-2 transition shadow-sm"
                  >
                    <PhoneCall className="w-4 h-4" />
                    <span>Join Live Class</span>
                  </a>
                  {c.passcode && <span className="text-xs text-muted-foreground">Passcode: <span className="font-mono font-bold text-foreground">{c.passcode}</span></span>}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">The Join Live Class button appears 10 minutes before the class starts.</div>
              )}
            </div>
          ))}
        </div>
      )}

      {data.previous.length > 0 && (
        <div className="bg-card border border-border rounded-md divide-y divide-border shadow-sm">
          {data.previous.slice(0, 5).map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-5 py-3">
              <div className="w-9 h-9 rounded-sm bg-muted flex items-center justify-center shrink-0">
                {c.state === 'CANCELLED' ? <XCircle className="w-4 h-4 text-muted-foreground" /> : <PlayCircle className="w-4 h-4 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground truncate">{c.title}</div>
                <div className="text-xs text-muted-foreground">
                  {fmtDate(c.date)} · {c.startTime} · {c.teacherName} {c.state === 'CANCELLED' ? '· Cancelled' : '· Completed'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
