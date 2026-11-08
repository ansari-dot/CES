import React from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { logoutTeacherThunk } from '../../store/slices/authSlice';
import { setCurrentTab, closeMobileSidebar, addToast } from '../../store/slices/uiSlice';
import { NavTab } from '../../types';
import {
  LayoutDashboard,
  Calendar,
  CalendarDays,
  Video,
  UserCheck,
  ClipboardList,
  ClipboardCheck,
  FileCheck,
  BookOpen,
  Award,
  Bell,
  Clock,
  User,
  ChevronUp,
  LogOut,
  X
} from 'lucide-react';

interface NavItem {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'timetable', label: 'Timetable & Schedule', icon: Calendar },
  { id: 'live-lessons', label: 'Live Classrooms (Zoom)', icon: Video },
  { id: 'student-attendance', label: 'Student Attendance', icon: UserCheck },
  { id: 'tasks-assignments', label: 'Tasks & Homework', icon: ClipboardList },
  { id: 'monthly-tests', label: 'Tests & Examinations', icon: ClipboardCheck },
  { id: 'datesheet', label: 'Exam Date Sheets', icon: CalendarDays },
  { id: 'submissions-grading', label: 'Grading & Submissions', icon: FileCheck },
  { id: 'learning-resources', label: 'Learning Materials', icon: BookOpen },
  { id: 'exam-results', label: 'Exam Results & Marks', icon: Award },
  { id: 'notices', label: 'School Notices', icon: Bell },
  { id: 'duty-salary', label: 'Duty & Payroll', icon: Clock },
  { id: 'profile-settings', label: 'My Profile', icon: User },
];

export const Sidebar: React.FC = () => {
  const dispatch = useAppDispatch();
  const currentTab = useAppSelector((state) => state.ui.currentTab);
  const isMobileSidebarOpen = useAppSelector((state) => state.ui.isMobileSidebarOpen);
  const teacher = useAppSelector((state) => state.auth.teacher);
  const submissions = useAppSelector((state) => state.tasks.submissions);
  const isAttendanceLocked = useAppSelector((state) => state.attendance.isLocked);

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
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-[#36348e] z-50 flex flex-col shadow-xl lg:shadow-md transition-transform duration-200 ease-in-out select-none ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Mobile Close Button */}
        <button
          onClick={() => dispatch(closeMobileSidebar())}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 lg:hidden transition cursor-pointer"
          title="Close menu"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Header */}
        <div className="flex flex-col items-center gap-2.5 px-4 pt-6 pb-5 border-b border-white/15">
          <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-md overflow-hidden shrink-0">
            <img
              src="/logowb.png"
              alt="Cambridge Education System logo"
              className="w-full h-full object-contain drop-shadow-sm"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/logo.jpeg';
              }}
            />
          </div>
          <div className="flex flex-col min-w-0 text-center">
            <span className="text-sm font-semibold tracking-tight text-white truncate font-heading">
              Cambridge Education System
            </span>
            <span className="text-[10px] text-white/70 font-medium tracking-wide uppercase truncate font-heading">
              Teacher Portal
            </span>
          </div>
        </div>

        {/* Navigation List */}
        <div className="sidebar-scroll flex-1 overflow-y-auto p-3 flex flex-col gap-0.5 text-xs">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            const badge = getBadgeCount(item.id);

            return (
              <button
                key={item.id}
                onClick={() => {
                  dispatch(setCurrentTab(item.id));
                  dispatch(closeMobileSidebar());
                }}
                className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors w-full text-left cursor-pointer ${
                  isActive
                    ? 'bg-[#ffc53a] text-[#1b1a47] font-semibold shadow-xs'
                    : 'text-white/85 hover:bg-[#ffc53a] hover:text-[#1b1a47]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
                {badge > 0 && !isActive && (
                  <span className="ml-auto min-w-4 h-4 px-1 rounded-full bg-[#ffc53a] text-[#1b1a47] text-[10px] flex items-center justify-center font-bold">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Profile Footer */}
        <div className="p-3 border-t border-white/15 bg-white/5 mt-auto">
          <div
            onClick={() => {
              dispatch(setCurrentTab('profile-settings'));
              dispatch(closeMobileSidebar());
            }}
            className="group flex items-center gap-2 bg-white/10 rounded-md p-2 hover:bg-[#ffc53a] transition cursor-pointer"
          >
            <img
              src={teacher.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(teacher.name || 'T')}&background=36348e&color=fff`}
              alt={teacher.name}
              className="w-8 h-8 rounded-full object-cover border border-white/30 shrink-0"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(teacher.name || 'T')}&background=36348e&color=fff`;
              }}
            />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white group-hover:text-[#1b1a47] truncate">{teacher.name}</div>
              <div className="text-[11px] text-white/70 group-hover:text-[#1b1a47]/80 truncate">ID: {teacher.employeeId || 'Faculty'}</div>
            </div>
            <ChevronUp className="w-3.5 h-3.5 text-white/70 group-hover:text-[#1b1a47] ml-auto shrink-0" />
          </div>

          <button
            onClick={async () => {
              dispatch(closeMobileSidebar());
              await dispatch(logoutTeacherThunk());
              dispatch(
                addToast({
                  title: 'Logged Out',
                  message: 'Teacher session closed safely.',
                  type: 'info',
                })
              );
            }}
            className="mt-1.5 w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-white/80 hover:bg-[#ffc53a] hover:text-[#1b1a47] transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
