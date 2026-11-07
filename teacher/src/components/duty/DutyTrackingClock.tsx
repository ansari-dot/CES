import React, { useState, useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { useSocketEvent } from '../../hooks/useSocket';
import { RealtimeEvents, identifyTeacher } from '../../services/socketService';
import { requestApi } from '../../services/api';
import { fetchDutySummaryThunk } from '../../store/slices/dutySlice';
import { fetchTeacherLessonsThunk, updateLessonRealtimeStatus } from '../../store/slices/timetableSlice';
import { TimetableLesson } from '../../types';
import {
  Clock,
  Radio,
  CheckCircle2,
  Calendar,
  Sparkles,
  ExternalLink,
  Info,
  ShieldCheck,
  Video
} from 'lucide-react';

interface DutyTrackingClockProps {
  className?: string;
  showClassDetails?: boolean;
  onlyWhenActive?: boolean;
  actions?: React.ReactNode;
}

export const DutyTrackingClock: React.FC<DutyTrackingClockProps> = ({
  className = '',
  showClassDetails = true,
  onlyWhenActive = false,
  actions
}) => {
  const dispatch = useAppDispatch();
  const lessons = useAppSelector((state) => state.timetable.lessons);
  const teacher = useAppSelector((state) => state.auth.teacher);
  const duty = useAppSelector((state) => state.duty.summary);

  // Real-time state
  const [liveElapsedSeconds, setLiveElapsedSeconds] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [concludedSession, setConcludedSession] = useState<{
    lessonName: string;
    verifiedMinutes: number;
    endedAt: Date;
    startedAt: Date | null;
  } | null>(null);

  // Find the currently active live lesson
  const liveLesson = useMemo<TimetableLesson | undefined>(() => {
    return lessons.find(
      (l) => l.status === 'live' || l.sessionState?.toUpperCase() === 'LIVE'
    );
  }, [lessons]);

  // Ensure teacher room subscription is registered with socket
  useEffect(() => {
    if (teacher?.id) {
      identifyTeacher(teacher.id);
    }
  }, [teacher?.id]);

  // Current real-time wall-clock ticker (1 second)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Real-time duty tracking ticker
  useEffect(() => {
    if (!liveLesson) {
      setLiveElapsedSeconds(0);
      return;
    }

    // Determine the exact lesson start timestamp
    const getStartTimestamp = () => {
      if (liveLesson.actualStartTime) {
        const parsed = new Date(liveLesson.actualStartTime).getTime();
        const diff = Date.now() - parsed;
        // Only accept if start timestamp is valid and within last 6 hours
        if (!isNaN(parsed) && parsed > 0 && diff >= 0 && diff < 6 * 3600 * 1000) {
          return parsed;
        }
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

  // Active status check while lesson is live (detects Zoom departure if webhook delayed/offline)
  useEffect(() => {
    if (!liveLesson) return;

    const checkLiveSession = async () => {
      try {
        const res = await requestApi<any>('/api/v1/zoom/my-class-session');
        if (Array.isArray(res)) {
          const liveRawNum = Number(liveLesson.rawId || String(liveLesson.id).replace(/\D/g, ''));
          const liveClassNum = Number(String(liveLesson.classId).split('-')[0].replace(/\D/g, ''));

          const match = res.find((r: any) => {
            const rId = Number(r.id);
            if (rId && liveRawNum && rId === liveRawNum) return true;
            const rClassNum = Number(String(r.classId || r.class_id || '').split('-')[0].replace(/\D/g, ''));
            if (rClassNum && liveClassNum && rClassNum === liveClassNum) return true;
            return false;
          });

          const hasAnyLive = res.some((r: any) => (r.status || '').toUpperCase() === 'LIVE');
          const isMatchCompleted = match && ((match.status || '').toUpperCase() === 'COMPLETED' || (match.sessionState || '').toUpperCase() === 'COMPLETED');

          if (isMatchCompleted || (!hasAnyLive && res.length > 0)) {
            // Teacher left Zoom meeting and backend has auto-concluded
            setLiveElapsedSeconds(0);
            setConcludedSession({
              lessonName: liveLesson.className || `Classroom #${liveLesson.classId}`,
              verifiedMinutes: match?.verifiedDutyMinutes || Math.max(1, Math.round(liveElapsedSeconds / 60)),
              endedAt: match?.actualEndTime ? new Date(match.actualEndTime) : new Date(),
              startedAt: liveLesson.actualStartTime ? new Date(liveLesson.actualStartTime) : null
            });
            dispatch(
              updateLessonRealtimeStatus({
                lessonId: liveLesson.rawId || liveLesson.id,
                status: 'completed',
                sessionState: 'COMPLETED',
                actualEndTime: match?.actualEndTime || new Date().toISOString()
              })
            );
            dispatch(fetchTeacherLessonsThunk());
            if (teacher?.id) {
              dispatch(fetchDutySummaryThunk(teacher.id));
            }
          }
        }
      } catch (err) {
        // silent heartbeat catch
      }
    };

    const timer = setInterval(checkLiveSession, 3000);
    return () => clearInterval(timer);
  }, [liveLesson, liveElapsedSeconds, dispatch, teacher?.id]);

  // 1. WEBSOCKET REAL-TIME LISTENER: TEACHER_DUTY_UPDATED
  useSocketEvent(RealtimeEvents.TEACHER_DUTY_UPDATED, (data: any) => {
    if (data?.status === 'COMPLETED') {
      // Instantly stop the active timer in frontend without page reload
      setLiveElapsedSeconds(0);

      // Record the concluded duty session details
      if (liveLesson) {
        setConcludedSession({
          lessonName: liveLesson.className || `Classroom #${liveLesson.classId}`,
          verifiedMinutes: data.verifiedMinutes || Math.round(liveElapsedSeconds / 60) || 45,
          endedAt: data.sessionEnd ? new Date(data.sessionEnd) : new Date(),
          startedAt: liveLesson.actualStartTime ? new Date(liveLesson.actualStartTime) : null
        });
      }

      // Mark the lesson completed in Redux memory
      if (data.lessonId) {
        dispatch(
          updateLessonRealtimeStatus({
            lessonId: data.lessonId,
            status: 'completed',
            sessionState: 'COMPLETED'
          })
        );
      }
    }

    // Re-fetch authoritative duty summary & lessons
    dispatch(fetchTeacherLessonsThunk());
    if (teacher?.id) {
      dispatch(fetchDutySummaryThunk(teacher.id));
    }
  });

  // 2. WEBSOCKET REAL-TIME LISTENER: CLASS_STATUS_UPDATED
  useSocketEvent(RealtimeEvents.CLASS_STATUS_UPDATED, (data: any) => {
    if (data?.status === 'COMPLETED') {
      // Instantly stop the timer
      setLiveElapsedSeconds(0);

      if (liveLesson) {
        setConcludedSession({
          lessonName: liveLesson.className || `Classroom #${liveLesson.classId}`,
          verifiedMinutes: data.verifiedMinutes || Math.round(liveElapsedSeconds / 60) || 1,
          endedAt: data.actualEndTime ? new Date(data.actualEndTime) : new Date(),
          startedAt: liveLesson.actualStartTime ? new Date(liveLesson.actualStartTime) : null
        });
      }

      if (data.lessonId || liveLesson?.rawId) {
        dispatch(
          updateLessonRealtimeStatus({
            lessonId: data.lessonId || liveLesson?.rawId || liveLesson?.id,
            status: 'completed',
            sessionState: 'COMPLETED'
          })
        );
      }
    } else if (data?.status === 'LIVE' && data.lessonId) {
      setConcludedSession(null);
      dispatch(
        updateLessonRealtimeStatus({
          lessonId: data.lessonId,
          status: 'live',
          sessionState: 'LIVE',
          actualStartTime: data.actualStartTime || new Date().toISOString()
        })
      );
    }

    dispatch(fetchTeacherLessonsThunk());
    if (teacher?.id) {
      dispatch(fetchDutySummaryThunk(teacher.id));
    }
  });

  // Format date/time to 12-hour format with AM/PM
  const format12Hour = (date: Date | string | null | undefined): string => {
    if (!date) return '—';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  // Split live elapsed seconds into hours, minutes, and seconds count
  const elapsedBreakdown = useMemo(() => {
    const hours = Math.floor(liveElapsedSeconds / 3600);
    const minutes = Math.floor((liveElapsedSeconds % 3600) / 60);
    const seconds = liveElapsedSeconds % 60;
    return {
      h: String(hours).padStart(2, '0'),
      m: String(minutes).padStart(2, '0'),
      s: String(seconds).padStart(2, '0'),
      rawHours: hours,
      rawMinutes: minutes,
      rawSeconds: seconds
    };
  }, [liveElapsedSeconds]);

  // Circular progress dial calculations
  const radius = 64;
  const circumference = 2 * Math.PI * radius; // ~402.12
  // Visual progress: complete revolution every 60 seconds, or 45-min lesson progress
  const progressPercent = liveLesson ? (liveElapsedSeconds % 3600) / 3600 : 0;
  const strokeDashoffset = circumference - progressPercent * circumference;

  // Render when class is LIVE
  if (liveLesson) {
    return (
      <div
        className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 text-white p-6 sm:p-7 shadow-xl border border-indigo-500/30 ${className}`}
      >
        {/* Glowing backdrop halo */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-6">
          {/* Left Details */}
          <div className="flex-1 space-y-3 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-black tracking-wider uppercase shadow-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
              <span>Live Zoom Teaching Duty in Progress</span>
            </div>

            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {liveLesson.className} · {liveLesson.subject || liveLesson.topic || 'Active Classroom'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1">
                Zoom duty tracking is active on the server. When you leave the Zoom meeting, tracking stops automatically via webhook.
              </p>
            </div>

            {/* Time meta tags in 12-hour format */}
            <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 pt-1 text-xs">
              <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15 flex items-center gap-2 text-indigo-200">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>
                  Started At:{' '}
                  <strong className="text-white font-mono">
                    {format12Hour(liveLesson.actualStartTime || new Date())}
                  </strong>
                </span>
              </div>

              <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15 flex items-center gap-2 text-emerald-200">
                <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>
                  Current Time:{' '}
                  <strong className="text-white font-mono">{format12Hour(currentTime)}</strong>
                </span>
              </div>

              <div className="px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-xs border border-white/15 flex items-center gap-2 text-amber-200">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Webhook Auto-Stop Enabled</span>
              </div>
            </div>

            {/* Action Buttons */}
            {actions ? (
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 pt-2">
                {actions}
              </div>
            ) : liveLesson.zoomRoomId ? (
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 pt-2">
                <a
                  href={`https://zoom.us/j/${liveLesson.zoomRoomId.replace(/-/g, '')}?pwd=${liveLesson.zoomPasscode}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-white hover:bg-emerald-50 text-emerald-950 text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  <Video className="w-4 h-4 text-emerald-600" />
                  <span>Re-Join Classroom</span>
                </a>
              </div>
            ) : null}
          </div>

          {/* Right: Circular Clock Timer Display (Exact User Mockup Fit) */}
          <div className="relative shrink-0 flex flex-col items-center justify-center p-3">
            <div className="relative w-44 h-44 sm:w-48 sm:h-48 flex items-center justify-center">
              {/* Outer Circular SVG Dial */}
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
                {/* 12 Clock Hour Dial Ticks */}
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((hour) => {
                  const angle = (hour * 30 - 90) * (Math.PI / 180);
                  const x1 = 80 + 71 * Math.cos(angle);
                  const y1 = 80 + 71 * Math.sin(angle);
                  const x2 = 80 + 77 * Math.cos(angle);
                  const y2 = 80 + 77 * Math.sin(angle);
                  return (
                    <line
                      key={hour}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={hour % 3 === 0 ? '#a5b4fc' : '#475569'}
                      strokeWidth={hour % 3 === 0 ? '2' : '1'}
                      strokeLinecap="round"
                    />
                  );
                })}

                {/* Background Ring */}
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-slate-800"
                  fill="transparent"
                />
                {/* Animated Glowing Progress Ring */}
                <circle
                  cx="80"
                  cy="80"
                  r={radius}
                  stroke="url(#liveClockGradient)"
                  strokeWidth="9"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-linear drop-shadow-[0_0_8px_rgba(244,63,94,0.7)]"
                  fill="transparent"
                />
                <defs>
                  <linearGradient id="liveClockGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f43f5e" />
                    <stop offset="50%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Central Digital Readout (Hours, Minutes, Seconds Count) */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300/80 mb-0.5">
                  Duty Time
                </span>

                {/* HH : MM : SS Digital Counter */}
                <div className="flex items-center font-mono font-black text-2xl sm:text-3xl text-white tracking-tight leading-none drop-shadow-md">
                  <span>{elapsedBreakdown.h}</span>
                  <span className="text-rose-400 mx-0.5 animate-pulse">:</span>
                  <span>{elapsedBreakdown.m}</span>
                  <span className="text-rose-400 mx-0.5 animate-pulse">:</span>
                  <span className="text-emerald-400">{elapsedBreakdown.s}</span>
                </div>

                {/* Micro Labels: Hours, Minutes, Seconds */}
                <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  <span>Hrs</span>
                  <span>Min</span>
                  <span>Sec</span>
                </div>

                <div className="mt-1 text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Recording</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render when a session has JUST CONCLUDED via Webhook (Immediate Real-Time Feedback)
  if (concludedSession) {
    return (
      <div
        className={`rounded-3xl bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 text-white p-6 sm:p-7 shadow-lg border border-emerald-500/40 ${className}`}
      >
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-4 text-center sm:text-left">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-lg shadow-emerald-500/20">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/25 text-emerald-300 text-[11px] font-black uppercase tracking-wider border border-emerald-400/30">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Duty Session Stopped via Zoom Webhook (Auto-Verified)</span>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-white">
                {concludedSession.lessonName} Completed · {concludedSession.verifiedMinutes} Mins Duty Accrued
              </h3>
              <p className="text-xs text-slate-300">
                Ended at <strong className="text-white font-mono">{format12Hour(concludedSession.endedAt)}</strong>
                {concludedSession.startedAt && (
                  <span>
                    {' '}(Started at <strong className="text-white font-mono">{format12Hour(concludedSession.startedAt)}</strong>)
                  </span>
                )}
                . Duty records updated instantly without page refresh.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setConcludedSession(null)}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition-colors shrink-0"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // If only active is requested, don't show standby
  if (onlyWhenActive && !liveLesson && !concludedSession) {
    return null;
  }

  // Standby Clock (No Live Session Currently in Progress)
  return (
    <div
      className={`rounded-3xl bg-white border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row items-center justify-between gap-5 ${className}`}
    >
      <div className="flex items-center gap-4 text-center md:text-left">
        {/* Analog/Digital Circular Standby Clock Icon */}
        <div className="relative w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
          <Clock className="w-7 h-7" />
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
        </div>

        <div>
          <div className="flex items-center justify-center md:justify-start gap-2">
            <span className="text-[11px] font-black text-indigo-700 uppercase tracking-wider">
              Automated Zoom Duty Tracker
            </span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
              Ready
            </span>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
            Today's Duty: {duty.todayTeachingHours || 0} hrs ({duty.todayTeachingMinutes || 0} mins)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Starts tracking automatically when you join your Zoom classroom. Current time:{' '}
            <strong className="text-slate-800 font-mono font-semibold">{format12Hour(currentTime)}</strong>.
          </p>
        </div>
      </div>

      {/* Standby Live Clock Widget in 12-Hour Format */}
      <div className="flex items-center gap-3 self-stretch md:self-auto justify-center bg-slate-50 px-4 py-3 rounded-2xl border border-slate-200/70">
        <div className="text-right">
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            Campus Clock (12h)
          </span>
          <span className="text-lg font-mono font-black text-slate-900 block leading-tight">
            {format12Hour(currentTime)}
          </span>
        </div>
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
      </div>
    </div>
  );
};
