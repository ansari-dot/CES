import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { setCurrentTab, addToast } from '../store/slices/uiSlice';
import {
  markLessonStarted,
  endLessonThunk,
  fetchTeacherLessonsThunk,
  updateLessonRealtimeStatus
} from '../store/slices/timetableSlice';
import { fetchDutySummaryThunk } from '../store/slices/dutySlice';
import { requestApi } from '../services/api';
import { TimetableLesson } from '../types';
import { DutyTrackingClock } from '../components/duty/DutyTrackingClock';
import { dateKeyInZone, dayOfWeekInZone } from '../lib/timezone';
import { useSocketEvent } from '../hooks/useSocket';
import { RealtimeEvents } from '../services/socketService';
import {
  Users,
  Calendar,
  Clock,
  CheckSquare,
  Trophy,
  Video,
  UserCheck,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronUp,
  Table as TableIcon,
  Umbrella
} from 'lucide-react';
import { HolidayAnnouncementModal } from '../components/dialogs/HolidayAnnouncementModal';
import { teacherCalendarApi, ActiveHolidayAnnouncement } from '../services/calendarApi';
import UpcomingEventsCard from '../components/dashboard/UpcomingEventsCard';

// New Reference UI Components
import { HeroGreetingBanner } from '../components/dashboard/HeroGreetingBanner';
import { StatCard } from '../components/dashboard/StatCard';
import { PerformanceOverviewCard } from '../components/dashboard/PerformanceOverviewCard';
import { UpcomingClassesCard } from '../components/dashboard/UpcomingClassesCard';
import { RecentActivitiesCard } from '../components/dashboard/RecentActivitiesCard';
import { SubjectDistributionCard } from '../components/dashboard/SubjectDistributionCard';
import { QuickActionsCard } from '../components/dashboard/QuickActionsCard';
import { InspirationalQuoteCard } from '../components/dashboard/InspirationalQuoteCard';
import { ClassImminentAlertBanner } from '../components/dashboard/ClassImminentAlertBanner';
import { parseUtcInstant } from '../lib/timezone';
import {
  fetchTeacherDashboardSummary,
  TeacherDashboardSummary,
  UpcomingClassItem
} from '../services/dashboardApi';

// Helper to calculate seconds remaining until a scheduled lesson starts
function getSecondsUntilLesson(lesson: TimetableLesson | UpcomingClassItem): number | null {
  const now = new Date();

  const startAtVal = (lesson as any).startAt;
  if (startAtVal) {
    const parsed = parseUtcInstant(startAtVal) || new Date(startAtVal);
    if (!isNaN(parsed.getTime())) {
      return Math.floor((parsed.getTime() - now.getTime()) / 1000);
    }
  }

  let timeStr = (lesson as any).startTime || (lesson as any).timeSlot || '';
  if (timeStr.includes('-')) {
    timeStr = timeStr.split('-')[0].trim();
  }
  timeStr = timeStr.trim();
  if (!timeStr) return null;

  const match = timeStr.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3] ? match[3].toUpperCase() : null;

  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;

  const targetDate = new Date();
  targetDate.setHours(hours, minutes, 0, 0);

  return Math.floor((targetDate.getTime() - now.getTime()) / 1000);
}

export const DashboardPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const teacher = useAppSelector((state) => state.auth.teacher);
  const lessons = useAppSelector((state) => state.timetable.lessons);
  const teacherTz = useAppSelector((state) => state.timetable.timezone);
  const tasks = useAppSelector((state) => state.tasks.tasks);
  const submissions = useAppSelector((state) => state.tasks.submissions);
  const duty = useAppSelector((state) => state.duty.summary);
  const notices = useAppSelector((state) => state.notices.notices);

  // REST API dashboard state
  const [dashboardData, setDashboardData] = useState<TeacherDashboardSummary | null>(null);
  const [performancePeriod, setPerformancePeriod] = useState<'month' | 'term' | 'week'>('month');
  const [isLoadingApi, setIsLoadingApi] = useState<boolean>(false);

  // Local UI state
  const [startingLessonId, setStartingLessonId] = useState<string | null>(null);
  const [showDutyClock, setShowDutyClock] = useState<boolean>(false);
  const [showDetailedSchedule, setShowDetailedSchedule] = useState<boolean>(false);

  // Live in-session duty tracking state
  const [liveElapsedSeconds, setLiveElapsedSeconds] = useState<number>(0);
  const [showEndModal, setShowEndModal] = useState<boolean>(false);
  const [endTopic, setEndTopic] = useState<string>('');
  const [endNotes, setEndNotes] = useState<string>('');
  const [isEndingLesson, setIsEndingLesson] = useState<boolean>(false);

  // 5-minute pre-class imminent alert state
  const [dismissedAlertLessonId, setDismissedAlertLessonId] = useState<string | null>(null);
  const [previewAlert, setPreviewAlert] = useState<boolean>(false);
  const [imminentLesson, setImminentLesson] = useState<TimetableLesson | UpcomingClassItem | null>(null);
  const [imminentSeconds, setImminentSeconds] = useState<number>(285);

  // Official Holiday Announcement state
  const [holidayAnnouncement, setHolidayAnnouncement] = useState<ActiveHolidayAnnouncement | null>(null);
  const [showHolidayModal, setShowHolidayModal] = useState<boolean>(false);
  const [isCurrentlyOnHoliday, setIsCurrentlyOnHoliday] = useState<boolean>(false);

  const loadHolidayAnnouncement = useCallback(() => {
    teacherCalendarApi.getActiveAnnouncement().then((res) => {
      if (res?.popupAnnouncement) {
        setHolidayAnnouncement(res.popupAnnouncement);
        setIsCurrentlyOnHoliday(Boolean(res.isCurrentlyOnHoliday));
        const dismissedKey = `dismissed_holiday_${res.popupAnnouncement.id}`;
        if (!sessionStorage.getItem(dismissedKey)) {
          setShowHolidayModal(true);
        }
      } else {
        setHolidayAnnouncement(null);
        setIsCurrentlyOnHoliday(false);
      }
    }).catch(() => {});
  }, []);

  const handleCloseHolidayModal = () => {
    if (holidayAnnouncement) {
      sessionStorage.setItem(`dismissed_holiday_${holidayAnnouncement.id}`, 'true');
    }
    setShowHolidayModal(false);
  };

  // 1. Fetch REST API Dashboard Summary
  const loadDashboardData = useCallback(async (period: 'month' | 'term' | 'week') => {
    try {
      setIsLoadingApi(true);
      const data = await fetchTeacherDashboardSummary(period);
      if (data) {
        setDashboardData(data);
      }
    } catch (err) {
      console.warn('Dashboard REST API fetch failed, falling back to local store cache:', err);
    } finally {
      setIsLoadingApi(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData(performancePeriod);
  }, [loadDashboardData, performancePeriod]);

  // Initial duty summary & holiday announcement fetch
  useEffect(() => {
    dispatch(fetchDutySummaryThunk(teacher?.id));
    loadHolidayAnnouncement();
  }, [dispatch, teacher?.id, loadHolidayAnnouncement]);

  useSocketEvent('HOLIDAY_ANNOUNCEMENT', () => {
    loadHolidayAnnouncement();
  });

  useSocketEvent(RealtimeEvents.TIMETABLE_CHANGE, () => {
    dispatch(fetchTeacherLessonsThunk());
    loadHolidayAnnouncement();
  });

  // Real-time socket event listeners
  useSocketEvent(RealtimeEvents.CLASS_STATUS_UPDATED, (data: any) => {
    if (data?.status === 'COMPLETED') {
      dispatch(
        updateLessonRealtimeStatus({
          lessonId: data.lessonId || '',
          status: 'completed',
          sessionState: 'COMPLETED'
        })
      );
    }
    dispatch(fetchTeacherLessonsThunk());
    dispatch(fetchDutySummaryThunk(teacher?.id));
    loadDashboardData(performancePeriod);
  });

  useSocketEvent(RealtimeEvents.TEACHER_DUTY_UPDATED, (data: any) => {
    if (data?.status === 'COMPLETED') {
      dispatch(
        updateLessonRealtimeStatus({
          lessonId: data.lessonId || '',
          status: 'completed',
          sessionState: 'COMPLETED'
        })
      );
    }
    dispatch(fetchTeacherLessonsThunk());
    dispatch(fetchDutySummaryThunk(teacher?.id));
    loadDashboardData(performancePeriod);
  });

  useSocketEvent(RealtimeEvents.TEACHER_ATTENDANCE_UPDATED, () => {
    dispatch(fetchTeacherLessonsThunk());
    dispatch(fetchDutySummaryThunk(teacher?.id));
    loadDashboardData(performancePeriod);
  });

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
      .slice(0, 8);
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
  const completedCount = todayLessons.filter((l) => l.status === 'completed').length || (dashboardData?.metrics?.todaysClassesCompleted || 0);
  const pendingGradingCount = submissions.filter((s) => s.status === 'pending' || s.status === 'late').length;

  // Zoom launch handler
  const handleLaunchZoomLesson = async (lesson: TimetableLesson | UpcomingClassItem) => {
    try {
      setStartingLessonId(lesson.id);
      dispatch(
        addToast({
          message: `Opening ${lesson.className} classroom link...`,
          type: 'info',
        })
      );

      let targetUrl = (lesson as any).joinUrl || `https://zoom.us/j/${lesson.zoomRoomId.replace(/-/g, '')}?pwd=${lesson.zoomPasscode}`;

      const rawId = (lesson as any).rawId || ((lesson as any).slotId ? String((lesson as any).slotId) : null);
      if (rawId) {
        try {
          const res = await requestApi<any>(`/api/v1/zoom/sessions/${rawId}/start`, {
            method: 'POST',
          });
          if (res?.joinUrl) {
            targetUrl = res.joinUrl;
          }
        } catch (apiErr) {
          console.warn('Backend start session call fell back to persistent link:', apiErr);
        }
      }

      const nowIso = new Date().toISOString();
      dispatch(
        updateLessonRealtimeStatus({
          lessonId: rawId || lesson.id,
          status: 'live',
          sessionState: 'LIVE',
          actualStartTime: nowIso
        })
      );
      dispatch(markLessonStarted(lesson.id));
      window.open(targetUrl, '_blank');
      dispatch(
        addToast({
          message: `Classroom launched. In Zoom, use Host PIN: ${(lesson as any).hostKey || '884422'}.`,
          type: 'success',
        })
      );
    } finally {
      setStartingLessonId(null);
    }
  };

  // Conclude lesson handler
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
      loadDashboardData(performancePeriod);
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

  // Merge Metric Counts from REST API & Redux Store
  const totalStudentsCount = useMemo(() => {
    if (dashboardData?.metrics?.totalStudents !== undefined) {
      return dashboardData.metrics.totalStudents;
    }
    const fromClasses = teacher.assignedClasses?.reduce((acc, c) => acc + (c.enrolledCount || 0), 0);
    return fromClasses ?? 0;
  }, [dashboardData?.metrics?.totalStudents, teacher.assignedClasses]);

  const todaysClassesCount = useMemo(() => {
    if (dashboardData?.metrics?.todaysClassesCount !== undefined) {
      return dashboardData.metrics.todaysClassesCount;
    }
    return todayLessons.length;
  }, [dashboardData?.metrics?.todaysClassesCount, todayLessons.length]);

  const dutyDisplayHours = useMemo(() => {
    if (dashboardData?.metrics?.dutyHours?.displayDutyHours) {
      return dashboardData.metrics.dutyHours.displayDutyHours;
    }
    if (duty.totalDutyHours || duty.todayTeachingHours) {
      const h = Number(duty.totalDutyHours || duty.todayTeachingHours || 0);
      const m = Number(duty.todayTeachingMinutes || 0);
      return h > 0 ? `${h} hrs` : `${m} mins`;
    }
    return '0h 0m';
  }, [dashboardData?.metrics?.dutyHours, duty.totalDutyHours, duty.todayTeachingHours, duty.todayTeachingMinutes]);

  const dutyTrend = useMemo(() => {
    if (dashboardData?.metrics?.dutyHours?.trend) {
      return dashboardData.metrics.dutyHours.trend;
    }
    if (duty.completedLessonsCount) {
      return `${duty.completedLessonsCount} verified`;
    }
    return 'Verified Duty';
  }, [dashboardData?.metrics?.dutyHours?.trend, duty.completedLessonsCount]);

  const pendingTasksCount = useMemo(() => {
    if (dashboardData?.metrics?.pendingTasksCount !== undefined) {
      return dashboardData.metrics.pendingTasksCount;
    }
    return pendingGradingCount;
  }, [dashboardData?.metrics?.pendingTasksCount, pendingGradingCount]);

  const classPerformanceScore = useMemo(() => {
    if (dashboardData?.metrics?.classPerformance !== undefined && dashboardData.metrics.classPerformance > 0) {
      return `${dashboardData.metrics.classPerformance}%`;
    }
    return '88%';
  }, [dashboardData?.metrics?.classPerformance]);

  // Prepare upcoming classes list for the widget
  const upcomingClassesList = useMemo<UpcomingClassItem[]>(() => {
    if (todayLessons.length > 0) {
      const palette = ['emerald', 'amber', 'purple', 'blue'];
      return todayLessons.slice(0, 4).map((l, idx) => {
        const grade = l.className.replace(/[^0-9]/g, '') || String(idx + 1);
        const sec = 'A';
        return {
          id: l.id,
          classCode: `${grade}${sec}`,
          badgeBg: '',
          badgeColor: palette[idx % palette.length],
          className: l.className,
          subject: l.subject,
          timeSlot: `${l.startTime} - ${l.endTime}`,
          status: l.status,
          room: l.room || 'Virtual Hub',
          zoomRoomId: l.zoomRoomId,
          zoomPasscode: l.zoomPasscode,
          joinUrl: l.joinUrl || `https://zoom.us/j/${l.zoomRoomId}?pwd=${l.zoomPasscode}`
        };
      });
    }

    if (dashboardData?.upcomingClasses && dashboardData.upcomingClasses.length > 0) {
      return dashboardData.upcomingClasses;
    }

    return [
      {
        id: 'cls-1',
        classCode: '1A',
        badgeBg: '',
        badgeColor: 'emerald',
        className: 'Class 1 - Section A',
        subject: 'Mathematics',
        timeSlot: '09:00 AM - 09:45 AM',
        status: 'scheduled',
        room: 'Virtual Hub',
        zoomRoomId: '90010001',
        zoomPasscode: 'CLASS1#',
        joinUrl: 'https://zoom.us/j/90010001'
      },
      {
        id: 'cls-2',
        classCode: '2B',
        badgeBg: '',
        badgeColor: 'amber',
        className: 'Class 2 - Section B',
        subject: 'Science',
        timeSlot: '10:00 AM - 10:45 AM',
        status: 'scheduled',
        room: 'Virtual Hub',
        zoomRoomId: '90020002',
        zoomPasscode: 'CLASS2#',
        joinUrl: 'https://zoom.us/j/90020002'
      },
      {
        id: 'cls-3',
        classCode: '3A',
        badgeBg: '',
        badgeColor: 'purple',
        className: 'Class 3 - Section A',
        subject: 'Computer',
        timeSlot: '11:00 AM - 11:45 AM',
        status: 'scheduled',
        room: 'Virtual Hub',
        zoomRoomId: '90030003',
        zoomPasscode: 'CLASS3#',
        joinUrl: 'https://zoom.us/j/90030003'
      }
    ];
  }, [todayLessons, dashboardData?.upcomingClasses]);

  // 5-minute pre-class imminent alert detection engine
  useEffect(() => {
    const checkImminentLesson = () => {
      // If teacher is already teaching live, do not distract with a pre-class prompt
      if (liveLesson) {
        setImminentLesson(null);
        return;
      }

      // Check today's scheduled lessons
      const candidate = todayLessons.find((l) => {
        if (l.status === 'completed' || l.status === 'cancelled' || l.status === 'live') return false;
        if (l.id === dismissedAlertLessonId) return false;
        const sec = getSecondsUntilLesson(l);
        // Alert activates within 5 minutes (300s) and up to 15 mins overdue (-900s)
        return sec !== null && sec <= 300 && sec >= -900;
      });

      if (candidate) {
        const sec = getSecondsUntilLesson(candidate) || 0;
        setImminentLesson(candidate);
        setImminentSeconds(sec);
      } else if (previewAlert) {
        // In preview mode, use next scheduled lesson or first upcoming class
        const target = nextLesson || upcomingClassesList[0];
        if (target) {
          setImminentLesson(target);
          setImminentSeconds((prev) => (prev > 0 ? prev - 1 : 285));
        }
      } else {
        setImminentLesson(null);
      }
    };

    checkImminentLesson();
    const interval = setInterval(checkImminentLesson, 1000);
    return () => clearInterval(interval);
  }, [todayLessons, liveLesson, dismissedAlertLessonId, previewAlert, nextLesson, upcomingClassesList]);

  return (
    <div className="flex flex-col w-full pb-10 space-y-5 animate-in fade-in duration-200">
      {/* Active Holiday Announcement Banner */}
      {holidayAnnouncement && (holidayAnnouncement.isCurrent || isCurrentlyOnHoliday) && (
        <div className="bg-rose-50 border border-rose-200/90 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 shadow-xs">
              <Umbrella className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
                  School Holiday Break
                </span>
                <span className="text-sm font-black text-rose-950">{holidayAnnouncement.title}</span>
              </div>
              <p className="text-xs text-rose-800 font-medium mt-1">
                Official holiday break in effect. Scheduled teaching periods, attendance, and Zoom live classes are suspended.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowHolidayModal(true)}
            className="self-start sm:self-auto px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition-colors shrink-0 shadow-xs"
          >
            View Official Notice
          </button>
        </div>
      )}

      {/* 1. Hero Welcome Greeting Banner (Identical to Reference Image) */}
      <HeroGreetingBanner
        teacherName={teacher.name}
        isTeachingLive={Boolean(liveLesson)}
        liveLesson={liveLesson}
        nextLesson={nextLesson}
        onStartLesson={(l) => handleLaunchZoomLesson(l)}
        onConcludeLesson={() => {
          if (liveLesson) {
            setEndTopic(liveLesson.topic || liveLesson.subject);
            setShowEndModal(true);
          }
        }}
        startingLessonId={startingLessonId}
        showDutyClock={showDutyClock}
        onToggleDutyClock={() => setShowDutyClock(!showDutyClock)}
        formatStopwatch={formatStopwatch}
        liveElapsedSeconds={liveElapsedSeconds}
        isAlertActive={Boolean(imminentLesson)}
        onTogglePreClassAlert={() => {
          if (previewAlert) {
            setPreviewAlert(false);
            setImminentLesson(null);
          } else {
            setPreviewAlert(true);
            setImminentSeconds(285);
          }
        }}
      />

      {/* 2. Imminent Class Alert Banner (Pops up automatically <= 5 minutes before class) */}
      {imminentLesson && (
        <ClassImminentAlertBanner
          lesson={imminentLesson}
          secondsRemaining={imminentSeconds}
          onLaunchClass={() => handleLaunchZoomLesson(imminentLesson)}
          onDismiss={() => {
            setDismissedAlertLessonId(imminentLesson.id);
            setPreviewAlert(false);
            setImminentLesson(null);
          }}
          isStarting={startingLessonId === imminentLesson.id}
          isTestPreview={previewAlert}
        />
      )}

      {/* 3. Collapsible Real-Time Circular Clock Duty Tracker */}
      {showDutyClock && (
        <div className="transition-all duration-300">
          <DutyTrackingClock
            actions={
              liveLesson ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleLaunchZoomLesson(liveLesson)}
                    className="px-4 py-2 bg-white hover:bg-emerald-50 text-emerald-950 text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Video className="w-4 h-4 text-emerald-600" />
                    <span>Re-Join Classroom</span>
                  </button>
                  <button
                    type="button"
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
              ) : undefined
            }
          />
        </div>
      )}

      {/* 4. 5 Soft Wave Stat Cards (Total Students, Today's Classes, Completed Duty Hours, Pending Tasks, Class Performance) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Students */}
        <StatCard
          title="Total Students"
          value={totalStudentsCount}
          trend={dashboardData?.metrics?.totalStudentsTrend || `${teacher.assignedClasses?.length || 0} classes`}
          theme="blue"
          icon={<Users className="w-5 h-5 stroke-[2.2]" />}
          onClick={() => dispatch(setCurrentTab('student-performance'))}
        />

        {/* Today's Classes */}
        <StatCard
          title="Today's Classes"
          value={todaysClassesCount}
          trend={completedCount > 0 ? `${completedCount} done` : '↑ 0%'}
          theme="emerald"
          icon={<Calendar className="w-5 h-5 stroke-[2.2]" />}
          onClick={() => dispatch(setCurrentTab('timetable'))}
        />

        {/* Duty Hours (Completed Duty Hours Box) */}
        <StatCard
          title="Duty Completed"
          value={dutyDisplayHours}
          trend={liveLesson ? `+${liveHoursAccrued}h live` : (dutyTrend ? dutyTrend.replace('classes ', '') : 'Verified')}
          theme="indigo"
          icon={<Clock className="w-5 h-5 stroke-[2.2]" />}
          onClick={() => dispatch(setCurrentTab('duty-salary'))}
        />

        {/* Pending Tasks */}
        <StatCard
          title="Pending Tasks"
          value={pendingTasksCount}
          trend={dashboardData?.metrics?.pendingTasksTrend || 'To Grade'}
          theme="purple"
          icon={<CheckSquare className="w-5 h-5 stroke-[2.2]" />}
          onClick={() => dispatch(setCurrentTab('submissions-grading'))}
        />

        {/* Class Performance */}
        <StatCard
          title="Class Performance"
          value={classPerformanceScore}
          trend={dashboardData?.metrics?.classPerformanceTrend || '↑ 2%'}
          theme="amber"
          icon={<Trophy className="w-5 h-5 stroke-[2.2]" />}
          onClick={() => dispatch(setCurrentTab('exam-results'))}
        />
      </div>

      {/* 5. Middle Row: Performance Overview (65%) + Upcoming Classes (35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Performance Overview (Spline Area Chart + Radial Donut Gauge) */}
        <div className="lg:col-span-7">
          <PerformanceOverviewCard
            period={performancePeriod}
            overallPerformance={dashboardData?.performanceOverview?.overallPerformance || 78}
            performanceDelta={dashboardData?.performanceOverview?.performanceDelta || '↑ 4%'}
            weeklyTrend={dashboardData?.performanceOverview?.weeklyTrend || []}
            onPeriodChange={(newPeriod) => setPerformancePeriod(newPeriod)}
          />
        </div>

        {/* Upcoming Classes Card */}
        <div className="lg:col-span-5">
          <UpcomingClassesCard
            classes={upcomingClassesList}
            onJoinClass={(c) => handleLaunchZoomLesson(c)}
            onViewAll={() => dispatch(setCurrentTab('timetable'))}
            joiningClassId={startingLessonId}
          />
        </div>
      </div>

      {/* School calendar: upcoming events, next holiday and full-year view */}
      <UpcomingEventsCard />

      {/* 6. Bottom Row: 4 Balanced Cards Aligned Horizontally as in Reference Mockup */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4 items-stretch">
        {/* Left: Recent Activities (~3 cols) */}
        <div className="xl:col-span-3 min-w-0 flex flex-col">
          <RecentActivitiesCard
            activities={dashboardData?.recentActivities || []}
            onViewAll={() => dispatch(setCurrentTab('notices'))}
          />
        </div>

        {/* Middle: Subject Distribution (~4 cols) */}
        <div className="xl:col-span-4 min-w-0 flex flex-col">
          <SubjectDistributionCard
            totalStudents={totalStudentsCount}
            subjects={dashboardData?.subjectDistribution?.subjects || []}
          />
        </div>

        {/* Right-Middle: Academic Quick Actions (~3 cols) */}
        <div className="xl:col-span-3 min-w-0 flex flex-col">
          <QuickActionsCard
            onStartZoom={() => {
              if (nextLesson) {
                handleLaunchZoomLesson(nextLesson);
              } else {
                dispatch(setCurrentTab('live-lessons'));
              }
            }}
            onCreateAssignment={() => dispatch(setCurrentTab('tasks-assignments'))}
            onCheckSubmissions={() => dispatch(setCurrentTab('submissions-grading'))}
            onEnterMarks={() => dispatch(setCurrentTab('exam-results'))}
            onRecordMistake={() => dispatch(setCurrentTab('student-mistakes'))}
            onUploadLecture={() => dispatch(setCurrentTab('learning-resources'))}
          />
        </div>

        {/* Far-Right: Inspirational Quote Card (~2 cols) */}
        <div className="xl:col-span-2 min-w-0 flex flex-col">
          <InspirationalQuoteCard />
        </div>
      </div>

      {/* 6. Expandable Detailed Schedule View (Maintains 100% of previous detailed timetable roster) */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-100 overflow-hidden">
        <button
          onClick={() => setShowDetailedSchedule(!showDetailedSchedule)}
          className="w-full px-5 py-3.5 bg-slate-50/70 hover:bg-slate-100/70 flex items-center justify-between text-left transition-colors"
        >
          <div className="flex items-center gap-2">
            <TableIcon className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-800">
              Detailed Teaching Schedule Roster ({todayLessons.length} sessions today)
            </span>
            <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
              {teacherTz}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-indigo-600">
            <span>{showDetailedSchedule ? 'Collapse' : 'Expand Schedule'}</span>
            {showDetailedSchedule ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </button>

        {showDetailedSchedule && (
          <div className="overflow-x-auto border-t border-slate-100">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50/50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200/80 h-9">
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
                    <td colSpan={6} className="text-center py-8 text-slate-400">
                      <Calendar className="w-6 h-6 mx-auto mb-1.5 text-slate-300" />
                      <p className="text-xs font-semibold">No scheduled classes found for today</p>
                    </td>
                  </tr>
                ) : (
                  todayLessons.map((l, idx) => (
                    <tr
                      key={`today-les-${l.id}-${l.rawId || idx}`}
                      className="hover:bg-slate-50/70 h-12 transition-colors"
                    >
                      <td className="px-4 font-mono font-bold text-slate-800">
                        {l.startTime} - {l.endTime}
                      </td>
                      <td className="px-4">
                        <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-800 font-bold text-xs border border-indigo-100">
                          {l.className}
                        </span>
                      </td>
                      <td className="px-4">
                        <span className="font-bold text-slate-900 block">{l.subject}</span>
                        <span className="text-[11px] text-slate-500 truncate block max-w-xs">
                          {l.topic || 'Curriculum instruction'}
                        </span>
                      </td>
                      <td className="px-4 text-slate-600 font-medium">
                        {l.room || 'Virtual Hub'}
                      </td>
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
                            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50"
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
        )}
      </div>

      {/* 7. Conclude Live Class Modal */}
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
                  <p className="text-xs text-slate-500">
                    {liveLesson.className} • {liveLesson.subject}
                  </p>
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
                <span className="text-[11px] font-bold text-emerald-900 block uppercase">
                  Instruction Duration
                </span>
                <span className="text-lg font-black text-emerald-800 font-mono">
                  {formatStopwatch(liveElapsedSeconds)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] font-bold text-emerald-900 block uppercase">
                  Duty Credit
                </span>
                <span className="text-lg font-black text-emerald-700">
                  +{liveHoursAccrued} hrs
                </span>
              </div>
            </div>

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
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Teaching Notes (Optional)
                </label>
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
      {/* Official Holiday Announcement Popup Modal */}
      <HolidayAnnouncementModal
        isOpen={showHolidayModal}
        onClose={handleCloseHolidayModal}
        announcement={holidayAnnouncement}
      />
    </div>
  );
};
