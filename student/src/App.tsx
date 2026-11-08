import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from './store';
import { fetchMe } from './store/slices/studentSlice';
import { BrandLoader } from './components/common/BrandLoader';

import Login from './pages/Login';
import PortalLayout from './components/layout/PortalLayout';
import SetPasswordModal from './components/dialogs/SetPasswordModal';
import Dashboard from './pages/Dashboard';
import Timetable from './pages/Timetable';
import LiveClasses from './pages/LiveClasses';
import LearningResources from './pages/LearningResources';
import DateSheet from './pages/DateSheet';
import Assignments from './pages/Assignments';
import MonthlyTests from './pages/MonthlyTests';
import ExamRoom from './pages/ExamRoom';
import Projects from './pages/Projects';
import Attendance from './pages/Attendance';
import ResultsProgress from './pages/ResultsProgress';
import Results from './pages/Results';
import Achievements from './pages/Achievements';
import Notifications from './pages/Notifications';
import MyProfile from './pages/MyProfile';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, mustChangePassword } = useSelector((state: RootState) => state.student);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // First login: the portal stays locked until the temporary password is replaced
  if (mustChangePassword) return <SetPasswordModal />;
  return <>{children}</>;
}

export default function App() {
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated } = useSelector((state: RootState) => state.student);
  const [bootChecking, setBootChecking] = useState(true);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (active) setBootChecking(false);
    }, 1500);

    dispatch(fetchMe())
      .unwrap()
      .catch(() => {})
      .finally(() => {
        if (active) setBootChecking(false);
      });

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [dispatch]);

  // Session verification on initial app boot & reload
  if (bootChecking) {
    return (
      <BrandLoader
        fullScreen
        message="Loading Student Portal..."
        subtext="Cambridge Education System"
        size="lg"
      />
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/student/dashboard" replace /> : <Login />}
      />
      <Route path="/" element={<Navigate to="/student/dashboard" replace />} />
      <Route
        path="/student/tests/:testId/room"
        element={
          <AuthGuard>
            <ExamRoom />
          </AuthGuard>
        }
      />
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
        <Route path="tests" element={<MonthlyTests />} />
        <Route path="datesheet" element={<DateSheet />} />
        <Route path="homework" element={<Assignments />} />
        <Route path="projects" element={<Projects />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="progress" element={<ResultsProgress />} />
        <Route path="results" element={<Results />} />
        <Route path="achievements" element={<Achievements />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="profile" element={<MyProfile />} />
      </Route>
      <Route path="*" element={<Navigate to="/student/dashboard" replace />} />
    </Routes>
  );
}
