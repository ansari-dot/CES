import React, { useCallback, useEffect, useState } from 'react';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/StateViews';
import { certificatesAdminApi, CertificateEvent } from '../../services/certificatesApi';

const ACTIONS: Record<string, { label: string; tone: string }> = {
  ISSUED: { label: 'Issued', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REVOKED: { label: 'Revoked', tone: 'bg-rose-50 text-rose-700 border-rose-200' },
  TEMPLATE_CREATED: { label: 'Template created', tone: 'bg-sky-50 text-sky-700 border-sky-200' },
  TEMPLATE_UPDATED: { label: 'Template updated', tone: 'bg-sky-50 text-sky-700 border-sky-200' },
  TEMPLATE_STATUS: { label: 'Template status', tone: 'bg-amber-50 text-amber-700 border-amber-200' },
  CATEGORY_CREATED: { label: 'Category created', tone: 'bg-violet-50 text-violet-700 border-violet-200' },
  CATEGORY_UPDATED: { label: 'Category updated', tone: 'bg-violet-50 text-violet-700 border-violet-200' }
};

function describe(e: CertificateEvent): string {
  const d = e.details || {};
  switch (e.action) {
    case 'ISSUED':
      return `${e.certificateNumber || ''} to ${e.studentName || 'student'}${d.mode === 'CLASS' ? ' (whole class)' : ''}`;
    case 'REVOKED':
      return `${e.certificateNumber || ''} for ${e.studentName || 'student'}`;
    case 'TEMPLATE_STATUS':
      return `${e.templateName || 'Template'}: ${d.from} → ${d.to}`;
    case 'TEMPLATE_UPDATED':
      return `${e.templateName || 'Template'} (version ${d.newVersion ?? '?'}; ${(d.changedFields || []).join(', ')})`;
    case 'TEMPLATE_CREATED':
      return e.templateName || 'Template';
    default:
      return d.name || d.changes?.name || d.before?.name || '';
  }
}

/** Read-only certificate audit history (issuance, revocation, template and category changes). */
export const CertificateAuditTab: React.FC = () => {
  const [action, setAction] = useState('');
  const [items, setItems] = useState<CertificateEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setItems(await certificatesAdminApi.events({ action, limit: 300 }));
    } catch (err: any) {
      setError(err?.message || 'Failed to load audit history');
    } finally {
      setLoading(false);
    }
  }, [action]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-3">
      <select value={action} onChange={(e) => setAction(e.target.value)} className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none shadow-2xs">
        <option value="">All events</option>
        {Object.entries(ACTIONS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      </select>
      {loading ? (
        <LoadingState message="Loading audit history..." rows={5} />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items.length === 0 ? (
        <EmptyState title="No events yet" description="Issuance, revocation and template changes are recorded here." />
      ) : (
        <div className="rounded-2xl bg-white border border-slate-200/90 shadow-xs overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">When</th>
                <th className="px-4 py-2 text-left">Event</th>
                <th className="px-4 py-2 text-left">Details</th>
                <th className="px-4 py-2 text-left">By</th>
                <th className="px-4 py-2 text-left">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((e) => {
                const a = ACTIONS[e.action] || { label: e.action, tone: 'bg-slate-100 text-slate-600 border-slate-200' };
                return (
                  <tr key={e.id}>
                    <td className="px-4 py-2 whitespace-nowrap text-slate-500">{new Date(e.at).toLocaleString()}</td>
                    <td className="px-4 py-2"><span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-semibold ${a.tone}`}>{a.label}</span></td>
                    <td className="px-4 py-2 text-slate-700">{describe(e)}</td>
                    <td className="px-4 py-2 text-slate-600">{e.actorName}{e.actorRole ? ` (${e.actorRole})` : ''}</td>
                    <td className="px-4 py-2 text-slate-500 max-w-xs">{e.reason || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
