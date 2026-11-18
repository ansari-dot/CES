import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Edit2, Eye, Power, Archive, RotateCcw } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import { certificatesAdminApi, AdminTemplate, AdminCategory, SUPPORTED_PLACEHOLDERS } from '../../services/certificatesApi';

const STATUS_LABEL: Record<AdminTemplate['status'], string> = { ACTIVE: 'Active', INACTIVE: 'Inactive', ARCHIVED: 'Archived' };
const ASSETS: { field: 'background' | 'logo' | 'principalSignature'; label: string; has: keyof AdminTemplate; remove: string; limit: string }[] = [
  { field: 'background', label: 'Background artwork (replaces the preset design)', has: 'hasBackground', remove: 'removeBackground', limit: '5 MB' },
  { field: 'logo', label: 'Custom logo (default: school logo)', has: 'hasLogo', remove: 'removeLogo', limit: '2 MB' },
  { field: 'principalSignature', label: 'Principal signature image', has: 'hasPrincipalSignature', remove: 'removePrincipalSignature', limit: '1 MB' }
];

interface FormState {
  categoryId: string;
  name: string;
  certificateTitle: string;
  description: string;
  designPreset: AdminTemplate['designPreset'];
  orientation: AdminTemplate['orientation'];
  pageSize: AdminTemplate['pageSize'];
  primaryColor: string;
  accentColor: string;
  bodyText: string;
  showTeacherSignature: boolean;
  showPrincipalSignature: boolean;
  principalName: string;
}

const DEFAULT_BODY =
  'This certificate is proudly presented to {{student_name}} of {{class_name}} in recognition of {{achievement_title}}. {{achievement_description}}';

const fromTemplate = (t: AdminTemplate | null, categories: AdminCategory[]): FormState => ({
  categoryId: t ? String(t.categoryId) : String(categories.find((c) => c.isActive)?.id || ''),
  name: t?.name || '',
  certificateTitle: t?.certificateTitle || '',
  description: t?.description || '',
  designPreset: t?.designPreset || 'CLASSIC',
  orientation: t?.orientation || 'LANDSCAPE',
  pageSize: t?.pageSize || 'A4',
  primaryColor: t?.primaryColor || '#1b1a47',
  accentColor: t?.accentColor || '#c9a227',
  bodyText: t?.bodyText || DEFAULT_BODY,
  showTeacherSignature: t ? t.showTeacherSignature : true,
  showPrincipalSignature: t ? t.showPrincipalSignature : true,
  principalName: t?.principalName || ''
});

/** Template designs (Principal / Admin). Status changes affect only future certificates. */
export const CertificateTemplatesTab: React.FC = () => {
  const toast = useToast();
  const [templates, setTemplates] = useState<AdminTemplate[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editing, setEditing] = useState<AdminTemplate | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(fromTemplate(null, []));
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [removals, setRemovals] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<AdminTemplate | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [t, c] = await Promise.all([certificatesAdminApi.templates(), certificatesAdminApi.categories()]);
      setTemplates(t);
      setCategories(c);
    } catch (err: any) {
      setError(err?.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const open = (t: AdminTemplate | 'new') => {
    setEditing(t);
    setForm(fromTemplate(t === 'new' ? null : t, categories));
    setFiles({});
    setRemovals({});
  };

  const insertPlaceholder = (p: string) => {
    const el = bodyRef.current;
    const token = `{{${p}}}`;
    if (!el) return setForm((f) => ({ ...f, bodyText: f.bodyText + token }));
    const start = el.selectionStart ?? form.bodyText.length;
    const end = el.selectionEnd ?? start;
    const next = form.bodyText.slice(0, start) + token + form.bodyText.slice(end);
    setForm((f) => ({ ...f, bodyText: next }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const pickFile = (field: string, file: File | null) => {
    if (file && !['image/png', 'image/jpeg'].includes(file.type)) {
      toast.warning('Template images must be PNG or JPEG.');
      return;
    }
    setFiles((f) => ({ ...f, [field]: file }));
    if (file) setRemovals((r) => ({ ...r, [field]: false }));
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.categoryId || form.name.trim().length < 3 || form.certificateTitle.trim().length < 3) {
      return toast.warning('Category, template name and certificate title are required.');
    }
    if (form.bodyText.trim().length < 10) return toast.warning('Enter the certificate body text.');
    const fd = new FormData();
    fd.append('categoryId', form.categoryId);
    fd.append('name', form.name.trim());
    fd.append('certificateTitle', form.certificateTitle.trim());
    fd.append('description', form.description.trim());
    fd.append('designPreset', form.designPreset);
    fd.append('orientation', form.orientation);
    fd.append('pageSize', form.pageSize);
    fd.append('primaryColor', form.primaryColor);
    fd.append('accentColor', form.accentColor);
    fd.append('bodyText', form.bodyText.trim());
    fd.append('showTeacherSignature', String(form.showTeacherSignature));
    fd.append('showPrincipalSignature', String(form.showPrincipalSignature));
    fd.append('principalName', form.principalName.trim());
    for (const a of ASSETS) {
      if (files[a.field]) fd.append(a.field, files[a.field] as File);
      else if (removals[a.field]) fd.append(a.remove, 'true');
    }
    try {
      setSaving(true);
      const { id } = await certificatesAdminApi.saveTemplate(editing === 'new' ? null : (editing as AdminTemplate).id, fd);
      toast.success(editing === 'new' ? 'Template created.' : 'Template saved. Already issued certificates are not changed.');
      setEditing(null);
      await load();
      const fresh = (await certificatesAdminApi.templates()).find((t) => t.id === id);
      if (fresh) setPreview(fresh);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (t: AdminTemplate, status: AdminTemplate['status']) => {
    const verb = status === 'ACTIVE' ? 'activate' : status === 'INACTIVE' ? 'deactivate' : 'archive';
    if (status !== 'ACTIVE' && !window.confirm(`${verb[0].toUpperCase() + verb.slice(1)} "${t.name}"? Teachers will not be able to use it for new certificates. ${t.certificateCount} issued certificate(s) stay valid.`)) return;
    try {
      await certificatesAdminApi.setTemplateStatus(t.id, status);
      toast.success(`Template ${verb}d.`);
      load();
    } catch (err: any) {
      toast.error(err?.message || `Failed to ${verb} template`);
    }
  };

  if (loading) return <LoadingState message="Loading certificate templates..." rows={5} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const visible = templates.filter((t) => (!categoryFilter || String(t.categoryId) === categoryFilter) && (!statusFilter || t.status === statusFilter));
  const select = 'text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none shadow-2xs';
  const input = 'w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-slate-800 focus:outline-none';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={select}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={select}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <button onClick={() => open('new')} className="ml-auto px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-xs">
          <Plus className="w-3.5 h-3.5" /> New Template
        </button>
      </div>

      {visible.length === 0 ? (
        <EmptyState title="No templates" description="Create a template, or change the filters." actionLabel="New Template" onAction={() => open('new')} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visible.map((t) => (
            <div key={t.id} className={`rounded-2xl bg-white border border-slate-200/90 shadow-xs p-4 flex flex-col gap-2 text-xs ${t.status !== 'ACTIVE' ? 'opacity-80' : ''}`}>
              <div className="h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${t.primaryColor}, ${t.accentColor})` }} />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">{t.categoryName}{!t.categoryActive && ' (category inactive)'}</div>
                  <div className="font-semibold text-slate-900">{t.certificateTitle}</div>
                  <div className="text-[11px] text-slate-500">{t.name}</div>
                </div>
                <StatusBadge status={STATUS_LABEL[t.status]} />
              </div>
              <div className="text-[11px] text-slate-500">
                {t.designPreset.charAt(0) + t.designPreset.slice(1).toLowerCase()} · {t.orientation === 'LANDSCAPE' ? 'Landscape' : 'Portrait'} · {t.pageSize} · v{t.version} · {t.certificateCount} issued
              </div>
              <div className="flex gap-1.5 mt-auto pt-1">
                <button onClick={() => setPreview(t)} className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1"><Eye className="w-3.5 h-3.5" /> Preview</button>
                <button onClick={() => open(t)} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100" title="Edit"><Edit2 className="w-3.5 h-3.5" /></button>
                {t.status === 'ACTIVE' ? (
                  <>
                    <button onClick={() => setStatus(t, 'INACTIVE')} className="p-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50" title="Deactivate"><Power className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setStatus(t, 'ARCHIVED')} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100" title="Archive"><Archive className="w-3.5 h-3.5" /></button>
                  </>
                ) : (
                  <button onClick={() => setStatus(t, 'ACTIVE')} className="p-1.5 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50" title="Activate"><RotateCcw className="w-3.5 h-3.5" /></button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {preview && (
        <Modal isOpen onClose={() => setPreview(null)} title={`Template preview · ${preview.name}`} description="Sample data with a PREVIEW watermark. Issued certificates use each student's real details." maxWidth="4xl">
          <iframe src={`${preview.previewUrl}?v=${preview.version}`} title={preview.name} className="w-full h-[70vh] border border-slate-200 rounded-xl bg-slate-50" />
        </Modal>
      )}

      {editing && (
        <Modal isOpen onClose={() => setEditing(null)} title={editing === 'new' ? 'New Certificate Template' : `Edit ${editing.name}`} description="Design changes create a new template version. Certificates already issued keep their original PDF." maxWidth="2xl">
          <form onSubmit={save} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Category *</label>
                <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className={input}>
                  <option value="">Select a category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.isActive ? '' : ' (inactive)'}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-medium mb-1">Template name *</label>
                <input value={form.name} maxLength={150} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} placeholder="e.g. Science Fair Winner (Gold)" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-medium mb-1">Certificate title * (printed heading)</label>
                <input value={form.certificateTitle} maxLength={150} onChange={(e) => setForm({ ...form, certificateTitle: e.target.value })} className={input} placeholder="e.g. Certificate of Achievement" />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-medium mb-1">Description / purpose</label>
                <input value={form.description} maxLength={500} onChange={(e) => setForm({ ...form, description: e.target.value })} className={input} />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Design</label>
                <select value={form.designPreset} onChange={(e) => setForm({ ...form, designPreset: e.target.value as FormState['designPreset'] })} className={input}>
                  <option value="CLASSIC">Classic</option>
                  <option value="MODERN">Modern</option>
                  <option value="ELEGANT">Elegant</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-medium mb-1">Orientation</label>
                <select value={form.orientation} onChange={(e) => setForm({ ...form, orientation: e.target.value as FormState['orientation'] })} className={input}>
                  <option value="LANDSCAPE">Landscape</option>
                  <option value="PORTRAIT">Portrait</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-medium mb-1">Page size</label>
                <select value={form.pageSize} onChange={(e) => setForm({ ...form, pageSize: e.target.value as FormState['pageSize'] })} className={input}>
                  <option value="A4">A4</option>
                  <option value="LETTER">Letter</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-medium mb-1">Primary colour</label>
                <input type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} className="w-full h-8 border border-slate-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-slate-700 font-medium mb-1">Accent colour</label>
                <input type="color" value={form.accentColor} onChange={(e) => setForm({ ...form, accentColor: e.target.value })} className="w-full h-8 border border-slate-200 rounded-lg" />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Certificate text *</label>
              <textarea ref={bodyRef} rows={4} maxLength={1000} value={form.bodyText} onChange={(e) => setForm({ ...form, bodyText: e.target.value })} className={input} />
              <div className="flex flex-wrap gap-1 mt-1.5">
                <span className="text-[10px] text-slate-500 mr-1">Insert:</span>
                {SUPPORTED_PLACEHOLDERS.map((p) => (
                  <button key={p} type="button" onClick={() => insertPlaceholder(p)} className="px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 hover:bg-amber-50 text-[10px] font-mono text-slate-600">
                    {`{{${p}}}`}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Only these placeholders are allowed; values come from school records at issue time. The school logo is drawn automatically.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <label className="flex items-center gap-2 text-slate-700">
                <input type="checkbox" checked={form.showTeacherSignature} onChange={(e) => setForm({ ...form, showTeacherSignature: e.target.checked })} /> Teacher (issuer) signature line
              </label>
              <label className="flex items-center gap-2 text-slate-700">
                <input type="checkbox" checked={form.showPrincipalSignature} onChange={(e) => setForm({ ...form, showPrincipalSignature: e.target.checked })} /> Principal signature line
              </label>
              <div>
                <label className="block text-slate-700 font-medium mb-1">Principal name</label>
                <input value={form.principalName} maxLength={150} onChange={(e) => setForm({ ...form, principalName: e.target.value })} className={input} disabled={!form.showPrincipalSignature} />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="font-semibold text-slate-800">Images (PNG or JPEG)</div>
              {ASSETS.map((a) => {
                const existing = editing !== 'new' && Boolean((editing as AdminTemplate)[a.has]);
                return (
                  <div key={a.field} className="flex flex-wrap items-center gap-2">
                    <span className="w-64 text-slate-600">{a.label} <span className="text-slate-400">(max {a.limit})</span></span>
                    <input type="file" accept="image/png,image/jpeg" onChange={(e) => pickFile(a.field, e.target.files?.[0] || null)} className="text-[11px]" />
                    {existing && !files[a.field] && (
                      <label className="flex items-center gap-1 text-[11px] text-rose-700">
                        <input type="checkbox" checked={Boolean(removals[a.field])} onChange={(e) => setRemovals((r) => ({ ...r, [a.field]: e.target.checked }))} /> Remove current
                      </label>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => setEditing(null)} className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-xs disabled:opacity-50">
                {saving ? 'Saving…' : 'Save & Preview'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
