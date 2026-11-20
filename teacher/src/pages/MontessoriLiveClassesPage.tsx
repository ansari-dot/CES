import React, { useCallback, useEffect, useState } from 'react';
import { Sparkles, Video, Loader2, AlertCircle, CalendarDays, Clock, RefreshCw } from 'lucide-react';
import { montessoriApi, MLiveClass, fmtDate } from '../services/montessoriApi';

const card = 'rounded-2xl bg-white border border-slate-200 shadow-xs';
const ghost = 'px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-semibold';
const STATE: Record<MLiveClass['state'], [string, string]> = {
  UPCOMING: ['Upcoming', 'bg-sky-50 text-sky-700 border-sky-200'],
  LIVE: ['Live now', 'bg-emerald-50 text-emerald-700 border-emerald-200'],
  COMPLETED: ['Completed', 'bg-slate-100 text-slate-600 border-slate-200'],
  CANCELLED: ['Cancelled', 'bg-rose-50 text-rose-700 border-rose-200']
};

/**
 * Montessori live classes scheduled by the Principal for the teacher's assigned KG sections.
 * Separate from the regular timetable "Live Classes" page; the server only returns classes of
 * sections the teacher is actively assigned to.
 */
export const MontessoriLiveClassesPage: React.FC = () => {
  const [data, setData] = useState<{ upcoming: MLiveClass[]; previous: MLiveClass[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setData(await montessoriApi.myLiveClasses());
    } catch (err: any) {
      setError(err?.message || 'Failed to load Montessori live classes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Keeps "Live now" and the join state current without a manual refresh
    const timer = window.setInterval(() => montessoriApi.myLiveClasses().then(setData).catch(() => undefined), 60000);
    return () => window.clearInterval(timer);
  }, [load]);

  const timezone = data?.upcoming[0]?.timezone || data?.previous[0]?.timezone || '';

  const row = (c: MLiveClass) => {
    const [label, style] = STATE[c.state];
    return (
      <div key={c.id} className="px-5 py-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-slate-900">{c.title}</span>
            <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-bold ${style}`}>{label}</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span className="font-semibold text-amber-700">{c.sectionName}</span>
            <span className="inline-flex items-center gap-1"><CalendarDays className="w-3 h-3" />{fmtDate(c.date)}</span>
            <span className="inline-flex items-center gap-1 font-mono"><Clock className="w-3 h-3" />{c.startTime} – {c.endTime}</span>
            <span>Teacher: {c.teacherName}</span>
          </div>
          {c.description && <p className="text-xs text-slate-600 mt-1">{c.description}</p>}
          {c.cancelReason && <p className="text-xs text-rose-600 mt-1">Cancelled: {c.cancelReason}</p>}
          {c.canJoin && c.passcode && <p className="text-[11px] text-slate-500 mt-1">Passcode: <span className="font-mono font-bold text-slate-800">{c.passcode}</span></p>}
        </div>
        {c.canJoin && c.joinUrl && (
          <a
            href={c.joinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-[#36348e] hover:bg-[#1b1a47] text-white rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1.5 shrink-0"
          >
            <Video className="w-4 h-4" /> Join Live Class
          </a>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col w-full pb-12 space-y-5 animate-in fade-in duration-150">
      <div className={`${card} p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#36348e] text-white flex items-center justify-center shadow-md shrink-0">
            <Video className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100 inline-flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Montessori
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-[#1e1b4b] tracking-tight mt-1">Montessori Live Classes</h1>
            <p className="text-xs text-slate-500 font-medium">Zoom classes scheduled for your KG sections{timezone ? `. Times are in school time (${timezone}).` : '.'}</p>
          </div>
        </div>
        <button onClick={load} className={`${ghost} inline-flex items-center gap-1.5`}><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
      </div>

      {loading && !data ? (
        <div className={`${card} p-10 text-center text-xs text-slate-500`}><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading…</div>
      ) : error ? (
        <div className={`${card} p-6 text-xs text-rose-700 flex items-center gap-2`}><AlertCircle className="w-4 h-4" />{error}<button onClick={load} className={`${ghost} ml-auto`}>Retry</button></div>
      ) : data ? (
        <>
          <div className={card}>
            <div className="px-5 py-3 border-b border-slate-100 text-sm font-bold text-slate-900">Upcoming</div>
            {data.upcoming.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-slate-500">No Montessori live classes are scheduled for your sections.</p>
            ) : (
              <div className="divide-y divide-slate-100">{data.upcoming.map(row)}</div>
            )}
          </div>
          {data.previous.length > 0 && (
            <div className={card}>
              <div className="px-5 py-3 border-b border-slate-100 text-sm font-bold text-slate-900">Previous</div>
              <div className="divide-y divide-slate-100">{data.previous.map(row)}</div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};
