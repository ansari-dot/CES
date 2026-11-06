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
  X
} from 'lucide-react';
import { useParent } from '../context/ParentContext';
import { Toast } from './common';

interface NavSection {
  title: string;
  items: {
    name: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'OVERVIEW',
    items: [
      { name: 'Dashboard', path: '/parent/dashboard', icon: LayoutDashboard }
    ]
  },
  {
    title: 'ACADEMICS & PROGRESS',
    items: [
      { name: 'Attendance', path: '/parent/attendance', icon: CalendarCheck },
      { name: 'Assignments', path: '/parent/assignments', icon: ClipboardList },
      { name: 'Results & Progress', path: '/parent/results', icon: TrendingUp },
      { name: 'Achievements & Feedback', path: '/parent/achievements', icon: Award }
    ]
  },
  {
    title: 'CAMPUS & FAMILY',
    items: [
      { name: 'Fees & Challans', path: '/parent/fees', icon: Receipt },
      { name: 'Notices & Circulars', path: '/parent/notices', icon: Bell },
      { name: 'My Profile', path: '/parent/profile', icon: User }
    ]
  }
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
              Parent Portal
            </span>
          </div>
        </div>

        {onNavigate && (
          <button
            onClick={onNavigate}
            className="p-1 rounded-lg text-white/70 hover:text-white md:hidden cursor-pointer"
            title="Close Menu"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Subheader bar */}
      <div className="px-4 py-2 bg-black/15 flex items-center justify-between border-b border-white/10 text-[11px] text-white/80">
        <span className="font-medium truncate">
          {dashboard?.children?.length
            ? `${dashboard.children.length} linked ${dashboard.children.length === 1 ? 'child' : 'children'}`
            : 'Family Portal'}
        </span>
        <span className="font-semibold text-amber-300">PKT (UTC+5)</span>
      </div>

      {/* Nav List */}
      <div className="sidebar-scroll flex-1 overflow-y-auto px-3 py-3 space-y-3.5 text-xs">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="space-y-1">
            <div className="px-2 pb-1 text-[10px] font-bold tracking-wider text-white/40 uppercase font-heading">
              {section.title}
            </div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const badge = item.path === '/parent/notices' && unreadCount > 0 ? unreadCount : null;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onNavigate}
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
                      {badge && (
                        <span
                          className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                            isActive
                              ? 'bg-slate-950 text-amber-300'
                              : 'bg-amber-400 text-slate-950'
                          }`}
                        >
                          {badge}
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

      {/* Bottom Parent & Sign Out Strip */}
      <div className="p-3 border-t border-white/10 bg-black/20 space-y-2 mt-auto">
        <div className="flex items-center justify-between text-xs px-1">
          <span className="text-white/70 text-[11px]">Parent Account:</span>
          <span className="font-bold text-white text-[11px] truncate max-w-[120px] text-right font-mono">
            {name}
          </span>
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
          onClick={onLogout}
          className="w-full mt-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold text-red-200 hover:bg-red-500/20 hover:text-white border border-red-400/20 transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
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
              className="relative w-10 h-10 rounded-sm bg-muted flex items-center justify-center text-foreground hover:bg-[#ffc53a] transition cursor-pointer"
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
