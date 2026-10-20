import React from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { openAdjustmentModal } from '../store/slices/dutySlice';
import { DutyCorrectionModal } from '../components/duty/DutyCorrectionModal';
import { DutyLogItem } from '../types';

export const DutySalaryPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const summary = useAppSelector((state) => state.duty.summary);
  const logs = useAppSelector((state) => state.duty.logs);
  const adjustments = useAppSelector((state) => state.duty.adjustmentRequests);
  const teacher = useAppSelector((state) => state.auth.teacher);

  return (
    <div className="flex flex-col w-full pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold text-[#684000] uppercase tracking-wider">
              Faculty Service &amp; Compensation
            </span>
            <span className="text-[#c7c4d8]">•</span>
            <span className="text-xs text-[#464555]">SRS Section 15</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#121c2a] tracking-tight">
            Teaching Duty &amp; Salary Summary
          </h1>
          <p className="text-xs sm:text-sm text-[#464555] mt-0.5 max-w-2xl">
            Track authorized classroom teaching hours, verify recorded Zoom session durations, and
            submit time adjustment vouchers to Academic Operations.
          </p>
        </div>

        <div className="px-3 py-1.5 rounded-xl bg-[#d1fae5] text-[#065f46] text-xs font-bold flex items-center gap-1.5 self-start md:self-auto border border-emerald-200">
          <span className="material-symbols-outlined text-[18px]">verified</span>
          <span>SIS Payroll Auto-Reconciliation Active</span>
        </div>
      </div>

      {/* Overview Cards (4 cols) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-100">
          <span className="text-[11px] uppercase font-bold text-[#777587]">Payroll Cycle</span>
          <h3 className="text-sm font-bold text-[#121c2a] mt-1">{summary.payrollPeriod}</h3>
          <span className="text-xs text-[#006c49] font-bold mt-2 block">Status: {summary.payrollStatus}</span>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-100">
          <span className="text-[11px] uppercase font-bold text-[#777587]">Teaching Hours</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-2xl font-black text-[#121c2a]">{summary.totalDutyHours}</span>
            <span className="text-xs text-[#777587]">/ {summary.targetDutyHours} hrs target</span>
          </div>
          <div className="w-full bg-[#dee9fc] h-1.5 rounded-full overflow-hidden mt-2">
            <div
              className="bg-[#3525cd] h-full"
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
            <span className="text-2xl font-black text-[#121c2a]">
              {summary.completedLessonsCount}
            </span>
            <span className="text-xs text-[#777587]">/ {summary.scheduledLessonsCount} scheduled</span>
          </div>
          <span className="text-xs text-[#777587] mt-2 block">100% on-time start rate</span>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-100">
          <span className="text-[11px] uppercase font-bold text-[#777587]">Faculty Rate Tier</span>
          <h3 className="text-sm font-bold text-[#121c2a] mt-1">{summary.hourlyRate}</h3>
          <span className="text-xs text-[#777587] mt-2 block">ID: {teacher.employeeId}</span>
        </div>
      </div>

      {/* Verified Duty Logs Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-6">
        <div className="p-4 bg-[#eff4ff]/60 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#3525cd] text-[20px]">
              receipt_long
            </span>
            <h3 className="text-sm font-bold text-[#121c2a]">Verified Teaching Sessions</h3>
          </div>
          <span className="text-xs text-[#777587]">Showing {logs.length} sessions</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#eff4ff] text-[#464555] text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                <th className="p-3">Session Date</th>
                <th className="p-3">Class &amp; Subject</th>
                <th className="p-3">Scheduled Period</th>
                <th className="p-3 text-center">Verified Duration</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Adjustment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#777587]">
                    <span className="material-symbols-outlined text-3xl mb-1 text-slate-300">history_toggle_off</span>
                    <p className="font-medium text-xs">No teaching session duty logs found for this payroll cycle.</p>
                  </td>
                </tr>
              ) : (
                logs.map((log: DutyLogItem) => (
                  <tr key={log.id} className="hover:bg-slate-50/60">
                    <td className="p-3 font-semibold text-[#121c2a]">{log.date}</td>
                    <td className="p-3">
                      <span className="font-bold text-[#121c2a] block">{log.className}</span>
                      <span className="text-xs text-[#777587]">{log.subject}</span>
                    </td>
                    <td className="p-3 font-mono text-xs text-[#464555]">{log.scheduledTime}</td>
                    <td className="p-3 text-center font-bold text-[#006c49]">
                      {log.durationMinutes} mins
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-[#d1fae5] text-[#065f46] text-[10px] font-bold">
                        {log.status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => dispatch(openAdjustmentModal(log))}
                        className="px-2.5 py-1 rounded-lg bg-[#eff4ff] hover:bg-[#dee9fc] text-[#3525cd] text-xs font-bold transition-colors"
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
          <h3 className="text-sm font-bold text-[#121c2a] mb-3">
            Pending Time Correction Memos
          </h3>
          <div className="space-y-2">
            {adjustments.map((adj) => (
              <div
                key={adj.id}
                className="p-3 bg-[#eff4ff] rounded-xl flex items-center justify-between text-xs border border-indigo-100/60"
              >
                <div>
                  <span className="font-bold text-[#121c2a]">{adj.lessonName}</span>
                  <span className="text-[#777587] ml-2">
                    {adj.currentDuration}m → {adj.requestedDuration}m ({adj.reason})
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#ffddb8] text-[#92400e] font-bold text-[10px]">
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
