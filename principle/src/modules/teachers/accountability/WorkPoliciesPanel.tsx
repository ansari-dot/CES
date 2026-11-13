import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Pencil, X, History } from 'lucide-react';
import { requestApi } from '../../../services/api';
import { useToast } from '../../../context/ToastContext';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { formatDateOnly } from '../../../lib/timezone';

interface Policy {
  id: number;
  name: string;
  scopeType: 'SCHOOL' | 'CLASS' | 'SUBJECT' | 'CLASS_SUBJECT' | 'TEACHER';
  classId: number | null;
  className: string | null;
  subjectId: number | null;
  subjectName: string | null;
  teacherId: number | null;
  teacherName: string | null;
  termId: number | null;
  requiredQuizzes: number;
  requiredAssignments: number;
  requiredTests: number;
  countDrafts: boolean;
  assignmentGradingDays: number | null;
  quizGradingDays: number | null;
  marksUploadDays: number | null;
  feedbackRequired: boolean;
  dueSoonHours: number;
  notifyTeacher: boolean;
  notifyPrincipal: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  version: number;
  history: { version: number; reason: string | null; at: string }[];
}

const SCOPE_LABELS: Record<string, string> = {
  SCHOOL: 'School-wide default',
  CLASS: 'Selected class',
  SUBJECT: 'Selected subject (all classes)',
  CLASS_SUBJECT: 'Class + subject',
  TEACHER: 'Selected teacher'
};

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const emptyForm = () => ({
  name: '',
  scopeType: 'SCHOOL' as Policy['scopeType'],
  classId: '',
  subjectId: '',
  teacherId: '',
  termId: '',
  requiredQuizzes: '0',
  requiredAssignments: '0',
  requiredTests: '0',
  countDrafts: false,
  assignmentGradingDays: '',
  quizGradingDays: '',
  marksUploadDays: '',
  feedbackRequired: false,
  dueSoonHours: '24',
  notifyTeacher: true,
  notifyPrincipal: true,
  effectiveFrom: todayKey(),
  effectiveTo: '',
  changeReason: ''
});

export const WorkPoliciesPanel: React.FC = () => {
  const toast = useToast();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: number; name: string }[]>([]);
  const [teachers, setTeachers] = useState<{ id: number; name: string }[]>([]);
  const [terms, setTerms] = useState<{ id: number; name: string }[]>([]);
  const [editing, setEditing] = useState<Policy | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [historyOf, setHistoryOf] = useState<Policy | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPolicies((await requestApi<Policy[]>('/api/v1/accountability/policies')) || []);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load policies');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
    requestApi<any[]>('/api/v1/classes').then((r) => setClasses((r || []).map((c) => ({ id: Number(c.id), name: String(c.name) })))).catch(() => undefined);
    requestApi<any[]>('/api/v1/subjects').then((r) => setSubjects((r || []).map((s) => ({ id: Number(s.id), name: String(s.name) })))).catch(() => undefined);
    requestApi<any[]>('/api/v1/teachers')
      .then((r) => {
        const seen = new Set<number>();
        setTeachers(
          (r || [])
            .map((t) => ({ id: Number(t.id), name: String(t.name || t.fullName || '') }))
            .filter((t) => t.id && !seen.has(t.id) && seen.add(t.id))
        );
      })
      .catch(() => undefined);
    requestApi<any[]>('/api/v1/sessions')
      .then(async (sessions) => {
        const current = (sessions || []).find((s) => Number(s.is_current ?? s.isCurrent));
        if (!current) return;
        const rows = await requestApi<any[]>(`/api/v1/sessions/${current.id}/terms`);
        setTerms((rows || []).map((t) => ({ id: Number(t.id), name: String(t.name) })));
      })
      .catch(() => undefined);
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const openEdit = (p: Policy) => {
    setEditing(p);
    setForm({
      name: p.name,
      scopeType: p.scopeType,
      classId: p.classId ? String(p.classId) : '',
      subjectId: p.subjectId ? String(p.subjectId) : '',
      teacherId: p.teacherId ? String(p.teacherId) : '',
      termId: p.termId ? String(p.termId) : '',
      requiredQuizzes: String(p.requiredQuizzes),
      requiredAssignments: String(p.requiredAssignments),
      requiredTests: String(p.requiredTests),
      countDrafts: p.countDrafts,
      assignmentGradingDays: p.assignmentGradingDays === null ? '' : String(p.assignmentGradingDays),
      quizGradingDays: p.quizGradingDays === null ? '' : String(p.quizGradingDays),
      marksUploadDays: p.marksUploadDays === null ? '' : String(p.marksUploadDays),
      feedbackRequired: p.feedbackRequired,
      dueSoonHours: String(p.dueSoonHours),
      notifyTeacher: p.notifyTeacher,
      notifyPrincipal: p.notifyPrincipal,
      effectiveFrom: p.effectiveFrom,
      effectiveTo: p.effectiveTo || '',
      changeReason: ''
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      classId: form.classId || null,
      subjectId: form.subjectId || null,
      teacherId: form.teacherId || null,
      termId: form.termId || null,
      requiredQuizzes: Number(form.requiredQuizzes || 0),
      requiredAssignments: Number(form.requiredAssignments || 0),
      requiredTests: Number(form.requiredTests || 0),
      assignmentGradingDays: form.assignmentGradingDays === '' ? null : Number(form.assignmentGradingDays),
      quizGradingDays: form.quizGradingDays === '' ? null : Number(form.quizGradingDays),
      marksUploadDays: form.marksUploadDays === '' ? null : Number(form.marksUploadDays),
      dueSoonHours: Number(form.dueSoonHours || 24),
      effectiveTo: form.effectiveTo || null
    };
    try {
      setSaving(true);
      if (editing) {
        await requestApi(`/api/v1/accountability/policies/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        toast.success('Policy updated. A new version was saved; closed months keep the version that applied.');
      } else {
        await requestApi('/api/v1/accountability/policies', { method: 'POST', body: JSON.stringify(payload) });
        toast.success('Policy created. Monthly requirements are now tracked automatically.');
      }
      setOpen(false);
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save policy');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (p: Policy) => {
    try {
      await requestApi(`/api/v1/accountability/policies/${p.id}/status`, { method: 'PATCH', body: JSON.stringify({ active: !p.isActive }) });
      toast.success(p.isActive ? 'Policy deactivated.' : 'Policy activated.');
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to change policy status');
    }
  };

  const input = 'w-full border border-slate-300 rounded-lg p-2 bg-white';
  const scopeText = (p: Policy) =>
    p.scopeType === 'SCHOOL'
      ? 'All teachers'
      : [p.teacherName, p.className, p.subjectName].filter(Boolean).join(' · ');

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm font-semibold text-slate-900">Teacher Academic Work Policies</div>
            <div className="text-[11px] text-slate-500">
              Set once — applied every month automatically. Precedence: teacher › class + subject › subject › class › school-wide.
            </div>
          </div>
          <button onClick={openNew} className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> New policy
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80 uppercase text-[11px]">
              <tr>
                <th className="px-4 py-2.5">Policy</th>
                <th className="px-4 py-2.5">Applies to</th>
                <th className="px-4 py-2.5 text-center">Monthly targets (Q / A / T)</th>
                <th className="px-4 py-2.5">Grading windows</th>
                <th className="px-4 py-2.5">Effective</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">Loading…</td></tr>
              ) : policies.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">No policies yet. Create a school-wide default to start tracking.</td></tr>
              ) : (
                policies.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/80 align-top">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-slate-900">{p.name}</div>
                      <div className="text-[10px] text-slate-400">v{p.version}{p.feedbackRequired ? ' · feedback mandatory' : ''}{p.countDrafts ? ' · drafts count' : ''}</div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      <div className="font-medium">{SCOPE_LABELS[p.scopeType]}</div>
                      <div className="text-[10px] text-slate-400">{scopeText(p)}</div>
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono">
                      {p.requiredQuizzes} / {p.requiredAssignments} / {p.requiredTests}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      <div>Assignments: {p.assignmentGradingDays === null ? 'not tracked' : `${p.assignmentGradingDays} day(s)`}</div>
                      <div>Quiz written answers: {p.quizGradingDays === null ? 'not tracked' : `${p.quizGradingDays} day(s)`}</div>
                      <div>Exam marks upload: {p.marksUploadDays === null ? 'not tracked' : `${p.marksUploadDays} day(s)`}</div>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {formatDateOnly(p.effectiveFrom)}
                      {p.effectiveTo ? ` → ${formatDateOnly(p.effectiveTo)}` : ' → open'}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={p.isActive ? 'Active' : 'Inactive'} variant={p.isActive ? 'success' : 'neutral'} />
                    </td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(p)} className="px-2 py-0.5 rounded-md border border-slate-200 text-[11px] hover:bg-slate-50 mr-1 inline-flex items-center gap-1">
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                      <button onClick={() => setHistoryOf(p)} className="px-2 py-0.5 rounded-md border border-slate-200 text-[11px] hover:bg-slate-50 mr-1 inline-flex items-center gap-1">
                        <History className="w-3 h-3" /> History
                      </button>
                      <button onClick={() => toggle(p)} className="px-2 py-0.5 rounded-md border border-slate-200 text-[11px] hover:bg-slate-50">
                        {p.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {historyOf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 border border-slate-200 shadow-2xl text-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-slate-900">{historyOf.name} · version history</div>
              <button onClick={() => setHistoryOf(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X className="w-4 h-4" /></button>
            </div>
            <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
              {historyOf.history.map((h) => (
                <li key={h.version} className="px-3 py-2 flex justify-between gap-2">
                  <span className="font-semibold">v{h.version}</span>
                  <span className="text-slate-500 flex-1">{h.reason || '—'}</span>
                  <span className="text-slate-400">{String(h.at).slice(0, 10)}</span>
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-slate-500">Each month's requirements keep the version that applied when that month was tracked.</p>
          </div>
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50">
          <form onSubmit={save} className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 border border-slate-200 shadow-2xl space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-slate-900">{editing ? `Edit policy (creates v${editing.version + 1})` : 'New academic work policy'}</div>
              <button type="button" onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X className="w-4 h-4" /></button>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Policy name *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} placeholder="e.g. Standard monthly workload" />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Applies to</label>
              <select value={form.scopeType} onChange={(e) => setForm({ ...form, scopeType: e.target.value as Policy['scopeType'] })} className={input}>
                {Object.entries(SCOPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {form.scopeType === 'TEACHER' && (
                <div className="col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">Teacher *</label>
                  <select required value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })} className={input}>
                    <option value="">— Select teacher —</option>
                    {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              {['CLASS', 'CLASS_SUBJECT', 'TEACHER'].includes(form.scopeType) && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Class {form.scopeType === 'TEACHER' ? '(optional)' : '*'}</label>
                  <select required={form.scopeType !== 'TEACHER'} value={form.classId} onChange={(e) => setForm({ ...form, classId: e.target.value })} className={input}>
                    <option value="">{form.scopeType === 'TEACHER' ? 'All their classes' : '— Select —'}</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              {['SUBJECT', 'CLASS_SUBJECT', 'TEACHER'].includes(form.scopeType) && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Subject {form.scopeType === 'TEACHER' ? '(optional)' : '*'}</label>
                  <select required={form.scopeType !== 'TEACHER'} value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })} className={input}>
                    <option value="">{form.scopeType === 'TEACHER' ? 'All their subjects' : '— Select —'}</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Monthly targets (per class and subject)</label>
              <div className="grid grid-cols-3 gap-2">
                {(['requiredQuizzes', 'requiredAssignments', 'requiredTests'] as const).map((k, i) => (
                  <label key={k} className="block">
                    <span className="text-[11px] text-slate-500">{['Quizzes', 'Assignments', 'Tests'][i]}</span>
                    <input type="number" min="0" max="100" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className={input} />
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-2 mt-1.5 text-slate-600">
                <input type="checkbox" checked={form.countDrafts} onChange={(e) => setForm({ ...form, countDrafts: e.target.checked })} />
                Count unpublished drafts towards targets (normally off)
              </label>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Grading deadlines (school days after submission; empty = not tracked)</label>
              <div className="grid grid-cols-3 gap-2">
                {(['assignmentGradingDays', 'quizGradingDays', 'marksUploadDays'] as const).map((k, i) => (
                  <label key={k} className="block">
                    <span className="text-[11px] text-slate-500">{['Assignments', 'Quiz written answers', 'Exam marks upload'][i]}</span>
                    <input type="number" min="0" max="60" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className={input} />
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 mt-1">School holidays and the teacher's approved leave are skipped. Auto-graded MCQ answers never create grading work.</p>
              <label className="flex items-center gap-2 mt-1.5 text-slate-600">
                <input type="checkbox" checked={form.feedbackRequired} onChange={(e) => setForm({ ...form, feedbackRequired: e.target.checked })} />
                Written feedback is mandatory for grading to count as complete
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="block font-medium text-slate-700 mb-1">Effective from *</span>
                <input type="date" required value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} className={input} />
              </label>
              <label className="block">
                <span className="block font-medium text-slate-700 mb-1">Effective until</span>
                <input type="date" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} className={input} />
              </label>
              <label className="block col-span-2">
                <span className="block font-medium text-slate-700 mb-1">Term (optional)</span>
                <select value={form.termId} onChange={(e) => setForm({ ...form, termId: e.target.value })} className={input}>
                  <option value="">Whole academic year</option>
                  {terms.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
            </div>

            <div className="p-2.5 border border-slate-200 rounded-lg space-y-1.5">
              <div className="font-medium text-slate-700">Reminders</div>
              <label className="flex items-center gap-2 text-slate-600">
                <input type="checkbox" checked={form.notifyTeacher} onChange={(e) => setForm({ ...form, notifyTeacher: e.target.checked })} />
                Remind teachers (new requirements, due soon, overdue, extensions)
              </label>
              <label className="flex items-center gap-2 text-slate-600">
                <input type="checkbox" checked={form.notifyPrincipal} onChange={(e) => setForm({ ...form, notifyPrincipal: e.target.checked })} />
                Alert Principal/Admin about overdue grading and missed targets
              </label>
              <label className="flex items-center gap-2 text-slate-600">
                "Due soon" reminder
                <input type="number" min="1" max="168" value={form.dueSoonHours} onChange={(e) => setForm({ ...form, dueSoonHours: e.target.value })} className="w-16 border border-slate-300 rounded-md p-1" />
                hours before the deadline
              </label>
            </div>

            {editing && (
              <label className="block">
                <span className="block font-medium text-slate-700 mb-1">Reason for change</span>
                <input value={form.changeReason} onChange={(e) => setForm({ ...form, changeReason: e.target.value })} className={input} />
              </label>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-50">
                {saving ? 'Saving…' : editing ? 'Save new version' : 'Create policy'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
