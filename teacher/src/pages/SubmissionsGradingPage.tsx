import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  fetchTasksThunk,
  fetchTaskRosterThunk,
  recordMarksThunk,
  returnSubmissionThunk,
  setSelectedTaskId,
  RosterEntry,
} from '../store/slices/tasksSlice';
import { addToast, setCurrentTab } from '../store/slices/uiSlice';
import { openProtectedFile } from '../services/api';
import { Pagination } from '../components/common/Pagination';
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
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Layers,
  Sparkles,
  ArrowRight,
  FileCheck,
  Check,
  Filter
} from 'lucide-react';

const QUICK_FEEDBACK_PILLS = [
  '🌟 Outstanding work, clear methodology & neat handwriting!',
  '👍 Good effort! Review calculations in question 2.',
  '⚠️ Incomplete solution. Please show detailed intermediate steps.',
  '✍️ Please pay attention to units and scientific notation.',
  '💡 Great concept understanding; work on time management.',
  '❌ Key definitions are missing; please revise lecture notes.',
];

function getLetterGrade(percentage: number): { grade: string; color: string; bg: string } {
  if (percentage >= 90) return { grade: 'A*', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' };
  if (percentage >= 80) return { grade: 'A', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' };
  if (percentage >= 70) return { grade: 'B', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' };
  if (percentage >= 60) return { grade: 'C', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' };
  if (percentage >= 50) return { grade: 'D', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' };
  if (percentage >= 40) return { grade: 'E', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' };
  return { grade: 'U', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' };
}

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

  // Dedicated Paper Checking Workspace Mode
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [currentStudentIndex, setCurrentStudentIndex] = useState<number>(0);
  const [workspaceFilterOnlyUngraded, setWorkspaceFilterOnlyUngraded] = useState(false);

  // Workspace Evaluation Form State
  const [markInput, setMarkInput] = useState<string>('');
  const [feedbackInput, setFeedbackInput] = useState<string>('');
  const [markError, setMarkError] = useState<string | null>(null);
  const [isSavingMark, setIsSavingMark] = useState(false);
  const [filePreviewBlobUrl, setFilePreviewBlobUrl] = useState<string | null>(null);
  const [filePreviewLoading, setFilePreviewLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedClassId, selectedTaskId, searchFilter, statusFilter]);

  // Filtered Roster list for Overview Table
  const filteredRoster = useMemo(() => {
    return taskRoster.filter((student) => {
      const q = searchFilter.toLowerCase().trim();
      const matchesSearch =
        !q ||
        student.studentName.toLowerCase().includes(q) ||
        (student.rollNo && student.rollNo.toLowerCase().includes(q)) ||
        (student.admissionNo && student.admissionNo.toLowerCase().includes(q));

      if (!matchesSearch) return false;

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

  const totalPages = Math.ceil(filteredRoster.length / pageSize) || 1;
  const paginatedRoster = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRoster.slice(start, start + pageSize);
  }, [filteredRoster, currentPage, pageSize]);

  // Active Workspace Roster (can filter only ungraded if toggled)
  const workspaceRoster = useMemo(() => {
    if (!workspaceFilterOnlyUngraded) return taskRoster;
    return taskRoster.filter((s) => s.marksAwarded == null && s.status !== 'GRADED');
  }, [taskRoster, workspaceFilterOnlyUngraded]);

  // Current Student in Workspace
  const activeStudent: RosterEntry | null = useMemo(() => {
    if (!workspaceRoster || workspaceRoster.length === 0) return null;
    return workspaceRoster[currentStudentIndex] || workspaceRoster[0] || null;
  }, [workspaceRoster, currentStudentIndex]);

  // Sync evaluation fields whenever activeStudent changes in workspace
  useEffect(() => {
    if (activeStudent) {
      setMarkInput(activeStudent.marksAwarded != null ? String(activeStudent.marksAwarded) : '');
      setFeedbackInput(activeStudent.feedback || '');
      setMarkError(null);
    }
  }, [activeStudent]);

  // Load in-page blob preview when student fileUrl changes
  useEffect(() => {
    let active = true;
    if (!activeStudent?.fileUrl) {
      setFilePreviewBlobUrl(null);
      setFilePreviewLoading(false);
      return;
    }

    setFilePreviewLoading(true);
    fetch(activeStudent.fileUrl, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error('File fetch failed');
        return res.blob();
      })
      .then((blob) => {
        if (active) {
          const url = URL.createObjectURL(blob);
          setFilePreviewBlobUrl(url);
          setFilePreviewLoading(false);
        }
      })
      .catch(() => {
        if (active) {
          setFilePreviewBlobUrl(null);
          setFilePreviewLoading(false);
        }
      });

    return () => {
      active = false;
      if (filePreviewBlobUrl) {
        URL.revokeObjectURL(filePreviewBlobUrl);
      }
    };
  }, [activeStudent?.fileUrl]);

  // Counts
  const totalStudents = taskRoster.length;
  const gradedCount = taskRoster.filter((s) => s.status === 'GRADED' || s.marksAwarded != null).length;
  const submittedCount = taskRoster.filter(
    (s) => s.status === 'SUBMITTED' || s.status === 'PENDING' || s.status === 'LATE' || s.hasFile || s.status === 'GRADED'
  ).length;
  const pendingGradingCount = submittedCount - gradedCount > 0 ? submittedCount - gradedCount : 0;

  // Open Workspace for a specific student or start from first
  const handleOpenWorkspace = (student?: RosterEntry) => {
    if (!currentTask || taskRoster.length === 0) {
      dispatch(addToast({ message: 'No students enrolled in this task.', type: 'info' }));
      return;
    }
    if (student) {
      const idx = taskRoster.findIndex((s) => s.studentId === student.studentId);
      setCurrentStudentIndex(idx >= 0 ? idx : 0);
    } else {
      // Find first ungraded student
      const firstUngraded = taskRoster.findIndex((s) => s.marksAwarded == null && (s.hasFile || s.status === 'SUBMITTED'));
      setCurrentStudentIndex(firstUngraded >= 0 ? firstUngraded : 0);
    }
    setIsWorkspaceOpen(true);
  };

  const handleCloseWorkspace = () => {
    setIsWorkspaceOpen(false);
  };

  // Previous & Next navigation in workspace
  const handlePrevStudent = () => {
    if (currentStudentIndex > 0) {
      setCurrentStudentIndex((prev) => prev - 1);
    }
  };

  const handleNextStudent = () => {
    if (currentStudentIndex < workspaceRoster.length - 1) {
      setCurrentStudentIndex((prev) => prev + 1);
    }
  };

  // Save Marks (either draft or publish, and optionally advance to next)
  const handleSaveEvaluation = async (publish: boolean, advanceToNext = false) => {
    if (!currentTask || !activeStudent) return;

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
          publish,
          entries: [
            {
              studentId: activeStudent.studentId,
              marksAwarded: numMarks,
              feedback: feedbackInput,
            },
          ],
        })
      ).unwrap();

      dispatch(
        addToast({
          message: `${publish ? 'Published' : 'Draft saved'}: ${activeStudent.studentName} scored ${numMarks}/${currentTask.totalMarks}.`,
          type: 'success',
        })
      );

      // Refresh roster
      await dispatch(fetchTaskRosterThunk(currentTask.id));
      dispatch(fetchTasksThunk());

      if (advanceToNext && currentStudentIndex < workspaceRoster.length - 1) {
        setCurrentStudentIndex((prev) => prev + 1);
      }
    } catch (err: any) {
      setMarkError(err || 'Failed to save marks');
      dispatch(addToast({ message: err || 'Failed to save marks', type: 'error' }));
    } finally {
      setIsSavingMark(false);
    }
  };

  // Request revision
  const handleRequestRevision = async () => {
    if (!activeStudent?.submissionId) {
      dispatch(addToast({ message: 'No active student submission record to return.', type: 'error' }));
      return;
    }
    if (!feedbackInput.trim()) {
      setMarkError('Please write feedback notes explaining what the student needs to revise.');
      return;
    }

    setIsSavingMark(true);
    try {
      await dispatch(
        returnSubmissionThunk({
          submissionId: activeStudent.submissionId,
          note: feedbackInput,
        })
      ).unwrap();

      dispatch(
        addToast({
          message: `Returned to ${activeStudent.studentName} for revision.`,
          type: 'info',
        })
      );
      if (currentTask) {
        await dispatch(fetchTaskRosterThunk(currentTask.id));
      }
      if (currentStudentIndex < workspaceRoster.length - 1) {
        setCurrentStudentIndex((prev) => prev + 1);
      }
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

  // Direct download
  const handleDownloadSubmission = async (fileUrl: string, fileName?: string) => {
    try {
      await openProtectedFile(fileUrl, fileName, true);
    } catch (err: any) {
      dispatch(addToast({ message: err.message || 'Unable to download submission file.', type: 'error' }));
    }
  };

  // Preview in new browser tab
  const handlePreviewInNewTab = async (fileUrl: string, fileName?: string) => {
    try {
      await openProtectedFile(fileUrl, fileName, false);
    } catch (err: any) {
      dispatch(addToast({ message: err.message || 'Unable to open preview.', type: 'error' }));
    }
  };

  // Quick percentage calculators
  const currentMarksNum = parseFloat(markInput);
  const currentPercentage =
    currentTask && !isNaN(currentMarksNum) && currentTask.totalMarks > 0
      ? Math.round((currentMarksNum / currentTask.totalMarks) * 100)
      : null;
  const gradeInfo = currentPercentage !== null ? getLetterGrade(currentPercentage) : null;

  const setPresetScore = (ratio: number) => {
    if (!currentTask) return;
    const pts = Math.round(currentTask.totalMarks * ratio * 10) / 10;
    setMarkInput(String(pts));
    setMarkError(null);
  };

  const addFeedbackSnippet = (snippet: string) => {
    setFeedbackInput((prev) => (prev ? `${prev}\n${snippet}` : snippet));
  };

  // Detect file type
  const isPdf = activeStudent?.fileName?.toLowerCase().endsWith('.pdf') || activeStudent?.fileUrl?.toLowerCase().includes('.pdf');
  const isImage =
    activeStudent?.fileName?.match(/\.(png|jpe?g|webp|gif)$/i) ||
    activeStudent?.fileUrl?.match(/\.(png|jpe?g|webp|gif)/i);

  // Keyboard navigation shortcuts inside workspace
  useEffect(() => {
    if (!isWorkspaceOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger arrows if focus is inside an input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) {
        return;
      }
      if (e.key === 'ArrowLeft') {
        handlePrevStudent();
      } else if (e.key === 'ArrowRight') {
        handleNextStudent();
      } else if (e.key === 'Escape') {
        handleCloseWorkspace();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isWorkspaceOpen, currentStudentIndex, workspaceRoster.length]);

  return (
    <div className="flex flex-col w-full pb-12 space-y-5 animate-in fade-in duration-150">
      {/* ============================================================= */}
      {/* WORKSPACE MODE (FULL DEDICATED PAPER EVALUATION SPLIT-VIEW)    */}
      {/* ============================================================= */}
      {isWorkspaceOpen && currentTask && activeStudent ? (
        <div className="flex flex-col space-y-4 animate-in fade-in duration-150">
          {/* Workspace Sticky Top Bar */}
          <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 sticky top-2 z-30">
            {/* Left: Exit & Task Metadata */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCloseWorkspace}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer shrink-0"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Submissions List</span>
              </button>

              <div className="border-l border-slate-200 pl-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-extrabold uppercase border border-indigo-100">
                    {currentTask.className}
                  </span>
                  <span className="text-xs font-bold text-slate-700">{currentTask.subject}</span>
                </div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 truncate max-w-md">
                  {currentTask.title}
                </h2>
              </div>
            </div>

            {/* Right: Sequential Student Switcher */}
            <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
              {/* Only Ungraded Toggle */}
              <button
                type="button"
                onClick={() => {
                  setWorkspaceFilterOnlyUngraded(!workspaceFilterOnlyUngraded);
                  setCurrentStudentIndex(0);
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                  workspaceFilterOnlyUngraded
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
                title="Filter only students awaiting grading"
              >
                <Filter className="w-3.5 h-3.5" />
                <span>{workspaceFilterOnlyUngraded ? 'Showing Ungraded Only' : 'Show All Students'}</span>
              </button>

              {/* Prev Button */}
              <button
                type="button"
                onClick={handlePrevStudent}
                disabled={currentStudentIndex === 0}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Previous Student (Left Arrow)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {/* Student Dropdown / Indicator */}
              <select
                value={currentStudentIndex}
                onChange={(e) => setCurrentStudentIndex(Number(e.target.value))}
                className="bg-slate-50 hover:bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer max-w-[200px] truncate"
              >
                {workspaceRoster.map((s, idx) => (
                  <option key={s.studentId} value={idx}>
                    {idx + 1}. {s.studentName} {s.marksAwarded != null ? `(${s.marksAwarded} pts)` : '— Pending'}
                  </option>
                ))}
              </select>

              {/* Next Button */}
              <button
                type="button"
                onClick={handleNextStudent}
                disabled={currentStudentIndex >= workspaceRoster.length - 1}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Next Student (Right Arrow)"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Workspace Split Body */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* ------------------------------------------------------------- */}
            {/* LEFT PANEL: PAPER & SUBMISSION PREVIEW (7 COLUMNS / ~60%)     */}
            {/* ------------------------------------------------------------- */}
            <div className="lg:col-span-7 flex flex-col space-y-4">
              {/* Paper Inspection Card */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                {/* File Header */}
                <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 stroke-[2.2]" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {activeStudent.fileName || 'Assignment Submission Work'}
                      </h4>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                        <span>
                          {activeStudent.submittedAt
                            ? new Date(activeStudent.submittedAt).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'No submission time'}
                        </span>
                        {activeStudent.isLate ? (
                          <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase">
                            Late Submission
                          </span>
                        ) : activeStudent.submittedAt ? (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase">
                            On Time
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {activeStudent.fileUrl && (
                      <>
                        <button
                          type="button"
                          onClick={() => handlePreviewInNewTab(activeStudent.fileUrl!, activeStudent.fileName || 'submission')}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
                          title="Open document in a dedicated full tab"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Open New Tab</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleDownloadSubmission(
                              activeStudent.fileUrl!,
                              activeStudent.fileName || `${activeStudent.studentName.replace(/\s+/g, '_')}_work`
                            )
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                          title="Download original submitted file"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Download</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Embedded Viewer Body */}
                <div className="p-4 bg-slate-900/5 min-h-[500px] flex flex-col justify-center items-center">
                  {filePreviewLoading ? (
                    <div className="flex flex-col items-center justify-center p-12 text-slate-400 space-y-2">
                      <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs font-bold text-slate-600">Loading student paper preview...</span>
                    </div>
                  ) : activeStudent.fileUrl ? (
                    isPdf ? (
                      <div className="w-full h-[620px] rounded-xl overflow-hidden border border-slate-300 bg-white shadow-inner">
                        <iframe
                          src={filePreviewBlobUrl || activeStudent.fileUrl}
                          title="Student Assignment Submission PDF"
                          className="w-full h-full border-none"
                        />
                      </div>
                    ) : isImage ? (
                      <div className="w-full max-h-[620px] overflow-auto rounded-xl p-2 bg-slate-900/40 flex justify-center items-center">
                        <img
                          src={filePreviewBlobUrl || activeStudent.fileUrl}
                          alt="Student Submission"
                          className="max-w-full max-h-[580px] object-contain rounded-lg shadow-lg"
                        />
                      </div>
                    ) : (
                      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 max-w-sm space-y-3">
                        <FileText className="w-12 h-12 text-indigo-600 mx-auto" />
                        <div>
                          <h5 className="font-bold text-sm text-slate-900">{activeStudent.fileName || 'Attached File'}</h5>
                          <p className="text-xs text-slate-500 mt-1">
                            This document format can be inspected using the download or external tab viewer.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDownloadSubmission(activeStudent.fileUrl!, activeStudent.fileName)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                          <span>Download &amp; Open Document</span>
                        </button>
                      </div>
                    )
                  ) : (
                    <div className="p-10 text-center space-y-2 max-w-md">
                      <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
                        <AlertCircle className="w-6 h-6 stroke-[2.2]" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">No Attached File Uploaded</h4>
                      <p className="text-xs text-slate-500">
                        {activeStudent.studentName} has not uploaded a digital document file for this task.
                        Check student notes below or grade offline paper submissions.
                      </p>
                    </div>
                  )}
                </div>

                {/* Student Written Notes / Text Answer */}
                {activeStudent.studentNotes && (
                  <div className="p-4 bg-amber-50/50 border-t border-amber-200/80 space-y-1.5">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                      <FileCheck className="w-3.5 h-3.5 text-amber-700" />
                      Student Submission Notes / Written Answers
                    </span>
                    <div className="p-3 rounded-xl bg-white border border-amber-200 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto font-mono">
                      {activeStudent.studentNotes}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* RIGHT PANEL: EVALUATION, MARKS ENTRY & FEEDBACK (5 COLUMNS)   */}
            {/* ------------------------------------------------------------- */}
            <div className="lg:col-span-5 flex flex-col space-y-4">
              {/* Student Identity Card */}
              <div className="bg-white rounded-2xl p-4.5 border border-slate-200/80 shadow-xs">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-black text-base flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
                      {activeStudent.studentName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                        {activeStudent.studentName}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold mt-0.5">
                        <span className="font-mono text-slate-700 font-bold">
                          Roll #{activeStudent.rollNo || activeStudent.studentId}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-slate-400">
                          {activeStudent.admissionNo || `ADM-${activeStudent.studentId}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400 block">
                      Sequence
                    </span>
                    <span className="text-xs font-black text-slate-800">
                      {currentStudentIndex + 1} / {workspaceRoster.length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Marks Entry & Grade Calculation Card */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                      <CheckCircle2 className="w-4 h-4 stroke-[2.2]" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                        Marks Assessment
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Total Possible: <strong>{currentTask.totalMarks} points</strong>
                      </p>
                    </div>
                  </div>

                  {/* Cambridge Grade Pill */}
                  {gradeInfo && (
                    <div className={`px-3 py-1 rounded-xl border text-xs font-black flex items-center gap-1.5 ${gradeInfo.bg} ${gradeInfo.color}`}>
                      <span>Grade: {gradeInfo.grade}</span>
                      <span className="text-[10px] font-extrabold">({currentPercentage}%)</span>
                    </div>
                  )}
                </div>

                {/* Marks Numeric Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">
                    Marks Awarded *
                  </label>
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
                      placeholder={`0 - ${currentTask.totalMarks}`}
                      className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-lg font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all font-mono"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      / {currentTask.totalMarks} pts
                    </span>
                  </div>

                  {/* Error Notification */}
                  {markError && (
                    <p className="text-xs text-rose-600 font-bold flex items-center gap-1 mt-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {markError}
                    </p>
                  )}
                </div>

                {/* Quick Preset Percentage Chips */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    Quick Score Presets
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: '100%', ratio: 1.0 },
                      { label: '90%', ratio: 0.9 },
                      { label: '80%', ratio: 0.8 },
                      { label: '75%', ratio: 0.75 },
                      { label: '60%', ratio: 0.6 },
                      { label: '50%', ratio: 0.5 },
                      { label: '0%', ratio: 0.0 },
                    ].map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setPresetScore(p.ratio)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 text-xs font-extrabold transition-all cursor-pointer font-mono"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Teacher Feedback & Remarks */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">
                      Teacher Feedback &amp; Annotations
                    </label>
                    <span className="text-[10px] text-slate-400 font-semibold">Visible to student</span>
                  </div>

                  <textarea
                    rows={4}
                    value={feedbackInput}
                    onChange={(e) => setFeedbackInput(e.target.value)}
                    placeholder="Provide constructive feedback, notes on mistakes, praise, or recommended reading..."
                    className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all font-medium leading-relaxed"
                  />

                  {/* One-Click Feedback Snippet Pills */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                      Insert Quick Feedback Snippet
                    </span>
                    <div className="flex flex-col gap-1 max-h-32 overflow-y-auto pr-1">
                      {QUICK_FEEDBACK_PILLS.map((pill, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => addFeedbackSnippet(pill)}
                          className="text-left px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200/70 transition-all cursor-pointer truncate"
                          title={pill}
                        >
                          {pill}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="pt-3 border-t border-slate-200 space-y-2">
                  {/* Primary Save & Advance Button */}
                  <button
                    type="button"
                    disabled={isSavingMark}
                    onClick={() => handleSaveEvaluation(true, true)}
                    className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-indigo-100 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
                  >
                    <Check className="w-4 h-4 stroke-[2.5]" />
                    <span>
                      {isSavingMark ? 'Saving...' : 'Save & Next Student ➔'}
                    </span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    {/* Save Draft */}
                    <button
                      type="button"
                      disabled={isSavingMark}
                      onClick={() => handleSaveEvaluation(false, false)}
                      className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 text-center"
                    >
                      Save Draft
                    </button>

                    {/* Publish Current */}
                    <button
                      type="button"
                      disabled={isSavingMark}
                      onClick={() => handleSaveEvaluation(true, false)}
                      className="py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 text-center"
                    >
                      Save &amp; Publish
                    </button>
                  </div>

                  {/* Return for Revision */}
                  {activeStudent.submissionId && (
                    <button
                      type="button"
                      disabled={isSavingMark}
                      onClick={handleRequestRevision}
                      className="w-full py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Return for Student Revision</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ============================================================= */
        /* STANDARD OVERVIEW VIEW (TABLE, SUMMARY & LAUNCH BUTTON)       */
        /* ============================================================= */
        <>
          {/* 1. HERO HEADER */}
          <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-[#36348e] text-white flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
                  <FileCheck className="w-6 h-6 stroke-[2.2]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                      Assessment Desk
                    </span>
                    <span className="text-[11px] font-extrabold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                      Paper Checking &amp; Marks Entry
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-[#1e1b4b] tracking-tight mt-1">
                    Student Submissions &amp; Paper Checking
                  </h1>
                  <p className="text-xs text-slate-500 font-medium">
                    Review uploaded assignment papers, verify answers in the split workspace, award marks and publish feedback.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {currentTask && (
                  <button
                    type="button"
                    onClick={() => handleOpenWorkspace()}
                    className="px-4.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md shadow-indigo-100 cursor-pointer active:scale-[0.98]"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Launch Paper Checking Workspace</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 2. CLASS & ASSIGNMENT SELECTORS */}
          <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Class Dropdown */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-indigo-600" />
                Assigned Class
              </label>
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer"
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
                Select Assignment to Evaluate
              </label>
              <select
                value={currentTask?.id || ''}
                onChange={(e) => dispatch(setSelectedTaskId(e.target.value))}
                disabled={classTasks.length === 0}
                className="w-full bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 cursor-pointer disabled:opacity-50"
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

          {/* 3. CONTEXT & METRICS CARD */}
          {currentTask ? (
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-extrabold border border-indigo-100">
                    {currentTask.className}
                  </span>
                  <span className="text-xs font-bold text-slate-600">{currentTask.subject}</span>
                </div>
                <h2 className="text-base sm:text-lg font-black text-slate-900">{currentTask.title}</h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    Due Date: <strong className="text-slate-700">{currentTask.deadline}</strong>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-slate-400" />
                    Total Marks: <strong className="text-slate-900">{currentTask.totalMarks} pts</strong>
                  </span>
                </div>
              </div>

              {/* Quick Metrics */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 text-center min-w-[85px]">
                  <span className="text-[10px] text-slate-400 uppercase font-extrabold block">Enrolled</span>
                  <span className="text-base font-black text-slate-900">{totalStudents}</span>
                </div>
                <div className="bg-blue-50 px-3.5 py-2 rounded-xl border border-blue-100 text-center min-w-[85px]">
                  <span className="text-[10px] text-blue-600 uppercase font-extrabold block">Submitted</span>
                  <span className="text-base font-black text-blue-700">{submittedCount}</span>
                </div>
                <div className="bg-emerald-50 px-3.5 py-2 rounded-xl border border-emerald-100 text-center min-w-[85px]">
                  <span className="text-[10px] text-emerald-600 uppercase font-extrabold block">Graded</span>
                  <span className="text-base font-black text-emerald-700">{gradedCount}</span>
                </div>
                <div className="bg-amber-50 px-3.5 py-2 rounded-xl border border-amber-100 text-center min-w-[85px]">
                  <span className="text-[10px] text-amber-700 uppercase font-extrabold block">Pending</span>
                  <span className="text-base font-black text-amber-800">{pendingGradingCount}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-10 border border-slate-200/80 text-center space-y-3">
              <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-900">No Assignment Selected</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Select an assignment from the dropdown above to evaluate student submissions, or create a new assignment in the Assignments section.
              </p>
              <button
                type="button"
                onClick={() => dispatch(setCurrentTab('tasks-assignments'))}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#36348e] hover:bg-[#2c2a75] text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-[0.98]"
              >
                <span>Go to Assignments</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* 4. SUBMISSIONS ROSTER TABLE & TOOLBAR */}
          {currentTask && (
            <div className="space-y-3">
              {/* Toolbar */}
              <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Search by student name or Roll #..."
                    className="w-full h-8 pl-8 pr-3 rounded-xl bg-slate-50 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none border border-slate-200 focus:ring-2 focus:ring-indigo-300"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Submissions ({totalStudents})</option>
                    <option value="submitted">Needs Checking ({pendingGradingCount})</option>
                    <option value="graded">Graded &amp; Marked ({gradedCount})</option>
                    <option value="not_submitted">Not Submitted</option>
                  </select>

                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                    title="Export Gradebook CSV"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200/70 h-11 select-none text-[11px]">
                        <th className="px-5 py-2 w-20 text-center">Roll #</th>
                        <th className="px-5 py-2 min-w-[200px]">Student Name</th>
                        <th className="px-5 py-2 min-w-[140px] text-center">Status</th>
                        <th className="px-5 py-2 min-w-[140px]">Turned In</th>
                        <th className="px-5 py-2 w-28 text-center">Marks</th>
                        <th className="px-5 py-2 min-w-[200px] text-right">Evaluation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRoster.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-12 text-center text-slate-400">
                            <FileText className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                            <p className="font-bold text-xs text-slate-700">No students match this filter.</p>
                          </td>
                        </tr>
                      ) : (
                        paginatedRoster.map((student) => {
                          const isGraded = student.status === 'GRADED' || student.marksAwarded != null;
                          const isResubmit = student.status === 'RESUBMIT_REQUESTED';
                          const isSubmitted =
                            !isGraded &&
                            !isResubmit &&
                            (student.status === 'SUBMITTED' ||
                              student.status === 'PENDING' ||
                              student.status === 'LATE' ||
                              student.hasFile);

                          return (
                            <tr key={student.studentId} className="hover:bg-slate-50/80 h-14 transition-colors">
                              {/* Roll # */}
                              <td className="px-5 py-2 text-center font-mono font-bold text-slate-600">
                                #{student.rollNo || student.studentId}
                              </td>

                              {/* Student Name */}
                              <td className="px-5 py-2">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0 ring-1 ring-slate-200">
                                    {student.studentName.charAt(0).toUpperCase()}
                                  </div>
                                  <div className="flex flex-col min-w-0">
                                    <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                                      {student.studentName}
                                    </span>
                                    <span className="text-[11px] font-mono text-slate-400">
                                      {student.admissionNo || `ADM-${student.studentId}`}
                                    </span>
                                  </div>
                                </div>
                              </td>

                              {/* Status */}
                              <td className="px-5 py-2 text-center">
                                {isGraded ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    Marked
                                  </span>
                                ) : isResubmit ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-purple-100 text-purple-800">
                                    <RotateCcw className="w-3 h-3 text-purple-600" />
                                    Revision Requested
                                  </span>
                                ) : isSubmitted ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-100 text-blue-800">
                                    <Clock className="w-3 h-3 text-blue-600" />
                                    {student.isLate ? 'Submitted Late' : 'Submitted'}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500">
                                    Not Submitted
                                  </span>
                                )}
                              </td>

                              {/* Submitted At */}
                              <td className="px-5 py-2 text-xs text-slate-600 font-medium">
                                {student.submittedAt ? (
                                  <div className="flex flex-col">
                                    <span className="font-bold text-slate-800">
                                      {new Date(student.submittedAt).toLocaleDateString([], {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                      })}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
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

                              {/* Marks */}
                              <td className="px-5 py-2 text-center">
                                {student.marksAwarded != null ? (
                                  <span className="font-extrabold text-sm text-emerald-700 font-mono">
                                    {student.marksAwarded}
                                    <span className="text-slate-400 font-normal text-xs"> / {currentTask.totalMarks}</span>
                                  </span>
                                ) : isSubmitted ? (
                                  <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                    Pending
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-mono text-xs">—</span>
                                )}
                              </td>

                              {/* Direct Launch to Student in Workspace */}
                              <td className="px-5 py-2 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {student.fileUrl && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDownloadSubmission(
                                          student.fileUrl!,
                                          student.fileName || `${student.studentName.replace(/\s+/g, '_')}_work`
                                        )
                                      }
                                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                                      title="Download submitted file"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleOpenWorkspace(student)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                      isGraded
                                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200'
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                                    }`}
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                    <span>{isGraded ? 'Edit Marks' : 'Check Paper'}</span>
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
                  <span className="font-bold text-slate-700">
                    Showing {paginatedRoster.length} of {filteredRoster.length} filtered ({totalStudents} enrolled)
                  </span>
                  <div className="flex items-center gap-4 text-[11px] font-bold">
                    <span className="text-emerald-700">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block mr-1"></span>
                      {gradedCount} Checked
                    </span>
                    <span className="text-amber-700">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block mr-1"></span>
                      {pendingGradingCount} Pending
                    </span>
                  </div>
                </div>
              </div>

              {/* Pagination Controls */}
              {filteredRoster.length > 0 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredRoster.length}
                  itemsPerPage={pageSize}
                  onPageChange={(page) => setCurrentPage(page)}
                  onItemsPerPageChange={(limit) => {
                    setPageSize(limit);
                    setCurrentPage(1);
                  }}
                  pageSizeOptions={[10, 25, 50]}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};
