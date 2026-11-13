import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { AuditLogEntry } from '../../types';
import { DataTable, Column } from '../../components/common/DataTable';
import { LoadingState, ErrorState } from '../../components/common/StateViews';
import { ShieldCheck, History, Search } from 'lucide-react';
import { formatDateTime } from '../../lib/timezone';

export const AuditLogModule: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('All');

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getAuditLogs();
      setLogs(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load audit history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filteredLogs = logs.filter((l) => {
    if (typeFilter !== 'All' && l.recordType !== typeFilter) return false;
    return true;
  });

  const columns: Column<AuditLogEntry>[] = [
    {
      key: 'timestamp',
      header: 'Timestamp',
      width: '140px',
      render: (l) => (
        <div className="flex flex-col font-mono text-[11px]">
          <span className="text-slate-900 font-semibold">
            {formatDateTime(l.timestamp, { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
          <span className="text-slate-400">
            {formatDateTime(l.timestamp, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      )
    },
    {
      key: 'actor',
      header: 'Actor & Role',
      render: (l) => (
        <div className="flex flex-col text-xs">
          <span className="font-semibold text-slate-900">{l.actorName}</span>
          <span className="text-[10px] text-amber-700 font-mono">{l.actorRole}</span>
        </div>
      )
    },
    {
      key: 'action',
      header: 'Action & Record',
      render: (l) => (
        <div className="flex flex-col text-xs">
          <span className="font-mono text-emerald-700 font-semibold text-[11px]">{l.action}</span>
          <span className="text-slate-800 text-[11px] font-medium">{l.recordIdentifier}</span>
          <span className="text-[10px] text-slate-400 font-mono">{l.recordType}</span>
        </div>
      )
    },
    {
      key: 'reason',
      header: 'Documented Justification & Diff',
      render: (l) => (
        <div className="flex flex-col max-w-md text-xs">
          <span className="text-slate-700 leading-snug">{l.reason}</span>
          {(l.previousValue || l.newValue) && (
            <div className="mt-1 font-mono text-[10px] text-slate-600 space-y-0.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
              {l.previousValue && <div>Prev: {l.previousValue}</div>}
              {l.newValue && <div className="text-amber-800 font-semibold">New: {l.newValue}</div>}
            </div>
          )}
        </div>
      )
    }
  ];

  if (loading) return <LoadingState message="Loading immutable administrative audit trail..." rows={6} />;
  if (error) return <ErrorState message={error} onRetry={loadLogs} />;

  return (
    <div className="space-y-4">
      {/* Top Banner Card in clean white */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Immutable Operational Audit History</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cryptographically sealed and non-repudiable audit ledger capturing all consequential Principal and staff actions.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium shadow-2xs">
            {logs.length} Total Audit Entries
          </span>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={filteredLogs}
        keyExtractor={(l) => l.id}
        searchPlaceholder="Search actor, action, record ID, or reason..."
        searchFilter={(l, q) =>
          l.actorName.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          l.recordIdentifier.toLowerCase().includes(q) ||
          l.reason.toLowerCase().includes(q)
        }
        filtersSlot={
          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none shadow-2xs"
            >
              <option value="All">All Record Domains</option>
              <option value="Timetable Lesson">Timetable Lesson</option>
              <option value="Fee Structure">Fee Structure</option>
              <option value="Monthly Challan">Monthly Challan</option>
              <option value="Payment Proof">Payment Proof</option>
              <option value="Teacher Payroll">Teacher Payroll</option>
              <option value="Teacher Account">Teacher Account</option>
              <option value="Student Account">Student Account</option>
              <option value="Zoom Link">Zoom Link</option>
            </select>
          </div>
        }
      />
    </div>
  );
};
