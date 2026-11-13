import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardList, AlertTriangle } from 'lucide-react';
import { requestApi } from '../../services/api';
import { useSocketEvent } from '../../hooks/useSocket';
import { RealtimeEvents } from '../../services/socketService';
import { useAppSelector } from '../../store';
import { parseUtcInstant, getBrowserTimeZone, DEFAULT_SCHOOL_TIMEZONE } from '../../lib/timezone';

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  ON_TRACK: { label: 'On Track', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  DUE_SOON: { label: 'Due Soon', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  PENDING: { label: 'Pending', cls: 'bg-amber-50 text-amber-800 border-amber-200' },
  OVERDUE: { label: 'Overdue', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  COMPLETED: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  EXCUSED: { label: 'Excused', cls: 'bg-slate-50 text-slate-600 border-slate-200' },
  RETURNED: { label: 'Returned', cls: 'bg-sky-50 text-sky-700 border-sky-200' }
};

const TYPE_LABELS: Record<string, string> = {
  ASSIGNMENT_GRADING: 'Assignment grading',
  QUIZ_MANUAL_GRADING: 'Written quiz answers',
  MARKS_UPLOAD: 'Exam marks upload'
};

function Pill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] || { label: status, cls: 'bg-slate-50 text-slate-600 border-slate-200' };
  return <span className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-bold ${s.cls}`}>{s.label}</span>;
}

function duration(ms: number) {
  const minutes = Math.round(ms / 60000);
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${minutes % 60}m` : `${minutes}m`;
}

/**
 * My Academic Responsibilities: monthly targets set by the Principal and grading deadlines,
 * calculated from what the teacher actually published and graded (read-only).
 */
export const AcademicResponsibilitiesCard: React.FC = () => {
  const tz = (useAppSelector((s: any) => s.timetable?.timezone) as string) || getBrowserTimeZone() || DEFAULT_SCHOOL_TIMEZONE;
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    requestApi<any>('/api/v1/accountability/me')
      .then((res) => {
        setData(res);
        setError(false);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useSocketEvent(RealtimeEvents.NOTIFICATION_CREATED, load);

  const fmt = (iso: string | null) => {
    const d = parseUtcInstant(iso);
    return d
      ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: tz }).format(d)
      : '—';
  };

  if (error || !data) return null;
  if (data.requirements.length === 0 && data.grading.length === 0) return null;

  const openGrading = data.grading.filter((g: any) => g.pending > 0 || g.returned > 0);
  const overdueItems = data.grading.reduce((s: number, g: any) => s + g.overdue, 0);
  const completedGroups = data.grading.filter((g: any) => g.status === 'COMPLETED').length;

  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 p-5 shadow-xs space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#36348e]/10 text-[#36348e] flex items-center justify-center">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-black text-slate-900">My Academic Responsibilities · {data.period}</div>
            <div className="text-xs text-slate-500">Targets set by the Principal. Progress updates when you publish and grade work.</div>
          </div>
        </div>
        {overdueItems > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold">
            <AlertTriangle className="w-3.5 h-3.5" /> {overdueItems} overdue grading
          </span>
        )}
      </div>

      {data.requirements.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-1.5">Class · Subject</th>
                <th className="text-center">Quizzes</th>
                <th className="text-center">Assignments</th>
                <th className="text-center">Tests</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.requirements.map((r: any) => (
                <tr key={r.id}>
                  <td className="py-2 font-semibold text-slate-800">
                    {r.className} · {r.subjectName}
                    {r.isExcused && <span className="block text-[10px] font-normal text-slate-500">Excused: {r.excuseReason}</span>}
                  </td>
                  {(['quizzes', 'assignments', 'tests'] as const).map((k) => {
                    const c = r.categories[k];
                    return (
                      <td key={k} className="text-center font-mono">
                        {c.required === 0 ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          <>
                            <span className={c.completed >= c.required ? 'text-emerald-700 font-bold' : 'text-slate-800'}>
                              {c.completed}/{c.required}
                            </span>
                            {c.remaining > 0 && <div className="text-[10px] text-slate-500 font-sans">{c.remaining} left</div>}
                          </>
                        )}
                      </td>
                    );
                  })}
                  <td>
                    <Pill status={r.status === 'NOT_REQUIRED' ? 'COMPLETED' : r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openGrading.length > 0 && (
        <div>
          <div className="text-xs font-bold text-slate-800 mb-1.5">Grading to finish</div>
          <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
            {openGrading.map((g: any) => (
              <li key={g.key} className="px-3 py-2 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <div className="font-semibold text-slate-800 truncate">{g.title}</div>
                  <div className="text-[10px] text-slate-500">
                    {TYPE_LABELS[g.type] || g.type} · {g.className || ''} · {g.pending} of {g.total} still to grade
                    {g.returned ? ` · ${g.returned} returned for revision` : ''}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <Pill status={g.status} />
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    Due {fmt(g.earliestEffectiveDeadline)}
                    {g.earliestEffectiveDeadline !== g.earliestOriginalDeadline && ' (extended)'}
                    {g.overdue > 0 && <span className="text-rose-700 font-semibold"> · {duration(g.maxOverdueMs)} late</span>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {completedGroups > 0 && (
        <p className="text-[11px] text-slate-500">{completedGroups} grading item(s) completed this month.</p>
      )}
    </div>
  );
};
