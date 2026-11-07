import React, { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { openAdjustmentModal, fetchDutySummaryThunk, setSelectedDateFilter } from '../store/slices/dutySlice';
import { DutyCorrectionModal } from '../components/duty/DutyCorrectionModal';
import { DutyTrackingClock } from '../components/duty/DutyTrackingClock';
import { DutyLogItem, DailyDutyItem } from '../types';
import { useSocketEvent } from '../hooks/useSocket';
import { RealtimeEvents } from '../services/socketService';

export const DutySalaryPage: React.FC = () => {
  const dispatch = useAppDispatch();
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
    <div className="flex flex-col w-full pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold text-[#7a5b00] uppercase tracking-wider">
              Faculty Service &amp; Compensation
            </span>
            <span className="text-[#c7c4d8]">•</span>
            <span className="text-xs text-[#545454]">SRS Section 15</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#292929] tracking-tight">
            Teaching Duty &amp; Salary Summary
          </h1>
          <p className="text-xs sm:text-sm text-[#545454] mt-0.5 max-w-2xl">
            Track authorized classroom teaching hours, verify recorded Zoom session durations, and
            submit time adjustment vouchers to Academic Operations.
          </p>
        </div>

        <div className="px-3 py-1.5 rounded-xl bg-[#d1fae5] text-[#065f46] text-xs font-bold flex items-center gap-1.5 self-start md:self-auto border border-emerald-200">
          <span className="material-symbols-outlined text-[18px]">verified</span>
          <span>SIS Payroll Auto-Reconciliation Active</span>
        </div>
      </div>

      {/* Real-time Circular Clock Duty Tracker */}
      <DutyTrackingClock className="mb-6" />

      {/* Overview Cards (4 cols) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-100">
          <span className="text-[11px] uppercase font-bold text-[#777587]">Payroll Cycle</span>
          <h3 className="text-sm font-bold text-[#292929] mt-1">{summary.payrollPeriod}</h3>
          <span className="text-xs text-[#006c49] font-bold mt-2 block">Status: {summary.payrollStatus}</span>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-100">
          <span className="text-[11px] uppercase font-bold text-[#777587]">Total Duty Hours</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-[#292929]">{summary.totalDutyHours}</span>
            <span className="text-xs text-[#777587]">/ {summary.targetDutyHours} hrs target</span>
          </div>
          <div className="w-full bg-[#dfdff2] h-1.5 rounded-full overflow-hidden mt-2">
            <div
              className="bg-[#36348e] h-full transition-all duration-300"
              style={{
                width: `${
                  summary.targetDutyHours > 0
                    ? Math.min(100, (summary.totalDutyHours / summary.targetDutyHours) * 100)
                    : 0
                }%`,
              }}
            ></div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-100">
          <span className="text-[11px] uppercase font-bold text-[#777587]">Sessions Delivered</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-[#292929]">
              {summary.completedLessonsCount}
            </span>
            <span className="text-xs text-[#777587]">/ {summary.scheduledLessonsCount} scheduled</span>
          </div>
          <span className="text-xs text-[#006c49] font-semibold mt-2 block">
            {summary.activeLiveCount && summary.activeLiveCount > 0
              ? `🟢 ${summary.activeLiveCount} Session Currently Live`
              : `Automatic Zoom Webhook Duty Tracking`}
          </span>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-100">
          <span className="text-[11px] uppercase font-bold text-[#777587]">Faculty Rate Tier</span>
          <h3 className="text-sm font-bold text-[#292929] mt-1">{summary.hourlyRate}</h3>
          <span className="text-xs text-[#777587] mt-2 block">
            Model: {summary.salaryModel || 'Hybrid'} • ID: {teacher?.employeeId || 'Faculty'}
          </span>
        </div>
      </div>

      {/* Each Day Teaching Duty & Hours Tracker */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">calendar_today</span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#292929]">
                Daily Teaching Duty &amp; Hours Tracker
              </h3>
              <p className="text-[11px] text-[#777587]">
                Verified daily record of classroom teaching hours and session delivery per day
              </p>
            </div>
          </div>

          {selectedDateFilter !== 'all' && (
            <button
              onClick={() => dispatch(setSelectedDateFilter('all'))}
              className="text-xs text-[#36348e] font-bold hover:underline flex items-center gap-1 self-start sm:self-auto"
            >
              <span>Show All Days ({logs.length} sessions)</span>
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          )}
        </div>

        {dailyBreakdown.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-100 text-[#777587]">
            <span className="material-symbols-outlined text-3xl mb-1 text-slate-300">event_busy</span>
            <p className="font-medium text-xs">No daily duty records logged for this cycle yet.</p>
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
                      ? 'bg-indigo-50/70 border-indigo-300 ring-2 ring-indigo-400/40 shadow-xs'
                      : day.isToday
                      ? 'bg-emerald-50/50 border-emerald-200 hover:border-emerald-300'
                      : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#292929]">{day.date}</span>
                      {day.dayName && (
                        <span className="text-[10px] text-slate-500 uppercase font-bold">
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
                    <span className="text-[10px] text-slate-500 uppercase font-semibold block">Hours Taught</span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-xl font-black text-[#292929]">
                        {day.totalDutyHours} hrs
                      </span>
                      <span className="text-xs text-slate-500 font-semibold">
                        ({day.totalDutyMinutes} mins)
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
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

      {/* Verified Duty Logs Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-6">
        <div className="p-4 bg-[#f1f1fa]/60 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#36348e] text-[20px]">
              receipt_long
            </span>
            <div>
              <h3 className="text-sm font-bold text-[#292929]">Verified Classroom Duty Logs</h3>
              <p className="text-[11px] text-[#777587]">
                Calculated from verified Zoom participant join/leave timestamps across assigned virtual classrooms
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[#777587] font-semibold">
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
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#f1f1fa] text-[#545454] text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                <th className="p-3">Session Date</th>
                <th className="p-3">Class &amp; Subject</th>
                <th className="p-3">Scheduled Period</th>
                <th className="p-3 text-center">Tracked Duty Hours</th>
                <th className="p-3 text-center">Verification Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#777587]">
                    <span className="material-symbols-outlined text-3xl mb-1 text-slate-300">history_toggle_off</span>
                    <p className="font-medium text-xs">
                      {selectedDateFilter !== 'all'
                        ? `No teaching session duty logs found for ${selectedDateFilter}.`
                        : 'No teaching session duty logs found for this payroll cycle.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log: DutyLogItem) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 font-semibold text-[#292929]">
                      <div>{log.date}</div>
                    </td>
                    <td className="p-3">
                      <span className="font-bold text-[#292929] block">{log.className}</span>
                      <span className="text-xs text-[#777587]">{log.subject}</span>
                    </td>
                    <td className="p-3">
                      <span className="font-mono text-xs text-[#545454] block">{log.scheduledTime}</span>
                      {log.actualJoinTime && (
                        <span className="text-[10px] text-slate-500 block font-mono mt-0.5">
                          Joined: {String(log.actualJoinTime).substring(11, 16)}
                          {log.actualLeaveTime ? ` • Left: ${String(log.actualLeaveTime).substring(11, 16)}` : ' (Active)'}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      <span className="font-black text-[#006c49] block text-sm">
                        {log.durationMinutes} mins
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold block">
                        ({((log.durationMinutes || 0) / 60).toFixed(2)} hrs) / {log.scheduledMinutes || 45}m sched
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {log.status === 'live' || log.isLive ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold inline-flex items-center gap-1 animate-pulse border border-emerald-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                          In Session (Live)
                        </span>
                      ) : log.status === 'verified' ? (
                        <span className="px-2 py-0.5 rounded-full bg-[#d1fae5] text-[#065f46] text-[10px] font-bold inline-flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">check_circle</span>
                          Verified Duty
                        </span>
                      ) : log.status === 'flagged' || log.verificationStatus === 'REQUIRES_REVIEW' ? (
                        <div className="flex flex-col items-center">
                          <span
                            className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold inline-flex items-center gap-1 border border-amber-200"
                            title={log.verificationReason || 'Flagged for principal verification'}
                          >
                            <span className="material-symbols-outlined text-[12px]">warning</span>
                            Under Admin Review
                          </span>
                          {log.verificationReason && (
                            <span className="text-[9px] text-amber-700 font-medium mt-0.5 max-w-[130px] truncate" title={log.verificationReason}>
                              {log.verificationReason}
                            </span>
                          )}
                        </div>
                      ) : log.verificationStatus === 'REJECTED' ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold inline-flex items-center gap-1 border border-rose-200" title={log.verificationReason || 'Duty rejected by Principal'}>
                          <span className="material-symbols-outlined text-[12px]">cancel</span>
                          Duty Rejected
                        </span>
                      ) : log.status === 'unverified' ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold inline-flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">schedule</span>
                          Unverified Attendance
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                          {log.status}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => dispatch(openAdjustmentModal(log))}
                        className="px-2.5 py-1 rounded-lg bg-[#f1f1fa] hover:bg-[#ffedc2] text-[#36348e] text-xs font-bold transition-colors"
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

      {/* Pending Adjustment Memos */}
      {adjustments.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 mb-6">
          <h3 className="text-sm font-bold text-[#292929] mb-3">
            Pending Time Correction Memos
          </h3>
          <div className="space-y-2">
            {adjustments.map((adj) => (
              <div
                key={adj.id}
                className="p-3 bg-[#f1f1fa] rounded-xl flex items-center justify-between text-xs border border-indigo-100/60"
              >
                <div>
                  <span className="font-bold text-[#292929]">{adj.lessonName}</span>
                  <span className="text-[#777587] ml-2">
                    {adj.currentDuration}m → {adj.requestedDuration}m ({adj.reason})
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#ffe9b0] text-[#8a6400] font-bold text-[10px]">
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
