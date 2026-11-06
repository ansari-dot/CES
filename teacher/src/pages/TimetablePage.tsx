import React from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { VisualTimetableHub } from '../components/timetable/VisualTimetableHub';
import { WeeklyGrid } from '../components/timetable/WeeklyGrid';
import { LessonDeliveryModal } from '../components/timetable/LessonDeliveryModal';
import { ZoomProblemModal } from '../components/timetable/ZoomProblemModal';
import { Calendar, CheckCircle2, Shield, Grid, Clock } from 'lucide-react';

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

  return (
    <div className="flex flex-col w-full pb-10 space-y-6">
      {/* Visual Header with Action Chips */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
              Academic Schedule
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              Live Bell Schedule
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Timetable &amp; Schedule
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            View daily and weekly lesson schedules across Classes 1–8.
          </p>
        </div>

        {/* Visual Metric Pills (Icons + Numbers) */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2.5 bg-white px-3.5 py-2 rounded-xl shadow-xs border border-slate-200">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block leading-none">
                Today's Classes
              </span>
              <span className="text-sm font-extrabold text-slate-900">{todayLessons.length} Periods</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 bg-white px-3.5 py-2 rounded-xl shadow-xs border border-slate-200">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block leading-none">Delivered</span>
              <span className="text-sm font-extrabold text-emerald-700">
                {todayLessons.filter((l) => l.deliveryLogged || l.status === 'completed').length} Done
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 bg-white px-3.5 py-2 rounded-xl shadow-xs border border-slate-200">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block leading-none">Duty Posts</span>
              <span className="text-sm font-extrabold text-amber-700">
                {dutyRosters.filter((d) => d.status === 'upcoming' || d.status === 'checked_in').length} Active
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Visual Hub Component */}
      <VisualTimetableHub />

      {/* Weekly Matrix Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Grid className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">Weekly Class Timetable Matrix</h2>
          </div>
          <span className="text-xs text-slate-500">All Assigned Grades</span>
        </div>
        <WeeklyGrid />
      </div>

      {/* Modals */}
      <LessonDeliveryModal />
      <ZoomProblemModal />
    </div>
  );
};
