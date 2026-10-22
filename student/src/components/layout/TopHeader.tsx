import React, { useState } from 'react';
import { Search, Bell, ChevronDown, Menu } from 'lucide-react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../../store';
import CommandPaletteModal from '../dialogs/CommandPaletteModal';

interface TopHeaderProps {
  pageTitle: string;
  pageSubtitle?: string;
  onToggleMobileNav: () => void;
}

export default function TopHeader({ pageTitle, pageSubtitle, onToggleMobileNav }: TopHeaderProps) {
  const navigate = useNavigate();
  const unreadCount = useSelector((state: RootState) => state.notifications.unreadCount);
  const profile = useSelector((state: RootState) => state.student.profile);
  const [showSearchModal, setShowSearchModal] = useState(false);

  return (
    <>
      <div className="flex items-center gap-4 px-6 md:px-8 py-4 bg-card border-b border-border sticky top-0 z-30">
        {/* Mobile menu hamburger */}
        <button
          onClick={onToggleMobileNav}
          className="md:hidden p-2 text-muted-foreground hover:text-foreground rounded-sm hover:bg-muted cursor-pointer"
          aria-label="Open mobile navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <div className="font-headings font-bold text-foreground text-xl leading-tight">
            {pageTitle}
          </div>
          <div className="text-sm text-muted-foreground hidden sm:block truncate">
            {pageSubtitle || "Here's your learning overview for today · Mon, 19 Oct 2026"}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {/* ⌘K Search Input */}
          <button
            onClick={() => setShowSearchModal(true)}
            className="hidden md:flex items-center gap-2 bg-muted rounded-sm px-3 py-2 text-sm text-muted-foreground w-[240px] text-left hover:bg-muted/80 cursor-pointer transition"
          >
            <Search className="w-4 h-4 stroke-[2.2]" />
            <span>Search lessons, files…</span>
            <span className="ml-auto text-xs border border-border rounded-sm px-1.5 bg-card">⌘K</span>
          </button>

          <div className="text-xs text-muted-foreground hidden lg:block">
            Mon, 19 Oct 2026
          </div>

          {/* Notifications Button */}
          <button
            onClick={() => navigate('/student/notifications')}
            className="relative w-10 h-10 rounded-sm bg-muted flex items-center justify-center text-foreground hover:bg-muted/80 transition cursor-pointer"
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
