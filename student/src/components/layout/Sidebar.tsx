import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  CalendarDays, 
  Video, 
  FolderOpen, 
  ClipboardList, 
  Rocket, 
  CalendarCheck, 
  TrendingUp, 
  Award, 
  Receipt, 
  Bell, 
  User, 
  LogOut,
  X
} from 'lucide-react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

interface SidebarProps {
  mobileClose?: () => void;
  onLogout?: () => void;
}

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | null;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export default function Sidebar({ mobileClose, onLogout }: SidebarProps) {
  const unreadCount = useSelector((state: RootState) => state.notifications.unreadCount);
  const pendingAssignmentsCount = useSelector((state: RootState) => 
    state.assignments.items.filter(a => a.status === 'Pending').length
  );
  const profile = useSelector((state: RootState) => state.student.profile);

  const navSections: NavSection[] = [
    {
      title: 'ACADEMICS',
      items: [
        { name: 'Dashboard', path: '/student/dashboard', icon: LayoutDashboard },
        { name: 'My Timetable', path: '/student/timetable', icon: CalendarDays },
        { name: 'Live Classes', path: '/student/classes', icon: Video },
        { name: 'Learning Resources', path: '/student/learning', icon: FolderOpen },
      ]
    },
    {
      title: 'STUDIES & PROGRESS',
      items: [
        { 
          name: 'Assignments', 
          path: '/student/homework', 
          icon: ClipboardList, 
          badge: pendingAssignmentsCount > 0 ? pendingAssignmentsCount : null
        },
        { name: 'Projects', path: '/student/projects', icon: Rocket },
        { name: 'Attendance', path: '/student/attendance', icon: CalendarCheck },
        { name: 'Results & Progress', path: '/student/progress', icon: TrendingUp },
        { name: 'Achievements', path: '/student/achievements', icon: Award },
      ]
    },
    {
      title: 'CAMPUS & ACCOUNT',
      items: [
        { name: 'Fees & Challans', path: '/student/fees', icon: Receipt },
        { 
          name: 'Notifications', 
          path: '/student/notifications', 
          icon: Bell, 
          badge: unreadCount > 0 ? unreadCount : null
        },
        { name: 'My Profile', path: '/student/profile', icon: User },
      ]
    }
  ];

  return (
    <aside className="w-64 bg-[#232168] flex flex-col h-full select-none shrink-0 shadow-xl z-30">
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
              Student Portal
            </span>
          </div>
        </div>

        {mobileClose && (
          <button
            onClick={mobileClose}
            className="p-1 rounded-lg text-white/70 hover:text-white md:hidden cursor-pointer"
            title="Close Menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Grade & Timezone Bar */}
      <div className="px-4 py-2 bg-black/15 flex items-center justify-between border-b border-white/10 text-[11px] text-white/80">
        <span className="font-medium truncate">{profile?.grade || 'Classes 1–8'}</span>
        <span className="font-semibold text-amber-300">PKT (UTC+5)</span>
      </div>

      {/* Nav List */}
      <div className="sidebar-scroll flex-1 overflow-y-auto px-3 py-3 space-y-3.5 text-xs">
        {navSections.map((section) => (
          <div key={section.title} className="space-y-1">
            <div className="px-2 pb-1 text-[10px] font-bold tracking-wider text-white/40 uppercase font-heading">
              {section.title}
            </div>
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={mobileClose}
                  className={({ isActive }) =>
                    `w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all font-medium text-xs ${
                      isActive
                        ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                        : 'text-white/85 hover:bg-white/10 hover:text-white'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="flex items-center gap-2.5 truncate">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-slate-950' : 'text-amber-300/90'
                          }`}
                        />
                        <span className="truncate">{item.name}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            isActive
                              ? 'bg-slate-950 text-amber-300'
                              : 'bg-amber-400 text-slate-950'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </div>
        ))}
      </div>

      {/* Bottom Student ID & Sign Out Strip */}
      <div className="p-3 border-t border-white/10 bg-black/20 space-y-2 mt-auto">
        <div className="flex items-center justify-between text-xs px-1">
          <span className="text-white/70 text-[11px]">Student ID:</span>
          <span className="font-bold text-white text-[11px] font-mono">
            {profile?.rollNumber || profile?.id || 'STD-001'}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs px-1">
          <span className="text-white/70 text-[11px]">Status:</span>
          <span className="text-[11px] font-bold flex items-center gap-1.5 text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Active Session
          </span>
        </div>

        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="w-full mt-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold text-red-200 hover:bg-red-500/20 hover:text-white border border-red-400/20 transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        )}
      </div>
    </aside>
  );
}
