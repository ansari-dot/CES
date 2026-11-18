import React, { useCallback, useEffect, useState } from 'react';
import { Plus, Edit2, Power, ArrowUp, ArrowDown } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import { certificatesAdminApi, AdminCategory } from '../../services/certificatesApi';

/** Certificate categories (Principal / Admin). Deactivating never touches issued certificates. */
export const CertificateCategoriesTab: React.FC = () => {
  const toast = useToast();
  const [items, setItems] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminCategory | 'new' | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setItems(await certificatesAdminApi.categories());
    } catch (err: any) {
      setError(err?.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const open = (c: AdminCategory | 'new') => {
    setEditing(c);
    setForm(c === 'new' ? { name: '', description: '' } : { name: c.name, description: c.description || '' });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return toast.warning('Enter a category name.');
    try {
      setSaving(true);
      if (editing === 'new') {
        const maxOrder = items.reduce((m, c) => Math.max(m, c.sortOrder), 0);
        await certificatesAdminApi.saveCategory(null, { name: form.name.trim(), description: form.description.trim() || null, sortOrder: maxOrder + 10 });
      } else if (editing) {
        await certificatesAdminApi.saveCategory(editing.id, { name: form.name.trim(), description: form.description.trim() || null });
      }
      toast.success(editing === 'new' ? 'Category created.' : 'Category updated.');
      setEditing(null);
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (c: AdminCategory) => {
    if (c.isActive && !window.confirm(`Deactivate "${c.name}"? Its templates disappear from the teacher catalog. ${c.certificateCount} issued certificate(s) are not affected.`)) return;
    try {
      await certificatesAdminApi.saveCategory(c.id, { isActive: !c.isActive });
      toast.success(c.isActive ? 'Category deactivated.' : 'Category activated.');
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update category');
    }
  };

  /** Swap display order with the neighbour (two updates). */
  const move = async (index: number, dir: -1 | 1) => {
    const a = items[index];
    const b = items[index + dir];
    if (!a || !b) return;
    try {
      const aOrder = a.sortOrder === b.sortOrder ? b.sortOrder + dir : b.sortOrder;
      await certificatesAdminApi.saveCategory(a.id, { sortOrder: Math.max(0, aOrder) });
      await certificatesAdminApi.saveCategory(b.id, { sortOrder: a.sortOrder });
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reorder');
    }
  };

  if (loading) return <LoadingState message="Loading certificate categories..." rows={5} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const input = 'w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none';

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button onClick={() => open('new')} className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-xs">
          <Plus className="w-3.5 h-3.5" /> New Category
        </button>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No categories" description="Create a certificate category." actionLabel="New Category" onAction={() => open('new')} />
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200/90 shadow-xs overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left w-20">Order</th>
                <th className="px-4 py-2 text-left">Category</th>
                <th className="px-4 py-2 text-right">Templates</th>
                <th className="px-4 py-2 text-right">Issued</th>
                <th className="px-4 py-2 text-center">Status</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((c, i) => (
                <tr key={c.id} className={c.isActive ? '' : 'bg-slate-50/60 text-slate-500'}>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <button disabled={i === 0} onClick={() => move(i, -1)} className="p-1 rounded border border-slate-200 disabled:opacity-30" title="Move up"><ArrowUp className="w-3 h-3" /></button>
                      <button disabled={i === items.length - 1} onClick={() => move(i, 1)} className="p-1 rounded border border-slate-200 disabled:opacity-30" title="Move down"><ArrowDown className="w-3 h-3" /></button>
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="font-semibold text-slate-900">{c.name}</div>
                    {c.description && <div className="text-[11px] text-slate-500">{c.description}</div>}
                  </td>
                  <td className="px-4 py-2 text-right">{c.templateCount}</td>
                  <td className="px-4 py-2 text-right">{c.certificateCount}</td>
                  <td className="px-4 py-2 text-center"><StatusBadge status={c.isActive ? 'Active' : 'Inactive'} /></td>
                  <td className="px-4 py-2">
                    <div className="flex justify-end gap-1.5">
                      <button onClick={() => open(c)} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => toggle(c)} className={`p-1.5 rounded-lg border ${c.isActive ? 'border-rose-200 text-rose-700 hover:bg-rose-50' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`} title={c.isActive ? 'Deactivate' : 'Activate'}>
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

      {editing && (
        <Modal isOpen onClose={() => setEditing(null)} title={editing === 'new' ? 'New Certificate Category' : `Edit ${editing.name}`} maxWidth="md">
          <form onSubmit={save} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Name *</label>
              <input value={form.name} maxLength={100} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} autoFocus />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Description</label>
              <textarea value={form.description} maxLength={500} rows={2} onChange={(e) => setForm({ ...form, description: e.target.value })} className={input} />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setEditing(null)} className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-xs disabled:opacity-50">{saving ? 'Saving…' : 'Save Category'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
