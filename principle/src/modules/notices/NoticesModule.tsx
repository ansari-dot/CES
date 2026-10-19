import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { SchoolNotice, NoticePriority, NoticeAudience } from '../../types';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { LoadingState, ErrorState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import { BellRing, Plus, Calendar, Users, Eye } from 'lucide-react';

export const NoticesModule: React.FC = () => {
  const [notices, setNotices] = useState<SchoolNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    content: '',
    audience: 'School-Wide' as NoticeAudience,
    targetRoles: ['Teacher', 'Student', 'Parent'] as ('Teacher' | 'Student' | 'Parent')[],
    priority: 'Normal' as NoticePriority,
    status: 'Published' as const,
    expiryDate: ''
  });
  const [creating, setCreating] = useState(false);

  // View Modal
  const [selectedNotice, setSelectedNotice] = useState<SchoolNotice | null>(null);

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

  const handleCreateNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.content) {
      toast.warning('Please provide a title and notice content.');
      return;
    }

    try {
      setCreating(true);
      await api.createNotice({
        title: form.title,
        content: form.content,
        audience: form.audience,
        targetRoles: form.targetRoles,
        priority: form.priority,
        status: form.status,
        expiryDate: form.expiryDate || undefined
      });
      toast.success('Notice published to target portal streams.');
      setIsCreateModalOpen(false);
      setForm({
        title: '',
        content: '',
        audience: 'School-Wide',
        targetRoles: ['Teacher', 'Student', 'Parent'],
        priority: 'Normal',
        status: 'Published',
        expiryDate: ''
      });
      loadNotices();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish notice');
    } finally {
      setCreating(false);
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
          <span className="text-[10px] text-slate-400">{n.targetRoles.join(', ')}</span>
        </div>
      )
    },
    {
      key: 'publishDate',
      header: 'Published',
      width: '110px',
      render: (n) => <span className="font-mono text-slate-500 text-xs">{n.publishDate}</span>
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
      render: (n) => <StatusBadge status={n.status} />
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (n) => (
        <button
          onClick={() => setSelectedNotice(n)}
          title="View full notice text"
          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shadow-2xs"
        >
          <Eye className="w-3.5 h-3.5" strokeWidth={1.75} />
        </button>
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
          onClick={() => setIsCreateModalOpen(true)}
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

      {/* Create Notice Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Publish Official Notice / Circular"
        description="Target specific classes or distribute school-wide across authorized portal roles."
        maxWidth="lg"
      >
        <form onSubmit={handleCreateNotice} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-medium mb-1">Notice Title *</label>
            <input
              type="text"
              required
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

          <div>
            <label className="block text-slate-700 font-medium mb-1">Optional Expiry Date</label>
            <input
              type="date"
              value={form.expiryDate}
              onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 font-mono"
            />
          </div>

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
              {creating ? 'Publishing...' : 'Publish Notice'}
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
          description={`Audience: ${selectedNotice.audience} · Published: ${selectedNotice.publishDate} by ${selectedNotice.createdBy}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-2">
              <StatusBadge status={selectedNotice.priority} />
              <StatusBadge status={selectedNotice.status} />
              <span className="text-slate-400 text-[11px] ml-auto font-mono">
                {selectedNotice.acknowledgedCount || 0} acknowledgements
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">
              {selectedNotice.content}
            </div>

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
    </div>
  );
};
