import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import {
  Home,
  Layers,
  CalendarDays,
  Calendar,
  Video,
  FolderOpen,
  ClipboardCheck,
  FileText,
  Rocket,
  CheckCircle2,
  TrendingUp,
  Award,
  Bell,
  Settings,
  ChevronDown,
  ChevronRight,
  LogOut,
  X,
  BookOpen,
  Sparkles,
  BarChart3,
  ScrollText,
  User,
  MessageSquare
} from 'lucide-react';
import { useSectionBadges } from '../../hooks/useSectionBadges';
import { badgeLabel } from '../../lib/sectionBadges';

interface SubNavItem {
  id: string;
  label: string;
  path: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: number | string;
}

interface NavItemConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path?: string;
  badge?: number | string;
  badgeColor?: 'red' | 'green' | 'amber';
  subItems?: SubNavItem[];
}

interface SidebarProps {
  mobileClose?: () => void;
  onLogout?: () => void;
}

export default function Sidebar({ mobileClose, onLogout }: SidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();

  // Redux Selectors
  const unreadCount = useSelector((state: RootState) => state.notifications.unreadCount);
  // New activity from teachers/school per sidebar section (amber mini counters)
  const activityCounts = useSectionBadges();
  const profile = useSelector((state: RootState) => state.student.profile);
  const nextClass = useSelector((state: RootState) => state.classes.nextClass);
  const todayClasses = useSelector((state: RootState) => state.classes.todayClasses);

  const isClassLive = Boolean(
    nextClass?.isLiveNow || todayClasses?.some((c) => c.status === 'live' || c.joinable)
  );

  // Dropdown states (Classes, Examinations, Reports)
  const [expandedDropdowns, setExpandedDropdowns] = useState<Record<string, boolean>>({
    classes: false,
    examinations: false,
    reports: false,
  });

  // Automatically expand parent dropdown if active route belongs to its children
  useEffect(() => {
    const p = location.pathname;
    if (['/student/timetable', '/student/classes', '/student/learning', '/student/projects'].includes(p)) {
      setExpandedDropdowns((prev) => ({ ...prev, classes: true }));
    } else if (['/student/tests', '/student/datesheet'].includes(p)) {
      setExpandedDropdowns((prev) => ({ ...prev, examinations: true }));
    } else if (p === '/student/progress') {
      setExpandedDropdowns((prev) => ({ ...prev, reports: true }));
    }
  }, [location.pathname]);

  const toggleDropdown = (key: string) => {
    setExpandedDropdowns((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleNavClick = (path: string) => {
    navigate(path);
    if (mobileClose) mobileClose();
  };

  // Student Navigation Items - Exactly matched to the Teacher Sidebar layout and aesthetics
  const navigationItems: NavItemConfig[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: Home,
      path: '/student/dashboard',
    },
    {
      id: 'classes',
      label: 'My Classes',
      icon: Layers,
      subItems: [
        { id: 'timetable', label: 'Class Timetable', path: '/student/timetable', icon: Calendar },
        { id: 'live-classes', label: 'Live Zoom Classes', path: '/student/classes', icon: Video },
        { id: 'learning', label: 'Learning Materials', path: '/student/learning', icon: BookOpen },
        { id: 'projects', label: 'Student Projects', path: '/student/projects', icon: Sparkles },
      ],
    },
    {
      id: 'attendance',
      label: 'Attendance',
      icon: CheckCircle2,
      path: '/student/attendance',
    },
    {
      id: 'examinations',
      label: 'Examinations',
      icon: ClipboardCheck,
      subItems: [
        { id: 'tests', label: 'Tests & Quizzes', path: '/student/tests', icon: ClipboardCheck },
        { id: 'datesheet', label: 'Exam Date Sheets', path: '/student/datesheet', icon: CalendarDays },
      ],
    },
    {
      id: 'assignments',
      label: 'Assignments',
      icon: FileText,
      path: '/student/homework',
    },
    {
      id: 'faculty-chat',
      label: 'Ask Teacher',
      icon: MessageSquare,
      path: '/student/chat',
    },
    {
      id: 'zoom',
      label: 'Zoom Classes',
      icon: Video,
      path: '/student/classes',
      badge: isClassLive ? 'LIVE' : undefined,
      badgeColor: 'green',
    },
    {
      id: 'results',
      label: 'Results',
      icon: Award,
      path: '/student/results',
    },
    {
      id: 'achievements',
      label: 'Achievements',
      icon: Sparkles,
      path: '/student/achievements',
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      path: '/student/notifications',
      badge: unreadCount > 0 ? unreadCount : undefined,
      badgeColor: 'red',
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: BarChart3,
      subItems: [
        { id: 'report-progress', label: 'Academic Progress', path: '/student/progress', icon: TrendingUp },
        { id: 'report-transcripts', label: 'Grade Transcripts', path: '/student/results', icon: ScrollText },
      ],
    },
  ];

  // Attach amber activity counters (existing LIVE / Notifications badges are kept)
  for (const item of navigationItems) {
    if (item.subItems) {
      const subPaths = new Set<string>();
      for (const sub of item.subItems) {
        const c = activityCounts[sub.path] || 0;
        sub.badge = c > 0 ? badgeLabel(c) : undefined;
        subPaths.add(sub.path);
      }
      const total = Array.from(subPaths).reduce((sum, path) => sum + (activityCounts[path] || 0), 0);
      if (item.badge === undefined && total > 0) {
        item.badge = badgeLabel(total);
        item.badgeColor = 'amber';
      }
    } else if (item.path && item.badge === undefined) {
      const c = activityCounts[item.path] || 0;
      if (c > 0) {
        item.badge = badgeLabel(c);
        item.badgeColor = 'amber';
      }
    }
  }

  return (
    <aside className="h-full w-56 shrink-0 bg-gradient-to-b from-[#191847] via-[#211f5d] to-[#131236] shadow-2xl lg:shadow-none border-r border-white/10 select-none flex flex-col relative">
      {/* Mobile Close Button */}
      {mobileClose && (
        <button
          onClick={mobileClose}
          className="absolute top-4 right-3.5 p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 md:hidden transition cursor-pointer z-20"
          title="Close menu"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      {/* Single Full Scrollable Container: Everything scrolls naturally (Logo, Items, Profile & Banner are NOT sticky) */}
      <div className="h-full overflow-y-auto flex flex-col scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
        {/* Brand Header: Cambridge Logo (Proportional, refined scale matching teacher portal) */}
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
            Student Portal
          </p>
        </div>

        {/* Navigation List - Compact & Proportional Scale (text-xs matching rest of portal) */}
        <div className="px-2.5 py-1.5 space-y-0.5 text-xs flex-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const hasSubmenu = Boolean(item.subItems && item.subItems.length > 0);
            const isDropdownOpen = Boolean(expandedDropdowns[item.id]);

            // Check if item or any of its children is active
            const isDirectActive = item.path && location.pathname === item.path;
            const isChildActive = hasSubmenu && item.subItems?.some((sub) => location.pathname === sub.path);
            const isParentActive = isDirectActive || (!isDropdownOpen && isChildActive);

            return (
              <div key={item.id} className="w-full">
                {/* Main Item Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (hasSubmenu) {
                      toggleDropdown(item.id);
                    } else if (item.path) {
                      handleNavClick(item.path);
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

                  {/* Notification Badge */}
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
                      const isSubActive = location.pathname === sub.path;

                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => handleNavClick(sub.path)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors text-left cursor-pointer ${
                            isSubActive
                              ? 'bg-white/20 text-white font-bold border-l-2 border-blue-400 pl-2'
                              : 'text-slate-300/80 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <SubIcon className="w-3 h-3 shrink-0 opacity-80" />
                          <span className="truncate flex-1">{sub.label}</span>
                          {sub.badge !== undefined && (
                            <span className="px-1.5 min-w-[18px] h-4 rounded-full flex items-center justify-center text-[10px] font-bold tracking-tight shrink-0 shadow-2xs bg-amber-500 text-slate-950">
                              {sub.badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Profile & Campus Banner Placed Naturally at the End of Sidebar Items (Not Sticky!) */}
        <div className="px-2.5 pt-3 pb-3 space-y-2 select-none border-t border-white/10 mt-2">
          {/* Student Profile Bar (Matching Teacher layout exactly) */}
          <div className="rounded-lg bg-white/5 border border-white/10 p-2 flex items-center justify-between gap-2 hover:bg-white/10 transition">
            <div
              onClick={() => handleNavClick('/student/profile')}
              className="flex items-center gap-2 min-w-0 cursor-pointer flex-1 group"
            >
              <div className="relative shrink-0">
                <img
                  src={
                    profile.avatar ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      profile.name || 'Student'
                    )}&background=36348e&color=fff`
                  }
                  alt={profile.name}
                  className="w-7 h-7 rounded-full object-cover border border-white/30"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      profile.name || 'Student'
                    )}&background=36348e&color=fff`;
                  }}
                />
                {/* Green online indicator dot on bottom right */}
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-[#191847]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white group-hover:text-blue-300 truncate leading-tight">
                  {profile.name || 'Student'}
                </p>
                <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                  Student
                  {profile.rollNumber
                    ? ` · Roll: ${profile.rollNumber}`
                    : profile.admissionNo
                    ? ` · ID: ${profile.admissionNo}`
                    : profile.grade
                    ? ` · ${profile.grade}`
                    : ''}
                </p>
              </div>
            </div>

            {/* Settings: opens the profile & settings page */}
            <button
              type="button"
              onClick={() => handleNavClick('/student/profile')}
              title="Profile & settings"
              aria-label="Profile and settings"
              className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-white/15 transition cursor-pointer shrink-0"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>

            {/* Logout button */}
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                title="Sign out"
                className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-white/15 transition cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
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
    </aside>
  );
}
