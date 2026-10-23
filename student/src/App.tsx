import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from './store';
import { fetchMe } from './store/slices/studentSlice';

import Login from './pages/Login';
import PortalLayout from './components/layout/PortalLayout';
import SetPasswordModal from './components/dialogs/SetPasswordModal';
import Dashboard from './pages/Dashboard';
import Timetable from './pages/Timetable';
import LiveClasses from './pages/LiveClasses';
import LearningResources from './pages/LearningResources';
import Assignments from './pages/Assignments';
import Projects from './pages/Projects';
import Attendance from './pages/Attendance';
import ResultsProgress from './pages/ResultsProgress';
import Achievements from './pages/Achievements';
import FeesChallans from './pages/FeesChallans';
import Notifications from './pages/Notifications';
import MyProfile from './pages/MyProfile';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { isAuthenticated, authLoading, mustChangePassword } = useSelector((state: RootState) => state.student);

  useEffect(() => {
    // On first load, try to restore session from existing cookie
    if (!isAuthenticated) {
      dispatch(fetchMe()).unwrap().catch(() => {
        navigate('/login', { replace: true });
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isAuthenticated && authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // First login: the portal stays locked until the temporary password is replaced
  if (mustChangePassword) return <SetPasswordModal />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/student/dashboard" replace />} />
      <Route
        path="/student"
        element={
          <AuthGuard>
            <PortalLayout />
          </AuthGuard>
        }
      >
        <Route index element={<Navigate to="/student/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="timetable" element={<Timetable />} />
        <Route path="classes" element={<LiveClasses />} />
        <Route path="learning" element={<LearningResources />} />
        <Route path="homework" element={<Assignments />} />
        <Route path="projects" element={<Projects />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="progress" element={<ResultsProgress />} />
        <Route path="achievements" element={<Achievements />} />
        <Route path="fees" element={<FeesChallans />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<MyProfile />} />
      </Route>
      <Route path="*" element={<Navigate to="/student/dashboard" replace />} />
    </Routes>
  );
}
