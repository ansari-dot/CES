import React, { useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchTasksThunk,
  fetchTaskRosterThunk,
  recordMarksThunk,
  returnSubmissionThunk,
  setSelectedTaskId,
  RosterEntry,
} from '../store/slices/tasksSlice';
import { addToast } from '../store/slices/uiSlice';
import { openProtectedFile } from '../services/api';
import { CreateTaskForm } from '../components/grading/CreateTaskForm';
import {
  GraduationCap,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  Plus,
  Search,
  X,
  Pencil,
  AlertCircle,
  HelpCircle,
  RotateCcw,
} from 'lucide-react';

export const SubmissionsGradingPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const tasks = useAppSelector((state) => state.tasks.tasks);
  const taskRoster = useAppSelector((state) => state.tasks.taskRoster);
  const selectedTaskId = useAppSelector((state) => state.tasks.selectedTaskId);
  const teacher = useAppSelector((state) => state.auth.teacher);
  const globalSelectedClassId = useAppSelector((state) => state.auth.selectedClassId);

  // Extract unique classes assigned to this logged-in teacher ONLY
  const uniqueClasses = useMemo(() => {
    const list = teacher?.assignedClasses || [];
    const map = new Map<string, { id: string; classId: number; name: string }>();
    for (const c of list) {
      const cid = String(c.classId || c.id);
      if (!map.has(cid)) {
        map.set(cid, {
          id: cid,
          classId: Number(c.classId || cid),
          name: c.className || c.name.split(' - ')[0] || `Class ${c.grade}`,
        });
      }
    }
    return Array.from(map.values());
  }, [teacher?.assignedClasses]);

  // Selected Class
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

  // Load teacher tasks on mount
  useEffect(() => {
    dispatch(fetchTasksThunk());
  }, [dispatch]);

  // Filter tasks for the selected class (assigned to this teacher)
  const classTasks = useMemo(() => {
    if (!selectedClassId) return tasks;
    return tasks.filter((t) => String(t.classId) === String(selectedClassId));
  }, [tasks, selectedClassId]);

  // Active Selected Task
  const currentTask = useMemo(() => {
    if (!classTasks || classTasks.length === 0) return null;
    return classTasks.find((t) => t.id === selectedTaskId) || classTasks[0];
  }, [classTasks, selectedTaskId]);

  // Sync selectedTaskId when class changes
  useEffect(() => {
    if (classTasks.length > 0) {
      if (!classTasks.some((t) => t.id === selectedTaskId)) {
        dispatch(setSelectedTaskId(classTasks[0].id));
      }
    }
  }, [classTasks, selectedTaskId, dispatch]);

  // Load task roster when currentTask changes
  useEffect(() => {
    if (currentTask?.id) {
      dispatch(fetchTaskRosterThunk(currentTask.id));
    }
  }, [currentTask?.id, dispatch]);

  // Filters & UI States
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'graded' | 'not_submitted'>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Modals state
  const [viewStudent, setViewStudent] = useState<RosterEntry | null>(null);
  const [markStudent, setMarkStudent] = useState<RosterEntry | null>(null);
  const [markInput, setMarkInput] = useState<string>('');
  const [feedbackInput, setFeedbackInput] = useState<string>('');
  const [markError, setMarkError] = useState<string | null>(null);
  const [isSavingMark, setIsSavingMark] = useState(false);

  // Filtered Roster list
  const filteredRoster = useMemo(() => {
    return taskRoster.filter((student) => {
      // Search text
      const q = searchFilter.toLowerCase().trim();
      const matchesSearch =
        !q ||
        student.studentName.toLowerCase().includes(q) ||
        (student.rollNo && student.rollNo.toLowerCase().includes(q)) ||
        (student.admissionNo && student.admissionNo.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      // Status filter
      if (statusFilter === 'all') return true;
      if (statusFilter === 'graded') {
        return student.status === 'GRADED' || student.marksAwarded != null;
      }
      if (statusFilter === 'submitted') {
        return (
          student.status === 'SUBMITTED' ||
          student.status === 'PENDING' ||
          student.status === 'LATE' ||
          student.hasFile
        );
      }
      if (statusFilter === 'not_submitted') {
        return (
          student.status === 'NOT_SUBMITTED' ||
          (!student.hasFile && student.status !== 'GRADED' && student.marksAwarded == null)
        );
      }
      return true;
    });
  }, [taskRoster, searchFilter, statusFilter]);

  // Counts
  const totalStudents = taskRoster.length;
  const gradedCount = taskRoster.filter((s) => s.status === 'GRADED' || s.marksAwarded != null).length;
  const submittedCount = taskRoster.filter(
    (s) => s.status === 'SUBMITTED' || s.status === 'PENDING' || s.status === 'LATE' || s.hasFile || s.status === 'GRADED'
  ).length;

  // Open Mark modal for a student
  const handleOpenMarkModal = (student: RosterEntry) => {
    setMarkStudent(student);
    setMarkInput(student.marksAwarded != null ? String(student.marksAwarded) : '');
    setFeedbackInput(student.feedback || '');
    setMarkError(null);
  };

  // Save Mark
  const handleSaveMark = async () => {
    if (!currentTask || !markStudent) return;

    const numMarks = parseFloat(markInput);
    if (isNaN(numMarks)) {
      setMarkError('Please enter a valid number for marks.');
      return;
    }
    if (numMarks < 0) {
      setMarkError('Marks cannot be negative.');
      return;
    }
    if (numMarks > currentTask.totalMarks) {
      setMarkError(`Marks cannot exceed maximum marks (${currentTask.totalMarks}).`);
      return;
    }

    setMarkError(null);
    setIsSavingMark(true);

    try {
      await dispatch(
        recordMarksThunk({
          taskId: currentTask.id,
          publish: true,
          entries: [
            {
              studentId: markStudent.studentId,
              marksAwarded: numMarks,
              feedback: feedbackInput,
            },
          ],
        })
      ).unwrap();

      dispatch(
        addToast({
          message: `Marks saved for ${markStudent.studentName} (${numMarks} / ${currentTask.totalMarks}).`,
          type: 'success',
        })
      );

      // Refresh roster
      dispatch(fetchTaskRosterThunk(currentTask.id));
      dispatch(fetchTasksThunk());
      setMarkStudent(null);
    } catch (err: any) {
      setMarkError(err || 'Failed to save marks');
      dispatch(addToast({ message: err || 'Failed to save marks', type: 'error' }));
    } finally {
      setIsSavingMark(false);
    }
  };

  // Request revision
  const handleRequestRevision = async () => {
    if (!markStudent?.submissionId) {
      dispatch(addToast({ message: 'No active student submission record to return.', type: 'error' }));
      return;
    }
    if (!feedbackInput.trim()) {
      setMarkError('Please add feedback notes explaining what the student needs to revise.');
      return;
    }

    setIsSavingMark(true);
    try {
      await dispatch(
        returnSubmissionThunk({
          submissionId: markStudent.submissionId,
          note: feedbackInput,
        })
      ).unwrap();

      dispatch(
        addToast({
          message: `Returned to ${markStudent.studentName} for revision.`,
          type: 'info',
        })
      );
      if (currentTask) {
        dispatch(fetchTaskRosterThunk(currentTask.id));
      }
      setMarkStudent(null);
    } catch (err: any) {
      setMarkError(err || 'Failed to request revision');
    } finally {
      setIsSavingMark(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (!currentTask || taskRoster.length === 0) {
      dispatch(addToast({ message: 'No records to export.', type: 'info' }));
      return;
    }
    const header = ['Roll No', 'Student Name', 'Admission No', 'Submission Status', 'Submitted At', 'Marks', 'Max Marks', 'Feedback'];
    const rows = taskRoster.map((s) => [
      s.rollNo || '',
      s.studentName,
      s.admissionNo,
      s.marksAwarded != null ? 'GRADED' : s.status,
      s.submittedAt || '',
      s.marksAwarded != null ? s.marksAwarded : '',
      currentTask.totalMarks,
      s.feedback || '',
    ]);
    const csvContent = [header, ...rows].map((e) => e.map((val) => `"${val}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gradebook_${currentTask.className}_${currentTask.title}.csv`.replace(/[^\w-]/g, '_');
    link.click();
    URL.revokeObjectURL(url);
    dispatch(addToast({ message: `Exported ${taskRoster.length} rows to CSV.`, type: 'success' }));
  };

  return (
    <div className="flex flex-col w-full pb-10 space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-indigo-700 font-bold">
              Teacher Assessment Portal
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
            <span className="text-xs text-slate-500">Evaluation &amp; Marking</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-0.5">
            Assignment Viewing &amp; Marking
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Select an assigned class and assignment to review student submissions, inspect work, and record marks.
          </p>
        </div>

        {/* Create Assignment Toggle Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCreateOpen(!isCreateOpen)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
              isCreateOpen
                ? 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {isCreateOpen ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{isCreateOpen ? 'Close Creation Form' : 'Create New Assignment'}</span>
          </button>
        </div>
      </div>

      {/* Optional Inline Assignment Creation Drawer */}
      {isCreateOpen && (
        <div className="bg-slate-50 p-4 rounded-xl border border-indigo-200 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-indigo-600" />
              New Assignment Formulation
            </h3>
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
          <CreateTaskForm />
        </div>
      )}

      {/* Step 1: Class Selection & Assignment Dropdown */}
      <div className="bg-white rounded-xl p-4 shadow-xs border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Class Dropdown */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4 text-indigo-600" />
            Class
          </label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer"
          >
            {uniqueClasses.length === 0 ? (
              <option value="">No Classes Assigned</option>
            ) : (
              uniqueClasses.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Assignment Dropdown */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            Assignment
          </label>
          <select
            value={currentTask?.id || ''}
            onChange={(e) => dispatch(setSelectedTaskId(e.target.value))}
            disabled={classTasks.length === 0}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer disabled:opacity-50"
          >
            {classTasks.length === 0 ? (
              <option value="">No assignments created for this class</option>
            ) : (
              classTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} • {t.subject} (Due: {t.deadline})
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Selected Assignment Context Card */}
      {currentTask ? (
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[11px] font-bold">
                {currentTask.className}
              </span>
              <span className="text-xs text-slate-500">•</span>
              <span className="text-xs font-semibold text-slate-700">{currentTask.subject}</span>
            </div>
            <h2 className="text-base font-bold text-slate-900">{currentTask.title}</h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Due: <strong className="text-slate-700">{currentTask.deadline}</strong>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                Max Marks: <strong className="text-slate-900">{currentTask.totalMarks}</strong>
              </span>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-white px-3 py-2 rounded-lg border border-slate-200 text-center min-w-[80px]">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Enrolled</span>
              <span className="text-sm font-extrabold text-slate-900">{totalStudents}</span>
            </div>
            <div className="bg-white px-3 py-2 rounded-lg border border-slate-200 text-center min-w-[80px]">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Submitted</span>
              <span className="text-sm font-extrabold text-indigo-600">{submittedCount}</span>
            </div>
            <div className="bg-white px-3 py-2 rounded-lg border border-slate-200 text-center min-w-[80px]">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Graded</span>
              <span className="text-sm font-extrabold text-emerald-600">{gradedCount}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl p-8 border border-slate-200 text-center space-y-2">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-900">No Assignment Available</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            There are currently no assignments created for this class. Click &quot;Create New Assignment&quot; to assign tasks.
          </p>
        </div>
      )}

      {/* Step 2: Student Submission List Toolbar */}
      {currentTask && (
        <>
          <div className="bg-white rounded-xl p-3 shadow-xs border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Search Input */}
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

            {/* Filter Tabs & Export */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none cursor-pointer"
              >
                <option value="all">All Submissions ({totalStudents})</option>
                <option value="submitted">Submitted / Pending</option>
                <option value="graded">Marked / Graded ({gradedCount})</option>
                <option value="not_submitted">Not Submitted</option>
              </select>

              <button
                type="button"
                onClick={handleExportCSV}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                title="Export Gradebook CSV"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Student Submissions Table (Matching Reference Screenshot Design) */}
          <div className="bg-white rounded-xl shadow-xs overflow-hidden border border-slate-200">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/90 h-11 text-slate-600 text-xs font-semibold select-none border-b border-slate-200">
                    <th className="px-4 py-2 w-16 text-center uppercase tracking-wider">Roll #</th>
                    <th className="px-4 py-2 min-w-[200px] uppercase tracking-wider">Student Name</th>
                    <th className="px-4 py-2 min-w-[140px] text-center uppercase tracking-wider">Submission Status</th>
                    <th className="px-4 py-2 min-w-[140px] uppercase tracking-wider">Submitted At</th>
                    <th className="px-4 py-2 w-28 text-center uppercase tracking-wider">Marks</th>
                    <th className="px-4 py-2 w-36 text-center uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs sm:text-sm text-slate-800">
                  {filteredRoster.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <span className="material-symbols-outlined text-3xl mb-1 text-slate-300 block">assignment</span>
                        <p className="font-medium text-xs text-slate-600">No students found matching this criteria.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredRoster.map((student) => {
                      const isGraded = student.status === 'GRADED' || student.marksAwarded != null;
                      const isResubmit = student.status === 'RESUBMIT_REQUESTED';
                      const isSubmitted =
                        !isGraded &&
                        !isResubmit &&
                        (student.status === 'SUBMITTED' ||
                          student.status === 'PENDING' ||
                          student.status === 'LATE' ||
                          student.hasFile);
                      const isNotSubmitted = !isGraded && !isResubmit && !isSubmitted;

                      return (
                        <tr key={student.studentId} className="odd:bg-slate-50/60 hover:bg-slate-100/60 transition-colors h-14">
                          {/* Roll # */}
                          <td className="px-4 py-2 text-center font-mono font-semibold text-slate-600">
                            #{student.rollNo || student.studentId}
                          </td>

                          {/* Student Name & Admission No */}
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0 ring-1 ring-slate-200">
                                {student.studentName.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-semibold text-xs sm:text-sm text-slate-900 truncate">
                                  {student.studentName}
                                </span>
                                <span className="text-[11px] font-mono text-slate-400">
                                  {student.admissionNo || `ADM-${student.studentId}`}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Submission Status */}
                          <td className="px-4 py-2 text-center">
                            {isGraded ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Marked
                              </span>
                            ) : isResubmit ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                                <RotateCcw className="w-3 h-3 text-purple-600" />
                                Revision Requested
                              </span>
                            ) : isSubmitted ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                                <Clock className="w-3 h-3 text-blue-600" />
                                {student.isLate ? 'Submitted Late' : 'Submitted'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
                                Not Submitted
                              </span>
                            )}
                          </td>

                          {/* Submitted At */}
                          <td className="px-4 py-2 text-xs text-slate-600">
                            {student.submittedAt ? (
                              <div className="flex flex-col">
                                <span className="font-medium text-slate-800">
                                  {new Date(student.submittedAt).toLocaleDateString([], {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric',
                                  })}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  {new Date(student.submittedAt).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400 font-mono">—</span>
                            )}
                          </td>

                          {/* Marks Awarded */}
                          <td className="px-4 py-2 text-center">
                            {student.marksAwarded != null ? (
                              <span className="font-extrabold text-sm text-emerald-700">
                                {student.marksAwarded}
                                <span className="text-slate-400 font-normal text-xs"> / {currentTask.totalMarks}</span>
                              </span>
                            ) : isSubmitted ? (
                              <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md">
                                Pending
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono text-xs">—</span>
                            )}
                          </td>

                          {/* Actions: VIEW & MARK */}
                          <td className="px-4 py-2 text-center">
                            <div className="inline-flex items-center gap-1.5">
                              {/* VIEW Action */}
                              <button
                                type="button"
                                disabled={isNotSubmitted && !student.hasFile && !student.studentNotes}
                                onClick={() => setViewStudent(student)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                title={isNotSubmitted ? 'No work submitted yet' : 'View submitted work'}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View</span>
                              </button>

                              {/* MARK Action */}
                              <button
                                type="button"
                                onClick={() => handleOpenMarkModal(student)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                  isGraded
                                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                }`}
                                title="Grade or edit marks"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>{isGraded ? 'Edit' : 'Mark'}</span>
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

            {/* Table Footer */}
            <div className="px-5 py-3 bg-slate-50 flex flex-col sm:flex-row items-center justify-between text-slate-600 gap-2 text-xs border-t border-slate-200">
              <span className="font-medium">
                Showing {filteredRoster.length} of {totalStudents} enrolled students
              </span>
              <div className="flex items-center gap-4 text-[11px] font-semibold">
                <span className="text-emerald-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block mr-1"></span>
                  {gradedCount} Marked
                </span>
                <span className="text-blue-700">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block mr-1"></span>
                  {submittedCount - gradedCount > 0 ? submittedCount - gradedCount : 0} Pending Marking
                </span>
                <span className="text-slate-500">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block mr-1"></span>
                  {totalStudents - submittedCount > 0 ? totalStudents - submittedCount : 0} Not Submitted
                </span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* VIEW SUBMISSION MODAL */}
      {viewStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  Submitted Work: {viewStudent.studentName}
                </h3>
                <p className="text-xs text-slate-500">
                  Roll #{viewStudent.rollNo} • {currentTask?.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setViewStudent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Submission Metadata */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <span>
                Turned in on:{' '}
                <strong className="text-slate-900">
                  {viewStudent.submittedAt
                    ? new Date(viewStudent.submittedAt).toLocaleString()
                    : 'Not timestamped'}
                </strong>
              </span>
              {viewStudent.isLate && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                  Late Submission
                </span>
              )}
            </div>

            {/* Attached File Section */}
            {viewStudent.fileUrl ? (
              <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 space-y-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Attached File Submission
                </span>
                <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-indigo-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-5 h-5 text-indigo-600 shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-bold text-slate-800 truncate">
                        {viewStudent.fileName || 'Student_Assignment_File'}
                      </span>
                      {viewStudent.fileSize && (
                        <span className="text-[10px] text-slate-400">
                          {(viewStudent.fileSize / 1024).toFixed(1)} KB
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openProtectedFile(viewStudent.fileUrl!, viewStudent.fileName || 'submission')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Open / Download</span>
                  </button>
                </div>
              </div>
            ) : null}

            {/* Student Written Text / Notes */}
            {viewStudent.studentNotes ? (
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Student Answer / Notes
                </span>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                  {viewStudent.studentNotes}
                </div>
              </div>
            ) : null}

            {!viewStudent.fileUrl && !viewStudent.studentNotes && (
              <div className="py-6 text-center text-slate-400 text-xs">
                <AlertCircle className="w-8 h-8 mx-auto text-slate-300 mb-1" />
                No file attachment or text notes were attached to this submission.
              </div>
            )}

            {/* Existing Marks if already graded */}
            {viewStudent.marksAwarded != null && (
              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-900">Current Assigned Grade:</span>
                <span className="font-extrabold text-sm text-emerald-800">
                  {viewStudent.marksAwarded} / {currentTask?.totalMarks}
                </span>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setViewStudent(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const s = viewStudent;
                  setViewStudent(null);
                  handleOpenMarkModal(s);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Open Marking Form</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MARK / GRADE SUBMISSION MODAL */}
      {markStudent && currentTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Pencil className="w-5 h-5 text-indigo-600" />
                  Evaluate &amp; Mark: {markStudent.studentName}
                </h3>
                <p className="text-xs text-slate-500">
                  Roll #{markStudent.rollNo} • {currentTask.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMarkStudent(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Access to submitted work */}
            {(markStudent.hasFile || markStudent.fileUrl || markStudent.studentNotes) && (
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">Student Submitted Work Available:</span>
                <button
                  type="button"
                  onClick={() => {
                    if (markStudent.fileUrl) {
                      openProtectedFile(markStudent.fileUrl, markStudent.fileName || 'submission');
                    } else {
                      setViewStudent(markStudent);
                    }
                  }}
                  className="text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Inspect Work</span>
                </button>
              </div>
            )}

            {/* Marks Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Obtained Marks *
                </label>
                <span className="text-xs font-semibold text-slate-500">
                  Maximum Marks: <strong className="text-slate-900">{currentTask.totalMarks}</strong>
                </span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max={currentTask.totalMarks}
                  value={markInput}
                  onChange={(e) => {
                    setMarkInput(e.target.value);
                    setMarkError(null);
                  }}
                  placeholder={`Enter marks between 0 and ${currentTask.totalMarks}`}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                  / {currentTask.totalMarks}
                </span>
              </div>
              {markError && (
                <p className="text-xs text-red-600 font-medium flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {markError}
                </p>
              )}
            </div>

            {/* Teacher Feedback / Remarks */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Teacher Feedback &amp; Constructive Remarks
              </label>
              <textarea
                rows={3}
                value={feedbackInput}
                onChange={(e) => setFeedbackInput(e.target.value)}
                placeholder="Add written constructive feedback, compliments, or improvement areas..."
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:bg-white"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setMarkStudent(null)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                {markStudent.submissionId && (
                  <button
                    type="button"
                    disabled={isSavingMark}
                    onClick={handleRequestRevision}
                    className="px-3 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1"
                    title="Ask student to revise work"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Return for Revision</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={isSavingMark}
                  onClick={handleSaveMark}
                  className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSavingMark ? 'Saving...' : 'Save Mark'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
