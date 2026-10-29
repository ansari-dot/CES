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
    <header className="fixed top-0 left-0 lg:left-64 right-0 h-16 bg-white/95 backdrop-blur-md shadow-xs z-30 px-3 sm:px-6 flex items-center justify-between border-b border-slate-200">
      {/* Left controls: Hamburger on mobile + Class Selector */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Mobile Hamburger Menu Toggle */}
        <button
          onClick={() => dispatch(toggleMobileSidebar())}
          className="lg:hidden p-2 rounded-lg text-[#464555] hover:text-[#121c2a] hover:bg-[#eff4ff] transition-colors"
          title="Open Menu"
        >
          <span className="material-symbols-outlined text-[24px]">menu</span>
        </button>

        {/* Class Filter Selector */}
        <div className="flex items-center gap-1.5 bg-[#eff4ff] px-2.5 py-1.5 rounded-lg text-[#121c2a] border border-indigo-100/60 max-w-[180px] sm:max-w-xs">
          <span className="material-symbols-outlined text-[17px] text-[#464555] shrink-0">class</span>
          <select
            value={selectedClassId}
            onChange={(e) => dispatch(setSelectedClassId(e.target.value))}
            className="bg-transparent text-xs sm:text-sm font-semibold text-[#121c2a] focus:outline-none cursor-pointer truncate pr-1"
          >
            <option value="all">All Classes</option>
            {teacher.assignedClasses.map((cls, idx) => (
              <option key={`${cls.id}-${cls.classId || idx}`} value={cls.id}>
                {cls.name}
              </option>
            ))}
          </select>
        </div>

        {/* Global Search Bar */}
        <div className="hidden md:flex items-center gap-2 bg-[#e6eeff] px-3 py-1.5 rounded-lg w-56 lg:w-72">
          <span className="material-symbols-outlined text-[18px] text-[#464555]">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => dispatch(setSearchQuery(e.target.value))}
            placeholder="Search students, lessons, tasks..."
            className="bg-transparent text-xs sm:text-sm text-[#121c2a] placeholder:text-[#464555] focus:outline-none w-full"
          />
          {searchQuery && (
            <button
              onClick={() => dispatch(setSearchQuery(''))}
              className="text-[#777587] hover:text-[#121c2a]"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Right controls: Timezone Selector, Notifications & Teacher Identity */}
      <div className="flex items-center gap-2.5 sm:gap-4 relative">
        {/* Regional Timezone Selector */}
        <div className="relative" ref={tzMenuRef}>
          <button
            onClick={() => setIsTzOpen((prev) => !prev)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#eff4ff] hover:bg-[#e0eaff] border border-indigo-100/80 text-[#121c2a] transition-all text-xs font-semibold shadow-xs"
            title={`Timezone: ${currentTimezoneInfo ? currentTimezoneInfo.label : teacherTimezone} (${timezoneSource === 'manual' ? 'Manual Selection' : 'Auto-Detected'})`}
          >
            <span className="material-symbols-outlined text-[17px] text-[#3525cd]">schedule</span>
            <span className="max-w-[85px] sm:max-w-[130px] truncate text-[11px] sm:text-xs">
              {currentTimezoneInfo ? currentTimezoneInfo.label.split(' ')[0] : teacherTimezone.split('/')[1] || teacherTimezone}
            </span>
            <span className="text-[10px] font-mono px-1 py-0.5 rounded bg-indigo-100 text-[#3525cd] font-bold hidden sm:inline">
              {currentTimezoneInfo?.offset || 'Local'}
            </span>
            <span className="material-symbols-outlined text-[14px] text-slate-400">
              {isTzOpen ? 'expand_less' : 'expand_more'}
            </span>
          </button>

          {isTzOpen && (
            <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="p-3 bg-[#eff4ff] border-b border-slate-100 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-[#3525cd]">public</span>
                    <span className="font-bold text-xs text-[#121c2a]">Regional Timezone</span>
                  </div>
                  <p className="text-[10px] text-[#464555] mt-0.5">
                    Schedule automatically adjusts to your local time
                  </p>
                </div>
                {timezoneSource === 'manual' && (
                  <button
                    onClick={() => {
                      dispatch(detectTeacherTimezoneThunk());
                      setIsTzOpen(false);
                      dispatch(
                        addToast({
                          title: 'Reset to Auto-Detect',
                          message: 'Detecting your local regional timezone...',
                          type: 'info',
                        })
                      );
                    }}
                    className="text-[10px] font-bold text-[#3525cd] hover:underline bg-white px-2 py-1 rounded-md border border-indigo-100 shrink-0"
                    title="Auto-detect based on your current location/browser"
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
                            message: `Class schedule converted to ${tz.label} (${tz.offset})`,
                            type: 'success',
                          })
                        );
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between transition-colors ${
                        isSelected
                          ? 'bg-[#3525cd] text-white font-bold'
                          : 'hover:bg-slate-50 text-[#121c2a]'
                      }`}
                    >
                      <div className="flex flex-col">
                        <span>{tz.label}</span>
                        <span
                          className={`text-[10px] ${
                            isSelected ? 'text-indigo-200' : 'text-[#777587]'
                          }`}
                        >
                          {tz.value}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-[#464555]'
                        }`}
                      >
                        {tz.offset}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="p-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between">
                <span>School Base: Asia/Karachi (PKT)</span>
                <span className="font-semibold text-[#3525cd]">
                  {timezoneSource === 'manual' ? 'Custom' : 'Auto (Detected)'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => dispatch(toggleNotifications())}
            className="relative p-2 text-[#464555] hover:text-[#121c2a] hover:bg-[#eff4ff] rounded-lg transition-colors"
            title="Notifications"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#ba1a1a] text-white font-bold text-[10px] animate-pulse ring-2 ring-white">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown Flyout */}
          {isNotificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="p-3 bg-[#eff4ff] flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-[#121c2a]">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-[#fee2e2] text-[#991b1b] text-[10px] font-bold">
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
                    className="text-[11px] font-medium text-[#3525cd] hover:underline"
                  >
                    Mark all read
                  </button>
                  <button
                    onClick={() => dispatch(closeNotifications())}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              </div>

              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-[#777587]">
                    <span className="material-symbols-outlined text-3xl mb-1 text-slate-300">notifications_none</span>
                    <p className="text-xs font-semibold text-[#121c2a]">No notifications</p>
                    <p className="text-[11px] text-[#777587] mt-0.5">You are all caught up!</p>
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => {
                        dispatch(markNotificationAsRead(notif.id));
                        dispatch(markNotificationReadThunk(notif.id));
                        if (notif.targetTab) {
                          dispatch(setCurrentTab(notif.targetTab));
                          dispatch(closeNotifications());
                        }
                      }}
                      className={`p-3 text-left transition-colors cursor-pointer hover:bg-[#f8f9ff] ${
                        !notif.read ? 'bg-indigo-50/40' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4
                          className={`text-xs ${
                            !notif.read ? 'font-bold text-[#121c2a]' : 'font-medium text-slate-700'
                          }`}
                        >
                          {notif.title}
                        </h4>
                        <span className="text-[10px] text-[#777587] shrink-0">{notif.timestamp}</span>
                      </div>
                      <p className="text-[11px] text-[#464555] mt-1 leading-relaxed">
                        {notif.message}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile Avatar & Info */}
        <button
          onClick={() => dispatch(setCurrentTab('profile-settings'))}
          className="flex items-center gap-2 p-1 sm:p-1.5 rounded-xl hover:bg-[#eff4ff] transition-colors"
          title="Profile & Settings"
        >
          <img
            src={teacher.avatar}
            alt={teacher.name}
            className="w-8 h-8 rounded-full object-cover ring-2 ring-indigo-100"
          />
          <div className="hidden xl:flex flex-col text-left">
            <span className="font-semibold text-xs text-[#121c2a] leading-tight">
              {teacher.name}
            </span>
            <span className="text-[11px] text-[#464555] leading-tight">
              {teacher.employeeId}
            </span>
          </div>
        </button>

        {/* Quick Sign Out Action */}
        <button
          onClick={() => {
            dispatch(logout());
            dispatch(
              addToast({
                title: 'Signed Out',
                message: 'You have been safely signed out of the faculty workstation.',
                type: 'info',
              })
            );
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200/80 hover:border-rose-200 transition-all text-xs font-bold"
          title="Sign out of portal"
        >
          <span className="material-symbols-outlined text-[18px]">logout</span>
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
};
