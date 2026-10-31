import React from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { logout } from '../../store/slices/authSlice';
import { setCurrentTab, closeMobileSidebar, addToast } from '../../store/slices/uiSlice';
import { NavTab } from '../../types';

interface NavItem {
  id: NavTab;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'timetable', label: 'Timetable', icon: 'calendar_today' },
  { id: 'live-lessons', label: 'Live Lessons & Zoom', icon: 'videocam' },
  { id: 'student-attendance', label: 'Student Attendance', icon: 'fact_check' },
  { id: 'learning-resources', label: 'Learning Resources', icon: 'menu_book' },
  { id: 'tasks-assignments', label: 'Tasks & Assignments', icon: 'assignment' },
  { id: 'submissions-grading', label: 'Submissions & Grading', icon: 'rule' },
  { id: 'student-projects', label: 'Student Projects', icon: 'folder_shared' },
  { id: 'student-performance', label: 'Student Performance', icon: 'school' },
  { id: 'exam-results', label: 'Exam Results', icon: 'fact_check' },
  { id: 'achievements-feedback', label: 'Achievements & Feedback', icon: 'emoji_events' },
  { id: 'notices', label: 'Notices', icon: 'campaign' },
  { id: 'duty-salary', label: 'Duty & Salary', icon: 'schedule' },
  { id: 'profile-settings', label: 'Profile & Settings', icon: 'settings' },
];

export const Sidebar: React.FC = () => {
  const dispatch = useAppDispatch();
  const currentTab = useAppSelector((state) => state.ui.currentTab);
  const isMobileSidebarOpen = useAppSelector((state) => state.ui.isMobileSidebarOpen);
  const teacher = useAppSelector((state) => state.auth.teacher);
  const submissions = useAppSelector((state) => state.tasks.submissions);
  const isAttendanceLocked = useAppSelector((state) => state.attendance.isLocked);
  const hasLiveClass = useAppSelector((state) => state.timetable.lessons.some((l) => l.status === 'live'));

  const pendingGradingCount = submissions.filter((s) => s.status === 'pending' || s.status === 'late').length;

  const getBadgeCount = (tabId: NavTab) => {
    if (tabId === 'submissions-grading') return pendingGradingCount;
    if (tabId === 'student-attendance' && !isAttendanceLocked) return 1;
    return 0;
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => dispatch(closeMobileSidebar())}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-[#36348e] z-50 flex flex-col shadow-lg lg:shadow-[0_1px_8px_rgba(0,0,0,0.04)] transition-transform duration-200 ease-in-out ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="px-4 pt-6 pb-5 flex items-start justify-between border-b border-white/15">
          <div className="flex-1 flex flex-col items-center gap-2.5">
            <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-md overflow-hidden">
              <img src="/logo.jpeg" alt="Cambridge Education System logo" className="w-full h-full object-contain" />
            </div>
            <div className="flex flex-col overflow-hidden text-center">
              <span className="text-[17px] font-bold tracking-tight text-white truncate">
                EduPulse
              </span>
              <span className="text-[11px] font-semibold text-white/70 uppercase tracking-wider truncate">
                Teacher Portal
              </span>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            onClick={() => dispatch(closeMobileSidebar())}
            className="p-1 rounded-lg text-white/70 hover:text-white lg:hidden"
            title="Close Menu"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Term & Timezone Subheader */}
        <div className="px-4 py-1.5 bg-white/10 flex items-center justify-between border-b border-white/10">
          <span className="text-[11px] font-semibold text-white/80">{teacher.term}</span>
          <span className="text-[11px] font-semibold text-white/80">{teacher.timezone}</span>
        </div>

        {/* Navigation Item List */}
        <nav className="sidebar-scroll flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            const badge = getBadgeCount(item.id);
            return (
              <button
                key={item.id}
                onClick={() => {
                  dispatch(setCurrentTab(item.id));
                  dispatch(closeMobileSidebar());
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors font-medium text-xs sm:text-sm ${
                  isActive
                    ? 'bg-[#ffc53a] text-[#1b1a47] font-semibold shadow-xs'
                    : 'text-white/85 hover:bg-[#ffc53a] hover:text-[#1b1a47]'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span
                    className={`material-symbols-outlined text-[19px] ${
                      isActive ? 'text-[#1b1a47]' : 'text-inherit'
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </div>
                {badge > 0 && !isActive && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#ffe9b0] text-[#8a6400]">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Duty Indicator */}
        <div className="p-3 border-t border-white/15 bg-white/5 space-y-2">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-white/80 font-medium">Zoom S2S Duty:</span>
            <span
              className={`font-semibold flex items-center gap-1 ${
                hasLiveClass ? 'text-emerald-300' : 'text-white/80'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  hasLiveClass ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-400'
                }`}
              ></span>
              {hasLiveClass ? 'In Session' : 'Auto-Ready'}
            </span>
          </div>
          <p className="text-[11px] text-white/60 truncate">Faculty ID: {teacher.employeeId}</p>

          {/* Quick Sign Out */}
          <button
            onClick={() => {
              dispatch(logout());
              dispatch(closeMobileSidebar());
              dispatch(
                addToast({
                  title: 'Logged Out',
                  message: 'Workstation session ended safely.',
                  type: 'info',
                })
              );
            }}
            className="w-full mt-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold text-white/80 hover:bg-[#ffc53a] hover:text-[#1b1a47] border border-transparent transition-colors"
          >
            <span className="material-symbols-outlined text-[17px]">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
