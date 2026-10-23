import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import Sidebar from './Sidebar';
import TopHeader from './TopHeader';
import Toast from '../common/Toast';
import { AppDispatch, RootState } from '../../store';
import { logoutStudent, fetchDashboard } from '../../store/slices/studentSlice';
import { fetchTimetable, fetchStudentZoomSession } from '../../store/slices/classesSlice';
import { fetchTasks } from '../../store/slices/assignmentsSlice';
import { fetchResources } from '../../store/slices/resourcesSlice';
import { fetchChallans } from '../../store/slices/feesSlice';
import { fetchAttendanceStats } from '../../store/slices/attendanceSlice';
import { fetchNotifications } from '../../store/slices/notificationsSlice';
import RestrictedNotice from '../common/RestrictedNotice';
import { useTimezone } from '../../hooks/useTimezone';
import { zoneAbbreviation } from '../../lib/timezone';

export default function PortalLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { profile, dashboard } = useSelector((state: RootState) => state.student);
  const timezone = useSelector((state: RootState) => state.classes.timezone);
  const timezoneSource = useSelector((state: RootState) => state.classes.timezoneSource);

  // Detect student timezone via IP geolocation and keep timetable in sync
  useTimezone();

  const loadPortalData = useCallback(() => {
    dispatch(fetchTimetable());
    dispatch(fetchStudentZoomSession());
    dispatch(fetchTasks());
    dispatch(fetchResources());
    dispatch(fetchChallans());
    dispatch(fetchAttendanceStats());
    dispatch(fetchNotifications());
  }, [dispatch]);

  // Load the dashboard first: a fee-restricted student only gets the
  // restriction notice (other endpoints are blocked by the server).
  const loadDashboardThenData = useCallback(async () => {
    const result = await dispatch(fetchDashboard());
    if (fetchDashboard.fulfilled.match(result) && !result.payload?.isRestricted) {
      loadPortalData();
    }
  }, [dispatch, loadPortalData]);

  useEffect(() => {
    loadDashboardThenData();
  }, [loadDashboardThenData]);

  const isRestricted = Boolean(dashboard?.isRestricted);
  const showRestriction = isRestricted && location.pathname !== '/student/profile';

  const handleLogout = async () => {
    await dispatch(logoutStudent());
    navigate('/login', { replace: true });
  };

  const getPageInfo = () => {
    const firstName = profile.name.split(' ')[0] || 'Student';
    switch (location.pathname) {
      case '/student/dashboard':
        return { title: `Good morning, ${firstName}!`, subtitle: "Here's your learning overview for today" };
      case '/student/timetable':
        return { title: 'My Timetable', subtitle: `${profile.session} · ${profile.grade} · Times shown in ${timezone} (${zoneAbbreviation(timezone)})${timezoneSource === 'ip' ? ' · detected from your location' : ''}` };
      case '/student/classes':
        return { title: 'Live Classes', subtitle: `Join with your ${profile.grade} class Zoom link` };
      case '/student/learning':
        return { title: 'Learning Resources', subtitle: `Published for ${profile.grade}` };
      case '/student/homework':
        return { title: 'Assignments', subtitle: `${profile.grade} · Sorted by deadline` };
      case '/student/projects':
        return { title: 'Projects', subtitle: `Milestone-based class projects · ${profile.grade}` };
      case '/student/attendance':
        return { title: 'Attendance', subtitle: `${profile.session} · Recorded by teachers` };
      case '/student/progress':
        return { title: 'Results & Progress', subtitle: `${profile.session} · Only published results shown` };
      case '/student/achievements':
        return { title: 'Achievements', subtitle: 'Earned by you · awarded by teachers' };
      case '/student/fees':
        return { title: 'Fees & Challans', subtitle: 'Amounts in Pakistani rupees (Rs.)' };
      case '/student/notifications':
        return { title: 'Notifications', subtitle: 'Newest first' };
      case '/student/profile':
        return { title: 'My Profile', subtitle: 'View identity · manage password & alerts' };
      default:
        return { title: 'Student Portal', subtitle: 'Cambridge Education System' };
    }
  };

  const { title, subtitle } = getPageInfo();

  return (
    <div className="flex bg-background min-h-screen w-full">
      {/* Desktop Sidebar */}
      <div className="hidden md:block h-screen sticky top-0">
        <Sidebar onLogout={handleLogout} />
      </div>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-navy/60 backdrop-blur-xs"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative z-10 h-full">
            <Sidebar mobileClose={() => setMobileNavOpen(false)} onLogout={handleLogout} />
          </div>
        </div>
      )}

      {/* Main Panel */}
      <div className="flex-1 min-w-0 flex flex-col">
        <TopHeader
          pageTitle={title}
          pageSubtitle={subtitle}
          onToggleMobileNav={() => setMobileNavOpen(true)}
        />
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1080px] w-full mx-auto flex flex-col gap-6">
          {showRestriction ? <RestrictedNotice onCheckAgain={loadDashboardThenData} /> : <Outlet />}
        </main>
      </div>

      <Toast />
    </div>
  );
}
