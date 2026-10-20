import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  markAllRemainingPresent,
  toggleRemarksExpanded,
  openSubmitModal,
  openCorrectionDrawer,
} from '../store/slices/attendanceSlice';
import { addToast } from '../store/slices/uiSlice';
import { AttendanceStats } from '../components/attendance/AttendanceStats';
import { AttendanceRoster } from '../components/attendance/AttendanceRoster';
import { SubmitAttendanceModal } from '../components/attendance/SubmitAttendanceModal';
import { CorrectionDrawer } from '../components/attendance/CorrectionDrawer';

export const AttendancePage: React.FC = () => {
  const dispatch = useAppDispatch();
  const isLocked = useAppSelector((state) => state.attendance.isLocked);
  const remarksExpanded = useAppSelector((state) => state.attendance.remarksExpanded);
  const submittedLogs = useAppSelector((state) => state.attendance.submittedLogs);
  const teacher = useAppSelector((state) => state.auth.teacher);

  const [searchFilter, setSearchFilter] = useState('');

  const handleMarkAllPresent = () => {
    if (isLocked) return;
    dispatch(markAllRemainingPresent());
    dispatch(addToast({ message: 'All enrolled students marked as Present.', type: 'success' }));
  };

  const handleSaveDraft = () => {
    dispatch(
      addToast({
        message: 'Attendance draft saved to local secure cache.',
        type: 'info',
      })
    );
  };

  const handleExportCSV = () => {
    dispatch(
      addToast({
        message: 'Exporting Class 5-A roster CSV snapshot to downloads...',
        type: 'info',
      })
    );
  };

  return (
    <div className="flex flex-col w-full pb-8 space-y-4">
      {/* Page Title Block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-[#121c2a]">Student Attendance</h1>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                isLocked ? 'bg-emerald-100 text-[#065f46]' : 'bg-amber-100 text-[#92400e]'
              }`}
            >
              {isLocked ? 'Locked' : 'Draft'}
            </span>
          </div>
          <p className="text-xs text-[#777587]">
            {teacher?.assignedClasses?.[0]
              ? `${teacher.assignedClasses[0].name} • ${teacher.assignedClasses[0].subject} • Period 1 (09:00 - 09:45 AM)`
              : 'No active session scheduled'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveDraft}
            disabled={isLocked}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-[#121c2a] hover:bg-slate-50 text-xs font-semibold border border-slate-200 transition-all disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">save</span>
            <span>Draft</span>
          </button>
          <button
            onClick={() => dispatch(openSubmitModal())}
            disabled={isLocked}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-white shadow-xs text-xs font-bold transition-all ${
              isLocked
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-[#4f46e5] hover:bg-[#3525cd]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">assignment_turned_in</span>
            <span>{isLocked ? 'Record Locked' : 'Submit Final'}</span>
          </button>
        </div>
      </div>

      {/* Attendance Stats Cards */}
      <AttendanceStats />

      {/* Roster Control Bar */}
      <div className="bg-white rounded-xl p-3 shadow-xs border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[#777587] text-[18px]">
            person_search
          </span>
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search student or Roll #..."
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-[#eff4ff] text-xs text-[#121c2a] placeholder:text-[#777587] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={handleMarkAllPresent}
            disabled={isLocked}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-[#065f46] text-xs font-bold transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">done_all</span>
            <span>All Present</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="p-1.5 rounded-lg bg-[#eff4ff] hover:bg-[#dee9fc] text-[#464555]"
            title="Export CSV"
          >
            <span className="material-symbols-outlined text-[18px]">file_download</span>
          </button>
          <button
            onClick={() => dispatch(toggleRemarksExpanded())}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1 ${
              remarksExpanded
                ? 'bg-indigo-100 text-[#3525cd]'
                : 'bg-[#eff4ff] hover:bg-[#dee9fc] text-[#464555]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">chat_bubble_outline</span>
            <span>Remarks</span>
          </button>
        </div>
      </div>

      {/* Student Roster Table */}
      <AttendanceRoster filterQuery={searchFilter} />

      {/* Historical Submissions Table */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-3 bg-[#eff4ff]/60 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#121c2a]">
            <span className="material-symbols-outlined text-[16px] text-[#3525cd]">history</span>
            <span>Past Locked Records</span>
          </div>
          <button
            onClick={() => dispatch(openCorrectionDrawer('GENERAL'))}
            className="px-2.5 py-1 rounded-lg bg-[#eff4ff] hover:bg-[#dee9fc] text-[#3525cd] text-xs font-bold"
          >
            Correction Voucher
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#eff4ff] text-[#464555] font-bold uppercase tracking-wider border-b border-slate-200 h-9">
                <th className="px-3 w-32">Session Date</th>
                <th className="px-3 min-w-[160px]">Class &amp; Topic</th>
                <th className="px-3 text-center w-28">Present Count</th>
                <th className="px-3 text-center w-24">Status</th>
                <th className="px-3 text-right w-32">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {submittedLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[#777587]">
                    No past attendance records found.
                  </td>
                </tr>
              ) : (
                submittedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 h-11 transition-colors">
                    <td className="px-3 font-semibold text-[#121c2a]">{log.date}</td>
                    <td className="px-3">
                      <span className="font-bold text-[#121c2a]">{log.className}</span>
                      <span className="text-[#777587] ml-1.5">• {log.topic}</span>
                    </td>
                    <td className="px-3 text-center font-bold text-[#006c49]">
                      {log.presentCount}/{log.totalStudents} Present
                    </td>
                    <td className="px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[#065f46] font-bold text-[10px]">
                        Locked
                      </span>
                    </td>
                    <td className="px-3 text-right">
                      <button
                        onClick={() => dispatch(openCorrectionDrawer(log.id))}
                        className="px-2.5 py-1 rounded bg-[#eff4ff] hover:bg-[#dee9fc] text-[#3525cd] font-bold text-[11px]"
                      >
                        Correction
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals & Drawers */}
      <SubmitAttendanceModal />
      <CorrectionDrawer />
    </div>
  );
};
