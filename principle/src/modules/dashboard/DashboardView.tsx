import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { DashboardMetrics, TimetableLesson, OperationalNotification, SchoolNotice } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState, ErrorState } from '../../components/common/StateViews';
import { ActiveModule } from '../../components/common/Sidebar';
import { QuickActionsFloating } from '../../components/dashboard/QuickActionsFloating';
import UpcomingEventsCard from '../../components/dashboard/UpcomingEventsCard';
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
  ShieldAlert,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Trophy,
  CheckCircle2,
  Activity,
  ArrowUpRight,
  BarChart3,
  Layers,
  Calendar,
  School,
  ExternalLink,
  Bell,
  Check,
  Zap,
  BookOpen
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (module: ActiveModule) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
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
        api.getNotices().catch(() => []),
        api.getNotifications()
      ]);
      setMetrics(m);
      const currentDay = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
      setTodayLessons(lessons.filter((l) => l.dayOfWeek === currentDay).slice(0, 6));
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

  // Dynamic time-based greeting
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }, []);

  const todayFormatted = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(new Date());
    } catch {
      return 'Wednesday, 11 November 2026';
    }
  }, []);

  const principalName = currentUser?.name || 'Prof. Tariq Mahmood';

  const urgentTotal = useMemo(() => {
    if (!metrics) return 0;
    return (
      (metrics.pendingPaymentProofsCount || 0) +
      (metrics.pendingSalaryDraftsCount || 0) +
      (metrics.pendingAttendanceCorrectionsCount || 0)
    );
  }, [metrics]);

  const feeTargetPercent = useMemo(() => {
    if (!metrics) return 0;
    return Math.round(
      (metrics.monthlyFeeCollectedAmount / (metrics.monthlyFeeTargetAmount || 1)) * 100
    );
  }, [metrics]);

  if (loading) return <LoadingState message="Loading Cambridge Principal Dashboard overview..." rows={6} />;
  if (error || !metrics) return <ErrorState message={error || 'Failed to load data'} onRetry={loadData} />;

  return (
    <div className="flex flex-col w-full pb-12 space-y-6 animate-in fade-in duration-150">
      {/* =========================================================================
          1. EXECUTIVE HERO BANNER: Clean, Prestigious Cambridge Standard
          Matches Teacher & Student Portal with bright, elegant surface & rich accents
          ========================================================================= */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-white via-indigo-50/50 to-blue-50/60 border border-slate-200/90 p-6 sm:p-7 lg:p-8 shadow-xs select-none">
        {/* Ambient subtle glow shapes */}
        <div className="absolute -right-12 -top-16 w-80 h-80 rounded-full bg-blue-400/15 blur-3xl pointer-events-none" />
        <div className="absolute right-1/4 -bottom-16 w-72 h-72 rounded-full bg-amber-400/15 blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 top-0 w-64 h-64 rounded-full bg-indigo-500/10 blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Left Column: Greeting, Date, Identity, Subtitle & Action CTAs */}
          <div className="space-y-4 max-w-2xl">
            {/* Top Badges Strip */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Date Pill */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white border border-slate-200/90 text-xs font-bold text-slate-700 shadow-2xs">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>{todayFormatted}</span>
              </div>

              {/* Campus Online Status Pill */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 shadow-2xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Campus Online</span>
              </div>

              {/* Classes 1-8 Scope Pill */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white border border-slate-200/90 text-xs font-bold text-slate-700 shadow-2xs">
                <School className="w-3.5 h-3.5 text-amber-500" />
                <span>Classes 1–8 Active</span>
              </div>

              {/* Cambridge Session */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800 shadow-2xs hidden sm:inline-flex">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Session 2026–27</span>
              </div>
            </div>

            {/* Main Greeting */}
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
                <span>{greeting}, {principalName}!</span>
                <span className="inline-block animate-bounce origin-bottom-right">👋</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-1 font-medium leading-relaxed">
                Executive Leadership · Academic Excellence · Institutional Administration. Live Zoom classrooms, fee revenues, and academic performance are fully operational.
              </p>
            </div>

            {/* Executive Quick Actions Inside Banner */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => onNavigate('academic-oversight')}
                className="inline-flex items-center gap-2 bg-[#36348e] hover:bg-[#2c2a75] text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md shadow-indigo-100 transition-all transform hover:-translate-y-0.5 cursor-pointer active:scale-[0.98]"
              >
                <Trophy className="w-4 h-4 text-[#ffc53a]" />
                <span>Academic Results</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('timetable')}
                className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs px-4 py-2.5 rounded-xl border border-slate-200/90 shadow-2xs transition-all transform hover:-translate-y-0.5 cursor-pointer active:scale-[0.98]"
              >
                <CalendarDays className="w-4 h-4 text-blue-600" />
                <span>Manage Timetable</span>
              </button>

              <button
                type="button"
                onClick={() => onNavigate('payments')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 px-3.5 py-2.5 rounded-xl border border-slate-200/90 shadow-2xs transition cursor-pointer active:scale-[0.98]"
              >
                <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Review Payments ({metrics.pendingPaymentProofsCount})</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Right Column: Cambridge Executive Seal & Floating Badge */}
          <div className="relative shrink-0 flex flex-col items-center justify-center self-center lg:self-auto">
            <div className="relative p-1.5 rounded-full bg-white border border-slate-200 shadow-md">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white flex items-center justify-center p-2.5 overflow-hidden border-2 border-amber-400/80 shadow-inner">
                <img
                  src="/logowb.png"
                  alt="Cambridge Education System"
                  className="w-full h-full object-contain filter drop-shadow-xs"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/logo.jpeg';
                  }}
                />
              </div>
            </div>

            {/* Floating Executive Status Pill */}
            <div className="mt-3 bg-white/95 backdrop-blur-md border border-slate-200/90 text-slate-900 rounded-xl px-3.5 py-1.5 shadow-xs flex items-center gap-2 text-center">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <div className="text-left">
                <div className="text-[11px] font-black text-slate-900 leading-tight">Executive Office</div>
                <div className="text-[9px] text-indigo-600 font-extrabold uppercase tracking-wider">Cambridge Principal</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. TOP 5 EXECUTIVE WAVE KPI CARDS
          Features signature animated SVG waves, rich pastel badges, bold counters
          ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Active Enrolled Students */}
        <div
          onClick={() => onNavigate('students')}
          className="relative overflow-hidden rounded-2xl bg-white border border-blue-100/80 hover:border-blue-300 p-4 sm:p-4.5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer group flex flex-col justify-between min-h-[125px]"
        >
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <GraduationCap className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-blue-50 text-blue-700 border-blue-100">
              <span>100% Online</span>
            </div>
          </div>

          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
              {metrics.totalActiveStudents}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Total Active Students
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium relative z-10">
            <span>Classes 1–8 Roster</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
          </div>

          {/* SVG Wave */}
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(59, 130, 246, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Card 2: Faculty Strength */}
        <div
          onClick={() => onNavigate('teachers')}
          className="relative overflow-hidden rounded-2xl bg-white border border-purple-100/80 hover:border-purple-300 p-4 sm:p-4.5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer group flex flex-col justify-between min-h-[125px]"
        >
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white shadow-sm shadow-purple-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-purple-50 text-purple-700 border-purple-100">
              <span>On-Duty</span>
            </div>
          </div>

          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
              {metrics.activeTeachers} Active
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Faculty Strength
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium relative z-10">
            <span>{metrics.inactiveTeachers || 0} leave / suspended</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-600 group-hover:translate-x-0.5 transition-all" />
          </div>

          {/* SVG Wave */}
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(139, 92, 246, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Card 3: Today's Live Lessons */}
        <div
          onClick={() => onNavigate('timetable')}
          className="relative overflow-hidden rounded-2xl bg-white border border-emerald-100/80 hover:border-emerald-300 p-4 sm:p-4.5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer group flex flex-col justify-between min-h-[125px]"
        >
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Video className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-emerald-50 text-emerald-700 border-emerald-100">
              <span>{metrics.overallAttendancePercentage}% Attd</span>
            </div>
          </div>

          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
              {metrics.todayScheduledLessons} Classes
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Today's Live Lessons
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium relative z-10">
            <span>{metrics.completedLessonsToday} delivered · {metrics.cancelledLessonsToday} off</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
          </div>

          {/* SVG Wave */}
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(16, 185, 129, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#10b981" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Card 4: Fee Collections */}
        <div
          onClick={() => onNavigate('challans')}
          className="relative overflow-hidden rounded-2xl bg-white border border-amber-100/80 hover:border-amber-300 p-4 sm:p-4.5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer group flex flex-col justify-between min-h-[125px]"
        >
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Receipt className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-amber-50 text-amber-800 border-amber-200">
              <span>{feeTargetPercent}% Target</span>
            </div>
          </div>

          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
              Rs. {(metrics.monthlyFeeCollectedAmount / 1000).toFixed(1)}k
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Fee Collections
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium relative z-10">
            <span>Arrears: Rs. {(metrics.outstandingArrearsAmount / 1000).toFixed(1)}k</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
          </div>

          {/* SVG Wave */}
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(245, 158, 11, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Card 5: Awaiting Authorization */}
        <div
          onClick={() => onNavigate('payments')}
          className="relative overflow-hidden rounded-2xl bg-white border border-rose-100/80 hover:border-rose-300 p-4 sm:p-4.5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer group flex flex-col justify-between min-h-[125px]"
        >
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white shadow-sm shadow-rose-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <ShieldAlert className="w-5 h-5 stroke-[2.2]" />
            </div>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                urgentTotal > 0
                  ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              {urgentTotal > 0 ? `${urgentTotal} Pending` : 'All Clear'}
            </span>
          </div>

          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
              {urgentTotal}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Awaiting Authorization
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium relative z-10">
            <span>{metrics.pendingPaymentProofsCount} bank · {metrics.pendingSalaryDraftsCount} payroll</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-600 group-hover:translate-x-0.5 transition-all" />
          </div>

          {/* SVG Wave */}
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(244, 63, 94, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. URGENT TASKS STRIP: Quick Actions Awaiting Review (When Pending > 0)
          ========================================================================= */}
      {urgentTotal > 0 && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-50 via-white to-amber-50/40 border border-amber-200 shadow-xs animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                <AlertTriangle className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black text-slate-900">
                  Tasks Awaiting Principal Authorization ({urgentTotal})
                </h3>
                <p className="text-[11px] text-slate-500 font-medium">
                  Review and sign-off pending verification requests to keep institutional operations running smoothly.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Payment Proofs */}
            <div
              onClick={() => onNavigate('payments')}
              className="p-3.5 rounded-xl bg-white border border-amber-200/90 hover:border-amber-400 hover:shadow-xs cursor-pointer flex items-center justify-between transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                  <FileCheck2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-xs">
                    {metrics.pendingPaymentProofsCount} Payment Proofs
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">Bank transfer slips for verification</div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-amber-600 group-hover:translate-x-1 transition-transform" />
            </div>

            {/* Salary Drafts */}
            <div
              onClick={() => onNavigate('payroll')}
              className="p-3.5 rounded-xl bg-white border border-amber-200/90 hover:border-amber-400 hover:shadow-xs cursor-pointer flex items-center justify-between transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
                  <Banknote className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-xs">
                    {metrics.pendingSalaryDraftsCount} Faculty Salary Drafts
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">Monthly faculty payroll approvals</div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-amber-600 group-hover:translate-x-1 transition-transform" />
            </div>

            {/* Attendance Corrections */}
            <div
              onClick={() => onNavigate('attendance')}
              className="p-3.5 rounded-xl bg-white border border-amber-200/90 hover:border-amber-400 hover:shadow-xs cursor-pointer flex items-center justify-between transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-xs">
                    {metrics.pendingAttendanceCorrectionsCount} Attendance Disputes
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">Faculty student dispute reviews</div>
                </div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-amber-600 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          4. MAIN WORKSPACE GRID: 2/3 LIVE MONITORING + 1/3 EXECUTIVE ACTIONS & NOTICES
          ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Live Timetable & Class-wise Distribution */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card 1: Today's Live Zoom Lessons Schedule */}
          <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/20 flex items-center justify-center shrink-0">
                  <Video className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Today's Live Zoom Class Schedule
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Active online sessions across Classes 1–8 for {todayFormatted}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('timetable')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/80 px-3.5 py-2 rounded-xl transition cursor-pointer self-start sm:self-auto active:scale-[0.98]"
              >
                <span>Full Timetable</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200/80 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-5 py-3">Time</th>
                    <th className="px-5 py-3">Class &amp; Subject</th>
                    <th className="px-5 py-3">Faculty</th>
                    <th className="px-5 py-3">Zoom Meeting ID</th>
                    <th className="px-5 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                  {todayLessons.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Calendar className="w-8 h-8 text-slate-300" />
                          <p className="text-xs font-bold text-slate-700">No live lessons scheduled for today.</p>
                          <p className="text-[11px] text-slate-400">Scheduled timetable lessons will show up here automatically.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    todayLessons.map((lesson) => (
                      <tr key={lesson.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3 font-mono tabular-nums text-slate-600 whitespace-nowrap font-bold">
                          <span className="inline-flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-lg text-[11px]">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{lesson.startTime} – {lesson.endTime}</span>
                          </span>
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <div className="font-bold text-slate-900">
                            Class {lesson.classNumber}
                          </div>
                          <div className="text-[11px] text-slate-500 font-medium">
                            {lesson.subjectName}
                          </div>
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap text-slate-800 font-medium">
                          {lesson.teacherName}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-50 border border-sky-200/80 text-sky-800 font-mono text-[11px] font-bold">
                            <Video className="w-3 h-3 text-sky-600" />
                            <span>{lesson.zoomMeetingId}</span>
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          <StatusBadge status={lesson.lessonStatus} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card 2: Class-Wise Student Distribution (Classes 1–8) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-500/20 flex items-center justify-center shrink-0">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-900">
                    Class-Wise Student Enrollment
                  </h4>
                  <p className="text-xs text-slate-500 font-medium">
                    Active pupil distribution across all 8 classes
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onNavigate('students')}
                className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1 hover:underline cursor-pointer"
              >
                <span>Full Directory</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {metrics.enrolmentByClass.map((item) => {
                const percent = Math.min(100, Math.round((item.count / 30) * 100));
                return (
                  <div
                    key={item.classNumber}
                    onClick={() => onNavigate('students')}
                    className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/80 hover:border-amber-400 hover:bg-amber-50/40 hover:shadow-2xs cursor-pointer text-center transition-all group"
                  >
                    <div className="text-[11px] font-bold text-slate-600 group-hover:text-amber-900">
                      Class {item.classNumber}
                    </div>
                    <div className="text-xl font-black text-slate-900 mt-1">
                      {item.count}
                    </div>
                    <div className="w-full bg-slate-200/80 h-1.5 rounded-full overflow-hidden mt-2">
                      <div
                        className="bg-gradient-to-r from-amber-400 to-amber-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1.5 font-medium">students</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card 3: Academic Examinations & Result Moderation Card */}
          <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-r from-indigo-50 via-white to-purple-50/40 border border-indigo-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#36348e] text-white flex items-center justify-center shrink-0 shadow-md shadow-indigo-100">
                <Trophy className="w-6 h-6 text-[#ffc53a]" />
              </div>
              <div>
                <h4 className="text-sm sm:text-base font-black text-slate-900">
                  Terminal Examinations &amp; Result Approvals
                </h4>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed font-medium">
                  Review faculty marks submissions, approve merit positions &amp; grades, and publish official Cambridge report cards.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate('academic-oversight')}
              className="px-4 py-2.5 rounded-xl bg-[#36348e] hover:bg-[#2c2a75] text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-all shrink-0 cursor-pointer active:scale-[0.98]"
            >
              <span>Academic Oversight</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right 1 Column: Executive Actions, Notices & Connectivity */}
        <div className="space-y-6">
          {/* Executive Quick Actions 3x2 Grid (Matching Teacher Portal Style) */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Zap className="w-4 h-4 text-blue-500 fill-blue-500 shrink-0" />
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Executive Quick Actions
              </h3>
            </div>

            {/* 3x2 Action Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-3">
              {/* 1. Results & Positions */}
              <button
                type="button"
                onClick={() => onNavigate('academic-oversight')}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-indigo-50/70 hover:bg-indigo-100/80 border border-indigo-100 text-indigo-900 transition-all hover:scale-[1.02] shadow-2xs group text-center min-w-0 cursor-pointer active:scale-[0.98]"
              >
                <div className="w-8 h-8 rounded-xl bg-[#36348e] text-white flex items-center justify-center mb-1.5 shadow-xs shadow-indigo-500/20 group-hover:scale-110 transition-transform">
                  <Trophy className="w-4 h-4 text-[#ffc53a]" />
                </div>
                <span className="text-[11px] font-bold leading-tight truncate max-w-full">
                  Results
                </span>
              </button>

              {/* 2. Review Payments */}
              <button
                type="button"
                onClick={() => onNavigate('payments')}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-emerald-50/70 hover:bg-emerald-100/80 border border-emerald-100 text-emerald-900 transition-all hover:scale-[1.02] shadow-2xs group text-center min-w-0 cursor-pointer active:scale-[0.98]"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-1.5 shadow-xs shadow-emerald-500/20 group-hover:scale-110 transition-transform">
                  <Receipt className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-bold leading-tight truncate max-w-full">
                  Payments
                </span>
              </button>

              {/* 3. Manage Timetable */}
              <button
                type="button"
                onClick={() => onNavigate('timetable')}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-blue-50/70 hover:bg-blue-100/80 border border-blue-100 text-blue-900 transition-all hover:scale-[1.02] shadow-2xs group text-center min-w-0 cursor-pointer active:scale-[0.98]"
              >
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-1.5 shadow-xs shadow-blue-500/20 group-hover:scale-110 transition-transform">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-bold leading-tight truncate max-w-full">
                  Timetable
                </span>
              </button>

              {/* 4. Faculty Salaries */}
              <button
                type="button"
                onClick={() => onNavigate('payroll')}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-purple-50/70 hover:bg-purple-100/80 border border-purple-100 text-purple-900 transition-all hover:scale-[1.02] shadow-2xs group text-center min-w-0 cursor-pointer active:scale-[0.98]"
              >
                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center mb-1.5 shadow-xs shadow-purple-500/20 group-hover:scale-110 transition-transform">
                  <Banknote className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-bold leading-tight truncate max-w-full">
                  Salaries
                </span>
              </button>

              {/* 5. Zoom Rooms */}
              <button
                type="button"
                onClick={() => onNavigate('zoom')}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-sky-50/70 hover:bg-sky-100/80 border border-sky-100 text-sky-900 transition-all hover:scale-[1.02] shadow-2xs group text-center min-w-0 cursor-pointer active:scale-[0.98]"
              >
                <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center mb-1.5 shadow-xs shadow-sky-500/20 group-hover:scale-110 transition-transform">
                  <Video className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-bold leading-tight truncate max-w-full">
                  Zoom Rooms
                </span>
              </button>

              {/* 6. Broadcast Notice */}
              <button
                type="button"
                onClick={() => onNavigate('notices')}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-amber-50/70 hover:bg-amber-100/80 border border-amber-100 text-amber-900 transition-all hover:scale-[1.02] shadow-2xs group text-center min-w-0 cursor-pointer active:scale-[0.98]"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center mb-1.5 shadow-xs shadow-amber-500/20 group-hover:scale-110 transition-transform">
                  <Bell className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-bold leading-tight truncate max-w-full">
                  Notices
                </span>
              </button>
            </div>
          </div>

          {/* School calendar: upcoming events, next holiday and full-year view */}
          <UpcomingEventsCard />

          {/* School Notices & Broadcasts */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Official School Notices
                </h4>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('notices')}
                className="text-xs text-blue-600 hover:underline font-bold cursor-pointer"
              >
                All Notices
              </button>
            </div>

            <div className="space-y-2.5">
              {recentNotices.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-400 text-center font-medium">
                  No active notices published yet.
                </div>
              ) : (
                recentNotices.map((notice) => (
                  <div
                    key={notice.id}
                    onClick={() => onNavigate('notices')}
                    className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/80 hover:border-slate-300 hover:bg-white hover:shadow-xs cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                      <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        {notice.audience}
                      </span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {notice.publishDate}
                      </span>
                    </div>
                    <h5 className="text-xs font-bold text-slate-900 leading-snug line-clamp-1">
                      {notice.title}
                    </h5>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                      {notice.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Institutional Operations Status */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-2.5 text-xs">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Institutional Status
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-slate-600 py-1 border-b border-slate-100">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Database Core Engine</span>
                </span>
                <span className="font-mono text-[11px] text-emerald-600 font-bold">Online</span>
              </div>

              <div className="flex items-center justify-between text-slate-600 py-1 border-b border-slate-100">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Persistent Zoom Rooms</span>
                </span>
                <span className="font-mono text-[11px] text-emerald-600 font-bold">8/8 Active</span>
              </div>

              <div className="flex items-center justify-between text-slate-600 py-1">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Notification Engine</span>
                </span>
                <span className="font-mono text-[11px] text-emerald-600 font-bold">Operational</span>
              </div>
            </div>
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
