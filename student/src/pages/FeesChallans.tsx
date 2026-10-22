import React, { useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Download, UploadCloud, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { RootState, AppDispatch } from '../store';
import { submitPaymentProof } from '../store/slices/feesSlice';
import { setToast } from '../store/slices/studentSlice';
import StatusChip from '../components/common/StatusChip';

export default function FeesChallans() {
  const dispatch = useDispatch<AppDispatch>();
  const { summary, challans, proofStatus, submitting } = useSelector((state: RootState) => state.fees);
  const { profile } = useSelector((state: RootState) => state.student);

  const [selectedChallanId, setSelectedChallanId] = useState<number | null>(
    challans.find((c) => c.status !== 'Paid')?.challanId ?? null
  );
  const [refNo, setRefNo] = useState('');
  const [bankOrWallet, setBankOrWallet] = useState('Bank Transfer');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedChallan = challans.find((c) => c.challanId === selectedChallanId) ?? challans[0];

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refNo.trim() || !selectedChallan) return;

    const result = await dispatch(submitPaymentProof({
      challanId: selectedChallan.challanId,
      studentId: profile.studentId,
      submittedAmount: selectedChallan.totalPayable,
      bankOrWallet,
      transactionReference: refNo.trim(),
      paymentDate,
      file: proofFile,
    }));

    if (submitPaymentProof.fulfilled.match(result)) {
      dispatch(setToast('Proof of payment submitted! Awaiting school audit.'));
      setRefNo('');
      setProofFile(null);
    } else {
      dispatch(setToast(String(result.payload) || 'Submission failed. Please try again.'));
    }
  };

  const handleDownload = (challanCode: string) => {
    dispatch(setToast(`Downloading Challan PDF for ${challanCode}…`));
  };

  return (
    <div className="space-y-6">
      {/* 3 Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-navy text-white rounded-md p-5 shadow-sm">
          <div className="text-xs font-semibold opacity-70 uppercase tracking-wider">Outstanding Balance</div>
          <div className="text-3xl font-headings font-bold mt-1">{summary.outstandingBalance}</div>
          <div className="text-xs opacity-75 mt-0.5">{summary.dueNotice}</div>
        </div>
        <div className="bg-card border border-border rounded-md p-5 shadow-sm">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">This Month's Challan</div>
          <div className="text-3xl font-headings font-bold text-foreground mt-1">{summary.thisMonthChallan}</div>
          <div className="mt-1"><StatusChip status={summary.thisMonthStatus} /></div>
        </div>
        <div className="bg-card border border-border rounded-md p-5 shadow-sm">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Payment</div>
          <div className="text-3xl font-headings font-bold text-success mt-1">{summary.lastPaymentAmount}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{summary.lastPaymentDate}</div>
        </div>
      </div>

      {/* Notice Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-md p-3.5 text-xs text-amber-800 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
        <span>Your payment will be reflected as paid after the school accounts desk verifies your submitted proof.</span>
      </div>

      {/* Challans List */}
      <div className="bg-card border border-border rounded-md p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <span className="font-headings font-bold text-base text-foreground">Challans</span>
          <button
            onClick={() => document.getElementById('proof-form')?.scrollIntoView({ behavior: 'smooth' })}
            className="text-xs font-bold bg-primary text-white px-3 py-1.5 rounded-sm hover:bg-primary-hover transition cursor-pointer"
          >
            Submit payment proof
          </button>
        </div>
        {challans.length === 0 ? (
          <div className="text-sm text-muted-foreground py-4">No challans found.</div>
        ) : (
          <div className="divide-y divide-border">
            {challans.map((ch) => (
              <div key={ch.id} className="py-3.5 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="text-sm font-semibold text-foreground">{ch.code}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{ch.desc}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-foreground">{ch.amount}</span>
                  <StatusChip status={ch.status} />
                  <button
                    onClick={() => handleDownload(ch.code)}
                    className="text-xs font-bold text-primary flex items-center gap-1 hover:underline ml-2 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Challan</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Proof Submission */}
      <div id="proof-form" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-card border border-border rounded-md p-5 shadow-sm">
          <div className="font-headings font-bold text-base text-foreground mb-4">Submit payment proof</div>
          <form onSubmit={handleSubmitProof} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Challan</label>
                <select
                  value={selectedChallanId ?? ''}
                  onChange={(e) => setSelectedChallanId(Number(e.target.value))}
                  className="w-full bg-card border border-border rounded-sm px-3 py-2 text-xs focus:outline-none cursor-pointer"
                >
                  {challans.map((ch) => (
                    <option key={ch.id} value={ch.challanId}>{ch.code}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Amount</label>
                <input
                  type="text"
                  value={selectedChallan?.amount ?? '—'}
                  disabled
                  className="w-full bg-muted border border-border rounded-sm px-3 py-2 text-xs text-muted-foreground"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Bank / Wallet</label>
              <input
                type="text"
                value={bankOrWallet}
                onChange={(e) => setBankOrWallet(e.target.value)}
                placeholder="e.g. Bank Alfalah, JazzCash"
                className="w-full bg-card border border-border rounded-sm px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Transaction / Reference Number</label>
              <input
                type="text"
                placeholder="e.g. TRX-992102-ALF"
                value={refNo}
                onChange={(e) => setRefNo(e.target.value)}
                required
                className="w-full bg-card border border-border rounded-sm px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Payment Date</label>
              <input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full bg-card border border-border rounded-sm px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div
              className="border border-dashed border-border rounded-sm p-4 text-center bg-muted/20 cursor-pointer"
              onClick={() => fileRef.current?.click()}
            >
              <UploadCloud className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
              <div className="text-xs text-muted-foreground">
                {proofFile ? proofFile.name : 'Upload receipt photo or screenshot (optional)'}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => setProofFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary hover:bg-primary-hover text-white py-2.5 text-xs font-bold rounded-sm transition disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Submitting…' : 'Submit for verification'}
            </button>
          </form>
        </div>

        {/* Verification Status */}
        <div className="bg-card border border-border rounded-md p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="font-headings font-bold text-sm text-foreground mb-3">Verification status</div>
            <div className="space-y-3 text-xs">
              {proofStatus.hasSubmitted ? (
                <div className="flex items-start gap-2 text-amber-600 font-medium">
                  <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Proof submitted on {proofStatus.submittedAt} · Ref: {proofStatus.referenceNo}</span>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-amber-600 font-medium">
                  <Clock className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>No pending proof right now</span>
                </div>
              )}
              <div className="flex items-start gap-2 text-success font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{proofStatus.verifiedHistory || 'No verified payments yet.'}</span>
              </div>
            </div>
          </div>
          <div className="bg-muted p-3 rounded-sm text-[11px] text-muted-foreground mt-4">
            School office hours: Mon–Fri, 9 AM – 3 PM
          </div>
        </div>
      </div>
    </div>
  );
}
