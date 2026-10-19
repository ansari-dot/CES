import React from 'react';
import { useAppSelector } from '../../store';

export const AttendanceStats: React.FC = () => {
  const roster = useAppSelector((state) => state.attendance.roster);

  const presentCount = roster.filter((r) => r.status === 'present').length;
  const absentCount = roster.filter((r) => r.status === 'absent').length;
  const lateCount = roster.filter((r) => r.status === 'late').length;
  const leaveCount = roster.filter((r) => r.status === 'leave').length;
  const total = roster.length;

  const presentPct = total > 0 ? ((presentCount / total) * 100).toFixed(1) : '0';
  const latePct = total > 0 ? ((lateCount / total) * 100).toFixed(1) : '0';
  const absentPct = total > 0 ? ((absentCount / total) * 100).toFixed(1) : '0';

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm flex flex-col justify-between border border-slate-100">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-[#121c2a] uppercase tracking-wider">
          Attendance Breakdown
        </h3>
        <span className="text-xs text-[#464555] font-semibold">{total} Total Students</span>
      </div>

      {/* 4 Stat Boxes */}
      <div className="grid grid-cols-4 gap-2 py-3 text-center">
        {/* Present */}
        <div className="bg-[#ecfdf5] rounded-xl p-2.5 border border-emerald-100">
          <span className="block text-xl font-bold text-[#065f46]">{presentCount}</span>
          <span className="text-[11px] font-bold text-[#065f46] uppercase">Present</span>
        </div>

        {/* Absent */}
        <div className="bg-[#fef2f2] rounded-xl p-2.5 border border-red-100">
          <span className="block text-xl font-bold text-[#991b1b]">{absentCount}</span>
          <span className="text-[11px] font-bold text-[#991b1b] uppercase">Absent</span>
        </div>

        {/* Late */}
        <div className="bg-[#fffbeb] rounded-xl p-2.5 border border-amber-100">
          <span className="block text-xl font-bold text-[#92400e]">{lateCount}</span>
          <span className="text-[11px] font-bold text-[#92400e] uppercase">Late</span>
        </div>

        {/* Leave */}
        <div className="bg-[#eff4ff] rounded-xl p-2.5 border border-indigo-100">
          <span className="block text-xl font-bold text-[#464555]">{leaveCount}</span>
          <span className="text-[11px] font-bold text-[#464555] uppercase">Leave</span>
        </div>
      </div>

      {/* Visual ratio bar */}
      <div className="mt-2">
        <div className="flex justify-between items-center text-xs text-[#464555] mb-1.5 font-medium">
          <span>Current Presence Ratio</span>
          <span className="font-bold text-[#121c2a]">{presentPct}% Net</span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden flex">
          <div
            className="bg-[#006c49] h-full transition-all duration-300"
            style={{ width: `${presentPct}%` }}
            title="Present"
          ></div>
          <div
            className="bg-[#ffb95f] h-full transition-all duration-300"
            style={{ width: `${latePct}%` }}
            title="Late"
          ></div>
          <div
            className="bg-[#ba1a1a] h-full transition-all duration-300"
            style={{ width: `${absentPct}%` }}
            title="Absent"
          ></div>
        </div>
      </div>
    </div>
  );
};
