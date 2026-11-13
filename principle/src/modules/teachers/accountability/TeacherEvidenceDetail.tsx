import React, { useEffect, useState } from 'react';
import { X, ChevronDown, ChevronRight, CalendarClock, FileWarning, ShieldCheck, Info } from 'lucide-react';
import { requestApi } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { formatDateTime, formatDateOnly } from '../../../lib/timezone';
import { CATEGORY_LABELS, OBLIGATION_LABELS, formatDuration, statusMeta } from './shared';

interface Props {
  teacherId: number;
  period: string;
  focusOverdue?: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

type ActionState = { kind: 'extend' | 'excuse'; ids: number[]; title: string } | { kind: 'excuse-req'; reqId: number; title: string } | null;

export const TeacherEvidenceDetail: React.FC<Props> = ({ teacherId, period, focusOverdue, onClose, onChanged }) => {
  const toast = useToast();
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [action, setAction] = useState<ActionState>(null);
  const [reason, setReason] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await requestApi<any>(`/api/v1/accountability/teachers/${teacherId}?period=${period}`);
      setData(res);
      if (focusOverdue) {
        const open: Record<string, boolean> = {};
        (res?.grading || []).forEach((g: any) => {
          if (g.status === 'OVERDUE') open[g.key] = true;
        });
        setExpanded(open);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load teacher performance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, period]);

  const submitAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!action) return;
    if (!reason.trim()) return toast.warning('A reason is required.');
    try {
      setSaving(true);
      if (action.kind === 'extend') {
        if (!newDeadline) return toast.warning('Choose the new deadline.');
        await requestApi('/api/v1/accountability/obligations/extend', {
          method: 'POST',
          body: JSON.stringify({ obligationIds: action.ids, newDeadline: new Date(newDeadline).toISOString(), reason: reason.trim() })
        });
        toast.success('Deadline extended. The original deadline is kept in the history.');
      } else if (action.kind === 'excuse') {
        await requestApi('/api/v1/accountability/obligations/excuse', {
          method: 'POST',
          body: JSON.stringify({ obligationIds: action.ids, reason: reason.trim() })
        });
        toast.success('Grading work excused.');
      } else if (action.kind === 'excuse-req') {
        await requestApi(`/api/v1/accountability/requirements/${action.reqId}/excuse`, {
          method: 'POST',
          body: JSON.stringify({ reason: reason.trim() })
        });
        toast.success('Monthly requirement excused.');
      }
      setAction(null);
      setReason('');
      setNewDeadline('');
      await load();
      onChanged?.();
    } catch (err: any) {
      toast.error(err?.message || 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  const openItems = (g: any) => g.items.filter((i: any) => !['COMPLETED', 'EXCUSED'].includes(i.status)).map((i: any) => i.id);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/50">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto border border-slate-200 shadow-2xl">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white z-10">
          <div>
            <div className="text-sm font-bold text-slate-900">{data?.teacher?.name || 'Teacher'} · Academic work {period}</div>
            <div className="text-[11px] text-slate-500">Every status below is calculated from published work and real submissions.</div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading || !data ? (
          <div className="p-10 text-center text-xs text-slate-400">Loading evidence…</div>
        ) : (
          <div className="p-5 space-y-6 text-xs">
            {/* Context for a fair reading */}
            {(data.context.leaveDays.length > 0 || data.context.holidays.length > 0) && (
              <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 flex gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  {data.context.leaveDays.length > 0 && (
                    <div>
                      Approved leave this month: {data.context.leaveDays.map((d: string) => formatDateOnly(d, { day: '2-digit', month: 'short' })).join(', ')} — targets and deadlines were adjusted.
                    </div>
                  )}
                  {data.context.holidays.length > 0 && (
                    <div>
                      School holidays: {data.context.holidays.map((h: any) => `${h.title} (${formatDateOnly(h.startDate, { day: '2-digit', month: 'short' })}${h.endDate !== h.startDate ? `–${formatDateOnly(h.endDate, { day: '2-digit', month: 'short' })}` : ''})`).join(', ')} — not counted.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Monthly requirements */}
            <section>
              <h3 className="text-sm font-bold text-slate-900 mb-2">Monthly requirements</h3>
              {data.requirements.length === 0 ? (
                <p className="text-slate-500">No active work policy applies to this teacher's classes this month.</p>
              ) : (
                <div className="space-y-3">
                  {data.requirements.map((r: any) => (
                    <div key={r.id} className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="px-3 py-2 bg-slate-50 flex items-center justify-between gap-2 flex-wrap">
                        <div className="font-semibold text-slate-900">
                          {r.className} · {r.subjectName}
                          <span className="ml-2 text-[10px] font-normal text-slate-500">
                            due {formatDateOnly(r.dueDate)}
                            {r.assignedFrom && r.assignedFrom > `${period}-01` ? ` · assigned from ${formatDateOnly(r.assignedFrom)} (target pro-rated)` : ''}
                            {r.policyVersion ? ` · policy v${r.policyVersion}` : ''}
                            {r.isClosed ? ' · month closed' : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusBadge status={statusMeta(r.status).label} variant={statusMeta(r.status).variant} />
                          {!r.isExcused && r.status !== 'COMPLETED' && (
                            <button
                              onClick={() => setAction({ kind: 'excuse-req', reqId: r.id, title: `${r.className} · ${r.subjectName} (${period})` })}
                              className="px-2 py-0.5 rounded-md border border-slate-200 text-[11px] text-slate-600 hover:bg-white"
                            >
                              Excuse
                            </button>
                          )}
                        </div>
                      </div>
                      {r.isExcused && <div className="px-3 py-1.5 text-[11px] text-slate-500 border-b border-slate-100">Excused: {r.excuseReason}</div>}
                      <table className="w-full text-left">
                        <thead className="text-[10px] uppercase text-slate-500 border-b border-slate-100">
                          <tr>
                            <th className="px-3 py-1.5">Requirement</th>
                            <th className="px-3 py-1.5 text-center">Target</th>
                            <th className="px-3 py-1.5 text-center">Completed</th>
                            <th className="px-3 py-1.5">Status</th>
                            <th className="px-3 py-1.5">Published work (evidence)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(['quizzes', 'assignments', 'tests'] as const).map((k) => {
                            const c = r.categories[k];
                            if (!c || c.required === 0) return null;
                            const meta = statusMeta(c.status);
                            return (
                              <tr key={k} className="align-top">
                                <td className="px-3 py-2 font-medium text-slate-800">{CATEGORY_LABELS[k]}</td>
                                <td className="px-3 py-2 text-center font-mono">{c.required}</td>
                                <td className="px-3 py-2 text-center font-mono">{c.completed}</td>
                                <td className="px-3 py-2">
                                  <StatusBadge status={meta.label} variant={meta.variant} />
                                  {c.remaining > 0 && c.status !== 'EXCUSED' && (
                                    <div className="text-[10px] mt-0.5 text-slate-500">
                                      {c.remaining} remaining
                                      {c.status === 'OVERDUE' ? ` — month ended ${formatDateOnly(r.dueDate)}` : c.daysLeft !== undefined ? ` · ${c.daysLeft} day(s) left` : ''}
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-slate-600">
                                  {c.items.length === 0 ? (
                                    <span className="text-slate-400">Nothing published yet</span>
                                  ) : (
                                    <ul className="space-y-0.5">
                                      {c.items.map((i: any) => (
                                        <li key={`${i.source}-${i.id}`}>
                                          {formatDateOnly(i.date, { day: '2-digit', month: 'short' })} · {i.title}
                                          {i.status === 'DRAFT' && <span className="text-amber-700"> (draft)</span>}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Grading responsibilities with exact evidence */}
            <section>
              <h3 className="text-sm font-bold text-slate-900 mb-2">Grading responsibilities</h3>
              {data.grading.length === 0 ? (
                <p className="text-slate-500">No grading obligations for this month.</p>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="text-[10px] uppercase text-slate-500 bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2">Work item</th>
                        <th className="px-3 py-2">Class / Subject</th>
                        <th className="px-3 py-2 text-center">Submissions</th>
                        <th className="px-3 py-2 text-center">Graded</th>
                        <th className="px-3 py-2">Deadline</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.grading.map((g: any) => {
                        const meta = statusMeta(g.status);
                        const isOpen = Boolean(expanded[g.key]);
                        const open = openItems(g);
                        return (
                          <React.Fragment key={g.key}>
                            <tr className={`align-top ${g.status === 'OVERDUE' ? 'bg-rose-50/40' : ''}`}>
                              <td className="px-3 py-2">
                                <button
                                  onClick={() => setExpanded((e) => ({ ...e, [g.key]: !e[g.key] }))}
                                  className="flex items-start gap-1 text-left font-semibold text-slate-900 hover:text-blue-700"
                                >
                                  {isOpen ? <ChevronDown className="w-3.5 h-3.5 mt-0.5" /> : <ChevronRight className="w-3.5 h-3.5 mt-0.5" />}
                                  <span>
                                    {g.title}
                                    <span className="block text-[10px] font-normal text-slate-500">{OBLIGATION_LABELS[g.type] || g.type}</span>
                                  </span>
                                </button>
                              </td>
                              <td className="px-3 py-2 text-slate-600">
                                {g.className || '—'}
                                {g.subjectName ? ` · ${g.subjectName}` : ''}
                              </td>
                              <td className="px-3 py-2 text-center font-mono">{g.total}</td>
                              <td className="px-3 py-2 text-center font-mono">
                                {g.graded}
                                {g.lateCompletions > 0 && <div className="text-[10px] text-amber-700">{g.lateCompletions} late</div>}
                              </td>
                              <td className="px-3 py-2 text-slate-700">
                                {g.earliestOriginalDeadline ? formatDateTime(g.earliestOriginalDeadline) : '—'}
                                {g.earliestEffectiveDeadline && g.earliestEffectiveDeadline !== g.earliestOriginalDeadline && (
                                  <div className="text-[10px] text-sky-700">extended to {formatDateTime(g.earliestEffectiveDeadline)}</div>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <StatusBadge status={meta.label} variant={meta.variant} />
                                {g.overdue > 0 && (
                                  <div className="text-[10px] text-rose-700 mt-0.5 font-semibold">
                                    {g.overdue} ungraded · overdue {formatDuration(g.maxOverdueMs)}
                                  </div>
                                )}
                                {g.overdue === 0 && g.pending > 0 && <div className="text-[10px] text-slate-500 mt-0.5">{g.pending} ungraded</div>}
                              </td>
                              <td className="px-3 py-2 text-right whitespace-nowrap">
                                {open.length > 0 && (
                                  <>
                                    <button
                                      onClick={() => setAction({ kind: 'extend', ids: open, title: g.title })}
                                      className="px-2 py-0.5 rounded-md border border-slate-200 text-[11px] text-slate-700 hover:bg-slate-50 mr-1"
                                    >
                                      Extend
                                    </button>
                                    <button
                                      onClick={() => setAction({ kind: 'excuse', ids: open, title: g.title })}
                                      className="px-2 py-0.5 rounded-md border border-slate-200 text-[11px] text-slate-700 hover:bg-slate-50"
                                    >
                                      Excuse
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>
                            {isOpen && (
                              <tr>
                                <td colSpan={7} className="px-3 pb-3 bg-slate-50/60">
                                  <table className="w-full text-left mt-1">
                                    <thead className="text-[10px] uppercase text-slate-500">
                                      <tr>
                                        <th className="py-1">Student / item</th>
                                        <th>Received</th>
                                        <th>Original deadline</th>
                                        <th>Extended to</th>
                                        <th>Status / evidence</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200/70">
                                      {g.items.map((i: any) => {
                                        const im = statusMeta(i.status);
                                        return (
                                          <tr key={i.id}>
                                            <td className="py-1.5 font-medium text-slate-800">
                                              {i.studentName || g.title}
                                              {i.rollNo ? <span className="text-slate-400"> · Roll {i.rollNo}</span> : null}
                                            </td>
                                            <td>{formatDateTime(i.receivedAt)}</td>
                                            <td>{formatDateTime(i.originalDeadline)}</td>
                                            <td>{i.extendedDeadline ? formatDateTime(i.extendedDeadline) : '—'}</td>
                                            <td>
                                              <span className={`font-semibold ${im.variant === 'danger' ? 'text-rose-700' : im.variant === 'success' ? 'text-emerald-700' : im.variant === 'warning' ? 'text-amber-700' : 'text-slate-600'}`}>
                                                {im.label}
                                              </span>
                                              {i.status === 'OVERDUE' && <span className="text-rose-700"> · late by {formatDuration(i.overdueByMs)}</span>}
                                              {i.status === 'COMPLETED' && (
                                                <span className="text-slate-500">
                                                  {' '}· graded {formatDateTime(i.completedAt)}
                                                  {!i.onTime && <span className="text-amber-700"> ({formatDuration(i.lateByMs)} after deadline)</span>}
                                                </span>
                                              )}
                                              {i.feedbackMissing && <span className="text-amber-700"> · feedback required</span>}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Exceptions history */}
            <section>
              <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-slate-500" /> Approved exceptions
              </h3>
              {data.exceptions.length === 0 ? (
                <p className="text-slate-500">No extensions or excusals recorded.</p>
              ) : (
                <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                  {data.exceptions.map((x: any) => (
                    <li key={x.id} className="px-3 py-2">
                      <span className="font-semibold text-slate-800">{x.type === 'EXTENSION' ? 'Deadline extended' : 'Excused'}</span>
                      <span className="text-slate-500">
                        {' '}· {formatDateTime(x.createdAt)} by {x.approvedBy || 'Principal'}
                        {x.originalDeadline ? ` · original ${formatDateTime(x.originalDeadline)}` : ''}
                        {x.newDeadline ? ` → ${formatDateTime(x.newDeadline)}` : ''}
                      </span>
                      <div className="text-slate-600">Reason: {x.reason}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </div>

      {action && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/40">
          <form onSubmit={submitAction} className="bg-white rounded-2xl max-w-md w-full p-5 border border-slate-200 shadow-2xl space-y-3 text-xs">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              {action.kind === 'extend' ? <CalendarClock className="w-4 h-4" /> : <FileWarning className="w-4 h-4" />}
              {action.kind === 'extend' ? 'Extend grading deadline' : action.kind === 'excuse' ? 'Excuse grading work' : 'Excuse monthly requirement'}
            </div>
            <p className="text-slate-600">
              {action.title}
              {'ids' in action ? ` · ${action.ids.length} open item(s)` : ''}
            </p>
            {action.kind === 'extend' && (
              <div>
                <label className="block font-medium text-slate-700 mb-1">New deadline *</label>
                <input type="datetime-local" required value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2" />
                <p className="text-[10px] text-slate-500 mt-1">The original deadline is kept and shown alongside the extension.</p>
              </div>
            )}
            <div>
              <label className="block font-medium text-slate-700 mb-1">Reason (recorded in the audit history) *</label>
              <textarea required rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className="w-full border border-slate-300 rounded-lg p-2 resize-none" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setAction(null)} className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-50">
                {saving ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
