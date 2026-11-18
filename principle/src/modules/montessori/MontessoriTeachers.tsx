import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { UserPlus, History, X } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import { montessoriApi, MSection, MTeacher, MAssignment, fmtDate } from './montessoriApi';
import { MPageHeader, selectCls, inputCls, primaryBtn, ghostBtn, errorText } from './MontessoriShared';

export const MontessoriTeachers: React.FC = () => {
  const toast = useToast();
  const [sections, setSections] = useState<MSection[]>([]);
  const [teachers, setTeachers] = useState<MTeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignFor, setAssignFor] = useState<MSection | null>(null);
  const [form, setForm] = useState({ teacherId: '', role: 'CLASS_TEACHER' as 'CLASS_TEACHER' | 'ASSISTANT', replaceExisting: false, reason: '' });
  const [saving, setSaving] = useState(false);
  const [endTarget, setEndTarget] = useState<{ assignmentId: number; label: string } | null>(null);
  const [history, setHistory] = useState<{ title: string; rows: MAssignment[] } | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [s, t] = await Promise.all([montessoriApi.sections(), montessoriApi.teachers()]);
      setSections(s);
      setTeachers(t);
    } catch (err: any) {
      setError(err?.message || 'Failed to load teachers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openAssign = (s: MSection) => {
    setAssignFor(s);
    setForm({ teacherId: '', role: s.classTeacher ? 'ASSISTANT' : 'CLASS_TEACHER', replaceExisting: false, reason: '' });
  };

  const submitAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignFor || !form.teacherId) return toast.warning('Select a teacher.');
    try {
      setSaving(true);
      await montessoriApi.assignTeacher(assignFor.id, {
        teacherId: Number(form.teacherId),
        role: form.role,
        replaceExisting: form.role === 'CLASS_TEACHER' && form.replaceExisting,
        reason: form.reason.trim() || undefined
      });
      toast.success('Teacher assigned.');
      setAssignFor(null);
      load();
    } catch (err: any) {
      toast.error(errorText(err, 'Failed to assign teacher'));
    } finally {
      setSaving(false);
    }
  };

  const endAssignment = async (reason: string) => {
    if (!endTarget) return;
    try {
      await montessoriApi.endAssignment(endTarget.assignmentId, reason);
      toast.success('Assignment ended. It remains in the assignment history.');
      setEndTarget(null);
      load();
    } catch (err: any) {
      toast.error(errorText(err, 'Failed to end assignment'));
    }
  };

  const showHistory = async (title: string, params: { sectionId?: number; teacherId?: number }) => {
    try {
      setHistory({ title, rows: await montessoriApi.assignments(params) });
    } catch (err: any) {
      toast.error(errorText(err, 'Failed to load history'));
    }
  };

  const filteredTeachers = useMemo(() => teachers.filter((t) => t.name.toLowerCase().includes(search.toLowerCase())), [teachers, search]);

  if (loading) return <LoadingState message="Loading Montessori teachers..." rows={5} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <MPageHeader title="Montessori Teacher Management" description="Class-teacher model: one main teacher per section manages all learning areas; assistants are optional." />

      {sections.length === 0 ? (
        <EmptyState title="No active sections" description="Create a Montessori section first, then assign its teacher." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {sections.map((s) => (
            <div key={s.id} className="rounded-2xl bg-white border border-slate-200/90 shadow-xs p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">{s.name}</div>
                  <div className="text-[11px] text-slate-500">{s.studentCount} students · {s.sessionName}</div>
                </div>
                <button onClick={() => showHistory(`${s.name} — assignment history`, { sectionId: s.id })} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" title="Assignment history">
                  <History className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                <div className="text-[10px] uppercase tracking-wider text-slate-400">Class teacher</div>
                {s.classTeacher ? (
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">{s.classTeacher.name}</span>
                    <button onClick={() => setEndTarget({ assignmentId: s.classTeacher!.assignmentId, label: `${s.classTeacher!.name} as class teacher of ${s.name}` })} className="text-slate-400 hover:text-rose-600" title="End assignment">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <span className="text-rose-600">Not assigned</span>
                )}
              </div>
              {s.assistants.map((a) => (
                <div key={a.assignmentId} className="flex items-center justify-between px-2">
                  <span className="text-slate-700">{a.name} <span className="text-[10px] text-slate-400">(assistant)</span></span>
                  <button onClick={() => setEndTarget({ assignmentId: a.assignmentId, label: `${a.name} as assistant of ${s.name}` })} className="text-slate-400 hover:text-rose-600" title="End assignment">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button onClick={() => openAssign(s)} className={`${ghostBtn} w-full flex items-center justify-center gap-1.5`}>
                <UserPlus className="w-3.5 h-3.5" /> {s.classTeacher ? 'Change teacher / add assistant' : 'Assign class teacher'}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl bg-white border border-slate-200/90 shadow-xs overflow-x-auto">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-slate-800">All teachers</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search teachers…" className={`${selectCls} w-48`} />
        </div>
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-2 text-left">Teacher</th>
              <th className="px-4 py-2 text-left">Montessori sections</th>
              <th className="px-4 py-2 text-right">Montessori students</th>
              <th className="px-4 py-2 text-right">Regular assignments</th>
              <th className="px-4 py-2 text-right">History</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTeachers.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-2">
                  <div className="font-semibold text-slate-900">{t.name}</div>
                  <div className="text-[10px] text-slate-400">{t.employeeNo}</div>
                </td>
                <td className="px-4 py-2">
                  {t.montessoriAssignments.length ? t.montessoriAssignments.map((a) => `${a.sectionName} (${a.role === 'CLASS_TEACHER' ? 'class teacher' : 'assistant'})`).join(', ') : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-2 text-right">{t.montessoriAssignments.reduce((n, a) => n + a.studentCount, 0)}</td>
                <td className="px-4 py-2 text-right">{t.regularAssignmentCount}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => showHistory(`${t.name} — assignment history`, { teacherId: t.id })} className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50">
                    <History className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {assignFor && (
        <Modal isOpen onClose={() => setAssignFor(null)} title={`Assign teacher · ${assignFor.name}`} maxWidth="md">
          <form onSubmit={submitAssign} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Teacher *</label>
              <select value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })} className={`${selectCls} w-full`}>
                <option value="">Select a teacher</option>
                {teachers.filter((t) => t.accountStatus !== 'DEACTIVATED').map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.montessoriAssignments.length ? ` — ${t.montessoriAssignments.map((a) => a.sectionName).join(', ')}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(['CLASS_TEACHER', 'ASSISTANT'] as const).map((r) => (
                <label key={r} className={`p-2.5 rounded-lg border cursor-pointer ${form.role === r ? 'border-amber-500 bg-amber-50/50' : 'border-slate-200'}`}>
                  <input type="radio" className="mr-1.5" checked={form.role === r} onChange={() => setForm({ ...form, role: r })} />
                  {r === 'CLASS_TEACHER' ? 'Class teacher' : 'Assistant teacher'}
                </label>
              ))}
            </div>
            {form.role === 'CLASS_TEACHER' && assignFor.classTeacher && (
              <label className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900">
                <input type="checkbox" checked={form.replaceExisting} onChange={(e) => setForm({ ...form, replaceExisting: e.target.checked })} className="mt-0.5" />
                <span>Replace {assignFor.classTeacher.name} as class teacher (their assignment is ended and kept in history).</span>
              </label>
            )}
            <div>
              <label className="block text-slate-700 font-medium mb-1">Reason / note</label>
              <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} maxLength={300} className={inputCls} />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setAssignFor(null)} className={ghostBtn}>Cancel</button>
              <button type="submit" disabled={saving} className={primaryBtn}>{saving ? 'Assigning…' : 'Assign'}</button>
            </div>
          </form>
        </Modal>
      )}

      {history && (
        <Modal isOpen onClose={() => setHistory(null)} title={history.title} maxWidth="2xl">
          {history.rows.length === 0 ? (
            <p className="text-xs text-slate-500">No assignments recorded.</p>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100 text-xs">
              {history.rows.map((h) => (
                <div key={h.id} className="py-2 flex justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-800">{h.teacherName} · {h.sectionName} <span className="text-slate-400 font-normal">({h.role === 'CLASS_TEACHER' ? 'class teacher' : 'assistant'})</span></div>
                    <div className="text-slate-500">{fmtDate(h.startDate)} → {h.active ? 'present' : fmtDate(h.endDate)}{h.endReason ? ` · ${h.endReason}` : ''}</div>
                  </div>
                  <span className={`text-[10px] font-semibold ${h.active ? 'text-emerald-700' : 'text-slate-400'}`}>{h.active ? 'Active' : 'Ended'}</span>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      <ConfirmDialog
        isOpen={!!endTarget}
        onClose={() => setEndTarget(null)}
        onConfirm={endAssignment}
        title="End this assignment?"
        message={endTarget ? `End ${endTarget.label}? The record stays in the assignment history.` : ''}
        requireReason
        confirmLabel="End Assignment"
        isDestructive
      />
    </div>
  );
};
