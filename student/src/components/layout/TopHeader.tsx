import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, ChevronDown, Menu, Globe, Clock, Check } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState, AppDispatch } from '../../store';
import { setTimezone } from '../../store/slices/classesSlice';
import { requestApi } from '../../services/api';
import { COMMON_TIMEZONES, getBrowserTimeZone } from '../../lib/timezone';
import CommandPaletteModal from '../dialogs/CommandPaletteModal';

interface TopHeaderProps {
  pageTitle: string;
  pageSubtitle?: string;
  onToggleMobileNav: () => void;
}

export default function TopHeader({ pageTitle, pageSubtitle, onToggleMobileNav }: TopHeaderProps) {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const unreadCount = useSelector((state: RootState) => state.notifications.unreadCount);
  const profile = useSelector((state: RootState) => state.student.profile);
  const studentTz = useSelector((state: RootState) => state.classes.timezone);
  const timezoneSource = useSelector((state: RootState) => state.classes.timezoneSource);

  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showTzMenu, setShowTzMenu] = useState(false);
  const tzMenuRef = useRef<HTMLDivElement>(null);

  // Close timezone menu on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (tzMenuRef.current && !tzMenuRef.current.contains(event.target as Node)) {
        setShowTzMenu(false);
      }
    }
    if (showTzMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTzMenu]);

  const currentTzOption = COMMON_TIMEZONES.find((t) => t.value === studentTz);

  return (
    <>
      <div className="flex items-center gap-3 px-4 sm:px-6 py-2.5 bg-card border-b border-border sticky top-0 z-30">
        {/* Mobile menu hamburger */}
        <button
          onClick={onToggleMobileNav}
          className="md:hidden p-1.5 text-muted-foreground hover:text-foreground rounded-sm hover:bg-muted cursor-pointer"
          aria-label="Open mobile navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <div className="font-headings font-bold text-foreground text-lg leading-tight">
            {pageTitle}
          </div>
          <div className="text-xs text-muted-foreground hidden sm:block truncate">
            {pageSubtitle || "Here's your learning overview for today"}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* ⌘K Search Input */}
          <button
            onClick={() => setShowSearchModal(true)}
            className="hidden md:flex items-center gap-2 bg-muted rounded-sm px-2.5 py-1.5 text-xs text-muted-foreground w-[200px] lg:w-[220px] text-left hover:bg-[#ffc53a] cursor-pointer transition"
          >
            <Search className="w-3.5 h-3.5 stroke-[2.2]" />
            <span>Search lessons, files…</span>
            <span className="ml-auto text-[10px] border border-border rounded-sm px-1 bg-card">⌘K</span>
          </button>

          {/* Regional Timezone Selector */}
          <div className="relative" ref={tzMenuRef}>
            <button
              onClick={() => setShowTzMenu((prev) => !prev)}
              className="flex items-center gap-1.5 bg-muted hover:bg-[#ffc53a] border border-border rounded-sm px-2.5 py-2 text-xs font-medium text-foreground transition cursor-pointer"
              title={`Active Timezone: ${currentTzOption?.label || studentTz} (${timezoneSource === 'manual' ? 'Custom' : 'Auto-detected'})`}
              type="button"
            >
              <Clock className="w-3.5 h-3.5 text-primary stroke-[2.2]" />
              <span className="max-w-[80px] sm:max-w-[120px] truncate">
                {currentTzOption ? currentTzOption.label.split(' ')[0] : studentTz.split('/')[1] || studentTz}
              </span>
              <span className="text-[10px] font-mono px-1 py-0.2 bg-primary/10 text-primary font-bold rounded hidden sm:inline">
                {currentTzOption?.offset || 'Local'}
              </span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>

            {showTzMenu && (
              <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-card rounded-md shadow-xl border border-border z-50 overflow-hidden">
                <div className="p-3 bg-muted/50 border-b border-border flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5 text-foreground font-bold text-xs">
                      <Globe className="w-3.5 h-3.5 text-primary" />
                      <span>Regional Timezone</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Class times automatically convert to your timezone
                    </p>
                  </div>
                  {timezoneSource === 'manual' && (
                    <button
                      onClick={() => {
                        const bTz = getBrowserTimeZone();
                        dispatch(setTimezone({ timezone: bTz || 'Asia/Karachi', source: 'browser' }));
                        // Back to automatic: drop the saved manual preference
                        requestApi('/api/v1/geo/my-timezone', { method: 'DELETE' }).catch(() => undefined);
                        setShowTzMenu(false);
                      }}
                      className="text-[10px] font-bold text-primary hover:underline bg-card px-2 py-1 rounded border border-border shrink-0 cursor-pointer"
                      title="Reset to browser auto-detection"
                    >
                      Auto-Detect
                    </button>
                  )}
                </div>

                <div className="p-1 max-h-60 overflow-y-auto divide-y divide-border/30">
                  {COMMON_TIMEZONES.map((tz) => {
                    const isSelected = tz.value === studentTz;
                    return (
                      <button
                        key={tz.value}
                        onClick={() => {
                          dispatch(setTimezone({ timezone: tz.value, source: 'manual' }));
                          // Save the manual choice to the student's profile
                          requestApi('/api/v1/geo/my-timezone', {
                            method: 'PUT',
                            body: JSON.stringify({ timezone: tz.value, source: 'manual' })
                          }).catch(() => undefined);
                          setShowTzMenu(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded text-xs flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-primary text-primary-foreground font-semibold'
                            : 'hover:bg-muted text-foreground'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span>{tz.label}</span>
                          <span
                            className={`text-[10px] ${
                              isSelected ? 'text-primary-foreground/75' : 'text-muted-foreground'
                            }`}
                          >
                            {tz.value}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                              isSelected ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {tz.offset}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="p-2 bg-muted/40 border-t border-border text-[10px] text-muted-foreground flex items-center justify-between">
                  <span>School Time: Asia/Karachi (PKT)</span>
                  <span className="font-semibold text-primary">
                    {timezoneSource === 'manual' ? 'Custom Selected' : 'Auto (Detected)'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Notifications Button */}
          <button
            onClick={() => navigate('/student/notifications')}
            className="relative w-10 h-10 rounded-sm bg-muted flex items-center justify-center text-foreground hover:bg-[#ffc53a] transition cursor-pointer"
            type="button"
            aria-label="View notifications"
          >
            <Bell className="w-[18px] h-[18px] stroke-[2.2]" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-error text-white text-[10px] flex items-center justify-center font-bold">
                {unreadCount}
              </span>
            )}
          </button>

          {/* User Avatar & Menu */}
          <button
            onClick={() => navigate('/student/profile')}
            className="flex items-center gap-2 hover:opacity-90 cursor-pointer"
            aria-label="View user profile"
          >
            <img
              src={profile.avatar}
              alt={profile.name}
              className="w-10 h-10 rounded-full object-cover border border-border"
              onError={(e) => {
                (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name)}&background=4f46e5&color=fff`;
              }}
            />
            <ChevronDown className="w-4 h-4 text-muted-foreground hidden sm:block" />
          </button>
        </div>
      </div>

      <CommandPaletteModal isOpen={showSearchModal} onClose={() => setShowSearchModal(false)} />
    </>
  );
}
