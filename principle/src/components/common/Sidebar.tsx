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
  const { logout } = useAuth();
  const navSections: NavSection[] = [
    {
      title: 'Operations',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }
      ]
    },
    {
      title: 'Personnel & Accounts',
      items: [
        { id: 'teachers', label: 'Teachers', icon: Users },
        { id: 'students', label: 'Students (Grades 1-8)', icon: GraduationCap },
        { id: 'parents', label: 'Parents & Guardians', icon: HeartHandshake }
      ]
    },
    {
      title: 'Academic & Live Classes',
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
      title: 'Financials & Payroll',
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
      title: 'Governance & Comms',
      items: [
        { id: 'academic-oversight', label: 'Academic Oversight', icon: UserCheck },
        { id: 'academic-year', label: 'Year & Promotions', icon: GraduationCap },
        { id: 'notices', label: 'Notices & Circulars', icon: BellRing },
        { id: 'reports', label: 'Reports & Exports', icon: FileText },
        { id: 'audit', label: 'Audit Trail', icon: History }
      ]
    },
    {
      title: 'Access & Controls',
      items: [
        { id: 'profile', label: 'Principal Profile & Settings', icon: ShieldAlert }
      ]
    }
  ];

  return (
    <aside className="w-64 bg-amber-600 flex flex-col shrink-0 select-none shadow-xs z-30">
      {/* Brand Header */}
      <div className="px-4 pt-6 pb-5 border-b border-white/15 flex flex-col items-center gap-2.5">
        <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-md shrink-0 overflow-hidden">
          <img src="/logowb.png" alt="Cambridge Education System logo" className="w-full h-full object-contain drop-shadow-sm" />
        </div>
        <div className="flex flex-col min-w-0 text-center">
          <span className="text-sm font-semibold tracking-tight text-white truncate font-heading">
            Principal Portal
          </span>
          <span className="text-[10px] text-white/70 font-medium tracking-wide uppercase truncate font-heading">
            Classes 1–8 · Online School
          </span>
        </div>
      </div>

      {/* Navigation Sections */}
      <nav className="sidebar-scroll flex-1 overflow-y-auto p-3 space-y-4 text-xs">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-0.5">
            <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/50 font-heading">
              {section.title}
            </div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectModule(item.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg font-medium transition-colors ${
                    isActive
                      ? 'bg-amber-500 text-amber-950 font-semibold shadow-xs'
                      : 'text-white/85 hover:text-amber-950 hover:bg-amber-500'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-950' : 'text-inherit'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge ? (
                    <span
                      className={`px-1.5 py-0.2 rounded font-mono text-[10px] font-semibold border tabular-nums ${item.badgeColor}`}
                    >
                      {item.badge}
                    </span>
                  ) : isActive ? (
                    <ChevronRight className="w-3.5 h-3.5 text-amber-950 shrink-0 opacity-80" />
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer Role Notice & Sign Out */}
      <div className="p-3 border-t border-white/15 bg-white/5 text-[11px] text-white/80">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 font-medium text-white/90">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
              <span>Principal Access</span>
            </div>
            <div className="mt-0.5 text-[10px] text-white/60">
              Classes 1–8 Real-Time Ops
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Sign Out of Principal Portal"
            className="p-1.5 rounded-lg border border-white/25 text-white/80 hover:text-amber-950 hover:bg-amber-500 hover:border-transparent transition-colors shadow-2xs cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
};
