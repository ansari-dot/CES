import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, X } from 'lucide-react';
import { requestApi } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { formatDateOnly } from '../../lib/timezone';

interface SalaryProfile {
  id: number;
  teacherId: number;
  teacherName: string;
  employeeNo: string;
  model: 'FIXED' | 'PER_HOUR' | 'PER_LESSON' | 'HYBRID';
  baseAmount: number;
  perHourRate: number;
  perLessonRate: number;
  expectedDutyDays: number | null;
  expectedDutyHours: number | null;
  workingDays: number[] | null;
  dutyStartTime: string | null;
  dutyEndTime: string | null;
  lateGraceMinutes: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  rules: Record<string, any> | null;
  configuredByName: string | null;
}

const MODEL_LABELS: Record<string, string> = {
  FIXED: 'Fixed monthly salary',
  PER_HOUR: 'Hourly (verified hours)',
  PER_LESSON: 'Per completed lesson',
  HYBRID: 'Hybrid (base + per lesson)'
};
const WEEKDAYS = [
  { v: 1, l: 'Mon' }, { v: 2, l: 'Tue' }, { v: 3, l: 'Wed' }, { v: 4, l: 'Thu' }, { v: 5, l: 'Fri' }, { v: 6, l: 'Sat' }, { v: 7, l: 'Sun' }
];

const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const emptyForm = () => ({
  teacherId: '',
  model: 'FIXED' as SalaryProfile['model'],
  baseAmount: '',
  perHourRate: '',
  perLessonRate: '',
  expectedDutyDays: '',
  expectedDutyHours: '',
  workingDays: [1, 2, 3, 4, 5] as number[],
  dutyStartTime: '',
  dutyEndTime: '',
  lateGraceMinutes: '0',
  effectiveFrom: todayKey(),
  effectiveTo: '',
  allowances: '',
  standardDeductions: '',
  absenceDeductionMode: 'NONE',
  absenceDeductionPerDay: '',
  lateDeductionPerInstance: '',
  lateGraceCount: '',
  changeReason: ''
});

export const SalaryProfilesPanel: React.FC = () => {
  const toast = useToast();
  const [profiles, setProfiles] = useState<SalaryProfile[]>([]);
  const [teachers, setTeachers] = useState<{ id: number; name: string; staffIdentifier: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SalaryProfile | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, t] = await Promise.all([
        requestApi<SalaryProfile[]>('/api/v1/duty/salary-profiles'),
        requestApi<any[]>('/api/v1/teachers').catch(() => [])
      ]);
      setProfiles(Array.isArray(p) ? p : []);
      const seen = new Set<number>();
      setTeachers(
        (Array.isArray(t) ? t : [])
          .map((x) => ({ id: Number(x.id), name: String(x.name || x.fullName || ''), staffIdentifier: String(x.staffIdentifier || '') }))
          .filter((x) => x.id && !seen.has(x.id) && seen.add(x.id))
      );
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load salary profiles');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const today = todayKey();
  const currentByTeacher = useMemo(() => {
    const map = new Map<number, SalaryProfile>();
    for (const p of profiles) {
      const active = p.effectiveFrom <= today && (!p.effectiveTo || p.effectiveTo >= today);
      if (active && !map.has(p.teacherId)) map.set(p.teacherId, p);
    }
    return map;
  }, [profiles, today]);

  const openNew = (teacherId?: number) => {
    setEditing(null);
    setForm({ ...emptyForm(), teacherId: teacherId ? String(teacherId) : '' });
    setOpen(true);
  };

  const openEdit = (p: SalaryProfile) => {
    const r = p.rules || {};
    setEditing(p);
    setForm({
      teacherId: String(p.teacherId),
      model: p.model,
      baseAmount: p.baseAmount ? String(p.baseAmount) : '',
      perHourRate: p.perHourRate ? String(p.perHourRate) : '',
      perLessonRate: p.perLessonRate ? String(p.perLessonRate) : '',
      expectedDutyDays: p.expectedDutyDays ? String(p.expectedDutyDays) : '',
      expectedDutyHours: p.expectedDutyHours ? String(p.expectedDutyHours) : '',
      workingDays: p.workingDays || [],
      dutyStartTime: p.dutyStartTime || '',
      dutyEndTime: p.dutyEndTime || '',
      lateGraceMinutes: String(p.lateGraceMinutes || 0),
      effectiveFrom: p.effectiveFrom,
      effectiveTo: p.effectiveTo || '',
      allowances: r.allowances ? String(r.allowances) : '',
      standardDeductions: r.standardDeductions ? String(r.standardDeductions) : '',
      absenceDeductionMode: r.absenceDeductionPerDay ? 'PER_DAY' : String(r.absenceDeductionMode || '').toUpperCase() === 'PRORATA' ? 'PRORATA' : 'NONE',
      absenceDeductionPerDay: r.absenceDeductionPerDay ? String(r.absenceDeductionPerDay) : '',
      lateDeductionPerInstance: r.lateDeductionPerInstance ? String(r.lateDeductionPerInstance) : '',
      lateGraceCount: r.lateGraceCount ? String(r.lateGraceCount) : '',
      changeReason: ''
    });
    setOpen(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.teacherId) return toast.warning('Select a teacher.');
    const n = (v: string) => (v === '' ? null : Number(v));
    const rules: Record<string, any> = {};
    if (n(form.allowances)) rules.allowances = n(form.allowances);
    if (n(form.standardDeductions)) rules.standardDeductions = n(form.standardDeductions);
    if (form.absenceDeductionMode === 'PER_DAY' && n(form.absenceDeductionPerDay)) rules.absenceDeductionPerDay = n(form.absenceDeductionPerDay);
    if (form.absenceDeductionMode === 'PRORATA') rules.absenceDeductionMode = 'PRORATA';
    if (n(form.lateDeductionPerInstance)) rules.lateDeductionPerInstance = n(form.lateDeductionPerInstance);
    if (n(form.lateGraceCount)) rules.lateGraceCount = n(form.lateGraceCount);

    const payload = {
      teacherId: Number(form.teacherId),
      model: form.model,
      baseAmount: n(form.baseAmount) ?? 0,
      perHourRate: n(form.perHourRate) ?? 0,
      perLessonRate: n(form.perLessonRate) ?? 0,
      expectedDutyDays: n(form.expectedDutyDays),
      expectedDutyHours: n(form.expectedDutyHours),
      workingDays: form.workingDays.length ? form.workingDays : null,
      dutyStartTime: form.dutyStartTime || null,
      dutyEndTime: form.dutyEndTime || null,
      lateGraceMinutes: Number(form.lateGraceMinutes || 0),
      effectiveFrom: form.effectiveFrom,
      effectiveTo: form.effectiveTo || null,
      rules: Object.keys(rules).length ? rules : null,
      changeReason: form.changeReason || undefined
    };

    try {
      setSaving(true);
      if (editing) {
        await requestApi(`/api/v1/duty/salary-profiles/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        toast.success('Salary profile updated.');
      } else {
        await requestApi('/api/v1/duty/salary-profiles', { method: 'POST', body: JSON.stringify(payload) });
        toast.success('Salary profile configured. The previous profile was closed and kept in history.');
      }
      setOpen(false);
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save salary profile');
    } finally {
      setSaving(false);
    }
  };

  const input = 'w-full border border-slate-300 rounded-lg p-2 bg-white';

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Teacher Salary Configuration</div>
            <div className="text-[11px] text-slate-500">Salary type, rates, working days and duty hours. Changes are effective-dated; history is preserved.</div>
          </div>
          <button onClick={() => openNew()} className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Configure salary
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80 uppercase text-[11px]">
              <tr>
                <th className="px-4 py-2.5">Teacher</th>
                <th className="px-4 py-2.5">Salary Type</th>
                <th className="px-4 py-2.5 text-right font-mono">Rate / Salary</th>
                <th className="px-4 py-2.5">Working Days / Duty</th>
                <th className="px-4 py-2.5">Effective</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Loading…</td></tr>
              ) : teachers.length === 0 && profiles.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No teachers found.</td></tr>
              ) : (
                (teachers.length ? teachers : Array.from(currentByTeacher.values()).map((p) => ({ id: p.teacherId, name: p.teacherName, staffIdentifier: p.employeeNo }))).map((t) => {
                  const p = currentByTeacher.get(t.id);
                  return (
                    <tr key={t.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-900">{t.name}</div>
                        <div className="font-mono text-[10px] text-slate-400">{t.staffIdentifier}</div>
                      </td>
                      <td className="px-4 py-2.5 text-amber-700 font-medium">{p ? MODEL_LABELS[p.model] : <span className="text-rose-600">Not configured</span>}</td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {p?.model === 'PER_HOUR' && `Rs. ${p.perHourRate.toLocaleString()}/hr`}
                        {p?.model === 'FIXED' && `Rs. ${p.baseAmount.toLocaleString()}/month`}
                        {p?.model === 'PER_LESSON' && `Rs. ${p.perLessonRate.toLocaleString()}/lesson`}
                        {p?.model === 'HYBRID' && `Rs. ${p.baseAmount.toLocaleString()} + ${p.perLessonRate.toLocaleString()}/lesson`}
                        {!p && '—'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {p?.workingDays?.length ? p.workingDays.map((d) => WEEKDAYS.find((w) => w.v === d)?.l).join(', ') : '—'}
                        {p?.dutyStartTime && p?.dutyEndTime && <div className="text-[10px] text-slate-400">{p.dutyStartTime}–{p.dutyEndTime} (school time)</div>}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{p ? `${formatDateOnly(p.effectiveFrom)}${p.effectiveTo ? ` → ${formatDateOnly(p.effectiveTo)}` : ''}` : '—'}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {p && (
                          <button onClick={() => openEdit(p)} className="px-2.5 py-1 rounded-lg text-[11px] border border-slate-200 hover:bg-slate-50 inline-flex items-center gap-1 mr-1 cursor-pointer">
                            <Pencil className="w-3 h-3" /> Edit
                          </button>
                        )}
                        <button onClick={() => openNew(t.id)} className="px-2.5 py-1 rounded-lg text-[11px] bg-slate-900 text-white hover:bg-slate-800 cursor-pointer">
                          {p ? 'New rate' : 'Configure'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50">
          <form onSubmit={save} className="bg-white rounded-2xl max-w-lg w-full max-h-[88vh] overflow-y-auto p-5 border border-slate-200 shadow-2xl space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="text-sm font-bold text-slate-900">{editing ? 'Edit salary profile' : 'Configure teacher salary'}</div>
              <button type="button" onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X className="w-4 h-4" /></button>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Teacher *</label>
              <select required disabled={Boolean(editing)} value={form.teacherId} onChange={(e) => setForm({ ...form, teacherId: e.target.value })} className={input}>
                <option value="">— Select teacher —</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.staffIdentifier})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Salary type *</label>
              <select value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value as SalaryProfile['model'] })} className={input}>
                {Object.entries(MODEL_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(form.model === 'FIXED' || form.model === 'HYBRID') && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Monthly salary (Rs.) *</label>
                  <input type="number" min="0" step="0.01" required value={form.baseAmount} onChange={(e) => setForm({ ...form, baseAmount: e.target.value })} className={input} />
                </div>
              )}
              {form.model === 'PER_HOUR' && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Hourly rate (Rs.) *</label>
                  <input type="number" min="0" step="0.01" required value={form.perHourRate} onChange={(e) => setForm({ ...form, perHourRate: e.target.value })} className={input} />
                </div>
              )}
              {(form.model === 'PER_LESSON' || form.model === 'HYBRID') && (
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Per-lesson rate (Rs.) *</label>
                  <input type="number" min="0" step="0.01" required value={form.perLessonRate} onChange={(e) => setForm({ ...form, perLessonRate: e.target.value })} className={input} />
                </div>
              )}
              <div>
                <label className="block font-medium text-slate-700 mb-1">Expected duty days / month</label>
                <input type="number" min="0" value={form.expectedDutyDays} onChange={(e) => setForm({ ...form, expectedDutyDays: e.target.value })} className={input} />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Expected duty hours / month</label>
                <input type="number" min="0" step="0.5" value={form.expectedDutyHours} onChange={(e) => setForm({ ...form, expectedDutyHours: e.target.value })} className={input} />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Assigned working days</label>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((w) => (
                  <label key={w.v} className={`px-2 py-1 rounded-lg border cursor-pointer ${form.workingDays.includes(w.v) ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600'}`}>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={form.workingDays.includes(w.v)}
                      onChange={(e) =>
                        setForm({ ...form, workingDays: e.target.checked ? [...form.workingDays, w.v].sort() : form.workingDays.filter((d) => d !== w.v) })
                      }
                    />
                    {w.l}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Duty start</label>
                <input type="time" value={form.dutyStartTime} onChange={(e) => setForm({ ...form, dutyStartTime: e.target.value })} className={input} />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Duty end</label>
                <input type="time" value={form.dutyEndTime} onChange={(e) => setForm({ ...form, dutyEndTime: e.target.value })} className={input} />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Late grace (min)</label>
                <input type="number" min="0" value={form.lateGraceMinutes} onChange={(e) => setForm({ ...form, lateGraceMinutes: e.target.value })} className={input} />
              </div>
              <p className="col-span-3 text-[10px] text-slate-500">Duty times are the school's local time and decide late arrival / early departure.</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Effective from *</label>
                <input type="date" required value={form.effectiveFrom} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} className={input} />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Effective to</label>
                <input type="date" value={form.effectiveTo} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} className={input} />
              </div>
            </div>

            <details className="border border-slate-200 rounded-lg p-2.5">
              <summary className="font-medium text-slate-700 cursor-pointer">Payroll policy (optional)</summary>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <label className="block text-slate-600 mb-1">Monthly allowances (Rs.)</label>
                  <input type="number" min="0" value={form.allowances} onChange={(e) => setForm({ ...form, allowances: e.target.value })} className={input} />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Standard deductions (Rs.)</label>
                  <input type="number" min="0" value={form.standardDeductions} onChange={(e) => setForm({ ...form, standardDeductions: e.target.value })} className={input} />
                </div>
                {(form.model === 'FIXED' || form.model === 'HYBRID') && (
                  <>
                    <div className="col-span-2">
                      <label className="block text-slate-600 mb-1">Unapproved absence deduction</label>
                      <select value={form.absenceDeductionMode} onChange={(e) => setForm({ ...form, absenceDeductionMode: e.target.value })} className={input}>
                        <option value="NONE">No deduction</option>
                        <option value="PER_DAY">Fixed amount per absent day</option>
                        <option value="PRORATA">Pro-rata (salary ÷ duty days)</option>
                      </select>
                    </div>
                    {form.absenceDeductionMode === 'PER_DAY' && (
                      <div>
                        <label className="block text-slate-600 mb-1">Per absent day (Rs.)</label>
                        <input type="number" min="0" value={form.absenceDeductionPerDay} onChange={(e) => setForm({ ...form, absenceDeductionPerDay: e.target.value })} className={input} />
                      </div>
                    )}
                    <div>
                      <label className="block text-slate-600 mb-1">Per late arrival (Rs.)</label>
                      <input type="number" min="0" value={form.lateDeductionPerInstance} onChange={(e) => setForm({ ...form, lateDeductionPerInstance: e.target.value })} className={input} />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1">Free late arrivals / month</label>
                      <input type="number" min="0" value={form.lateGraceCount} onChange={(e) => setForm({ ...form, lateGraceCount: e.target.value })} className={input} />
                    </div>
                  </>
                )}
                <p className="col-span-2 text-[10px] text-slate-500">Approved leave and school holidays are never deducted. Leave empty for no deduction.</p>
              </div>
            </details>

            {editing && (
              <div>
                <label className="block font-medium text-slate-700 mb-1">Reason for change</label>
                <input type="text" value={form.changeReason} onChange={(e) => setForm({ ...form, changeReason: e.target.value })} className={input} placeholder="Required if approved payroll exists" />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setOpen(false)} className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-50">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
