import React from 'react';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  HeartHandshake,
  CalendarDays,
  Video,
  Clock,
  Receipt,
  FileCheck2,
  Banknote,
  BookOpen,
  BellRing,
  FileText,
  History,
  UserCheck,
  ShieldAlert,
  Lock,
  ChevronRight,
  LogOut
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type ActiveModule =
  | 'dashboard'
  | 'teachers'
  | 'students'
  | 'parents'
  | 'academics'
  | 'timetable'
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

interface NavItem {
  id: ActiveModule;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeModule,
  onSelectModule,
  pendingCounts = {}
}) => {
  const { logout, currentUser, activeSession } = useAuth();
  const navSections: NavSection[] = [
    {
      title: 'OPERATIONS',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }
      ]
    },
    {
      title: 'PERSONNEL & ACCOUNTS',
      items: [
        { id: 'teachers', label: 'Teachers', icon: Users },
        { id: 'students', label: 'Students (Grades 1-8)', icon: GraduationCap },
        { id: 'parents', label: 'Parents & Guardians', icon: HeartHandshake }
      ]
    },
    {
      title: 'ACADEMIC & LIVE CLASSES',
      items: [
        { id: 'academics', label: 'Sessions & Subjects', icon: BookOpen },
        { id: 'timetable', label: 'Timetable Schedules', icon: CalendarDays },
        {
          id: 'zoom',
          label: 'Zoom Class-Links',
          icon: Video,
          badge: pendingCounts.zoomDegraded ? `${pendingCounts.zoomDegraded}` : undefined,
          badgeColor: 'text-amber-700 bg-amber-50 border-amber-200'
        },
        {
          id: 'attendance',
          label: 'Attendance Oversight',
          icon: Clock,
          badge: pendingCounts.attendanceCorrections ? `${pendingCounts.attendanceCorrections}` : undefined,
          badgeColor: 'text-sky-700 bg-sky-50 border-sky-200'
        }
      ]
    },
    {
      title: 'FINANCIALS & PAYROLL',
      items: [
        { id: 'fees', label: 'Fee Structures', icon: FileText },
        { id: 'challans', label: 'Monthly Challans', icon: Receipt },
        {
          id: 'payments',
          label: 'Payment Verifications',
          icon: FileCheck2,
          badge: pendingCounts.paymentProofs ? `${pendingCounts.paymentProofs}` : undefined,
          badgeColor: 'text-emerald-700 bg-emerald-50 border-emerald-200'
        },
        {
          id: 'restricted-students',
          label: 'Restricted Students',
          icon: Lock,
          badge: pendingCounts.restrictedStudents ? `${pendingCounts.restrictedStudents}` : undefined,
          badgeColor: 'text-rose-700 bg-rose-50 border-rose-200'
        },
        {
          id: 'payroll',
          label: 'Teacher Payroll',
          icon: Banknote,
          badge: pendingCounts.salaryDrafts ? `${pendingCounts.salaryDrafts}` : undefined,
          badgeColor: 'text-amber-700 bg-amber-50 border-amber-200'
        }
      ]
    },
    {
      title: 'GOVERNANCE & COMMS',
      items: [
        { id: 'academic-oversight', label: 'Academic Oversight', icon: UserCheck },
        { id: 'academic-year', label: 'Year & Promotions', icon: GraduationCap },
        { id: 'notices', label: 'Notices & Circulars', icon: BellRing },
        { id: 'reports', label: 'Reports & Exports', icon: FileText },
        { id: 'audit', label: 'Audit Trail', icon: History }
      ]
    },
    {
      title: 'ACCESS & CONTROLS',
      items: [
        { id: 'profile', label: 'Principal Profile & Settings', icon: ShieldAlert }
      ]
    }
  ];

  return (
    <aside className="w-64 bg-[#232168] flex flex-col shrink-0 select-none shadow-xl z-30">
      {/* Brand Header */}
      <div className="px-4 py-4 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 shrink-0 flex items-center justify-center">
            <img
              src="/logowb.png"
              alt="Cambridge Education System Logo"
              className="w-full h-full object-contain drop-shadow-sm"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/logo.jpeg';
              }}
            />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold text-white tracking-tight leading-tight">
              Cambridge
            </span>
            <span className="text-[10px] font-semibold text-amber-300 uppercase tracking-wider">
              Principal Portal
            </span>
          </div>
        </div>
      </div>

      {/* Session & Scope Bar */}
      <div className="px-4 py-2 bg-black/15 flex items-center justify-between border-b border-white/10 text-[11px] text-white/80">
        <span className="font-medium truncate">{activeSession || 'Academic Year 2026–2027'}</span>
        <span className="font-semibold text-amber-300">Classes 1–8</span>
      </div>

      {/* Navigation Sections */}
      <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 py-3 space-y-3.5 text-xs">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1">
            <div className="px-2 pb-1 text-[10px] font-bold tracking-wider text-white/40 uppercase font-heading">
              {section.title}
            </div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectModule(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all font-medium text-xs cursor-pointer ${
                    isActive
                      ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                      : 'text-white/85 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-slate-950' : 'text-amber-300/90'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge ? (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                        isActive
                          ? 'bg-slate-950 text-amber-300'
                          : 'bg-amber-400 text-slate-950'
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : isActive ? (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-950 shrink-0" />
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom Role & Sign Out Strip */}
      <div className="p-3 border-t border-white/10 bg-black/20 space-y-2 mt-auto">
        <div className="flex items-center justify-between text-xs px-1">
          <span className="text-white/70 text-[11px]">Role:</span>
          <span className="font-bold text-white text-[11px] font-mono">{currentUser?.role || 'Principal'}</span>
        </div>

        <div className="flex items-center justify-between text-xs px-1">
          <span className="text-white/70 text-[11px]">Status:</span>
          <span className="text-[11px] font-bold flex items-center gap-1.5 text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Active Session
          </span>
        </div>

        <button
          type="button"
          onClick={logout}
          className="w-full mt-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold text-red-200 hover:bg-red-500/20 hover:text-white border border-red-400/20 transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
