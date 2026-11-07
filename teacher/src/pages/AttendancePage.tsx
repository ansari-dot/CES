import React, { useState, useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  markAllRemainingPresent,
  toggleRemarksExpanded,
  openSubmitModal,
  openCorrectionDrawer,
  fetchLessonRosterThunk,
  fetchClassRosterThunk,
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
  GraduationCap
} from 'lucide-react';

export const AttendancePage: React.FC = () => {
  const dispatch = useAppDispatch();
  const isLocked = useAppSelector((state) => state.attendance.isLocked);
  const remarksExpanded = useAppSelector((state) => state.attendance.remarksExpanded);
  const submittedLogs = useAppSelector((state) => state.attendance.submittedLogs);
  const teacher = useAppSelector((state) => state.auth.teacher);
  const lessons = useAppSelector((state) => state.timetable.lessons);
  const globalSelectedClassId = useAppSelector((state) => state.auth.selectedClassId);

  const [searchFilter, setSearchFilter] = useState('');

  // Extract unique classes assigned to this teacher
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
    return lessons.filter((l) => {
      const targetClass = uniqueClasses.find((c) => c.id === selectedClassId);
      return (
        String(l.classId) === String(selectedClassId) ||
        (targetClass && l.className?.includes(targetClass.name))
      );
    });
  }, [lessons, selectedClassId, uniqueClasses]);

  const [activeLessonId, setActiveLessonId] = useState<string | number>(() => {
    return classLessons[0]?.rawId || classLessons[0]?.id || 1;
  });

  // Re-sync active lesson when selected class changes
  useEffect(() => {
    if (classLessons.length > 0) {
      const realLesson = classLessons.find((l) => typeof l.id === 'string' && l.id.startsWith('LES-'));
      if (realLesson) {
        const targetId = realLesson.rawId || realLesson.id;
        setActiveLessonId(targetId);
        dispatch(fetchLessonRosterThunk(targetId));
      } else if (selectedClassId) {
        setActiveLessonId(`CLASS-${selectedClassId}`);
        dispatch(fetchClassRosterThunk(Number(selectedClassId)));
      }
    } else if (selectedClassId) {
      setActiveLessonId(`CLASS-${selectedClassId}`);
      dispatch(fetchClassRosterThunk(Number(selectedClassId)));
    }
  }, [selectedClassId, classLessons, dispatch]);

  const activeLesson = classLessons.find(
    (l) => l.rawId === activeLessonId || l.id === activeLessonId
  ) || classLessons[0];

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

  const handleSaveDraft = () => {
    dispatch(
      addToast({
        message: 'Attendance draft saved to local secure cache.',
        type: 'info',
      })
    );
  };

  const handleExportCSV = () => {
    const className = uniqueClasses.find((c) => c.id === selectedClassId)?.name || 'Class';
    dispatch(
      addToast({
        message: `Exporting ${className} roster CSV snapshot...`,
        type: 'info',
      })
    );
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
            Select an assigned class to view enrolled students and record session attendance.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveDraft}
            disabled={isLocked}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-slate-700 hover:bg-slate-50 text-xs font-semibold border border-slate-200 transition-all disabled:opacity-50 shadow-xs"
          >
            <Save className="w-3.5 h-3.5 text-slate-500" />
            <span>Save Draft</span>
          </button>
          <button
            onClick={() => dispatch(openSubmitModal())}
            disabled={isLocked}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-white shadow-xs text-xs font-bold transition-all ${
              isLocked
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isLocked ? 'Record Locked' : 'Submit Final'}</span>
          </button>
        </div>
      </div>

      {/* Class Switcher Toolbar */}
      <div className="bg-white rounded-2xl p-3.5 shadow-xs border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 mr-1">
            <GraduationCap className="w-4 h-4 text-indigo-600" />
            Classes:
          </span>
          {uniqueClasses.length === 0 ? (
            <span className="text-xs text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md font-semibold">
              Loading classes...
            </span>
          ) : (
            uniqueClasses.map((cls, idx) => {
              const isSelected = selectedClassId === cls.id;
              return (
                <button
                  key={`att-cls-${cls.id || ''}-${idx}`}
                  type="button"
                  onClick={() => handleSelectClass(cls.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>{cls.name}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                      isSelected ? 'bg-black/15 text-slate-950' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {cls.enrolledCount}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Session / Lesson dropdown for the selected class */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-semibold">Session:</span>
          {classLessons.length > 1 ? (
            <select
              value={activeLessonId}
              onChange={(e) => handleSelectLesson(e.target.value)}
              className="bg-slate-100 text-xs font-bold text-slate-900 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-hidden cursor-pointer"
            >
              {classLessons.map((l, idx) => (
                <option key={`att-les-${l.id}-${l.rawId || idx}`} value={l.rawId || l.id}>
                  {l.className} • {l.subject} ({l.startTime} – {l.endTime})
                </option>
              ))}
            </select>
          ) : classLessons.length === 1 ? (
            <span className="text-xs font-semibold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
              {activeLesson?.className} • {activeLesson?.subject} ({activeLesson?.startTime} – {activeLesson?.endTime})
            </span>
          ) : (
            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
              {uniqueClasses.find((c) => c.id === selectedClassId)?.name || 'Class'} • General Roster
            </span>
          )}
        </div>
      </div>

      {/* Attendance Stats Cards */}
      <AttendanceStats />

      {/* Roster Control Bar */}
      <div className="bg-white rounded-2xl p-3 shadow-xs border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Search student or Roll #..."
            className="w-full h-8 pl-8 pr-3 rounded-xl bg-slate-100 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden border border-slate-200"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={handleMarkAllPresent}
            disabled={isLocked}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold transition-colors disabled:opacity-50"
          >
            <CheckCheck className="w-4 h-4" />
            <span>Mark All Present</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            title="Export CSV"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => dispatch(toggleRemarksExpanded())}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
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

      {/* Student Roster Table */}
      <AttendanceRoster filterQuery={searchFilter} />

      {/* Historical Submissions Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
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
                    <td className="px-4 font-mono font-medium text-slate-700">{log.submittedAt}</td>
                    <td className="px-4 font-bold text-slate-900">{log.className}</td>
                    <td className="px-4 text-center text-emerald-700 font-bold">{log.presentCount}</td>
                    <td className="px-4 text-center text-red-600 font-bold">{log.absentCount}</td>
                    <td className="px-4 text-center font-bold text-slate-900">{log.turnoutPercentage}%</td>
                    <td className="px-4 text-right">
                      <button
                        onClick={() => dispatch(openCorrectionDrawer())}
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
