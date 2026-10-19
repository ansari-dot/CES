import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { DashboardMetrics, TimetableLesson, OperationalNotification, SchoolNotice } from '../../types';
import { StatCard } from '../../components/common/StatCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState, ErrorState } from '../../components/common/StateViews';
import { ActiveModule } from '../../components/common/Sidebar';
import { QuickActionsFloating } from '../../components/dashboard/QuickActionsFloating';
import {
  Users,
  GraduationCap,
  Clock,
  Receipt,
  FileCheck2,
  Banknote,
  AlertTriangle,
  ArrowRight,
  Video,
  CalendarDays,
  ShieldCheck,
  ChevronRight,
  Sparkles
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (module: ActiveModule) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [todayLessons, setTodayLessons] = useState<TimetableLesson[]>([]);
  const [recentNotices, setRecentNotices] = useState<SchoolNotice[]>([]);
  const [notifications, setNotifications] = useState<OperationalNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [m, lessons, notices, notifs] = await Promise.all([
        api.getDashboardMetrics(),
        api.getTimetableLessons(),
        api.getNotices(),
        api.getNotifications()
      ]);
      setMetrics(m);
      setTodayLessons(lessons.filter((l) => l.dayOfWeek === 'Monday').slice(0, 5));
      setRecentNotices(notices.slice(0, 3));
      setNotifications(notifs.filter((n) => !n.isRead).slice(0, 4));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) return <LoadingState message="Loading Principal Dashboard overview..." rows={6} />;
  if (error || !metrics) return <ErrorState message={error || 'Failed to load data'} onRetry={loadData} />;

  return (
    <div className="space-y-6">
      {/* Top Banner / Operational Status Notice in Clean White + Subtle Gradient */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-sm font-semibold text-slate-900">
              Online School Live Operations · Classes 1–8
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Welcome, Dr. Tariq Mahmood. Today's persistent Zoom rooms, daily subject timetables, student attendance oversight, and monthly fee reconciliations are operational.
          </p>
        </div>

        <div className="flex items-center gap-2.5 text-xs shrink-0">
          <button
            onClick={() => onNavigate('timetable')}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-medium transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Manage Timetable</span>
          </button>
          <button
            onClick={() => onNavigate('payments')}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-medium transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Review Payments ({metrics.pendingPaymentProofsCount})</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Students Enrolled"
          value={metrics.totalActiveStudents}
          subtitle="Classes 1 to 8 combined"
          accentColor="blue"
          progress={100}
          icon={<GraduationCap className="w-4 h-4" strokeWidth={1.75} />}
          trend={{ value: '100% Online', isNeutral: true }}
          onClick={() => onNavigate('students')}
        />

        <StatCard
          label="Faculty Strength"
          value={`${metrics.activeTeachers} Active`}
          subtitle={`${metrics.inactiveTeachers} under inquiry / suspended`}
          accentColor="purple"
          progress={Math.round((metrics.activeTeachers / (metrics.activeTeachers + metrics.inactiveTeachers || 1)) * 100)}
          icon={<Users className="w-4 h-4" strokeWidth={1.75} />}
          onClick={() => onNavigate('teachers')}
        />

        <StatCard
          label="Today's Lessons"
          value={`${metrics.todayScheduledLessons} Scheduled`}
          subtitle={`${metrics.completedLessonsToday} delivered · ${metrics.cancelledLessonsToday} cancelled`}
          accentColor="emerald"
          progress={metrics.overallAttendancePercentage}
          icon={<Video className="w-4 h-4" strokeWidth={1.75} />}
          trend={{ value: `${metrics.overallAttendancePercentage}% Attendance`, isPositive: true }}
          onClick={() => onNavigate('timetable')}
        />

        <StatCard
          label="Monthly Fee Collection"
          value={`Rs. ${(metrics.monthlyFeeCollectedAmount / 1000).toFixed(1)}k`}
          subtitle={`Arrears: Rs. ${(metrics.outstandingArrearsAmount / 1000).toFixed(1)}k`}
          accentColor="amber"
          progress={Math.round(
            (metrics.monthlyFeeCollectedAmount / (metrics.monthlyFeeTargetAmount || 1)) * 100
          )}
          icon={<Receipt className="w-4 h-4" strokeWidth={1.75} />}
          trend={{
            value: `${Math.round(
              (metrics.monthlyFeeCollectedAmount / (metrics.monthlyFeeTargetAmount || 1)) * 100
            )}% Target`,
            isPositive: true
          }}
          onClick={() => onNavigate('challans')}
        />
      </div>

      {/* Urgent Tasks Awaiting Review Banner */}
      {(metrics.pendingPaymentProofsCount > 0 ||
        metrics.pendingSalaryDraftsCount > 0 ||
        metrics.pendingAttendanceCorrectionsCount > 0) && (
        <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 text-xs shadow-2xs">
          <div className="flex items-center gap-2 font-semibold text-amber-900 mb-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" strokeWidth={1.75} />
            <span>Tasks Awaiting Principal Review & Authorization</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {metrics.pendingPaymentProofsCount > 0 && (
              <div
                onClick={() => onNavigate('payments')}
                className="p-3.5 rounded-xl bg-white border border-amber-200/80 hover:border-amber-400 hover:shadow-xs cursor-pointer flex items-center justify-between transition-all shadow-2xs"
              >
                <div>
                  <div className="font-semibold text-slate-900">
                    {metrics.pendingPaymentProofsCount} Payment Proofs
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Bank slips awaiting clearance</div>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-600" strokeWidth={1.75} />
              </div>
            )}

            {metrics.pendingSalaryDraftsCount > 0 && (
              <div
                onClick={() => onNavigate('payroll')}
                className="p-3.5 rounded-xl bg-white border border-amber-200/80 hover:border-amber-400 hover:shadow-xs cursor-pointer flex items-center justify-between transition-all shadow-2xs"
              >
                <div>
                  <div className="font-semibold text-slate-900">
                    {metrics.pendingSalaryDraftsCount} Teacher Salary Drafts
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Monthly payroll authorization</div>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-600" strokeWidth={1.75} />
              </div>
            )}

            {metrics.pendingAttendanceCorrectionsCount > 0 && (
              <div
                onClick={() => onNavigate('attendance')}
                className="p-3.5 rounded-xl bg-white border border-amber-200/80 hover:border-amber-400 hover:shadow-xs cursor-pointer flex items-center justify-between transition-all shadow-2xs"
              >
                <div>
                  <div className="font-semibold text-slate-900">
                    {metrics.pendingAttendanceCorrectionsCount} Attendance Correction
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Teacher request review</div>
                </div>
                <ArrowRight className="w-4 h-4 text-amber-600" strokeWidth={1.75} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Grid: Today's Online Lessons & Class-wise Enrolment */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Today's Live Lessons & Timetable Overview */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" strokeWidth={1.75} />
              <span>Today's Live Zoom Lessons Schedule</span>
            </h3>
            <button
              onClick={() => onNavigate('timetable')}
              className="text-xs text-amber-700 hover:underline flex items-center gap-1 font-medium"
            >
              <span>View full weekly schedule</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Class & Subject</th>
                    <th className="px-4 py-3">Assigned Faculty</th>
                    <th className="px-4 py-3">Class Zoom Room</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                  {todayLessons.map((lesson) => (
                    <tr key={lesson.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 font-mono tabular-nums text-slate-500 whitespace-nowrap font-medium">
                        {lesson.startTime} – {lesson.endTime}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="font-semibold text-slate-900">Class {lesson.classNumber}</span> · {lesson.subjectName}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                        {lesson.teacherName}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200/70 text-slate-700 font-medium">
                          <Video className="w-3 h-3 text-sky-600" strokeWidth={1.75} />
                          <span>{lesson.zoomMeetingId}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <StatusBadge status={lesson.lessonStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Enrolment by Class 1–8 */}
          <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                Class-wise Student Distribution (Classes 1–8)
              </h4>
              <button
                onClick={() => onNavigate('students')}
                className="text-xs text-amber-700 font-medium hover:underline"
              >
                Directory
              </button>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
              {metrics.enrolmentByClass.map((item) => {
                const percent = Math.min(100, Math.round((item.count / 30) * 100));
                return (
                  <div
                    key={item.classNumber}
                    onClick={() => onNavigate('students')}
                    className="p-3 rounded-xl bg-slate-50/70 border border-slate-200/80 hover:border-amber-300 hover:bg-amber-50/30 cursor-pointer text-center transition-all shadow-2xs"
                  >
                    <div className="text-[11px] text-slate-500 font-medium">Class {item.classNumber}</div>
                    <div className="text-base font-bold font-mono text-slate-900 mt-1">
                      {item.count}
                    </div>
                    <div className="w-full bg-slate-200 h-1 rounded-full overflow-hidden mt-1.5">
                      <div
                        className="bg-amber-500 h-full rounded-full"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-slate-400 mt-1">students</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Operational Alerts & Recent Notices */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">School Notices & Alerts</h3>
            <button
              onClick={() => onNavigate('notices')}
              className="text-xs text-amber-700 font-medium hover:underline"
            >
              All notices
            </button>
          </div>

          <div className="space-y-3">
            {recentNotices.map((notice) => (
              <div
                key={notice.id}
                onClick={() => onNavigate('notices')}
                className="p-4 rounded-xl bg-white border border-slate-200/90 hover:border-slate-300 hover:shadow-xs cursor-pointer transition-all shadow-2xs"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                  <span className="font-semibold text-amber-700">{notice.audience}</span>
                  <span className="font-mono text-[10px] text-slate-400">{notice.publishDate}</span>
                </div>
                <h5 className="text-xs font-semibold text-slate-900 leading-snug">{notice.title}</h5>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                  {notice.content}
                </p>
              </div>
            ))}
          </div>

          {/* Quick Principal System Operations Links */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-2 text-xs">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Principal Operations Quick Access
            </div>
            <button
              onClick={() => onNavigate('zoom')}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/70 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Video className="w-4 h-4 text-sky-600" />
                <span className="font-medium">Zoom Class-Link Diagnostics (8 Classes)</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
            <button
              onClick={() => onNavigate('payroll')}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/70 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Banknote className="w-4 h-4 text-emerald-600" />
                <span className="font-medium">Teacher Duty & Payroll Drafts</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
            <button
              onClick={() => onNavigate('audit')}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/70 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-amber-600" />
                <span className="font-medium">Review Administrative Audit Trail</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Speed Dial for Rapid Administrative Tasks */}
      <QuickActionsFloating
        onNavigate={onNavigate}
        onRefreshMetrics={loadData}
      />
    </div>
  );
};
