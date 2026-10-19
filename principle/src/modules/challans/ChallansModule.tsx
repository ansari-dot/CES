import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { MonthlyChallan } from '../../types';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { LoadingState, ErrorState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import {
  Receipt,
  FilePlus,
  Printer,
  Bell,
  Clock,
  Building2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Filter,
  Send
} from 'lucide-react';

export const ChallansModule: React.FC = () => {
  const [challans, setChallans] = useState<MonthlyChallan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [classFilter, setClassFilter] = useState<string>('All');

  // Generate Challans Modal
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [billingMonth, setBillingMonth] = useState('June 2024');
  const [dueDate, setDueDate] = useState('2024-06-05');
  const [lateFee, setLateFee] = useState(500);
  const [graceDays, setGraceDays] = useState(5);
  const [generating, setGenerating] = useState(false);

  // Printable Challan View
  const [selectedChallan, setSelectedChallan] = useState<MonthlyChallan | null>(null);
  const [isChallanModalOpen, setIsChallanModalOpen] = useState(false);

  const toast = useToast();

  const loadChallans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getChallans();
      setChallans(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load challans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChallans();
  }, [loadChallans]);

  const handleGenerateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setGenerating(true);
      const res = await api.generateMonthlyChallans(billingMonth, dueDate, Number(lateFee), Number(graceDays));
      toast.success(res.message);
      setIsGenerateModalOpen(false);
      loadChallans();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Challan batch generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleSendReminder = async (challan: MonthlyChallan) => {
    try {
      await api.sendFeeReminder(challan.id);
      toast.success(`Fee reminder sent for Challan ${challan.challanNumber}.`);
      loadChallans();
    } catch {
      toast.error('Failed to dispatch reminder');
    }
  };

  const filteredChallans = challans.filter((ch) => {
    if (statusFilter !== 'All' && ch.status !== statusFilter) return false;
    if (classFilter !== 'All' && ch.classNumber !== Number(classFilter)) return false;
    return true;
  });

  const columns: Column<MonthlyChallan>[] = [
    {
      key: 'challanNumber',
      header: 'Challan No / Month',
      width: '160px',
      render: (ch) => (
        <div className="flex flex-col">
          <span className="font-mono text-slate-900 font-semibold text-xs">{ch.challanNumber}</span>
          <span className="text-[11px] text-slate-500">{ch.billingMonth}</span>
        </div>
      )
    },
    {
      key: 'studentName',
      header: 'Student & Roll',
      render: (ch) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900 text-xs">{ch.studentName}</span>
          <span className="text-[11px] text-slate-500">
            Class {ch.classNumber} · Roll: {ch.rollNumber}
          </span>
        </div>
      )
    },
    {
      key: 'totalPayable',
      header: 'Total Payable',
      align: 'right',
      render: (ch) => (
        <div className="flex flex-col text-right font-mono text-xs">
          <span className="font-semibold text-slate-900">
            Rs. {ch.breakdown.totalPayable.toLocaleString()}
          </span>
          {ch.breakdown.arrearsAmount > 0 && (
            <span className="text-[10px] text-amber-600 font-medium">
              +Rs. {ch.breakdown.arrearsAmount.toLocaleString()} arr
            </span>
          )}
          {ch.breakdown.concessionAmount > 0 && (
            <span className="text-[10px] text-emerald-600 font-medium">
              -Rs. {ch.breakdown.concessionAmount.toLocaleString()} disc
            </span>
          )}
        </div>
      )
    },
    {
      key: 'paidAmount',
      header: 'Paid / Balance',
      align: 'right',
      render: (ch) => (
        <div className="flex flex-col text-right font-mono text-xs">
          <span className="text-emerald-700 font-semibold">
            Rs. {(ch.paidAmount || 0).toLocaleString()}
          </span>
          <span className="text-[11px] text-slate-500">
            Bal: Rs. {ch.outstandingBalance.toLocaleString()}
          </span>
        </div>
      )
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      width: '120px',
      render: (ch) => (
        <div className="flex flex-col">
          <span className="font-mono text-xs text-slate-700">{ch.dueDate}</span>
          {ch.status === 'Overdue' && (
            <span className="text-[10px] text-rose-600 font-medium">+Rs. 500 Late Fee</span>
          )}
        </div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (ch) => <StatusBadge status={ch.status} />
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (ch) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => {
              setSelectedChallan(ch);
              setIsChallanModalOpen(true);
            }}
            title="View & Print 3-Part Voucher"
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5" strokeWidth={1.75} />
          </button>
          {ch.status !== 'Paid' && (
            <button
              onClick={() => handleSendReminder(ch)}
              title={`Send Fee Reminder (Sent: ${ch.remindersSentCount || 0})`}
              className="p-1.5 rounded-lg border border-amber-200 bg-amber-50/60 text-amber-700 hover:bg-amber-100 transition-colors shadow-2xs"
            >
              <Bell className="w-3.5 h-3.5" strokeWidth={1.75} />
            </button>
          )}
        </div>
      )
    }
  ];

  if (loading) return <LoadingState message="Loading monthly challan records & billing ledgers..." rows={6} />;
  if (error) return <ErrorState message={error} onRetry={loadChallans} />;

  return (
    <div className="space-y-4">
      {/* Header Bar in clean white card */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Monthly Fee Challans & Arrears</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Batch billing generation, automated arrears carry-forward, 3-part bank voucher printing, and payment tracking.
          </p>
        </div>

        <button
          onClick={() => setIsGenerateModalOpen(true)}
          className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs shrink-0"
        >
          <FilePlus className="w-3.5 h-3.5" strokeWidth={1.75} />
          <span>Generate Monthly Challans</span>
        </button>
      </div>

      <DataTable
        columns={columns}
        data={filteredChallans}
        keyExtractor={(ch) => ch.id}
        searchPlaceholder="Search challan number, student name, roll number..."
        searchFilter={(ch, q) =>
          ch.challanNumber.toLowerCase().includes(q) ||
          ch.studentName.toLowerCase().includes(q) ||
          ch.rollNumber.includes(q)
        }
        filtersSlot={
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none shadow-2xs"
            >
              <option value="All">All Payment Statuses</option>
              <option value="Unpaid">Unpaid</option>
              <option value="Pending Verification">Pending Verification</option>
              <option value="Partially Paid">Partially Paid</option>
              <option value="Paid">Paid</option>
              <option value="Overdue">Overdue</option>
            </select>

            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none shadow-2xs"
            >
              <option value="All">All Classes (1 to 8)</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
                <option key={c} value={c}>
                  Class {c}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {/* Generate Monthly Challan Modal */}
      <Modal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        title="Generate Monthly Fee Challans Batch"
        description="Generates individualized fee challans for all active students across Classes 1 through 8."
      >
        <form onSubmit={handleGenerateBatch} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-medium mb-1">Billing Month</label>
            <input
              type="text"
              required
              value={billingMonth}
              onChange={(e) => setBillingMonth(e.target.value)}
              placeholder="e.g. June 2024"
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-medium mb-1">Due Date</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-700 font-medium mb-1">Grace Period (Days)</label>
              <input
                type="number"
                min="0"
                value={graceDays}
                onChange={(e) => setGraceDays(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">
              Late Fee Penalty (PKR)
            </label>
            <input
              type="number"
              value={lateFee}
              onChange={(e) => setLateFee(Number(e.target.value))}
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 font-mono"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Default Rs. 500 applied after grace period expires without proof submission.
            </span>
          </div>

          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-800 leading-relaxed">
            Duplicate Safeguard: The engine checks existing billing logs and automatically skips students who already possess an issued challan for {billingMonth}.
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsGenerateModalOpen(false)}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={generating}
              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-xs"
            >
              {generating ? 'Processing Batch...' : 'Generate Challans'}
            </button>
          </div>
        </form>
      </Modal>

      {/* 3-Part Bank Challan Printable Slip View */}
      {selectedChallan && (
        <Modal
          isOpen={isChallanModalOpen}
          onClose={() => setIsChallanModalOpen(false)}
          title={`Fee Challan Voucher · ${selectedChallan.challanNumber}`}
          description={`Class ${selectedChallan.classNumber} · ${selectedChallan.studentName} · Billing: ${selectedChallan.billingMonth}`}
          maxWidth="4xl"
        >
          <div className="space-y-4 text-xs">
            {/* Header info */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-slate-500 text-[11px] block">Designated Fee Account</span>
                <span className="font-semibold text-slate-900">Meezan Bank Ltd · AC: 0102-0105829102</span>
                <span className="text-[10px] text-slate-500 block">Title: Online School Operation Fund</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 text-[11px] block">Due Date</span>
                <span className="font-mono font-bold text-amber-700 text-sm">{selectedChallan.dueDate}</span>
                <span className="text-[10px] text-slate-500 block">Status: {selectedChallan.status}</span>
              </div>
            </div>

            {/* 3 Voucher Copies (Bank, School, Student) in clean white slips */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {['Bank Copy', 'School Copy', 'Student / Parent Copy'].map((copyTitle) => (
                <div
                  key={copyTitle}
                  className="p-3.5 rounded-xl bg-white border border-slate-200 flex flex-col justify-between gap-3 text-[11px] shadow-2xs"
                >
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="font-bold text-amber-700 text-[10px] uppercase tracking-wider">
                        {copyTitle}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {selectedChallan.challanNumber}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1 text-slate-700">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Student:</span>
                        <span className="font-semibold text-slate-900">{selectedChallan.studentName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Class:</span>
                        <span>Class {selectedChallan.classNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Roll No:</span>
                        <span className="font-mono">{selectedChallan.rollNumber}</span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 space-y-1 font-mono">
                      <div className="flex justify-between text-slate-600">
                        <span>Tuition Fee</span>
                        <span>Rs. {selectedChallan.breakdown.tuitionFee.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Tech & Zoom Fee</span>
                        <span>Rs. {selectedChallan.breakdown.technologyFee.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>Exam Fee</span>
                        <span>Rs. {selectedChallan.breakdown.examinationFee.toLocaleString()}</span>
                      </div>
                      {selectedChallan.breakdown.concessionAmount > 0 && (
                        <div className="flex justify-between text-emerald-700 font-semibold">
                          <span>Concession</span>
                          <span>-Rs. {selectedChallan.breakdown.concessionAmount.toLocaleString()}</span>
                        </div>
                      )}
                      {selectedChallan.breakdown.arrearsAmount > 0 && (
                        <div className="flex justify-between text-amber-700 font-semibold">
                          <span>Previous Arrears</span>
                          <span>+Rs. {selectedChallan.breakdown.arrearsAmount.toLocaleString()}</span>
                        </div>
                      )}
                      {selectedChallan.breakdown.lateFeeAmount > 0 && selectedChallan.status === 'Overdue' && (
                        <div className="flex justify-between text-rose-700 font-semibold">
                          <span>Late Fee</span>
                          <span>+Rs. {selectedChallan.breakdown.lateFeeAmount.toLocaleString()}</span>
                        </div>
                      )}
                      <div className="flex justify-between pt-1 border-t border-slate-200 text-slate-900 font-bold text-xs">
                        <span>Net Payable</span>
                        <span>Rs. {selectedChallan.breakdown.totalPayable.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-dashed border-slate-200 text-[10px] text-slate-400 flex justify-between">
                    <span>Officer Stamp / Sign</span>
                    <span>Date: __________</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsChallanModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium flex items-center gap-1.5 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" strokeWidth={1.75} />
                <span>Print Official Voucher</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
