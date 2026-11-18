import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Edit2, ArrowUp, ArrowDown, Power } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/StateViews';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useToast } from '../../context/ToastContext';
import { montessoriApi, MSection, fmtDate } from './montessoriApi';
import { MPageHeader, inputCls, primaryBtn, ghostBtn, errorText } from './MontessoriShared';

export const MontessoriSections: React.FC = () => {
  const toast = useToast();
  const [sections, setSections] = useState<MSection[]>([]);
  const [areas, setAreas] = useState<{ id: number; name: string; description: string | null; isActive: boolean }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<MSection | 'new' | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [areaForm, setAreaForm] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [s, a] = await Promise.all([montessoriApi.sections(true), montessoriApi.learningAreas(true)]);
      setSections(s);
      setAreas(a);
    } catch (err: any) {
      setError(err?.message || 'Failed to load sections');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = (s: MSection | 'new') => {
    setEditing(s);
    setForm(s === 'new' ? { name: '', description: '' } : { name: s.name, description: s.description || '' });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return toast.warning('Enter a section name.');
    try {
      setSaving(true);
      if (editing === 'new') await montessoriApi.createSection({ name: form.name.trim(), description: form.description.trim() || undefined });
      else if (editing) await montessoriApi.updateSection(editing.id, { name: form.name.trim(), description: form.description.trim() || null });
      toast.success(editing === 'new' ? 'Section created.' : 'Section updated.');
      setEditing(null);
      load();
    } catch (err: any) {
      toast.error(errorText(err, 'Failed to save section'));
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (s: MSection) => {
    if (s.isActive && !window.confirm(`Deactivate ${s.name}? Its history is kept and it can be reactivated later.`)) return;
    try {
      await montessoriApi.setSectionStatus(s.id, !s.isActive);
      toast.success(s.isActive ? `${s.name} deactivated.` : `${s.name} reactivated.`);
      load();
    } catch (err: any) {
      toast.error(errorText(err, 'Failed to change status'));
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const active = [...sections];
    const target = index + dir;
    if (target < 0 || target >= active.length) return;
    [active[index], active[target]] = [active[target], active[index]];
    setSections(active);
    try {
      await montessoriApi.reorderSections(active.map((s) => s.id));
    } catch (err: any) {
      toast.error(errorText(err, 'Failed to reorder'));
      load();
    }
  };

  const addArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (areaForm.trim().length < 2) return;
    try {
      await montessoriApi.saveLearningArea(null, { name: areaForm.trim() });
      setAreaForm('');
      load();
    } catch (err: any) {
      toast.error(errorText(err, 'Failed to add learning area'));
    }
  };

  if (loading) return <LoadingState message="Loading Montessori sections..." rows={5} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-4">
      <MPageHeader
        title="KG Section Management"
        description="Create and organise your school's Montessori sections. Names are your own (e.g. Play Group, Nursery, KG-1)."
        action={
          <button onClick={() => openEdit('new')} className={`${primaryBtn} flex items-center gap-1.5`}>
            <Plus className="w-3.5 h-3.5" /> New Section
          </button>
        }
      />

      {sections.length === 0 ? (
        <EmptyState title="No sections yet" description="Create your first Montessori section." actionLabel="New Section" onAction={() => openEdit('new')} />
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200/90 shadow-xs overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left w-20">Order</th>
                <th className="px-4 py-2 text-left">Section</th>
                <th className="px-4 py-2 text-left">Academic Year</th>
                <th className="px-4 py-2 text-left">Class Teacher</th>
                <th className="px-4 py-2 text-right">Students</th>
                <th className="px-4 py-2 text-center">Status</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sections.map((s, i) => (
                <tr key={s.id} className={s.isActive ? '' : 'bg-slate-50/60 text-slate-500'}>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <button disabled={i === 0} onClick={() => move(i, -1)} className="p-1 rounded border border-slate-200 disabled:opacity-30" title="Move up"><ArrowUp className="w-3 h-3" /></button>
                      <button disabled={i === sections.length - 1} onClick={() => move(i, 1)} className="p-1 rounded border border-slate-200 disabled:opacity-30" title="Move down"><ArrowDown className="w-3 h-3" /></button>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="font-semibold text-slate-900">{s.name}</div>
                    {s.description && <div className="text-[11px] text-slate-500">{s.description}</div>}
                  </td>
                  <td className="px-4 py-2">{s.sessionName}</td>
                  <td className="px-4 py-2">
                    {s.classTeacher ? (
                      <>
                        <div>{s.classTeacher.name}</div>
                        <div className="text-[10px] text-slate-400">since {fmtDate(s.classTeacher.since)}{s.assistants.length ? ` · +${s.assistants.length} assistant(s)` : ''}</div>
                      </>
                    ) : (
                      <span className="text-rose-600">Not assigned</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold">{s.studentCount}</td>
                  <td className="px-4 py-2 text-center"><StatusBadge status={s.isActive ? 'Active' : 'Inactive'} /></td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100" title="Rename / edit"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => toggle(s)} className={`p-1.5 rounded-lg border ${s.isActive ? 'border-rose-200 text-rose-700 hover:bg-rose-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`} title={s.isActive ? 'Deactivate' : 'Reactivate'}>
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="rounded-2xl bg-white border border-slate-200/90 shadow-xs p-4 space-y-3">
        <div>
          <div className="text-xs font-semibold text-slate-800">Learning areas</div>
          <p className="text-[11px] text-slate-500">Teachers choose one of these when creating daily activities.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {areas.map((a) => (
            <button
              key={a.id}
              onClick={async () => {
                try {
                  await montessoriApi.saveLearningArea(a.id, { isActive: !a.isActive });
                  load();
                } catch (err: any) {
                  toast.error(errorText(err, 'Failed to update learning area'));
                }
              }}
              title={a.isActive ? 'Click to hide from teachers' : 'Click to make available'}
              className={`px-2.5 py-1 rounded-lg border text-[11px] ${a.isActive ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-400 line-through'}`}
            >
              {a.name}
            </button>
          ))}
        </div>
        <form onSubmit={addArea} className="flex gap-2 max-w-md">
          <input value={areaForm} onChange={(e) => setAreaForm(e.target.value)} placeholder="Add a learning area (e.g. Phonics)" className={inputCls} maxLength={100} />
          <button className={primaryBtn} type="submit">Add</button>
        </form>
      </div>

      {editing && (
        <Modal isOpen onClose={() => setEditing(null)} title={editing === 'new' ? 'New Montessori Section' : `Edit ${editing.name}`} description="Section names must be unique among active sections in the academic year." maxWidth="md">
          <form onSubmit={save} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Section name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={100} className={inputCls} placeholder="e.g. KG-1" autoFocus />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={500} rows={2} className={inputCls} />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setEditing(null)} className={ghostBtn}>Cancel</button>
              <button type="submit" disabled={saving} className={primaryBtn}>{saving ? 'Saving…' : 'Save Section'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
