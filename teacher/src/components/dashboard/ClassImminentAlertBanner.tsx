import React from 'react';
import { BellRing, Video, Clock, X, Sparkles, AlertTriangle } from 'lucide-react';
import { TimetableLesson } from '../../types';
import { UpcomingClassItem } from '../../services/dashboardApi';

export interface ClassImminentAlertBannerProps {
  lesson: TimetableLesson | UpcomingClassItem;
  secondsRemaining: number;
  onLaunchClass: () => void;
  onDismiss: () => void;
  isStarting?: boolean;
  isTestPreview?: boolean;
}

export const ClassImminentAlertBanner: React.FC<ClassImminentAlertBannerProps> = ({
  lesson,
  secondsRemaining,
  onLaunchClass,
  onDismiss,
  isStarting = false,
  isTestPreview = false,
}) => {
  const isStarted = secondsRemaining <= 0;
  const mins = Math.max(0, Math.floor(Math.abs(secondsRemaining) / 60));
  const secs = Math.max(0, Math.abs(secondsRemaining) % 60);
  const formattedCountdown = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const hostKey = (lesson as any).hostKey || '884422';
  const timeDisplay =
    (lesson as any).timeSlot ||
    ((lesson as any).startTime
      ? `${(lesson as any).startTime} - ${(lesson as any).endTime}`
      : 'Scheduled Class');

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-indigo-600/10 border-2 border-amber-400/50 p-4 sm:p-5 shadow-lg shadow-amber-500/10 animate-in slide-in-from-top-3 duration-300">
      {/* Ambient background accents */}
      <div className="absolute -right-12 -top-12 w-36 h-36 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-12 -bottom-12 w-36 h-36 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Animated Icon + Notification Message */}
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <div className="relative shrink-0">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-md shadow-amber-500/30">
              <BellRing className="w-6 h-6 animate-bounce" />
            </div>
            {/* Pulsing indicator badge */}
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 border-2 border-white" />
            </span>
          </div>

          <div className="min-w-0">
            {/* Top Pill / Status Tag */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500 text-white shadow-xs">
                <AlertTriangle className="w-3 h-3" />
                {isStarted ? 'Class Time Arrived' : `Get Ready • Starts in ${mins + 1} Min`}
              </span>

              {isTestPreview && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                  Preview Mode
                </span>
              )}

              <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {timeDisplay}
              </span>
            </div>

            {/* Headline */}
            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2">
              <span className="truncate">
                {lesson.className} — {lesson.subject}
              </span>
            </h3>

            {/* Secondary instruction & host pin */}
            <p className="text-xs text-slate-600 mt-0.5 font-medium flex items-center gap-2 flex-wrap">
              <span>Please prepare your lesson materials and launch early.</span>
              <span className="inline-flex items-center gap-1 bg-white/90 px-2 py-0.5 rounded-md border border-slate-200/90 text-[11px] font-bold text-slate-800 shadow-2xs">
                Host PIN: <span className="text-indigo-600 tracking-wider font-mono">{hostKey}</span>
              </span>
            </p>
          </div>
        </div>

        {/* Right: Countdown Stopwatch + Primary Action Buttons */}
        <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
          {/* Live countdown timer */}
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              {isStarted ? 'Class Started' : 'Starts In'}
            </span>
            <div className="px-3 py-1 rounded-xl bg-white border border-amber-200/80 shadow-xs flex items-center gap-1.5 font-mono text-sm sm:text-base font-black text-amber-700">
              <Clock className="w-4 h-4 text-amber-500 animate-spin" style={{ animationDuration: '6s' }} />
              <span>{formattedCountdown}</span>
            </div>
          </div>

          {/* Launch Classroom Button */}
          <button
            type="button"
            onClick={onLaunchClass}
            disabled={isStarting}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/25 flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          >
            <Video className="w-4 h-4" />
            <span>{isStarting ? 'Launching...' : 'Launch Class Now'}</span>
          </button>

          {/* Dismiss button */}
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss alert"
            className="w-8 h-8 rounded-xl bg-white/80 hover:bg-white text-slate-400 hover:text-slate-700 border border-slate-200/70 flex items-center justify-center transition-colors shadow-2xs"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

