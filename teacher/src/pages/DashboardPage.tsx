import React, { useState, useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { setCurrentTab, addToast } from '../store/slices/uiSlice';
import { openLessonModal, markLessonStarted, endLessonThunk, fetchTeacherLessonsThunk } from '../store/slices/timetableSlice';
import { fetchDutySummaryThunk } from '../store/slices/dutySlice';
import { requestApi } from '../services/api';
import { TimetableLesson } from '../types';
import { dateKeyInZone, dayOfWeekInZone } from '../lib/timezone';
import { useSocketEvent } from '../hooks/useSocket';
import { RealtimeEvents } from '../services/socketService';
import {
  Calendar,
  Clock,
  Video,
  UserCheck,
  FileCheck,
  Bell,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCw,
  FileText,
  X,
  ExternalLink
} from 'lucide-react';

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
  const submissions = useAppSelector((state) => state.tasks.submissions);
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

  // Active in-session stopwatch
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
      return Date.now();
    };

    const startMs = getStartTimestamp();
    const updateElapsed = () => {
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((now - startMs) / 1000));
      setLiveElapsedSeconds(diffSec);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [liveLesson]);

  const formatStopwatch = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const liveHoursAccrued = (liveElapsedSeconds / 3600).toFixed(2);
  const completedCount = todayLessons.filter((l) => l.status === 'completed').length;
  const pendingGradingCount = submissions.filter((s) => s.status === 'pending' || s.status === 'late').length;

  const handleLaunchZoomLesson = async (lesson: TimetableLesson) => {
    try {
      setStartingLessonId(lesson.id);
      dispatch(
        addToast({
          message: `Opening ${lesson.className} classroom link...`,
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
        } catch (apiErr) {
          console.warn('Backend start session call fell back to persistent link:', apiErr);
        }
      }

      dispatch(markLessonStarted(lesson.id));
      window.open(targetUrl, '_blank');
      dispatch(
        addToast({
          message: `Classroom launched. In Zoom, use Host PIN: ${lesson.hostKey || '884422'}.`,
          type: 'success',
        })
      );
    } finally {
      setStartingLessonId(null);
    }
  };

  const handleConfirmEndLesson = async () => {
    if (!liveLesson?.rawId) return;
    try {
      setIsEndingLesson(true);
      await dispatch(
        endLessonThunk({
          lessonId: liveLesson.rawId,
          topic: endTopic || 'Class instruction delivered',
          notes: endNotes,
        })
      ).unwrap();
      setShowEndModal(false);
      dispatch(
        addToast({
          message: `Class concluded successfully. Teaching duty hours updated.`,
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

  return (
    <div className="flex flex-col w-full pb-10 space-y-5">
      {/* 1. Clean Welcome Hero */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <img
            src={teacher.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
            alt={teacher.name}
            className="w-12 h-12 rounded-full object-cover ring-2 ring-indigo-100 shrink-0"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Welcome, {teacher.name.split(',')[0]}
              </h1>
              {liveLesson ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping" />
                  Teaching Live
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Ready
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })} • {teacher.department || 'Senior Faculty'}
            </p>
          </div>
        </div>

        {/* Quick Action Button */}
        <div className="flex items-center gap-2.5">
          {nextLesson && (
            <button
              onClick={() => handleLaunchZoomLesson(nextLesson)}
              disabled={startingLessonId === nextLesson.id}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Video className="w-4 h-4" />
              <span>{startingLessonId === nextLesson.id ? 'Launching...' : `Start ${nextLesson.className} Class`}</span>
            </button>
          )}

          <button
            onClick={() => dispatch(setCurrentTab('live-lessons'))}
            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <span>All Classrooms</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. 4 Clean, Distinct Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Today's Classes */}
        <div
          onClick={() => dispatch(setCurrentTab('timetable'))}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Today's Classes</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-extrabold text-slate-900">{todayLessons.length}</span>
            <span className="text-xs text-slate-500 ml-1.5 font-medium">({completedCount} completed)</span>
          </div>
          <div className="mt-2 text-[11px] font-semibold text-indigo-600 flex items-center gap-1">
            <span>View timetable</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Teaching Duty Hours */}
        <div
          onClick={() => dispatch(setCurrentTab('duty-salary'))}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-emerald-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Today's Duty</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-extrabold text-slate-900">{duty.todayTeachingHours || 0}h {duty.todayTeachingMinutes || 0}m</span>
            {liveLesson && <span className="text-xs text-emerald-600 ml-1 font-bold">(+{liveHoursAccrued}h live)</span>}
          </div>
          <div className="mt-2 text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
            <span>Duty &amp; payroll details</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Submissions to Grade */}
        <div
          onClick={() => dispatch(setCurrentTab('submissions-grading'))}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-amber-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">To Grade</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-extrabold text-slate-900">{pendingGradingCount}</span>
            <span className="text-xs text-slate-500 ml-1.5 font-medium">pending reviews</span>
          </div>
          <div className="mt-2 text-[11px] font-semibold text-amber-600 flex items-center gap-1">
            <span>Grade submissions</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>

        {/* Notices */}
        <div
          onClick={() => dispatch(setCurrentTab('notices'))}
          className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs hover:border-purple-300 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">School Notices</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Bell className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-extrabold text-slate-900">{notices.length}</span>
            <span className="text-xs text-slate-500 ml-1.5 font-medium">active bulletins</span>
          </div>
          <div className="mt-2 text-[11px] font-semibold text-purple-600 flex items-center gap-1">
            <span>Read announcements</span>
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </div>

      {/* 3. In-Session Duty Card (Only when class is active) */}
      {liveLesson && (
        <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-2xl p-5 text-white shadow-md border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500 text-white text-[11px] font-bold uppercase">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                Class in Progress
              </span>
              <span className="text-xs text-emerald-200 font-medium">
                Room: {liveLesson.zoomRoomId}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white">
              {liveLesson.className} • {liveLesson.subject}
            </h2>
            <p className="text-xs text-emerald-200/90 font-medium">
              Elapsed: <span className="font-mono font-bold text-white text-sm">{formatStopwatch(liveElapsedSeconds)}</span> • Duty Accrued: <span className="font-bold text-amber-300">+{liveHoursAccrued}h</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleLaunchZoomLesson(liveLesson)}
              className="px-4 py-2 bg-white hover:bg-emerald-50 text-emerald-950 text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Video className="w-4 h-4 text-emerald-600" />
              <span>Re-Join Classroom</span>
            </button>
            <button
              onClick={() => {
                setEndTopic(liveLesson.topic || liveLesson.subject);
                setShowEndModal(true);
              }}
              className="px-4 py-2 bg-emerald-700/80 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl border border-emerald-400/30 flex items-center gap-1.5 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Conclude Class</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. Today's Class Schedule Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">Today's Teaching Schedule</h2>
            <span className="text-[11px] font-medium text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
              {teacherTz}
            </span>
          </div>

          <button
            onClick={() => dispatch(setCurrentTab('timetable'))}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
          >
            <span>Full Week</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200 h-9">
                <th className="px-4 w-32">Time</th>
                <th className="px-4 w-28">Class</th>
                <th className="px-4 min-w-[160px]">Subject &amp; Topic</th>
                <th className="px-4 w-28">Room</th>
                <th className="px-4 text-center w-28">Status</th>
                <th className="px-4 text-right w-44">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {todayLessons.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    <Calendar className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                    <p className="text-xs font-semibold text-slate-600">No scheduled classes found for today</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Check your weekly timetable for other days</p>
                  </td>
                </tr>
              ) : (
                todayLessons.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/70 h-13 transition-colors">
                    <td className="px-4 font-mono font-bold text-slate-800">
                      {l.startTime} - {l.endTime}
                    </td>
                    <td className="px-4">
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 font-bold text-xs border border-indigo-100">
                        {l.className}
                      </span>
                    </td>
                    <td className="px-4">
                      <span className="font-bold text-slate-900 block">{l.subject}</span>
                      <span className="text-[11px] text-slate-500 truncate block max-w-xs">{l.topic || 'Curriculum instruction'}</span>
                    </td>
                    <td className="px-4 text-slate-600 font-medium">{l.room || 'Virtual Hub'}</td>
                    <td className="px-4 text-center">
                      {l.status === 'completed' ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[11px] border border-emerald-200">
                          Delivered
                        </span>
                      ) : l.status === 'live' ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 font-bold text-[11px] border border-red-200 animate-pulse">
                          Live Now
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium text-[11px]">
                          Scheduled
                        </span>
                      )}
                    </td>
                    <td className="px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleLaunchZoomLesson(l)}
                          disabled={startingLessonId === l.id}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
                          title={`Launch ${l.className} Zoom`}
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>{startingLessonId === l.id ? 'Starting...' : 'Join Zoom'}</span>
                        </button>
                        <button
                          onClick={() => dispatch(setCurrentTab('student-attendance'))}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition-colors"
                          title="Mark class attendance"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
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

      {/* 5. Two-Column Overview: Active Tasks + Notices */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Active Assignments (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Active Tasks &amp; Homework</h3>
            </div>
            <button
              onClick={() => dispatch(setCurrentTab('tasks-assignments'))}
              className="text-xs font-bold text-indigo-600 hover:underline"
            >
              View All
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {tasks.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <FileCheck className="w-6 h-6 mx-auto mb-1.5 text-slate-300" />
                <p className="text-xs font-semibold">No active assignments</p>
              </div>
            ) : (
              tasks.slice(0, 4).map((task) => (
                <div key={task.id} className="p-3.5 hover:bg-slate-50 flex items-center justify-between gap-3 transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                        {task.className}
                      </span>
                      <h4 className="font-bold text-xs text-slate-900 truncate">{task.title}</h4>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Deadline: <span className="text-red-600 font-semibold">{task.deadline.split(',')[0]}</span> • Turnout: <span className="font-semibold text-slate-700">{task.submittedCount}/{task.totalStudents}</span>
                    </p>
                  </div>

                  <button
                    onClick={() => dispatch(setCurrentTab('submissions-grading'))}
                    className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold shrink-0 transition-colors shadow-xs"
                  >
                    Grade
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Notices & Bulletins (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Recent Notices</h3>
            </div>
            <button
              onClick={() => dispatch(setCurrentTab('notices'))}
              className="text-xs font-bold text-indigo-600 hover:underline"
            >
              All Notices
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {notices.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Bell className="w-6 h-6 mx-auto mb-1.5 text-slate-300" />
                <p className="text-xs font-semibold">No notices published</p>
              </div>
            ) : (
              notices.slice(0, 3).map((n) => (
                <div key={n.id} className="p-3.5 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                    <span className="font-bold text-indigo-700">{n.category}</span>
                    <span>{n.date}</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 leading-snug line-clamp-1">{n.title}</h4>
                  <p className="text-[11px] text-slate-600 line-clamp-1 mt-0.5">{n.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Conclude Lesson Modal */}
      {showEndModal && liveLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Conclude Live Class</h3>
                  <p className="text-xs text-slate-500">{liveLesson.className} • {liveLesson.subject}</p>
                </div>
              </div>
              <button
                onClick={() => setShowEndModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-emerald-50 rounded-xl p-3.5 border border-emerald-200 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-emerald-900 block uppercase">Instruction Duration</span>
                <span className="text-lg font-black text-emerald-800 font-mono">{formatStopwatch(liveElapsedSeconds)}</span>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold text-emerald-900 block uppercase">Duty Credit</span>
                <span className="text-lg font-black text-emerald-700">+{liveHoursAccrued} hrs</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Topic Covered</label>
                <input
                  type="text"
                  value={endTopic}
                  onChange={(e) => setEndTopic(e.target.value)}
                  placeholder="e.g. Chapter 4 Practice Problems"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Teaching Notes (Optional)</label>
                <textarea
                  value={endNotes}
                  onChange={(e) => setEndNotes(e.target.value)}
                  placeholder="Notes for homework assigned or coordination..."
                  rows={2}
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium resize-none"
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
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isEndingLesson ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm &amp; Conclude</span>
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
