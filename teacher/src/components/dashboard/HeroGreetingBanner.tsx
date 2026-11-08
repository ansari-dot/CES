import React, { useMemo } from 'react';
import { Calendar, Video, Clock, CheckCircle2, ChevronDown, ChevronUp, BellRing } from 'lucide-react';
import { TimetableLesson } from '../../types';

export interface HeroGreetingBannerProps {
  teacherName: string;
  isTeachingLive: boolean;
  liveLesson?: TimetableLesson;
  nextLesson?: TimetableLesson;
  onStartLesson?: (lesson: TimetableLesson) => void;
  onConcludeLesson?: () => void;
  startingLessonId?: string | null;
  showDutyClock: boolean;
  onToggleDutyClock: () => void;
  formatStopwatch?: (totalSec: number) => string;
  liveElapsedSeconds?: number;
  isAlertActive?: boolean;
  onTogglePreClassAlert?: () => void;
}

export const HeroGreetingBanner: React.FC<HeroGreetingBannerProps> = ({
  teacherName,
  isTeachingLive,
  liveLesson,
  nextLesson,
  onStartLesson,
  onConcludeLesson,
  startingLessonId,
  showDutyClock,
  onToggleDutyClock,
  formatStopwatch,
  liveElapsedSeconds = 0,
  isAlertActive = false,
  onTogglePreClassAlert,
}) => {
  // Determine greeting based on current local hour
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  // Format first name nicely (e.g. "Arsalan" from "Mr. Arsalan Ansari" or "Arsalan Ansari")
  const displayName = useMemo(() => {
    if (!teacherName) return 'Teacher';
    const clean = teacherName.replace(/^(Mr\.|Ms\.|Mrs\.|Dr\.|Prof\.)\s+/i, '').trim();
    return clean.split(' ')[0] || teacherName;
  }, [teacherName]);

  // Formatted date e.g. "Mon, Nov 10, 2026"
  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-white via-indigo-50/40 to-blue-50/50 border border-slate-100 shadow-xs p-6 sm:p-7">
      {/* Background soft ambient classroom glow & shapes */}
      <div className="absolute top-0 right-0 w-96 h-full pointer-events-none opacity-20 sm:opacity-30 bg-radial from-blue-400 via-indigo-200 to-transparent blur-2xl" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* Left Side: Greeting, Tagline & Status Badges */}
        <div className="space-y-3">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <span>{greeting}, {displayName}!</span>
              <span className="inline-block animate-bounce origin-bottom-right">👋</span>
            </h1>
            <p className="text-sm sm:text-base font-medium text-slate-500 mt-1">
              Teach. Inspire. Make a Difference.
            </p>
          </div>

          {/* Badges Row */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            {/* Date Pill */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200/80 text-xs font-bold text-slate-700 shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>{formattedDate}</span>
            </div>

            {/* Online / Live Status Pill */}
            {isTeachingLive ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs font-bold text-emerald-800 shadow-2xs animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Teaching Live ({liveLesson?.className || 'Class'})</span>
                {formatStopwatch && (
                  <span className="font-mono text-emerald-900 font-extrabold ml-1">
                    {formatStopwatch(liveElapsedSeconds)}
                  </span>
                )}
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200/80 text-xs font-bold text-slate-700 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Online</span>
              </div>
            )}

            {/* Duty Clock Toggle Pill */}
            <button
              onClick={onToggleDutyClock}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50/80 hover:bg-indigo-100/90 border border-indigo-200 text-xs font-bold text-indigo-700 transition-colors shadow-2xs"
            >
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
              <span>Duty Clock</span>
              {showDutyClock ? (
                <ChevronUp className="w-3 h-3 ml-0.5" />
              ) : (
                <ChevronDown className="w-3 h-3 ml-0.5" />
              )}
            </button>

            {/* 5-Min Pre-Class Alert Toggle Pill */}
            {onTogglePreClassAlert && (
              <button
                type="button"
                onClick={onTogglePreClassAlert}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-2xs ${
                  isAlertActive
                    ? 'bg-amber-100/90 text-amber-900 border-amber-300'
                    : 'bg-amber-50/70 hover:bg-amber-100 text-amber-800 border-amber-200/80'
                }`}
                title="5-minute pre-class alert (Teacher get ready notification)"
              >
                <BellRing className="w-3.5 h-3.5 text-amber-600" />
                <span>5-Min Alert</span>
                {isAlertActive && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Right Side: 3D Classroom Illustration + Live Action Controls */}
        <div className="flex items-center gap-4 shrink-0">
          {/* Quick Action Button for Next/Live Lesson */}
          {isTeachingLive && liveLesson ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onStartLesson?.(liveLesson)}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2"
              >
                <Video className="w-4 h-4" />
                <span>Re-Join Classroom</span>
              </button>
              <button
                onClick={onConcludeLesson}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Conclude Class</span>
              </button>
            </div>
          ) : nextLesson ? (
            <button
              onClick={() => onStartLesson?.(nextLesson)}
              disabled={startingLessonId === nextLesson.id}
              className="px-5 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-500/20 transition-all flex items-center gap-2.5 disabled:opacity-50 group hover:scale-[1.02]"
            >
              <Video className="w-4 h-4 group-hover:scale-110 transition-transform" />
              <span>
                {startingLessonId === nextLesson.id
                  ? 'Launching...'
                  : `Start ${nextLesson.className} Class`}
              </span>
            </button>
          ) : null}

          {/* 3D Classroom Books & Graduation Cap Art (Matching Image) */}
          <div className="hidden sm:flex relative items-center justify-center w-36 h-28 shrink-0 select-none">
            <svg
              viewBox="0 0 160 120"
              className="w-full h-full drop-shadow-md overflow-visible"
            >
              {/* Soft desk base */}
              <ellipse cx="80" cy="108" rx="65" ry="10" fill="#e2e8f0" opacity="0.6" />

              {/* Stack of books */}
              {/* Bottom Book (Navy) */}
              <rect x="25" y="88" width="105" height="14" rx="3" fill="#1e293b" />
              <rect x="30" y="89" width="95" height="12" rx="2" fill="#334155" />
              <path d="M 25 88 Q 23 95 25 102 L 30 102 Q 28 95 30 88 Z" fill="#94a3b8" />
              <rect x="32" y="91" width="90" height="8" fill="#f8fafc" />

              {/* Middle Book (Sky Blue) */}
              <rect x="35" y="74" width="90" height="14" rx="3" fill="#2563eb" />
              <rect x="40" y="75" width="80" height="12" rx="2" fill="#3b82f6" />
              <path d="M 35 74 Q 33 81 35 88 L 40 88 Q 38 81 40 74 Z" fill="#93c5fd" />
              <rect x="42" y="77" width="75" height="8" fill="#f8fafc" />

              {/* Top Book (Royal Blue) */}
              <rect x="42" y="60" width="78" height="14" rx="3" fill="#1d4ed8" />
              <rect x="46" y="61" width="70" height="12" rx="2" fill="#2563eb" />
              <rect x="48" y="63" width="65" height="8" fill="#f8fafc" />

              {/* Graduation Cap (Mortarboard) on top */}
              {/* Cap Base */}
              <path
                d="M 60 48 Q 80 56 100 48 L 98 57 Q 80 64 62 57 Z"
                fill="#0f172a"
              />
              {/* Rhombus Cap Top */}
              <polygon
                points="80,24 132,40 80,56 28,40"
                fill="#1e293b"
                stroke="#0f172a"
                strokeWidth="1.5"
              />
              <polygon
                points="80,26 128,40 80,54 32,40"
                fill="#334155"
              />

              {/* Cap Center Button */}
              <ellipse cx="80" cy="40" rx="3.5" ry="2.5" fill="#f59e0b" />

              {/* Golden Tassel */}
              <path
                d="M 80 40 Q 105 45 116 58"
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx="116" cy="58" r="3" fill="#d97706" />
              <path
                d="M 115 59 L 114 74 L 118 74 L 117 59 Z"
                fill="#f59e0b"
              />

              {/* Pencil Holder on Left */}
              <rect x="8" y="70" width="16" height="24" rx="3" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1" />
              {/* Pencils */}
              <line x1="12" y1="58" x2="14" y2="72" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
              <line x1="16" y1="54" x2="16" y2="72" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
              <line x1="20" y1="60" x2="18" y2="72" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};

