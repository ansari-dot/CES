import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useParent } from '../context/ParentContext';
import { requestApi } from '../services/api';
import { StatusChip } from '../components/common';

/** Changes the password. The server ends the session afterwards, so the user signs in again. */
export function ChangePasswordForm({ requireRelogin = false }: { requireRelogin?: boolean }) {
  const { logout, showToast } = useParent();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 10) {
      setError('The new password must be at least 10 characters long.');
      return;
    }
    if (newPassword !== confirm) {
      setError('The new passwords do not match.');
      return;
    }
    setSaving(true);
    try {
      await requestApi('/api/v1/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      showToast('Password updated. Please sign in with your new password.');
      await logout();
      navigate('/login', { replace: true });
    } catch (err: any) {
      setError(err.message || 'Could not change your password');
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full bg-card border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary';

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-xs font-semibold text-muted-foreground block mb-1">
          {requireRelogin ? 'Temporary password' : 'Current password'}
        </label>
        <input type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputCls} autoComplete="current-password" />
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground block mb-1">New password</label>
        <input type="password" required minLength={10} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={inputCls} autoComplete="new-password" />
      </div>
      <div>
        <label className="text-xs font-semibold text-muted-foreground block mb-1">Confirm new password</label>
        <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} autoComplete="new-password" />
      </div>
      {error && <div className="text-xs text-error font-semibold bg-error/10 border border-error/20 rounded-sm px-3 py-2">{error}</div>}
      <button
        type="submit"
        disabled={saving}
        className="w-full bg-primary hover:bg-primary-hover text-white py-2.5 text-sm font-bold rounded-sm transition disabled:opacity-60 cursor-pointer"
      >
        {saving ? 'Saving…' : 'Update Password'}
      </button>
    </form>
  );
}

export default function Profile() {
  const { user, dashboard } = useParent();
  const parent = dashboard?.parent;

  const rows: [string, React.ReactNode][] = [
    ['Name', user?.fullName || '—'],
    ['Username', user?.username || '—'],
    ['Email', user?.email || '—'],
    ['Phone', user?.phone || '—'],
    ['Relation', parent?.relation ? parent.relation.charAt(0) + parent.relation.slice(1).toLowerCase() : '—'],
    [
      'Verification',
      parent ? (
        <StatusChip status={parent.verificationStatus === 'APPROVED' ? 'Verified' : parent.verificationStatus === 'REJECTED' ? 'Rejected' : 'Pending'} />
      ) : (
        '—'
      ),
    ],
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="bg-card border border-border rounded-md p-5 shadow-sm">
        <div className="font-headings font-bold text-base text-foreground mb-3">Account details</div>
        <dl className="divide-y divide-border">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between py-2.5 text-sm">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium text-foreground text-right">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="font-headings font-bold text-sm text-foreground mt-5 mb-2">Linked children</div>
        {dashboard && dashboard.children.length > 0 ? (
          <ul className="space-y-2">
            {dashboard.children.map((c) => (
              <li key={c.studentId} className="flex items-center justify-between bg-muted/50 rounded-sm px-3 py-2 text-sm">
                <span className="font-medium text-foreground">{c.studentName}</span>
                <span className="text-xs text-muted-foreground">
                  {c.className} · {c.admissionNo}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No children are linked to this account yet.</p>
        )}
        <p className="text-[11px] text-muted-foreground mt-3">
          To update your contact details or linked children, please contact the school office.
        </p>
      </div>

      <div className="bg-card border border-border rounded-md p-5 shadow-sm">
        <div className="font-headings font-bold text-base text-foreground mb-3">Change password</div>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
