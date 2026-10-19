import React from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { setSelectedClassId, logout } from '../../store/slices/authSlice';
import {
  setSearchQuery,
  toggleNotifications,
  closeNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  setCurrentTab,
  toggleMobileSidebar,
  addToast,
} from '../../store/slices/uiSlice';

export const Header: React.FC = () => {
  const dispatch = useAppDispatch();
  const teacher = useAppSelector((state) => state.auth.teacher);
  const selectedClassId = useAppSelector((state) => state.auth.selectedClassId);
  const searchQuery = useAppSelector((state) => state.ui.searchQuery);
  const isNotificationsOpen = useAppSelector((state) => state.ui.isNotificationsOpen);
  const notifications = useAppSelector((state) => state.ui.notifications);

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
            {teacher.assignedClasses.map((cls) => (
              <option key={cls.id} value={cls.id}>
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

      {/* Right controls: Notifications & Teacher Identity */}
      <div className="flex items-center gap-4 relative">
        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => dispatch(toggleNotifications())}
            className="relative p-2 text-[#464555] hover:text-[#121c2a] hover:bg-[#eff4ff] rounded-lg transition-colors"
            title="Notifications"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#ba1a1a] text-white font-bold text-[10px]">
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
                    onClick={() => dispatch(markAllNotificationsAsRead())}
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
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      dispatch(markNotificationAsRead(notif.id));
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
                ))}
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
