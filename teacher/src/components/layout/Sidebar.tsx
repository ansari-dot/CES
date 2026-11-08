import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { logoutTeacherThunk } from '../../store/slices/authSlice';
import { setCurrentTab, closeMobileSidebar, addToast } from '../../store/slices/uiSlice';
import { NavTab } from '../../types';
import {
  Home,
  Layers,
  Users,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Video,
  Award,
  Bell,
  MessageSquare,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  LogOut,
  X,
  BookOpen,
  Calendar,
  CalendarDays,
  Clock,
  Sparkles,
  FileCheck
} from 'lucide-react';

interface SubNavItem {
  id: NavTab;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface NavItemConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tabId?: NavTab;
  badge?: number | string;
  badgeColor?: 'red' | 'green' | 'amber';
  subItems?: SubNavItem[];
}

export const Sidebar: React.FC = () => {
  const dispatch = useAppDispatch();
  const currentTab = useAppSelector((state) => state.ui.currentTab);
  const isMobileSidebarOpen = useAppSelector((state) => state.ui.isMobileSidebarOpen);
  const teacher = useAppSelector((state) => state.auth.teacher);
  const submissions = useAppSelector((state) => state.tasks.submissions);
  const lessons = useAppSelector((state) => state.timetable.lessons);
  const notices = useAppSelector((state) => state.notices.notices);

  const pendingGradingCount = submissions.filter(
    (s) => s.status === 'pending' || s.status === 'late'
  ).length;

  const isAnyClassLive = lessons.some((l) => l.status === 'live');

  // Track expanded state for dropdown items
  const [expandedDropdowns, setExpandedDropdowns] = useState<Record<string, boolean>>({
    classes: false,
    examinations: false,
    reports: false,
  });

  // Automatically expand parent dropdown if active tab belongs to its children
  useEffect(() => {
    if (['timetable', 'student-performance', 'learning-resources', 'student-projects'].includes(currentTab)) {
      setExpandedDropdowns((prev) => ({ ...prev, classes: true }));
    } else if (['monthly-tests', 'datesheet', 'exam-results', 'achievements-feedback'].includes(currentTab)) {
      setExpandedDropdowns((prev) => ({ ...prev, examinations: true }));
    } else if (['duty-salary', 'submissions-grading'].includes(currentTab)) {
      setExpandedDropdowns((prev) => ({ ...prev, reports: true }));
    }
  }, [currentTab]);

  const toggleDropdown = (key: string) => {
    setExpandedDropdowns((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleNavClick = (tabId: NavTab) => {
    dispatch(setCurrentTab(tabId));
    dispatch(closeMobileSidebar());
  };

  const handleLogout = async () => {
    dispatch(closeMobileSidebar());
    await dispatch(logoutTeacherThunk());
    dispatch(
      addToast({
        title: 'Logged Out',
        message: 'Teacher session closed safely.',
        type: 'info',
      })
    );
  };

  // Menu items configured exactly to reference image
  const navigationItems: NavItemConfig[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: Home,
      tabId: 'dashboard',
    },
    {
      id: 'classes',
      label: 'My Classes',
      icon: Layers,
      subItems: [
        { id: 'timetable', label: 'Class Timetable', icon: Calendar },
        { id: 'student-performance', label: 'Student Performance', icon: Users },
        { id: 'learning-resources', label: 'Learning Materials', icon: BookOpen },
        { id: 'student-projects', label: 'Student Projects', icon: Sparkles },
      ],
    },
    {
      id: 'students',
      label: 'Students',
      icon: Users,
      tabId: 'student-performance',
    },
    {
      id: 'attendance',
      label: 'Attendance',
      icon: CheckCircle2,
      tabId: 'student-attendance',
    },
    {
      id: 'examinations',
      label: 'Examinations',
      icon: ClipboardCheck,
      subItems: [
        { id: 'monthly-tests', label: 'Tests & Quizzes', icon: ClipboardCheck },
        { id: 'datesheet', label: 'Exam Date Sheets', icon: CalendarDays },
        { id: 'exam-results', label: 'Marks & Grading', icon: Award },
        { id: 'achievements-feedback', label: 'Faculty Feedback', icon: Sparkles },
      ],
    },
    {
      id: 'assignments',
      label: 'Assignments',
      icon: FileText,
      tabId: 'tasks-assignments',
    },
    {
      id: 'zoom',
      label: 'Zoom Classes',
      icon: Video,
      tabId: 'live-lessons',
      badge: isAnyClassLive ? 'LIVE' : undefined,
      badgeColor: 'green',
    },
    {
      id: 'results',
      label: 'Results',
      icon: Award,
      tabId: 'exam-results',
    },
    {
      id: 'notices',
      label: 'Notices',
      icon: Bell,
      tabId: 'notices',
      badge: notices.length > 0 ? notices.length : undefined,
      badgeColor: 'amber',
    },
    {
      id: 'messages',
      label: 'Messages',
      icon: MessageSquare,
      tabId: 'submissions-grading',
      badge: pendingGradingCount > 0 ? pendingGradingCount : 3, // Matches reference red pill '3'
      badgeColor: 'red',
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: BarChart3,
      subItems: [
        { id: 'duty-salary', label: 'Duty & Payroll Hours', icon: Clock },
        { id: 'submissions-grading', label: 'Submission Roster', icon: FileCheck },
      ],
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      tabId: 'profile-settings',
    },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => dispatch(closeMobileSidebar())}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      {/* Sidebar Drawer */}
      <aside
        className={`fixed left-0 top-0 h-full w-56 bg-gradient-to-b from-[#191847] via-[#211f5d] to-[#131236] z-40 shadow-2xl lg:shadow-none border-r border-white/10 transition-transform duration-200 ease-in-out select-none ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Mobile Close Button */}
        <button
          onClick={() => dispatch(closeMobileSidebar())}
          className="absolute top-4 right-3.5 p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 lg:hidden transition cursor-pointer z-20"
          title="Close menu"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Single Full Scrollable Container: Everything scrolls naturally (Logo, Items, Profile & Banner are NOT sticky) */}
        <div className="h-full overflow-y-auto flex flex-col scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
          {/* Brand Header: User's Official Cambridge Logo (Refined, proportional scale matching pages) */}
          <div className="flex flex-col items-center text-center px-3 pt-4 pb-2.5 border-b border-white/10 select-none shrink-0">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-xs p-1 overflow-hidden mb-1.5 border border-white/20 shrink-0">
              <img
                src="/logowb.png"
                alt="Cambridge Education System Logo"
                className="w-full h-full object-contain filter drop-shadow-2xs"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/logo.jpeg';
                }}
              />
            </div>
            <h2 className="text-xs font-bold tracking-tight text-white font-heading">
              Cambridge Education System
            </h2>
            <p className="text-[9px] font-semibold tracking-wider text-white/70 uppercase font-heading mt-0.5">
              Teacher Portal
            </p>
          </div>

          {/* Navigation List - Compact & Proportional Scale (text-xs matching rest of portal) */}
          <div className="px-2.5 py-1.5 space-y-0.5 text-xs flex-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const hasSubmenu = Boolean(item.subItems && item.subItems.length > 0);
              const isDropdownOpen = Boolean(expandedDropdowns[item.id]);

              // Check if item or any of its children is active
              const isDirectActive = item.tabId && currentTab === item.tabId;
              const isChildActive = hasSubmenu && item.subItems?.some((sub) => sub.id === currentTab);
              const isParentActive = isDirectActive || (!isDropdownOpen && isChildActive);

              return (
                <div key={item.id} className="w-full">
                  {/* Main Item Button */}
                  <button
                    type="button"
                    onClick={() => {
                      if (hasSubmenu) {
                        toggleDropdown(item.id);
                      } else if (item.tabId) {
                        handleNavClick(item.tabId);
                      }
                    }}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg font-semibold text-xs transition-all duration-150 cursor-pointer text-left group ${
                      isParentActive
                        ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white shadow-md shadow-blue-500/30 border border-blue-400/30'
                        : 'text-slate-200/90 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 transition-transform duration-150 ${
                        isParentActive ? 'text-white scale-105' : 'text-slate-300 group-hover:text-white'
                      }`}
                    />

                    <span className="truncate flex-1 tracking-tight font-medium">
                      {item.label}
                    </span>

                    {/* Dropdown Chevron Indicator */}
                    {hasSubmenu && (
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-slate-300 transition-transform duration-200 ${
                          isDropdownOpen ? 'rotate-180 text-white' : ''
                        }`}
                      />
                    )}

                    {/* Red Circle Notification Badge (Messages, etc.) */}
                    {item.badge !== undefined && (
                      <span
                        className={`px-1.5 min-w-[18px] h-4 rounded-full flex items-center justify-center text-[10px] font-black tracking-tight shrink-0 shadow-2xs ${
                          item.badgeColor === 'green'
                            ? 'bg-emerald-500 text-white animate-pulse'
                            : item.badgeColor === 'amber'
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'bg-rose-500 text-white shadow-rose-500/40'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>

                  {/* Submenu Children Accordion */}
                  {hasSubmenu && isDropdownOpen && (
                    <div className="pl-5 pr-1 py-0.5 space-y-0.5 animate-in slide-in-from-top-1 duration-150">
                      {item.subItems?.map((sub) => {
                        const SubIcon = sub.icon || ChevronRight;
                        const isSubActive = currentTab === sub.id;

                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => handleNavClick(sub.id)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors text-left cursor-pointer ${
                              isSubActive
                                ? 'bg-white/20 text-white font-bold border-l-2 border-blue-400 pl-2'
                                : 'text-slate-300/80 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            <SubIcon className="w-3 h-3 shrink-0 opacity-80" />
                            <span className="truncate">{sub.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Profile & Campus Banner Placed Naturally at the End of Sidebar Items (Not Sticky!) */}
            <div className="pt-3 pb-3 space-y-2 select-none border-t border-white/10 mt-2">
              {/* Teacher Profile Bar (Matching Image exactly, proportional scale) */}
              <div className="rounded-lg bg-white/5 border border-white/10 p-2 flex items-center justify-between gap-2 hover:bg-white/10 transition">
                <div
                  onClick={() => {
                    dispatch(setCurrentTab('profile-settings'));
                    dispatch(closeMobileSidebar());
                  }}
                  className="flex items-center gap-2 min-w-0 cursor-pointer flex-1 group"
                >
                  <div className="relative shrink-0">
                    <img
                      src={
                        teacher.avatar ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          teacher.name || 'Zun'
                        )}&background=36348e&color=fff`
                      }
                      alt={teacher.name}
                      className="w-7 h-7 rounded-full object-cover border border-white/30"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          teacher.name || 'Zun'
                        )}&background=36348e&color=fff`;
                      }}
                    />
                    {/* Green online indicator dot on bottom right */}
                    <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-[#191847]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white group-hover:text-blue-300 truncate leading-tight">
                      {teacher.name || 'Zun'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                      ID: {teacher.employeeId || 'TCH-1235'}
                    </p>
                  </div>
                </div>

                {/* Logout button */}
                <button
                  type="button"
                  onClick={handleLogout}
                  title="Sign out"
                  className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-white/15 transition cursor-pointer shrink-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Campus Building Graphic (Login Banner Image) */}
              <div className="relative h-22 sm:h-24 w-full overflow-hidden rounded-lg border border-white/10 group">
                <img
                  src="/loginbc.webp"
                  alt="Cambridge Education System Campus"
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent pointer-events-none" />
                <div className="absolute bottom-1 inset-x-0 text-center pointer-events-none">
                  <span className="text-[9px] font-bold text-white/95 tracking-widest uppercase drop-shadow-sm">
                    Cambridge Campus
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};
