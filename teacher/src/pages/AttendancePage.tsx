import React, { useState, useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  markAllRemainingPresent,
  markAllAbsent,
  toggleRemarksExpanded,
  openCorrectionDrawer,
  fetchLessonRosterThunk,
  fetchClassRosterThunk,
  submitAttendanceThunk,
  fetchSubmittedLogsThunk,
} from '../store/slices/attendanceSlice';
import { addToast } from '../store/slices/uiSlice';
import { AttendanceStats } from '../components/attendance/AttendanceStats';
import { AttendanceRoster } from '../components/attendance/AttendanceRoster';
import { SubmitAttendanceModal } from '../components/attendance/SubmitAttendanceModal';
import { CorrectionDrawer } from '../components/attendance/CorrectionDrawer';
import {
  Save,
  CheckCircle2,
  XCircle,
  CheckCheck,
  Search,
  Download,
  MessageSquare,
  History,
  Lock,
  Unlock,
  GraduationCap,
  Clock,
  Calendar,
  BookOpen,
  Filter,
  Eye,
  RefreshCw,
  Users,
  Check,
  X,
  FileSpreadsheet,
  TrendingUp,
  UserCheck,
  UserX
} from 'lucide-react';

export const AttendancePage: React.FC = () => {
  const dispatch = useAppDispatch();
  const isLocked = useAppSelector((state) => state.attendance.isLocked);
  const remarksExpanded = useAppSelector((state) => state.attendance.remarksExpanded);
  const submittedLogs = useAppSelector((state) => state.attendance.submittedLogs);
  const roster = useAppSelector((state) => state.attendance.roster);
  const teacher = useAppSelector((state) => state.auth.teacher);
  const lessons = useAppSelector((state) => state.timetable.lessons);
  const globalSelectedClassId = useAppSelector((state) => state.auth.selectedClassId);

  // Active view: 'sheet' (Take Attendance) vs 'logs' (Monthly History & Records)
  const [activeTab, setActiveTab] = useState<'sheet' | 'logs'>('sheet');
  const [searchFilter, setSearchFilter] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Log filter states for Monthly Records
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>('all');
  const [selectedClassLogFilter, setSelectedClassLogFilter] = useState<string>('all');
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [inspectingLog, setInspectingLog] = useState<any | null>(null);

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

  // 3. Horizontal Filter State: Class, Subject, Date, Period
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
    return Array.from(subjects);
  }, [currentClassObj, classLessons]);

  const [selectedSubject, setSelectedSubject] = useState<string>(() => {
    return classSubjects[0] || currentClassObj?.subject || 'Mathematics';
  });

  useEffect(() => {
    if (classSubjects.length > 0) {
      if (!classSubjects.includes(selectedSubject)) {
        setSelectedSubject(classSubjects[0]);
      }
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

  const activeLesson = useMemo(() => {
    return classLessons.find(
      (l) => l.rawId === activeLessonId || l.id === activeLessonId
    ) || classLessons[0];
  }, [classLessons, activeLessonId]);

  const handleSelectClass = (clsId: string) => {
    setSelectedClassId(clsId);
  };

  const handleSelectLesson = (lessonIdentifier: string | number) => {
    setActiveLessonId(lessonIdentifier);
    if (typeof lessonIdentifier === 'string' && lessonIdentifier.startsWith('CLASS-')) {
      const cid = parseInt(lessonIdentifier.replace('CLASS-', ''), 10) || Number(selectedClassId);
      dispatch(fetchClassRosterThunk(cid));
    } else if (typeof lessonIdentifier === 'string' && lessonIdentifier.startsWith('SLOT-')) {
      dispatch(fetchClassRosterThunk(Number(selectedClassId)));
    } else {
      dispatch(fetchLessonRosterThunk(lessonIdentifier));
    }
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
          isLocked: isFinalize,
        })
      ).unwrap();

      dispatch(
        addToast({
          message: isFinalize
            ? 'Attendance finalized & officially submitted.'
            : 'Attendance saved successfully.',
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

  const handleExportCSV = () => {
    const className = currentClassObj?.name || 'Class';
    if (roster.length === 0) {
      dispatch(addToast({ message: 'No records to export.', type: 'info' }));
      return;
    }
    const header = ['Roll No', 'Student Name', 'Admission No', 'Status', 'Remarks'];
    const rows = roster.map((r) => [r.rollNumber, r.studentName, r.admissionId, r.status.toUpperCase(), r.remark || '']);
    const csvContent = [header, ...rows].map((e) => e.map((val) => `"${val}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance_${className.replace(/\s+/g, '_')}_${selectedDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    dispatch(addToast({ message: `Exported ${roster.length} student records to CSV.`, type: 'success' }));
  };

  // -------------------------------------------------------------
  // MONTHLY ATTENDANCE LOGS & FILTERING LOGIC
  // -------------------------------------------------------------
  const availableMonths = useMemo(() => {
    const monthSet = new Set<string>();
    submittedLogs.forEach((log) => {
      const rawDate = log.submittedAt || log.date;
      if (rawDate && rawDate !== 'Today' && rawDate !== 'Recent') {
        try {
          const d = new Date(rawDate);
          if (!isNaN(d.getTime())) {
            const label = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(d);
            monthSet.add(label);
          }
        } catch (_) {}
      }
    });

    // Always ensure current month and last month are available in the dropdown
    const currentLabel = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date());
    monthSet.add(currentLabel);
    return Array.from(monthSet);
  }, [submittedLogs]);

  const filteredLogs = useMemo(() => {
    return submittedLogs.filter((log) => {
      // 1. Month filter
      if (selectedMonthFilter !== 'all') {
        const rawDate = log.submittedAt || log.date;
        if (rawDate && rawDate !== 'Today' && rawDate !== 'Recent') {
          try {
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
              const label = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(d);
              if (label !== selectedMonthFilter) return false;
            }
          } catch (_) {}
        }
      }

      // 2. Class filter
      if (selectedClassLogFilter !== 'all') {
        if (!log.className.toLowerCase().includes(selectedClassLogFilter.toLowerCase())) {
          return false;
        }
      }

      // 3. Search query
      if (logSearchQuery.trim()) {
        const q = logSearchQuery.toLowerCase().trim();
        const match =
          log.className.toLowerCase().includes(q) ||
          log.subject.toLowerCase().includes(q) ||
          (log.date && log.date.toLowerCase().includes(q));
        if (!match) return false;
      }

      return true;
    });
  }, [submittedLogs, selectedMonthFilter, selectedClassLogFilter, logSearchQuery]);

  // Aggregate stats for filtered monthly logs
  const monthlyMetrics = useMemo(() => {
    const totalSessions = filteredLogs.length;
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalEnrolledSum = 0;

    filteredLogs.forEach((l) => {
      totalPresent += l.presentCount || 0;
      totalAbsent += l.absentCount || 0;
      totalEnrolledSum += l.totalStudents || (l.presentCount + l.absentCount);
    });

    const avgRate = totalEnrolledSum > 0 ? ((totalPresent / totalEnrolledSum) * 100).toFixed(1) : '100.0';

    return {
      totalSessions,
      totalPresent,
      totalAbsent,
      avgRate,
      totalEnrolledSum
    };
  }, [filteredLogs]);

  // Summary counts for current live roster
  const presentCount = roster.filter((r) => r.status === 'present').length;
  const absentCount = roster.filter((r) => r.status === 'absent').length;
  const attendanceRate = roster.length > 0 ? Math.round((presentCount / roster.length) * 100) : 100;

  return (
    <div className="flex flex-col w-full pb-10 space-y-4">
      {/* 1. Header with Tab Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl shadow-xs border border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Student Attendance</h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${
                isLocked ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-900 border border-amber-300'
              }`}
            >
              {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              <span>{isLocked ? 'Finalized / Locked' : 'Live / Draft'}</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Conduct daily student roll calls with instant check/uncheck marking and review monthly attendance logs.
          </p>
        </div>

        {/* Tab Switcher & Top Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center">
            <button
              type="button"
              onClick={() => setActiveTab('sheet')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'sheet'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Mark Attendance Sheet</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'logs'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Monthly Records ({submittedLogs.length})</span>
            </button>
          </div>

          {activeTab === 'sheet' && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSaveAttendance(false)}
                disabled={isLocked || isSaving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 text-slate-700 hover:bg-slate-100 text-xs font-bold border border-slate-200 transition-all disabled:opacity-50 shadow-xs cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 text-slate-500" />
                <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
              </button>
              <button
                type="button"
                onClick={() => handleSaveAttendance(true)}
                disabled={isLocked || isSaving}
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-white shadow-xs text-xs font-bold transition-all cursor-pointer ${
                  isLocked ? 'bg-slate-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isLocked ? 'Finalized' : 'Submit Attendance'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. HORIZONTAL FILTER BAR: CLASS • SUBJECT • PERIOD • DATE */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          {/* Class Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-indigo-600" />
              <span>Class</span>
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => handleSelectClass(e.target.value)}
              className="w-full bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer transition-colors"
            >
              {uniqueClasses.length === 0 ? (
                <option value="">No Assigned Classes</option>
              ) : (
                uniqueClasses.map((cls, idx) => (
                  <option key={`att-cls-${cls.id || idx}`} value={cls.id}>
                    {cls.name} ({cls.enrolledCount} Enrolled)
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Subject Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-indigo-600" />
              <span>Subject</span>
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer transition-colors"
            >
              {classSubjects.length > 0 ? (
                classSubjects.map((sub, idx) => (
                  <option key={`sub-opt-${sub}-${idx}`} value={sub}>
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

          {/* Date Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <span>Date</span>
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer transition-colors"
            />
          </div>

          {/* Lecture / Period Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>Lecture / Period</span>
            </label>
            <select
              value={activeLessonId}
              onChange={(e) => handleSelectLesson(e.target.value)}
              className="w-full bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer transition-colors"
            >
              {classLessons.length > 0 ? (
                classLessons.map((l, idx) => (
                  <option key={`les-${l.id}-${l.rawId || idx}`} value={l.rawId || l.id}>
                    Period {l.periodNumber || idx + 1}: {l.startTime} – {l.endTime} ({l.date})
                  </option>
                ))
              ) : (
                <option value={`CLASS-${selectedClassId}`}>
                  General Lecture Session • {selectedDate}
                </option>
              )}
            </select>
          </div>
        </div>

        {/* Selected Session Info Strip */}
        <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-extrabold text-slate-900">{currentClassObj?.name}</span>
            <span className="text-slate-300">•</span>
            <span className="font-bold text-indigo-700">{selectedSubject}</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500 font-medium">Session Date: <strong>{selectedDate}</strong></span>
            {activeLesson && (
              <>
                <span className="text-slate-300">•</span>
                <span className="text-slate-500 font-medium">{activeLesson.startTime} – {activeLesson.endTime}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              {roster.length} Enrolled Students
            </span>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* TAB 1: MARK ATTENDANCE SHEET */}
      {/* ---------------------------------------------------------------- */}
      {activeTab === 'sheet' && (
        <div className="space-y-4">
          {/* Quick Statistics Breakdown Cards */}
          <AttendanceStats />

          {/* Roster Search & Bulk Marking Toolbar */}
          <div className="bg-white rounded-xl p-3 shadow-xs border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search student name, Roll #, or Admission #..."
                className="w-full h-9 pl-8 pr-3 rounded-xl bg-slate-50 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none border border-slate-200 focus:border-indigo-400"
              />
            </div>

            {/* Bulk Marking Shortcuts */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
              <button
                type="button"
                onClick={handleMarkAllPresent}
                disabled={isLocked}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                title="Mark all students present"
              >
                <UserCheck className="w-4 h-4" />
                <span>Mark All Present</span>
              </button>

              <button
                type="button"
                onClick={handleMarkAllAbsent}
                disabled={isLocked}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-800 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                title="Uncheck all (mark all absent)"
              >
                <UserX className="w-4 h-4" />
                <span>Mark All Absent</span>
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                title="Export Roster to CSV"
              >
                <Download className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => dispatch(toggleRemarksExpanded())}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer ${
                  remarksExpanded ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Notes / Remarks</span>
              </button>
            </div>
          </div>

          {/* Student Interactive Checkbox Table */}
          <AttendanceRoster filterQuery={searchFilter} />

          {/* Bottom Confirmation & Submission Action Bar */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-wrap text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 text-sm">{presentCount}</span>
                <span className="text-emerald-700 font-bold">Present (Checked)</span>
              </div>
              <span className="text-slate-300">•</span>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 text-sm">{absentCount}</span>
                <span className="text-red-700 font-bold">Absent (Unchecked)</span>
              </div>
              <span className="text-slate-300">•</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium">Session Attendance:</span>
                <span className="font-black text-indigo-700 text-sm">{attendanceRate}%</span>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
              <button
                type="button"
                onClick={() => handleSaveAttendance(false)}
                disabled={isLocked || isSaving}
                className="px-4 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs sm:text-sm transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Save className="w-4 h-4 text-slate-500" />
                <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
              </button>

              <button
                type="button"
                onClick={() => handleSaveAttendance(true)}
                disabled={isLocked || isSaving}
                className="px-6 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm shadow-md transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isLocked ? 'Attendance Finalized' : 'Submit & Finalize Attendance'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* TAB 2: MONTHLY ATTENDANCE RECORDS & AUDIT LOGS */}
      {/* ---------------------------------------------------------------- */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Monthly KPI Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Sessions Conducted</span>
                <History className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="mt-2 text-2xl font-black text-slate-900">{monthlyMetrics.totalSessions}</div>
              <span className="text-[11px] text-slate-400 mt-1 block">In selected monthly filter</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Average Attendance</span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2 text-2xl font-black text-emerald-700">{monthlyMetrics.avgRate}%</div>
              <span className="text-[11px] text-slate-400 mt-1 block">Present student ratio</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Total Presences</span>
                <UserCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="mt-2 text-2xl font-black text-slate-900">{monthlyMetrics.totalPresent}</div>
              <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">Verified attendance marks</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-slate-500 text-xs font-semibold">
                <span>Total Absences</span>
                <UserX className="w-4 h-4 text-red-600" />
              </div>
              <div className="mt-2 text-2xl font-black text-red-600">{monthlyMetrics.totalAbsent}</div>
              <span className="text-[11px] text-red-500 font-semibold mt-1 block">Logged missed sessions</span>
            </div>
          </div>

          {/* Month & Class Filter Toolbar for Logs */}
          <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 flex-1">
              {/* Month Filter Dropdown */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Filter by Month</span>
                </label>
                <select
                  value={selectedMonthFilter}
                  onChange={(e) => setSelectedMonthFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer"
                >
                  <option value="all">All Academic Months</option>
                  {availableMonths.map((m, idx) => (
                    <option key={`m-${m}-${idx}`} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              {/* Class Filter Dropdown */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Filter by Class</span>
                </label>
                <select
                  value={selectedClassLogFilter}
                  onChange={(e) => setSelectedClassLogFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer"
                >
                  <option value="all">All Assigned Classes</option>
                  {uniqueClasses.map((c, idx) => (
                    <option key={`log-cls-${c.id}-${idx}`} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Log Records */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                  <Search className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Search Logs</span>
                </label>
                <input
                  type="text"
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  placeholder="Search subject, date, class..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 justify-end self-end md:self-auto">
              <button
                type="button"
                onClick={() => dispatch(fetchSubmittedLogsThunk())}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Refresh logs from server"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Logs</span>
              </button>
            </div>
          </div>

          {/* Historical Records Table */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-900">Attendance Log Register</span>
              </div>
              <span className="text-xs text-slate-500 font-semibold">
                Showing {filteredLogs.length} recorded session{filteredLogs.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/70 text-slate-600 uppercase tracking-wider font-bold border-b border-slate-200 h-10 select-none">
                    <th className="px-4 py-2 w-12 text-center">#</th>
                    <th className="px-4 py-2 min-w-[140px]">Date &amp; Time</th>
                    <th className="px-4 py-2 min-w-[130px]">Class</th>
                    <th className="px-4 py-2 min-w-[130px]">Subject</th>
                    <th className="px-4 py-2 text-center w-20">Enrolled</th>
                    <th className="px-4 py-2 text-center w-24">Present</th>
                    <th className="px-4 py-2 text-center w-24">Absent</th>
                    <th className="px-4 py-2 text-center w-32">Attendance %</th>
                    <th className="px-4 py-2 text-center w-28">Status</th>
                    <th className="px-4 py-2 text-right min-w-[130px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-12 text-slate-400">
                        <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="font-bold text-slate-700 text-xs">No attendance records found</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Try adjusting your month or class filter.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log, idx) => {
                      const pct =
                        log.totalStudents > 0
                          ? Math.round((log.presentCount / log.totalStudents) * 100)
                          : 100;

                      return (
                        <tr key={`sub-log-${log.id}-${idx}`} className="hover:bg-slate-50/80 h-12 transition-colors">
                          <td className="px-4 py-2 text-center text-slate-400 font-mono font-semibold">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-2 font-mono font-semibold text-slate-700">
                            {log.submittedAt || log.date || 'Recent'}
                          </td>
                          <td className="px-4 py-2 font-bold text-slate-900">
                            {log.className}
                          </td>
                          <td className="px-4 py-2 font-semibold text-indigo-700">
                            {log.subject || 'General'}
                          </td>
                          <td className="px-4 py-2 text-center font-bold text-slate-700">
                            {log.totalStudents || log.presentCount + log.absentCount}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                              <Check className="w-3 h-3" /> {log.presentCount}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800">
                              <X className="w-3 h-3" /> {log.absentCount}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <span className="font-extrabold text-slate-900">{pct}%</span>
                              <div className="w-12 h-2 rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className={`h-full ${pct >= 85 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500'}`}
                                  style={{ width: `${pct}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                log.isLocked
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {log.isLocked ? '✓ Finalized' : '✎ Draft'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setInspectingLog(log)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-colors cursor-pointer"
                                title="View detailed session information"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => dispatch(openCorrectionDrawer(log.id))}
                                className="text-slate-500 hover:text-indigo-600 text-[11px] font-bold transition-colors"
                              >
                                Correction
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* VIEW SESSION DETAILS MODAL */}
      {/* ---------------------------------------------------------------- */}
      {inspectingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-base text-slate-900">Attendance Session Record</h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectingLog(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Class &amp; Section</span>
                  <span className="font-extrabold text-slate-900 text-sm mt-0.5 block">{inspectingLog.className}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Subject</span>
                  <span className="font-extrabold text-indigo-700 text-sm mt-0.5 block">{inspectingLog.subject || 'Standard'}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Recorded Date &amp; Time</span>
                  <span className="font-mono font-bold text-slate-800 text-xs mt-0.5 block">
                    {inspectingLog.submittedAt || inspectingLog.date}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Record State</span>
                  <span className="font-bold text-emerald-700 text-xs mt-0.5 block">
                    {inspectingLog.isLocked ? '✓ Finalized & Locked' : '✎ Draft Session'}
                  </span>
                </div>
              </div>

              {/* Counts Grid */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <span className="text-xl font-black text-emerald-800 block">{inspectingLog.presentCount}</span>
                  <span className="text-[10px] font-bold uppercase text-emerald-700">Present</span>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <span className="text-xl font-black text-red-800 block">{inspectingLog.absentCount}</span>
                  <span className="text-[10px] font-bold uppercase text-red-700">Absent</span>
                </div>
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
                  <span className="text-xl font-black text-indigo-800 block">
                    {inspectingLog.totalStudents > 0
                      ? Math.round((inspectingLog.presentCount / inspectingLog.totalStudents) * 100)
                      : 100}
                    %
                  </span>
                  <span className="text-[10px] font-bold uppercase text-indigo-700">Attendance Rate</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setInspectingLog(null)}
                className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors cursor-pointer"
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
