import React from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { VisualTimetableHub } from '../components/timetable/VisualTimetableHub';
import { WeeklyGrid } from '../components/timetable/WeeklyGrid';
import { LessonDeliveryModal } from '../components/timetable/LessonDeliveryModal';
import { ZoomProblemModal } from '../components/timetable/ZoomProblemModal';
import {
  Calendar,
  CheckCircle2,
  Shield,
  Grid,
  Clock,
  Layers,
  Sparkles,
  BookOpen
} from 'lucide-react';

export const TimetablePage: React.FC = () => {
  const dispatch = useAppDispatch();
  const lessons = useAppSelector((state) => state.timetable.lessons);
  const dutyRosters = useAppSelector((state) => state.schoolTimetable.dutyRosters);

  const todayStr = new Intl.DateTimeFormat('en-CA').format(new Date());
  const todayDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayLessons = lessons.filter((l) => {
    if (l.date) return l.date === todayStr;
    return l.dayOfWeek?.toLowerCase() === todayDayName.toLowerCase();
  });

  const deliveredCount = todayLessons.filter((l) => l.deliveryLogged || l.status === 'completed').length;
  const activeDutyPosts = dutyRosters.filter((d) => d.status === 'upcoming' || d.status === 'checked_in').length;

  return (
    <div className="flex flex-col w-full pb-12 space-y-5 animate-in fade-in duration-150">
      {/* ------------------------------------------------------------- */}
      {/* 1. HERO HEADER BANNER                                         */}
      {/* ------------------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#36348e]/10 border border-[#36348e]/20 flex items-center justify-center text-[#36348e] shrink-0 shadow-2xs">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold text-[#36348e] uppercase tracking-wider">
                  Academic Schedule
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-emerald-700 font-bold flex items-center gap-1.5 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                  Live Bell Synchronized
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Faculty Timetable &amp; Bell Matrix
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Daily period schedules, campus duty posts, and full weekly teaching matrix across Classes 1–8.
              </p>
            </div>
          </div>
        </div>

        {/* Subtle Decorative Background Element */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#36348e]/5 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. FOUR TOP WAVE KPI STAT CARDS                               */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Today's Classes */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-indigo-100/80 hover:border-indigo-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-[#36348e] text-white shadow-sm shadow-indigo-900/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-indigo-50 text-[#36348e] border-indigo-100">
              Today
            </span>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-2xl sm:text-2xl xl:text-3xl font-black text-slate-900 tracking-tight">
              {todayLessons.length}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">
              Assigned Periods Today
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(69, 67, 168, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#4543a8" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Card 2: Delivered Today */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-emerald-100/80 hover:border-emerald-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-emerald-50 text-emerald-700 border-emerald-100">
              Completed
            </span>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-2xl sm:text-2xl xl:text-3xl font-black text-slate-900 tracking-tight">
              {deliveredCount}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">
              Delivered &amp; Logged
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(16, 185, 129, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#10b981" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Card 3: Active Duty Posts */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-amber-100/80 hover:border-amber-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Shield className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-amber-50 text-amber-800 border-amber-200">
              Supervision
            </span>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-2xl sm:text-2xl xl:text-3xl font-black text-slate-900 tracking-tight">
              {activeDutyPosts}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">
              Active Campus Duty Posts
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(245, 158, 11, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Card 4: Total Weekly Lessons */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-blue-100/80 hover:border-blue-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Layers className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-blue-50 text-blue-700 border-blue-100">
              Full Week
            </span>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-2xl sm:text-2xl xl:text-3xl font-black text-slate-900 tracking-tight">
              {lessons.length}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">
              Total Weekly Schedule Slots
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(59, 130, 246, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. MAIN VISUAL TIMETABLE HUB (DAY SELECTOR & SESSIONS/DUTY)    */}
      {/* ------------------------------------------------------------- */}
      <VisualTimetableHub />

      {/* ------------------------------------------------------------- */}
      {/* 4. WEEKLY MATRIX SECTION                                       */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-[#36348e] flex items-center justify-center border border-indigo-100">
              <Grid className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">Weekly Class Timetable Matrix</h2>
              <p className="text-xs text-slate-500">Interactive overview across all days</p>
            </div>
          </div>
          <span className="text-xs font-bold text-[#36348e] bg-indigo-50 px-3 py-1 rounded-xl border border-indigo-100">
            All Assigned Grades
          </span>
        </div>
        <WeeklyGrid />
      </div>

      {/* Modals */}
      <LessonDeliveryModal />
      <ZoomProblemModal />
    </div>
  );
};
