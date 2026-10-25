import React, { useState, useEffect, useCallback } from 'react';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar, ActiveModule } from './components/common/Sidebar';
import { Header } from './components/common/Header';
import { api } from './services/api';
import { LoginPage } from './modules/auth/LoginPage';

// Modules
import { DashboardView } from './modules/dashboard/DashboardView';
import { TeachersView } from './modules/teachers/TeachersView';
import { StudentsView } from './modules/students/StudentsView';
import { ParentsView } from './modules/parents/ParentsView';
import { AcademicSetupView } from './modules/academics/AcademicSetupView';
import { TimetableModule } from './modules/timetable/TimetableModule';
import { ZoomLinksModule } from './modules/zoom/ZoomLinksModule';
import { AttendanceModule } from './modules/attendance/AttendanceModule';
import { FeeStructureModule } from './modules/fees/FeeStructureModule';
import { ChallansModule } from './modules/challans/ChallansModule';
import { PaymentVerificationModule } from './modules/payments/PaymentVerificationModule';
import { RestrictedStudentsModule } from './modules/restricted-students/RestrictedStudentsModule';
import { TeacherPayrollModule } from './modules/payroll/TeacherPayrollModule';
import { AcademicOversightModule } from './modules/academic-oversight/AcademicOversightModule';
import { NoticesModule } from './modules/notices/NoticesModule';
import { NotificationsModule } from './modules/notifications/NotificationsModule';
import { ReportsModule } from './modules/reports/ReportsModule';
import { AuditLogModule } from './modules/audit/AuditLogModule';
import { ProfileModule } from './modules/profile/ProfileModule';

function PrincipalPortalApp() {
  const { isAuthenticated, currentUser } = useAuth();
  const [activeModule, setActiveModule] = useState<ActiveModule>('dashboard');
  const [pendingCounts, setPendingCounts] = useState<{
    paymentProofs?: number;
    salaryDrafts?: number;
    attendanceCorrections?: number;
    zoomDegraded?: number;
    restrictedStudents?: number;
  }>({});

  const refreshBadges = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [proofs, drafts, corrections, zoomMeetings, restricted] = await Promise.all([
        api.getPaymentProofs().catch(() => []),
        api.getSalaryDrafts().catch(() => []),
        api.getAttendanceCorrections().catch(() => []),
        api.getZoomMeetings().catch(() => []),
        api.getRestrictedStudents().catch(() => [])
      ]);

      setPendingCounts({
        paymentProofs: proofs.filter((p) => p.status === 'Pending').length,
        salaryDrafts: drafts.filter((d) => d.status === 'Submitted for Approval').length,
        attendanceCorrections: corrections.filter((c) => c.status === 'Pending').length,
        zoomDegraded: zoomMeetings.filter(
          (m) => m.status === 'Requires Renewal' || m.healthCheckStatus === 'Degraded'
        ).length,
        restrictedStudents: restricted.length
      });
    } catch {
      // quiet fallback
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshBadges();
    }
  }, [activeModule, isAuthenticated, refreshBadges]);

  // STRICT ROUTE & PORTAL PROTECTION:
  // If not logged in, absolutely no portal route or module can be accessed.
  if (!isAuthenticated || !currentUser) {
    return <LoginPage onLoginSuccess={() => setActiveModule('dashboard')} />;
  }

  const renderModuleContent = () => {
    switch (activeModule) {
      case 'dashboard':
        return <DashboardView onNavigate={setActiveModule} />;
      case 'teachers':
        return <TeachersView />;
      case 'students':
        return <StudentsView />;
      case 'parents':
        return <ParentsView />;
      case 'academics':
        return <AcademicSetupView />;
      case 'timetable':
        return <TimetableModule />;
      case 'zoom':
        return <ZoomLinksModule />;
      case 'attendance':
        return <AttendanceModule />;
      case 'fees':
        return <FeeStructureModule />;
      case 'challans':
        return <ChallansModule />;
      case 'payments':
        return <PaymentVerificationModule />;
      case 'restricted-students':
        return <RestrictedStudentsModule />;
      case 'payroll':
        return <TeacherPayrollModule />;
      case 'academic-oversight':
        return <AcademicOversightModule />;
      case 'notices':
        return <NoticesModule />;
      case 'notifications':
        return <NotificationsModule onNavigate={setActiveModule} />;
      case 'reports':
        return <ReportsModule />;
      case 'audit':
        return <AuditLogModule />;
      case 'profile':
        return <ProfileModule />;
      default:
        return <DashboardView onNavigate={setActiveModule} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans antialiased overflow-hidden">
      {/* Grouped Sidebar Navigation */}
      <Sidebar
        activeModule={activeModule}
        onSelectModule={setActiveModule}
        pendingCounts={pendingCounts}
      />

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        <Header
          activeModule={activeModule}
          onSelectModule={setActiveModule}
          onDataReset={() => {
            refreshBadges();
            setActiveModule('dashboard');
          }}
        />

        {/* Scrollable Content Container */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {renderModuleContent()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <PrincipalPortalApp />
      </AuthProvider>
    </ToastProvider>
  );
}
