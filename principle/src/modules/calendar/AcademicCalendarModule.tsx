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
  X,
  Pencil,
  GraduationCap,
  Users,
  Megaphone
} from 'lucide-react';
import {
  calendarApi,
  CalendarOverviewResponse,
  CalendarEvent,
  CalendarEventType,
  CalendarAudience,
  CalendarConflict,
  CalendarEventPayload
} from '../../services/calendarApi';
import { requestApi } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useSocketEvent } from '../../hooks/useSocket';

const EVENT_TYPE_OPTIONS: { value: CalendarEventType; label: string; holiday: boolean }[] = [
  { value: 'VACATION', label: 'School Vacation (Winter / Summer Break)', holiday: true },
  { value: 'PUBLIC_HOLIDAY', label: 'Public Holiday (Eid, Independence Day)', holiday: true },
  { value: 'EMERGENCY_CLOSURE', label: 'Emergency Holiday (Weather / Administrative)', holiday: true },
  { value: 'SPECIAL_HOLIDAY', label: 'Special Holiday', holiday: true },
  { value: 'EXAMINATION', label: 'Examination', holiday: false },
  { value: 'SCHOOL_EVENT', label: 'School Event (Sports Day, Function)', holiday: false },
  { value: 'PARENT_MEETING', label: 'Parent Meeting', holiday: false },
  { value: 'ANNOUNCEMENT', label: 'Other Announcement', holiday: false },
  { value: 'INSTITUTIONAL_BREAK', label: 'Institutional Break (Faculty Training)', holiday: true },
  { value: 'EXAM_PREP', label: 'Examination Preparation Break', holiday: true }
];

const AUDIENCE_OPTIONS: { value: CalendarAudience; label: string }[] = [
  { value: 'ALL', label: 'Everyone (Students, Parents, Teachers)' },
  { value: 'STUDENTS_PARENTS', label: 'Students & Parents' },
  { value: 'STUDENTS', label: 'Students only' },
  { value: 'PARENTS', label: 'Parents only' },
  { value: 'TEACHERS', label: 'Teachers only' },
  { value: 'STAFF', label: 'Staff (Teachers & Administration)' }
];

const isHolidayType = (t: string) => EVENT_TYPE_OPTIONS.find((o) => o.value === t)?.holiday ?? false;

/** Local "YYYY-MM-DD" of the browser (the date pickers work in local calendar days). */
const localDateKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const AcademicCalendarModule: React.FC = () => {
  // The toast context exposes showToast(message, type); keep the local name used below
  const { showToast: addToast } = useToast();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [overview, setOverview] = useState<CalendarOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDeclareModalOpen, setIsDeclareModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDayInfo, setSelectedDayInfo] = useState<any | null>(null);

  // Form State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formType, setFormType] = useState<CalendarEventType>('VACATION');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStartTime, setFormStartTime] = useState('');
  const [formEndTime, setFormEndTime] = useState('');
  const [formAudience, setFormAudience] = useState<CalendarAudience>('ALL');
  const [formAllClasses, setFormAllClasses] = useState(true);
  const [formClassIds, setFormClassIds] = useState<number[]>([]);
  const [formFullDay, setFormFullDay] = useState(true);
  const [formSuspend, setFormSuspend] = useState(true);
  const [formNotify, setFormNotify] = useState(true);
  const [conflicts, setConflicts] = useState<CalendarConflict[] | null>(null);
  const [classOptions, setClassOptions] = useState<{ id: number; name: string }[]>([]);

  // Events (formatted) for the visible month and the whole year
  const [monthEvents, setMonthEvents] = useState<CalendarEvent[]>([]);
  const [yearEvents, setYearEvents] = useState<CalendarEvent[]>([]);
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');

  // Delete State
  const [holidayToDelete, setHolidayToDelete] = useState<CalendarEvent | null>(null);
  const [deleting, setDeleting] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [data, events, yearly] = await Promise.all([
        calendarApi.getOverview({ year, month }),
        calendarApi.getEvents({ year, month }),
        calendarApi.getEvents({ year })
      ]);
      setOverview(data);
      setMonthEvents(Array.isArray(events) ? events : []);
      setYearEvents(Array.isArray(yearly) ? yearly : []);
    } catch (err: any) {
      addToast(err?.message || 'Failed to load academic calendar data', 'error');
    } finally {
      setLoading(false);
    }
  }, [year, month, addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    requestApi<any[]>('/api/v1/classes')
      .then((rows) =>
        setClassOptions(
          (Array.isArray(rows) ? rows : [])
            .map((c) => ({ id: Number(c.id), name: String(c.name || c.className || `Class ${c.grade_level || c.id}`) }))
            .filter((c) => c.id)
        )
      )
      .catch(() => setClassOptions([]));
  }, []);

  // Live refresh when any staff member changes the calendar
  useSocketEvent('calendar.updated', () => {
    loadData();
  });

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
    const todayStr = presetDate || localDateKey();
    setEditingId(null);
    setFormTitle('');
    setFormType('VACATION');
    setFormStartDate(todayStr);
    setFormEndDate(todayStr);
    setFormDescription('');
    setFormStartTime('');
    setFormEndTime('');
    setFormAudience('ALL');
    setFormAllClasses(true);
    setFormClassIds([]);
    setFormFullDay(true);
    setFormSuspend(true);
    setFormNotify(true);
    setConflicts(null);
    setIsDeclareModalOpen(true);
  };

  const handleOpenEditModal = (ev: CalendarEvent) => {
    setEditingId(ev.id);
    setFormTitle(ev.title);
    setFormType(ev.eventType);
    setFormStartDate(ev.startDate);
    setFormEndDate(ev.endDate);
    setFormDescription(ev.description || '');
    setFormStartTime(ev.startTime || '');
    setFormEndTime(ev.endTime || '');
    setFormAudience(ev.targetAudience || 'ALL');
    setFormAllClasses(ev.affectsAllClasses);
    setFormClassIds(ev.classIds || []);
    setFormFullDay(ev.isFullDayHoliday);
    setFormSuspend(ev.classesSuspended);
    setFormNotify(ev.sendNotification);
    setConflicts(null);
    setIsDeclareModalOpen(true);
  };

  // Changing the type resets the sensible defaults for holidays vs. events
  const handleTypeChange = (value: CalendarEventType) => {
    setFormType(value);
    if (!editingId) {
      const holiday = isHolidayType(value);
      setFormFullDay(holiday);
      setFormSuspend(holiday);
    }
  };

  // Submit (create or update). Conflicts are returned by the server as a warning that
  // must be explicitly confirmed before publishing.
  const submitEvent = async (confirmConflicts: boolean) => {
    if (!formTitle.trim()) {
      addToast('Please enter an event title', 'warning');
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
    if (!formFullDay && (!formStartTime || !formEndTime)) {
      addToast('Please provide a start and end time, or mark the event as full day', 'warning');
      return;
    }
    if (!formAllClasses && formClassIds.length === 0) {
      addToast('Select at least one class, or apply the event school-wide', 'warning');
      return;
    }

    const payload: CalendarEventPayload = {
      sessionId: overview?.session?.id,
      title: formTitle.trim(),
      eventType: formType,
      startDate: formStartDate,
      endDate: formEndDate,
      startTime: formFullDay ? null : formStartTime,
      endTime: formFullDay ? null : formEndTime,
      description: formDescription.trim() || null,
      targetAudience: formAudience,
      affectsAllClasses: formAllClasses,
      classIds: formAllClasses ? [] : formClassIds,
      isFullDayHoliday: formFullDay,
      classesSuspended: formSuspend,
      sendNotification: formNotify,
      isPublished: true,
      confirmConflicts
    };

    try {
      setSubmitting(true);
      if (editingId) {
        const res = await calendarApi.updateEvent(editingId, payload);
        addToast(
          res.changedFields?.length
            ? `"${res.title}" updated. ${formNotify ? 'Affected users have been notified.' : ''}`
            : `"${res.title}" saved.`,
          'success'
        );
      } else {
        const res = await calendarApi.createEvent(payload);
        addToast(
          `"${res.title}" published.${res.classesSuspended ? ` ${res.autoCancelledLessonsCount || 0} scheduled lessons suspended.` : ''}`,
          'success'
        );
      }
      setConflicts(null);
      setIsDeclareModalOpen(false);
      loadData();
    } catch (err: any) {
      if (err?.code === 'SCHEDULE_CONFLICT' && Array.isArray(err?.details?.conflicts)) {
        setConflicts(err.details.conflicts);
      } else {
        addToast(err?.message || 'Failed to save calendar event', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    submitEvent(false);
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!holidayToDelete) return;
    try {
      setDeleting(true);
      const res = await calendarApi.deleteEvent(holidayToDelete.id);
      addToast(
        `"${holidayToDelete.title}" cancelled.${res.restoredLessons ? ` ${res.restoredLessons} lessons restored.` : ''} Affected users have been notified.`,
        'info'
      );
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
      case 'EMERGENCY_CLOSURE':
        return { label: 'Emergency Holiday', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: ShieldAlert };
      case 'SPECIAL_HOLIDAY':
        return { label: 'Special Holiday', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Sparkles };
      case 'EXAMINATION':
        return { label: 'Examination', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: GraduationCap };
      case 'SCHOOL_EVENT':
        return { label: 'School Event', color: 'bg-sky-50 text-sky-700 border-sky-200', icon: CalendarCheck };
      case 'PARENT_MEETING':
        return { label: 'Parent Meeting', color: 'bg-amber-50 text-amber-800 border-amber-200', icon: Users };
      case 'ANNOUNCEMENT':
        return { label: 'Announcement', color: 'bg-slate-50 text-slate-700 border-slate-200', icon: Megaphone };
      default:
        return { label: 'Holiday', color: 'bg-indigo-50 text-indigo-700 border-indigo-200', icon: CalendarDays };
    }
  };

  const todayStr = localDateKey();

  const classNameById = (id: number) => classOptions.find((c) => c.id === id)?.name || `Class #${id}`;

  // 12 mini-month grids for the year view
  const yearGrid = useMemo(() => {
    return MONTH_NAMES.map((name, idx) => {
      const firstDay = new Date(year, idx, 1).getDay();
      const offset = (firstDay + 6) % 7;
      const daysInMonth = new Date(year, idx + 1, 0).getDate();
      const cells: ({ day: number; key: string; events: CalendarEvent[] } | null)[] = [];
      for (let i = 0; i < offset; i++) cells.push(null);
      for (let d = 1; d <= daysInMonth; d++) {
        const key = `${year}-${String(idx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        cells.push({ day: d, key, events: yearEvents.filter((e) => key >= e.startDate && key <= e.endDate) });
      }
      return { name, idx, cells };
    });
  }, [year, yearEvents]);

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
                {viewMode === 'year' ? `Year ${year}` : `${MONTH_NAMES[month - 1]} ${year}`}
              </h2>
              <span className="text-xs font-bold text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                {viewMode === 'year' ? `${yearEvents.length} Events` : `${overview?.days.length || 0} Days`}
              </span>
              <div className="flex bg-white p-0.5 rounded-lg border border-slate-200 text-[11px] font-bold">
                {(['month', 'year'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setViewMode(v)}
                    className={`px-2.5 py-1 rounded-md transition-colors ${viewMode === v ? 'bg-[#36348e] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                  >
                    {v === 'month' ? 'Month' : 'Year'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto">
              <button
                onClick={() => (viewMode === 'year' ? setCurrentDate(new Date(year - 1, month - 1, 1)) : handlePrevMonth())}
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
                onClick={() => (viewMode === 'year' ? setCurrentDate(new Date(year + 1, month - 1, 1)) : handleNextMonth())}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {viewMode === 'year' ? (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 bg-slate-50/40">
              {yearGrid.map((m) => (
                <div key={m.name} className="bg-white border border-slate-200/80 rounded-xl p-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentDate(new Date(year, m.idx, 1));
                      setViewMode('month');
                    }}
                    className="text-xs font-black text-[#191847] hover:text-[#36348e] mb-2"
                  >
                    {m.name}
                  </button>
                  <div className="grid grid-cols-7 gap-0.5 text-center text-[9px] font-bold text-slate-400 mb-1">
                    {WEEKDAYS.map((w) => (
                      <div key={w}>{w.charAt(0)}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-0.5">
                    {m.cells.map((c, i) =>
                      c ? (
                        <div
                          key={c.key}
                          title={c.events.map((e) => e.title).join(', ')}
                          className={`h-6 rounded text-[10px] font-bold flex items-center justify-center ${
                            c.events.some((e) => e.classesSuspended)
                              ? 'bg-rose-100 text-rose-800'
                              : c.events.length > 0
                              ? 'bg-indigo-100 text-[#36348e]'
                              : c.key === todayStr
                              ? 'ring-1 ring-[#36348e] text-slate-800'
                              : 'text-slate-600'
                          }`}
                        >
                          {c.day}
                        </div>
                      ) : (
                        <div key={`e-${i}`} />
                      )
                    )}
                  </div>
                </div>
              ))}
              <div className="sm:col-span-2 xl:col-span-3 flex items-center gap-4 text-[11px] font-semibold text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-100" /> Holiday / classes suspended</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-indigo-100" /> Event / examination</span>
              </div>
            </div>
          ) : (
          <>
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
                          {dayItem.events?.length > 0 ? (
                            <span className="text-[#36348e] font-bold line-clamp-2">
                              {dayItem.events.map((e: any) => e.title).join(', ')}
                            </span>
                          ) : scheduledLessons > 0 ? (
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
          </>
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
                <h3 className="text-sm font-black text-slate-900">
                  Holidays & Calendar Events · {MONTH_NAMES[month - 1]} {year}
                </h3>
                <p className="text-xs text-slate-500">Holidays, examinations, school events and announcements published to the portals</p>
              </div>
            </div>

            <button
              onClick={() => handleOpenDeclareModal()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-[#36348e] text-xs font-bold rounded-lg border border-indigo-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              Add Event
            </button>
          </div>

          {monthEvents.length > 0 ? (
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
                  {monthEvents.map((h) => {
                    const badge = getHolidayBadge(h.eventType);
                    const startDateStr = h.startDate;
                    const endDateStr = h.endDate;
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
                              <div className="text-[10px] font-bold text-slate-500 mt-0.5">
                                {badge.label} · {AUDIENCE_OPTIONS.find((a) => a.value === h.targetAudience)?.label || 'Everyone'}
                                {' · '}
                                {h.affectsAllClasses ? 'School-wide' : h.classIds.map(classNameById).join(', ')}
                              </div>
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
                          {h.startTime && h.endTime && (
                            <div className="text-[10px] font-semibold text-slate-500 mt-0.5">
                              {h.startTime} – {h.endTime}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {h.classesSuspended ? (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-extrabold text-[11px]">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>
                                {h.autoCancelledLessonsCount || 0} Lessons Suspended
                                {!h.isFullDayHoliday && ' (partial day)'}
                              </span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-extrabold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Classes run normally</span>
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-slate-600">
                          <div className="font-semibold text-slate-900">{h.createdByName || 'School Principal'}</div>
                          <div className="text-[10px] text-slate-400">Official Directive</div>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleOpenEditModal(h)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-[#36348e] hover:bg-indigo-50 rounded-lg border border-transparent hover:border-indigo-100 transition-colors mr-1"
                            title="Edit event"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </button>
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
                  <h3 className="text-sm font-black tracking-tight">{editingId ? 'Edit Calendar Event' : 'Add Calendar Event'}</h3>
                  <p className="text-[11px] text-indigo-200">Published to the relevant portals with live notifications</p>
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
            <form onSubmit={handleSubmitHoliday} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Event Title <span className="text-rose-500">*</span>
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
                <label className="block text-xs font-extrabold text-slate-700 mb-1">Event Type</label>
                <select
                  value={formType}
                  onChange={(e) => handleTypeChange(e.target.value as CalendarEventType)}
                  className="w-full px-3.5 py-2 text-xs font-semibold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#36348e]/20 focus:border-[#36348e]"
                >
                  {EVENT_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">Target Audience</label>
                <select
                  value={formAudience}
                  onChange={(e) => setFormAudience(e.target.value as CalendarAudience)}
                  className="w-full px-3.5 py-2 text-xs font-semibold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#36348e]/20 focus:border-[#36348e]"
                >
                  {AUDIENCE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 mt-1">Principal and Admin users always see every event.</p>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">Scope</label>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setFormAllClasses(true)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${formAllClasses ? 'bg-[#36348e] text-white border-[#36348e]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                  >
                    Entire school
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormAllClasses(false)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${!formAllClasses ? 'bg-[#36348e] text-white border-[#36348e]' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                  >
                    Selected classes / sections
                  </button>
                </div>
                {!formAllClasses && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-2.5 border border-slate-200 rounded-xl max-h-36 overflow-y-auto">
                    {classOptions.length === 0 && <span className="text-[11px] text-slate-400 col-span-full">No classes found.</span>}
                    {classOptions.map((c) => (
                      <label key={c.id} className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formClassIds.includes(c.id)}
                          onChange={(e) =>
                            setFormClassIds((prev) => (e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id)))
                          }
                          className="accent-[#36348e]"
                        />
                        {c.name}
                      </label>
                    ))}
                  </div>
                )}
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

              <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={formFullDay} onChange={(e) => setFormFullDay(e.target.checked)} className="accent-[#36348e]" />
                  Full-day event / holiday
                </label>
                {!formFullDay && (
                  <div className="grid grid-cols-2 gap-3 pl-6">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Start Time</label>
                      <input
                        type="time"
                        value={formStartTime}
                        onChange={(e) => setFormStartTime(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#36348e]/20 focus:border-[#36348e]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">End Time</label>
                      <input
                        type="time"
                        value={formEndTime}
                        onChange={(e) => setFormEndTime(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#36348e]/20 focus:border-[#36348e]"
                      />
                    </div>
                    <p className="col-span-2 text-[10px] text-slate-500">Times are in the school's timezone.</p>
                  </div>
                )}
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={formSuspend} onChange={(e) => setFormSuspend(e.target.checked)} className="accent-[#36348e]" />
                  Suspend regular classes {formFullDay ? 'for these dates' : 'during this time window'}
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={formNotify} onChange={(e) => setFormNotify(e.target.checked)} className="accent-[#36348e]" />
                  Send live notification to the selected audience
                </label>
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Official notice text or instructions for staff and students..."
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-semibold border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#36348e]/20 focus:border-[#36348e]"
                />
              </div>

              {/* Enforcement Notice */}
              {formSuspend && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2.5">
                  <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="text-[11px] text-amber-900 leading-relaxed font-medium">
                    <span className="font-extrabold text-amber-950">Timetable:</span> Scheduled lessons for the{' '}
                    {formAllClasses ? 'whole school' : 'selected classes'} {formFullDay ? 'on these dates' : 'in this time window'} will
                    show as Holiday. The recurring timetable is not changed and lessons return automatically if this event is cancelled.
                  </div>
                </div>
              )}

              {/* Conflict review */}
              {conflicts && conflicts.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-black text-rose-800">
                    <AlertTriangle className="w-4 h-4" />
                    {conflicts.length} schedule conflict{conflicts.length === 1 ? '' : 's'} found
                  </div>
                  <ul className="space-y-1 max-h-32 overflow-y-auto">
                    {conflicts.map((c, i) => (
                      <li key={`${c.kind}-${c.id}-${i}`} className="text-[11px] text-rose-900">
                        <span className="font-bold">{c.title}</span>
                        {' — '}
                        {c.reason}
                        {(c.date || c.startDate) && (
                          <span className="text-rose-700">
                            {' '}
                            ({c.date || (c.startDate === c.endDate ? c.startDate : `${c.startDate} → ${c.endDate}`)})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setConflicts(null)}
                      className="px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100 rounded-lg"
                    >
                      Go back and adjust
                    </button>
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => submitEvent(true)}
                      className="px-3 py-1.5 text-[11px] font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
                    >
                      Publish anyway
                    </button>
                  </div>
                </div>
              )}

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
                  {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Publish Event'}
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

            {Array.isArray(selectedDayInfo.events) && selectedDayInfo.events.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Events on this day</div>
                {selectedDayInfo.events.map((ev: { id: number; title: string; eventType: string }) => {
                  const b = getHolidayBadge(ev.eventType);
                  const full = monthEvents.find((m) => m.id === ev.id);
                  return (
                    <div key={ev.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-slate-200">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 truncate">{ev.title}</div>
                        <div className="text-[10px] text-slate-500">
                          {b.label}
                          {full?.startTime && full?.endTime ? ` · ${full.startTime}–${full.endTime}` : ''}
                        </div>
                      </div>
                      {full && (
                        <button
                          onClick={() => {
                            setSelectedDayInfo(null);
                            handleOpenEditModal(full);
                          }}
                          className="p-1 rounded-md text-[#36348e] hover:bg-indigo-50"
                          title="Edit event"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => {
                  handleOpenDeclareModal(selectedDayInfo.date);
                  setSelectedDayInfo(null);
                }}
                className="px-3 py-1.5 bg-[#36348e] text-white text-xs font-bold rounded-lg hover:bg-[#28266e]"
              >
                Add Event on this Day
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

