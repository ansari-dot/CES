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

const BREAKDOWN_LABELS: [string, string][] = [
  ['tuition', 'Tuition Fee'],
  ['technology', 'Technology Fee'],
  ['examination', 'Examination Fee'],
  ['books', 'Books'],
  ['admission', 'Admission Fee'],
  ['other', 'Other Charges'],
  ['arrears', 'Arrears'],
  ['lateFee', 'Late Fee'],
];

const statusLabel = (s: string) => CHALLAN_STATUS_LABELS[s] || s;

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
  const { selectedChild, showToast, refreshDashboard, user } = useParent();
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
        <Modal isOpen={Boolean(detail)} onClose={() => setDetail(null)} title={`Fee Challan · ${detail.billingMonth}`} maxWidth="max-w-xl">
          <div className="space-y-4 text-sm" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } as React.CSSProperties}>
            {/* Branded invoice header — Cambridge Education System template */}
            <div className="bg-navy text-white rounded-md px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center overflow-hidden shrink-0">
                  <img src="/logo.jpeg" alt="Cambridge Education System logo" className="w-full h-full object-contain" />
                </div>
                <div className="leading-tight">
                  <div className="font-headings font-extrabold tracking-wide text-lg">CAMBRIDGE</div>
                  <div className="text-xs text-white/85">Education System</div>
                </div>
              </div>
              <div className="font-headings font-extrabold text-2xl tracking-[0.2em]">INVOICE</div>
            </div>

            <div className="flex items-center justify-between gap-3 text-xs">
              <div><span className="text-muted-foreground">Invoice No:</span> <span className="font-mono font-semibold">{detail.challanNumber}</span></div>
              <div><span className="text-muted-foreground">Date :</span> <span className="font-semibold">{formatDate(detail.issueDate)}</span></div>
              <StatusChip status={statusLabel(detail.status)} />
            </div>

            <div className="text-center font-headings font-bold text-sm underline underline-offset-4">INVOICE TO:</div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <div className="font-headings font-bold underline underline-offset-4 mb-1.5">Student Details:</div>
                <div className="space-y-0.5">
                  <div className="font-semibold">{detail.studentName}</div>
                  <div className="text-muted-foreground">{detail.className} · Admission No {detail.admissionNo}</div>
                  <div className="text-muted-foreground">Session {detail.academicSession} · {detail.billingMonth}</div>
                  <div className="text-muted-foreground font-mono">Consumer No (1Link): {detail.consumerNumber}</div>
                  <div className="text-muted-foreground">Due {formatDate(detail.dueDate)} · Valid until {formatDate(detail.validUntil)}</div>
                </div>
              </div>
              <div>
                <div className="font-headings font-bold underline underline-offset-4 mb-1.5">Parents Details:</div>
                <div className="space-y-0.5">
                  <div className="font-semibold">{user?.fullName || '—'}</div>
                  {user?.email && <div className="text-muted-foreground">{user.email}</div>}
                  {user?.phone && <div className="text-muted-foreground">{user.phone}</div>}
                </div>
              </div>
            </div>

            <table className="w-full text-xs border border-border">
              <thead>
                <tr className="bg-navy text-white">
                  <th className="px-3 py-2 text-left font-bold w-14">SR.NO</th>
                  <th className="px-3 py-2 text-left font-bold">DESCRIPTION</th>
                  <th className="px-3 py-2 text-right font-bold">TOTAL FEE</th>
                  <th className="px-3 py-2 text-right font-bold">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {BREAKDOWN_LABELS.filter(([key]) => Number(detail.breakdown[key]) > 0).map(([key, label], i) => (
                  <tr key={key}>
                    <td className="px-3 py-1.5 font-mono text-muted-foreground">{String(i + 1).padStart(2, '0')}</td>
                    <td className="px-3 py-1.5">{label}</td>
                    <td className="px-3 py-1.5 text-right">{rupees(detail.breakdown[key])}</td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground">{statusLabel(detail.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="grid grid-cols-2 gap-4 text-xs items-start">
              <div>
                <div className="font-headings font-bold mb-1">Payment Method :</div>
                <div className="space-y-0.5 text-muted-foreground">
                  <div>Meezan Bank F-11 MARKAZ, ISLAMABAD</div>
                  <div>Title: CAMBRIDGE EDUCATION SYSTEM</div>
                  <div>Account Number : 03060114428178</div>
                  <div>IBAN : PK58MEZN0003060114428178</div>
                </div>
              </div>
              <div>
                <div className="flex justify-between py-1 border-b border-border"><span className="text-muted-foreground">Sub-total :</span><span>{rupees(BREAKDOWN_LABELS.reduce((s, [key]) => s + (Number(detail.breakdown[key]) > 0 ? Number(detail.breakdown[key]) : 0), 0))}</span></div>
                <div className="flex justify-between py-1 border-b border-border"><span className="text-muted-foreground">Discount:</span><span className="text-success">{Number(detail.breakdown.concession) > 0 ? `− ${rupees(detail.breakdown.concession)}` : '—'}</span></div>
                <div className="flex justify-between py-1.5 font-bold border-b-2 border-navy"><span>Total :</span><span>{rupees(detail.totalPayable)}</span></div>
                <div className="flex justify-between py-1"><span className="text-muted-foreground">Paid (verified)</span><span>{rupees(detail.paidAmount)}</span></div>
                <div className="flex justify-between py-1 font-bold text-error"><span>Outstanding</span><span>{rupees(detail.outstandingBalance)}</span></div>
              </div>
            </div>

            {/* Branded contact footer */}
            <div className="bg-navy text-white rounded-md px-4 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-[11px]">
              <span className="inline-flex items-center gap-1.5"><Phone className="w-3 h-3" /> 0300 511 8716</span>
              <span className="inline-flex items-center gap-1.5"><Globe className="w-3 h-3" /> www.cambridgeeducation.uk.com</span>
              <span className="inline-flex items-center gap-1.5"><MapPin className="w-3 h-3" /> Islamabad Pakistan</span>
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
