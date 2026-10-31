import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound } from 'lucide-react';
import { AppDispatch, RootState } from '../../store';
import { completeFirstPasswordSetup, logoutStudent } from '../../store/slices/studentSlice';
import { getTemporaryPassword } from '../../lib/firstLogin';

const MIN_LENGTH = 10;

// Shown after the first login with the temporary password from the welcome email.
// The portal stays locked (server-side too) until a personal password is set.
export default function SetPasswordModal() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const profile = useSelector((state: RootState) => state.student.profile);

  const rememberedTemp = getTemporaryPassword();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const current = rememberedTemp || currentPassword;

    if (!current) return setError('Enter the temporary password from your welcome email.');
    if (newPassword.length < MIN_LENGTH) return setError(`Your new password must be at least ${MIN_LENGTH} characters.`);
    if (newPassword !== confirmPassword) return setError('The two passwords do not match.');
    if (newPassword === current) return setError('Choose a password different from the temporary one.');

    setSaving(true);
    const result = await dispatch(
      completeFirstPasswordSetup({ username: profile.username || '', currentPassword: current, newPassword })
    );
    setSaving(false);

    if (completeFirstPasswordSetup.rejected.match(result)) {
      if (result.payload === 'RELOGIN_REQUIRED') {
        navigate('/login', { replace: true });
        return;
      }
      setError(String(result.payload || 'Could not set your password. Please try again.'));
    }
  };

  const handleSignOut = async () => {
    await dispatch(logoutStudent());
    navigate('/login', { replace: true });
  };

  const inputClass =
    'w-full bg-card border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary';

  return (
    <div className="fixed inset-0 z-[100] bg-navy/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="set-password-title"
        className="w-full max-w-sm bg-card border border-border rounded-md shadow-lg p-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 id="set-password-title" className="font-headings font-bold text-lg text-foreground">
              Set your password
            </h2>
            <p className="text-xs text-muted-foreground">
              Welcome{profile.name ? `, ${profile.name.split(' ')[0]}` : ''}! Please replace your temporary password
              before using the portal.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {!rememberedTemp && (
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Temporary password</label>
              <input
                type={showPw ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="From your welcome email"
                autoComplete="current-password"
                className={inputClass}
              />
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">New password</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={`At least ${MIN_LENGTH} characters`}
                autoComplete="new-password"
                autoFocus
                className={`${inputClass} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label={showPw ? 'Hide passwords' : 'Show passwords'}
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Confirm new password</label>
            <input
              type={showPw ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className={inputClass}
            />
          </div>

          {error && (
            <div className="text-xs text-error bg-error/10 border border-error/30 rounded-sm px-3 py-2">{error}</div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-primary hover:bg-primary-hover text-white text-sm font-semibold py-2.5 rounded-sm transition cursor-pointer disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save password & continue'}
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={saving}
            className="w-full text-xs text-muted-foreground hover:text-foreground py-1 cursor-pointer"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
