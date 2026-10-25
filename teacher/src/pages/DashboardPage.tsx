import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { toggleClockInOut } from '../store/slices/authSlice';
import { setCurrentTab, addToast } from '../store/slices/uiSlice';
import { openLessonModal, markLessonStarted } from '../store/slices/timetableSlice';
import { KeyMetricsWidget } from '../components/dashboard/KeyMetricsWidget';
import { requestApi } from '../services/api';
import { TimetableLesson } from '../types';

export const DashboardPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const teacher = useAppSelector((state) => state.auth.teacher);
  const lessons = useAppSelector((state) => state.timetable.lessons);
  const tasks = useAppSelector((state) => state.tasks.tasks);
  const duty = useAppSelector((state) => state.duty.summary);
  const notices = useAppSelector((state) => state.notices.notices);
  const [startingLessonId, setStartingLessonId] = useState<string | null>(null);

  const todayLessons = lessons.slice(0, 4);
  const nextLesson = lessons.find((l) => l.status === 'scheduled' || l.status === 'live') || lessons[0];

  const isStartingIn5Min = (() => {
    if (!nextLesson) return false;
    const now = Date.now();
    const todayStr = new Date().toISOString().split('T')[0];
    let timeStr = (nextLesson.startTime || '').trim();
    if (!timeStr) return false;
    if (timeStr.includes('AM') || timeStr.includes('PM')) {
      const [t, mod] = timeStr.split(' ');
      let [h, m] = t.split(':').map(Number);
      if (mod === 'PM' && h < 12) h += 12;
      if (mod === 'AM' && h === 12) h = 0;
      timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
    } else if (timeStr.length === 5) {
      timeStr = `${timeStr}:00`;
    }
    const d = new Date(`${nextLesson.date || todayStr}T${timeStr}`);
    const diff = (d.getTime() - now) / 60000;
    return diff > 0 && diff <= 5;
  })();

  const handleLaunchZoomLesson = async (lesson: TimetableLesson) => {
    try {
      setStartingLessonId(lesson.id);
      dispatch(
        addToast({
          message: `Connecting to ${lesson.className} classroom link...`,
          type: 'info',
        })
      );

      let targetUrl = `https://zoom.us/j/${lesson.zoomRoomId.replace(/-/g, '')}?pwd=${lesson.zoomPasscode}`;

      if (lesson.rawId) {
        try {
          const res = await requestApi<any>(`/api/v1/zoom/sessions/${lesson.rawId}/start`, {
            method: 'POST',
          });
          if (res?.joinUrl) {
            targetUrl = res.joinUrl;
          }
          if (res?.hostTransitioned) {
            dispatch(
              addToast({
                message: `Host handoff completed for ${lesson.className}. Previous teacher session concluded cleanly.`,
                type: 'info',
              })
            );
          }
        } catch (apiErr) {
          console.warn('Backend start session call fell back to persistent link:', apiErr);
        }
      }

      dispatch(markLessonStarted(lesson.id));
      window.open(targetUrl, '_blank');
      dispatch(
        addToast({
          message: `Live classroom launched for ${lesson.className}. In Zoom: Click Participants ➔ Claim Host (PIN: ${lesson.hostKey || '884422'}).`,
          type: 'success',
        })
      );
    } finally {
      setStartingLessonId(null);
    }
  };

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
      {nextLesson ? (
        <div className={`bg-white rounded-xl p-4 border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 ${
          nextLesson.status === 'live'
            ? 'border-emerald-300 bg-gradient-to-r from-emerald-50/60 to-white'
            : isStartingIn5Min
            ? 'border-amber-300 bg-gradient-to-r from-amber-50/80 to-white'
            : 'border-indigo-200 bg-gradient-to-r from-indigo-50/50 to-white'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0 ${
              nextLesson.status === 'live'
                ? 'bg-emerald-600 animate-pulse'
                : isStartingIn5Min
                ? 'bg-amber-600 animate-bounce'
                : 'bg-[#4f46e5]'
            }`}>
              <span className="material-symbols-outlined text-[22px]">videocam</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                {nextLesson.status === 'live' ? (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 animate-pulse flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                    LIVE NOW • HOST ACTIVE
                  </span>
                ) : isStartingIn5Min ? (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 animate-pulse flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                    STARTS IN 5 MIN • PREPARE TO HOST
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-[#3525cd]">
                    NEXT CLASS • {nextLesson.startTime}
                  </span>
                )}
                <span className="text-xs font-bold text-[#121c2a]">
                  {nextLesson.className} ({nextLesson.subject})
                </span>
              </div>
              <p className="text-xs text-[#464555] mt-0.5">
                {nextLesson.topic} • Room: <span className="font-mono font-semibold text-slate-800">{nextLesson.zoomRoomId}</span> • Host Key: <span className="font-mono font-bold text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">{nextLesson.hostKey || '884422'}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              onClick={() => handleLaunchZoomLesson(nextLesson)}
              disabled={startingLessonId === nextLesson.id}
              className={`px-4 py-2 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-all ${
                nextLesson.status === 'live'
                  ? 'bg-emerald-600 hover:bg-emerald-500'
                  : isStartingIn5Min
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-md ring-2 ring-amber-400/50'
                  : 'bg-[#4f46e5] hover:bg-[#3525cd]'
              }`}
            >
              <span className={`material-symbols-outlined text-[16px] ${startingLessonId === nextLesson.id ? 'animate-spin' : ''}`}>
                {startingLessonId === nextLesson.id ? 'sync' : 'videocam'}
              </span>
              <span>{startingLessonId === nextLesson.id ? 'Launching...' : nextLesson.status === 'live' ? 'Re-Join Live Room' : 'Join Zoom Room'}</span>
            </button>
            <button
              onClick={() => dispatch(setCurrentTab('student-attendance'))}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-[#121c2a] text-xs font-semibold rounded-lg border border-slate-200"
            >
              Attendance
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[22px]">event_available</span>
            </div>
            <div>
              <h3 className="text-xs font-bold text-[#121c2a]">No upcoming classes scheduled</h3>
              <p className="text-xs text-[#777587] mt-0.5">All scheduled periods for today are concluded or no classes currently assigned.</p>
            </div>
          </div>
          <button
            onClick={() => dispatch(setCurrentTab('timetable'))}
            className="px-3 py-1.5 bg-[#eff4ff] hover:bg-[#dee9fc] text-[#3525cd] text-xs font-bold rounded-lg transition-colors"
          >
            Timetable
          </button>
        </div>
      )}

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
              {todayLessons.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <span className="material-symbols-outlined text-[24px] text-slate-300">event_busy</span>
                      <p className="text-xs font-semibold text-slate-500">No scheduled classes found today</p>
                    </div>
                  </td>
                </tr>
              ) : (
                todayLessons.map((l) => (
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
                      ) : l.status === 'live' ? (
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
                        <button
                          onClick={() => handleLaunchZoomLesson(l)}
                          disabled={startingLessonId === l.id}
                          className="px-2.5 py-1 rounded-lg bg-[#eff4ff] hover:bg-[#dee9fc] text-[#3525cd] text-[11px] font-bold flex items-center gap-1 transition-colors"
                          title={`Launch ${l.className} live Zoom room`}
                        >
                          <span className={`material-symbols-outlined text-[14px] ${startingLessonId === l.id ? 'animate-spin' : ''}`}>
                            {startingLessonId === l.id ? 'sync' : 'videocam'}
                          </span>
                          <span>{startingLessonId === l.id ? 'Opening...' : 'Zoom'}</span>
                        </button>
                        <button
                          onClick={() => dispatch(openLessonModal(l))}
                          className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[#121c2a] text-[11px] font-semibold"
                        >
                          Log
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
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
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <span className="material-symbols-outlined text-[24px] text-slate-300">task_alt</span>
                        <p className="text-xs font-semibold text-slate-500">No active assignments</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  tasks.map((task) => (
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
                  ))
                )}
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
            {notices.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <span className="material-symbols-outlined text-[24px] text-slate-300">campaign</span>
                <p className="text-xs font-semibold text-slate-500 mt-1">No notices published</p>
              </div>
            ) : (
              notices.slice(0, 3).map((n) => (
                <div key={n.id} className="p-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between text-[11px] text-[#777587] mb-0.5">
                    <span className="font-bold text-[#3525cd]">{n.category}</span>
                    <span>{n.date}</span>
                  </div>
                  <h4 className="text-xs font-bold text-[#121c2a] leading-tight truncate">{n.title}</h4>
                  <p className="text-[11px] text-[#464555] line-clamp-1 mt-0.5">{n.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
