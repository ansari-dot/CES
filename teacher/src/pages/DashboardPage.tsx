import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { toggleClockInOut } from '../store/slices/authSlice';
import { setCurrentTab, addToast } from '../store/slices/uiSlice';
import { openLessonModal } from '../store/slices/timetableSlice';
import { KeyMetricsWidget } from '../components/dashboard/KeyMetricsWidget';

export const DashboardPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const teacher = useAppSelector((state) => state.auth.teacher);
  const lessons = useAppSelector((state) => state.timetable.lessons);
  const tasks = useAppSelector((state) => state.tasks.tasks);
  const duty = useAppSelector((state) => state.duty.summary);
  const notices = useAppSelector((state) => state.notices.notices);

  const todayLessons = lessons.slice(0, 4);

  const handleClockToggle = () => {
    dispatch(toggleClockInOut());
    dispatch(
      addToast({
        message: teacher.isDutyClockedIn ? 'Clocked out for break' : 'Clocked in active',
        type: 'info',
      })
    );
  };

  return (
    <div className="flex flex-col w-full pb-8 space-y-5">
      {/* Top Header: Simple greeting & 2 fast action buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src={teacher.avatar}
            alt={teacher.name}
            className="w-12 h-12 rounded-full object-cover ring-2 ring-indigo-100"
          />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#121c2a]">
              {teacher.name.split(',')[0]}
            </h1>
            <div className="flex items-center gap-2 text-xs text-[#777587]">
              <span>{teacher.employeeId}</span>
              <span>•</span>
              <span className="flex items-center gap-1 font-semibold text-[#006c49]">
                <span className="w-2 h-2 rounded-full bg-[#006c49] animate-pulse"></span>
                {teacher.isDutyClockedIn ? 'Clocked In' : 'On Break'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleClockToggle}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-[#121c2a] text-xs font-semibold rounded-xl border border-slate-200 shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[17px]">timer</span>
            <span>{teacher.isDutyClockedIn ? 'Clock Out' : 'Clock In'}</span>
          </button>
          <button
            onClick={() => dispatch(setCurrentTab('live-lessons'))}
            className="px-4 py-2 bg-[#4f46e5] hover:bg-[#3525cd] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-[17px]">videocam</span>
            <span>Live Zoom Rooms</span>
          </button>
        </div>
      </div>

      {/* Prominent Key Metrics Widget: Pending Assignments, Upcoming Lessons, Student Notifications */}
      <KeyMetricsWidget />
      {/* Duty & Campus Status Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#006c49] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">schedule</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#777587] uppercase tracking-wider block">
                Teaching Duty
              </span>
              <span className="text-sm font-extrabold text-[#121c2a]">
                {duty.totalDutyHours} / {duty.targetDutyHours}h Logged
              </span>
            </div>
          </div>
          <button
            onClick={() => dispatch(setCurrentTab('duty-salary'))}
            className="text-xs font-bold text-[#3525cd] hover:underline"
          >
            Roster
          </button>
        </div>

        <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-[#92400e] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">fact_check</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#777587] uppercase tracking-wider block">
                Roster Sign-Off
              </span>
              <span className="text-sm font-extrabold text-[#92400e]">Period 1 Pending</span>
            </div>
          </div>
          <button
            onClick={() => dispatch(setCurrentTab('student-attendance'))}
            className="text-xs font-bold text-[#92400e] hover:underline"
          >
            Sign Now
          </button>
        </div>

        <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between sm:col-span-2 lg:col-span-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-[#3525cd] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[20px]">calendar_today</span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#777587] uppercase tracking-wider block">
                School Timetable
              </span>
              <span className="text-sm font-extrabold text-[#121c2a]">Wednesday • Term 2</span>
            </div>
          </div>
          <button
            onClick={() => dispatch(setCurrentTab('timetable'))}
            className="text-xs font-bold text-[#3525cd] hover:underline"
          >
            View
          </button>
        </div>
      </div>

      {/* Hero Banner: Up Next */}
      <div className="bg-white rounded-xl p-4 border border-indigo-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-r from-indigo-50/50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#4f46e5] text-white flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[22px]">videocam</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.2 rounded bg-indigo-100 text-[#3525cd]">
                NEXT CLASS • 10:30 AM
              </span>
              <span className="text-xs font-bold text-[#121c2a]">Class 6-B (Science)</span>
            </div>
            <p className="text-xs text-[#464555] mt-0.5">Solar &amp; Wind Energy Systems • Room ID: 849 2039 1102</p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-auto">
          <button
            onClick={() =>
              dispatch(
                addToast({
                  message: 'Launching Zoom meeting for Class 6-B...',
                  type: 'success',
                })
              )
            }
            className="px-4 py-2 bg-[#4f46e5] hover:bg-[#3525cd] text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">videocam</span>
            <span>Join Zoom</span>
          </button>
          <button
            onClick={() => dispatch(setCurrentTab('student-attendance'))}
            className="px-3 py-2 bg-white hover:bg-slate-50 text-[#121c2a] text-xs font-semibold rounded-lg border border-slate-200"
          >
            Attendance
          </button>
        </div>
      </div>

      {/* Main Section: Today's Schedule Table (Rows) */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="p-3.5 bg-[#eff4ff]/60 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#3525cd] text-[18px]">calendar_today</span>
            <h2 className="text-sm font-bold text-[#121c2a]">Today&apos;s Schedule</h2>
          </div>
          <button
            onClick={() => dispatch(setCurrentTab('timetable'))}
            className="text-xs font-bold text-[#3525cd] hover:underline flex items-center gap-1"
          >
            <span>Timetable</span>
            <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#eff4ff] text-[#464555] font-bold uppercase tracking-wider border-b border-slate-200 h-9">
                <th className="px-3 w-28">Time</th>
                <th className="px-3 w-24">Class</th>
                <th className="px-3 min-w-[160px]">Subject &amp; Topic</th>
                <th className="px-3 w-28">Room</th>
                <th className="px-3 text-center w-24">Status</th>
                <th className="px-3 text-right w-32">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {todayLessons.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50 h-12 transition-colors">
                  <td className="px-3 font-mono font-bold text-[#121c2a]">
                    {l.startTime.split(' ')[0]} - {l.endTime.split(' ')[0]}
                  </td>
                  <td className="px-3">
                    <span className="px-2 py-0.5 rounded bg-[#eff4ff] text-[#3525cd] font-bold text-[11px] border border-indigo-100">
                      {l.className}
                    </span>
                  </td>
                  <td className="px-3">
                    <span className="font-bold text-[#121c2a] block">{l.subject}</span>
                    <span className="text-[11px] text-[#777587] truncate block max-w-[220px]">{l.topic}</span>
                  </td>
                  <td className="px-3 text-[#464555] font-semibold">{l.room}</td>
                  <td className="px-3 text-center">
                    {l.status === 'completed' ? (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[#065f46] font-bold text-[10px]">
                        Delivered
                      </span>
                    ) : l.id === 'LES-02' ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[#065f46] font-bold text-[10px] animate-pulse">
                        Live Now
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[#777587] font-semibold text-[10px]">
                        Scheduled
                      </span>
                    )}
                  </td>
                  <td className="px-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {l.id === 'LES-01' ? (
                        <button
                          onClick={() => dispatch(setCurrentTab('student-attendance'))}
                          className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-[#92400e] text-[11px] font-bold"
                        >
                          Attendance
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            dispatch(
                              addToast({
                                message: `Launching Zoom for ${l.className}...`,
                                type: 'success',
                              })
                            )
                          }
                          className="px-2.5 py-1 rounded-lg bg-[#eff4ff] hover:bg-[#dee9fc] text-[#3525cd] text-[11px] font-bold flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">videocam</span>
                          Zoom
                        </button>
                      )}
                      <button
                        onClick={() => dispatch(openLessonModal(l))}
                        className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#121c2a] text-[11px] font-semibold"
                      >
                        Log
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two Column Section: Tasks Table + Bulletins List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Active Tasks Table (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-3.5 bg-[#eff4ff]/60 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#3525cd] text-[18px]">assignment</span>
              <h3 className="text-sm font-bold text-[#121c2a]">Active Assignments</h3>
            </div>
            <button
              onClick={() => dispatch(setCurrentTab('tasks-assignments'))}
              className="text-xs font-bold text-[#3525cd] hover:underline"
            >
              View All
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#eff4ff] text-[#464555] font-bold uppercase tracking-wider border-b border-slate-200 h-9">
                  <th className="px-3">Assignment</th>
                  <th className="px-3 w-20">Class</th>
                  <th className="px-3 w-28">Deadline</th>
                  <th className="px-3 text-center w-24">Turnout</th>
                  <th className="px-3 text-right w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50 h-11 transition-colors">
                    <td className="px-3 font-semibold text-[#121c2a] truncate max-w-[180px]">
                      {task.title}
                    </td>
                    <td className="px-3 font-bold text-[#3525cd]">{task.className}</td>
                    <td className="px-3 font-medium text-[#ba1a1a]">{task.deadline.split(',')[0]}</td>
                    <td className="px-3 text-center font-bold text-[#121c2a]">
                      {task.submittedCount}/{task.totalStudents}
                    </td>
                    <td className="px-3 text-right">
                      <button
                        onClick={() => dispatch(setCurrentTab('submissions-grading'))}
                        className="px-2.5 py-1 rounded-lg bg-[#4f46e5] text-white hover:bg-[#3525cd] text-[11px] font-bold shadow-xs"
                      >
                        Grade
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Notices & Bulletins Table (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="p-3.5 bg-[#eff4ff]/60 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#3525cd] text-[18px]">campaign</span>
              <h3 className="text-sm font-bold text-[#121c2a]">Notices</h3>
            </div>
            <button
              onClick={() => dispatch(setCurrentTab('notices'))}
              className="text-xs font-bold text-[#3525cd] hover:underline"
            >
              All Notices
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {notices.slice(0, 3).map((n) => (
              <div key={n.id} className="p-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between text-[11px] text-[#777587] mb-0.5">
                  <span className="font-bold text-[#3525cd]">{n.category}</span>
                  <span>{n.date}</span>
                </div>
                <h4 className="text-xs font-bold text-[#121c2a] leading-tight truncate">{n.title}</h4>
                <p className="text-[11px] text-[#464555] line-clamp-1 mt-0.5">{n.content}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
