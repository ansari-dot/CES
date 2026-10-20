import React, { useEffect } from 'react';
import { useAppSelector, useAppDispatch } from './store';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { ToastContainer } from './components/common/Toast';
import { DashboardPage } from './pages/DashboardPage';
import { TimetablePage } from './pages/TimetablePage';
import { LiveLessonsPage } from './pages/LiveLessonsPage';
import { AttendancePage } from './pages/AttendancePage';
import { TasksAssignmentsPage } from './pages/TasksAssignmentsPage';
import { SubmissionsGradingPage } from './pages/SubmissionsGradingPage';
import { StudentProjectsPage } from './pages/StudentProjectsPage';
import { LearningResourcesPage } from './pages/LearningResourcesPage';
import { StudentPerformancePage } from './pages/StudentPerformancePage';
import { AchievementsFeedbackPage } from './pages/AchievementsFeedbackPage';
import { NoticesPage } from './pages/NoticesPage';
import { DutySalaryPage } from './pages/DutySalaryPage';
import { ProfileSettingsPage } from './pages/ProfileSettingsPage';

// Import Live Backend Async Thunks
import { checkTeacherSessionThunk } from './store/slices/authSlice';
import { fetchTeacherLessonsThunk } from './store/slices/timetableSlice';
import { fetchSchoolTimetable } from './store/slices/schoolTimetableSlice';
import { fetchTasksThunk, fetchSubmissionsThunk } from './store/slices/tasksSlice';
import { fetchResourcesThunk } from './store/slices/resourcesSlice';
import { fetchNoticesThunk } from './store/slices/noticesSlice';
import { fetchPerformanceDataThunk } from './store/slices/performanceSlice';
import { fetchLessonRosterThunk, fetchCorrectionVouchersThunk } from './store/slices/attendanceSlice';
import { fetchDutySummaryThunk } from './store/slices/dutySlice';

export default function App() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const teacher = useAppSelector((state) => state.auth.teacher);
  const currentTab = useAppSelector((state) => state.ui.currentTab);

  // 1. Session verification on app startup
  useEffect(() => {
    dispatch(checkTeacherSessionThunk());
  }, [dispatch]);

  // 2. Hydrate all live academic data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchTeacherLessonsThunk());
      dispatch(fetchSchoolTimetable());
      dispatch(fetchTasksThunk());
      dispatch(fetchSubmissionsThunk());
      dispatch(fetchResourcesThunk());
      dispatch(fetchNoticesThunk());
      dispatch(fetchPerformanceDataThunk());
      dispatch(fetchCorrectionVouchersThunk());
      dispatch(fetchLessonRosterThunk(1));
      dispatch(fetchDutySummaryThunk(teacher?.id || 45));
    }
  }, [isAuthenticated, dispatch, teacher?.id]);

  // Authentication Route Guard: Protect all routes and views
  if (!isAuthenticated) {
    return (
      <div className="relative min-h-screen bg-[#f8faff]">
        <LoginPage />
        <ToastContainer />
      </div>
    );
  }

  const renderActivePage = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardPage />;
      case 'timetable':
        return <TimetablePage />;
      case 'live-lessons':
        return <LiveLessonsPage />;
      case 'student-attendance':
        return <AttendancePage />;
      case 'learning-resources':
        return <LearningResourcesPage />;
      case 'tasks-assignments':
        return <TasksAssignmentsPage />;
      case 'submissions-grading':
        return <SubmissionsGradingPage />;
      case 'student-projects':
        return <StudentProjectsPage />;
      case 'student-performance':
        return <StudentPerformancePage />;
      case 'achievements-feedback':
        return <AchievementsFeedbackPage />;
      case 'notices':
        return <NoticesPage />;
      case 'duty-salary':
        return <DutySalaryPage />;
      case 'profile-settings':
        return <ProfileSettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return <AppLayout>{renderActivePage()}</AppLayout>;
}
