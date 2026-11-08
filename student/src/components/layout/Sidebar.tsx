import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  CalendarDays, 
  Video, 
  FolderOpen, 
  ClipboardList, 
  FileCheck,
  CalendarRange,
  Rocket, 
  CalendarCheck, 
  TrendingUp, 
  Award,
  Bell,
  User,
  ChevronUp,
  LogOut,
  ScrollText
} from 'lucide-react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

interface SidebarProps {
  mobileClose?: () => void;
  onLogout?: () => void;
}

export default function Sidebar({ mobileClose, onLogout }: SidebarProps) {
  const unreadCount = useSelector((state: RootState) => state.notifications.unreadCount);
  const pendingAssignmentsCount = useSelector((state: RootState) => 
    state.assignments.items.filter(a => a.status === 'Pending').length
  );
  const profile = useSelector((state: RootState) => state.student.profile);

  const navItems = [
    { name: "Dashboard", path: "/student/dashboard", icon: LayoutDashboard },
    { name: "My Timetable", path: "/student/timetable", icon: CalendarDays },
    { name: "Live Classes", path: "/student/classes", icon: Video },
    { name: "Learning Resources", path: "/student/learning", icon: FolderOpen },
    { name: "Tests & Examinations", path: "/student/tests", icon: FileCheck },
    { name: "Date Sheet", path: "/student/datesheet", icon: CalendarRange },
    { 
      name: "Assignments", 
      path: "/student/homework", 
      icon: ClipboardList, 
      badge: pendingAssignmentsCount > 0 ? pendingAssignmentsCount : null,
      badgeColor: "bg-warning-bg text-warning"
    },
    { name: "Projects", path: "/student/projects", icon: Rocket },
    { name: "Attendance", path: "/student/attendance", icon: CalendarCheck },
    { name: "Academic Progress", path: "/student/progress", icon: TrendingUp },
    { name: "Results", path: "/student/results", icon: ScrollText },
    { name: "Achievements", path: "/student/achievements", icon: Award },
    { 
      name: "Notifications", 
      path: "/student/notifications", 
      icon: Bell, 
      badge: unreadCount > 0 ? unreadCount : null,
      badgeColor: "bg-error text-white"
    },
    { name: "My Profile", path: "/student/profile", icon: User },
  ];

  return (
    <div className="w-[240px] shrink-0 bg-primary flex flex-col h-full select-none">
      {/* Brand Header */}
      <div className="flex flex-col items-center gap-2 px-4 pt-4 pb-3 border-b border-white/15">
        <div className="w-13 h-13 rounded-full bg-white flex items-center justify-center shadow-xs overflow-hidden shrink-0">
          <img
            src="/logowb.png"
            alt="Cambridge Education System logo"
            className="w-full h-full object-contain"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/logo.jpeg';
            }}
          />
        </div>
        <div className="text-center">
          <div className="font-headings font-bold text-white text-xs leading-tight">
            Cambridge Education System
          </div>
          <div className="text-[11px] text-white/70">
            Student Portal
          </div>
        </div>
      </div>

      {/* Nav List */}
      <div className="sidebar-scroll flex-1 overflow-y-auto px-2.5 pt-2 pb-2 flex flex-col gap-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={mobileClose}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-secondary text-secondary-foreground font-bold shadow-xs"
                    : "text-white/85 hover:bg-secondary hover:text-secondary-foreground"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="w-1 h-4 rounded-full bg-primary -ml-1 mr-0" />}
                  <Icon className="w-4 h-4 shrink-0 stroke-[2.2]" />
                  <span className="truncate">{item.name}</span>
                  {item.badge && (
                    <span className={`ml-auto min-w-4 h-4 px-1 rounded-full ${item.badgeColor} text-[10px] flex items-center justify-center font-bold`}>
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Profile Footer */}
      <div className="p-2.5 border-t border-white/15 mt-auto">
        <NavLink
          to="/student/profile"
          onClick={mobileClose}
          className="group flex items-center gap-2 bg-white/10 rounded-md p-2 hover:bg-[#ffc53a] transition"
        >
          <img
            src={profile.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || 'S')}&background=36348e&color=fff`}
            alt={profile.name}
            className="w-8 h-8 rounded-full object-cover border border-white/30 shrink-0"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || 'S')}&background=36348e&color=fff`;
            }}
          />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-white group-hover:text-[#1b1a47] truncate">{profile.name}</div>
            <div className="text-[11px] text-white/70 group-hover:text-[#1b1a47]/80 truncate">{profile.grade}</div>
          </div>
          <ChevronUp className="w-3.5 h-3.5 text-white/70 group-hover:text-[#1b1a47] ml-auto shrink-0" />
        </NavLink>
        {onLogout && (
          <button
            onClick={onLogout}
            className="mt-1.5 w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold text-white/80 hover:bg-[#ffc53a] hover:text-[#1b1a47] transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out</span>
          </button>
        )}
      </div>
    </div>
  );
}
