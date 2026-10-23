import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ActiveModule } from './Sidebar';
import { Bell, RefreshCw, ChevronDown, Check, LogOut, User } from 'lucide-react';
import { OperationalNotification } from '../../types';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface HeaderProps {
  activeModule: ActiveModule;
  onSelectModule: (module: ActiveModule) => void;
  onDataReset?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeModule,
  onSelectModule,
  onDataReset
}) => {
  const { currentUser, activeSession, setActiveSession, logout } = useAuth();
  const [notifications, setNotifications] = useState<OperationalNotification[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const toast = useToast();

  const fetchNotifs = async () => {
    try {
      const data = await api.getNotifications();
      setNotifications(data);
    } catch {
      // quiet fallback
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, [activeModule]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleMarkAllRead = async () => {
    await api.markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    toast.success('All operational notifications marked as read');
  };

  const handleResetData = async () => {
    if (window.confirm('Reset all operational data back to the initial Classes 1-8 database?')) {
      setIsResetting(true);
      try {
        await api.resetDatabase();
        toast.success('Database restored to default demo state.');
        onDataReset?.();
      } catch {
        toast.error('Failed to reset database');
      } finally {
        setIsResetting(false);
      }
    }
  };

  const moduleLabels: Record<ActiveModule, { section: string; title: string }> = {
    dashboard: { section: 'Operations', title: 'Principal Executive Dashboard' },
    teachers: { section: 'Personnel', title: 'Teacher Management & Assignments' },
    students: { section: 'Personnel', title: 'Student Management & Enrolment (Classes 1–8)' },
    parents: { section: 'Personnel', title: 'Parent & Guardian Directory' },
    academics: { section: 'Academics', title: 'Academic Sessions & Subject Matrix' },
    timetable: { section: 'Academics', title: 'Online Timetable & Scheduling' },
    zoom: { section: 'Academics', title: 'Zoom Class-Link Management' },
    attendance: { section: 'Academics', title: 'Daily Attendance Oversight' },
    fees: { section: 'Financials', title: 'Fee Structures & Concessions' },
    challans: { section: 'Financials', title: 'Monthly Challans & Billing' },
    payments: { section: 'Financials', title: 'Payment Proof Verification' },
    'restricted-students': { section: 'Financials', title: 'Restricted Students & Portal Access' },
    payroll: { section: 'Financials', title: 'Teacher Payroll & Duty Review' },
    'academic-oversight': { section: 'Governance', title: 'Academic Performance & Results' },
    notices: { section: 'Governance', title: 'Official Notices & Circulars' },
    notifications: { section: 'Governance', title: 'Operational Notifications' },
    reports: { section: 'Governance', title: 'Operational Reports & Exports' },
    audit: { section: 'Governance', title: 'Immutable Audit History' },
    profile: { section: 'Settings', title: 'Principal Profile & System Boundaries' }
  };

  const currentInfo = moduleLabels[activeModule] || { section: 'Operations', title: 'Portal' };

  return (
    <header className="h-16 px-6 bg-white border-b border-slate-200/90 flex items-center justify-between gap-6 shrink-0 z-20 shadow-2xs">
      {/* Zone 1: Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs truncate">
        <span className="text-slate-400 font-medium">Principal Portal</span>
        <span className="text-slate-300" aria-hidden="true">/</span>
        <span className="text-slate-500 font-medium">{currentInfo.section}</span>
        <span className="text-slate-300" aria-hidden="true">/</span>
        <span className="text-slate-900 font-semibold truncate font-heading">{currentInfo.title}</span>
      </div>

      {/* Zone 2: Action Controls & Session Switcher */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Academic Session Switcher */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 border border-slate-200/90 text-xs">
          <span className="text-slate-500 font-medium">Session:</span>
          <select
            value={activeSession}
            onChange={(e) => setActiveSession(e.target.value)}
            className="bg-transparent text-amber-700 font-semibold focus:outline-none cursor-pointer"
          >
            <option value="2024-2025" className="bg-white text-slate-800">2024-2025 (Active)</option>
            <option value="2025-2026" className="bg-white text-slate-800">2025-2026 (Draft)</option>
            <option value="2023-2024" className="bg-white text-slate-800">2023-2024 (Archived)</option>
          </select>
        </div>

        {/* Database Reset Button */}
        <button
          onClick={handleResetData}
          disabled={isResetting}
          title="Reset database to default seed state"
          className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin text-amber-600' : ''}`} />
        </button>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="relative p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-3.5 h-3.5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center font-mono shadow-xs">
                {unreadCount}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50">
              <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                <span className="text-xs font-semibold text-slate-900">Operational Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] text-amber-600 hover:underline flex items-center gap-1 font-medium"
                  >
                    <Check className="w-3 h-3" />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    No operational alerts.
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        api.markNotificationAsRead(notif.id);
                        if (notif.relatedRecordType === 'PaymentProof') onSelectModule('payments');
                        else if (notif.relatedRecordType === 'ZoomMeeting') onSelectModule('zoom');
                        else if (notif.relatedRecordType === 'Attendance' || notif.relatedRecordType === 'AttendanceCorrection') onSelectModule('attendance');
                        else if (notif.relatedRecordType === 'Payroll') onSelectModule('payroll');
                        setIsNotifOpen(false);
                      }}
                      className={`p-3 text-xs hover:bg-slate-50 cursor-pointer transition-colors ${
                        notif.isRead ? 'opacity-60' : 'bg-amber-50/20'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                        <span className="font-semibold text-amber-700">{notif.type}</span>
                        <span className="font-mono text-[10px]">
                          {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-700 leading-snug">{notif.message}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="p-2 border-t border-slate-100 bg-slate-50/60 text-center">
                <button
                  onClick={() => {
                    onSelectModule('notifications');
                    setIsNotifOpen(false);
                  }}
                  className="text-xs text-slate-600 hover:text-slate-900 font-medium"
                >
                  View full notifications log
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Zone 3: Principal Profile Chip & Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsProfileOpen(!isProfileOpen)}
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors text-left shadow-2xs"
          >
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 font-bold text-xs flex items-center justify-center shrink-0 border border-amber-200">
              TM
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-slate-800 leading-tight truncate font-heading">
                {currentUser?.name || 'Dr. Tariq Mahmood'}
              </span>
              <span className="text-[10px] text-slate-500 leading-tight">
                Principal
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Profile Menu Dropdown */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-slate-200/90 shadow-xl py-2 z-50 animate-in fade-in zoom-in-95">
              <div className="px-4 py-2.5 border-b border-slate-100">
                <div className="text-xs font-bold text-slate-800 font-heading">
                  {currentUser?.name || 'Dr. Tariq Mahmood'}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {currentUser?.email || 'principal@iqraonlineacademy.edu.pk'}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-emerald-700 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Authenticated Principal Session
                </div>
              </div>

              <div className="p-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    onSelectModule('profile');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left"
                >
                  <User className="w-4 h-4 text-slate-400" />
                  <span>Profile & Security Controls</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-rose-600 hover:bg-rose-50 transition-colors text-left font-medium"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  <span>Sign Out of Portal</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Dedicated Fast Sign Out Button */}
        <button
          type="button"
          onClick={logout}
          title="Sign Out of Principal Portal"
          className="p-2 rounded-lg border border-slate-200 hover:border-rose-200 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors shadow-2xs"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
