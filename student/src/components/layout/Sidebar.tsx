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
  ChevronUp,
  LogOut
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
    { 
      name: "Assignments", 
      path: "/student/homework", 
      icon: ClipboardList, 
      badge: pendingAssignmentsCount > 0 ? pendingAssignmentsCount : null,
      badgeColor: "bg-warning-bg text-warning"
    },
    { name: "Projects", path: "/student/projects", icon: Rocket },
    { name: "Attendance", path: "/student/attendance", icon: CalendarCheck },
    { name: "Results & Progress", path: "/student/progress", icon: TrendingUp },
    { name: "Achievements", path: "/student/achievements", icon: Award },
    { name: "Fees & Challans", path: "/student/fees", icon: Receipt },
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
    <div className="w-[248px] shrink-0 bg-primary flex flex-col h-full select-none">
      {/* Brand Header */}
      <div className="flex flex-col items-center gap-2.5 px-5 pt-6 pb-5 border-b border-white/15">
        <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-md overflow-hidden">
          <img src="/logo.jpeg" alt="Cambridge Education System logo" className="w-full h-full object-contain" />
        </div>
        <div className="text-center">
          <div className="font-headings font-bold text-white text-sm leading-tight">
            Cambridge Education System
          </div>
          <div className="text-xs text-white/70">
            Student Portal
          </div>
        </div>
      </div>

      {/* Nav List */}
      <div className="sidebar-scroll flex-1 overflow-y-auto px-3 pt-3 pb-3 flex flex-col gap-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={mobileClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-secondary text-secondary-foreground font-bold shadow-sm"
                    : "text-white/85 hover:bg-secondary hover:text-secondary-foreground"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="w-1 h-5 rounded-full bg-primary -ml-1 mr-0" />}
                  <Icon className="w-[17px] h-[17px] shrink-0 stroke-[2.2]" />
                  <span className="truncate">{item.name}</span>
                  {item.badge && (
                    <span className={`ml-auto w-5 h-5 rounded-full ${item.badgeColor} text-xs flex items-center justify-center font-bold`}>
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
      <div className="p-3 border-t border-white/15 mt-auto">
        <NavLink
          to="/student/profile"
          onClick={mobileClose}
          className="group flex items-center gap-2.5 bg-white/10 rounded-md p-2.5 hover:bg-[#ffc53a] transition"
        >
          <img
            src={profile.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || 'S')}&background=36348e&color=fff`}
            alt={profile.name}
            className="w-9 h-9 rounded-full object-cover border border-white/30"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || 'S')}&background=36348e&color=fff`;
            }}
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white group-hover:text-[#1b1a47] truncate">{profile.name}</div>
            <div className="text-xs text-white/70 group-hover:text-[#1b1a47]/80">{profile.grade}</div>
          </div>
          <ChevronUp className="w-4 h-4 text-white/70 group-hover:text-[#1b1a47] ml-auto" />
        </NavLink>
        {onLogout && (
          <button
            onClick={onLogout}
            className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold text-white/80 hover:bg-[#ffc53a] hover:text-[#1b1a47] transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        )}
      </div>
    </div>
  );
}
