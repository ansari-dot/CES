import React, { useEffect } from 'react';
import { useAppSelector, useAppDispatch } from './store';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { ToastContainer } from './components/common/Toast';
import { SetPasswordModal } from './components/common/SetPasswordModal';
import { BrandLoader } from './components/common/BrandLoader';
import { DashboardPage } from './pages/DashboardPage';
import { TimetablePage } from './pages/TimetablePage';
import { LiveLessonsPage } from './pages/LiveLessonsPage';
import { AttendancePage } from './pages/AttendancePage';
import { MonthlyTestsPage } from './pages/MonthlyTestsPage';
import { TeacherDateSheetPage } from './pages/TeacherDateSheetPage';
import { TeacherExamAnnouncementPopup } from './components/dialogs/TeacherExamAnnouncementPopup';
import { TasksAssignmentsPage } from './pages/TasksAssignmentsPage';
import { SubmissionsGradingPage } from './pages/SubmissionsGradingPage';
import { StudentProjectsPage } from './pages/StudentProjectsPage';
import { LearningResourcesPage } from './pages/LearningResourcesPage';
import { StudentPerformancePage } from './pages/StudentPerformancePage';
import { ExamResultsPage } from './pages/ExamResultsPage';
import { AchievementsFeedbackPage } from './pages/AchievementsFeedbackPage';
import { NoticesPage } from './pages/NoticesPage';
import { DutySalaryPage } from './pages/DutySalaryPage';
import { ProfileSettingsPage } from './pages/ProfileSettingsPage';

// Import Live Backend Async Thunks
import { checkTeacherSessionThunk } from './store/slices/authSlice';
import { fetchTeacherLessonsThunk, detectTeacherTimezoneThunk } from './store/slices/timetableSlice';
import { fetchSchoolTimetable } from './store/slices/schoolTimetableSlice';
import { fetchTasksThunk, fetchSubmissionsThunk } from './store/slices/tasksSlice';
import { fetchResourcesThunk } from './store/slices/resourcesSlice';
import { fetchNoticesThunk } from './store/slices/noticesSlice';
import { fetchPerformanceDataThunk } from './store/slices/performanceSlice';
import { fetchLessonRosterThunk, fetchCorrectionVouchersThunk } from './store/slices/attendanceSlice';
import { fetchDutySummaryThunk } from './store/slices/dutySlice';
import { fetchTeacherNotificationsThunk } from './store/slices/uiSlice';
import { useLessonReminderTicker } from './hooks/useLessonReminderTicker';
import { useTeacherRealtime } from './hooks/useTeacherRealtime';

export default function App() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const teacher = useAppSelector((state) => state.auth.teacher);
  const currentTab = useAppSelector((state) => state.ui.currentTab);
  const mustChangePassword = useAppSelector((state) => state.auth.mustChangePassword);
  const isCheckingAuth = useAppSelector((state) => state.auth.isCheckingAuth);

  // Active 5-minute pre-lesson notification reminder ticker
  useLessonReminderTicker();

  // Active Real-Time WebSocket Listener for live links, class updates, notices & schedule changes
  useTeacherRealtime();

  // 1. Session verification & regional timezone detection on app startup
  useEffect(() => {
    dispatch(checkTeacherSessionThunk());
    dispatch(detectTeacherTimezoneThunk());
  }, [dispatch]);

  // 2. Hydrate all live academic data when authenticated
  useEffect(() => {
    if (isAuthenticated && !mustChangePassword) {
      dispatch(detectTeacherTimezoneThunk());
      dispatch(fetchTeacherLessonsThunk());
      dispatch(fetchSchoolTimetable());
      dispatch(fetchTasksThunk());
      dispatch(fetchSubmissionsThunk());
      dispatch(fetchResourcesThunk());
      dispatch(fetchNoticesThunk());
      dispatch(fetchTeacherNotificationsThunk());
      dispatch(fetchPerformanceDataThunk());
      dispatch(fetchCorrectionVouchersThunk());
      dispatch(fetchLessonRosterThunk(1));
      dispatch(fetchDutySummaryThunk(teacher?.id || 45));
    }
  }, [isAuthenticated, mustChangePassword, dispatch, teacher?.id]);

  // Session Verification Spinner on Initial App Boot
  if (isCheckingAuth) {
    return (
      <div className="relative min-h-screen bg-slate-50">
        <BrandLoader fullScreen message="Loading Faculty Workspace..." subtext="Cambridge Education System" size="lg" />
      </div>
    );
  }

  // Authentication Route Guard: Protect all routes and views
  if (!isAuthenticated) {
    return (
      <div className="relative min-h-screen bg-[#f9f9fc]">
        <LoginPage />
        <ToastContainer />
      </div>
    );
  }

  // First login: the portal stays locked until the temporary password is replaced
  if (mustChangePassword) {
    return (
      <div className="relative min-h-screen bg-[#f9f9fc]">
        <SetPasswordModal />
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
      case 'monthly-tests':
        return <MonthlyTestsPage />;
      case 'datesheet':
        return <TeacherDateSheetPage />;
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
      case 'exam-results':
        return <ExamResultsPage />;
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

  return (
    <>
      <AppLayout>{renderActivePage()}</AppLayout>
      <TeacherExamAnnouncementPopup />
    </>
  );
}
