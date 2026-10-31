import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  completeFirstPasswordSetupThunk,
  getTemporaryPassword,
  logoutTeacherThunk
} from '../../store/slices/authSlice';
import { addToast } from '../../store/slices/uiSlice';

const MIN_LENGTH = 10;

// Shown after the first login with the temporary password from the welcome email.
// The portal stays locked (server-side too) until a personal password is set.
export const SetPasswordModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const username = useAppSelector((state) => state.auth.username);
  const teacherName = useAppSelector((state) => state.auth.teacher.name);

  const rememberedTemp = getTemporaryPassword();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      completeFirstPasswordSetupThunk({ username, currentPassword: current, newPassword })
    );
    setSaving(false);

    if (completeFirstPasswordSetupThunk.fulfilled.match(result)) {
      dispatch(addToast({ title: 'Password set', message: 'Your new password is saved.', type: 'success' }));
    } else if (result.payload !== 'RELOGIN_REQUIRED') {
      setError(String(result.payload || 'Could not set your password. Please try again.'));
    }
  };

  const inputClass =
    'w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#36348e] focus:border-transparent transition-all';

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="set-password-title"
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-[#cdd4fb] text-[#36348e] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">key</span>
          </div>
          <div>
            <h2 id="set-password-title" className="text-lg font-bold text-slate-900">
              Set your password
            </h2>
            <p className="text-xs text-slate-500">
              Welcome{teacherName ? `, ${teacherName}` : ''}! Replace your temporary password to continue.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {!rememberedTemp && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Temporary password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="From your welcome email"
                autoComplete="current-password"
                className={inputClass}
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">New password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={`At least ${MIN_LENGTH} characters`}
                autoComplete="new-password"
                autoFocus
                className={`${inputClass} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                aria-label={showPassword ? 'Hide passwords' : 'Show passwords'}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm new password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className={inputClass}
            />
          </div>

          {error && (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#36348e] hover:bg-[#ffc53a] hover:text-[#1b1a47] disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
          >
            {saving ? 'Saving…' : 'Save password & continue'}
          </button>
          <button
            type="button"
            onClick={() => dispatch(logoutTeacherThunk())}
            disabled={saving}
            className="w-full text-xs text-slate-500 hover:text-slate-800 py-1"
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
};
