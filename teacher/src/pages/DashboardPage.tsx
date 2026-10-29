import React, { useState, useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { setCurrentTab, addToast } from '../store/slices/uiSlice';
import { openLessonModal, markLessonStarted, endLessonThunk, fetchTeacherLessonsThunk } from '../store/slices/timetableSlice';
import { fetchDutySummaryThunk } from '../store/slices/dutySlice';
import { KeyMetricsWidget } from '../components/dashboard/KeyMetricsWidget';
import { requestApi } from '../services/api';
import { TimetableLesson } from '../types';
import { dateKeyInZone, dayOfWeekInZone } from '../lib/timezone';
import { useSocketEvent } from '../hooks/useSocket';
import { RealtimeEvents } from '../services/socketService';

export const DashboardPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const teacher = useAppSelector((state) => state.auth.teacher);

  useSocketEvent(RealtimeEvents.CLASS_STATUS_UPDATED, () => {
    dispatch(fetchTeacherLessonsThunk());
    dispatch(fetchDutySummaryThunk());
  });

  useSocketEvent(RealtimeEvents.TEACHER_DUTY_UPDATED, () => {
    dispatch(fetchTeacherLessonsThunk());
    dispatch(fetchDutySummaryThunk());
  });

  useSocketEvent(RealtimeEvents.TEACHER_ATTENDANCE_UPDATED, () => {
    dispatch(fetchTeacherLessonsThunk());
    dispatch(fetchDutySummaryThunk());
  });
  const lessons = useAppSelector((state) => state.timetable.lessons);
  const teacherTz = useAppSelector((state) => state.timetable.timezone);
  const tasks = useAppSelector((state) => state.tasks.tasks);
  const duty = useAppSelector((state) => state.duty.summary);
  const notices = useAppSelector((state) => state.notices.notices);
  const [startingLessonId, setStartingLessonId] = useState<string | null>(null);

  // Live in-session duty tracking state
  const [liveElapsedSeconds, setLiveElapsedSeconds] = useState<number>(0);
  const [showEndModal, setShowEndModal] = useState<boolean>(false);
  const [endTopic, setEndTopic] = useState<string>('');
  const [endNotes, setEndNotes] = useState<string>('');
  const [isEndingLesson, setIsEndingLesson] = useState<boolean>(false);

  const todayStr = useMemo(() => {
    return dateKeyInZone(new Date(), teacherTz || 'Asia/Karachi');
  }, [teacherTz]);

  const todayDayName = useMemo(() => {
    return dayOfWeekInZone(new Date(), teacherTz || 'Asia/Karachi');
  }, [teacherTz]);

  const todayLessons = useMemo<TimetableLesson[]>(() => {
    return lessons
      .filter((l: TimetableLesson) => {
        if (l.date) {
          return l.date === todayStr;
        }
        return l.dayOfWeek?.toLowerCase() === todayDayName.toLowerCase();
      })
      .slice(0, 6);
  }, [lessons, todayStr, todayDayName]);

  const liveLesson = useMemo<TimetableLesson | undefined>(() => {
    return todayLessons.find((l: TimetableLesson) => l.status === 'live');
  }, [todayLessons]);

  const nextLesson = useMemo<TimetableLesson | undefined>(() => {
    return liveLesson || todayLessons.find((l: TimetableLesson) => l.status === 'scheduled') || todayLessons[0];
  }, [liveLesson, todayLessons]);

  // Active in-session stopwatch effect
  useEffect(() => {
    if (!liveLesson) {
      setLiveElapsedSeconds(0);
      return;
    }

    const getStartTimestamp = () => {
      if (liveLesson.actualStartTime) {
        const parsed = new Date(liveLesson.actualStartTime).getTime();
        if (!isNaN(parsed) && parsed > 0) return parsed;
      }
      const todayStr = new Date().toISOString().split('T')[0];
      let timeStr = (liveLesson.startTime || '').trim();
      if (timeStr.includes('AM') || timeStr.includes('PM')) {
        const [t, mod] = timeStr.split(' ');
        let [h, m] = t.split(':').map(Number);
        if (mod === 'PM' && h < 12) h += 12;
        if (mod === 'AM' && h === 12) h = 0;
        timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
      } else if (timeStr.length === 5) {
        timeStr = `${timeStr}:00`;
      }
      const d = new Date(`${liveLesson.date || todayStr}T${timeStr}`);
      if (!isNaN(d.getTime())) return d.getTime();
      return Date.now();
    };

    const startMs = getStartTimestamp();
    const updateElapsed = () => {
      const diffSec = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      setLiveElapsedSeconds(diffSec);
    };

    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [liveLesson?.id, liveLesson?.actualStartTime, liveLesson?.status]);

  // Proactive S2S sync while class is live (syncs every 10s so leaving Zoom stops timer automatically)
  useEffect(() => {
    if (!liveLesson) return;

    const syncLiveStatus = () => {
      dispatch(fetchTeacherLessonsThunk());
      dispatch(fetchDutySummaryThunk());
    };

    const interval = setInterval(syncLiveStatus, 10000);
    return () => clearInterval(interval);
  }, [liveLesson?.id, dispatch]);

  const formatStopwatch = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const liveHoursAccrued = (liveElapsedSeconds / 3600).toFixed(2);

  // Exact daily teaching hours calculation (combining completed lessons + live session)
  const completedLessonsToday = useMemo(() => {
    return todayLessons.filter((l) => l.status === 'completed');
  }, [todayLessons]);

  const todayCompletedDutyMinutes = useMemo(() => {
    if (duty.todayTeachingMinutes && duty.todayTeachingMinutes > 0) {
      return duty.todayTeachingMinutes;
    }
    return completedLessonsToday.reduce((acc, l) => {
      return acc + (l.verifiedDutyMinutes || 45);
    }, 0);
  }, [duty.todayTeachingMinutes, completedLessonsToday]);

  const liveMinutesCurrent = Math.floor(liveElapsedSeconds / 60);
  const totalTodayMinutes = todayCompletedDutyMinutes + (liveLesson ? liveMinutesCurrent : 0);
  const exactTodayHours = Math.floor(totalTodayMinutes / 60);
  const exactTodayMins = totalTodayMinutes % 60;
  const exactTodayHoursDecimal = (totalTodayMinutes / 60).toFixed(2);

  const isStartingIn5Min = (() => {
    if (!nextLesson || liveLesson) return false;
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

  const handleOpenEndModal = (lesson: TimetableLesson) => {
    setEndTopic(lesson.topic || lesson.subject || 'Core Curriculum Instruction');
    setEndNotes('');
    setShowEndModal(true);
  };

  const handleConfirmEndLesson = async () => {
    if (!liveLesson?.rawId) return;
    try {
      setIsEndingLesson(true);
      await dispatch(
        endLessonThunk({
          lessonId: liveLesson.rawId,
          topic: endTopic,
          notes: endNotes,
        })
      ).unwrap();
      setShowEndModal(false);
      dispatch(
        addToast({
          message: `Class concluded! +${liveHoursAccrued} verified teaching hours credited to your payroll duty ledger.`,
          type: 'success',
        })
      );
    } catch (err: any) {
      dispatch(
        addToast({
          message: err || 'Failed to conclude session. Please try again.',
          type: 'error',
        })
      );
    } finally {
      setIsEndingLesson(false);
    }
  };

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

  return (
    <div className="flex flex-col w-full pb-8 space-y-5">
      {/* Top Header: Simple greeting & real-time automated tracking status */}
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
              {liveLesson ? (
                <span className="flex items-center gap-1.5 font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-0.5 rounded-full border border-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping"></span>
                  Zoom Class Active • Auto-Tracking
                </span>
              ) : (
                <span className="flex items-center gap-1.5 font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  Zoom S2S Auto-Duty Ready
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Real-time Daily Teaching Hours Metric Pill (No manual buttons) */}
          <div className="px-3.5 py-2 bg-white text-[#121c2a] text-xs font-semibold rounded-xl border border-slate-200 shadow-xs flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              liveLesson ? 'bg-emerald-600 text-white animate-pulse' : 'bg-indigo-50 text-[#3525cd]'
            }`}>
              <span className="material-symbols-outlined text-[17px]">{liveLesson ? 'timer' : 'timelapse'}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-[#777587] block leading-none">Today's Teaching</span>
              <span className="text-xs font-extrabold text-[#121c2a]">
                {exactTodayHours}h {exactTodayMins}m {liveLesson ? `(+${liveHoursAccrued}h)` : ''}
              </span>
            </div>
          </div>

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
        <div className={`bg-white px-4 py-3 rounded-xl border shadow-xs flex items-center justify-between ${
          liveLesson ? 'border-emerald-300 ring-2 ring-emerald-500/20 bg-gradient-to-r from-emerald-50/50 to-white' : 'border-slate-200'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              liveLesson ? 'bg-emerald-600 text-white animate-pulse' : 'bg-emerald-50 text-[#006c49]'
            }`}>
              <span className="material-symbols-outlined text-[20px]">{liveLesson ? 'timer' : 'schedule'}</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-[#777587] uppercase tracking-wider block">
                  Today's Teaching
                </span>
                {liveLesson && (
                  <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[9px] font-extrabold rounded-full animate-pulse flex items-center gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping"></span>
                    Live Now
                  </span>
                )}
              </div>
              <span className="text-sm font-extrabold text-[#121c2a]">
                {exactTodayHours}h {exactTodayMins}m {liveLesson ? `(+${liveHoursAccrued}h)` : ''} • {completedLessonsToday.length}/{todayLessons.length} Done
              </span>
              <span className="text-[10px] text-[#777587] block font-medium">
                Cycle: {duty.totalDutyHours}h / {duty.targetDutyHours}h target
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
              <span className="text-sm font-extrabold text-[#121c2a]">
                {new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date())} • Term 2
              </span>
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

      {/* Prominent Live In-Session Duty Tracker Banner OR Up Next Hero */}
      {liveLesson ? (
        <div className="bg-gradient-to-r from-emerald-700 via-teal-800 to-indigo-900 rounded-2xl p-5 text-white shadow-lg border border-emerald-400/40 relative overflow-hidden">
          <div className="absolute -right-12 -top-12 w-48 h-48 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
          <div className="absolute right-32 -bottom-10 w-36 h-36 bg-emerald-400/10 rounded-full blur-xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            {/* Left Column: Live Status & Class Info */}
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/90 text-white text-[11px] font-black tracking-wider uppercase shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
                  CLASS IN PROGRESS • DUTY TIME TRACKER ACTIVE
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-md text-[11px] font-semibold text-emerald-100 border border-white/10">
                  Room: {liveLesson.zoomRoomId}
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-200 text-[11px] font-bold border border-amber-300/30">
                  Host Key: {liveLesson.hostKey || '884422'}
                </span>
              </div>

              <div>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>{liveLesson.className}</span>
                  <span className="text-emerald-300 font-bold">•</span>
                  <span>{liveLesson.subject}</span>
                </h2>
                <p className="text-xs sm:text-sm text-emerald-100/90 font-medium mt-0.5 max-w-xl">
                  {liveLesson.topic || 'Core Instruction & Practical Exercises'} • Started at {liveLesson.actualStartTime ? new Date(liveLesson.actualStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (liveLesson.startTime || 'Scheduled Time')}
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-emerald-200">
                <span className="material-symbols-outlined text-[16px] text-emerald-300">verified_user</span>
                <span>Zoom Server-to-Server tracking active • Duration automatically logged to monthly Payroll ledger</span>
              </div>
            </div>

            {/* Right Column: Running Stopwatch & Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center lg:flex-col lg:items-end gap-3 shrink-0">
              {/* Digital Stopwatch & Accruing Hours */}
              <div className="bg-black/30 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/15 flex items-center gap-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200 block">
                    Elapsed Class Time
                  </span>
                  <span className="text-2xl sm:text-3xl font-black font-mono tracking-wider text-white">
                    {formatStopwatch(liveElapsedSeconds)}
                  </span>
                </div>
                <div className="h-8 w-px bg-white/20"></div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200 block">
                    Accruing Duty
                  </span>
                  <span className="text-xl sm:text-2xl font-extrabold text-amber-300">
                    +{liveHoursAccrued}h
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleLaunchZoomLesson(liveLesson)}
                  disabled={startingLessonId === liveLesson.id}
                  className="px-4 py-2.5 bg-white hover:bg-emerald-50 text-emerald-950 text-xs font-black rounded-xl shadow-md flex items-center gap-1.5 transition-all transform hover:scale-[1.02]"
                >
                  <span className="material-symbols-outlined text-[18px] text-emerald-600">videocam</span>
                  <span>Re-Join Classroom</span>
                </button>

                <div className="px-3.5 py-2.5 bg-emerald-500/25 text-emerald-100 text-xs font-bold rounded-xl border border-emerald-400/40 flex items-center gap-1.5 shadow-xs">
                  <span className="material-symbols-outlined text-[17px] text-emerald-300">auto_mode</span>
                  <span>Auto-Stops When You Leave Zoom</span>
                </div>

                <button
                  onClick={() => handleOpenEndModal(liveLesson)}
                  className="px-3 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl border border-white/20 flex items-center gap-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[17px]">edit_note</span>
                  <span>Lesson Notes</span>
                </button>

                <button
                  onClick={() => dispatch(setCurrentTab('student-attendance'))}
                  className="px-3 py-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl border border-white/20 transition-colors"
                >
                  Attendance
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : nextLesson ? (
        <div className={`bg-white rounded-xl p-4 border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 ${
          isStartingIn5Min
            ? 'border-amber-300 bg-gradient-to-r from-amber-50/80 to-white'
            : 'border-indigo-200 bg-gradient-to-r from-indigo-50/50 to-white'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl text-white flex items-center justify-center shrink-0 ${
              isStartingIn5Min ? 'bg-amber-600 animate-bounce' : 'bg-[#4f46e5]'
            }`}>
              <span className="material-symbols-outlined text-[22px]">videocam</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                {isStartingIn5Min ? (
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
                isStartingIn5Min
                  ? 'bg-amber-600 hover:bg-amber-500 shadow-md ring-2 ring-amber-400/50'
                  : 'bg-[#4f46e5] hover:bg-[#3525cd]'
              }`}
            >
              <span className={`material-symbols-outlined text-[16px] ${startingLessonId === nextLesson.id ? 'animate-spin' : ''}`}>
                {startingLessonId === nextLesson.id ? 'sync' : 'videocam'}
              </span>
              <span>{startingLessonId === nextLesson.id ? 'Launching...' : 'Join Zoom Room'}</span>
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
            <span className="text-[10px] font-semibold text-[#3525cd] bg-white border border-indigo-100 px-2 py-0.5 rounded-full shadow-2xs">
              {teacherTz}
            </span>
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
                      {l.startTime} - {l.endTime}
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

      {/* End Lesson Confirmation & Duty Settlement Modal */}
      {showEndModal && liveLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px]">stop_circle</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#121c2a]">Conclude Live Class</h3>
                  <p className="text-xs text-slate-500">{liveLesson.className} • {liveLesson.subject}</p>
                </div>
              </div>
              <button
                onClick={() => setShowEndModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Time tracked summary box */}
            <div className="bg-emerald-50 rounded-xl p-3.5 border border-emerald-200/80 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-emerald-900 block uppercase tracking-wider">
                  Verified Instruction Time
                </span>
                <span className="text-lg font-black text-emerald-800 font-mono">
                  {formatStopwatch(liveElapsedSeconds)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold text-emerald-900 block uppercase tracking-wider">
                  Payroll Credit
                </span>
                <span className="text-lg font-black text-emerald-700">
                  +{liveHoursAccrued} hrs
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Concluding this session will stamp the leave time, submit verified teaching hours to your payroll record, and make the classroom link available for the next period instructor.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Topic Covered
                </label>
                <input
                  type="text"
                  value={endTopic}
                  onChange={(e) => setEndTopic(e.target.value)}
                  placeholder="e.g. Chapter 4 Practice Problems"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Teaching / Handover Notes (Optional)
                </label>
                <textarea
                  value={endNotes}
                  onChange={(e) => setEndNotes(e.target.value)}
                  placeholder="Notes for academic coordination or homework assigned..."
                  rows={2}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowEndModal(false)}
                disabled={isEndingLesson}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmEndLesson}
                disabled={isEndingLesson}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isEndingLesson ? (
                  <>
                    <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    <span>Confirm &amp; Settle Duty Hours</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
