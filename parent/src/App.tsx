import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useParent } from './context/ParentContext';
import { requestApi } from './services/api';
import PortalLayout from './components/PortalLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Attendance from './pages/Attendance';
import Fees from './pages/Fees';
import Results from './pages/Results';
import Assignments from './pages/Assignments';
import Achievements from './pages/Achievements';
import Notices from './pages/Notices';
import Profile from './pages/Profile';

const MIN_PASSWORD_LENGTH = 10;

function FirstLoginModal() {
  const { user, logout, showToast, login } = useParent();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const inputCls = 'w-full bg-background border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirm) { setError('Passwords do not match.'); return; }
    setSaving(true);
    try {
      // The temporary password was just used to sign in, so only the new one is sent
      await requestApi('/api/v1/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      });
    } catch (err: any) {
      setError(err.message || 'Could not set password. Please try again.');
      setSaving(false);
      return;
    }

    // Changing the password ends the session; sign straight back in with the new one
    try {
      await login(user?.username || user?.email || '', newPassword);
      showToast('Password set successfully. Welcome!');
    } catch {
      showToast('Password set. Please sign in with your new password.');
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-xl shadow-xl p-6 space-y-4">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="font-headings font-bold text-lg text-foreground">Set Your Password</h2>
          <p className="text-xs text-muted-foreground mt-1">You are logged in with a temporary password. Please set a new password to continue.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">New Password</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={`Min. ${MIN_PASSWORD_LENGTH} characters`}
              className={inputCls}
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Confirm Password</label>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Re-enter new password"
              className={inputCls}
            />
          </div>
          {error && (
            <div className="text-xs text-error font-semibold bg-error/10 border border-error/20 rounded-sm px-3 py-2">{error}</div>
          )}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-primary hover:bg-primary-hover text-white py-2.5 text-sm font-bold rounded-sm transition disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Change Password'}
          </button>
        </form>

        <button
          onClick={logout}
          className="w-full text-xs text-muted-foreground hover:text-error transition text-center"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, restoreSession } = useParent();
  const [checked, setChecked] = useState(Boolean(user));

  useEffect(() => {
    if (!user) restoreSession().finally(() => setChecked(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!checked && !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // First login: the portal stays locked until the temporary password is replaced
  if (user.mustChangePassword) {
    return <FirstLoginModal />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/parent/dashboard" replace />} />
      <Route
        path="/parent"
        element={
          <AuthGuard>
            <PortalLayout />
          </AuthGuard>
        }
      >
        <Route index element={<Navigate to="/parent/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="fees" element={<Fees />} />
        <Route path="results" element={<Results />} />
        <Route path="assignments" element={<Assignments />} />
        <Route path="achievements" element={<Achievements />} />
        <Route path="notices" element={<Notices />} />
        <Route path="profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/parent/dashboard" replace />} />
    </Routes>
  );
}
