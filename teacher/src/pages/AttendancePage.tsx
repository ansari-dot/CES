import React, { useState, useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  markAllRemainingPresent,
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
  CheckCheck,
  Search,
  Download,
  MessageSquare,
  History,
  Lock,
  Unlock,
  GraduationCap,
  Clock,
  Calendar
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

  const [searchFilter, setSearchFilter] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load this teacher's previously submitted attendance records (persistent)
  useEffect(() => {
    dispatch(fetchSubmittedLogsThunk());
  }, [dispatch]);

  // Extract unique classes assigned to this logged-in teacher ONLY
  const uniqueClasses = useMemo(() => {
    const list = teacher?.assignedClasses || [];
    const map = new Map<string, { id: string; classId: number; name: string; enrolledCount: number; subject: string }>();
    for (const c of list) {
      const cid = String(c.classId || c.id);
      if (!map.has(cid)) {
        map.set(cid, {
          id: cid,
          classId: Number(c.classId || cid),
          name: c.className || c.name.split(' - ')[0] || `Class ${c.grade}`,
          enrolledCount: c.enrolledCount || 0,
          subject: c.subject || 'Subject'
        });
      }
    }
    return Array.from(map.values());
  }, [teacher?.assignedClasses]);

  // Selected class filter state
  const [selectedClassId, setSelectedClassId] = useState<string>(() => {
    if (globalSelectedClassId && globalSelectedClassId !== 'all') {
      return String(globalSelectedClassId);
    }
    return uniqueClasses[0]?.id || '1';
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

  const [activeLessonId, setActiveLessonId] = useState<string | number>(() => {
    return classLessons[0]?.rawId || classLessons[0]?.id || 1;
  });

  // Re-sync active lesson when selected class changes
  useEffect(() => {
    if (classLessons.length > 0) {
      const realLesson = classLessons[0];
      const targetId = realLesson.rawId || realLesson.id;
      setActiveLessonId(targetId);
      dispatch(fetchLessonRosterThunk(targetId));
    } else if (selectedClassId) {
      setActiveLessonId(`CLASS-${selectedClassId}`);
      dispatch(fetchClassRosterThunk(Number(selectedClassId)));
    }
  }, [selectedClassId, classLessons, dispatch]);

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
    const className = uniqueClasses.find((c) => c.id === selectedClassId)?.name || 'Class';
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
    link.download = `attendance_${className.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    dispatch(addToast({ message: `Exported ${roster.length} student records to CSV.`, type: 'success' }));
  };

  return (
    <div className="flex flex-col w-full pb-8 space-y-4">
      {/* Page Title Block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Student Attendance</h1>
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 ${
                isLocked ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
              }`}
            >
              {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              <span>{isLocked ? 'Locked' : 'Draft'}</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Select an assigned class and period to review enrolled students and record session attendance.
          </p>
        </div>

        {/* Top Quick Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSaveAttendance(false)}
            disabled={isLocked || isSaving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold border border-slate-200 transition-all disabled:opacity-50 shadow-xs"
          >
            <Save className="w-3.5 h-3.5 text-slate-500" />
            <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
          </button>
          <button
            type="button"
            onClick={() => handleSaveAttendance(true)}
            disabled={isLocked || isSaving}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-white shadow-xs text-xs font-bold transition-all ${
              isLocked
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isLocked ? 'Record Locked' : 'Finalize Attendance'}</span>
          </button>
        </div>
      </div>

      {/* Step 1: Class Selection & Lecture / Period Dropdowns */}
      <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Class Dropdown */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4 text-indigo-600" />
            Class
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => handleSelectClass(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            {uniqueClasses.length === 0 ? (
              <option value="">No Assigned Classes</option>
            ) : (
              uniqueClasses.map((cls, idx) => (
                <option key={`att-cls-${cls.id || ''}-${idx}`} value={cls.id}>
                  {cls.name} ({cls.enrolledCount} Enrolled Students)
                </option>
              ))
            )}
          </select>
        </div>

        {/* Lecture / Period Dropdown */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-indigo-600" />
            Lecture / Period
          </label>
          <select
            value={activeLessonId}
            onChange={(e) => handleSelectLesson(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          >
            {classLessons.length > 0 ? (
              classLessons.map((l, idx) => (
                <option key={`les-${l.id}-${l.rawId || idx}`} value={l.rawId || l.id}>
                  Period {l.periodNumber || (idx + 1)}: {l.startTime} – {l.endTime} • {l.subject} ({l.date})
                </option>
              ))
            ) : (
              <option value={`CLASS-${selectedClassId}`}>
                General Lecture Session • {new Date().toISOString().slice(0, 10)}
              </option>
            )}
          </select>
        </div>
      </div>

      {/* Selected Session Info Pill */}
      {activeLesson && (
        <div className="bg-slate-50 px-4 py-2.5 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-900">{activeLesson.className}</span>
            <span>•</span>
            <span className="text-indigo-700 font-semibold">{activeLesson.subject}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {activeLesson.date}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {activeLesson.startTime} – {activeLesson.endTime}
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            Topic: <span className="font-medium text-slate-700">{activeLesson.topic || 'Class Session'}</span>
          </div>
        </div>
      )}

      {/* Attendance Stats Cards */}
      <AttendanceStats />

      {/* Roster Search & Filter Bar */}
      <div className="bg-white rounded-xl p-3 shadow-xs border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search student or Roll #..."
            className="w-full h-8 pl-8 pr-3 rounded-lg bg-slate-50 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none border border-slate-200"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={handleMarkAllPresent}
            disabled={isLocked}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold transition-colors disabled:opacity-50"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Mark All Present</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => dispatch(toggleRemarksExpanded())}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              remarksExpanded
                ? 'bg-indigo-100 text-indigo-800'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Remarks</span>
          </button>
        </div>
      </div>

      {/* Step 2: Student Attendance Table */}
      <AttendanceRoster filterQuery={searchFilter} />

      {/* Step 3: Bottom Attendance Action Bar */}
      <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="text-xs text-slate-500 font-medium">
          {isLocked ? (
            <span className="text-emerald-700 font-bold flex items-center gap-1.5">
              <Lock className="w-4 h-4" /> Attendance is locked for this session. Use Correction Voucher to amend.
            </span>
          ) : (
            <span>All students default to Present. Toggle absent, leave, or excused as needed, then click Save or Finalize.</span>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => handleSaveAttendance(false)}
            disabled={isLocked || isSaving}
            className="px-4 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
          >
            <Save className="w-4 h-4 text-slate-500" />
            <span>{isSaving ? 'Saving...' : 'Save Attendance'}</span>
          </button>

          <button
            type="button"
            onClick={() => handleSaveAttendance(true)}
            disabled={isLocked || isSaving}
            className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isLocked ? 'Attendance Finalized' : 'Submit / Finalize Attendance'}</span>
          </button>
        </div>
      </div>

      {/* Historical Submissions Table */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <History className="w-4 h-4 text-indigo-600" />
            <span>Recent Submitted Records</span>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">Audit logs</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-50/50 text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-200 h-8">
                <th className="px-4">Session Date &amp; Time</th>
                <th className="px-4">Class</th>
                <th className="px-4 text-center">Present</th>
                <th className="px-4 text-center">Absent</th>
                <th className="px-4 text-center">Attendance %</th>
                <th className="px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {submittedLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-slate-400">
                    No submitted attendance records logged today yet.
                  </td>
                </tr>
              ) : (
                submittedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 h-10 transition-colors">
                    <td className="px-4 font-mono font-medium text-slate-700">{log.submittedAt || log.time}</td>
                    <td className="px-4 font-bold text-slate-900">{log.className}</td>
                    <td className="px-4 text-center text-emerald-700 font-bold">{log.presentCount}</td>
                    <td className="px-4 text-center text-red-600 font-bold">{log.absentCount}</td>
                    <td className="px-4 text-center font-bold text-slate-900">
                      {log.totalStudents > 0 ? Math.round((log.presentCount / log.totalStudents) * 100) : 100}%
                    </td>
                    <td className="px-4 text-right">
                      <button
                        type="button"
                        onClick={() => dispatch(openCorrectionDrawer(log.id))}
                        className="text-indigo-600 hover:text-indigo-800 text-[11px] font-bold"
                      >
                        Request Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals & Drawers */}
      <SubmitAttendanceModal />
      <CorrectionDrawer />
    </div>
  );
};
