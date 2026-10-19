import React from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  setStudentStatus,
  setStudentRemark,
} from '../../store/slices/attendanceSlice';
import { AttendanceStatus } from '../../types';

interface AttendanceRosterProps {
  filterQuery: string;
}

export const AttendanceRoster: React.FC<AttendanceRosterProps> = ({ filterQuery }) => {
  const dispatch = useAppDispatch();
  const roster = useAppSelector((state) => state.attendance.roster);
  const isLocked = useAppSelector((state) => state.attendance.isLocked);
  const remarksExpanded = useAppSelector((state) => state.attendance.remarksExpanded);

  const filteredRoster = roster.filter((student) => {
    const q = filterQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      student.studentName.toLowerCase().includes(q) ||
      student.rollNumber.toLowerCase().includes(q) ||
      student.admissionId.toLowerCase().includes(q)
    );
  });

  const getRowBg = (status: AttendanceStatus) => {
    if (status === 'absent') return 'bg-red-50/40 hover:bg-red-50/60';
    if (status === 'late') return 'bg-amber-50/40 hover:bg-amber-50/60';
    return 'hover:bg-[#eff4ff]/40';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-slate-100">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[#eff4ff] h-11 text-[#464555] text-xs font-semibold uppercase tracking-wider select-none border-b border-slate-100">
              <th className="px-4 w-16 text-center">Roll</th>
              <th className="px-4 min-w-[220px]">Student Name</th>
              <th className="px-4 hidden sm:table-cell w-32">Admission ID</th>
              <th className="px-4 min-w-[240px] text-center">Attendance Status</th>
              <th className="px-4 min-w-[200px]">Notes &amp; Remarks</th>
              <th className="px-4 text-right w-28">30-Day Rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs sm:text-sm text-[#121c2a]">
            {filteredRoster.map((student) => (
              <tr
                key={student.studentId}
                className={`transition-colors h-14 ${getRowBg(student.status)}`}
              >
                {/* Roll */}
                <td className="px-4 text-center font-mono font-medium text-[#464555]">
                  #{student.rollNumber}
                </td>

                {/* Student Info */}
                <td className="px-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={student.avatar}
                      alt={student.studentName}
                      className="w-9 h-9 rounded-full object-cover shrink-0 ring-2 ring-slate-100"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="font-semibold text-xs sm:text-sm text-[#121c2a] truncate">
                        {student.studentName}
                      </span>
                      {student.streak && (
                        <span
                          className={`text-[11px] font-medium flex items-center gap-1 ${
                            student.status === 'absent'
                              ? 'text-[#ba1a1a]'
                              : student.status === 'late'
                              ? 'text-[#92400e]'
                              : 'text-[#006c49]'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              student.status === 'absent'
                                ? 'bg-[#ba1a1a]'
                                : student.status === 'late'
                                ? 'bg-[#ffb95f]'
                                : 'bg-[#006c49]'
                            }`}
                          ></span>
                          {student.streak}
                        </span>
                      )}
                    </div>
                  </div>
                </td>

                {/* Admission ID */}
                <td className="px-4 hidden sm:table-cell font-mono text-xs text-[#464555]">
                  {student.admissionId}
                </td>

                {/* Status Toggle Buttons P / A / L / E */}
                <td className="px-4">
                  <div className="flex items-center justify-center gap-1 bg-[#eff4ff] p-1 rounded-xl max-w-[200px] mx-auto border border-indigo-100/50">
                    {/* Present */}
                    <button
                      disabled={isLocked}
                      onClick={() =>
                        dispatch(
                          setStudentStatus({ studentId: student.studentId, status: 'present' })
                        )
                      }
                      className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all ${
                        student.status === 'present'
                          ? 'bg-[#ecfdf5] text-[#065f46] shadow-xs'
                          : 'text-[#464555] hover:bg-white/60'
                      }`}
                    >
                      P
                    </button>

                    {/* Absent */}
                    <button
                      disabled={isLocked}
                      onClick={() =>
                        dispatch(
                          setStudentStatus({ studentId: student.studentId, status: 'absent' })
                        )
                      }
                      className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all ${
                        student.status === 'absent'
                          ? 'bg-[#fef2f2] text-[#991b1b] shadow-xs'
                          : 'text-[#464555] hover:bg-white/60'
                      }`}
                    >
                      A
                    </button>

                    {/* Late */}
                    <button
                      disabled={isLocked}
                      onClick={() =>
                        dispatch(
                          setStudentStatus({ studentId: student.studentId, status: 'late' })
                        )
                      }
                      className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all ${
                        student.status === 'late'
                          ? 'bg-[#fffbeb] text-[#92400e] shadow-xs'
                          : 'text-[#464555] hover:bg-white/60'
                      }`}
                    >
                      L
                    </button>

                    {/* Leave */}
                    <button
                      disabled={isLocked}
                      onClick={() =>
                        dispatch(
                          setStudentStatus({ studentId: student.studentId, status: 'leave' })
                        )
                      }
                      className={`flex-1 py-1 rounded-lg text-xs font-bold transition-all ${
                        student.status === 'leave'
                          ? 'bg-[#d9e3f6] text-[#121c2a] shadow-xs'
                          : 'text-[#464555] hover:bg-white/60'
                      }`}
                    >
                      E
                    </button>
                  </div>
                </td>

                {/* Remarks Field */}
                <td className="px-4">
                  <input
                    type="text"
                    disabled={isLocked}
                    value={student.remark}
                    onChange={(e) =>
                      dispatch(
                        setStudentRemark({
                          studentId: student.studentId,
                          remark: e.target.value,
                        })
                      )
                    }
                    placeholder={
                      remarksExpanded
                        ? 'Write detailed behavioral notes or accommodations...'
                        : 'Add remark...'
                    }
                    className={`w-full text-xs text-[#121c2a] placeholder:text-[#777587] py-1 px-2 rounded-lg transition-colors focus:outline-none ${
                      remarksExpanded
                        ? 'bg-[#eff4ff] shadow-inner border border-slate-200'
                        : 'bg-transparent hover:bg-[#eff4ff] focus:bg-[#eff4ff]'
                    }`}
                  />
                </td>

                {/* 30-Day Rate */}
                <td className="px-4 text-right font-semibold text-xs text-[#006c49]">
                  {student.attendanceRate}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="px-6 py-3 bg-[#eff4ff] flex flex-col sm:flex-row items-center justify-between text-[#464555] gap-2 text-xs border-t border-slate-100">
        <span>
          Showing {filteredRoster.length} of {roster.length} enrolled students for period 09:00 AM –
          09:45 AM
        </span>
        <div className="flex items-center gap-4 text-[11px] font-semibold">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#006c49]"></span> Present (P)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ba1a1a]"></span> Absent (A)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ffb95f]"></span> Late (L)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#777587]"></span> Excused (E)
          </span>
        </div>
      </div>
    </div>
  );
};
