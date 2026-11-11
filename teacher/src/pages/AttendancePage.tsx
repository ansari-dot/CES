import React, { useState, useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  setStudentStatus,
  setStudentRemark,
  markAllRemainingPresent,
  markAllAbsent,
  markAllLate,
  markAllExcused,
  openCorrectionDrawer,
  openSubmitModal,
  fetchLessonRosterThunk,
  fetchClassRosterThunk,
  submitAttendanceThunk,
  fetchSubmittedLogsThunk,
} from '../store/slices/attendanceSlice';
import { addToast } from '../store/slices/uiSlice';
import { SubmitAttendanceModal } from '../components/attendance/SubmitAttendanceModal';
import { CorrectionDrawer } from '../components/attendance/CorrectionDrawer';
import {
  CalendarCheck,
  Calendar,
  Users,
  Check,
  X,
  Save,
  Filter,
  History,
  Eye,
  CheckCircle2,
  XCircle,
  Lock,
  Unlock,
  Download,
  Search,
  BookOpen,
  GraduationCap,
  Clock,
  CalendarOff,
  BellRing,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  RefreshCw,
  CheckSquare,
  MessageSquare,
  AlertTriangle
} from 'lucide-react';
import { AttendanceStatus } from '../types';

export const AttendancePage: React.FC = () => {
  const dispatch = useAppDispatch();
  const isLocked = useAppSelector((state) => state.attendance.isLocked);
  const submittedLogs = useAppSelector((state) => state.attendance.submittedLogs);
  const roster = useAppSelector((state) => state.attendance.roster);
  const teacher = useAppSelector((state) => state.auth.teacher);
  const lessons = useAppSelector((state) => state.timetable.lessons);
  const globalSelectedClassId = useAppSelector((state) => state.auth.selectedClassId);

  const [isSaving, setIsSaving] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<string>('last-6-months');
  const [inspectingLog, setInspectingLog] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent' | 'late' | 'excused'>('all');

  // 1. Initial Load: Fetch Submitted Attendance Logs from backend
  useEffect(() => {
    dispatch(fetchSubmittedLogsThunk());
  }, [dispatch]);

  // 2. Extract unique classes assigned to this teacher
  const uniqueClasses = useMemo(() => {
    const list = teacher?.assignedClasses || [];
    const map = new Map<string, { id: string; classId: number; name: string; enrolledCount: number; subject: string }>();
    for (const c of list) {
      const cid = String(c.classId || c.id);
      if (!map.has(cid)) {
        map.set(cid, {
          id: cid,
          classId: Number(c.classId || cid),
          name: c.className || c.name?.split(' - ')[0] || `Class ${c.grade}`,
          enrolledCount: c.enrolledCount || 0,
          subject: c.subject || 'Subject'
        });
      }
    }
    return Array.from(map.values());
  }, [teacher?.assignedClasses]);

  // 3. Filter States: Class, Teacher, Subject, Date
  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    if (globalSelectedClassId && globalSelectedClassId !== 'all') {
      return String(globalSelectedClassId);
    }
    return uniqueClasses[0]?.id || '1';
  });

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });

  // Keep selectedClassId synced when uniqueClasses loads
  useEffect(() => {
    if (uniqueClasses.length > 0) {
      const exists = uniqueClasses.some((c) => c.id === selectedClassId);
      if (!exists) {
        setSelectedClassId(uniqueClasses[0].id);
      }
    }
  }, [uniqueClasses, selectedClassId]);

  // Current active class object
  const currentClassObj = useMemo(() => {
    return uniqueClasses.find((c) => c.id === selectedClassId) || uniqueClasses[0];
  }, [uniqueClasses, selectedClassId]);

  // Filter lessons for the currently selected class
  const classLessons = useMemo(() => {
    if (!selectedClassId) return lessons;
    const numCid = Number(selectedClassId);
    const targetClass = uniqueClasses.find((c) => c.id === selectedClassId);
    return lessons.filter((l) => {
      return (
        l.rawClassId === numCid ||
        String(l.classId) === String(selectedClassId) ||
        (targetClass && (
          l.className?.toLowerCase() === targetClass.name.toLowerCase() ||
          l.className?.toLowerCase().includes(`class ${targetClass.classId}`)
        ))
      );
    });
  }, [lessons, selectedClassId, uniqueClasses]);

  // Available subjects for selected class
  const classSubjects = useMemo(() => {
    const subjects = new Set<string>();
    if (currentClassObj?.subject) subjects.add(currentClassObj.subject);
    classLessons.forEach((l) => {
      if (l.subject) subjects.add(l.subject);
    });
    if (subjects.size === 0) subjects.add('Mathematics');
    return Array.from(subjects);
  }, [currentClassObj, classLessons]);

  const [selectedSubject, setSelectedSubject] = useState<string>(() => {
    return classSubjects[0] || currentClassObj?.subject || 'Mathematics';
  });

  useEffect(() => {
    if (classSubjects.length > 0 && !classSubjects.includes(selectedSubject)) {
      setSelectedSubject(classSubjects[0]);
    } else if (currentClassObj?.subject) {
      setSelectedSubject(currentClassObj.subject);
    }
  }, [classSubjects, currentClassObj, selectedSubject]);

  // Active Lesson / Period selection
  const [activeLessonId, setActiveLessonId] = useState<string | number>(() => {
    return classLessons[0]?.rawId || classLessons[0]?.id || 1;
  });

  // Re-sync active lesson when selected class changes
  useEffect(() => {
    if (classLessons.length > 0) {
      const datedMatch = classLessons.find((l) => l.date === selectedDate);
      const targetLesson = datedMatch || classLessons[0];
      const targetId = targetLesson.rawId || targetLesson.id;
      setActiveLessonId(targetId);
      dispatch(fetchLessonRosterThunk(targetId));
    } else if (selectedClassId) {
      setActiveLessonId(`CLASS-${selectedClassId}`);
      dispatch(fetchClassRosterThunk(Number(selectedClassId)));
    }
  }, [selectedClassId, classLessons, selectedDate, dispatch]);

  const handleApplyFilter = () => {
    if (classLessons.length > 0) {
      const datedMatch = classLessons.find((l) => l.date === selectedDate);
      const targetLesson = datedMatch || classLessons[0];
      const targetId = targetLesson.rawId || targetLesson.id;
      setActiveLessonId(targetId);
      dispatch(fetchLessonRosterThunk(targetId));
    } else if (selectedClassId) {
      setActiveLessonId(`CLASS-${selectedClassId}`);
      dispatch(fetchClassRosterThunk(Number(selectedClassId)));
    }
    dispatch(
      addToast({
        message: `Filter applied: ${currentClassObj?.name || 'Class'} • ${selectedSubject} • ${selectedDate}`,
        type: 'info',
      })
    );
  };

  const handleMarkAllPresent = () => {
    if (isLocked) return;
    dispatch(markAllRemainingPresent());
    dispatch(addToast({ message: 'All enrolled students marked as Present.', type: 'success' }));
  };

  const handleMarkAllAbsent = () => {
    if (isLocked) return;
    dispatch(markAllAbsent());
    dispatch(addToast({ message: 'All enrolled students marked as Absent.', type: 'info' }));
  };

  // Submit / Save Attendance
  const handleSaveAttendance = async (isFinalize: boolean = false) => {
    if (isLocked) {
      dispatch(addToast({ message: 'Attendance is locked. Submit a correction voucher to edit.', type: 'info' }));
      return;
    }

    if (roster.length === 0) {
      dispatch(addToast({ message: 'No students enrolled in this roster to save.', type: 'error' }));
      return;
    }

    if (isFinalize) {
      dispatch(openSubmitModal());
      return;
    }

    setIsSaving(true);
    let targetLessonId: number | string = activeLessonId;
    if (typeof targetLessonId === 'string' && targetLessonId.startsWith('CLASS-')) {
      targetLessonId = parseInt(targetLessonId.replace('CLASS-', ''), 10) || Number(selectedClassId);
    } else if (typeof targetLessonId === 'string' && targetLessonId.startsWith('SLOT-')) {
      targetLessonId = parseInt(targetLessonId.replace('SLOT-', ''), 10) || Number(selectedClassId);
    } else if (typeof targetLessonId === 'string' && targetLessonId.startsWith('LES-')) {
      targetLessonId = parseInt(targetLessonId.replace('LES-', ''), 10);
    }

    try {
      await dispatch(
        submitAttendanceThunk({
          lessonId: targetLessonId,
          records: roster.map((r) => ({
            studentId: r.studentId,
            status: r.status,
            remark: r.remark,
          })),
          isLocked: false,
        })
      ).unwrap();

      const notifyCount = roster.filter((r) => r.status === 'absent' || r.status === 'late' || r.status === 'excused' || r.status === 'leave').length;

      dispatch(
        addToast({
          message: `Attendance draft saved successfully! ${notifyCount > 0 ? `Alerts queued for ${notifyCount} parents.` : ''}`,
          type: 'success',
        })
      );
      dispatch(fetchSubmittedLogsThunk());
    } catch (err: any) {
      dispatch(addToast({ message: err || 'Failed to save attendance', type: 'error' }));
    } finally {
      setIsSaving(false);
    }
  };

  // Current session counts
  const totalEnrolled = roster.length;
  const presentCount = roster.filter((r) => r.status === 'present').length;
  const absentCount = roster.filter((r) => r.status === 'absent').length;
  const lateCount = roster.filter((r) => r.status === 'late').length;
  const leaveCount = roster.filter((r) => r.status === 'excused' || r.status === 'leave').length;
  const netAttendanceRate = totalEnrolled > 0 ? Math.round(((presentCount + lateCount) / totalEnrolled) * 100) : 100;
  const parentAlertCount = absentCount + lateCount + leaveCount;

  // Filtered roster by search query & status chip
  const filteredRoster = useMemo(() => {
    return roster.filter((s) => {
      // 1. Status Filter
      if (statusFilter === 'present' && s.status !== 'present') return false;
      if (statusFilter === 'absent' && s.status !== 'absent') return false;
      if (statusFilter === 'late' && s.status !== 'late') return false;
      if (statusFilter === 'excused' && s.status !== 'excused' && s.status !== 'leave') return false;

      // 2. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          s.studentName.toLowerCase().includes(q) ||
          s.rollNumber.toLowerCase().includes(q) ||
          s.admissionId.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [roster, statusFilter, searchQuery]);

  // Quick preset remark tags
  const remarkPresets = ['Medical Leave', 'Traffic Delay', 'Family Emergency', 'Permitted Absence', 'Sick'];

  // History filtering
  const filteredHistoryLogs = useMemo(() => {
    if (!Array.isArray(submittedLogs)) return [];
    if (historyFilter === 'all') return submittedLogs;

    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

    return submittedLogs.filter((log) => {
      const rawDate = log.submittedAt || log.date;
      if (!rawDate || rawDate === 'Today' || rawDate === 'Recent') return true;
      try {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          return d >= sixMonthsAgo;
        }
      } catch (_) {}
      return true;
    });
  }, [submittedLogs, historyFilter]);

  const formatHistoryMonth = (log: any) => {
    const rawDate = log.submittedAt || log.date;
    if (rawDate && rawDate !== 'Today' && rawDate !== 'Recent') {
      try {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          return new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(d);
        }
      } catch (_) {}
    }
    return 'Nov 2026';
  };

  return (
    <div className="flex flex-col w-full pb-12 space-y-5 animate-in fade-in duration-150">
      {/* ------------------------------------------------------------- */}
      {/* 1. HERO HEADER BANNER */}
      {/* ------------------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#36348e] text-white flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
              <CalendarCheck className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  Daily Roll Call & Verification
                </span>
                {isLocked ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md">
                    <Lock className="w-3 h-3" /> Locked & Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md">
                    <Unlock className="w-3 h-3" /> Active Session
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#1e1b4b] tracking-tight mt-1">
                Attendance Management
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Real-time student attendance verification with automatic guardian notification
              </p>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
            <button
              type="button"
              onClick={() => handleSaveAttendance(false)}
              disabled={isLocked || isSaving || roster.length === 0}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-2xs disabled:opacity-50 cursor-pointer active:scale-[0.98]"
            >
              <Save className="w-4 h-4 text-slate-600" />
              <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveAttendance(true)}
              disabled={isLocked || roster.length === 0}
              className="px-4.5 py-2.5 rounded-xl bg-[#36348e] hover:bg-[#2c2a75] text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md shadow-indigo-100 disabled:opacity-50 cursor-pointer active:scale-[0.98]"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Finalize & Submit</span>
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. TOP 4 KPI WAVE CARDS (MATCHING DASHBOARD) */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Enrolled */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-blue-100/80 hover:border-blue-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-blue-50 text-blue-700 border-blue-100">
              <span>{currentClassObj?.name || 'Class Roster'}</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
              {totalEnrolled}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Total Enrolled Students
            </div>
          </div>
          {/* Wave SVG */}
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(59, 130, 246, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Present Today */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-emerald-100/80 hover:border-emerald-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-emerald-50 text-emerald-700 border-emerald-100">
              <span>{netAttendanceRate}% Rate</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight leading-tight">
              {presentCount}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Students Present Today
            </div>
          </div>
          {/* Wave SVG */}
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(16, 185, 129, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#10b981" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Absent */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-rose-100/80 hover:border-rose-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white shadow-sm shadow-rose-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <XCircle className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border ${absentCount > 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
              <BellRing className="w-3 h-3" />
              <span>{absentCount > 0 ? 'Alert Queued' : 'Zero Absent'}</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-rose-700 tracking-tight leading-tight">
              {absentCount}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Absent Students
            </div>
          </div>
          {/* Wave SVG */}
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(244, 63, 94, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Late & Leave */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-amber-100/80 hover:border-amber-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Clock className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-amber-50 text-amber-800 border-amber-200">
              <span>{lateCount} Late • {leaveCount} Leave</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-amber-800 tracking-tight leading-tight">
              {lateCount + leaveCount}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Late &amp; Leave Status
            </div>
          </div>
          {/* Wave SVG */}
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(245, 158, 11, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. HORIZONTAL FILTER BAR */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/80">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-end">
          {/* Class */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 tracking-wide flex items-center gap-1.5">
              <GraduationCap className="w-3.5 h-3.5 text-indigo-700" />
              <span>Assigned Class</span>
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full bg-white hover:bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer transition-colors shadow-2xs"
            >
              {uniqueClasses.length === 0 ? (
                <option value="">No Assigned Classes</option>
              ) : (
                uniqueClasses.map((cls, idx) => (
                  <option key={`cls-${cls.id || idx}`} value={cls.id}>
                    {cls.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Teacher */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 tracking-wide flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-700" />
              <span>Teacher</span>
            </label>
            <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 flex items-center justify-between shadow-2xs">
              <span className="truncate">{teacher?.name || 'Faculty Member'}</span>
              <span className="text-[10px] text-indigo-700 font-extrabold uppercase bg-indigo-50 px-2 py-0.5 rounded-md">
                Active
              </span>
            </div>
          </div>

          {/* Subject */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-700 tracking-wide flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-indigo-700" />
              <span>Subject</span>
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full bg-white hover:bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer transition-colors shadow-2xs"
            >
              {classSubjects.length > 0 ? (
                classSubjects.map((sub, idx) => (
                  <option key={`sub-${sub}-${idx}`} value={sub}>
                    {sub}
                  </option>
                ))
              ) : (
                <option value={currentClassObj?.subject || 'Mathematics'}>
                  {currentClassObj?.subject || 'Mathematics'}
                </option>
              )}
            </select>
          </div>

          {/* Date Picker */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 tracking-wide flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-700" />
                <span>Session Date</span>
              </label>
              <button
                type="button"
                onClick={() => setSelectedDate(new Date().toISOString().slice(0, 10))}
                className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 cursor-pointer"
              >
                Today
              </button>
            </div>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-white hover:bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer transition-colors shadow-2xs"
            />
          </div>

          {/* Apply Filter Button */}
          <div>
            <button
              type="button"
              onClick={handleApplyFilter}
              className="w-full h-[42px] rounded-xl bg-[#36348e] hover:bg-[#2c2a75] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-sm shadow-indigo-100 cursor-pointer active:scale-[0.98]"
            >
              <Filter className="w-4 h-4 stroke-[2.5]" />
              <span>Apply Filter</span>
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. STUDENTS ATTENDANCE ROSTER SECTION */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        {/* Roster Strip Header */}
        <div className="p-4 sm:p-5 bg-white border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-[#36348e] flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <h2 className="text-sm sm:text-base font-extrabold text-[#1e1b4b]">
                {currentClassObj?.name || 'Class Roster'} • {selectedSubject}
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5 ml-10">
              Session date: {selectedDate} • {totalEnrolled} students enrolled
            </p>
          </div>

          {/* Search & Bulk Action Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student or roll #..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all placeholder:text-slate-400"
              />
            </div>

            {/* Bulk Action Buttons */}
            <button
              type="button"
              onClick={handleMarkAllPresent}
              disabled={isLocked || roster.length === 0}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>Mark All Present</span>
            </button>

            <button
              type="button"
              onClick={handleMarkAllAbsent}
              disabled={isLocked || roster.length === 0}
              className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              <X className="w-3.5 h-3.5 stroke-[3]" />
              <span>Mark All Absent</span>
            </button>
          </div>
        </div>

        {/* Filter Chips Bar */}
        <div className="px-4 sm:px-5 py-2.5 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 font-bold mr-1 text-[11px] uppercase tracking-wider">Filter:</span>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-[#36348e] text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-200/60 border border-slate-200'
              }`}
            >
              All ({totalEnrolled})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('present')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                statusFilter === 'present'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200'
              }`}
            >
              Present ({presentCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('absent')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                statusFilter === 'absent'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-white text-rose-700 hover:bg-rose-50 border border-rose-200'
              }`}
            >
              Absent ({absentCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('late')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                statusFilter === 'late'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-white text-amber-800 hover:bg-amber-50 border border-amber-200'
              }`}
            >
              Late ({lateCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('excused')}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                statusFilter === 'excused'
                  ? 'bg-indigo-700 text-white shadow-2xs'
                  : 'bg-white text-indigo-700 hover:bg-indigo-50 border border-indigo-200'
              }`}
            >
              On Leave ({leaveCount})
            </button>
          </div>

          {/* Quick Notice about parent alerts */}
          <div className="flex items-center gap-1.5 text-slate-500 font-semibold text-[11px]">
            <BellRing className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>Parents will be notified for Absent, Late &amp; Leave</span>
          </div>
        </div>

        {/* Student List Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200/70 h-11 select-none text-[11px]">
                <th className="px-5 py-2 w-12 text-center">#</th>
                <th className="px-5 py-2 min-w-[200px]">Student Details</th>
                <th className="px-5 py-2 w-28 text-center">Roll No</th>
                <th className="px-5 py-2 min-w-[340px] text-center">Attendance Status</th>
                <th className="px-5 py-2 min-w-[220px]">Remarks / Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRoster.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400">
                    <Users className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-700 text-xs">No students match current filter</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Try clearing the search query or status filter above.</p>
                  </td>
                </tr>
              ) : (
                filteredRoster.map((student, idx) => {
                  const isPresent = student.status === 'present';
                  const isAbsent = student.status === 'absent';
                  const isLate = student.status === 'late';
                  const isLeave = student.status === 'excused' || student.status === 'leave';

                  return (
                    <tr
                      key={student.studentId}
                      className={`h-15 transition-colors ${
                        isAbsent
                          ? 'bg-rose-50/40 hover:bg-rose-50/60'
                          : isLate
                          ? 'bg-amber-50/30 hover:bg-amber-50/50'
                          : isLeave
                          ? 'bg-indigo-50/30 hover:bg-indigo-50/50'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* # Numbering */}
                      <td className="px-5 py-2 text-center font-mono font-semibold text-slate-400 text-xs">
                        {idx + 1}
                      </td>

                      {/* Student Info */}
                      <td className="px-5 py-2">
                        <div className="flex items-center gap-3">
                          <img
                            src={student.avatar}
                            alt={student.studentName}
                            className="w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-slate-200"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-slate-900 truncate flex items-center gap-1.5">
                              <span>{student.studentName}</span>
                              {student.streak && student.streak.includes('Perfect') && (
                                <span className="inline-flex items-center text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-extrabold border border-amber-200">
                                  ★ Star
                                </span>
                              )}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              {student.admissionId}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Roll Number */}
                      <td className="px-5 py-2 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 font-mono font-bold text-slate-700 text-xs border border-slate-200/60">
                          #{student.rollNumber || `0${idx + 1}`}
                        </span>
                      </td>

                      {/* 4-State Interactive Toggle Pills */}
                      <td className="px-5 py-2">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* 1. Present Button */}
                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() =>
                              dispatch(setStudentStatus({ studentId: student.studentId, status: 'present' }))
                            }
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                              isPresent
                                ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-300 scale-[1.02]'
                                : 'bg-slate-50 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                            title={`Mark ${student.studentName} Present`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Present</span>
                          </button>

                          {/* 2. Absent Button */}
                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() =>
                              dispatch(setStudentStatus({ studentId: student.studentId, status: 'absent' }))
                            }
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                              isAbsent
                                ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-300 scale-[1.02]'
                                : 'bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                            title={`Mark ${student.studentName} Absent`}
                          >
                            <XCircle className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Absent</span>
                          </button>

                          {/* 3. Late Button */}
                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() =>
                              dispatch(setStudentStatus({ studentId: student.studentId, status: 'late' }))
                            }
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                              isLate
                                ? 'bg-amber-500 text-white shadow-xs ring-2 ring-amber-300 scale-[1.02]'
                                : 'bg-slate-50 hover:bg-amber-50 text-slate-600 hover:text-amber-800 border border-slate-200'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                            title={`Mark ${student.studentName} Late`}
                          >
                            <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Late</span>
                          </button>

                          {/* 4. Leave (Excused) Button */}
                          <button
                            type="button"
                            disabled={isLocked}
                            onClick={() =>
                              dispatch(setStudentStatus({ studentId: student.studentId, status: 'excused' }))
                            }
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                              isLeave
                                ? 'bg-[#36348e] text-white shadow-xs ring-2 ring-indigo-300 scale-[1.02]'
                                : 'bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                            title={`Mark ${student.studentName} on Leave`}
                          >
                            <CalendarOff className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Leave</span>
                          </button>
                        </div>
                      </td>

                      {/* Remarks / Notes Input */}
                      <td className="px-5 py-2">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            disabled={isLocked}
                            value={student.remark || ''}
                            onChange={(e) =>
                              dispatch(
                                setStudentRemark({
                                  studentId: student.studentId,
                                  remark: e.target.value,
                                })
                              )
                            }
                            placeholder={isAbsent || isLate || isLeave ? 'Reason e.g. sick, traffic...' : 'Optional note...'}
                            className="w-full text-xs text-slate-800 placeholder:text-slate-400 py-1.5 px-3 rounded-xl bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 focus:border-indigo-400 focus:outline-none transition-all"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Save & Submission Action Strip */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold flex-wrap">
            <span>Enrolled: <strong>{totalEnrolled}</strong></span>
            <span>•</span>
            <span className="text-emerald-700 font-bold">Present: {presentCount}</span>
            <span>•</span>
            <span className="text-rose-700 font-bold">Absent: {absentCount}</span>
            <span>•</span>
            <span className="text-amber-800 font-bold">Late: {lateCount}</span>
            <span>•</span>
            <span className="text-indigo-700 font-bold">On Leave: {leaveCount}</span>
            {parentAlertCount > 0 && (
              <span className="ml-2 px-2 py-0.5 rounded-md bg-indigo-50 text-[#36348e] border border-indigo-200 font-bold text-[11px]">
                {parentAlertCount} Parent Alert{parentAlertCount > 1 ? 's' : ''} Ready
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
            <button
              type="button"
              onClick={() => handleSaveAttendance(false)}
              disabled={isLocked || isSaving || roster.length === 0}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 active:scale-[0.98]"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving Draft...' : 'Save Draft'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveAttendance(true)}
              disabled={isLocked || roster.length === 0}
              className="px-5 py-2.5 rounded-xl bg-[#36348e] hover:bg-[#2c2a75] text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md shadow-indigo-100 disabled:opacity-50 cursor-pointer active:scale-[0.98]"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Finalize &amp; Submit Attendance</span>
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. ATTENDANCE HISTORY SECTION */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-[#36348e] flex items-center justify-center shrink-0">
              <History className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-[#1e1b4b]">Attendance History</h2>
              <p className="text-xs text-slate-400">Previous sessions and official locked submissions</p>
            </div>
          </div>

          {/* Month / Range Filter */}
          <select
            value={historyFilter}
            onChange={(e) => setHistoryFilter(e.target.value)}
            className="bg-white hover:bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer shadow-2xs"
          >
            <option value="last-6-months">Last 6 Months</option>
            <option value="all">All Records</option>
          </select>
        </div>

        {/* History Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200/70 h-11 select-none text-[11px]">
                <th className="px-5 py-2 min-w-[130px]">Month &amp; Date</th>
                <th className="px-5 py-2 min-w-[100px]">Class</th>
                <th className="px-5 py-2 min-w-[130px]">Subject</th>
                <th className="px-5 py-2 text-center w-24">Enrolled</th>
                <th className="px-5 py-2 text-center w-20">Present</th>
                <th className="px-5 py-2 text-center w-20">Absent</th>
                <th className="px-5 py-2 text-center w-20">Late</th>
                <th className="px-5 py-2 text-center w-20">Leave</th>
                <th className="px-5 py-2 text-center w-28">Net Rate</th>
                <th className="px-5 py-2 text-center w-24">Status</th>
                <th className="px-5 py-2 text-right w-24">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHistoryLogs.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-10 text-slate-400">
                    <History className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
                    <p className="font-bold text-slate-700 text-xs">No historical attendance records yet</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Records will automatically appear here once sessions are submitted.</p>
                  </td>
                </tr>
              ) : (
                filteredHistoryLogs.map((log, idx) => {
                  const total = log.totalStudents || (log.presentCount + log.absentCount + (log.lateCount || 0) + (log.leaveCount || 0)) || 1;
                  const pct = Math.round(((log.presentCount + (log.lateCount || 0)) / total) * 100);

                  return (
                    <tr
                      key={`hist-${log.id}-${idx}`}
                      className="hover:bg-slate-50/80 h-13 transition-colors"
                    >
                      {/* Month & Date */}
                      <td className="px-5 py-2 font-bold text-slate-800">
                        <span>{formatHistoryMonth(log)}</span>
                        <span className="block text-[11px] font-mono text-slate-400 font-normal">
                          {log.date || 'Recent'}
                        </span>
                      </td>

                      {/* Class */}
                      <td className="px-5 py-2 font-semibold text-slate-700">
                        {log.className}
                      </td>

                      {/* Subject */}
                      <td className="px-5 py-2 font-semibold text-slate-700">
                        {log.subject || 'Mathematics'}
                      </td>

                      {/* Total Students */}
                      <td className="px-5 py-2 text-center font-bold text-slate-700">
                        {total}
                      </td>

                      {/* Present */}
                      <td className="px-5 py-2 text-center font-bold text-emerald-700">
                        {log.presentCount}
                      </td>

                      {/* Absent */}
                      <td className="px-5 py-2 text-center font-bold text-rose-700">
                        {log.absentCount}
                      </td>

                      {/* Late */}
                      <td className="px-5 py-2 text-center font-bold text-amber-800">
                        {log.lateCount || 0}
                      </td>

                      {/* Leave */}
                      <td className="px-5 py-2 text-center font-bold text-indigo-700">
                        {log.leaveCount || 0}
                      </td>

                      {/* Attendance % */}
                      <td className="px-5 py-2 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-black ${
                            pct >= 90
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : pct >= 75
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {pct}%
                        </span>
                      </td>

                      {/* Lock Status */}
                      <td className="px-5 py-2 text-center">
                        {log.isLocked ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                            <Lock className="w-3 h-3" /> Locked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                            <Unlock className="w-3 h-3" /> Draft
                          </span>
                        )}
                      </td>

                      {/* View Action */}
                      <td className="px-5 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setInspectingLog(log)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#36348e] hover:text-indigo-800 transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 6. VIEW SESSION DETAIL MODAL */}
      {/* ------------------------------------------------------------- */}
      {inspectingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-[#36348e] flex items-center justify-center">
                  <CalendarCheck className="w-4 h-4" />
                </div>
                <h3 className="font-extrabold text-base text-slate-900">Attendance Session Record</h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectingLog(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Class</span>
                  <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">{inspectingLog.className}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Subject</span>
                  <span className="font-extrabold text-indigo-700 text-sm mt-0.5 block">{inspectingLog.subject || 'Standard'}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Session Date</span>
                  <span className="font-mono font-bold text-slate-800 text-xs mt-0.5 block">
                    {inspectingLog.date || inspectingLog.submittedAt}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Status</span>
                  <span className="font-bold text-emerald-700 text-xs mt-0.5 block">
                    {inspectingLog.isLocked ? '✓ Finalized Record' : '✎ Saved Session'}
                  </span>
                </div>
              </div>

              {/* Counts Grid */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5">
                  <span className="text-xl font-black text-emerald-800 block">{inspectingLog.presentCount}</span>
                  <span className="text-[10px] font-bold uppercase text-emerald-700">Present</span>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5">
                  <span className="text-xl font-black text-rose-800 block">{inspectingLog.absentCount}</span>
                  <span className="text-[10px] font-bold uppercase text-rose-700">Absent</span>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                  <span className="text-xl font-black text-amber-800 block">{inspectingLog.lateCount || 0}</span>
                  <span className="text-[10px] font-bold uppercase text-amber-700">Late</span>
                </div>
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-2.5">
                  <span className="text-xl font-black text-indigo-800 block">{inspectingLog.leaveCount || 0}</span>
                  <span className="text-[10px] font-bold uppercase text-indigo-700">Leave</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const id = inspectingLog.id;
                  setInspectingLog(null);
                  dispatch(openCorrectionDrawer(id));
                }}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Request Correction
              </button>
              <button
                type="button"
                onClick={() => setInspectingLog(null)}
                className="px-4 py-2 rounded-xl bg-[#36348e] hover:bg-[#2c2a75] text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Modals & Drawers */}
      <SubmitAttendanceModal />
      <CorrectionDrawer />
    </div>
  );
};
