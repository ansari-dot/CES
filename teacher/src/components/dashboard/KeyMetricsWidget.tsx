import React from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { setCurrentTab } from '../../store/slices/uiSlice';

export const KeyMetricsWidget: React.FC = () => {
  const dispatch = useAppDispatch();

  // Redux data selectors
  const tasks = useAppSelector((state) => state.tasks.tasks);
  const submissions = useAppSelector((state) => state.tasks.submissions);
  const lessons = useAppSelector((state) => state.timetable.lessons);
  const schoolSessions = useAppSelector((state) => state.schoolTimetable.sessions);
  const notifications = useAppSelector((state) => state.ui.notifications);
  const duty = useAppSelector((state) => state.duty.summary);

  // 1. Pending assignments count (total submissions awaiting review across tasks + direct pending submissions)
  const taskPendingSum = tasks.reduce(
    (acc, t) => acc + (t.pendingCount || 0) + (t.lateCount || 0),
    0
  );
  const directPendingCount = submissions.filter(
    (s) => s.status === 'pending' || s.status === 'late'
  ).length;
  const pendingAssignmentsCount = taskPendingSum > 0 ? taskPendingSum : directPendingCount;

  // 2. Upcoming lessons count for today (scheduled or live sessions)
  const todayStr = new Intl.DateTimeFormat('en-CA').format(new Date());
  const todayDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const todayLessons = lessons.filter((l) => {
    if (l.date) return l.date === todayStr;
    return l.dayOfWeek?.toLowerCase() === todayDayName.toLowerCase();
  });
  const todaySchoolSessions = schoolSessions.filter(
    (s) => s.dayOfWeek?.toLowerCase() === todayDayName.toLowerCase()
  );
  const upcomingLessonsCount =
    todayLessons.filter((l) => l.status === 'scheduled' || l.status === 'live' || l.status === 'started').length ||
    todaySchoolSessions.filter((s) => s.status === 'scheduled' || s.status === 'live').length;

  // 3. Student notifications count (unread alerts in the notification center)
  const studentNotificationsCount = notifications.filter((n) => !n.read).length;

  const metrics = [
    {
      id: 'today-duty-hours',
      title: "Today's Teaching Duty",
      count: `${duty.todayTeachingHours || 0}h`,
      unit: `${duty.todayTeachingMinutes || 0} mins`,
      icon: 'timer',
      iconBg: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/60',
      badgeText: 'Zoom Duty',
      badgeColor: 'bg-emerald-100 text-emerald-800',
      targetTab: 'duty-salary' as const,
      subtext: `${duty.todayCompletedCount || 0}/${duty.todayScheduledCount || 0} classes delivered today`,
    },
    {
      id: 'upcoming-lessons',
      title: 'Upcoming Lessons',
      count: upcomingLessonsCount,
      unit: 'Sessions Today',
      icon: 'videocam',
      iconBg: 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200/60',
      badgeText: 'Live Zoom Hub',
      badgeColor: 'bg-indigo-100 text-indigo-800',
      targetTab: 'timetable' as const,
      subtext: upcomingLessonsCount > 0 ? `${upcomingLessonsCount} classes scheduled` : 'No upcoming classes',
    },
    {
      id: 'pending-assignments',
      title: 'Pending Assignments',
      count: pendingAssignmentsCount,
      unit: 'To Grade',
      icon: 'assignment_turned_in',
      iconBg: 'bg-rose-50 text-rose-600 ring-1 ring-rose-200/60',
      badgeText: 'Review Queue',
      badgeColor: 'bg-rose-100 text-rose-800',
      targetTab: 'submissions-grading' as const,
      subtext: `${tasks.length} active assignments`,
    },
    {
      id: 'student-notifications',
      title: 'Student Notifications',
      count: studentNotificationsCount,
      unit: 'Unread Alerts',
      icon: 'notifications_active',
      iconBg: 'bg-amber-50 text-amber-600 ring-1 ring-amber-200/60',
      badgeText: 'Campus Live',
      badgeColor: 'bg-amber-100 text-amber-800',
      targetTab: 'notices' as const,
      subtext: `${notifications.length} alerts in roster`,
    },
  ];

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3 px-0.5">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-[#3525cd]">query_stats</span>
          <h2 className="text-sm font-bold text-[#121c2a] uppercase tracking-wider">
            Key Metrics
          </h2>
        </div>
        <span className="text-[11px] font-semibold text-[#777587]">Live Sync</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <div
            key={metric.id}
            onClick={() => dispatch(setCurrentTab(metric.targetTab))}
            className="group bg-white rounded-2xl p-5 border border-slate-200 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden"
          >
            {/* Top row: Prominent Icon + Action Badge */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform duration-200 ${metric.iconBg}`}
              >
                <span className="material-symbols-outlined text-[32px]">{metric.icon}</span>
              </div>

              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${metric.badgeColor}`}
              >
                {metric.badgeText}
              </span>
            </div>

            {/* Middle: Big Metric Number & Title */}
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black text-[#121c2a] tracking-tight">
                  {metric.count}
                </span>
                <span className="text-xs font-bold text-[#777587] truncate">{metric.unit}</span>
              </div>
              <h3 className="text-sm font-bold text-[#121c2a] mt-1 group-hover:text-[#3525cd] transition-colors">
                {metric.title}
              </h3>
            </div>

            {/* Bottom Row: Context note & Quick Arrow */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-[#777587]">
              <span className="font-medium truncate">{metric.subtext}</span>
              <span className="material-symbols-outlined text-[18px] text-[#3525cd] transform group-hover:translate-x-1 transition-transform">
                arrow_forward
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
