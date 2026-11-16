import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { MonthlyChallan, SchoolBankAccount } from '../../types';
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
  Send,
  Phone,
  Globe,
  MapPin,
  Ban,
  Plus,
  Edit2,
  X
} from 'lucide-react';

export const ChallansModule: React.FC = () => {
  const [challans, setChallans] = useState<MonthlyChallan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [classFilter, setClassFilter] = useState<string>('All');
  const [bankAccountFilter, setBankAccountFilter] = useState<string>('All');

  // Bank Accounts & Reassignment
  const [bankAccounts, setBankAccounts] = useState<SchoolBankAccount[]>([]);
  const [isChallanBankModalOpen, setIsChallanBankModalOpen] = useState(false);
  const [challanToReassign, setChallanToReassign] = useState<MonthlyChallan | null>(null);
  const [newBankAccountId, setNewBankAccountId] = useState<number | null>(null);
  const [reassigningBank, setReassigningBank] = useState(false);

  // Inline Bank Account Creator / Editor
  const [showAddAccountForm, setShowAddAccountForm] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<number | null>(null);
  const [accountFormData, setAccountFormData] = useState({
    bankName: '',
    branchName: '',
    accountTitle: 'CAMBRIDGE EDUCATION SYSTEM',
    accountNumber: '',
    iban: '',
    instructions: ''
  });
  const [savingAccount, setSavingAccount] = useState(false);

  const handleOpenAddAccount = () => {
    setEditingAccountId(null);
    setAccountFormData({
      bankName: '',
      branchName: '',
      accountTitle: 'CAMBRIDGE EDUCATION SYSTEM',
      accountNumber: '',
      iban: '',
      instructions: ''
    });
    setShowAddAccountForm(true);
  };

  const handleOpenEditAccount = (acc: SchoolBankAccount, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAccountId(acc.id);
    setAccountFormData({
      bankName: acc.bankName || '',
      branchName: acc.branchName || '',
      accountTitle: acc.accountTitle || 'CAMBRIDGE EDUCATION SYSTEM',
      accountNumber: acc.accountNumber || '',
      iban: acc.iban || '',
      instructions: acc.instructions || ''
    });
    setShowAddAccountForm(true);
  };

  const handleSaveAccountForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountFormData.bankName.trim() || !accountFormData.accountNumber.trim()) {
      toast.warning('Bank name and account number are required.');
      return;
    }
    try {
      setSavingAccount(true);
      if (editingAccountId) {
        const updated = await api.updateBankAccount(editingAccountId, accountFormData);
        toast.success(`Bank account ${updated.bankName} updated.`);
        setBankAccounts((prev) => prev.map((b) => (b.id === editingAccountId ? updated : b)));
      } else {
        const created = await api.createBankAccount({ ...accountFormData, isDefault: false });
        toast.success(`Bank account ${created.bankName} created and ready for assignment.`);
        setBankAccounts((prev) => [...prev, created]);
        setNewBankAccountId(created.id);
      }
      setShowAddAccountForm(false);
      setEditingAccountId(null);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save bank account');
    } finally {
      setSavingAccount(false);
    }
  };

  // Generate Challans Modal
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [billingMonth, setBillingMonth] = useState(
    new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
  );
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [lateFee, setLateFee] = useState(500);
  const [graceDays, setGraceDays] = useState(5);
  const [generating, setGenerating] = useState(false);

  // Printable Challan View
  const [selectedChallan, setSelectedChallan] = useState<MonthlyChallan | null>(null);
  const [isChallanModalOpen, setIsChallanModalOpen] = useState(false);

  // Manual portal block for unpaid fee
  const [blockTarget, setBlockTarget] = useState<MonthlyChallan | null>(null);
  const [blocking, setBlocking] = useState(false);

  const toast = useToast();

  const loadChallans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [data, accounts] = await Promise.all([
        api.getChallans({
          bankAccountId: bankAccountFilter !== 'All' ? bankAccountFilter : undefined
        }),
        api.getBankAccounts('ACTIVE')
      ]);
      setChallans(data);
      setBankAccounts(accounts);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load challans');
    } finally {
      setLoading(false);
    }
  }, [bankAccountFilter]);

  const handleOpenChallanBankModal = (ch: MonthlyChallan) => {
    setChallanToReassign(ch);
    const existingId = ch.bankAccountId || ch.bankAccount?.id || (bankAccounts.find(b => b.isDefault)?.id ?? null);
    setNewBankAccountId(existingId ? Number(existingId) : null);
    setIsChallanBankModalOpen(true);
  };

  const handleSaveChallanBank = async () => {
    if (!challanToReassign || !newBankAccountId) return;
    try {
      setReassigningBank(true);
      await api.assignChallanBankAccount(challanToReassign.id, newBankAccountId);
      toast.success(`Challan ${challanToReassign.challanNumber} bank account updated.`);
      setIsChallanBankModalOpen(false);
      loadChallans();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update challan bank account');
    } finally {
      setReassigningBank(false);
    }
  };

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

  const handleBlockConfirmed = async () => {
    if (!blockTarget) return;
    try {
      setBlocking(true);
      const res = await api.blockStudentAccess(blockTarget.id);
      toast.success(`Portal access blocked for ${res.studentName || blockTarget.studentName}. Restore it anytime from Restricted Students.`);
      setBlockTarget(null);
      loadChallans();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to block student portal access');
    } finally {
      setBlocking(false);
    }
  };

  const filteredChallans = challans.filter((ch) => {
    if (statusFilter !== 'All' && ch.status !== statusFilter) return false;
    if (classFilter !== 'All' && ch.classNumber !== Number(classFilter)) return false;
    if (bankAccountFilter !== 'All') {
      if (bankAccountFilter === 'default') {
        if (ch.bankAccount && !ch.bankAccount.isDefault) return false;
      } else if (bankAccountFilter === 'custom') {
        if (!ch.bankAccount || ch.bankAccount.isDefault) return false;
      } else {
        const targetId = ch.bankAccountId || ch.bankAccount?.id;
        if (String(targetId) !== bankAccountFilter) return false;
      }
    }
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
      header: 'Student & Target Bank',
      render: (ch) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-slate-900 text-xs">{ch.studentName}</span>
          <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500">
            <span>Class {ch.classNumber} · Roll: {ch.rollNumber}</span>
            {ch.bankAccount ? (
              <span
                title={`Deposit Account: ${ch.bankAccount.bankName} - A/C: ${ch.bankAccount.accountNumber}`}
                className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium ${
                  ch.bankAccount.isDefault
                    ? 'bg-slate-100 text-slate-700'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                <Building2 className="w-2.5 h-2.5" />
                <span>{ch.bankAccount.bankName}</span>
              </span>
            ) : null}
          </div>
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
          <button
            onClick={() => handleOpenChallanBankModal(ch)}
            title={`Assigned Bank: ${ch.bankAccount?.bankName || 'Default'} - Click to change bank account for this challan`}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 transition-colors shadow-2xs"
          >
            <Building2 className="w-3.5 h-3.5" strokeWidth={1.75} />
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
          {ch.status !== 'Paid' &&
            (ch.studentPortalStatus === 'SUSPENDED' ? (
              <span
                title="Student portal is already blocked — restore from Restricted Students"
                className="p-1.5 rounded-lg border border-rose-200 bg-rose-100 text-rose-400 cursor-not-allowed inline-flex"
              >
                <Ban className="w-3.5 h-3.5" strokeWidth={1.75} />
              </span>
            ) : (
              <button
                onClick={() => setBlockTarget(ch)}
                title="Block student portal for this unpaid fee"
                className="p-1.5 rounded-lg border border-rose-200 bg-rose-50/60 text-rose-700 hover:bg-rose-100 transition-colors shadow-2xs"
              >
                <Ban className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            ))}
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
          <div className="flex items-center gap-2 flex-wrap">
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

            <select
              value={bankAccountFilter}
              onChange={(e) => setBankAccountFilter(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none shadow-2xs font-medium"
            >
              <option value="All">All Bank Accounts</option>
              <option value="default">Default Account (Meezan Bank)</option>
              <option value="custom">All Custom Accounts</option>
              {bankAccounts.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.bankName} {b.isDefault ? '(Default)' : (b.accountNumber ? `(${String(b.accountNumber).slice(-4)})` : '')}
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

      {/* Confirm Manual Portal Block */}
      {blockTarget && (
        <Modal
          isOpen={!!blockTarget}
          onClose={() => setBlockTarget(null)}
          title="Block Student Portal Access?"
          description={`${blockTarget.studentName} · Class ${blockTarget.classNumber} · Challan ${blockTarget.challanNumber} (${blockTarget.billingMonth})`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 leading-relaxed">
              <p className="font-semibold mb-1">This is the same restriction the system applies automatically after the grace period.</p>
              <p>
                The student will not be able to log in and will be told to pay the fee from the Parent Portal.
                Outstanding balance on this challan: <strong>Rs. {blockTarget.outstandingBalance.toLocaleString()}</strong>.
              </p>
              <p className="mt-1 text-[11px] text-rose-700">
                Access is restored automatically once the invoice is settled, or manually from the Restricted Students module.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBlockTarget(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={blocking}
                onClick={handleBlockConfirmed}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-medium shadow-xs flex items-center gap-1.5"
              >
                <Ban className="w-3.5 h-3.5" strokeWidth={1.75} />
                {blocking ? 'Blocking...' : 'Block Portal Access'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 3-Part Bank Challan Printable Slip View */}
      {selectedChallan && (
        <Modal
          isOpen={isChallanModalOpen}
          onClose={() => setIsChallanModalOpen(false)}
          title={`Fee Challan Voucher · ${selectedChallan.challanNumber}`}
          description={`Class ${selectedChallan.classNumber} · ${selectedChallan.studentName} · Billing: ${selectedChallan.billingMonth}`}
          maxWidth="4xl"
        >
          <div className="print-area space-y-4 text-xs" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } as React.CSSProperties}>
            {/* Branded invoice header — Cambridge Education System template */}
            <div className="bg-[#1b1a47] text-white rounded-xl px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center overflow-hidden shrink-0">
                  <img src="/logo.jpeg" alt="Cambridge Education System logo" className="w-full h-full object-contain" />
                </div>
                <div className="leading-tight">
                  <div className="font-heading font-extrabold tracking-wide text-lg">CAMBRIDGE</div>
                  <div className="text-[11px] text-white/85">Education System</div>
                </div>
              </div>
              <div className="font-heading font-extrabold text-2xl tracking-[0.2em]">INVOICE</div>
            </div>

            {/* Header info */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-slate-500 text-[11px] block">Payment Method & Bank Details</span>
                <span className="font-semibold text-slate-900">
                  {selectedChallan.bankAccount?.bankName || 'Meezan Bank'}{' '}
                  {selectedChallan.bankAccount?.branchName ? `(${selectedChallan.bankAccount.branchName})` : 'F-11 MARKAZ, ISLAMABAD'}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Title: {selectedChallan.bankAccount?.accountTitle || 'CAMBRIDGE EDUCATION SYSTEM'}
                </span>
                <span className="text-[10px] text-slate-700 block font-mono font-semibold">
                  Account Number : {selectedChallan.bankAccount?.accountNumber || '03060114428178'}
                </span>
                <span className="text-[10px] text-slate-500 block font-mono">
                  IBAN : {selectedChallan.bankAccount?.iban || 'PK58MEZN0003060114428178'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 text-[11px] block">Due Date</span>
                <span className="font-mono font-bold text-amber-700 text-sm">{selectedChallan.dueDate}</span>
                <span className="text-[10px] text-slate-500 block">Status: {selectedChallan.status}</span>
                <span className="text-[10px] text-slate-500 block">Invoice No: {selectedChallan.challanNumber}</span>
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

                    <div className="my-1.5 p-1.5 rounded bg-slate-50 border border-slate-100 text-[10px]">
                      <span className="text-slate-400 block">Bank Account:</span>
                      <span className="font-bold text-slate-800">{selectedChallan.bankAccount?.bankName || 'Meezan Bank'}</span>
                      <span className="font-mono text-slate-600 block">{selectedChallan.bankAccount?.accountNumber || '03060114428178'}</span>
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

            {/* Branded contact footer */}
            <div className="bg-[#1b1a47] text-white rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-[11px]">
              <span className="inline-flex items-center gap-1.5"><Phone className="w-3 h-3" /> 0300 511 8716</span>
              <span className="inline-flex items-center gap-1.5"><Globe className="w-3 h-3" /> www.cambridgeeducation.uk.com</span>
              <span className="inline-flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Islamabad Pakistan</span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 print:hidden">
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
      {/* Reassign Bank Account for Specific Challan Modal */}
      {isChallanBankModalOpen && challanToReassign && (
        <Modal
          isOpen={isChallanBankModalOpen}
          onClose={() => setIsChallanBankModalOpen(false)}
          title={`Reassign Target Bank Account · ${challanToReassign.challanNumber}`}
          description={`Update the deposit bank account for ${challanToReassign.studentName} (Class ${challanToReassign.classNumber}).`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
              <span className="font-bold">🔒 Principal Access Only:</span> Only school administrators can configure or update bank accounts. Students and parents have strictly read-only access. Updating this challan ensures only this student's linked parent will see the new bank account on their invoice slip.
            </div>

            {/* Inline Add / Edit Bank Account Form */}
            {showAddAccountForm ? (
              <form onSubmit={handleSaveAccountForm} className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                  <span className="font-bold text-emerald-900">
                    {editingAccountId ? 'Edit School Bank Account' : 'Add New Alternative Bank Account'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddAccountForm(false);
                      setEditingAccountId(null);
                    }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Bank Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Habib Bank Limited (HBL), Allied Bank, UBL"
                    value={accountFormData.bankName}
                    onChange={(e) => setAccountFormData({ ...accountFormData, bankName: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Account Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. CAMBRIDGE EDUCATION SYSTEM"
                      value={accountFormData.accountTitle}
                      onChange={(e) => setAccountFormData({ ...accountFormData, accountTitle: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Account Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 23817000192803"
                      value={accountFormData.accountNumber}
                      onChange={(e) => setAccountFormData({ ...accountFormData, accountNumber: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 font-mono focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">Branch Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Blue Area, Islamabad"
                      value={accountFormData.branchName}
                      onChange={(e) => setAccountFormData({ ...accountFormData, branchName: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">IBAN (optional)</label>
                    <input
                      type="text"
                      placeholder="PK..."
                      value={accountFormData.iban}
                      onChange={(e) => setAccountFormData({ ...accountFormData, iban: e.target.value })}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 font-mono focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddAccountForm(false);
                      setEditingAccountId(null);
                    }}
                    className="px-3 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingAccount}
                    className="px-3.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-xs"
                  >
                    {savingAccount ? 'Saving...' : editingAccountId ? 'Save Updates' : 'Save & Select Account'}
                  </button>
                </div>
              </form>
            ) : null}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-slate-700 font-semibold">Select Bank Account *</label>
                {!showAddAccountForm && (
                  <button
                    type="button"
                    onClick={handleOpenAddAccount}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white flex items-center gap-1 shadow-2xs"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Add New Bank Account</span>
                  </button>
                )}
              </div>

              {bankAccounts.map((acc) => (
                <label
                  key={acc.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    newBankAccountId === acc.id
                      ? 'border-emerald-500 bg-emerald-50/40 ring-1 ring-emerald-500'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="challanBankChoice"
                    checked={newBankAccountId === acc.id}
                    onChange={() => setNewBankAccountId(acc.id)}
                    className="mt-0.5 text-emerald-600 focus:ring-0"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{acc.bankName}</span>
                        {!acc.isDefault && (
                          <button
                            type="button"
                            onClick={(e) => handleOpenEditAccount(acc, e)}
                            title="Edit this bank account"
                            className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      {acc.isDefault ? (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold uppercase">Default Account</span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold uppercase">Alternative</span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 font-mono mt-0.5">
                      A/C: {acc.accountNumber || '—'} · Title: {acc.accountTitle || '—'}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Branch: {acc.branchName || 'Main'} {acc.iban ? `· IBAN: ${acc.iban}` : ''}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsChallanBankModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveChallanBank}
                disabled={reassigningBank || !newBankAccountId}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-xs"
              >
                {reassigningBank ? 'Updating...' : 'Update Challan Account'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
