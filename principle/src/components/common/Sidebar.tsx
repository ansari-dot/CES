import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  HeartHandshake,
  CalendarDays,
  Calendar,
  Video,
  Clock,
  Receipt,
  FileCheck2,
  Banknote,
  BookOpen,
  BellRing,
  FileText,
  History,
  ShieldAlert,
  KeyRound,
  Lock,
  ChevronDown,
  ChevronRight,
  LogOut,
  Trophy,
  Sparkles,
  Layers,
  Settings,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type ActiveModule =
  | 'dashboard'
  | 'teachers'
  | 'students'
  | 'parents'
  | 'academics'
  | 'academic-calendar'
  | 'timetable'
  | 'datesheets'
  | 'zoom'
  | 'attendance'
  | 'fees'
  | 'challans'
  | 'payments'
  | 'restricted-students'
  | 'payroll'
  | 'academic-oversight'
  | 'academic-year'
  | 'notices'
  | 'notifications'
  | 'reports'
  | 'audit'
  | 'password-resets'
  | 'chat-oversight'
  | 'profile';

interface SidebarProps {
  activeModule: ActiveModule;
  onSelectModule: (module: ActiveModule) => void;
  pendingCounts?: {
    paymentProofs?: number;
    salaryDrafts?: number;
    attendanceCorrections?: number;
    zoomDegraded?: number;
    restrictedStudents?: number;
  };
}

interface SubNavItem {
  id: ActiveModule;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badge?: number | string;
  badgeColor?: 'red' | 'amber' | 'green';
}

interface NavItemConfig {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  targetModule?: ActiveModule;
  badge?: number | string;
  badgeColor?: 'red' | 'amber' | 'green';
  subItems?: SubNavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onSelectModule,
  pendingCounts = {}
}) => {
  const { currentUser, logout } = useAuth();

  // Track expanded state for dropdown items
  const [expandedDropdowns, setExpandedDropdowns] = useState<Record<string, boolean>>({
    personnel: false,
    academics: false,
    examinations: false,
    financials: false,
    governance: false
  });

  // Automatically expand parent dropdown if active module belongs to its children
  useEffect(() => {
    if (['teachers', 'students', 'parents'].includes(activeModule)) {
      setExpandedDropdowns((prev) => ({ ...prev, personnel: true }));
    } else if (['academics', 'academic-calendar', 'timetable', 'zoom', 'attendance'].includes(activeModule)) {
      setExpandedDropdowns((prev) => ({ ...prev, academics: true }));
    } else if (['datesheets', 'academic-oversight', 'academic-year'].includes(activeModule)) {
      setExpandedDropdowns((prev) => ({ ...prev, examinations: true }));
    } else if (['fees', 'challans', 'payments', 'restricted-students', 'payroll'].includes(activeModule)) {
      setExpandedDropdowns((prev) => ({ ...prev, financials: true }));
    } else if (['notices', 'reports', 'audit', 'chat-oversight'].includes(activeModule)) {
      setExpandedDropdowns((prev) => ({ ...prev, governance: true }));
    }
  }, [activeModule]);

  const toggleDropdown = (key: string) => {
    setExpandedDropdowns((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const urgentFinancialCount =
    (pendingCounts.paymentProofs || 0) +
    (pendingCounts.salaryDrafts || 0) +
    (pendingCounts.restrictedStudents || 0);

  const navigationItems: NavItemConfig[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      targetModule: 'dashboard'
    },
    {
      id: 'academics',
      label: 'Academics & Classes',
      icon: Layers,
      subItems: [
        { id: 'academics', label: 'Sessions & Subjects', icon: BookOpen },
        { id: 'academic-calendar', label: 'Academic Calendar & Breaks', icon: Calendar },
        { id: 'timetable', label: 'Timetable Schedules', icon: CalendarDays },
        {
          id: 'zoom',
          label: 'Live Zoom Links',
          icon: Video,
          badge: pendingCounts.zoomDegraded || undefined,
          badgeColor: 'amber'
        },
        {
          id: 'attendance',
          label: 'Attendance Oversight',
          icon: Clock,
          badge: pendingCounts.attendanceCorrections || undefined,
          badgeColor: 'amber'
        }
      ]
    },
    {
      id: 'examinations',
      label: 'Examinations',
      icon: Trophy,
      subItems: [
        { id: 'datesheets', label: 'Official Date Sheets', icon: Calendar },
        { id: 'academic-oversight', label: 'Terminal Exam Results', icon: Trophy },
        { id: 'academic-year', label: 'Year & Promotions', icon: GraduationCap }
      ]
    },
    {
      id: 'financials',
      label: 'Accounts & Payroll',
      icon: Receipt,
      badge: urgentFinancialCount > 0 ? urgentFinancialCount : undefined,
      badgeColor: 'amber',
      subItems: [
        { id: 'fees', label: 'Fee Structures', icon: FileText },
        { id: 'challans', label: 'Monthly Challans', icon: Receipt },
        {
          id: 'payments',
          label: 'Payment Verifications',
          icon: FileCheck2,
          badge: pendingCounts.paymentProofs || undefined,
          badgeColor: 'green'
        },
        {
          id: 'restricted-students',
          label: 'Restricted Students',
          icon: Lock,
          badge: pendingCounts.restrictedStudents || undefined,
          badgeColor: 'red'
        },
        {
          id: 'payroll',
          label: 'Faculty Payroll',
          icon: Banknote,
          badge: pendingCounts.salaryDrafts || undefined,
          badgeColor: 'amber'
        }
      ]
    },
    {
      id: 'personnel',
      label: 'Personnel & Accounts',
      icon: Users,
      subItems: [
        { id: 'teachers', label: 'Teachers Directory', icon: Users },
        { id: 'students', label: 'Students (Grades 1–8)', icon: GraduationCap },
        { id: 'parents', label: 'Parents & Guardians', icon: HeartHandshake }
      ]
    },
    {
      id: 'governance',
      label: 'Governance & Comms',
      icon: BookOpen,
      subItems: [
        { id: 'notices', label: 'Notices & Circulars', icon: BellRing },
        { id: 'reports', label: 'Reports & Exports', icon: FileText },
        { id: 'audit', label: 'System Audit Trail', icon: History },
        { id: 'chat-oversight', label: 'Chat Safety Oversight', icon: MessageSquare },
        { id: 'password-resets', label: 'Password Reset Requests', icon: KeyRound }
      ]
    },
    {
      id: 'profile',
      label: 'Settings & Profile',
      icon: Settings,
      targetModule: 'profile'
    }
  ];

  const principalName = currentUser?.name || 'Prof. Tariq Mahmood';

  return (
    <aside className="h-full w-56 bg-gradient-to-b from-[#191847] via-[#211f5d] to-[#131236] shrink-0 shadow-2xl lg:shadow-none border-r border-white/10 select-none flex flex-col relative z-30">
      {/* Single Full Scrollable Container: Everything scrolls naturally (Logo, Items, Profile & Campus are NOT sticky) */}
      <div className="h-full overflow-y-auto flex flex-col scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
        
        {/* Brand Header: Cambridge Logo (Proportional, refined scale matching teacher & student portal) */}
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
            Principal Portal
          </p>
        </div>

        {/* Navigation List - Compact & Proportional Scale (text-xs matching rest of portal) */}
        <div className="px-2.5 py-1.5 space-y-0.5 text-xs flex-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const hasSubmenu = Boolean(item.subItems && item.subItems.length > 0);
            const isDropdownOpen = Boolean(expandedDropdowns[item.id]);

            // Check if item or any of its children is active
            const isDirectActive = item.targetModule && activeModule === item.targetModule;
            const isChildActive = hasSubmenu && item.subItems?.some((sub) => sub.id === activeModule);
            const isParentActive = isDirectActive || (!isDropdownOpen && isChildActive);

            return (
              <div key={item.id} className="w-full">
                {/* Main Item Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (hasSubmenu) {
                      toggleDropdown(item.id);
                    } else if (item.targetModule) {
                      onSelectModule(item.targetModule);
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
                      const isSubActive = activeModule === sub.id;

                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => onSelectModule(sub.id)}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors text-left cursor-pointer ${
                            isSubActive
                              ? 'bg-white/20 text-white font-bold border-l-2 border-blue-400 pl-2'
                              : 'text-slate-300/80 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <SubIcon className="w-3 h-3 shrink-0 opacity-80" />
                            <span className="truncate">{sub.label}</span>
                          </div>

                          {sub.badge !== undefined && (
                            <span
                              className={`px-1.5 min-w-[16px] h-3.5 rounded-full flex items-center justify-center text-[9px] font-black tracking-tight shrink-0 ${
                                sub.badgeColor === 'green'
                                  ? 'bg-emerald-500 text-white'
                                  : sub.badgeColor === 'amber'
                                  ? 'bg-amber-500 text-slate-950'
                                  : 'bg-rose-500 text-white'
                              }`}
                            >
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
          {/* Principal Profile Bar (Matching Teacher & Student layout exactly) */}
          <div className="rounded-lg bg-white/5 border border-white/10 p-2 flex items-center justify-between gap-2 hover:bg-white/10 transition">
            <div
              onClick={() => onSelectModule('profile')}
              className="flex items-center gap-2 min-w-0 cursor-pointer flex-1 group"
            >
              <div className="relative shrink-0">
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                    principalName
                  )}&background=36348e&color=fff`}
                  alt={principalName}
                  className="w-7 h-7 rounded-full object-cover border border-white/30"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=Principal&background=36348e&color=fff`;
                  }}
                />
                {/* Green online indicator dot on bottom right */}
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-[#191847]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white group-hover:text-blue-300 truncate leading-tight">
                  {principalName}
                </p>
                <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                  ID: CES-ADM-01
                </p>
              </div>
            </div>

            {/* Logout button */}
            <button
              type="button"
              onClick={logout}
              title="Sign out of Principal Portal"
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
    </aside>
  );
};
