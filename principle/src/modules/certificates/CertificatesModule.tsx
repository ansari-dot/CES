import React, { useCallback, useEffect, useState } from 'react';
import { ScrollText, Eye, Ban, Download, Layers, Tags, History, ChevronLeft, ChevronRight } from 'lucide-react';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { LoadingState, ErrorState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import { certificatesAdminApi, AdminCertificate, AdminCategory } from '../../services/certificatesApi';
import { CertificateTemplatesTab } from './CertificateTemplatesTab';
import { CertificateCategoriesTab } from './CertificateCategoriesTab';
import { CertificateAuditTab } from './CertificateAuditTab';

type Tab = 'issued' | 'templates' | 'categories' | 'audit';

const formatDate = (v: string) =>
  v ? new Date(`${String(v).slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/** School-wide certificate oversight, template & category management (Principal / Admin). */
export const CertificatesModule: React.FC = () => {
  const [tab, setTab] = useState<Tab>('issued');

  return (
    <div className="space-y-4">
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Student Certificates</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Certificates issued by teachers, template designs and categories. Disabling a template only affects future certificates.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {([
            ['issued', 'Issued Certificates', ScrollText],
            ['templates', 'Templates', Layers],
            ['categories', 'Categories', Tags],
            ['audit', 'Audit History', History]
          ] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 border transition-colors ${
                tab === id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={1.75} /> {label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'issued' && <IssuedCertificatesTab />}
      {tab === 'templates' && <CertificateTemplatesTab />}
      {tab === 'categories' && <CertificateCategoriesTab />}
      {tab === 'audit' && <CertificateAuditTab />}
    </div>
  );
};

const IssuedCertificatesTab: React.FC = () => {
  const toast = useToast();
  const [items, setItems] = useState<AdminCertificate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({ search: '', teacherId: '', classId: '', categoryId: '', status: '', from: '', to: '' });
  const [searchDraft, setSearchDraft] = useState('');
  const [teachers, setTeachers] = useState<{ id: number; name: string }[]>([]);
  const [classes, setClasses] = useState<{ id: number; name: string }[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [detail, setDetail] = useState<AdminCertificate | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<AdminCertificate | null>(null);
  const [revoking, setRevoking] = useState(false);

  useEffect(() => {
    certificatesAdminApi.teachers().then((t) => setTeachers(Array.isArray(t) ? t : [])).catch(() => {});
    certificatesAdminApi.classes().then((c) => setClasses(Array.isArray(c) ? c : [])).catch(() => {});
    certificatesAdminApi.categories().then(setCategories).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await certificatesAdminApi.issued({ ...filters, page, limit: 100 });
      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      setError(err?.message || 'Failed to load certificates');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  const setFilter = (key: keyof typeof filters, value: string) => {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value }));
  };

  const openDetail = async (c: AdminCertificate) => {
    try {
      setDetail(await certificatesAdminApi.details(c.id));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load certificate');
    }
  };

  const handleRevoke = async (reason: string) => {
    if (!revokeTarget) return;
    try {
      setRevoking(true);
      const updated = await certificatesAdminApi.revoke(revokeTarget.id, reason);
      toast.success(`Certificate ${updated.certificateNumber} revoked. The record is kept for audit.`);
      setRevokeTarget(null);
      if (detail?.id === updated.id) setDetail(updated);
      load();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to revoke certificate');
    } finally {
      setRevoking(false);
    }
  };

  const columns: Column<AdminCertificate>[] = [
    {
      key: 'certificate',
      header: 'Certificate',
      render: (c) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900 text-xs">{c.certificateTitle}</span>
          <span className="font-mono text-[10px] text-slate-500">{c.certificateNumber}</span>
          <span className="text-[11px] text-slate-500 truncate max-w-[260px]" title={c.achievementTitle}>{c.achievementTitle}</span>
        </div>
      )
    },
    {
      key: 'student',
      header: 'Student',
      render: (c) => (
        <div className="flex flex-col text-xs">
          <span className="font-semibold text-slate-900">{c.studentName}</span>
          <span className="text-[11px] text-slate-500">{c.className}</span>
        </div>
      )
    },
    { key: 'issuedBy', header: 'Issued By', render: (c) => <span className="text-xs text-slate-700">{c.issuedBy}</span> },
    { key: 'category', header: 'Category', render: (c) => <span className="text-xs text-slate-600">{c.categoryName}</span> },
    { key: 'issueDate', header: 'Issue Date', width: '110px', render: (c) => <span className="font-mono text-xs text-slate-700">{formatDate(c.issueDate)}</span> },
    { key: 'status', header: 'Status', align: 'center', render: (c) => <StatusBadge status={c.status === 'REVOKED' ? 'Revoked' : 'Active'} /> },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (c) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => openDetail(c)}
            title="View certificate & history"
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shadow-2xs"
          >
            <Eye className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
          {c.status === 'ACTIVE' && (
            <button
              onClick={() => setRevokeTarget(c)}
              title="Revoke certificate"
              className="p-1.5 rounded-lg border border-rose-200 bg-rose-50/60 text-rose-700 hover:bg-rose-100 transition-colors shadow-2xs"
            >
              <Ban className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          )}
        </div>
      )
    }
  ];

  const select = 'text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none shadow-2xs';

  if (loading && items.length === 0) return <LoadingState message="Loading issued certificates..." rows={6} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <>
      <DataTable
        columns={columns}
        data={items}
        keyExtractor={(c) => String(c.id)}
        searchPlaceholder="Filter the loaded rows…"
        searchFilter={(c, q) => c.studentName.toLowerCase().includes(q) || c.certificateNumber.toLowerCase().includes(q)}
        emptyTitle="No certificates found"
        emptyDescription="Certificates issued by teachers appear here."
        filtersSlot={
          <div className="flex items-center gap-2 flex-wrap">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setFilter('search', searchDraft.trim());
              }}
            >
              <input
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder="Student or certificate ID ⏎"
                className={`${select} w-48`}
              />
            </form>
            <select value={filters.teacherId} onChange={(e) => setFilter('teacherId', e.target.value)} className={select}>
              <option value="">All teachers</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <select value={filters.classId} onChange={(e) => setFilter('classId', e.target.value)} className={select}>
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select value={filters.categoryId} onChange={(e) => setFilter('categoryId', e.target.value)} className={select}>
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} className={select}>
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="REVOKED">Revoked</option>
            </select>
            <input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} className={select} title="Issued from" />
            <input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} className={select} title="Issued to" />
          </div>
        }
      />
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-slate-500">
          <span>{total} certificates · page {page} of {totalPages}</span>
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="p-1.5 rounded-lg border border-slate-200 bg-white disabled:opacity-40">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {detail && (
        <Modal
          isOpen
          onClose={() => setDetail(null)}
          title={`${detail.certificateTitle} · ${detail.certificateNumber}`}
          description={`${detail.studentName} · ${detail.className} · issued by ${detail.issuedBy} on ${formatDate(detail.issueDate)}`}
          maxWidth="4xl"
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-xs">
            <iframe src={detail.pdfUrl} title={detail.certificateNumber} className="lg:col-span-2 w-full h-[60vh] border border-slate-200 rounded-xl bg-slate-50" />
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">Status</span><StatusBadge status={detail.status === 'REVOKED' ? 'Revoked' : 'Active'} /></div>
                <div className="flex justify-between gap-2"><span className="text-slate-500">Category</span><span className="text-right">{detail.categoryName}</span></div>
                <div className="flex justify-between gap-2"><span className="text-slate-500">Template</span><span className="text-right">{detail.templateName} (v{detail.templateVersion})</span></div>
                {detail.subjectName && <div className="flex justify-between"><span className="text-slate-500">Subject</span><span>{detail.subjectName}</span></div>}
                {detail.academicYear && <div className="flex justify-between"><span className="text-slate-500">Academic year</span><span>{detail.academicYear}</span></div>}
                <div className="pt-1 text-slate-700 break-words">{detail.achievementTitle}</div>
                {detail.achievementDescription && <div className="text-slate-500 break-words">{detail.achievementDescription}</div>}
                {detail.revokeReason && <div className="text-rose-700 break-words">Revoked: {detail.revokeReason}</div>}
              </div>
              <div>
                <div className="font-semibold text-slate-800 mb-1.5">History</div>
                <div className="space-y-1.5">
                  {(detail.history || []).map((h, i) => (
                    <div key={i} className="p-2 rounded-lg border border-slate-200 bg-white">
                      <div className="flex justify-between"><span className="font-semibold">{h.action}</span><span className="text-slate-400">{new Date(h.at).toLocaleString()}</span></div>
                      <div className="text-slate-500">{h.actorName}{h.actorRole ? ` (${h.actorRole})` : ''}</div>
                      {h.reason && <div className="text-slate-600 break-words">{h.reason}</div>}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <a href={`${detail.pdfUrl}?download=1`} className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Download
                </a>
                {detail.status === 'ACTIVE' && (
                  <button onClick={() => setRevokeTarget(detail)} className="flex-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center gap-1.5">
                    <Ban className="w-3.5 h-3.5" /> Revoke
                  </button>
                )}
              </div>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        isOpen={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        onConfirm={handleRevoke}
        title="Revoke certificate?"
        message={
          revokeTarget
            ? `${revokeTarget.certificateNumber} for ${revokeTarget.studentName} will be marked revoked. The student can no longer download it, but the record and its history are kept.`
            : ''
        }
        requireReason
        confirmLabel="Revoke Certificate"
        isDestructive
        loading={revoking}
      />
    </>
  );
};
