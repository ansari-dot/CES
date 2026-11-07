import React, { useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { setCurrentSubTab, setSelectedTaskId, fetchSubmissionsThunk } from '../store/slices/tasksSlice';
import { addToast } from '../store/slices/uiSlice';
import { SubmissionQueue } from '../components/grading/SubmissionQueue';
import { GradingDetail } from '../components/grading/GradingDetail';
import { CreateTaskForm } from '../components/grading/CreateTaskForm';
import { QuickGradeModal } from '../components/grading/QuickGradeModal';

const csvField = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const SubmissionsGradingPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const currentSubTab = useAppSelector((state) => state.tasks.currentSubTab);
  const tasks = useAppSelector((state) => state.tasks.tasks);
  const submissions = useAppSelector((state) => state.tasks.submissions);
  const selectedTaskId = useAppSelector((state) => state.tasks.selectedTaskId);
  const teacher = useAppSelector((state) => state.auth.teacher);

  const [classFilter, setClassFilter] = useState('all');
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [quickGradeOpen, setQuickGradeOpen] = useState(false);

  const classOptions = useMemo(() => {
    const map = new Map<string, string>();
    teacher.assignedClasses.forEach((c) => map.set(String(c.classId || c.id), c.className || c.name.split(' - ')[0]));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [teacher.assignedClasses]);

  const subjectOptions = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.subject))).sort(),
    [tasks]
  );

  // Gradable assessments narrowed by the class and subject filters (drafts have no submissions)
  const filteredTasks = useMemo(
    () =>
      tasks.filter(
        (t) =>
          t.status !== 'draft' &&
          (classFilter === 'all' || t.classId === classFilter) &&
          (subjectFilter === 'all' || t.subject === subjectFilter)
      ),
    [tasks, classFilter, subjectFilter]
  );

  const currentTask = tasks.find((t) => t.id === selectedTaskId) || filteredTasks[0];

  // Keep the selected assessment within the active filters
  useEffect(() => {
    if (filteredTasks.length > 0 && !filteredTasks.some((t) => t.id === selectedTaskId)) {
      dispatch(setSelectedTaskId(filteredTasks[0].id));
    }
  }, [filteredTasks, selectedTaskId, dispatch]);

  // Load the submissions of the selected assessment
  useEffect(() => {
    if (selectedTaskId) dispatch(fetchSubmissionsThunk(selectedTaskId));
  }, [selectedTaskId, dispatch]);

  const pendingGradingCount = submissions.filter((s) => s.status === 'pending' || s.status === 'late').length;
  const gradedCount = submissions.filter((s) => s.status === 'graded').length;
  const missingCount = submissions.filter((s) => s.status === 'missing').length;
  const gradedSubs = submissions.filter((s) => s.status === 'graded' && s.marksAwarded != null && s.maxMarks > 0);
  const classAvg = gradedSubs.length > 0
    ? (gradedSubs.reduce((acc, s) => acc + (s.marksAwarded! / s.maxMarks) * 100, 0) / gradedSubs.length).toFixed(1) + '%'
    : '—';

  const handleExportGradeSheet = () => {
    if (!currentTask || submissions.length === 0) {
      dispatch(addToast({ message: 'There are no submissions to export for this assessment.', type: 'info' }));
      return;
    }
    const header = ['Admission No', 'Roll', 'Student', 'Assessment', 'Submitted', 'Status', 'Marks', 'Max Marks', 'Feedback'];
    const rows = submissions.map((s) => [
      s.studentAdmissionId,
      s.studentRoll,
      s.studentName,
      s.taskTitle,
      s.submittedAt,
      s.status === 'graded' ? 'Published' : s.marksAwarded !== undefined ? 'Draft grade' : s.status,
      s.marksAwarded ?? '',
      s.maxMarks,
      s.feedback || '',
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvField).join(',')).join('\r\n');
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gradebook_${currentTask.className}_${currentTask.title}`.replace(/[^\w-]+/g, '_') + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    dispatch(addToast({ message: `Exported ${rows.length} gradebook rows.`, type: 'success' }));
  };

  return (
    <div className="flex flex-col w-full pb-10">
      {/* Page Header & Key Metrics */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-[#36348e] font-bold">
              Assessment &amp; Evaluation
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
            <span className="text-xs text-[#777587]">Term 2 Academic Cycle</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#292929] tracking-tight">
            Tasks, Submissions &amp; Grading
          </h1>
          <p className="text-xs sm:text-sm text-[#545454] max-w-2xl">
            Manage homework, evaluate student work, assign marks, and provide written feedback with
            synchronized gradebook reporting.
          </p>
        </div>

        {/* Quick Status Tally Chips */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-xs border border-slate-100">
            <span className="w-2.5 h-2.5 rounded-full bg-[#006c49]"></span>
            <span className="text-xs text-[#777587]">Class Avg:</span>
            <span className="text-xs font-bold text-[#292929]">{classAvg}</span>
          </div>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-xs border border-slate-100">
            <span className="w-2.5 h-2.5 rounded-full bg-[#7a5b00]"></span>
            <span className="text-xs text-[#777587]">To Grade:</span>
            <span className="text-xs font-bold text-[#7a5b00]">{pendingGradingCount} papers</span>
          </div>
        </div>
      </div>

      {/* Top Navigation Sub-Tabs */}
      <div className="flex items-center justify-between bg-[#f1f1fa] p-1.5 rounded-2xl mb-6 overflow-x-auto shadow-xs border border-indigo-100">
        <div className="flex items-center gap-1 min-w-max">
          <button
            onClick={() => dispatch(setCurrentSubTab('active'))}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 ${
              currentSubTab === 'active'
                ? 'bg-[#ffc53a] text-[#1b1a47] shadow-xs'
                : 'text-[#545454] hover:text-[#292929] hover:bg-white/60'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">assignment_turned_in</span>
            Active Tasks ({tasks.length})
          </button>

          <button
            onClick={() => dispatch(setCurrentSubTab('pending_grading'))}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 ${
              currentSubTab === 'pending_grading'
                ? 'bg-[#ffc53a] text-[#1b1a47] shadow-xs'
                : 'text-[#545454] hover:text-[#292929] hover:bg-white/60'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">rate_review</span>
            Submissions Awaiting Grading ({pendingGradingCount})
          </button>

          <button
            onClick={() => dispatch(setCurrentSubTab('archive'))}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 ${
              currentSubTab === 'archive'
                ? 'bg-[#ffc53a] text-[#1b1a47] shadow-xs'
                : 'text-[#545454] hover:text-[#292929] hover:bg-white/60'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">inventory_2</span>
            Graded Archive ({gradedCount})
          </button>

          <button
            onClick={() => dispatch(setCurrentSubTab('create'))}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 ${
              currentSubTab === 'create'
                ? 'bg-[#ffc53a] text-[#1b1a47] shadow-xs'
                : 'text-[#545454] hover:text-[#292929] hover:bg-white/60'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            New Task Creation
          </button>
        </div>

        <div className="hidden lg:flex items-center gap-1.5 pr-3 text-xs text-[#777587]">
          <span className="material-symbols-outlined text-[16px] text-[#006c49]">cloud_done</span>
          Saved to gradebook on submit
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-100 mb-6 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
          {/* Class Filter */}
          <div className="flex items-center gap-2 bg-[#f1f1fa] px-3 py-2 rounded-lg border border-indigo-100/60">
            <span className="material-symbols-outlined text-[18px] text-[#777587]">groups</span>
            <div className="flex flex-col flex-1 min-w-0">
              <label className="text-[10px] uppercase text-[#777587] font-bold leading-none">
                Class
              </label>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-[#292929] focus:outline-none cursor-pointer truncate"
              >
                <option value="all">All Assigned Classes</option>
                {classOptions.map((c, idx) => (
                  <option key={`sub-grade-cls-${c.id}-${idx}`} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Subject Filter */}
          <div className="flex items-center gap-2 bg-[#f1f1fa] px-3 py-2 rounded-lg border border-indigo-100/60">
            <span className="material-symbols-outlined text-[18px] text-[#777587]">auto_stories</span>
            <div className="flex flex-col flex-1 min-w-0">
              <label className="text-[10px] uppercase text-[#777587] font-bold leading-none">
                Subject
              </label>
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-[#292929] focus:outline-none cursor-pointer truncate"
              >
                <option value="all">All Subjects</option>
                {subjectOptions.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 bg-[#f1f1fa] px-3 py-2 rounded-lg border border-indigo-100/60">
            <span className="material-symbols-outlined text-[18px] text-[#777587]">tune</span>
            <div className="flex flex-col flex-1 min-w-0">
              <label className="text-[10px] uppercase text-[#777587] font-bold leading-none">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-[#292929] focus:outline-none cursor-pointer truncate"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending Review ({pendingGradingCount})</option>
                <option value="graded">Graded ({gradedCount})</option>
                <option value="overdue">Missing / Overdue ({missingCount})</option>
              </select>
            </div>
          </div>
        </div>

        {/* Student / Search Bar */}
        <div className="flex items-center gap-3">
          <div className="relative w-full lg:w-72">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-[#777587]">
              search
            </span>
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search student, roll #, or title..."
              className="w-full bg-[#f1f1fa] pl-9 pr-3 py-2 rounded-lg text-xs sm:text-sm text-[#292929] placeholder:text-[#777587] focus:outline-none focus:ring-2 focus:ring-indigo-200 border border-indigo-100/60"
            />
          </div>
          <button
            onClick={handleExportGradeSheet}
            className="p-2 bg-[#f1f1fa] hover:bg-[#ffedc2] rounded-lg text-[#545454] transition-colors border border-indigo-100"
            title="Export Grade Sheet"
          >
            <span className="material-symbols-outlined text-[20px]">ios_share</span>
          </button>
        </div>
      </div>

      {/* If currentSubTab is 'create', show the create form on top */}
      {currentSubTab === 'create' ? (
        <CreateTaskForm />
      ) : (
        /* MAIN SPLIT VIEW (SRS Section 8 & 9: Submissions Review & Detailed Grading) */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* LEFT PANEL: Submissions Queue & Current Assignment Context (5 cols) */}
          <div className="xl:col-span-5 flex flex-col gap-4">
            {/* Current Assignment Brief Card */}
            {currentTask ? (
              <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-100 relative overflow-hidden">
                <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-50 rounded-full blur-2xl pointer-events-none"></div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-[#f1f1fa] text-[#36348e] text-xs font-bold border border-indigo-100">
                    {currentTask.className}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-[#777587]">
                    <span className="material-symbols-outlined text-[16px] text-[#7a5b00]">
                      calendar_clock
                    </span>
                    Due: {currentTask.deadline}
                  </div>
                </div>
                <select
                  value={currentTask.id}
                  onChange={(e) => dispatch(setSelectedTaskId(e.target.value))}
                  className="w-full mb-1 bg-transparent text-base font-bold text-[#292929] leading-snug focus:outline-none cursor-pointer truncate relative"
                  title="Switch assessment"
                >
                  {(filteredTasks.some((t) => t.id === currentTask.id) ? filteredTasks : [currentTask, ...filteredTasks]).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.className} · {t.subject})
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-3 text-xs text-[#777587] mb-4">
                  <span className="flex items-center gap-1 font-semibold text-[#292929]">
                    <span className="material-symbols-outlined text-[16px] text-[#36348e]">
                      military_tech
                    </span>
                    Max Marks: <strong>{currentTask.totalMarks}</strong>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px] text-[#006c49]">group</span>
                    {currentTask.totalStudents} Enrolled Students
                  </span>
                </div>

                {/* Submission Progress Bar */}
                <div className="space-y-1.5 bg-[#f1f1fa] p-3 rounded-xl border border-indigo-100/60">
                  <div className="flex justify-between items-center text-xs font-medium">
                    <span className="text-[#545454]">
                      Class Turnout: {currentTask.submittedCount} / {currentTask.totalStudents}
                    </span>
                    <span className="font-bold text-[#292929]">
                      {currentTask.totalStudents > 0
                        ? Math.round((currentTask.submittedCount / currentTask.totalStudents) * 100)
                        : 0}%
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#dfdff2] rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-[#006c49]"
                      style={{
                        width: `${
                          currentTask.totalStudents > 0
                            ? (currentTask.gradedCount / currentTask.totalStudents) * 100
                            : 0
                        }%`,
                      }}
                      title="Graded"
                    ></div>
                    <div
                      className="h-full bg-[#4543a8]"
                      style={{
                        width: `${
                          currentTask.totalStudents > 0
                            ? (currentTask.pendingCount / currentTask.totalStudents) * 100
                            : 0
                        }%`,
                      }}
                      title="Pending Review"
                    ></div>
                    <div
                      className="h-full bg-[#ffc53a]"
                      style={{
                        width: `${
                          currentTask.totalStudents > 0
                            ? (currentTask.lateCount / currentTask.totalStudents) * 100
                            : 0
                        }%`,
                      }}
                      title="Late"
                    ></div>
                    <div
                      className="h-full bg-[#ba1a1a]"
                      style={{
                        width: `${
                          currentTask.totalStudents > 0
                            ? (currentTask.missingCount / currentTask.totalStudents) * 100
                            : 0
                        }%`,
                      }}
                      title="Missing"
                    ></div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[#777587] pt-0.5">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#006c49] inline-block"></span>
                      {currentTask.gradedCount} Graded
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#4543a8] inline-block"></span>
                      {currentTask.pendingCount} Pending
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#ffc53a] inline-block"></span>
                      {currentTask.lateCount} Late
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-[#ba1a1a] inline-block"></span>
                      {currentTask.missingCount} Missing
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white p-6 rounded-xl shadow-xs border border-slate-100 text-center text-[#777587]">
                <span className="material-symbols-outlined text-3xl mb-1 text-slate-300">assignment</span>
                <p className="font-semibold text-xs text-[#292929]">No Assignment Selected</p>
                <p className="text-[11px] text-[#777587] mt-0.5">Create or select a task to view submission telemetry.</p>
              </div>
            )}

            {/* Student Submissions Roster List */}
            <SubmissionQueue statusFilter={statusFilter} searchFilter={searchFilter} />

            {/* Quick bulk grading shortcut */}
            <div className="p-3 bg-[#f1f1fa] rounded-xl border border-indigo-100/60 flex items-center justify-between">
              <span className="text-xs text-[#545454]">Need batch evaluation?</span>
              <button
                onClick={() => setQuickGradeOpen(true)}
                disabled={!currentTask}
                className="text-[#36348e] text-xs font-bold hover:underline flex items-center gap-1 disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">speed</span> Quick-Grade
                Table
              </button>
            </div>
          </div>

          {/* RIGHT PANEL: Detailed Grading & Review Form (7 cols) */}
          <div className="xl:col-span-7 flex flex-col gap-4">
            <GradingDetail />
          </div>
        </div>
      )}

      <QuickGradeModal isOpen={quickGradeOpen} onClose={() => setQuickGradeOpen(false)} task={currentTask} />

      {/* BOTTOM SECTION: 'Create New Assignment' Trigger Card (visible when not in create tab) */}
      {currentSubTab !== 'create' && (
        <div className="mt-8">
          <CreateTaskForm />
        </div>
      )}
    </div>
  );
};
