import React, { useState } from 'react';
import { Receipt, Wallet, AlertCircle, Printer, UploadCloud, Phone, Globe, MapPin } from 'lucide-react';
import { useChildData, useParent } from '../context/ParentContext';
import { requestApi } from '../services/api';
import { MetricCard, StatusChip, RequireChild, LoadingBlock, ErrorBlock, EmptyBlock, Modal } from '../components/common';
import { rupees, formatDate, formatDateTime, CHALLAN_STATUS_LABELS } from '../lib/format';

interface ChallanRow {
  id: number;
  challanNumber: string;
  consumerNumber: string;
  billingMonth: string;
  academicSession: string;
  issueDate: string;
  dueDate: string;
  validUntil: string;
  totalPayable: number;
  paidAmount: number;
  outstandingBalance: number;
  status: string;
}

interface ChallanDetail {
  id: number;
  challanNumber: string;
  consumerNumber: string;
  billingMonth: string;
  academicSession: string;
  className: string;
  studentName: string;
  admissionNo: string;
  rollNo: string | null;
  issueDate: string;
  dueDate: string;
  validUntil: string;
  breakdown: Record<string, number>;
  totalPayable: number;
  paidAmount: number;
  outstandingBalance: number;
  status: string;
  bankAccount?: {
    id: number;
    bankName: string;
    branchName?: string;
    accountTitle: string;
    accountNumber: string;
    iban?: string;
    instructions?: string;
    isDefault?: boolean;
  };
  /** Frozen payment details for this challan, revised only by the Principal */
  paymentDetails?: {
    revision: number;
    paymentMethod: string;
    instructions: string | null;
    qr: { enabled: boolean; label: string | null; url: string | null };
  } | null;
  payments: {
    id: number;
    submittedAmount: number;
    bankOrWallet: string;
    transactionReference: string;
    paymentDate: string;
    status: string;
    verifiedAmount: number | null;
    receiptNumber: string | null;
    reviewNote: string | null;
    submittedAt: string;
  }[];
}

const statusLabel = (s: string) => CHALLAN_STATUS_LABELS[s] || s;

/** Fee lines on each voucher copy; `true` = always shown (as on the Principal voucher). */
const VOUCHER_LINES: [string, string, boolean][] = [
  ['tuition', 'Tuition Fee', true],
  ['technology', 'Tech & Zoom Fee', true],
  ['examination', 'Exam Fee', true],
  ['books', 'Books', false],
  ['admission', 'Admission Fee', false],
  ['other', 'Other Charges', false]
];

function PaymentProofForm({ studentId, challan, onDone }: { studentId: number; challan: ChallanDetail; onDone: () => void }) {
  const { showToast } = useParent();
  const [amount, setAmount] = useState(String(challan.outstandingBalance || ''));
  const [bankOrWallet, setBankOrWallet] = useState('');
  const [reference, setReference] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [proof, setProof] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!Number(amount) || Number(amount) <= 0) {
      setError('Enter the amount you paid.');
      return;
    }
    if (!reference.trim()) {
      setError('Enter the bank / wallet transaction reference.');
      return;
    }
    const fd = new FormData();
    fd.append('submittedAmount', amount);
    fd.append('bankOrWallet', bankOrWallet || 'Bank Transfer');
    fd.append('transactionReference', reference.trim());
    fd.append('paymentDate', paymentDate);
    if (proof) fd.append('proof', proof);

    setSaving(true);
    try {
      await requestApi(`/api/v1/parents/me/children/${studentId}/challans/${challan.id}/pay`, { method: 'POST', body: fd });
      showToast('Payment proof submitted. The school will verify it before the challan is marked as paid.');
      onDone();
    } catch (err: any) {
      setError(err.message || 'Failed to submit payment proof');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full bg-card border border-border rounded-sm px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary';

  return (
    <form onSubmit={submit} className="space-y-3 border-t border-border pt-4 print:hidden">
      <div className="font-headings font-bold text-sm text-foreground">Submit payment proof</div>
      <p className="text-xs text-muted-foreground">
        After paying at the bank or by mobile wallet, submit the details below. The challan is marked as paid only after the school verifies the payment.
      </p>
      {challan.bankAccount && (
        <div className="p-2.5 rounded bg-muted/40 border border-border text-xs">
          <span className="text-muted-foreground block text-[11px]">Assigned School Deposit Account:</span>
          <span className="font-semibold text-foreground">{challan.bankAccount.bankName}</span>
          <span className="font-mono text-muted-foreground ml-2">A/C: {challan.bankAccount.accountNumber}</span>
          {challan.bankAccount.accountTitle && <span className="text-[11px] text-muted-foreground block">Title: {challan.bankAccount.accountTitle}</span>}
          {challan.paymentDetails?.paymentMethod && (
            <span className="text-[11px] text-muted-foreground block">Method: {challan.paymentDetails.paymentMethod}</span>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">Amount paid (Rs.)</label>
          <input type="number" min="1" step="1" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} required />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">Payment date</label>
          <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className={inputCls} required />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">Bank / wallet</label>
          <input type="text" value={bankOrWallet} onChange={(e) => setBankOrWallet(e.target.value)} placeholder="e.g. HBL, JazzCash" className={inputCls} />
        </div>
        <div>
          <label className="text-xs font-semibold text-muted-foreground block mb-1">Transaction reference</label>
          <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} className={inputCls} required />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground block mb-1">Payment slip (image or PDF, optional)</label>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={(e) => setProof(e.target.files?.[0] || null)}
          className="w-full text-xs file:mr-2 file:px-2 file:py-1 file:rounded-sm file:border-0 file:bg-secondary file:text-primary file:font-semibold"
        />
      </div>
      {error && <div className="text-xs text-error font-semibold bg-error/10 border border-error/20 rounded-sm px-3 py-2">{error}</div>}
      <button
        type="submit"
        disabled={saving}
        className="w-full bg-primary hover:bg-primary-hover text-white py-2.5 text-sm font-bold rounded-sm transition disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
      >
        <UploadCloud className="w-4 h-4" />
        {saving ? 'Submitting…' : 'Submit for Verification'}
      </button>
    </form>
  );
}

function FeesContent() {
  const { selectedChild, showToast, refreshDashboard } = useParent();
  const { data, loading, error, reload, studentId } = useChildData<ChallanRow[]>(
    (id) => `/api/v1/parents/me/children/${id}/challans`
  );
  const [detail, setDetail] = useState<ChallanDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const openDetail = async (challanId: number) => {
    if (studentId == null) return;
    setDetailLoading(true);
    try {
      setDetail(await requestApi<ChallanDetail>(`/api/v1/parents/me/children/${studentId}/challans/${challanId}`));
    } catch (err: any) {
      showToast(err.message || 'Failed to load challan', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading && !data) return <LoadingBlock message="Loading fee challans…" />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  const challans = data || [];

  const outstanding = challans.reduce((s, c) => s + (c.status !== 'PAID' ? c.outstandingBalance : 0), 0);
  const paid = challans.reduce((s, c) => s + c.paidAmount, 0);
  const nextDue = challans
    .filter((c) => c.status !== 'PAID')
    .sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)))[0];

  return (
    <>
      <div className={`space-y-6 ${detail ? 'print:hidden' : ''}`}>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MetricCard icon={AlertCircle} title="Outstanding Balance" value={rupees(outstanding)} subtitle={nextDue ? `Next due ${formatDate(nextDue.dueDate)}` : 'Nothing due'} colorScheme={outstanding > 0 ? 'error' : 'success'} />
          <MetricCard icon={Wallet} title="Total Paid" value={rupees(paid)} subtitle="Verified payments" colorScheme="success" />
          <MetricCard icon={Receipt} title="Challans Issued" value={challans.length} subtitle={selectedChild?.studentName} colorScheme="secondary" />
        </div>

        {challans.length === 0 ? (
          <EmptyBlock title="No fee challans yet" description="Monthly challans will appear here once the school issues them." />
        ) : (
          <div className="bg-card border border-border rounded-md shadow-sm overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2.5">Month</th>
                  <th className="px-4 py-2.5">Challan No</th>
                  <th className="px-4 py-2.5">Due Date</th>
                  <th className="px-4 py-2.5 text-right">Payable</th>
                  <th className="px-4 py-2.5 text-right">Paid</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {challans.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">{c.billingMonth}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{c.challanNumber}</td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(c.dueDate)}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">{rupees(c.totalPayable)}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">{rupees(c.paidAmount)}</td>
                    <td className="px-4 py-2.5"><StatusChip status={statusLabel(c.status)} /></td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => openDetail(c.id)}
                        disabled={detailLoading}
                        className="text-xs font-bold px-3 py-1.5 rounded-sm bg-muted hover:bg-[#ffc53a] text-foreground cursor-pointer disabled:opacity-60"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detail && studentId != null && (
        <Modal isOpen={Boolean(detail)} onClose={() => setDetail(null)} title={`Fee Challan · ${detail.billingMonth}`} maxWidth="max-w-4xl">
          <div className="space-y-4 text-sm" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } as React.CSSProperties}>
            {/* Printable voucher: same layout as the Principal portal's 3-part challan
                (bank / school / student copies) so a downloaded challan matches the official one. */}
            <div className="print-area space-y-4 text-xs">
              {/* Branded invoice header */}
              <div className="bg-[#1b1a47] text-white rounded-xl px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center overflow-hidden shrink-0">
                    <img src="/logo.jpeg" alt="Cambridge Education System logo" className="w-full h-full object-contain" />
                  </div>
                  <div className="leading-tight">
                    <div className="font-headings font-extrabold tracking-wide text-lg">CAMBRIDGE</div>
                    <div className="text-[11px] text-white/85">Education System</div>
                  </div>
                </div>
                <div className="font-headings font-extrabold text-2xl tracking-[0.2em]">INVOICE</div>
              </div>

              {/* Payment details + due date + QR codes */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <span className="text-slate-500 text-[11px] block">Payment Method &amp; Bank Details</span>
                  <span className="font-semibold text-slate-900">
                    {detail.bankAccount?.bankName || 'Meezan Bank'}{' '}
                    {detail.bankAccount?.branchName ? `(${detail.bankAccount.branchName})` : 'F-11 MARKAZ, ISLAMABAD'}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    Title: {detail.bankAccount?.accountTitle || 'CAMBRIDGE EDUCATION SYSTEM'}
                  </span>
                  <span className="text-[10px] text-slate-700 block font-mono font-semibold">
                    Account Number : {detail.bankAccount?.accountNumber || '03060114428178'}
                  </span>
                  <span className="text-[10px] text-slate-500 block font-mono">
                    IBAN : {detail.bankAccount?.iban || 'PK58MEZN0003060114428178'}
                  </span>
                  <span className="text-[10px] text-slate-500 block font-mono">Consumer No (1Link) : {detail.consumerNumber}</span>
                  <div className="flex items-start gap-3 mt-2 break-inside-avoid">
                    <div className="flex-1 min-w-0 space-y-0.5">
                      {detail.paymentDetails?.paymentMethod && (
                        <span className="text-[10px] text-slate-500 block">
                          Payment Method: <span className="font-semibold text-slate-700">{detail.paymentDetails.paymentMethod}</span>
                        </span>
                      )}
                      {detail.bankAccount?.instructions && (
                        <span className="text-[10px] text-slate-600 block whitespace-pre-line break-words">{detail.bankAccount.instructions}</span>
                      )}
                    </div>
                    {detail.paymentDetails?.qr.enabled && detail.paymentDetails.qr.url && (
                      <div className="shrink-0 text-center break-inside-avoid">
                        <img
                          src={detail.paymentDetails.qr.url}
                          alt="Payment QR code"
                          className="w-24 h-24 object-contain bg-white border border-slate-200 rounded-md p-0.5"
                        />
                        <span className="text-[9px] text-slate-500 block mt-0.5 max-w-[6rem] leading-tight break-words">
                          Scan to pay{detail.paymentDetails.qr.label ? ` · ${detail.paymentDetails.qr.label}` : ''}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-start gap-3 shrink-0">
                  <div className="text-right">
                    <span className="text-slate-500 text-[11px] block">Due Date</span>
                    <span className="font-mono font-bold text-amber-700 text-sm">{detail.dueDate}</span>
                    <span className="text-[10px] text-slate-500 block">Status: {statusLabel(detail.status)}</span>
                    <span className="text-[10px] text-slate-500 block">Invoice No: {detail.challanNumber}</span>
                  </div>
                  {/* Automatic information QR: challan details + verification link (not a payment QR) */}
                  <div className="text-center break-inside-avoid">
                    <img
                      src={`/api/v1/fees/challans/${detail.id}/info-qr`}
                      alt="Challan details QR code"
                      className="w-36 h-36 object-contain bg-white border border-slate-200 rounded-md p-0.5"
                    />
                    <span className="text-[9px] text-slate-500 block mt-0.5 leading-tight">Scan for challan details &amp; verification</span>
                  </div>
                </div>
              </div>

              {/* 3 voucher copies, side by side on screen and on paper */}
              <div className="grid grid-cols-1 md:grid-cols-3 print:grid-cols-3 gap-3">
                {['Bank Copy', 'School Copy', 'Student / Parent Copy'].map((copyTitle) => (
                  <div
                    key={copyTitle}
                    className="p-3.5 rounded-xl bg-white border border-slate-200 flex flex-col justify-between gap-3 text-[11px] shadow-2xs break-inside-avoid"
                  >
                    <div>
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <span className="font-bold text-amber-700 text-[10px] uppercase tracking-wider">{copyTitle}</span>
                        <span className="font-mono text-[10px] text-slate-400">{detail.challanNumber}</span>
                      </div>

                      <div className="my-1.5 p-1.5 rounded bg-slate-50 border border-slate-100 text-[10px]">
                        <span className="text-slate-400 block">Bank Account:</span>
                        <span className="font-bold text-slate-800">{detail.bankAccount?.bankName || 'Meezan Bank'}</span>
                        <span className="font-mono text-slate-600 block">{detail.bankAccount?.accountNumber || '03060114428178'}</span>
                        {detail.bankAccount?.accountTitle && (
                          <span className="text-slate-500 block break-words">{detail.bankAccount.accountTitle}</span>
                        )}
                        {detail.paymentDetails?.qr.enabled && detail.paymentDetails.qr.url && copyTitle !== 'Bank Copy' && (
                          <div className="mt-1.5 text-center break-inside-avoid">
                            <img
                              src={detail.paymentDetails.qr.url}
                              alt="Payment QR code"
                              className="w-16 h-16 object-contain bg-white border border-slate-200 rounded-md p-0.5 mx-auto"
                            />
                            <span className="text-[9px] text-slate-500 block mt-0.5 leading-tight">Scan to pay</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-2 space-y-1 text-slate-700">
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-400">Student:</span>
                          <span className="font-semibold text-slate-900 text-right">{detail.studentName}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-400">Class:</span>
                          <span>{detail.className}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-400">Roll No:</span>
                          <span className="font-mono">{detail.rollNo || '—'}</span>
                        </div>
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 space-y-1 font-mono">
                        {VOUCHER_LINES.filter(([key, , always]) => always || Number(detail.breakdown[key]) > 0).map(([key, label]) => (
                          <div key={key} className="flex justify-between text-slate-600">
                            <span>{label}</span>
                            <span>Rs. {Number(detail.breakdown[key] || 0).toLocaleString()}</span>
                          </div>
                        ))}
                        {Number(detail.breakdown.concession) > 0 && (
                          <div className="flex justify-between text-emerald-700 font-semibold">
                            <span>Concession</span>
                            <span>-Rs. {Number(detail.breakdown.concession).toLocaleString()}</span>
                          </div>
                        )}
                        {Number(detail.breakdown.arrears) > 0 && (
                          <div className="flex justify-between text-amber-700 font-semibold">
                            <span>Previous Arrears</span>
                            <span>+Rs. {Number(detail.breakdown.arrears).toLocaleString()}</span>
                          </div>
                        )}
                        {Number(detail.breakdown.lateFee) > 0 && detail.status === 'OVERDUE' && (
                          <div className="flex justify-between text-rose-700 font-semibold">
                            <span>Late Fee</span>
                            <span>+Rs. {Number(detail.breakdown.lateFee).toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between pt-1 border-t border-slate-200 text-slate-900 font-bold text-xs">
                          <span>Net Payable</span>
                          <span>Rs. {Number(detail.totalPayable).toLocaleString()}</span>
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
            </div>

            {/* Balance summary for the parent (screen only) */}
            <div className="grid grid-cols-3 gap-3 text-xs print:hidden">
              <div className="p-2.5 rounded-sm bg-muted/40 border border-border">
                <span className="text-muted-foreground block">Net payable</span>
                <span className="font-bold">{rupees(detail.totalPayable)}</span>
              </div>
              <div className="p-2.5 rounded-sm bg-muted/40 border border-border">
                <span className="text-muted-foreground block">Paid (verified)</span>
                <span className="font-bold text-success">{rupees(detail.paidAmount)}</span>
              </div>
              <div className="p-2.5 rounded-sm bg-muted/40 border border-border">
                <span className="text-muted-foreground block">Outstanding</span>
                <span className="font-bold text-error">{rupees(detail.outstandingBalance)}</span>
              </div>
            </div>

            <div className="print:hidden">
              <div className="font-headings font-bold text-sm text-foreground mb-2">Payment history</div>
              {detail.payments.length === 0 ? (
                <p className="text-xs text-muted-foreground">No payments have been submitted for this challan.</p>
              ) : (
                <ul className="divide-y divide-border text-xs">
                  {detail.payments.map((p) => (
                    <li key={p.id} className="py-2 flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-foreground">
                          {rupees(p.submittedAmount)} · {p.bankOrWallet}
                        </div>
                        <div className="text-muted-foreground">
                          Ref {p.transactionReference} · Paid {formatDate(p.paymentDate)} · Submitted {formatDateTime(p.submittedAt)}
                        </div>
                        {p.receiptNumber && <div className="text-muted-foreground">Receipt {p.receiptNumber}</div>}
                        {p.reviewNote && <div className="text-muted-foreground italic">“{p.reviewNote}”</div>}
                      </div>
                      <StatusChip status={p.status.charAt(0) + p.status.slice(1).toLowerCase()} />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex justify-end print:hidden">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-sm bg-muted hover:bg-[#ffc53a] text-foreground cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Print / Save as PDF
              </button>
            </div>

            {detail.status !== 'PAID' && detail.status !== 'PENDING_VERIFICATION' && (
              <PaymentProofForm
                studentId={studentId}
                challan={detail}
                onDone={() => {
                  setDetail(null);
                  reload();
                  refreshDashboard();
                }}
              />
            )}
            {detail.status === 'PENDING_VERIFICATION' && (
              <p className="text-xs text-warning bg-warning-bg rounded-sm px-3 py-2 print:hidden">
                A payment proof for this challan is awaiting verification by the school.
              </p>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

export default function Fees() {
  return (
    <RequireChild>
      <FeesContent />
    </RequireChild>
  );
}
