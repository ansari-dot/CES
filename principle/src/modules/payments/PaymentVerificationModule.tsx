import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { PaymentProofSubmission } from '../../types';
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

export const PaymentVerificationModule: React.FC = () => {
  const [proofs, setProofs] = useState<PaymentProofSubmission[]>([]);
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
      const data = await api.getPaymentProofs();
      setProofs(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load payment proofs');
    } finally {
      setLoading(false);
    }
  }, []);

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
            {new Date(p.submissionTimestamp).toLocaleDateString()}
          </span>
          <span className="text-slate-500">
            {new Date(p.submissionTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
      header: 'Channel & Reference',
      render: (p) => (
        <div className="flex flex-col text-xs">
          <span className="text-slate-800 font-medium">{p.bankOrWallet}</span>
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

  if (loading) return <LoadingState message="Loading payment submissions from bank feed..." rows={5} />;
  if (error) return <ErrorState message={error} onRetry={loadProofs} />;

  return (
    <div className="space-y-4">
      {/* Top Header Card in clean white */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Payment Proof Verification</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Inspect uploaded bank transaction receipts, detect duplicate transaction references, and authorize challan ledger credits.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium shadow-2xs">
            {proofs.filter((p) => p.status === 'Pending').length} Pending Clearances
          </span>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={proofs}
        keyExtractor={(p) => p.id}
        searchPlaceholder="Search challan number, student name, reference number, bank..."
        searchFilter={(p, q) =>
          p.challanNumber.toLowerCase().includes(q) ||
          p.studentName.toLowerCase().includes(q) ||
          p.transactionReference.toLowerCase().includes(q) ||
          p.bankOrWallet.toLowerCase().includes(q)
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
                  <span className="text-xs text-sky-600 underline font-mono flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    <span>{selectedProof.proofDocumentUrl}</span>
                  </span>
                </div>
              </div>

              {/* Receipt preview simulation */}
              <div className="p-3 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-600 font-mono shadow-2xs">
                <div className="text-slate-400 text-[10px] mb-1">DIGITAL TRANSACTION VOUCHER METADATA</div>
                <div>BENEFICIARY: ONLINE SCHOOL MANAGEMENT (AC: 0102-0105829102)</div>
                <div>STATUS: 200 OK · CHANNEL: 1LINK ⁄ RAAST INTEGRATION</div>
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
                  Reviewed by: {selectedProof.reviewedBy} on {new Date(selectedProof.reviewTimestamp || '').toLocaleString()}
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
