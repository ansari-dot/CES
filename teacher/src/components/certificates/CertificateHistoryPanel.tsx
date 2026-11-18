import React, { useCallback, useEffect, useState } from 'react';
import { Search, Eye, Download, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { certificatesApi, downloadBlob, IssuedCertificate, CertificateCategory, RecipientData } from '../../services/certificatesApi';
import { CertificatePdfModal } from './CertificatePdfModal';

const formatDate = (v: string) =>
  v ? new Date(`${String(v).slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/** Certificates issued by the signed-in teacher, with search, filters, preview and download. */
export const CertificateHistoryPanel: React.FC<{ refreshKey: number }> = ({ refreshKey }) => {
  const [items, setItems] = useState<IssuedCertificate[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [classId, setClassId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [classes, setClasses] = useState<RecipientData['classes']>([]);
  const [categories, setCategories] = useState<CertificateCategory[]>([]);
  const [preview, setPreview] = useState<IssuedCertificate | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  useEffect(() => {
    certificatesApi.recipients().then((r) => setClasses(r.classes)).catch(() => {});
    certificatesApi.catalog().then(setCategories).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await certificatesApi.issued({ search: appliedSearch, classId, categoryId, from, to, page, limit: 15 });
      setItems(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err: any) {
      setError(err?.message || 'Failed to load issued certificates.');
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, classId, categoryId, from, to, page]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const download = async (c: IssuedCertificate) => {
    try {
      setDownloadingId(c.id);
      downloadBlob(await certificatesApi.pdf(c.id), `${c.certificateNumber}.pdf`);
    } catch (err: any) {
      setError(err?.message || 'Download failed.');
    } finally {
      setDownloadingId(null);
    }
  };

  const select = 'text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white';

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex flex-wrap items-end gap-2">
        <form
          className="flex-1 min-w-[200px] relative"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setAppliedSearch(search.trim());
          }}
        >
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student name or certificate ID, then press Enter"
            className="w-full text-xs border border-slate-200 rounded-lg pl-8 pr-3 py-2"
          />
        </form>
        <select value={classId} onChange={(e) => { setPage(1); setClassId(e.target.value); }} className={select}>
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select value={categoryId} onChange={(e) => { setPage(1); setCategoryId(e.target.value); }} className={select}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <label className="text-[11px] text-slate-500 flex items-center gap-1">
          From <input type="date" value={from} onChange={(e) => { setPage(1); setFrom(e.target.value); }} className={select} />
        </label>
        <label className="text-[11px] text-slate-500 flex items-center gap-1">
          To <input type="date" value={to} onChange={(e) => { setPage(1); setTo(e.target.value); }} className={select} />
        </label>
      </div>

      {error && <div className="mx-4 mt-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">{error}</div>}

      {loading ? (
        <div className="p-10 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading issued certificates…
        </div>
      ) : items.length === 0 ? (
        <div className="p-10 text-center text-xs text-slate-500">
          {appliedSearch || classId || categoryId || from || to ? 'No certificates match these filters.' : 'You have not issued any certificates yet.'}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Certificate</th>
                <th className="px-4 py-2.5">Student</th>
                <th className="px-4 py-2.5">Category</th>
                <th className="px-4 py-2.5">Issued</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-2.5">
                    <div className="font-bold text-slate-900">{c.certificateTitle}</div>
                    <div className="text-slate-500 font-mono text-[10px]">{c.certificateNumber}</div>
                    <div className="text-slate-500 truncate max-w-[240px]" title={c.achievementTitle}>{c.achievementTitle}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-slate-800">{c.studentName}</div>
                    <div className="text-slate-500">{c.className}</div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{c.categoryName}</td>
                  <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{formatDate(c.issueDate)}</td>
                  <td className="px-4 py-2.5">
                    {c.status === 'REVOKED' ? (
                      <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[10px]" title={c.revokeReason || ''}>
                        Revoked
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px]">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1.5">
                      <button type="button" onClick={() => setPreview(c)} className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100" title="Preview">
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={downloadingId === c.id}
                        onClick={() => download(c)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                        title="Download PDF"
                      >
                        {downloadingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>{total} certificates</span>
          <div className="flex items-center gap-1">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {preview && (
        <CertificatePdfModal
          title={`${preview.certificateTitle} · ${preview.studentName}`}
          fileName={`${preview.certificateNumber}.pdf`}
          load={() => certificatesApi.pdf(preview.id)}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
};
