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
        className={`fixed left-0 top-0 h-full w-64 bg-white z-50 flex flex-col shadow-lg lg:shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-r border-slate-200 transition-transform duration-200 ease-in-out ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between bg-white border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#3525cd] to-[#4f46e5] flex items-center justify-center text-white shadow-xs font-bold text-lg">
              <span className="material-symbols-outlined text-[22px]">school</span>
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-[17px] font-bold tracking-tight text-[#121c2a] truncate">
                EduPulse
              </span>
              <span className="text-[11px] font-semibold text-[#464555] uppercase tracking-wider truncate">
                Teacher Portal
              </span>
            </div>
          </div>

          {/* Close button on mobile */}
          <button
            onClick={() => dispatch(closeMobileSidebar())}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 lg:hidden"
            title="Close Menu"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Term & Timezone Subheader */}
        <div className="px-4 py-1.5 bg-[#eff4ff] flex items-center justify-between border-b border-slate-100">
          <span className="text-[11px] font-semibold text-[#464555]">{teacher.term}</span>
          <span className="text-[11px] font-semibold text-[#464555]">{teacher.timezone}</span>
        </div>

        {/* Navigation Item List */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
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
                    ? 'bg-[#4f46e5] text-white font-semibold shadow-xs'
                    : 'text-[#464555] hover:bg-[#dee9fc] hover:text-[#121c2a]'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <span
                    className={`material-symbols-outlined text-[19px] ${
                      isActive ? 'text-white' : 'text-[#464555]'
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </div>
                {badge > 0 && !isActive && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-[#ffddb8] text-[#92400e]">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Duty Indicator */}
        <div className="p-3 border-t border-slate-200 bg-[#f8f9ff] space-y-2">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-[#464555] font-medium">Zoom S2S Duty:</span>
            <span
              className={`font-semibold flex items-center gap-1 ${
                hasLiveClass ? 'text-[#006c49]' : 'text-slate-600'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  hasLiveClass ? 'bg-[#006c49] animate-pulse' : 'bg-emerald-500'
                }`}
              ></span>
              {hasLiveClass ? 'In Session' : 'Auto-Ready'}
            </span>
          </div>
          <p className="text-[11px] text-[#777587] truncate">Faculty ID: {teacher.employeeId}</p>

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
            className="w-full mt-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
          >
            <span className="material-symbols-outlined text-[17px]">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
