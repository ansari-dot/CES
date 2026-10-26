import React from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { VisualTimetableHub } from '../components/timetable/VisualTimetableHub';
import { WeeklyGrid } from '../components/timetable/WeeklyGrid';
import { LessonDeliveryModal } from '../components/timetable/LessonDeliveryModal';
import { ZoomProblemModal } from '../components/timetable/ZoomProblemModal';
import { openProblemModal } from '../store/slices/timetableSlice';

export const TimetablePage: React.FC = () => {
  const dispatch = useAppDispatch();
  const lessons = useAppSelector((state) => state.timetable.lessons);
  const viewMode = useAppSelector((state) => state.timetable.viewMode);
  const dutyRosters = useAppSelector((state) => state.schoolTimetable.dutyRosters);

  const todayStr = new Intl.DateTimeFormat('en-CA').format(new Date());
  const todayDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayLessons = lessons.filter((l) => {
    if (l.date) return l.date === todayStr;
    return l.dayOfWeek?.toLowerCase() === todayDayName.toLowerCase();
  });

  return (
    <div className="flex flex-col w-full pb-10">
      {/* Visual Header with Action Chips */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold text-[#3525cd] uppercase tracking-wider">
              Term 2 Schedule
            </span>
            <span className="text-[#c7c4d8]">•</span>
            <span className="text-xs text-[#006c49] font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#006c49] animate-pulse"></span>
              Live Zoom &amp; Duty Sync
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#121c2a] tracking-tight">
            Timetable &amp; Duty Rosters
          </h1>
          <p className="text-xs sm:text-sm text-[#464555] mt-0.5 max-w-2xl">
            Live schedule for Classes 1–8, teacher duty posts, and automated period bell chimes.
          </p>
        </div>

        {/* Visual Metric Pills (Icons + Numbers) */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl shadow-xs border border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-[#eff4ff] text-[#3525cd] flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[18px]">calendar_today</span>
            </div>
            <div>
              <span className="text-[10px] text-[#777587] font-bold uppercase block">
                Today&apos;s Load
              </span>
              <span className="text-sm font-extrabold text-[#121c2a]">{todayLessons.length} Sessions</span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl shadow-xs border border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#006c49] flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[18px]">verified</span>
            </div>
            <div>
              <span className="text-[10px] text-[#777587] font-bold uppercase block">Delivered</span>
              <span className="text-sm font-extrabold text-[#006c49]">
                {todayLessons.filter((l) => l.deliveryLogged || l.status === 'completed').length} Done
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl shadow-xs border border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-[#92400e] flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[18px]">shield_person</span>
            </div>
            <div>
              <span className="text-[10px] text-[#777587] font-bold uppercase block">Duty Posts</span>
              <span className="text-sm font-extrabold text-[#92400e]">
                {dutyRosters.filter((d) => d.status === 'upcoming' || d.status === 'checked_in').length} Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Visual Hub Component */}
      <VisualTimetableHub />

      {/* Weekly Matrix Section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#3525cd] text-[20px]">grid_view</span>
            <h2 className="text-base font-bold text-[#121c2a]">Full Weekly Class Matrix</h2>
          </div>
          <span className="text-xs text-[#777587]">All Assigned Classes</span>
        </div>
        <WeeklyGrid />
      </div>

      {/* Modals */}
      <LessonDeliveryModal />
      <ZoomProblemModal />
    </div>
  );
};
