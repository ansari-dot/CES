import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { RestrictedStudent } from '../../types';
import { DataTable, Column } from '../../components/common/DataTable';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { LoadingState, ErrorState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import { Lock, Unlock, RefreshCw, MessageCircle } from 'lucide-react';

export const RestrictedStudentsModule: React.FC = () => {
  const [students, setStudents] = useState<RestrictedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RestrictedStudent | null>(null);
  const [restoring, setRestoring] = useState(false);

  const toast = useToast();

  const loadStudents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setStudents(await api.getRestrictedStudents());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load restricted students');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  const handleAllowAccess = async () => {
    if (!selected) return;
    try {
      setRestoring(true);
      await api.restoreStudentAccess(selected.studentId);
      toast.success(`Portal access restored for ${selected.studentName}.`);
      setStudents((prev) => prev.filter((s) => s.studentId !== selected.studentId));
      setSelected(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to restore portal access');
      // Re-sync in case the student's state changed elsewhere
      loadStudents();
      setSelected(null);
    } finally {
      setRestoring(false);
    }
  };

  const columns: Column<RestrictedStudent>[] = [
    {
      key: 'studentName',
      header: 'Student',
      render: (s) => (
        <div className="flex flex-col">
          <span className="text-slate-900 font-medium text-xs">{s.studentName}</span>
          <span className="font-mono text-[10px] text-slate-500">
            ID {s.studentId}
            {s.admissionNo ? ` · ${s.admissionNo}` : ''}
            {s.rollNo ? ` · Roll ${s.rollNo}` : ''}
          </span>
        </div>
      )
    },
    {
      key: 'class',
      header: 'Class',
      render: (s) => (
        <span className="text-xs text-slate-700">
          {s.className || (s.classNumber != null ? `Class ${s.classNumber}` : '—')}
        </span>
      )
    },
    {
      key: 'invoices',
      header: 'Overdue Fee',
      render: (s) => (
        <div className="flex flex-col text-xs">
          <span className="text-slate-800 font-medium">{s.restrictedForMonths.join(', ')}</span>
          <span className="text-[10px] text-slate-500">
            {s.outstandingInvoices.length} unpaid invoice{s.outstandingInvoices.length === 1 ? '' : 's'}
          </span>
        </div>
      )
    },
    {
      key: 'outstandingAmount',
      header: 'Outstanding',
      align: 'right',
      render: (s) => (
        <span className="font-mono text-xs font-bold text-rose-700">
          {s.outstandingAmount > 0 ? `Rs. ${s.outstandingAmount.toLocaleString()}` : '—'}
        </span>
      )
    },
    {
      key: 'restrictedAt',
      header: 'Restricted Since',
      render: (s) => (
        <span className="font-mono text-[11px] text-slate-700">
          {s.restrictedAt ? new Date(`${s.restrictedAt.replace(' ', 'T')}Z`).toLocaleString() : '—'}
        </span>
      )
    },
    {
      key: 'portalStatus',
      header: 'Portal Access',
      align: 'center',
      render: () => (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold text-rose-700 bg-rose-50 border-rose-200">
          <Lock className="w-3 h-3" /> Restricted
        </span>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (s) => (
        <button
          onClick={() => setSelected(s)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors inline-flex items-center gap-1.5 shadow-xs"
        >
          <Unlock className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span>Allow Access</span>
        </button>
      )
    }
  ];

  if (loading) return <LoadingState message="Loading fee-restricted students..." rows={4} />;
  if (error) return <ErrorState message={error} onRetry={loadStudents} />;

  return (
    <div className="space-y-4">
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Restricted Students</h2>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
            Students whose portal was automatically restricted because a fee invoice was unpaid after the grace
            period (10th of the month). When a student tells you on WhatsApp that they have paid, find them here and
            click <span className="font-semibold">Allow Access</span>. No receipt approval is needed, and the invoice
            status is not changed.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium shadow-2xs">
            {students.length} Restricted
          </span>
          <button
            onClick={loadStudents}
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium shadow-2xs inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={students}
        keyExtractor={(s) => s.studentId}
        searchPlaceholder="Search by student name, student ID, admission no, class..."
        searchFilter={(s, q) =>
          s.studentName.toLowerCase().includes(q) ||
          s.studentId.toLowerCase().includes(q) ||
          s.admissionNo.toLowerCase().includes(q) ||
          s.rollNo.toLowerCase().includes(q) ||
          s.className.toLowerCase().includes(q)
        }
        emptyTitle="No restricted students"
        emptyDescription="No student portal is currently restricted for overdue fees."
      />

      <ConfirmDialog
        isOpen={Boolean(selected)}
        onClose={() => !restoring && setSelected(null)}
        onConfirm={handleAllowAccess}
        title="Allow Portal Access"
        message={
          selected
            ? `Restore portal access for ${selected.studentName} (Student ID ${selected.studentId})? ` +
              'Do this after the student has told you they have paid. The action is recorded in the audit trail. ' +
              'The invoice will not be marked as paid.'
            : ''
        }
        requireReason={false}
        confirmLabel="Allow Access"
        loading={restoring}
      />

      <div className="flex items-start gap-2 text-[11px] text-slate-500 px-1">
        <MessageCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <span>
          Access stays open until a new invoice becomes overdue under the billing policy. Restoring access does not
          change any invoice or payment record.
        </span>
      </div>
    </div>
  );
};
