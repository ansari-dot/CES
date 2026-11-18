import React, { useCallback, useEffect, useState } from 'react';
import { Eye, History, Paperclip, ChevronLeft, ChevronRight } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { LoadingState, ErrorState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import { openProtectedFile } from '../../services/api';
import { montessoriApi, MSection, MActivity, MProgress, PROGRESS_LABELS, ProgressStatus, fmtDate } from './montessoriApi';
import { MPageHeader, SectionSelect, ProgressBadge, selectCls, errorText } from './MontessoriShared';

function useSectionsAndAreas() {
  const [sections, setSections] = useState<MSection[]>([]);
  const [areas, setAreas] = useState<{ id: number; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([montessoriApi.sections(true), montessoriApi.learningAreas(true)])
      .then(([s, a]) => {
        setSections(s);
        setAreas(a);
      })
      .catch((err) => setError(err?.message || 'Failed to load sections'))
      .finally(() => setLoading(false));
  }, []);
  return { sections, areas, error, loading };
}

const Pager: React.FC<{ page: number; total: number; limit: number; onPage: (p: number) => void }> = ({ page, total, limit, onPage }) => {
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;
  return (
    <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-end gap-2 text-xs text-slate-500">
      <span>{total} records · page {page} of {pages}</span>
      <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="p-1 rounded border border-slate-200 disabled:opacity-30"><ChevronLeft className="w-3.5 h-3.5" /></button>
      <button disabled={page >= pages} onClick={() => onPage(page + 1)} className="p-1 rounded border border-slate-200 disabled:opacity-30"><ChevronRight className="w-3.5 h-3.5" /></button>
    </div>
  );
};

// ---------------------------------------------------------------------------
export const MontessoriActivities: React.FC = () => {
  const toast = useToast();
  const { sections, areas, error, loading } = useSectionsAndAreas();
  const [filters, setFilters] = useState({ sectionId: '' as number | '', learningAreaId: '', status: 'ACTIVE', from: '', to: '', search: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: MActivity[]; total: number; limit: number } | null>(null);
  const [view, setView] = useState<MActivity | null>(null);

  useEffect(() => {
    montessoriApi
      .activities({ ...filters, sectionId: filters.sectionId || undefined, page, limit: 20 })
      .then(setData)
      .catch((err) => toast.error(errorText(err, 'Failed to load activities')));
  }, [filters, page, toast]);

  if (loading) return <LoadingState message="Loading activities..." rows={5} />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  const set = (patch: Partial<typeof filters>) => {
    setPage(1);
    setFilters((f) => ({ ...f, ...patch }));
  };

  return (
    <div className="space-y-4">
      <MPageHeader title="Daily Learning Activities" description="Activities created by Montessori teachers across all sections." />
      <div className="flex flex-wrap items-center gap-2">
        <SectionSelect sections={sections} value={filters.sectionId} onChange={(sectionId) => set({ sectionId })} allowAll />
        <select value={filters.learningAreaId} onChange={(e) => set({ learningAreaId: e.target.value })} className={selectCls}>
          <option value="">All learning areas</option>
          {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => set({ status: e.target.value })} className={selectCls}>
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} className={selectCls} title="From" />
        <input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} className={selectCls} title="To" />
        <input value={filters.search} onChange={(e) => set({ search: e.target.value })} placeholder="Search title…" className={`${selectCls} w-44`} />
      </div>
      <div className="rounded-2xl bg-white border border-slate-200/90 shadow-xs overflow-x-auto">
        {!data || data.items.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-slate-400">No activities found.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-4 py-2 text-left">Activity</th>
                <th className="px-4 py-2 text-left">Area</th>
                <th className="px-4 py-2 text-left">Section</th>
                <th className="px-4 py-2 text-left">Teacher</th>
                <th className="px-4 py-2 text-right">Observations</th>
                <th className="px-4 py-2 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-2 font-mono whitespace-nowrap">{fmtDate(a.activityDate)}</td>
                  <td className="px-4 py-2 font-semibold text-slate-900">{a.title}{a.attachmentUrl && <Paperclip className="inline w-3 h-3 ml-1 text-slate-400" />}</td>
                  <td className="px-4 py-2">{a.learningAreaName}</td>
                  <td className="px-4 py-2">{a.sectionName}</td>
                  <td className="px-4 py-2 text-slate-500">{a.teacherName || '—'}</td>
                  <td className="px-4 py-2 text-right">{a.progressCount ?? 0}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => setView(a)} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"><Eye className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && <Pager page={page} total={data.total} limit={data.limit} onPage={setPage} />}
      </div>
      {view && (
        <Modal isOpen onClose={() => setView(null)} title={view.title} description={`${view.sectionName} · ${view.learningAreaName} · ${fmtDate(view.activityDate)}`} maxWidth="lg">
          <div className="space-y-3 text-xs text-slate-700">
            {view.description && <p className="whitespace-pre-line">{view.description}</p>}
            {view.objectives && (
              <div><div className="font-semibold text-slate-800">Learning objectives</div><p className="whitespace-pre-line">{view.objectives}</p></div>
            )}
            {view.attachmentUrl && (
              <button onClick={() => openProtectedFile(view.attachmentUrl!, view.attachmentName || undefined).catch((e: any) => toast.error(e.message))} className="text-amber-700 hover:underline flex items-center gap-1">
                <Paperclip className="w-3.5 h-3.5" /> {view.attachmentName || 'Attachment'}
              </button>
            )}
            <div className="text-slate-500">Created by {view.teacherName || '—'} · {view.status === 'ARCHIVED' ? 'Archived' : 'Active'}</div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
export const MontessoriProgress: React.FC = () => {
  const toast = useToast();
  const { sections, error, loading } = useSectionsAndAreas();
  const [filters, setFilters] = useState({ sectionId: '' as number | '', status: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: MProgress[]; total: number; limit: number } | null>(null);
  const [history, setHistory] = useState<{ record: MProgress; rows: any[] } | null>(null);

  const load = useCallback(() => {
    montessoriApi
      .progress({ ...filters, sectionId: filters.sectionId || undefined, page, limit: 30 })
      .then(setData)
      .catch((err) => toast.error(errorText(err, 'Failed to load progress')));
  }, [filters, page, toast]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <LoadingState message="Loading progress..." rows={5} />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  const set = (patch: Partial<typeof filters>) => {
    setPage(1);
    setFilters((f) => ({ ...f, ...patch }));
  };

  return (
    <div className="space-y-4">
      <MPageHeader title="Student Progress Tracking" description="Development observations recorded by teachers. Each observation is kept; corrections keep the previous version." />
      <div className="flex flex-wrap items-center gap-2">
        <SectionSelect sections={sections} value={filters.sectionId} onChange={(sectionId) => set({ sectionId })} allowAll />
        <select value={filters.status} onChange={(e) => set({ status: e.target.value })} className={selectCls}>
          <option value="">All statuses</option>
          {(Object.keys(PROGRESS_LABELS) as ProgressStatus[]).map((s) => <option key={s} value={s}>{PROGRESS_LABELS[s]}</option>)}
        </select>
        <input type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} className={selectCls} title="From" />
        <input type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} className={selectCls} title="To" />
      </div>
      <div className="rounded-2xl bg-white border border-slate-200/90 shadow-xs overflow-x-auto">
        {!data || data.items.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-slate-400">No progress records found.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Observed</th>
                <th className="px-4 py-2 text-left">Student</th>
                <th className="px-4 py-2 text-left">Activity</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Teacher remarks</th>
                <th className="px-4 py-2 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 font-mono whitespace-nowrap">{fmtDate(p.observedOn)}</td>
                  <td className="px-4 py-2"><div className="font-semibold text-slate-900">{p.studentName}</div><div className="text-[10px] text-slate-400">{p.sectionName}</div></td>
                  <td className="px-4 py-2"><div>{p.activityTitle}</div><div className="text-[10px] text-slate-400">{p.learningAreaName}</div></td>
                  <td className="px-4 py-2"><ProgressBadge status={p.status} />{p.corrected && <span className="ml-1 text-[10px] text-slate-400">(corrected)</span>}</td>
                  <td className="px-4 py-2 text-slate-600 max-w-xs">
                    <div className="line-clamp-2">{p.remarks || p.observationNotes || '—'}</div>
                    {p.improvementSuggestions && <div className="text-[10px] text-amber-700 line-clamp-1">Suggestion: {p.improvementSuggestions}</div>}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {p.corrected && (
                      <button
                        onClick={async () => {
                          try {
                            setHistory({ record: p, rows: await montessoriApi.progressHistory(p.id) });
                          } catch (err: any) {
                            toast.error(errorText(err, 'Failed to load history'));
                          }
                        }}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                        title="Correction history"
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && <Pager page={page} total={data.total} limit={data.limit} onPage={setPage} />}
      </div>
      {history && (
        <Modal isOpen onClose={() => setHistory(null)} title={`Corrections · ${history.record.studentName}`} description={history.record.activityTitle} maxWidth="lg">
          <div className="divide-y divide-slate-100 text-xs">
            {history.rows.map((h) => (
              <div key={h.id} className="py-2">
                <div className="font-semibold text-slate-800">{h.changedBy || 'Unknown'} · {new Date(h.at).toLocaleString()}</div>
                <div className="text-slate-500">Reason: {h.reason}</div>
                <div className="text-slate-500">Previous: {PROGRESS_LABELS[h.previousValues.status as ProgressStatus]}{h.previousValues.remarks ? ` — “${h.previousValues.remarks}”` : ''}</div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
};
