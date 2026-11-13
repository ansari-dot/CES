import React, { useState, useRef, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { setSelectedClassId, logout } from '../../store/slices/authSlice';
import {
  setSearchQuery,
  toggleNotifications,
  closeNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  markNotificationReadThunk,
  markAllNotificationsReadThunk,
  setCurrentTab,
  toggleMobileSidebar,
  addToast,
} from '../../store/slices/uiSlice';
import { changeTeacherTimezoneThunk, detectTeacherTimezoneThunk } from '../../store/slices/timetableSlice';
import { COMMON_TIMEZONES } from '../../lib/timezone';
import {
  Menu,
  Search,
  Clock,
  Globe,
  Bell,
  ChevronDown,
  ChevronUp,
  X,
  Layers,
  LogOut,
  User,
  CheckCircle2
} from 'lucide-react';

export const Header: React.FC = () => {
  const dispatch = useAppDispatch();
  const teacher = useAppSelector((state) => state.auth.teacher);
  const selectedClassId = useAppSelector((state) => state.auth.selectedClassId);
  const searchQuery = useAppSelector((state) => state.ui.searchQuery);
  const isNotificationsOpen = useAppSelector((state) => state.ui.isNotificationsOpen);
  const notifications = useAppSelector((state) => state.ui.notifications);
  const teacherTimezone = useAppSelector((state) => state.timetable.timezone);
  const timezoneSource = useAppSelector((state) => state.timetable.timezoneSource);

  const [isTzOpen, setIsTzOpen] = useState(false);
  const tzMenuRef = useRef<HTMLDivElement>(null);

  // Close timezone menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tzMenuRef.current && !tzMenuRef.current.contains(event.target as Node)) {
        setIsTzOpen(false);
      }
    }
    if (isTzOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTzOpen]);

  const currentTimezoneInfo = COMMON_TIMEZONES.find((t) => t.value === teacherTimezone);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="fixed top-0 left-0 lg:left-60 right-0 h-16 bg-white/95 backdrop-blur-md shadow-xs z-30 px-3 sm:px-6 flex items-center justify-between border-b border-slate-200">
      {/* Left controls: Hamburger on mobile + Class Selector */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Mobile Hamburger Menu Toggle */}
        <button
          onClick={() => dispatch(toggleMobileSidebar())}
          className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          title="Open Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Class Filter Selector */}
        <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl text-slate-800 border border-slate-200 max-w-[180px] sm:max-w-xs">
          <Layers className="w-4 h-4 text-indigo-600 shrink-0" />
          <select
            value={selectedClassId}
            onChange={(e) => dispatch(setSelectedClassId(e.target.value))}
            className="bg-transparent text-xs sm:text-sm font-semibold text-slate-900 focus:outline-hidden cursor-pointer truncate pr-1"
          >
            <option value="all">All Classes</option>
            {teacher.assignedClasses.map((cls, idx) => (
              <option key={`hdr-cls-${cls.id || cls.classId || idx}-${idx}`} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>

        {/* Global Search Bar */}
        <div className="hidden md:flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-xl w-56 lg:w-72 border border-slate-200">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => dispatch(setSearchQuery(e.target.value))}
            placeholder="Search classes, tasks..."
            className="bg-transparent text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden w-full"
          />
          {searchQuery && (
            <button
              onClick={() => dispatch(setSearchQuery(''))}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Right controls: Timezone Selector, Notifications & Teacher Identity */}
      <div className="flex items-center gap-2 sm:gap-3.5 relative">
        {/* Regional Timezone Selector */}
        <div className="relative" ref={tzMenuRef}>
          <button
            onClick={() => setIsTzOpen((prev) => !prev)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 transition-all text-xs font-semibold shadow-xs"
            title={`Timezone: ${currentTimezoneInfo ? currentTimezoneInfo.label : teacherTimezone}`}
          >
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            <span className="max-w-[85px] sm:max-w-[130px] truncate text-[11px] sm:text-xs">
              {currentTimezoneInfo ? currentTimezoneInfo.label.split(' ')[0] : teacherTimezone.split('/')[1] || teacherTimezone}
            </span>
            <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-indigo-100 text-indigo-900 font-bold hidden sm:inline">
              {currentTimezoneInfo?.offset || 'Local'}
            </span>
            {isTzOpen ? (
              <ChevronUp className="w-3 h-3 text-slate-400" />
            ) : (
              <ChevronDown className="w-3 h-3 text-slate-400" />
            )}
          </button>

          {isTzOpen && (
            <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in duration-150">
              <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-indigo-600" />
                    <span className="font-bold text-xs text-slate-900">Regional Timezone</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    Schedule automatically aligns to your clock
                  </p>
                </div>
                {timezoneSource === 'manual' && (
                  <button
                    onClick={() => {
                      dispatch(detectTeacherTimezoneThunk({ reset: true }));
                      setIsTzOpen(false);
                      dispatch(
                        addToast({
                          title: 'Reset to Auto-Detect',
                          message: 'Detecting your local regional timezone...',
                          type: 'info',
                        })
                      );
                    }}
                    className="text-[10px] font-bold text-indigo-700 hover:underline bg-white px-2 py-1 rounded-md border border-slate-200 shrink-0"
                  >
                    Auto-Detect
                  </button>
                )}
              </div>

              <div className="p-1.5 max-h-64 overflow-y-auto divide-y divide-slate-50">
                {COMMON_TIMEZONES.map((tz) => {
                  const isSelected = tz.value === teacherTimezone;
                  return (
                    <button
                      key={tz.value}
                      onClick={() => {
                        dispatch(changeTeacherTimezoneThunk({ timezone: tz.value, source: 'manual' }));
                        setIsTzOpen(false);
                        dispatch(
                          addToast({
                            title: 'Timezone Updated',
                            message: `Class schedule converted to ${tz.label}`,
                            type: 'success',
                          })
                        );
                      }}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'bg-amber-400 text-slate-950 font-bold'
                          : 'hover:bg-slate-50 text-slate-800'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span>{tz.label}</span>
                        <span className={`text-[10px] ${isSelected ? 'text-slate-800' : 'text-slate-400'}`}>
                          {tz.value}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-black/10">
                        {tz.offset}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => dispatch(toggleNotifications())}
            className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors"
            title="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white font-bold text-[10px] ring-2 ring-white">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Flyout */}
          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in duration-150">
              <div className="p-3 bg-slate-50 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                      {unreadCount} New
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      dispatch(markAllNotificationsAsRead());
                      dispatch(markAllNotificationsReadThunk());
                    }}
                    className="text-[11px] font-medium text-indigo-700 hover:underline"
                  >
                    Mark all read
                  </button>
                  <button
                    onClick={() => dispatch(closeNotifications())}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">
                    <Bell className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                    <p className="text-xs font-semibold">No notifications right now</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        dispatch(markNotificationAsRead(n.id));
                        dispatch(markNotificationReadThunk(n.id));
                        if (n.targetTab) {
                          dispatch(setCurrentTab(n.targetTab));
                          dispatch(closeNotifications());
                        }
                      }}
                      className={`p-3 text-xs hover:bg-slate-50 transition-colors cursor-pointer ${
                        !n.read ? 'bg-indigo-50/50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                        <span className="font-bold text-indigo-700">{n.category}</span>
                        <span>{n.timeAgo}</span>
                      </div>
                      <h4 className="font-bold text-slate-900 leading-snug">{n.title}</h4>
                      <p className="text-slate-600 text-[11px] mt-0.5 line-clamp-2">{n.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Avatar & Name */}
        <div
          onClick={() => dispatch(setCurrentTab('profile-settings'))}
          className="flex items-center gap-2 pl-2 border-l border-slate-200 cursor-pointer group"
          title="Account Settings"
        >
          <img
            src={teacher.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
            alt={teacher.name}
            className="w-8 h-8 rounded-full object-cover ring-2 ring-slate-200 group-hover:ring-indigo-500 transition-all shrink-0"
          />
          <div className="hidden sm:flex flex-col">
            <span className="text-xs font-bold text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors">
              {teacher.name.split(',')[0]}
            </span>
            <span className="text-[10px] text-slate-500 font-medium">Faculty Member</span>
          </div>
        </div>
      </div>
    </header>
  );
};
