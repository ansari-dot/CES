import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { Lock, MessageCircle, RefreshCw } from 'lucide-react';
import { RootState } from '../../store';

interface RestrictedNoticeProps {
  onCheckAgain: () => Promise<void> | void;
}

const rs = (n: number) => `Rs. ${Number(n).toLocaleString('en-PK')}`;

export default function RestrictedNotice({ onCheckAgain }: RestrictedNoticeProps) {
  const dashboard = useSelector((state: RootState) => state.student.dashboard);
  const profile = useSelector((state: RootState) => state.student.profile);
  const [checking, setChecking] = useState(false);

  if (!dashboard?.isRestricted) return null;

  const fee = dashboard.feeRestriction;
  const whatsappUrl = dashboard.principalContact?.whatsappUrl || null;
  const studentRef = [profile.name, profile.studentId ? `Student ID ${profile.studentId}` : '']
    .filter(Boolean)
    .join(', ');
  const whatsappLink = whatsappUrl
    ? `${whatsappUrl}?text=${encodeURIComponent(`Assalam o Alaikum. I have paid my fee. ${studentRef}. Please restore my portal access.`)}`
    : null;

  const handleCheck = async () => {
    setChecking(true);
    try {
      await onCheckAgain();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="bg-error/10 border border-error/30 rounded-md p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-sm bg-error/15 text-error flex items-center justify-center shrink-0">
          <Lock className="w-5 h-5" />
        </div>
        <div>
          <div className="font-headings font-bold text-lg text-error">Portal Access Restricted</div>
          <div className="text-sm text-foreground">
            {dashboard.suspensionReason ||
              'Your portal access is temporarily restricted. Please contact the school administration.'}
          </div>
        </div>
      </div>

      {fee && fee.outstandingInvoices.length > 0 && (
        <div className="bg-card border border-border rounded-sm p-4 text-sm">
          <div className="font-semibold text-foreground mb-2">Outstanding fee</div>
          <ul className="space-y-1">
            {fee.outstandingInvoices.map((inv) => (
              <li key={inv.challanId} className="flex justify-between gap-4 text-xs">
                <span>
                  {inv.billingMonth}
                  {inv.dueDate ? ` · due ${inv.dueDate}` : ''}
                </span>
                <span className="font-mono">{rs(inv.outstanding)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between gap-4 mt-3 pt-2 border-t border-border font-semibold">
            <span>Amount due (latest invoice, incl. arrears)</span>
            <span className="font-mono text-error">{rs(fee.outstandingAmount)}</span>
          </div>
        </div>
      )}

      <div className="text-sm text-foreground">
        {dashboard.resolutionMessage ||
          'Please clear your pending fee and contact the Principal to restore access.'}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {whatsappLink ? (
          <a
            href={whatsappLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2.5 rounded-sm transition"
          >
            <MessageCircle className="w-4 h-4" />
            Contact Principal on WhatsApp
          </a>
        ) : (
          <span className="text-xs text-muted-foreground">
            Contact the Principal on the school's official WhatsApp number.
          </span>
        )}
        <button
          onClick={handleCheck}
          disabled={checking}
          className="inline-flex items-center gap-2 bg-card border border-border hover:bg-muted text-foreground text-sm font-semibold px-4 py-2.5 rounded-sm transition cursor-pointer disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
          Check access again
        </button>
      </div>

      <div className="text-xs text-muted-foreground">
        When messaging the Principal, include your name and student ID
        {profile.studentId ? ` (${profile.studentId})` : ''}. Access is restored as soon as the Principal allows it.
      </div>
    </div>
  );
}
