import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarCheck,
  Receipt,
  TrendingUp,
  ClipboardList,
  Award,
  Bell,
  User,
  LogOut,
  Menu,
  Users,
} from 'lucide-react';
import { useParent } from '../context/ParentContext';
import { Toast } from './common';

const NAV_ITEMS = [
  { name: 'Dashboard', path: '/parent/dashboard', icon: LayoutDashboard },
  { name: 'Attendance', path: '/parent/attendance', icon: CalendarCheck },
  { name: 'Fees & Challans', path: '/parent/fees', icon: Receipt },
  { name: 'Results & Progress', path: '/parent/results', icon: TrendingUp },
  { name: 'Assignments', path: '/parent/assignments', icon: ClipboardList },
  { name: 'Achievements & Feedback', path: '/parent/achievements', icon: Award },
  { name: 'Notices & Circulars', path: '/parent/notices', icon: Bell },
  { name: 'My Profile', path: '/parent/profile', icon: User },
];

const PAGE_INFO: Record<string, { title: string; subtitle: string }> = {
  '/parent/dashboard': { title: 'Family Overview', subtitle: "Your children's school activity at a glance" },
  '/parent/attendance': { title: 'Attendance', subtitle: 'Recorded by teachers for each lesson' },
  '/parent/fees': { title: 'Fees & Challans', subtitle: 'Amounts in Pakistani rupees (Rs.)' },
  '/parent/results': { title: 'Results & Progress', subtitle: 'Only results published by teachers are shown' },
  '/parent/assignments': { title: 'Assignments & Assessments', subtitle: 'Submission status, marks and teacher feedback' },
  '/parent/achievements': { title: 'Achievements & Feedback', subtitle: 'Recognition and comments from teachers' },
  '/parent/notices': { title: 'Notices & Circulars', subtitle: 'Announcements from the school and your children\'s teachers' },
  '/parent/profile': { title: 'My Profile', subtitle: 'Account details and password' },
};

function Sidebar({ onNavigate, onLogout }: { onNavigate?: () => void; onLogout: () => void }) {
  const { user, unreadCount, dashboard } = useParent();
  const name = user?.fullName || 'Parent';

  return (
    <div className="w-[248px] shrink-0 bg-card border-r border-border flex flex-col h-full select-none">
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-headings font-bold text-lg shadow-sm">
          N
        </div>
        <div>
          <div className="font-headings font-bold text-foreground text-sm leading-tight">Cambridge Education System</div>
          <div className="text-xs text-muted-foreground">Parent Portal</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const badge = item.path === '/parent/notices' && unreadCount > 0 ? unreadCount : null;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="w-1 h-5 rounded-full bg-primary -ml-1 mr-0" />}
                  <Icon className="w-[17px] h-[17px] shrink-0 stroke-[2.2]" />
                  <span className="truncate">{item.name}</span>
                  {badge && (
                    <span className="ml-auto w-5 h-5 rounded-full bg-error text-white text-xs flex items-center justify-center font-bold">
                      {badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </div>

      <div className="p-3 border-t border-border mt-auto">
        <NavLink
          to="/parent/profile"
          onClick={onNavigate}
          className="flex items-center gap-2.5 bg-muted rounded-md p-2.5 hover:bg-muted/80 transition"
        >
          <img
            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4f46e5&color=fff`}
            alt={name}
            className="w-9 h-9 rounded-full object-cover border border-border"
          />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-foreground truncate">{name}</div>
            <div className="text-xs text-muted-foreground">
              {dashboard ? `${dashboard.children.length} linked ${dashboard.children.length === 1 ? 'child' : 'children'}` : 'Parent / Guardian'}
            </div>
          </div>
        </NavLink>
        <button
          onClick={onLogout}
          className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold text-muted-foreground hover:bg-error/10 hover:text-error transition cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}

export default function PortalLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, children, selectedChild, selectChild, unreadCount, dashboard } = useParent();

  const info = PAGE_INFO[location.pathname] || { title: 'Parent Portal', subtitle: 'Cambridge Education System' };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex bg-background min-h-screen w-full">
      <div className="hidden md:block h-screen sticky top-0 print:hidden">
        <Sidebar onLogout={handleLogout} />
      </div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-navy/60 backdrop-blur-xs" onClick={() => setMobileNavOpen(false)} />
          <div className="relative z-10 h-full">
            <Sidebar onNavigate={() => setMobileNavOpen(false)} onLogout={handleLogout} />
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-4 px-6 md:px-8 py-4 bg-card border-b border-border sticky top-0 z-30 print:hidden">
          <button
            onClick={() => setMobileNavOpen(true)}
            className="md:hidden p-2 text-muted-foreground hover:text-foreground rounded-sm hover:bg-muted cursor-pointer"
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0">
            <div className="font-headings font-bold text-foreground text-xl leading-tight">{info.title}</div>
            <div className="text-sm text-muted-foreground hidden sm:block truncate">{info.subtitle}</div>
          </div>

          <div className="ml-auto flex items-center gap-3">
            {children.length > 0 && (
              <label className="flex items-center gap-2 bg-muted border border-border rounded-sm px-2.5 py-1.5 text-xs font-medium text-foreground">
                <Users className="w-3.5 h-3.5 text-primary stroke-[2.2]" />
                <span className="hidden sm:inline text-muted-foreground">Viewing</span>
                <select
                  value={selectedChild?.studentId ?? ''}
                  onChange={(e) => selectChild(Number(e.target.value))}
                  className="bg-transparent font-semibold focus:outline-none cursor-pointer max-w-[160px] truncate"
                  aria-label="Select child"
                >
                  {children.map((c) => (
                    <option key={c.studentId} value={c.studentId}>
                      {c.studentName} · {c.className}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <button
              onClick={() => navigate('/parent/notices')}
              className="relative w-10 h-10 rounded-sm bg-muted flex items-center justify-center text-foreground hover:bg-muted/80 transition cursor-pointer"
              aria-label="View notices"
            >
              <Bell className="w-[18px] h-[18px] stroke-[2.2]" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-error text-white text-[10px] flex items-center justify-center font-bold">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <main className="p-4 sm:p-6 lg:p-8 max-w-[1080px] w-full mx-auto flex flex-col gap-6 print:p-0 print:max-w-none">
          {dashboard && dashboard.parent.verificationStatus !== 'APPROVED' && (
            <div className="bg-warning-bg border border-warning/30 rounded-md px-4 py-3 text-xs text-foreground print:hidden">
              {dashboard.parent.verificationStatus === 'REJECTED'
                ? 'Your parent account verification was not approved. Please contact the school office.'
                : 'Your parent account is awaiting verification by the school. Linked children will appear once it is approved.'}
            </div>
          )}
          <Outlet />
        </main>
      </div>

      <Toast />
    </div>
  );
}
