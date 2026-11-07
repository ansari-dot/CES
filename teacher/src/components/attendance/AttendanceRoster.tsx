import React from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  setStudentStatus,
  setStudentRemark,
  markAllRemainingPresent,
  markAllAbsent
} from '../../store/slices/attendanceSlice';
import { AttendanceStatus } from '../../types';
import {
  Check,
  X,
  Clock,
  HelpCircle,
  CheckCircle2,
  XCircle,
  CheckSquare,
  Square
} from 'lucide-react';

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

  const allPresent = roster.length > 0 && roster.every((s) => s.status === 'present');
  const somePresent = roster.some((s) => s.status === 'present');

  const handleToggleMasterCheckbox = () => {
    if (isLocked) return;
    if (allPresent) {
      dispatch(markAllAbsent());
    } else {
      dispatch(markAllRemainingPresent());
    }
  };

  const getRowBg = (status: AttendanceStatus) => {
    if (status === 'absent') return 'bg-red-50/40 hover:bg-red-50/60 border-l-4 border-l-red-500';
    if (status === 'late' || status === 'leave') return 'bg-amber-50/40 hover:bg-amber-50/60 border-l-4 border-l-amber-500';
    if (status === 'excused') return 'bg-indigo-50/40 hover:bg-indigo-50/60 border-l-4 border-l-indigo-500';
    return 'odd:bg-slate-50/50 hover:bg-slate-100/60 border-l-4 border-l-emerald-500';
  };

  return (
    <div className="bg-white rounded-xl shadow-xs overflow-hidden border border-slate-200">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/90 h-12 text-slate-600 text-xs font-semibold select-none border-b border-slate-200">
              {/* Master Checkbox: Check = Present, Uncheck = Absent */}
              <th className="px-4 py-2 w-14 text-center">
                <button
                  type="button"
                  disabled={isLocked || roster.length === 0}
                  onClick={handleToggleMasterCheckbox}
                  className="flex items-center justify-center cursor-pointer text-slate-500 hover:text-emerald-700 transition-colors disabled:opacity-40"
                  title={allPresent ? 'Uncheck All (Mark All Absent)' : 'Check All (Mark All Present)'}
                >
                  {allPresent ? (
                    <CheckSquare className="w-5 h-5 text-emerald-600" />
                  ) : somePresent ? (
                    <div className="w-4 h-4 rounded bg-emerald-600 text-white flex items-center justify-center text-[10px] font-bold">
                      -
                    </div>
                  ) : (
                    <Square className="w-5 h-5 text-slate-400" />
                  )}
                </button>
              </th>
              <th className="px-3 py-2 w-16 text-center uppercase tracking-wider">Roll #</th>
              <th className="px-4 py-2 min-w-[200px] uppercase tracking-wider">Student Name</th>
              
              {/* Presence Checkbox Column */}
              <th className="px-4 py-2 min-w-[140px] text-center uppercase tracking-wider border-l border-slate-100">
                Attendance Check
              </th>

              {/* Status Switcher (P/A/L/E) */}
              <th className="px-3 py-2 w-20 text-center border-l border-slate-100" title="P = Present">
                <div className="flex flex-col items-center justify-center leading-none">
                  <span className="text-emerald-700 font-extrabold text-sm">P</span>
                  <span className="text-[10px] text-slate-400 font-normal">Present</span>
                </div>
              </th>
              <th className="px-3 py-2 w-20 text-center border-l border-slate-100" title="A = Absent">
                <div className="flex flex-col items-center justify-center leading-none">
                  <span className="text-red-600 font-extrabold text-sm">A</span>
                  <span className="text-[10px] text-slate-400 font-normal">Absent</span>
                </div>
              </th>
              <th className="px-3 py-2 w-20 text-center border-l border-slate-100" title="L = Leave/Late">
                <div className="flex flex-col items-center justify-center leading-none">
                  <span className="text-amber-600 font-extrabold text-sm">L</span>
                  <span className="text-[10px] text-slate-400 font-normal">Leave</span>
                </div>
              </th>
              <th className="px-3 py-2 w-20 text-center border-l border-slate-100" title="E = Excused">
                <div className="flex flex-col items-center justify-center leading-none">
                  <span className="text-indigo-600 font-extrabold text-sm">E</span>
                  <span className="text-[10px] text-slate-400 font-normal">Excused</span>
                </div>
              </th>

              <th className="px-4 py-2 min-w-[200px] uppercase tracking-wider border-l border-slate-100">
                Remarks / Notes
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs sm:text-sm text-slate-800">
            {filteredRoster.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400">
                  <span className="material-symbols-outlined text-3xl mb-1 text-slate-300 block">group_off</span>
                  <p className="font-medium text-xs text-slate-600">No students enrolled in this roster.</p>
                </td>
              </tr>
            ) : (
              filteredRoster.map((student) => {
                const isP = student.status === 'present';
                const isA = student.status === 'absent';
                const isL = student.status === 'leave' || student.status === 'late';
                const isE = student.status === 'excused';

                const togglePresence = () => {
                  if (isLocked) return;
                  // If present, uncheck to absent. If absent/leave/excused, check to present.
                  if (isP) {
                    dispatch(setStudentStatus({ studentId: student.studentId, status: 'absent' }));
                  } else {
                    dispatch(setStudentStatus({ studentId: student.studentId, status: 'present' }));
                  }
                };

                return (
                  <tr
                    key={student.studentId}
                    className={`transition-colors h-14 ${getRowBg(student.status)}`}
                  >
                    {/* Checkbox: Checked = Present (✓), Unchecked = Absent (✗) */}
                    <td className="px-4 py-2 text-center">
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={togglePresence}
                        className={`w-6 h-6 rounded flex items-center justify-center mx-auto transition-all cursor-pointer ${
                          isP
                            ? 'bg-emerald-600 text-white shadow-xs hover:bg-emerald-700'
                            : 'border-2 border-red-300 bg-white hover:border-red-500 text-red-500'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={isP ? 'Click to mark Absent' : 'Click to mark Present'}
                      >
                        {isP ? <Check className="w-4 h-4 stroke-[3]" /> : <X className="w-3.5 h-3.5 stroke-[2.5]" />}
                      </button>
                    </td>

                    {/* Roll # */}
                    <td className="px-3 py-2 text-center font-mono font-semibold text-slate-600">
                      #{student.rollNumber}
                    </td>

                    {/* Student Info */}
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-3">
                        <img
                          src={student.avatar}
                          alt={student.studentName}
                          className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-slate-200"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-xs sm:text-sm text-slate-900 truncate">
                            {student.studentName}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">
                            {student.admissionId}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Status Pill Badge with Toggle Click */}
                    <td className="px-4 py-2 text-center border-l border-slate-100">
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={togglePresence}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                          isP
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
                            : isA
                            ? 'bg-red-100 text-red-800 hover:bg-red-200 border border-red-300'
                            : isL
                            ? 'bg-amber-100 text-amber-900 hover:bg-amber-200 border border-amber-300'
                            : 'bg-indigo-100 text-indigo-800 hover:bg-indigo-200 border border-indigo-300'
                        } disabled:opacity-60 disabled:cursor-not-allowed`}
                        title="Click to toggle Present / Absent"
                      >
                        {isP && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                        {isA && <XCircle className="w-3.5 h-3.5 text-red-600" />}
                        {isL && <Clock className="w-3.5 h-3.5 text-amber-600" />}
                        {isE && <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />}
                        <span>
                          {isP ? 'Present' : isA ? 'Absent' : isL ? 'Leave' : 'Excused'}
                        </span>
                      </button>
                    </td>

                    {/* Column P: Present Quick Button */}
                    <td className="px-3 py-2 text-center border-l border-slate-100">
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() =>
                          dispatch(setStudentStatus({ studentId: student.studentId, status: 'present' }))
                        }
                        className={`w-8 h-8 rounded-lg inline-flex items-center justify-center font-bold text-xs transition-all cursor-pointer ${
                          isP
                            ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-300'
                            : 'border border-slate-300 hover:border-emerald-500 text-slate-400 hover:text-emerald-600 bg-white'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={`Mark ${student.studentName} Present`}
                      >
                        {isP ? <Check className="w-4 h-4 stroke-[3]" /> : 'P'}
                      </button>
                    </td>

                    {/* Column A: Absent Quick Button */}
                    <td className="px-3 py-2 text-center border-l border-slate-100">
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() =>
                          dispatch(setStudentStatus({ studentId: student.studentId, status: 'absent' }))
                        }
                        className={`w-8 h-8 rounded-lg inline-flex items-center justify-center font-bold text-xs transition-all cursor-pointer ${
                          isA
                            ? 'bg-red-600 text-white shadow-xs ring-2 ring-red-300'
                            : 'border border-slate-300 hover:border-red-500 text-slate-400 hover:text-red-600 bg-white'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={`Mark ${student.studentName} Absent`}
                      >
                        {isA ? <X className="w-4 h-4 stroke-[3]" /> : 'A'}
                      </button>
                    </td>

                    {/* Column L: Leave Quick Button */}
                    <td className="px-3 py-2 text-center border-l border-slate-100">
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() =>
                          dispatch(setStudentStatus({ studentId: student.studentId, status: 'leave' }))
                        }
                        className={`w-8 h-8 rounded-lg inline-flex items-center justify-center font-bold text-xs transition-all cursor-pointer ${
                          isL
                            ? 'bg-amber-500 text-white shadow-xs ring-2 ring-amber-300'
                            : 'border border-slate-300 hover:border-amber-500 text-slate-400 hover:text-amber-600 bg-white'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={`Mark ${student.studentName} on Leave`}
                      >
                        {isL ? <Clock className="w-4 h-4 stroke-[2.5]" /> : 'L'}
                      </button>
                    </td>

                    {/* Column E: Excused Quick Button */}
                    <td className="px-3 py-2 text-center border-l border-slate-100">
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() =>
                          dispatch(setStudentStatus({ studentId: student.studentId, status: 'excused' }))
                        }
                        className={`w-8 h-8 rounded-lg inline-flex items-center justify-center font-bold text-xs transition-all cursor-pointer ${
                          isE
                            ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-300'
                            : 'border border-slate-300 hover:border-indigo-500 text-slate-400 hover:text-indigo-600 bg-white'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={`Mark ${student.studentName} Excused`}
                      >
                        {isE ? <HelpCircle className="w-4 h-4 stroke-[2.5]" /> : 'E'}
                      </button>
                    </td>

                    {/* Remarks Input */}
                    <td className="px-4 py-2 border-l border-slate-100">
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
                            ? 'Add behavioral notes, excuse explanation...'
                            : 'Add note...'
                        }
                        className={`w-full text-xs text-slate-800 placeholder:text-slate-400 py-1.5 px-2.5 rounded-lg transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-400 ${
                          remarksExpanded
                            ? 'bg-slate-50 border border-slate-200 shadow-inner'
                            : 'bg-transparent hover:bg-slate-100 focus:bg-white border border-transparent focus:border-slate-300'
                        }`}
                      />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="px-5 py-3 bg-slate-50 flex flex-col sm:flex-row items-center justify-between text-slate-600 gap-2 text-xs border-t border-slate-200">
        <span className="font-medium">
          Showing {filteredRoster.length} enrolled student{filteredRoster.length === 1 ? '' : 's'}
        </span>
        <div className="flex items-center gap-4 text-[11px] font-semibold">
          <span className="flex items-center gap-1.5 text-emerald-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span> Check = Present (P)
          </span>
          <span className="flex items-center gap-1.5 text-red-600">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 inline-block"></span> Uncheck = Absent (A)
          </span>
          <span className="flex items-center gap-1.5 text-amber-600">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span> Leave (L)
          </span>
          <span className="flex items-center gap-1.5 text-indigo-600">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 inline-block"></span> Excused (E)
          </span>
        </div>
      </div>
    </div>
  );
};
