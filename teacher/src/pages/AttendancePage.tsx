import React, { useState, useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  setStudentStatus,
  setStudentRemark,
  markAllRemainingPresent,
  markAllAbsent,
  openCorrectionDrawer,
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
  Lock,
  Unlock,
  Download,
  Search,
  BookOpen,
  GraduationCap,
  Clock,
  HelpCircle,
  AlertCircle
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

  const handleToggleStudentPresence = (studentId: string, currentStatus: AttendanceStatus) => {
    if (isLocked) return;
    if (currentStatus === 'present') {
      dispatch(setStudentStatus({ studentId, status: 'absent' }));
    } else {
      dispatch(setStudentStatus({ studentId, status: 'present' }));
    }
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

  // Format date display (e.g. 07-11-2026)
  const formattedDateDmy = useMemo(() => {
    try {
      const parts = selectedDate.split('-');
      if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
    } catch (_) {}
    return selectedDate;
  }, [selectedDate]);

  // Current session stats
  const presentCount = roster.filter((r) => r.status === 'present').length;
  const absentCount = roster.filter((r) => r.status === 'absent').length;

  // History filtering
  const filteredHistoryLogs = useMemo(() => {
    if (!Array.isArray(submittedLogs)) return [];
    if (historyFilter === 'all') return submittedLogs;

    // Last 6 months filter (default)
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

  // Derive readable month for each history row
  const formatHistoryMonth = (log: any) => {
    const rawDate = log.submittedAt || log.date;
    if (rawDate && rawDate !== 'Today' && rawDate !== 'Recent') {
      try {
        const d = new Date(rawDate);
        if (!isNaN(d.getTime())) {
          return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(d);
        }
      } catch (_) {}
    }
    return 'November 2026';
  };

  return (
    <div className="flex flex-col w-full pb-12 space-y-5 bg-[#f6f7fb] min-h-screen p-4 sm:p-6 rounded-2xl">
      {/* ------------------------------------------------------------- */}
      {/* 1. HEADER BLOCK */}
      {/* ------------------------------------------------------------- */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#4f46e5] text-white flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
            <CalendarCheck className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1e1b4b] tracking-tight">Attendance</h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">Manage and view class attendance</p>
          </div>
        </div>

        {isLocked && (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-xs">
            <Lock className="w-3.5 h-3.5" />
            <span>Finalized</span>
          </span>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. HORIZONTAL FILTER CARD */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-200/80">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 items-end">
          {/* Class */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-800 tracking-wide">Class</label>
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
            <label className="text-xs font-bold text-slate-800 tracking-wide">Teacher</label>
            <div className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-700 flex items-center justify-between shadow-2xs">
              <span className="truncate">{teacher?.name || 'Faculty Member'}</span>
              <span className="text-[10px] text-indigo-700 font-extrabold uppercase bg-indigo-50 px-2 py-0.5 rounded-md">
                Assigned
              </span>
            </div>
          </div>

          {/* Subject */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-800 tracking-wide">Subject</label>
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

          {/* Date */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-slate-800 tracking-wide">Date</label>
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-white hover:bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer transition-colors shadow-2xs"
              />
            </div>
          </div>

          {/* Apply Filter Button */}
          <div>
            <button
              type="button"
              onClick={handleApplyFilter}
              className="w-full h-[42px] rounded-xl bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-sm shadow-indigo-100 cursor-pointer active:scale-[0.98]"
            >
              <Filter className="w-4 h-4 stroke-[2.5]" />
              <span>Apply Filter</span>
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. STUDENTS LIST SECTION (CARD) */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        {/* Strip Header */}
        <div className="p-4 sm:p-5 bg-white border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-[#4f46e5] flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <h2 className="text-sm sm:text-base font-extrabold text-[#1e1b4b]">
              Students List – {currentClassObj?.name || 'Class'} | Subject: {selectedSubject} | Date: {formattedDateDmy}
            </h2>
          </div>

          {/* Bulk Action Buttons */}
          <div className="flex items-center gap-2.5 self-end md:self-auto">
            <button
              type="button"
              onClick={handleMarkAllPresent}
              disabled={isLocked || roster.length === 0}
              className="px-3.5 py-2 rounded-xl bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
              <span>Mark All Present</span>
            </button>

            <button
              type="button"
              onClick={handleMarkAllAbsent}
              disabled={isLocked || roster.length === 0}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              <X className="w-3.5 h-3.5 text-red-500 stroke-[3]" />
              <span>Mark All Absent</span>
            </button>
          </div>
        </div>

        {/* Student List Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50/70 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200/70 h-11 select-none text-[11px]">
                <th className="px-5 py-2 w-14">#</th>
                <th className="px-5 py-2 min-w-[200px]">Student Name</th>
                <th className="px-5 py-2 w-32">Roll No</th>
                <th className="px-5 py-2 min-w-[180px]">Status</th>
                <th className="px-5 py-2 min-w-[160px] text-right">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roster.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-400">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-slate-700 text-xs">No students enrolled in this class roster</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Please choose an active class from the filter above.</p>
                  </td>
                </tr>
              ) : (
                roster.map((student, idx) => {
                  const isPresent = student.status === 'present';
                  const isAbsent = student.status === 'absent';

                  return (
                    <tr
                      key={student.studentId}
                      className="hover:bg-slate-50/80 h-14 transition-colors"
                    >
                      {/* # */}
                      <td className="px-5 py-2 font-mono font-semibold text-slate-400 text-xs">
                        {idx + 1}
                      </td>

                      {/* Student Name */}
                      <td className="px-5 py-2">
                        <div className="flex items-center gap-3">
                          <img
                            src={student.avatar}
                            alt={student.studentName}
                            className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-slate-200"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-slate-900 truncate">
                              {student.studentName}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400">
                              {student.admissionId}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Roll No */}
                      <td className="px-5 py-2 font-mono font-bold text-slate-700">
                        {student.rollNumber || `10${idx + 1}`}
                      </td>

                      {/* Status Checkbox */}
                      <td className="px-5 py-2">
                        <div className="flex items-center gap-3">
                          {/* Interactive Checkbox */}
                          <label
                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all cursor-pointer select-none ${
                              isPresent
                                ? 'bg-[#ede9fe]/60 border-[#c4b5fd] text-[#4f46e5]'
                                : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isPresent}
                              disabled={isLocked}
                              onChange={() => handleToggleStudentPresence(student.studentId, student.status)}
                              className="w-4 h-4 rounded text-[#4f46e5] focus:ring-indigo-400 border-slate-300 cursor-pointer accent-[#4f46e5]"
                            />
                            <span className={`text-xs font-extrabold ${isPresent ? 'text-[#4f46e5]' : 'text-slate-500'}`}>
                              {isPresent ? 'Present' : 'Absent'}
                            </span>
                          </label>

                          {/* Quick Secondary Status Selector for Late / Leave / Excused */}
                          <select
                            value={student.status}
                            disabled={isLocked}
                            onChange={(e) =>
                              dispatch(
                                setStudentStatus({
                                  studentId: student.studentId,
                                  status: e.target.value as AttendanceStatus,
                                })
                              )
                            }
                            className="text-[11px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none cursor-pointer"
                            title="Set fine-grained status (Late/Leave/Excused)"
                          >
                            <option value="present">Present</option>
                            <option value="absent">Absent</option>
                            <option value="late">Late (L)</option>
                            <option value="leave">Leave</option>
                            <option value="excused">Excused (E)</option>
                          </select>
                        </div>
                      </td>

                      {/* Notes / Remarks */}
                      <td className="px-5 py-2 text-right">
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
                          placeholder="Optional note..."
                          className="w-full max-w-[150px] text-xs text-slate-800 placeholder:text-slate-400 py-1 px-2.5 rounded-lg bg-slate-50 hover:bg-white focus:bg-white border border-transparent hover:border-slate-200 focus:border-indigo-400 focus:outline-none transition-all text-right"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Save Action Strip */}
        <div className="p-4 sm:p-5 bg-white border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-semibold flex items-center gap-2">
            <span>Enrolled: <strong>{roster.length}</strong></span>
            <span>•</span>
            <span className="text-emerald-700">Present: <strong>{presentCount}</strong></span>
            <span>•</span>
            <span className="text-red-600">Absent: <strong>{absentCount}</strong></span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => handleSaveAttendance(false)}
              disabled={isLocked || isSaving || roster.length === 0}
              className="px-5 py-2.5 rounded-xl bg-[#4f46e5] hover:bg-[#4338ca] text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md shadow-indigo-100 disabled:opacity-50 cursor-pointer active:scale-[0.98]"
            >
              <Save className="w-4 h-4 stroke-[2.5]" />
              <span>{isSaving ? 'Saving...' : 'Save Attendance'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. ATTENDANCE HISTORY SECTION (CARD) */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-white border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-[#4f46e5]" />
            <h2 className="text-sm sm:text-base font-extrabold text-[#1e1b4b]">Attendance History</h2>
          </div>

          {/* Month / Range Dropdown */}
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
              <tr className="bg-slate-50/70 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200/70 h-11 select-none text-[11px]">
                <th className="px-5 py-2 min-w-[140px]">Month</th>
                <th className="px-5 py-2 min-w-[100px]">Class</th>
                <th className="px-5 py-2 min-w-[130px]">Subject</th>
                <th className="px-5 py-2 text-center w-28">Total Students</th>
                <th className="px-5 py-2 text-center w-24">Present</th>
                <th className="px-5 py-2 text-center w-24">Absent</th>
                <th className="px-5 py-2 text-center w-32">Attendance %</th>
                <th className="px-5 py-2 text-right w-24">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHistoryLogs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    <History className="w-7 h-7 text-slate-300 mx-auto mb-1.5" />
                    <p className="font-bold text-slate-700 text-xs">No historical attendance records yet</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Records will automatically appear here once sessions are saved.</p>
                  </td>
                </tr>
              ) : (
                filteredHistoryLogs.map((log, idx) => {
                  const total = log.totalStudents || (log.presentCount + log.absentCount) || 1;
                  const pct = Math.round((log.presentCount / total) * 100);

                  return (
                    <tr
                      key={`hist-${log.id}-${idx}`}
                      className="hover:bg-slate-50/80 h-13 transition-colors"
                    >
                      {/* Month */}
                      <td className="px-5 py-2 font-bold text-slate-800">
                        {formatHistoryMonth(log)}
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
                      <td className="px-5 py-2 text-center font-bold text-slate-800">
                        {log.presentCount}
                      </td>

                      {/* Absent */}
                      <td className="px-5 py-2 text-center font-bold text-slate-800">
                        {log.absentCount}
                      </td>

                      {/* Attendance % */}
                      <td className="px-5 py-2 text-center">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-black ${
                            pct >= 90
                              ? 'bg-emerald-100 text-emerald-800'
                              : pct >= 75
                              ? 'bg-emerald-100/80 text-emerald-700'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {pct}%
                        </span>
                      </td>

                      {/* View Button */}
                      <td className="px-5 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setInspectingLog(log)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4f46e5] hover:text-[#4338ca] transition-colors cursor-pointer"
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
      {/* 5. VIEW SESSION DETAIL MODAL */}
      {/* ------------------------------------------------------------- */}
      {inspectingLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-[#4f46e5]" />
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
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Session Month / Date</span>
                  <span className="font-mono font-bold text-slate-800 text-xs mt-0.5 block">
                    {formatHistoryMonth(inspectingLog)} • {inspectingLog.submittedAt || inspectingLog.date}
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
                className="px-4 py-2 rounded-xl bg-[#4f46e5] hover:bg-[#4338ca] text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
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
