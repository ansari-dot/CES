import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import { KeyRound, MailCheck, ShieldX, RefreshCw } from 'lucide-react';

interface ResetRequestRow {
  id: number;
  userId: number;
  roleCode: string;
  email: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'EXPIRED';
  requestedAt: string;
  reviewedAt: string | null;
  completedAt: string | null;
  fullName: string;
  username: string;
}

const ROLE_LABEL: Record<string, string> = {
  TEACHER: 'Teacher',
  STUDENT: 'Student',
  PARENT: 'Parent'
};

export const PasswordResetsModule: React.FC = () => {
  const toast = useToast();
  const [rows, setRows] = useState<ResetRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ row: ResetRequestRow; decision: 'APPROVED' | 'REJECTED' } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setRows(await api.getPasswordResetRequests());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load password reset requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReview = async () => {
    if (!confirm) return;
    try {
      setBusy(true);
      await api.reviewPasswordResetRequest(confirm.row.id, confirm.decision);
      toast.success(
        confirm.decision === 'APPROVED'
          ? `Approved — a one-time code has been emailed to ${confirm.row.email}.`
          : 'Request rejected. No code was sent.'
      );
      setConfirm(null);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to review the request');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState message="Loading password reset requests..." rows={5} />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  const pending = rows.filter((r) => r.status === 'PENDING');

  return (
    <div className="space-y-4">
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-amber-600" strokeWidth={1.75} />
            Password Reset Requests
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Teachers, students and parents request a reset from their login screen. Approving a request emails them a
            one-time code (valid 15 minutes) to set a new password.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
            {pending.length} pending
          </span>
          <button
            onClick={loadData}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="p-6 bg-white border border-slate-200/90 rounded-2xl shadow-xs">
          <EmptyState
            title="No password reset requests"
            description="When a teacher, student or parent uses 'Forgot password?' on their login screen, the request appears here for your approval."
          />
        </div>
      ) : (
        <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="px-4 py-2.5">Requester</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Requested</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-2.5">
                    <span className="font-semibold text-slate-900">{r.fullName}</span>
                    <span className="text-slate-400 ml-1.5 font-mono text-[10px]">{r.username}</span>
                  </td>
                  <td className="px-4 py-2.5">{ROLE_LABEL[r.roleCode] || r.roleCode}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px]">{r.email}</td>
                  <td className="px-4 py-2.5 font-mono text-[11px]">
                    {r.requestedAt ? new Date(r.requestedAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge
                      status={r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                      variant={
                        r.status === 'PENDING'
                          ? 'warning'
                          : r.status === 'APPROVED' || r.status === 'COMPLETED'
                            ? 'success'
                            : 'danger'
                      }
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    {r.status === 'PENDING' ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setConfirm({ row: r, decision: 'APPROVED' })}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-medium flex items-center gap-1 shadow-xs"
                        >
                          <MailCheck className="w-3 h-3" strokeWidth={1.75} /> Allow
                        </button>
                        <button
                          onClick={() => setConfirm({ row: r, decision: 'REJECTED' })}
                          className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px] font-medium flex items-center gap-1"
                        >
                          <ShieldX className="w-3 h-3" strokeWidth={1.75} /> Reject
                        </button>
                      </div>
                    ) : (
                      <div className="text-right text-[10px] text-slate-400 font-mono">
                        {r.completedAt
                          ? `Completed ${new Date(r.completedAt).toLocaleString()}`
                          : r.reviewedAt
                            ? `Reviewed ${new Date(r.reviewedAt).toLocaleString()}`
                            : '—'}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirm && (
        <ConfirmDialog
          isOpen
          onClose={() => setConfirm(null)}
          onConfirm={handleReview}
          title={
            confirm.decision === 'APPROVED'
              ? `Approve password reset for ${confirm.row.fullName}?`
              : `Reject password reset for ${confirm.row.fullName}?`
          }
          message={
            confirm.decision === 'APPROVED'
              ? `A one-time 6-digit code will be emailed to ${confirm.row.email}. It expires in 15 minutes and can be used once to set a new password.`
              : 'The request will be closed and no code will be sent. The user can submit a new request later.'
          }
          requireReason={false}
          confirmLabel={confirm.decision === 'APPROVED' ? 'Allow & Send Code' : 'Reject Request'}
          isDestructive={confirm.decision === 'REJECTED'}
          loading={busy}
        />
      )}
    </div>
  );
};
