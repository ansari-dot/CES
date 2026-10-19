import React from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { setSelectedStudentId } from '../store/slices/performanceSlice';
import { addToast } from '../store/slices/uiSlice';

export const StudentPerformancePage: React.FC = () => {
  const dispatch = useAppDispatch();
  const metrics = useAppSelector((state) => state.performance.metrics);
  const selectedStudentId = useAppSelector((state) => state.performance.selectedStudentId);
  const selectedClassId = useAppSelector((state) => state.auth.selectedClassId);

  const filteredMetrics =
    selectedClassId === 'all'
      ? metrics
      : metrics.filter((m) => m.classId === selectedClassId);

  const selectedStudent =
    metrics.find((m) => m.studentId === selectedStudentId) || metrics[0];

  return (
    <div className="flex flex-col w-full pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold text-[#3525cd] uppercase tracking-wider">
              Academic Analytics
            </span>
            <span className="text-[#c7c4d8]">•</span>
            <span className="text-xs text-[#464555]">SRS Section 11</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#121c2a] tracking-tight">
            Student Performance &amp; Progress
          </h1>
          <p className="text-xs sm:text-sm text-[#464555] mt-0.5">
            Holistic academic tracking: per-student 30-day attendance fidelity, homework completion,
            quiz test distributions, and targeted improvement notes.
          </p>
        </div>

        <button
          onClick={() =>
            dispatch(
              addToast({
                message: 'Exporting comprehensive term academic report card...',
                type: 'info',
              })
            )
          }
          className="px-4 py-2.5 bg-white text-[#121c2a] hover:bg-slate-50 rounded-xl text-xs sm:text-sm font-bold shadow-xs border border-slate-200 transition-all flex items-center gap-2 self-start md:self-auto"
        >
          <span className="material-symbols-outlined text-[18px]">file_download</span>
          <span>Export Class Report</span>
        </button>
      </div>

      {/* Top Bento Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase font-bold text-[#777587]">Class Average</span>
            <h3 className="text-2xl font-black text-[#121c2a] mt-0.5">88.4%</h3>
            <span className="text-[11px] text-[#006c49] font-semibold">+2.1% from Mid-Term 1</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-[#006c49] flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">trending_up</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase font-bold text-[#777587]">
              Avg. Attendance Rate
            </span>
            <h3 className="text-2xl font-black text-[#121c2a] mt-0.5">96.0%</h3>
            <span className="text-[11px] text-[#006c49] font-semibold">23 of 26 on-streak</span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-[#3525cd] flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">fact_check</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-100 flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase font-bold text-[#777587]">
              Task Completion Rate
            </span>
            <h3 className="text-2xl font-black text-[#121c2a] mt-0.5">93.2%</h3>
            <span className="text-[11px] text-[#92400e] font-semibold">
              3 overdue reminders sent
            </span>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-[#92400e] flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">task_alt</span>
          </div>
        </div>
      </div>

      {/* Main Split: Student Roster Table (8 cols) & Deep Dive Card (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Roster Table */}
        <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 bg-[#eff4ff]/60 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#121c2a]">
              Student Academic Standing Roster
            </h3>
            <span className="text-xs text-[#777587]">Click row for individual profile</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="bg-[#eff4ff] text-[#464555] text-xs font-bold uppercase tracking-wider border-b border-slate-100">
                  <th className="p-3 w-14 text-center">Roll</th>
                  <th className="p-3 min-w-[200px]">Student</th>
                  <th className="p-3 text-center">Attendance</th>
                  <th className="p-3 text-center">Tasks</th>
                  <th className="p-3 text-center">Quiz Avg</th>
                  <th className="p-3 text-right">Stars</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMetrics.map((stu) => {
                  const isSelected = stu.studentId === selectedStudent.studentId;

                  return (
                    <tr
                      key={stu.studentId}
                      onClick={() => dispatch(setSelectedStudentId(stu.studentId))}
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-indigo-50/70 font-semibold' : 'hover:bg-[#eff4ff]/40'
                      }`}
                    >
                      <td className="p-3 text-center font-mono font-medium text-[#777587]">
                        {stu.rollNumber}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={stu.avatar}
                            alt={stu.name}
                            className="w-8 h-8 rounded-full object-cover shadow-xs"
                          />
                          <div>
                            <span className="font-bold text-[#121c2a] block">{stu.name}</span>
                            <span className="text-[11px] text-[#777587]">
                              {stu.streakStatus}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-center font-bold text-[#006c49]">
                        {stu.attendanceRate}%
                      </td>
                      <td className="p-3 text-center font-bold text-[#121c2a]">
                        {stu.taskCompletionRate}%
                      </td>
                      <td className="p-3 text-center font-bold text-[#3525cd]">
                        {stu.averageQuizScore}%
                      </td>
                      <td className="p-3 text-right font-bold text-[#684000]">
                        ⭐ {stu.starsCount}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Student Deep Dive Card */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <img
              src={selectedStudent.avatar}
              alt={selectedStudent.name}
              className="w-14 h-14 rounded-full object-cover ring-2 ring-indigo-100 shadow-sm"
            />
            <div>
              <h4 className="text-base font-bold text-[#121c2a]">{selectedStudent.name}</h4>
              <p className="text-xs text-[#777587]">
                {selectedStudent.admissionId} • Roll {selectedStudent.rollNumber}
              </p>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#006c49] mt-0.5">
                <span className="material-symbols-outlined text-[13px]">verified</span>
                {selectedStudent.streakStatus}
              </span>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 bg-[#eff4ff] rounded-xl space-y-1 border border-indigo-100/60">
              <span className="text-[#777587] font-semibold block">Target Improvement Area:</span>
              <p className="font-bold text-[#121c2a]">{selectedStudent.improvementArea}</p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] text-[#777587] block">Term Attendance</span>
                <span className="text-lg font-bold text-[#006c49]">
                  {selectedStudent.attendanceRate}%
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] text-[#777587] block">Average Score</span>
                <span className="text-lg font-bold text-[#3525cd]">
                  {selectedStudent.averageQuizScore}%
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() =>
                  dispatch(
                    addToast({
                      message: `Opened parent communication channel for ${selectedStudent.name}`,
                      type: 'info',
                    })
                  )
                }
                className="w-full py-2 rounded-xl bg-[#4f46e5] hover:bg-[#3525cd] text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">forward_to_inbox</span>
                Contact Guardian
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
