import React, { useState, useEffect, useCallback } from 'react';
import { api, openProtectedFile } from '../../services/api';
import { PaymentProofSubmission, SchoolBankAccount, AccountBreakdownItem } from '../../types';
import { DataTable, Column } from '../../components/common/DataTable';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { LoadingState, ErrorState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Receipt,
  FileText,
  AlertTriangle,
  Building2,
  Calendar,
  Eye,
  ShieldCheck
} from 'lucide-react';
import { formatDateTime, formatTime } from '../../lib/timezone';

export const PaymentVerificationModule: React.FC = () => {
  const [proofs, setProofs] = useState<PaymentProofSubmission[]>([]);
  const [bankAccounts, setBankAccounts] = useState<SchoolBankAccount[]>([]);
  const [accountBreakdown, setAccountBreakdown] = useState<AccountBreakdownItem[]>([]);
  const [bankAccountFilter, setBankAccountFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Review Modal
  const [selectedProof, setSelectedProof] = useState<PaymentProofSubmission | null>(null);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [decision, setDecision] = useState<'Approved' | 'Rejected' | 'Resubmission Requested'>('Approved');
  const [verifiedAmount, setVerifiedAmount] = useState<number>(0);
  const [decisionNote, setDecisionNote] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const toast = useToast();

  const loadProofs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [data, accounts, stats] = await Promise.all([
        api.getPaymentProofs({
          bankAccountId: bankAccountFilter !== 'All' ? bankAccountFilter : undefined
        }),
        api.getBankAccounts('ACTIVE'),
        api.getFeeStats()
      ]);
      setProofs(data);
      setBankAccounts(accounts);
      if (stats?.accountBreakdown && Array.isArray(stats.accountBreakdown)) {
        setAccountBreakdown(stats.accountBreakdown);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load payment proofs');
    } finally {
      setLoading(false);
    }
  }, [bankAccountFilter]);

  useEffect(() => {
    loadProofs();
  }, [loadProofs]);

  const handleOpenReview = (proof: PaymentProofSubmission) => {
    setSelectedProof(proof);
    setVerifiedAmount(proof.submittedAmount);
    setDecision('Approved');
    setDecisionNote('Bank statement credit confirmed against transaction reference.');
    setIsReviewModalOpen(true);
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProof) return;
    if ((decision === 'Rejected' || decision === 'Resubmission Requested') && !decisionNote.trim()) {
      toast.warning('A reason note is mandatory for rejection or resubmission request.');
      return;
    }

    try {
      setReviewSubmitting(true);
      await api.verifyPaymentProof(
        selectedProof.id,
        decision,
        Number(verifiedAmount),
        decisionNote
      );
      toast.success(
        decision === 'Approved'
          ? `Payment of Rs. ${verifiedAmount.toLocaleString()} verified and challan ledger updated.`
          : `Payment submission updated: ${decision}.`
      );
      setIsReviewModalOpen(false);
      setSelectedProof(null);
      loadProofs();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Review action failed');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const columns: Column<PaymentProofSubmission>[] = [
    {
      key: 'submissionTimestamp',
      header: 'Submitted At',
      width: '130px',
      render: (p) => (
        <div className="flex flex-col font-mono text-[11px]">
          <span className="text-slate-900 font-semibold">
            {formatDateTime(p.submissionTimestamp, { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
          <span className="text-slate-500">
            {formatTime(p.submissionTimestamp)}
          </span>
        </div>
      )
    },
    {
      key: 'challanNumber',
      header: 'Challan & Student',
      render: (p) => (
        <div className="flex flex-col">
          <span className="font-mono font-bold text-amber-700 text-xs">{p.challanNumber}</span>
          <span className="text-slate-900 font-medium text-xs">{p.studentName} (Class {p.classNumber})</span>
          <span className="text-[10px] text-slate-500">Parent: {p.parentName}</span>
        </div>
      )
    },
    {
      key: 'submittedAmount',
      header: 'Amount Paid',
      align: 'right',
      render: (p) => (
        <div className="flex flex-col font-mono text-right text-xs">
          <span className="text-sm font-bold text-emerald-700">
            Rs. {p.submittedAmount.toLocaleString()}
          </span>
          {p.verifiedAmount && (
            <span className="text-[10px] text-slate-500">
              Verified: Rs. {p.verifiedAmount.toLocaleString()}
            </span>
          )}
        </div>
      )
    },
    {
      key: 'bankOrWallet',
      header: 'Deposit Channel & Account',
      render: (p) => (
        <div className="flex flex-col gap-0.5 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-800 font-medium">{p.bankOrWallet}</span>
            {p.targetBankAccount ? (
              <span
                title={`Target Deposit Account: ${p.targetBankAccount.bankName} (${p.targetBankAccount.accountNumber})`}
                className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium ${
                  p.targetBankAccount.isDefault
                    ? 'bg-slate-100 text-slate-700'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                <Building2 className="w-2.5 h-2.5" />
                <span>{p.targetBankAccount.bankName}</span>
              </span>
            ) : null}
          </div>
          <span className="font-mono text-[10px] text-slate-500 font-semibold tracking-wide">
            Ref: {p.transactionReference}
          </span>
        </div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (p) => <StatusBadge status={p.status} />
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (p) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => handleOpenReview(p)}
            title={p.status === 'Pending' ? 'Review Proof & Credit Ledger' : 'View Verification Details'}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Eye className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>{p.status === 'Pending' ? 'Review' : 'View'}</span>
          </button>
        </div>
      )
    }
  ];

  const filteredProofs = proofs.filter((p) => {
    if (statusFilter !== 'All' && p.status !== statusFilter) return false;
    if (bankAccountFilter !== 'All') {
      if (bankAccountFilter === 'default') {
        if (p.targetBankAccount && !p.targetBankAccount.isDefault) return false;
      } else if (bankAccountFilter === 'custom') {
        if (!p.targetBankAccount || p.targetBankAccount.isDefault) return false;
      } else {
        const tId = p.targetBankAccountId || p.targetBankAccount?.id;
        if (String(tId) !== bankAccountFilter) return false;
      }
    }
    return true;
  });

  if (loading) return <LoadingState message="Loading payment submissions from bank feed..." rows={5} />;
  if (error) return <ErrorState message={error} onRetry={loadProofs} />;

  return (
    <div className="space-y-4">
      {/* Top Header Card in clean white */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Payment Proof Verification</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Inspect uploaded bank transaction receipts, detect duplicate transaction references, and track account-wise collections.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium shadow-2xs">
            {proofs.filter((p) => p.status === 'Pending').length} Pending Clearances
          </span>
        </div>
      </div>

      {/* Account-wise Reconciliation Cards */}
      {accountBreakdown.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {accountBreakdown.map((acc) => (
            <div
              key={acc.id}
              className={`p-4 rounded-2xl border transition-all shadow-xs ${
                acc.isDefault
                  ? 'bg-gradient-to-br from-amber-50/70 to-white border-amber-200'
                  : 'bg-gradient-to-br from-emerald-50/70 to-white border-emerald-200'
              }`}
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${acc.isDefault ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 text-xs block">{acc.bankName}</span>
                    <span className="font-mono text-[10px] text-slate-500">A/C: {acc.accountNumber}</span>
                  </div>
                </div>
                {acc.isDefault ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold uppercase">Default</span>
                ) : (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold uppercase">Alternative</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 text-[10px] block">Collected</span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">Rs. {(acc.totalCollected || 0).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Outstanding</span>
                  <span className="font-mono font-bold text-amber-700 text-sm">Rs. {(acc.totalOutstanding || 0).toLocaleString()}</span>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-200/50 flex items-center justify-between text-[11px] text-slate-600">
                <span>Challans: <strong>{acc.totalChallans || 0}</strong></span>
                <span className="text-emerald-700 font-medium">{acc.paidCount || 0} Paid · {acc.unpaidCount || 0} Unpaid</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <DataTable
        columns={columns}
        data={filteredProofs}
        keyExtractor={(p) => p.id}
        searchPlaceholder="Search challan number, student name, reference number, bank..."
        searchFilter={(p, q) =>
          p.challanNumber.toLowerCase().includes(q) ||
          p.studentName.toLowerCase().includes(q) ||
          p.transactionReference.toLowerCase().includes(q) ||
          p.bankOrWallet.toLowerCase().includes(q)
        }
        filtersSlot={
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none shadow-2xs"
            >
              <option value="All">All Verification Statuses</option>
              <option value="Pending">Pending Clearance</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="Resubmission Requested">Resubmission Requested</option>
            </select>

            <select
              value={bankAccountFilter}
              onChange={(e) => setBankAccountFilter(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none shadow-2xs font-medium"
            >
              <option value="All">All School Bank Accounts</option>
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

      {/* Payment Review Modal (SRS 13.2 & 13.3) */}
      {selectedProof && (
        <Modal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          title={`Payment Verification · ${selectedProof.challanNumber}`}
          description={`Student: ${selectedProof.studentName} (Class ${selectedProof.classNumber}) · Guardian: ${selectedProof.parentName}`}
          maxWidth="2xl"
        >
          <form onSubmit={handleReviewSubmit} className="space-y-4 text-xs">
            {/* Visual Bank Transfer Slip Representation */}
            <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-amber-600" />
                  <span className="font-semibold text-slate-900">{selectedProof.bankOrWallet}</span>
                </div>
                <StatusBadge status={selectedProof.status} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-slate-500 block text-[10px]">Claimed Amount</span>
                  <span className="font-mono text-base font-bold text-emerald-700">
                    Rs. {selectedProof.submittedAmount.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Transaction Ref</span>
                  <span className="font-mono text-xs font-semibold text-amber-700">
                    {selectedProof.transactionReference}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Payment Date</span>
                  <span className="font-mono text-xs text-slate-700">{selectedProof.paymentDate}</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Proof Document</span>
                  {selectedProof.proofDocumentUrl ? (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await openProtectedFile(
                            selectedProof.proofDocumentUrl,
                            `payment_proof_${selectedProof.challanNumber || selectedProof.id}`
                          );
                        } catch (err) {
                          const msg = err instanceof Error ? err.message : 'Could not open the payment proof file.';
                          toast.error(
                            /not found/i.test(msg)
                              ? 'The receipt file no longer exists on the server (it may be an old test record). Ask the parent to re-upload the payment proof.'
                              : msg
                          );
                        }
                      }}
                      className="text-xs text-sky-600 underline font-mono flex items-center gap-1 hover:text-sky-800 cursor-pointer"
                      title="Open the uploaded payment proof"
                    >
                      <FileText className="w-3 h-3" />
                      <span>View Proof</span>
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      <span>No proof file attached</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Target School Bank Account */}
              <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-200 text-[11px] text-emerald-950">
                <div className="flex items-center justify-between font-semibold mb-1">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Target School Deposit Account:</span>
                    <span>{selectedProof.targetBankAccount?.bankName || 'Meezan Bank'}</span>
                  </span>
                  {selectedProof.targetBankAccount?.isDefault ? (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold uppercase">Default Account</span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-200 text-emerald-800 font-bold uppercase">Custom Assigned</span>
                  )}
                </div>
                <div className="font-mono text-[10px] text-emerald-800">
                  Account Number: <strong>{selectedProof.targetBankAccount?.accountNumber || '03060114428178'}</strong> · Title: {selectedProof.targetBankAccount?.accountTitle || 'CAMBRIDGE EDUCATION SYSTEM'}
                </div>
              </div>

              {/* Submitted transaction details */}
              <div className="p-3 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-600 font-mono shadow-2xs">
                <div className="text-slate-400 text-[10px] mb-1">SUBMITTED TRANSACTION DETAILS</div>
                <div>CHANNEL: {selectedProof.bankOrWallet || '—'}</div>
                <div>REFERENCE: {selectedProof.transactionReference || '—'}</div>
                <div>TIME: {new Date(selectedProof.submissionTimestamp).toUTCString()}</div>
              </div>
            </div>

            {/* Decision Controls */}
            {selectedProof.status === 'Pending' ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Review Decision *</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setDecision('Approved')}
                      className={`p-2.5 rounded-lg border text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                        decision === 'Approved'
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" strokeWidth={1.75} />
                      <span>Approve</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecision('Resubmission Requested')}
                      className={`p-2.5 rounded-lg border text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                        decision === 'Resubmission Requested'
                          ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <RotateCcw className="w-4 h-4 text-amber-600" strokeWidth={1.75} />
                      <span>Resubmit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDecision('Rejected')}
                      className={`p-2.5 rounded-lg border text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                        decision === 'Rejected'
                          ? 'bg-rose-50 border-rose-300 text-rose-800 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <XCircle className="w-4 h-4 text-rose-600" strokeWidth={1.75} />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>

                {decision === 'Approved' && (
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Verified Credit Amount (PKR) *
                    </label>
                    <input
                      type="number"
                      required
                      value={verifiedAmount}
                      onChange={(e) => setVerifiedAmount(Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 font-mono text-sm"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Review Remarks / Justification <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    value={decisionNote}
                    onChange={(e) => setDecisionNote(e.target.value)}
                    required
                    rows={2}
                    placeholder="Enter audit note or reason for decision..."
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 resize-none"
                  />
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                <span className="text-slate-500 text-[11px] block">Previous Review Decision</span>
                <p className="text-slate-800 font-medium">
                  {selectedProof.reviewDecisionNote || 'No review remarks recorded.'}
                </p>
                <span className="text-[10px] text-slate-500 block">
                  Reviewed by: {selectedProof.reviewedBy} on {formatDateTime(selectedProof.reviewTimestamp)}
                  {selectedProof.receiptNumber && ` · Receipt: ${selectedProof.receiptNumber}`}
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
              {selectedProof.status === 'Pending' && (
                <button
                  type="submit"
                  disabled={reviewSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-xs"
                >
                  {reviewSubmitting ? 'Recording...' : 'Confirm Decision'}
                </button>
              )}
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
