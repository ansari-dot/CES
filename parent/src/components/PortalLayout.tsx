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
  LogOut,
  Menu,
  Settings,
  Users,
} from 'lucide-react';
import { useParent } from '../context/ParentContext';
import { Toast } from './common';
import { useSectionBadges } from '../hooks/useSectionBadges';
import { badgeLabel } from '../lib/sectionBadges';

const NAV_ITEMS = [
  { name: 'Dashboard', path: '/parent/dashboard', icon: LayoutDashboard },
  { name: 'Attendance', path: '/parent/attendance', icon: CalendarCheck },
  { name: 'Fees & Challans', path: '/parent/fees', icon: Receipt },
  { name: 'Results & Progress', path: '/parent/results', icon: TrendingUp },
  { name: 'Assignments', path: '/parent/assignments', icon: ClipboardList },
  { name: 'Achievements & Feedback', path: '/parent/achievements', icon: Award },
  { name: 'Notices & Circulars', path: '/parent/notices', icon: Bell },
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
  const { user, dashboard } = useParent();
  const navigate = useNavigate();
  const location = useLocation();
  const name = user?.fullName || 'Parent';
  // New activity about the children per sidebar section (amber mini counters)
  const activityCounts = useSectionBadges();
  const childCount = dashboard?.children.length ?? null;
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=36348e&color=fff`;

  const openSettings = () => {
    navigate('/parent/profile');
    onNavigate?.();
  };

  return (
    <aside className="h-full w-56 shrink-0 bg-gradient-to-b from-[#191847] via-[#211f5d] to-[#131236] shadow-2xl lg:shadow-none border-r border-white/10 select-none flex flex-col relative">
      <div className="h-full overflow-y-auto flex flex-col sidebar-scroll">
        {/* Brand header (same scale as the student and teacher portals) */}
        <div className="flex flex-col items-center text-center px-3 pt-4 pb-2.5 border-b border-white/10 select-none shrink-0">
          <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-xs p-1 overflow-hidden mb-1.5 border border-white/20 shrink-0">
            <img
              src="/logowb.png"
              alt="Cambridge Education System logo"
              className="w-full h-full object-contain drop-shadow-2xs"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/logo.jpeg';
              }}
            />
          </div>
          <h2 className="text-xs font-bold tracking-tight text-white font-headings">Cambridge Education System</h2>
          <p className="text-[9px] font-semibold tracking-wider text-white/70 uppercase font-headings mt-0.5">Parent Portal</p>
        </div>

        {/* Navigation */}
        <nav className="px-2.5 py-1.5 space-y-0.5 text-xs flex-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const count = activityCounts[item.path] || 0;
            const badge = count > 0 ? badgeLabel(count) : null;
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onNavigate}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg font-semibold text-xs transition-all duration-150 cursor-pointer text-left group ${
                  isActive
                    ? 'bg-gradient-to-r from-[#2563eb] to-[#3b82f6] text-white shadow-md shadow-blue-500/30 border border-blue-400/30'
                    : 'text-slate-200/90 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition-transform duration-150 ${
                    isActive ? 'text-white scale-105' : 'text-slate-300 group-hover:text-white'
                  }`}
                />
                <span className="truncate flex-1 tracking-tight font-medium">{item.name}</span>
                {badge && (
                  <span className="px-1.5 min-w-[18px] h-4 rounded-full flex items-center justify-center text-[10px] font-bold tracking-tight shrink-0 shadow-2xs bg-amber-500 text-slate-950">
                    {badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Profile bar + campus banner (same as the student and teacher portals) */}
        <div className="px-2.5 pt-3 pb-3 space-y-2 select-none border-t border-white/10 mt-2">
          <div className="rounded-lg bg-white/5 border border-white/10 p-2 flex items-center justify-between gap-2 hover:bg-white/10 transition">
            <div onClick={openSettings} className="flex items-center gap-2 min-w-0 cursor-pointer flex-1 group">
              <div className="relative shrink-0">
                <img src={avatarUrl} alt={name} className="w-7 h-7 rounded-full object-cover border border-white/30" />
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 border border-[#191847]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white group-hover:text-blue-300 truncate leading-tight">{name}</p>
                <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                  Parent
                  {childCount !== null ? ` · ${childCount} ${childCount === 1 ? 'child' : 'children'}` : ''}
                </p>
              </div>
            </div>

            {/* Settings: opens the profile & settings page */}
            <button
              type="button"
              onClick={openSettings}
              title="Profile & settings"
              aria-label="Profile and settings"
              className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-white/15 transition cursor-pointer shrink-0"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>

            {/* Logout button */}
            <button
              type="button"
              onClick={onLogout}
              title="Sign out"
              aria-label="Sign out"
              className="p-1 rounded-md text-slate-300 hover:text-white hover:bg-white/15 transition cursor-pointer shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="relative h-22 sm:h-24 w-full overflow-hidden rounded-lg border border-white/10 group">
            <img
              src="/loginbc.webp"
              alt="Cambridge Education System Campus"
              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-1 inset-x-0 text-center pointer-events-none">
              <span className="text-[9px] font-bold text-white/95 tracking-widest uppercase drop-shadow-sm">Cambridge Campus</span>
            </div>
          </div>
        </div>
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
