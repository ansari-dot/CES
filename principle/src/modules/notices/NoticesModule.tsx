import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { SchoolNotice, NoticePriority, NoticeAudience, NoticeRecipientRole } from '../../types';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { LoadingState, ErrorState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import { Plus, Eye, Pencil, Archive } from 'lucide-react';

const ALL_ROLES: NoticeRecipientRole[] = ['Student', 'Teacher', 'Parent'];

function recipientSummary(roles: NoticeRecipientRole[]): string {
  if (roles.length === 3) return 'Everyone';
  return roles.map((r) => `${r}s`).join(', ');
}

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const emptyForm = () => ({
  title: '',
  content: '',
  audience: 'School-Wide' as NoticeAudience,
  recipientRoles: ['Student', 'Teacher', 'Parent'] as NoticeRecipientRole[],
  priority: 'Normal' as NoticePriority,
  status: 'Published' as 'Published' | 'Draft',
  publishDate: todayStr(),
  expiryDate: ''
});

/** Display status: published notices with a future date or a past expiry are labelled accordingly. */
function displayStatus(n: SchoolNotice): string {
  if (n.status !== 'Published') return n.status;
  const today = todayStr();
  if (n.publishDate > today) return 'Scheduled';
  if (n.expiryDate && n.expiryDate < today) return 'Expired';
  return 'Published';
}

export const NoticesModule: React.FC = () => {
  const [notices, setNotices] = useState<SchoolNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create / Edit Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingNotice, setEditingNotice] = useState<SchoolNotice | null>(null);
  const [originalTargeting, setOriginalTargeting] = useState<{ audience: NoticeAudience; recipientRoles: NoticeRecipientRole[] }>({
    audience: 'School-Wide',
    recipientRoles: ['Student', 'Teacher', 'Parent']
  });
  const [form, setForm] = useState(emptyForm());
  const [creating, setCreating] = useState(false);

  // View Modal
  const [selectedNotice, setSelectedNotice] = useState<SchoolNotice | null>(null);

  // Archive confirmation
  const [archiveTarget, setArchiveTarget] = useState<SchoolNotice | null>(null);
  const [archiving, setArchiving] = useState(false);

  const toast = useToast();

  const loadNotices = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getNotices();
      setNotices(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load notices');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotices();
  }, [loadNotices]);

  const openCreate = () => {
    setEditingNotice(null);
    setForm(emptyForm());
    setIsCreateModalOpen(true);
  };

  const openEdit = (n: SchoolNotice) => {
    const audience: NoticeAudience = /^Class \d$/.test(n.audience) ? n.audience : 'School-Wide';
    const recipientRoles: NoticeRecipientRole[] = n.targetRoles.length ? n.targetRoles : ['Student', 'Teacher', 'Parent'];
    setEditingNotice(n);
    setOriginalTargeting({ audience, recipientRoles });
    setForm({
      title: n.title,
      content: n.content,
      audience,
      recipientRoles,
      priority: n.priority,
      status: n.status === 'Draft' ? 'Draft' : 'Published',
      publishDate: n.publishDate,
      expiryDate: n.expiryDate || ''
    });
    setIsCreateModalOpen(true);
  };

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      toast.warning('Please provide a title and notice content.');
      return;
    }
    if (form.recipientRoles.length === 0) {
      toast.warning('Please select at least one recipient group.');
      return;
    }
    if (form.expiryDate && form.publishDate && form.expiryDate < form.publishDate) {
      toast.warning('The expiry date cannot be before the publication date.');
      return;
    }

    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      audience: form.audience,
      targetRoles: form.recipientRoles,
      priority: form.priority,
      status: form.status,
      publishDate: form.publishDate || undefined,
      expiryDate: form.expiryDate || undefined
    };

    try {
      setCreating(true);
      if (editingNotice) {
        const { audience, targetRoles, ...rest } = payload;
        const targetingChanged =
          form.audience !== originalTargeting.audience ||
          JSON.stringify([...form.recipientRoles].sort()) !== JSON.stringify([...originalTargeting.recipientRoles].sort());
        await api.updateNotice(editingNotice.id, {
          ...rest,
          ...(targetingChanged ? { audience, targetRoles } : {}),
          expiryDate: form.expiryDate || ''
        });
        toast.success('Notice updated.');
      } else {
        await api.createNotice(payload);
        toast.success(
          form.status === 'Draft'
            ? 'Notice saved as draft.'
            : form.publishDate > todayStr()
            ? `Notice scheduled for ${form.publishDate}.`
            : 'Notice published to target portal streams.'
        );
      }
      setIsCreateModalOpen(false);
      setEditingNotice(null);
      setForm(emptyForm());
      loadNotices();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish notice');
    } finally {
      setCreating(false);
    }
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    try {
      setArchiving(true);
      await api.archiveNotice(archiveTarget.id);
      toast.success('Notice archived and withdrawn from recipient portals.');
      setArchiveTarget(null);
      loadNotices();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to archive notice');
    } finally {
      setArchiving(false);
    }
  };

  const columns: Column<SchoolNotice>[] = [
    {
      key: 'title',
      header: 'Title & Summary',
      render: (n) => (
        <div className="flex flex-col max-w-md">
          <span className="font-semibold text-slate-900 leading-snug text-xs">{n.title}</span>
          <span className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{n.content}</span>
        </div>
      )
    },
    {
      key: 'audience',
      header: 'Target Audience',
      render: (n) => (
        <div className="flex flex-col text-xs">
          <span className="font-semibold text-amber-700">{n.audience}</span>
          <span className="text-[10px] text-slate-400">{recipientSummary(n.targetRoles)}</span>
        </div>
      )
    },
    {
      key: 'publishDate',
      header: 'Published',
      width: '110px',
      render: (n) => (
        <div className="flex flex-col">
          <span className="font-mono text-slate-500 text-xs">{n.publishDate}</span>
          {n.expiryDate && <span className="font-mono text-[10px] text-slate-400">until {n.expiryDate}</span>}
        </div>
      )
    },
    {
      key: 'priority',
      header: 'Priority',
      align: 'center',
      render: (n) => <StatusBadge status={n.priority} />
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (n) => <StatusBadge status={displayStatus(n)} />
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (n) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => setSelectedNotice(n)}
            title="View full notice text"
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shadow-2xs"
          >
            <Eye className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
          {n.canManage !== false && n.status !== 'Archived' && (
            <>
              <button
                onClick={() => openEdit(n)}
                title="Edit notice"
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shadow-2xs"
              >
                <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
              <button
                onClick={() => setArchiveTarget(n)}
                title="Archive notice"
                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors shadow-2xs"
              >
                <Archive className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            </>
          )}
        </div>
      )
    }
  ];

  if (loading) return <LoadingState message="Loading school circulars & operational notices..." rows={5} />;
  if (error) return <ErrorState message={error} onRetry={loadNotices} />;

  return (
    <div className="space-y-4">
      {/* Top Header in clean white */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Notices & Official Circulars</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Publish school-wide announcements or class-specific directives directly to Teacher, Student, and Parent portals.
          </p>
        </div>

        <button
          onClick={openCreate}
          className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs shrink-0"
        >
          <Plus className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span>Publish New Notice</span>
        </button>
      </div>

      <DataTable
        columns={columns}
        data={notices}
        keyExtractor={(n) => n.id}
        searchPlaceholder="Search notices by title, keyword, audience..."
        searchFilter={(n, q) =>
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.audience.toLowerCase().includes(q)
        }
      />

      {/* Create / Edit Notice Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={editingNotice ? 'Edit Notice / Circular' : 'Publish Official Notice / Circular'}
        description="Target specific classes or distribute school-wide across authorized portal roles."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateNotice} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-medium mb-1">Notice Title *</label>
            <input
              type="text"
              required
              maxLength={200}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Schedule for First Term Revision Sessions"
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Target Audience *</label>
              <select
                value={form.audience}
                onChange={(e) => setForm({ ...form, audience: e.target.value as NoticeAudience })}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 font-semibold"
              >
                <option value="School-Wide">School-Wide (All Classes)</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
                  <option key={c} value={`Class ${c}`}>Class {c} Only</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Visible To *</label>
              <div className="flex flex-col gap-1.5 mt-1">
                {ALL_ROLES.map((role) => (
                  <label key={role} className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.recipientRoles.includes(role)}
                      onChange={(e) => {
                        const next = e.target.checked
                          ? [...form.recipientRoles, role]
                          : form.recipientRoles.filter((r) => r !== role);
                        setForm({ ...form, recipientRoles: next });
                      }}
                      className="w-3.5 h-3.5 rounded border-slate-300 accent-amber-600"
                    />
                    <span className="text-slate-700 font-medium">{role}s</span>
                  </label>
                ))}
              </div>
              {form.recipientRoles.length === 0 && (
                <p className="text-[10px] text-rose-500 mt-1">Select at least one group.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as NoticePriority })}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800"
              >
                <option value="Normal">Normal</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent Alert</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">Publication Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as 'Published' | 'Draft' })}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800"
              >
                <option value="Published">Publish to recipients</option>
                <option value="Draft">Save as draft (not visible)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Notice Content *</label>
            <textarea
              required
              rows={4}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              placeholder="Enter full announcement prose for the students, faculty, or parents..."
              className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-slate-800 resize-none leading-relaxed"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Publication Date</label>
              <input
                type="date"
                required
                value={form.publishDate}
                onChange={(e) => setForm({ ...form, publishDate: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Optional Expiry Date</label>
              <input
                type="date"
                value={form.expiryDate}
                min={form.publishDate || undefined}
                onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 font-mono"
              />
            </div>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Notices are delivered in-app to the selected recipients' portals (Student, Teacher and Parent). A notice dated in the future becomes visible on its publication date and is withdrawn automatically after its expiry date.
          </p>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-xs"
            >
              {creating
                ? 'Saving...'
                : editingNotice
                ? 'Save Changes'
                : form.status === 'Draft'
                ? 'Save Draft'
                : 'Publish Notice'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Full Notice Modal */}
      {selectedNotice && (
        <Modal
          isOpen={!!selectedNotice}
          onClose={() => setSelectedNotice(null)}
          title={selectedNotice.title}
          description={`Audience: ${selectedNotice.audience} (${recipientSummary(selectedNotice.targetRoles)}) · Published: ${selectedNotice.publishDate} by ${selectedNotice.createdBy}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-2">
              <StatusBadge status={selectedNotice.priority} />
              <StatusBadge status={displayStatus(selectedNotice)} />
              <span className="text-slate-400 text-[11px] ml-auto font-mono">
                {selectedNotice.acknowledgedCount || 0} recipients have read this
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">
              {selectedNotice.content}
            </div>

            {selectedNotice.expiryDate && (
              <p className="text-[11px] text-slate-500">Visible until {selectedNotice.expiryDate}.</p>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedNotice(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        isOpen={!!archiveTarget}
        onClose={() => setArchiveTarget(null)}
        onConfirm={handleArchive}
        title="Archive Notice"
        message={`"${archiveTarget?.title || ''}" will be withdrawn from all recipient portals. It remains in the notice history.`}
        requireReason={false}
        confirmLabel="Archive Notice"
        isDestructive
        loading={archiving}
      />
    </div>
  );
};
