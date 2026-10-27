import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useParent } from './context/ParentContext';
import PortalLayout from './components/PortalLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Attendance from './pages/Attendance';
import Fees from './pages/Fees';
import Results from './pages/Results';
import Assignments from './pages/Assignments';
import Achievements from './pages/Achievements';
import Notices from './pages/Notices';
import Profile, { ChangePasswordForm } from './pages/Profile';

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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-card border border-border rounded-md p-6 shadow-sm">
          <h2 className="font-headings font-bold text-lg text-foreground mb-1">Set a new password</h2>
          <p className="text-xs text-muted-foreground mb-4">
            For your security, please replace the temporary password before continuing.
          </p>
          <ChangePasswordForm requireRelogin />
        </div>
      </div>
    );
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
