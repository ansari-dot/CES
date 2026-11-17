import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import {
  MonthlyChallan,
  SchoolBankAccount,
  ChallanPaymentDetails,
  ChallanPaymentDetailsResponse
} from '../../types';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import {
  QrCode,
  Upload,
  Trash2,
  History,
  ShieldCheck,
  AlertTriangle,
  Lock,
  RefreshCw,
  Building2,
  CheckCircle2
} from 'lucide-react';

const QR_MAX_BYTES = 1024 * 1024;
const QR_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const PAYMENT_METHOD_SUGGESTIONS = [
  'Bank Deposit / Online Transfer',
  'Bank Deposit',
  'Online Banking / IBFT',
  'Raast',
  'Mobile Wallet',
  '1Link Bill Payment',
  'Cash at School Office'
];
const SOURCE_LABELS: Record<ChallanPaymentDetails['source'], string> = {
  ISSUED_SNAPSHOT: 'As issued',
  PRINCIPAL_EDIT: 'Edited',
  BANK_REASSIGNMENT: 'Bank reassigned'
};

interface FormState {
  accountTitle: string;
  bankName: string;
  branchName: string;
  accountNumber: string;
  iban: string;
  paymentMethod: string;
  instructions: string;
  qrEnabled: boolean;
  qrLabel: string;
}

const fromDetails = (d: ChallanPaymentDetails | null): FormState => ({
  accountTitle: d?.accountTitle || '',
  bankName: d?.bankName || '',
  branchName: d?.branchName || '',
  accountNumber: d?.accountNumber || '',
  iban: d?.iban || '',
  paymentMethod: d?.paymentMethod || 'Bank Deposit / Online Transfer',
  instructions: d?.instructions || '',
  qrEnabled: Boolean(d?.qr.enabled),
  qrLabel: d?.qr.label || ''
});

/**
 * Payment method, instructions and (optional) QR code printed on a challan.
 * Shared by the voucher, the live preview and the parent-facing copy.
 */
export const ChallanPaymentExtras: React.FC<{
  method?: string | null;
  instructions?: string | null;
  qrUrl?: string | null;
  qrLabel?: string | null;
  compact?: boolean;
}> = ({ method, instructions, qrUrl, qrLabel, compact = false }) => {
  if (!method && !instructions && !qrUrl) return null;
  return (
    <div className={`flex items-start gap-3 break-inside-avoid ${compact ? 'mt-1.5' : 'mt-2'}`}>
      <div className="flex-1 min-w-0 space-y-0.5">
        {method && (
          <span className="text-[10px] text-slate-500 block">
            Payment Method: <span className="font-semibold text-slate-700">{method}</span>
          </span>
        )}
        {instructions && (
          <span className="text-[10px] text-slate-600 block whitespace-pre-line break-words">{instructions}</span>
        )}
      </div>
      {qrUrl && (
        <div className="shrink-0 text-center break-inside-avoid">
          <img
            src={qrUrl}
            alt="Payment QR code"
            className={`${compact ? 'w-16 h-16' : 'w-24 h-24'} object-contain bg-white border border-slate-200 rounded-md p-0.5`}
          />
          <span className="text-[9px] text-slate-500 block mt-0.5 max-w-[6rem] leading-tight break-words">
            Scan to pay{qrLabel ? ` · ${qrLabel}` : ''}
          </span>
        </div>
      )}
    </div>
  );
};

interface Props {
  challan: MonthlyChallan;
  bankAccounts: SchoolBankAccount[];
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const ChallanPaymentDetailsModal: React.FC<Props> = ({ challan, bankAccounts, isOpen, onClose, onSaved }) => {
  const toast = useToast();
  const [data, setData] = useState<ChallanPaymentDetailsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(fromDetails(null));
  const [reason, setReason] = useState('');
  const [qrAction, setQrAction] = useState<'keep' | 'replace' | 'remove'>('keep');
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null);
  const [qrAttested, setQrAttested] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await api.getChallanPaymentDetails(challan.id);
      setData(res);
      setForm(fromDetails(res.current));
      setReason('');
      setQrAction('keep');
      setQrFile(null);
      setQrAttested(false);
      setConfirming(false);
      setFormError(null);
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load payment details');
    } finally {
      setLoading(false);
    }
  }, [challan.id]);

  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  // Object URL for the locally selected QR (revoked when replaced/unmounted)
  useEffect(() => {
    if (!qrFile) {
      setQrPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(qrFile);
    setQrPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [qrFile]);

  const current = data?.current || null;
  const editable = Boolean(data?.editable);
  const effectiveQrUrl = qrAction === 'remove' ? null : qrAction === 'replace' ? qrPreviewUrl : current?.qr.url || null;
  const hasQr = Boolean(effectiveQrUrl);

  const set = (patch: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...patch }));
    setConfirming(false);
  };

  const handleQrSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!QR_TYPES.includes(file.type)) {
      setFormError('QR code must be a PNG, JPEG or WebP image.');
      return;
    }
    if (file.size > QR_MAX_BYTES) {
      setFormError('QR code image must be 1 MB or smaller.');
      return;
    }
    setFormError(null);
    setQrFile(file);
    setQrAction('replace');
    setQrAttested(false);
    set({ qrEnabled: true, qrLabel: form.qrLabel || form.accountTitle });
  };

  const handleRemoveQr = () => {
    setQrFile(null);
    setQrAction(current?.qr.uploaded ? 'remove' : 'keep');
    set({ qrEnabled: false });
  };

  const prefillFromAccount = (id: string) => {
    const acc = bankAccounts.find((b) => String(b.id) === id);
    if (!acc) return;
    set({
      accountTitle: acc.accountTitle || '',
      bankName: acc.bankName || '',
      branchName: acc.branchName || '',
      accountNumber: acc.accountNumber || '',
      iban: acc.iban || '',
      instructions: acc.instructions || form.instructions
    });
  };

  const changes = useMemo(() => {
    if (!current) return [] as string[];
    const list: string[] = [];
    const cmp = (label: string, a: string | null | undefined, b: string) => {
      if ((a || '') !== b.trim()) list.push(`${label}: "${a || '—'}" → "${b.trim() || '—'}"`);
    };
    cmp('Recipient / Account Title', current.accountTitle, form.accountTitle);
    cmp('Bank', current.bankName, form.bankName);
    cmp('Branch', current.branchName, form.branchName);
    cmp('Account Number', current.accountNumber, form.accountNumber);
    cmp('IBAN', current.iban, form.iban.replace(/\s+/g, '').toUpperCase());
    cmp('Payment Method', current.paymentMethod, form.paymentMethod);
    cmp('Instructions', current.instructions, form.instructions);
    if (qrAction === 'replace') list.push(current.qr.uploaded ? 'QR code replaced' : 'QR code added');
    if (qrAction === 'remove') list.push('QR code removed');
    if (qrAction !== 'remove' && Boolean(current.qr.enabled) !== (form.qrEnabled && hasQr)) {
      list.push(form.qrEnabled ? 'QR code shown on challan' : 'QR code hidden from challan');
    }
    return list;
  }, [current, form, qrAction, hasQr]);

  const validate = (): string | null => {
    if (!form.accountTitle.trim()) return 'Recipient / account title is required.';
    if (!form.paymentMethod.trim()) return 'Payment method is required.';
    if (!form.accountNumber.trim() && !form.iban.trim() && !/cash/i.test(form.paymentMethod)) {
      return 'Provide an account number or IBAN for non-cash payment methods.';
    }
    if (qrAction === 'replace' && !qrAttested) {
      return 'Confirm that you have verified the QR code pays the recipient shown.';
    }
    if (reason.trim().length < 5) return 'Enter the reason for this change (at least 5 characters).';
    if (changes.length === 0) return 'No changes to save.';
    return null;
  };

  const handleReview = () => {
    const err = validate();
    setFormError(err);
    if (!err) setConfirming(true);
  };

  const handleSave = async () => {
    if (!current) return;
    try {
      setSaving(true);
      setFormError(null);
      await api.reviseChallanPaymentDetails(
        challan.id,
        {
          accountTitle: form.accountTitle.trim(),
          bankName: form.bankName.trim(),
          branchName: form.branchName.trim(),
          accountNumber: form.accountNumber.trim(),
          iban: form.iban.trim(),
          paymentMethod: form.paymentMethod.trim(),
          instructions: form.instructions.trim(),
          reason: reason.trim(),
          confirmRevision: true,
          expectedRevision: current.revision,
          qrAction,
          qrEnabled: form.qrEnabled && hasQr,
          qrAttested: qrAction === 'replace' ? qrAttested : undefined,
          qrLabel: hasQr ? form.qrLabel.trim() : undefined
        },
        qrAction === 'replace' ? qrFile : null
      );
      toast.success(`Challan ${challan.challanNumber}: revised payment details issued.`);
      onSaved();
      onClose();
    } catch (err: any) {
      setConfirming(false);
      setFormError(err?.message || 'Failed to save payment details');
      if (err?.status === 409) {
        // Someone else changed it, or the challan became locked: show the latest state
        await load();
        setFormError(err?.message || 'These payment details changed. Review the latest version.');
      }
    } finally {
      setSaving(false);
    }
  };

  const input = 'w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:outline-none disabled:bg-slate-50 disabled:text-slate-500';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Challan Payment Details · ${challan.challanNumber}`}
      description={`${challan.studentName} (Class ${challan.classNumber}) · ${challan.billingMonth}. Changes apply to this challan only.`}
      maxWidth="4xl"
    >
      {loading ? (
        <div className="py-10 text-center text-xs text-slate-500">Loading payment details…</div>
      ) : loadError ? (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between gap-2">
          <span>{loadError}</span>
          <button onClick={load} className="px-2.5 py-1 rounded-lg border border-rose-300 bg-white text-rose-700 font-medium">
            Retry
          </button>
        </div>
      ) : (
        <div className="space-y-4 text-xs">
          {!editable ? (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 flex items-start gap-2">
              <Lock className="w-4 h-4 mt-0.5 text-slate-500 shrink-0" />
              <span>{data?.lockedReason}</span>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
              <span className="font-bold">Issued challan:</span> saving creates revision {(current?.revision || 0) + 1}. The
              fee amount, concessions, balance and payment history are not changed, and earlier revisions stay on record.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* ---- Form ---- */}
            <div className="lg:col-span-3 space-y-3">
              {editable && bankAccounts.length > 0 && (
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" />
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      prefillFromAccount(e.target.value);
                      e.target.value = '';
                    }}
                    className="flex-1 text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none shadow-2xs"
                  >
                    <option value="">Fill from a school bank account…</option>
                    {bankAccounts.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.bankName} · {b.accountNumber}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Recipient / Account Title <span className="text-rose-500">*</span>
                </label>
                <input className={input} disabled={!editable} maxLength={150} value={form.accountTitle} onChange={(e) => set({ accountTitle: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Bank Name</label>
                  <input className={input} disabled={!editable} maxLength={100} value={form.bankName} onChange={(e) => set({ bankName: e.target.value })} />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Branch</label>
                  <input className={input} disabled={!editable} maxLength={150} value={form.branchName} onChange={(e) => set({ branchName: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Account Number</label>
                  <input className={`${input} font-mono`} disabled={!editable} maxLength={50} value={form.accountNumber} onChange={(e) => set({ accountNumber: e.target.value })} />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">IBAN</label>
                  <input
                    className={`${input} font-mono`}
                    disabled={!editable}
                    maxLength={40}
                    placeholder="PK.."
                    value={form.iban}
                    onChange={(e) => set({ iban: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Payment Method <span className="text-rose-500">*</span>
                </label>
                <input
                  className={input}
                  disabled={!editable}
                  list="challan-payment-methods"
                  maxLength={60}
                  value={form.paymentMethod}
                  onChange={(e) => set({ paymentMethod: e.target.value })}
                />
                <datalist id="challan-payment-methods">
                  {PAYMENT_METHOD_SUGGESTIONS.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Payment Instructions</label>
                <textarea
                  className={input}
                  disabled={!editable}
                  rows={2}
                  maxLength={1000}
                  placeholder="e.g. Write the challan number in the transfer reference."
                  value={form.instructions}
                  onChange={(e) => set({ instructions: e.target.value })}
                />
              </div>

              {/* ---- QR code ---- */}
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-slate-600" /> Payment QR Code (optional)
                  </span>
                  {editable && (
                    <div className="flex items-center gap-1.5">
                      <label className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 cursor-pointer flex items-center gap-1 font-medium">
                        <Upload className="w-3 h-3" />
                        {hasQr ? 'Replace' : 'Upload'}
                        <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleQrSelect} />
                      </label>
                      {hasQr && (
                        <button
                          type="button"
                          onClick={handleRemoveQr}
                          className="px-2.5 py-1 rounded-lg border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 flex items-center gap-1 font-medium"
                        >
                          <Trash2 className="w-3 h-3" /> Remove
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {hasQr ? (
                  <div className="flex items-start gap-3">
                    <img src={effectiveQrUrl!} alt="QR code preview" className="w-24 h-24 object-contain bg-white border border-slate-200 rounded-md p-0.5" />
                    <div className="flex-1 space-y-2">
                      <label className="flex items-center gap-2 text-slate-700">
                        <input
                          type="checkbox"
                          disabled={!editable}
                          checked={form.qrEnabled}
                          onChange={(e) => set({ qrEnabled: e.target.checked })}
                          className="accent-emerald-600"
                        />
                        Show this QR code on the challan
                      </label>
                      <div>
                        <label className="block text-slate-600 mb-0.5">Label under the QR (recipient it pays)</label>
                        <input className={input} disabled={!editable} maxLength={150} value={form.qrLabel} onChange={(e) => set({ qrLabel: e.target.value })} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    {qrAction === 'remove' ? 'The QR code will be removed from this challan.' : 'No QR code on this challan.'} PNG, JPEG or WebP, up to 1 MB.
                  </p>
                )}

                {qrAction === 'replace' && (
                  <label className="flex items-start gap-2 p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                    <input type="checkbox" checked={qrAttested} onChange={(e) => setQrAttested(e.target.checked)} className="mt-0.5 accent-amber-600" />
                    <span>
                      I have scanned this QR code and verified that it pays <strong>{form.qrLabel || form.accountTitle || 'the recipient above'}</strong>.
                      The system cannot read QR contents and will not assume it matches the account details.
                    </span>
                  </label>
                )}
              </div>

              {editable && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Reason for change <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className={input}
                    maxLength={500}
                    placeholder="e.g. Parent requested payment via the HBL account"
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value);
                      setConfirming(false);
                    }}
                  />
                </div>
              )}
            </div>

            {/* ---- Live preview ---- */}
            <div className="lg:col-span-2 space-y-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Challan preview</span>
              <div className="p-3.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1">
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                  <span className="font-bold text-amber-700 text-[10px] uppercase tracking-wider">Payment Details</span>
                  <span className="font-mono text-[10px] text-slate-400">{challan.challanNumber}</span>
                </div>
                <span className="font-semibold text-slate-900 block">
                  {form.bankName || '—'} {form.branchName ? `(${form.branchName})` : ''}
                </span>
                <span className="text-[10px] text-slate-500 block">Title: {form.accountTitle || '—'}</span>
                {form.accountNumber && <span className="text-[10px] text-slate-700 block font-mono font-semibold">Account Number : {form.accountNumber}</span>}
                {form.iban && <span className="text-[10px] text-slate-500 block font-mono">IBAN : {form.iban.replace(/\s+/g, '')}</span>}
                <ChallanPaymentExtras
                  method={form.paymentMethod}
                  instructions={form.instructions}
                  qrUrl={form.qrEnabled ? effectiveQrUrl : null}
                  qrLabel={form.qrLabel}
                />
                <div className="pt-1.5 mt-1.5 border-t border-slate-100 flex justify-between font-mono text-slate-900 font-bold">
                  <span>Net Payable</span>
                  <span>Rs. {challan.breakdown.totalPayable.toLocaleString()}</span>
                </div>
                <span className="text-[10px] text-slate-400 block">Amount is unchanged by payment-detail edits.</span>
              </div>

              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-1.5"
              >
                <History className="w-3.5 h-3.5" /> {showHistory ? 'Hide' : 'Show'} revision history ({data?.history.length || 0})
              </button>
              {showHistory && (
                <div className="max-h-56 overflow-y-auto space-y-1.5">
                  {data?.history.map((h) => (
                    <div key={h.revision} className="p-2 rounded-lg border border-slate-200 bg-white text-[10px] leading-relaxed">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">
                          Rev {h.revision} · {SOURCE_LABELS[h.source]}
                          {h.revision === current?.revision && <span className="ml-1 text-emerald-700">(current)</span>}
                        </span>
                        <span className="text-slate-400">{new Date(h.updatedAt).toLocaleString()}</span>
                      </div>
                      <div className="text-slate-600">
                        {h.accountTitle} · {h.bankName || '—'} · {h.accountNumber || h.iban || '—'}
                        {h.qr.uploaded ? ` · QR ${h.qr.enabled ? 'shown' : 'hidden'}` : ''}
                      </div>
                      <div className="text-slate-500">
                        By {h.updatedBy}
                        {h.changeReason ? ` — ${h.changeReason}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {formError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {confirming && (
            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1.5">
              <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Issue revised payment details for this challan?
              </span>
              <ul className="list-disc pl-5 text-emerald-900 text-[11px] space-y-0.5">
                {changes.map((c) => (
                  <li key={c} className="break-words">
                    {c}
                  </li>
                ))}
              </ul>
              <span className="text-[11px] text-emerald-800 block">
                Only {challan.studentName}&apos;s {challan.billingMonth} challan changes. Reprint or re-share the challan after saving.
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button type="button" onClick={onClose} className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
              {editable ? 'Cancel' : 'Close'}
            </button>
            {editable &&
              (confirming ? (
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSave}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-xs flex items-center gap-1.5"
                >
                  {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {saving ? 'Saving…' : 'Confirm & Issue Revision'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleReview}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-xs"
                >
                  Review Changes
                </button>
              ))}
          </div>
        </div>
      )}
    </Modal>
  );
};
