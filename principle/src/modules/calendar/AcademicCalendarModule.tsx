import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calendar,
  CalendarDays,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Sun,
  Umbrella,
  BookOpen,
  ShieldAlert,
  Sparkles,
  Info,
  CalendarCheck,
  Building2,
  X
} from 'lucide-react';
import { calendarApi, AcademicHoliday, CalendarOverviewResponse, DeclareHolidayPayload } from '../../services/calendarApi';
import { useToast } from '../../context/ToastContext';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const AcademicCalendarModule: React.FC = () => {
  const { addToast } = useToast();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [overview, setOverview] = useState<CalendarOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeclareModalOpen, setIsDeclareModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDayInfo, setSelectedDayInfo] = useState<any | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<DeclareHolidayPayload['holidayType']>('VACATION');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formDescription, setFormDescription] = useState('');

  // Delete State
  const [holidayToDelete, setHolidayToDelete] = useState<AcademicHoliday | null>(null);
  const [deleting, setDeleting] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await calendarApi.getOverview({ year, month });
      setOverview(data);
    } catch (err: any) {
      addToast(err?.message || 'Failed to load academic calendar data', 'error');
    } finally {
      setLoading(false);
    }
  }, [year, month, addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Month Navigation
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 2, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month, 1));
  };

  const handleCurrentMonth = () => {
    setCurrentDate(new Date());
  };

  // Open Modal with prefilled date
  const handleOpenDeclareModal = (presetDate?: string) => {
    const todayStr = presetDate || new Date().toISOString().split('T')[0];
    setFormTitle('');
    setFormType('VACATION');
    setFormStartDate(todayStr);
    setFormEndDate(todayStr);
    setFormDescription('');
    setIsDeclareModalOpen(true);
  };

  // Submit Declaration
  const handleSubmitHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      addToast('Please enter a holiday title', 'warning');
      return;
    }
    if (!formStartDate || !formEndDate) {
      addToast('Please specify start and end dates', 'warning');
      return;
    }
    if (formStartDate > formEndDate) {
      addToast('Start date cannot be after end date', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      const res = await calendarApi.declareHoliday({
        sessionId: overview?.session?.id,
        title: formTitle.trim(),
        holidayType: formType,
        startDate: formStartDate,
        endDate: formEndDate,
        description: formDescription.trim() || undefined,
        affectsAllClasses: true
      });

      addToast(
        `Holiday break "${res.title}" declared successfully. ${res.auto_cancelled_lessons_count || 0} scheduled classes were cancelled.`,
        'success'
      );
      setIsDeclareModalOpen(false);
      loadData();
    } catch (err: any) {
      addToast(err?.message || 'Failed to declare holiday break', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!holidayToDelete) return;
    try {
      setDeleting(true);
      await calendarApi.deleteHoliday(holidayToDelete.id);
      addToast(`Holiday break "${holidayToDelete.title}" revoked. Timetable classes restored.`, 'info');
      setHolidayToDelete(null);
      loadData();
    } catch (err: any) {
      addToast(err?.message || 'Failed to revoke holiday break', 'error');
    } finally {
      setDeleting(false);
    }
  };

  // Calendar Day Grid Computation
  const calendarGrid = useMemo(() => {
    if (!overview) return [];

    // First day of month day-of-week (0=Sun, 1=Mon, ..., 6=Sat)
    const firstDay = new Date(year, month - 1, 1).getDay();
    // In our system 0 = Mon, ..., 6 = Sun
    const startOffset = (firstDay + 6) % 7;

    const daysList: (any | null)[] = [];
    for (let i = 0; i < startOffset; i++) {
      daysList.push(null);
    }

    overview.days.forEach((d) => {
      daysList.push(d);
    });

    return daysList;
  }, [overview, year, month]);

  // Overall Statistics
  const stats = useMemo(() => {
    const holidays = overview?.holidays || [];
    const totalCancelled = holidays.reduce((acc, h) => acc + (Number(h.auto_cancelled_lessons_count) || 0), 0);
    const holidayDaysInMonth = overview?.days.filter((d) => d.isHoliday).length || 0;

    const todayStr = new Date().toISOString().split('T')[0];
    const upcoming = holidays
      .filter((h) => String(h.end_date).split('T')[0] >= todayStr)
      .sort((a, b) => (a.start_date > b.start_date ? 1 : -1))[0];

    return {
      totalHolidays: holidays.length,
      holidayDaysInMonth,
      totalCancelled,
      upcomingBreak: upcoming || null
    };
  }, [overview]);

  const getHolidayBadge = (type: string) => {
    switch (type) {
      case 'VACATION':
        return { label: 'Vacation', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Sun };
      case 'PUBLIC_HOLIDAY':
        return { label: 'Public Holiday', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: Umbrella };
      case 'INSTITUTIONAL_BREAK':
        return { label: 'School Break', color: 'bg-amber-50 text-amber-800 border-amber-200', icon: Building2 };
      case 'EXAM_PREP':
        return { label: 'Exam Prep Break', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: BookOpen };
      default:
        return { label: 'Holiday', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: CalendarDays };
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-slate-50">
      {/* 1. Header Banner */}
      <div className="bg-white border-b border-slate-200/80 px-6 py-5 shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#191847] text-white flex items-center justify-center shadow-md shadow-indigo-950/20 shrink-0">
              <Calendar className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  Principal Executive Oversight
                </span>
                <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  {overview?.session ? `Session ${overview.session.name} · Active` : 'Active Session'}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#191847] tracking-tight mt-1">
                Academic Calendar & Holiday Breaks
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Live institutional calendar, holiday breaks management, and automated timetable class suppression
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => handleOpenDeclareModal()}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#36348e] hover:bg-[#28266e] text-white text-xs font-bold rounded-xl shadow-sm transition-all duration-150 transform hover:-translate-y-0.5"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              Declare Holiday Break
            </button>
          </div>
        </div>

        {/* 2. Top Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5">
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-[#36348e] flex items-center justify-center shrink-0">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-500">Holiday Days (This Month)</div>
              <div className="text-lg font-black text-slate-900">{stats.holidayDaysInMonth} Days</div>
            </div>
          </div>

          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <Umbrella className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-500">Declared Breaks</div>
              <div className="text-lg font-black text-slate-900">{stats.totalHolidays} Events</div>
            </div>
          </div>

          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-500">Auto-Cancelled Lessons</div>
              <div className="text-lg font-black text-rose-700">{stats.totalCancelled} Classes</div>
            </div>
          </div>

          <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-500">Next Upcoming Break</div>
              <div className="text-xs font-extrabold text-slate-900 truncate">
                {stats.upcomingBreak ? stats.upcomingBreak.title : 'None Scheduled'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Workspace: Calendar Grid + Break List */}
      <div className="p-6 space-y-6">
        {/* Calendar View Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          {/* Calendar Toolbar */}
          <div className="px-6 py-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-black text-[#191847]">
                {MONTH_NAMES[month - 1]} {year}
              </h2>
              <span className="text-xs font-bold text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                {overview?.days.length || 0} Days
              </span>
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleCurrentMonth}
                className="px-2.5 py-1 text-xs font-bold text-[#36348e] bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-100"
              >
                Today
              </button>
              <button
                onClick={handleNextMonth}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Header */}
          <div className="grid grid-cols-7 border-b border-slate-200 text-center bg-slate-100/70 py-2 text-[11px] font-black text-slate-500 uppercase tracking-wider">
            {WEEKDAYS.map((w) => (
              <div key={w}>{w}</div>
            ))}
          </div>

          {/* Days Grid */}
          {loading ? (
            <div className="py-24 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent" />
              <p className="mt-3 text-xs font-semibold text-slate-500">Loading academic schedule & breaks...</p>
            </div>
          ) : (
            <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 bg-slate-100">
              {calendarGrid.map((dayItem, idx) => {
                if (!dayItem) {
                  return <div key={`empty-${idx}`} className="bg-slate-50/50 min-h-[110px]" />;
                }

                const isToday = dayItem.date === todayStr;
                const badge = dayItem.holidayType ? getHolidayBadge(dayItem.holidayType) : null;
                const scheduledLessons = dayItem.lessonsSummary?.scheduledCount || 0;
                const cancelledLessons = dayItem.lessonsSummary?.cancelledCount || 0;

                return (
                  <div
                    key={dayItem.date}
                    onClick={() => setSelectedDayInfo(dayItem)}
                    className={`min-h-[110px] p-2.5 transition-all duration-150 flex flex-col justify-between cursor-pointer group ${
                      dayItem.isHoliday
                        ? 'bg-rose-50/40 hover:bg-rose-50/70 border-rose-100'
                        : isToday
                        ? 'bg-indigo-50/40 hover:bg-indigo-50/70'
                        : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    {/* Top Row: Date Number & Badges */}
                    <div className="flex items-start justify-between">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 text-xs font-black rounded-lg ${
                          isToday
                            ? 'bg-[#36348e] text-white shadow-xs'
                            : dayItem.isHoliday
                            ? 'text-rose-700 bg-rose-100'
                            : 'text-slate-800 group-hover:text-indigo-600'
                        }`}
                      >
                        {dayItem.day}
                      </span>

                      {dayItem.isHoliday ? (
                        <span className="text-[10px] font-extrabold text-rose-700 bg-rose-100/90 px-1.5 py-0.5 rounded border border-rose-200">
                          Holiday
                        </span>
                      ) : scheduledLessons > 0 ? (
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                          {scheduledLessons} {scheduledLessons === 1 ? 'class' : 'classes'}
                        </span>
                      ) : null}
                    </div>

                    {/* Middle Area: Holiday Details / Lesson Status */}
                    <div className="my-1.5">
                      {dayItem.isHoliday ? (
                        <div className="space-y-1">
                          <div className="text-[11px] font-black text-rose-900 leading-snug line-clamp-2">
                            {dayItem.holidayTitle}
                          </div>
                          {badge && (
                            <span
                              className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded border ${badge.color}`}
                            >
                              <badge.icon className="w-2.5 h-2.5" />
                              {badge.label}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-[10px] text-slate-400 font-medium">
                          {scheduledLessons > 0 ? (
                            <span className="text-emerald-700 font-semibold flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Classes Scheduled
                            </span>
                          ) : (
                            <span>No regular slots</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Footer: Cancellation / Status Warning */}
                    <div className="pt-1 text-[9px] font-semibold border-t border-slate-100/80">
                      {dayItem.isHoliday ? (
                        <span className="text-rose-600 flex items-center gap-0.5 font-bold">
                          <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                          Classes Cancelled
                        </span>
                      ) : cancelledLessons > 0 ? (
                        <span className="text-amber-700">{cancelledLessons} cancelled</span>
                      ) : (
                        <span className="text-slate-400">Regular Day</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. Active Declared Holidays & Breaks List */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-[#36348e] flex items-center justify-center border border-indigo-100">
                <Umbrella className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Declared Holiday Breaks for Session</h3>
                <p className="text-xs text-slate-500">Official break circulars enforced across timetable and live classes</p>
              </div>
            </div>

            <button
              onClick={() => handleOpenDeclareModal()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-[#36348e] text-xs font-bold rounded-lg border border-indigo-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              Add Break
            </button>
          </div>

          {overview?.holidays && overview.holidays.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-5">Break Title & Category</th>
                    <th className="py-3 px-4">Date Range</th>
                    <th className="py-3 px-4">Class Suppression</th>
                    <th className="py-3 px-4">Declared By</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overview.holidays.map((h) => {
                    const badge = getHolidayBadge(h.holiday_type);
                    const startDateStr = String(h.start_date).split('T')[0];
                    const endDateStr = String(h.end_date).split('T')[0];
                    const isSingleDay = startDateStr === endDateStr;

                    return (
                      <tr key={h.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-5">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`p-1.5 rounded-lg border ${badge.color} shrink-0`}
                            >
                              <badge.icon className="w-4 h-4" />
                            </span>
                            <div>
                              <div className="font-black text-slate-900 text-xs sm:text-sm">{h.title}</div>
                              {h.description && (
                                <div className="text-[11px] text-slate-500 max-w-sm truncate mt-0.5">
                                  {h.description}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-bold text-slate-700 whitespace-nowrap">
                          {isSingleDay ? (
                            <span>{startDateStr}</span>
                          ) : (
                            <span className="flex items-center gap-1.5">
                              {startDateStr}
                              <ChevronRight className="w-3 h-3 text-slate-400" />
                              {endDateStr}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-extrabold text-[11px]">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>{h.auto_cancelled_lessons_count || 0} Lessons Auto-Cancelled</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-slate-600">
                          <div className="font-semibold text-slate-900">{h.createdByName || 'School Principal'}</div>
                          <div className="text-[10px] text-slate-400">Official Directive</div>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => setHolidayToDelete(h)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-lg border border-transparent hover:border-rose-200 transition-colors"
                            title="Revoke Holiday Break & Restore Classes"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Revoke
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400">
              <Umbrella className="w-8 h-8 mx-auto stroke-[1.5] text-slate-300 mb-2" />
              <p className="text-xs font-semibold text-slate-600">No holiday breaks declared yet for this session</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Click "+ Declare Holiday Break" to announce school holidays and auto-cancel scheduled classes.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 5. Modal: Declare Holiday Break */}
      {isDeclareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4.5 bg-[#191847] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <CalendarDays className="w-4 h-4 text-indigo-200" />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight">Declare Holiday Break</h3>
                  <p className="text-[11px] text-indigo-200">Enforces mandatory class cancellation across all portals</p>
                </div>
              </div>
              <button
                onClick={() => setIsDeclareModalOpen(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitHoliday} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Holiday / Break Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Eid-ul-Fitr Holidays, Winter Vacation, Pakistan Day"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-semibold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#36348e]/20 focus:border-[#36348e]"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">Break Category</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as any)}
                  className="w-full px-3.5 py-2 text-xs font-semibold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#36348e]/20 focus:border-[#36348e]"
                >
                  <option value="VACATION">Vacation (Winter / Summer Break)</option>
                  <option value="PUBLIC_HOLIDAY">Public / National Holiday (Eid, Independence Day)</option>
                  <option value="INSTITUTIONAL_BREAK">Institutional Break (Faculty Training, Sports Day)</option>
                  <option value="EXAM_PREP">Examination Preparation Break</option>
                  <option value="EMERGENCY_CLOSURE">Emergency Weather / Administrative Closure</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Start Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-semibold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#36348e]/20 focus:border-[#36348e]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    End Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs font-semibold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#36348e]/20 focus:border-[#36348e]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">Circular Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Official notice text or instructions for staff and students..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-semibold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#36348e]/20 focus:border-[#36348e]"
                />
              </div>

              {/* Strict Enforcement Notice */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-900 leading-relaxed font-medium">
                  <span className="font-extrabold text-amber-950">Strict School Policy:</span> All scheduled timetable
                  lessons, teacher duties, and Zoom classroom joins will be suppressed and marked as cancelled for this
                  break range immediately.
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDeclareModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-[#36348e] hover:bg-[#28266e] text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Enforcing...' : 'Enforce Holiday Break'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal: Revoke Confirmation */}
      {holidayToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 border border-slate-200 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-black text-slate-900">Revoke Holiday Break?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to revoke <span className="font-bold text-slate-800">"{holidayToDelete.title}"</span>?
                The timetable generator will immediately re-enable classes for these dates.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setHolidayToDelete(null)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Keep Holiday
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors disabled:opacity-50"
              >
                {deleting ? 'Revoking...' : 'Yes, Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal: Day Inspection Quick View */}
      {selectedDayInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 border border-slate-200 shadow-xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="font-black text-sm text-slate-900">{selectedDayInfo.date}</div>
              <button
                onClick={() => setSelectedDayInfo(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedDayInfo.isHoliday ? (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-rose-800 font-black text-sm">
                  <Umbrella className="w-4 h-4" />
                  {selectedDayInfo.holidayTitle}
                </div>
                <div className="text-xs text-rose-700 font-semibold">
                  School Closed · No regular classes or Zoom meetings take place.
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                <div className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Regular Academic Day
                </div>
                <div className="text-xs text-slate-600 space-y-1">
                  <div>Scheduled Lessons: <span className="font-bold text-slate-900">{selectedDayInfo.lessonsSummary?.scheduledCount || 0}</span></div>
                  <div>Cancelled Lessons: <span className="font-bold text-slate-900">{selectedDayInfo.lessonsSummary?.cancelledCount || 0}</span></div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              {!selectedDayInfo.isHoliday && (
                <button
                  onClick={() => {
                    handleOpenDeclareModal(selectedDayInfo.date);
                    setSelectedDayInfo(null);
                  }}
                  className="px-3 py-1.5 bg-[#36348e] text-white text-xs font-bold rounded-lg hover:bg-[#28266e]"
                >
                  Declare Holiday on this Day
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

