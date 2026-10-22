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
    <div className="w-[248px] shrink-0 bg-card border-r border-border flex flex-col h-full select-none">
      {/* Brand Header */}
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-headings font-bold text-lg shadow-sm">
          N
        </div>
        <div>
          <div className="font-headings font-bold text-foreground text-sm leading-tight">
            Cambridge Education System 
          </div>
          <div className="text-xs text-muted-foreground">
            Student Portal
          </div>
        </div>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-0.5">
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
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
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
      <div className="p-3 border-t border-border mt-auto">
        <NavLink 
          to="/student/profile" 
          onClick={mobileClose}
          className="flex items-center gap-2.5 bg-muted rounded-md p-2.5 hover:bg-muted/80 transition"
        >
          <img
            src={profile.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || 'S')}&background=4f46e5&color=fff`}
            alt={profile.name}
            className="w-9 h-9 rounded-full object-cover border border-border"
            onError={(e) => {
              (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || 'S')}&background=4f46e5&color=fff`;
            }}
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground truncate">{profile.name}</div>
            <div className="text-xs text-muted-foreground">{profile.grade}</div>
          </div>
          <ChevronUp className="w-4 h-4 text-muted-foreground ml-auto" />
        </NavLink>
        {onLogout && (
          <button
            onClick={onLogout}
            className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold text-muted-foreground hover:bg-error/10 hover:text-error transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign out</span>
          </button>
        )}
      </div>
    </div>
  );
}
