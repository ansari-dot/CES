import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { openAdjustmentModal, fetchDutySummaryThunk, setSelectedDateFilter } from '../store/slices/dutySlice';
import { DutyCorrectionModal } from '../components/duty/DutyCorrectionModal';
import { DutyTrackingClock } from '../components/duty/DutyTrackingClock';
import { DailyCheckInCard } from '../components/duty/DailyCheckInCard';
import { parseUtcInstant, formatTimeInZone, getBrowserTimeZone, DEFAULT_SCHOOL_TIMEZONE } from '../lib/timezone';

/** HH:MM of a UTC instant in the teacher's selected timezone. */
const toLocalTime = (value: any, timeZone: string) => {
  const d = parseUtcInstant(value);
  return d ? formatTimeInZone(d, timeZone) : '—';
};
import { DutyLogItem, DailyDutyItem } from '../types';
import { useSocketEvent } from '../hooks/useSocket';
import { RealtimeEvents } from '../services/socketService';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Briefcase,
  X,
  FileText,
  ShieldCheck,
  TrendingUp,
  RotateCw,
  Video
} from 'lucide-react';

export const DutySalaryPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const userTimeZone = useAppSelector((s: any) => s.timetable?.timezone) || getBrowserTimeZone() || DEFAULT_SCHOOL_TIMEZONE;
  const localTime = (value: any) => toLocalTime(value, userTimeZone);
  const summary = useAppSelector((state) => state.duty.summary);
  const logs = useAppSelector((state) => state.duty.logs);
  const dailyBreakdown = useAppSelector((state) => state.duty.dailyBreakdown);
  const selectedDateFilter = useAppSelector((state) => state.duty.selectedDateFilter);
  const adjustments = useAppSelector((state) => state.duty.adjustmentRequests);
  const teacher = useAppSelector((state) => state.auth.teacher);

  useEffect(() => {
    dispatch(fetchDutySummaryThunk(teacher?.id));
  }, [dispatch, teacher?.id]);

  useSocketEvent(RealtimeEvents.TEACHER_DUTY_UPDATED, () => {
    dispatch(fetchDutySummaryThunk(teacher?.id));
  });

  useSocketEvent(RealtimeEvents.PAYROLL_SUMMARY_UPDATED, () => {
    dispatch(fetchDutySummaryThunk(teacher?.id));
  });

  useSocketEvent(RealtimeEvents.CLASS_STATUS_UPDATED, () => {
    dispatch(fetchDutySummaryThunk(teacher?.id));
  });

  // Filter logs by selected date
  const filteredLogs = selectedDateFilter === 'all'
    ? logs
    : logs.filter((l) => l.date === selectedDateFilter);

  return (
    <div className="flex flex-col w-full pb-12 space-y-5 animate-in fade-in duration-150">
      {/* ------------------------------------------------------------- */}
      {/* 1. HERO HEADER BANNER */}
      {/* ------------------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#36348e] text-white flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
              <Briefcase className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  Faculty Service &amp; Compensation
                </span>
                <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Auto-Reconciliation Active
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#1e1b4b] tracking-tight mt-1">
                Teaching Duty &amp; Salary Ledger
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Track verified Zoom instruction hours, classroom delivery records, and time adjustment vouchers.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
            <button
              type="button"
              onClick={() => dispatch(fetchDutySummaryThunk(teacher?.id))}
              className="p-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl transition shadow-2xs cursor-pointer"
              title="Refresh duty logs"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. REAL-TIME CIRCULAR CLOCK TRACKER */}
      {/* ------------------------------------------------------------- */}
      <DutyTrackingClock />

      {/* Daily duty check-in / check-out and own monthly duty record */}
      <DailyCheckInCard />

      {/* ------------------------------------------------------------- */}
      {/* 3. TOP 4 WAVE KPI CARDS */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Payroll Cycle */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-blue-100/80 hover:border-blue-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Calendar className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-blue-50 text-blue-700 border-blue-100">
              <span>{summary.payrollStatus || 'Current Cycle'}</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight truncate">
              {summary.payrollPeriod || 'Monthly Cycle'}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Active Payroll Period
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(59, 130, 246, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Card 2: Total Duty Hours */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-emerald-100/80 hover:border-emerald-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Clock className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-emerald-50 text-emerald-700 border-emerald-100">
              <span>Target: {summary.targetDutyHours}h</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight leading-tight">
              {summary.totalDutyHours} <span className="text-sm font-semibold text-slate-400">hrs</span>
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Verified Duty Hours
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(16, 185, 129, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#10b981" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Card 3: Sessions Delivered */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-purple-100/80 hover:border-purple-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white shadow-sm shadow-purple-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Video className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-purple-50 text-purple-700 border-purple-100">
              <span>{summary.activeLiveCount && summary.activeLiveCount > 0 ? 'Live Now' : 'Tracked'}</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-purple-800 tracking-tight leading-tight">
              {summary.completedLessonsCount} <span className="text-sm font-semibold text-slate-400">/ {summary.scheduledLessonsCount}</span>
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Classes Delivered
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(139, 92, 246, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Card 4: Faculty Rate Tier */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-amber-100/80 hover:border-amber-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <TrendingUp className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-amber-50 text-amber-800 border-amber-200">
              <span>{summary.salaryModel || 'Standard'}</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-xl sm:text-2xl font-black text-amber-900 tracking-tight leading-tight truncate">
              {summary.hourlyRate || 'Faculty Rate'}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Compensation Rate Tier
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(245, 158, 11, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. DAILY TEACHING DUTY TRACKER */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-[#36348e] flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-[#1e1b4b]">
                Daily Teaching Duty &amp; Hours Tracker
              </h3>
              <p className="text-xs text-slate-500">
                Verified daily record of classroom teaching hours and session delivery per day
              </p>
            </div>
          </div>

          {selectedDateFilter !== 'all' && (
            <button
              onClick={() => dispatch(setSelectedDateFilter('all'))}
              className="text-xs text-[#36348e] font-bold hover:underline flex items-center gap-1 self-start sm:self-auto cursor-pointer"
            >
              <span>Show All Days ({logs.length} sessions)</span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {dailyBreakdown.length === 0 ? (
          <div className="p-10 text-center bg-slate-50/70 rounded-xl border border-slate-200/80 text-slate-400">
            <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="font-bold text-xs text-slate-700">No daily duty records logged for this cycle yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {dailyBreakdown.map((day: DailyDutyItem) => {
              const isSelected = selectedDateFilter === day.date;
              return (
                <div
                  key={day.date}
                  onClick={() => dispatch(setSelectedDateFilter(isSelected ? 'all' : day.date))}
                  className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-indigo-50/80 border-[#36348e] ring-2 ring-indigo-200 shadow-xs'
                      : day.isToday
                      ? 'bg-emerald-50/60 border-emerald-200 hover:border-emerald-300'
                      : 'bg-white border-slate-200 hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900">{day.date}</span>
                      {day.dayName && (
                        <span className="text-[10px] text-slate-400 uppercase font-bold">
                          ({day.dayName})
                        </span>
                      )}
                    </div>
                    {day.isToday && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[9px] uppercase tracking-wider">
                        Today
                      </span>
                    )}
                  </div>

                  <div className="my-1.5">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Hours Taught</span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-xl font-black text-slate-900">
                        {day.totalDutyHours} hrs
                      </span>
                      <span className="text-xs text-slate-500 font-semibold">
                        ({day.totalDutyMinutes} mins)
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <span className="text-slate-600 font-medium">
                      {day.completedLessons}/{day.totalScheduledLessons} classes
                    </span>
                    <span
                      className={`font-bold ${
                        day.completedLessons > 0 ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    >
                      {day.completedLessons > 0 ? '✓ Verified' : 'Scheduled'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. VERIFIED DUTY LOGS TABLE */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-[#36348e] flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-[#1e1b4b]">Verified Classroom Duty Logs</h3>
              <p className="text-xs text-slate-500">
                Calculated from verified Zoom participant join/leave timestamps across assigned virtual classrooms
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-semibold">
              Showing {filteredLogs.length} of {logs.length} sessions
            </span>
            {selectedDateFilter !== 'all' && (
              <span className="px-2 py-0.5 bg-indigo-100 text-[#36348e] rounded-md font-bold text-[10px]">
                Filtered: {selectedDateFilter}
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200/70 h-11 select-none text-[11px]">
                <th className="px-5 py-2">Session Date</th>
                <th className="px-5 py-2 min-w-[180px]">Class &amp; Subject</th>
                <th className="px-5 py-2 min-w-[160px]">Scheduled Period</th>
                <th className="px-5 py-2 text-center w-36">Tracked Hours</th>
                <th className="px-5 py-2 text-center w-40">Status</th>
                <th className="px-5 py-2 text-right w-36">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p className="font-bold text-xs text-slate-700">
                      {selectedDateFilter !== 'all'
                        ? `No teaching session duty logs found for ${selectedDateFilter}.`
                        : 'No teaching session duty logs found for this payroll cycle.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log: DutyLogItem) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 h-14 transition-colors">
                    <td className="px-5 py-2 font-bold text-slate-800">
                      {log.date}
                    </td>
                    <td className="px-5 py-2">
                      <span className="font-bold text-slate-900 block">{log.className}</span>
                      <span className="text-[11px] text-slate-500">{log.subject}</span>
                    </td>
                    <td className="px-5 py-2">
                      <span className="font-mono text-xs font-bold text-slate-700 block">{log.scheduledTime}</span>
                      {log.actualJoinTime && (
                        <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
                          Joined: {localTime(log.actualJoinTime)}
                          {log.actualLeaveTime ? ` · Left: ${localTime(log.actualLeaveTime)}` : ' (Active)'}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2 text-center">
                      <span className="font-black text-emerald-700 block text-sm">
                        {log.durationMinutes} mins
                      </span>
                      <span className="text-[10px] text-slate-400 font-semibold block">
                        ({((log.durationMinutes || 0) / 60).toFixed(2)}h) / {log.scheduledMinutes || 45}m sched
                      </span>
                    </td>
                    <td className="px-5 py-2 text-center">
                      {log.status === 'live' || log.isLive ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold inline-flex items-center gap-1.5 animate-pulse border border-emerald-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                          In Session (Live)
                        </span>
                      ) : log.status === 'verified' ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold inline-flex items-center gap-1.5 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Verified Duty
                        </span>
                      ) : log.status === 'flagged' || log.verificationStatus === 'REQUIRES_REVIEW' ? (
                        <span
                          className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-bold inline-flex items-center gap-1.5 border border-amber-200"
                          title={log.verificationReason || 'Flagged for principal verification'}
                        >
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Under Review
                        </span>
                      ) : log.verificationStatus === 'REJECTED' ? (
                        <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 text-xs font-bold inline-flex items-center gap-1.5 border border-rose-200">
                          <XCircle className="w-3.5 h-3.5" />
                          Duty Rejected
                        </span>
                      ) : log.status === 'unverified' ? (
                        <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-bold inline-flex items-center gap-1.5 border border-rose-200">
                          <Clock className="w-3.5 h-3.5" />
                          Unverified
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                          {log.status}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2 text-right">
                      <button
                        onClick={() => dispatch(openAdjustmentModal(log))}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[#36348e] text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-[0.98]"
                      >
                        Request Correction
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 6. PENDING ADJUSTMENT MEMOS */}
      {/* ------------------------------------------------------------- */}
      {adjustments.length > 0 && (
        <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-slate-200/80">
          <h3 className="text-sm font-extrabold text-[#1e1b4b] mb-3">
            Pending Time Correction Memos
          </h3>
          <div className="space-y-2">
            {adjustments.map((adj) => (
              <div
                key={adj.id}
                className="p-3.5 bg-slate-50 rounded-xl flex items-center justify-between text-xs border border-slate-200"
              >
                <div>
                  <span className="font-bold text-slate-900">{adj.lessonName}</span>
                  <span className="text-slate-500 ml-2">
                    {adj.currentDuration}m → {adj.requestedDuration}m ({adj.reason})
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[10px]">
                  Pending Dean Review
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <DutyCorrectionModal />
    </div>
  );
};
