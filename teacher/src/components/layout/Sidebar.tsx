import React from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { logout } from '../../store/slices/authSlice';
import { setCurrentTab, closeMobileSidebar, addToast } from '../../store/slices/uiSlice';
import { NavTab } from '../../types';
import {
  LayoutDashboard,
  Calendar,
  Video,
  UserCheck,
  ClipboardList,
  FileCheck,
  BookOpen,
  Award,
  Bell,
  Clock,
  Settings,
  LogOut,
  X
} from 'lucide-react';

interface NavItem {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'ACADEMICS',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'timetable', label: 'Timetable & Schedule', icon: Calendar },
      { id: 'live-lessons', label: 'Live Classrooms (Zoom)', icon: Video },
      { id: 'student-attendance', label: 'Student Attendance', icon: UserCheck },
    ]
  },
  {
    title: 'TEACHING & WORK',
    items: [
      { id: 'tasks-assignments', label: 'Tasks & Homework', icon: ClipboardList },
      { id: 'submissions-grading', label: 'Grading & Submissions', icon: FileCheck },
      { id: 'learning-resources', label: 'Learning Materials', icon: BookOpen },
      { id: 'exam-results', label: 'Exam Results & Marks', icon: Award },
    ]
  },
  {
    title: 'CAMPUS & ACCOUNT',
    items: [
      { id: 'notices', label: 'School Notices', icon: Bell },
      { id: 'duty-salary', label: 'Teaching Duty & Payroll', icon: Clock },
      { id: 'profile-settings', label: 'Profile & Settings', icon: Settings },
    ]
  }
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
        className={`fixed left-0 top-0 h-full w-64 bg-[#232168] z-50 flex flex-col shadow-xl lg:shadow-md transition-transform duration-200 ease-in-out ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div className="px-4 py-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 shrink-0 flex items-center justify-center">
              <img src="/logowb.png" alt="Cambridge Education System Logo" className="w-full h-full object-contain drop-shadow-sm" />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-bold text-white tracking-tight leading-tight">
                Cambridge
              </span>
              <span className="text-[10px] font-semibold text-amber-300 uppercase tracking-wider">
                Teacher Workstation
              </span>
            </div>
          </div>

          <button
            onClick={() => dispatch(closeMobileSidebar())}
            className="p-1 rounded-lg text-white/70 hover:text-white lg:hidden"
            title="Close Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Term & Faculty Bar */}
        <div className="px-4 py-2 bg-black/15 flex items-center justify-between border-b border-white/10 text-[11px] text-white/80">
          <span className="font-medium truncate">{teacher.term || 'Term 2'}</span>
          <span className="font-semibold text-amber-300">{teacher.timezone || 'Asia/Karachi'}</span>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <div className="px-2 pb-1 text-[10px] font-bold tracking-wider text-white/40 uppercase">
                {section.title}
              </div>
              {section.items.map((item) => {
                const IconComponent = item.icon;
                const isActive = currentTab === item.id;
                const badge = getBadgeCount(item.id);

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      dispatch(setCurrentTab(item.id));
                      dispatch(closeMobileSidebar());
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all font-medium text-xs ${
                      isActive
                        ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                        : 'text-white/85 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <IconComponent
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-slate-950' : 'text-amber-300/90'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {badge > 0 && !isActive && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-400 text-slate-950">
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom Faculty & Sign Out Strip */}
        <div className="p-3 border-t border-white/10 bg-black/20 space-y-2">
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-white/70 text-[11px]">Faculty ID:</span>
            <span className="font-bold text-white text-[11px] font-mono">{teacher.employeeId}</span>
          </div>

          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-white/70 text-[11px]">Class Status:</span>
            <span className={`text-[11px] font-bold flex items-center gap-1.5 ${
              hasLiveClass ? 'text-emerald-300' : 'text-slate-300'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                hasLiveClass ? 'bg-emerald-400 animate-ping' : 'bg-emerald-500'
              }`} />
              {hasLiveClass ? 'Live Teaching' : 'Ready'}
            </span>
          </div>

          <button
            onClick={() => {
              dispatch(logout());
              dispatch(closeMobileSidebar());
              dispatch(
                addToast({
                  title: 'Logged Out',
                  message: 'Teacher session closed safely.',
                  type: 'info',
                })
              );
            }}
            className="w-full mt-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold text-red-200 hover:bg-red-500/20 hover:text-white border border-red-400/20 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
