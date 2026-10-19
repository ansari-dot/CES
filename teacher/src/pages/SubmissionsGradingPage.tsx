import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { setCurrentSubTab } from '../store/slices/tasksSlice';
import { addToast } from '../store/slices/uiSlice';
import { SubmissionQueue } from '../components/grading/SubmissionQueue';
import { GradingDetail } from '../components/grading/GradingDetail';
import { CreateTaskForm } from '../components/grading/CreateTaskForm';

export const SubmissionsGradingPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const currentSubTab = useAppSelector((state) => state.tasks.currentSubTab);
  const tasks = useAppSelector((state) => state.tasks.tasks);
  const selectedTaskId = useAppSelector((state) => state.tasks.selectedTaskId);
  const currentTask = tasks.find((t) => t.id === selectedTaskId) || tasks[0];

  const [classFilter, setClassFilter] = useState('5-a');
  const [subjectFilter, setSubjectFilter] = useState('math');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchFilter, setSearchFilter] = useState('');

  const handleExportGradeSheet = () => {
    dispatch(
      addToast({
        message: 'Gradebook CSV exported with audit-stamped rubric scores.',
        type: 'info',
      })
    );
  };

  return (
    <div className="flex flex-col w-full pb-10">
      {/* Page Header & Key Metrics */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wider text-[#3525cd] font-bold">
              Assessment &amp; Evaluation
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
            <span className="text-xs text-[#777587]">Term 2 Academic Cycle</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#121c2a] tracking-tight">
            Tasks, Submissions &amp; Grading
          </h1>
          <p className="text-xs sm:text-sm text-[#464555] max-w-2xl">
            Manage homework, evaluate student work, assign marks, and provide written feedback with
            synchronized gradebook reporting.
          </p>
        </div>

        {/* Quick Status Tally Chips */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-xs border border-slate-100">
            <span className="w-2.5 h-2.5 rounded-full bg-[#006c49]"></span>
            <span className="text-xs text-[#777587]">Class Avg:</span>
            <span className="text-xs font-bold text-[#121c2a]">88.4%</span>
          </div>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl shadow-xs border border-slate-100">
            <span className="w-2.5 h-2.5 rounded-full bg-[#684000]"></span>
            <span className="text-xs text-[#777587]">To Grade:</span>
            <span className="text-xs font-bold text-[#684000]">14 papers</span>
          </div>
        </div>
      </div>

      {/* Top Navigation Sub-Tabs */}
      <div className="flex items-center justify-between bg-[#eff4ff] p-1.5 rounded-2xl mb-6 overflow-x-auto shadow-xs border border-indigo-100">
        <div className="flex items-center gap-1 min-w-max">
          <button
            onClick={() => dispatch(setCurrentSubTab('active'))}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 ${
              currentSubTab === 'active'
                ? 'bg-[#4f46e5] text-white shadow-xs'
                : 'text-[#464555] hover:text-[#121c2a] hover:bg-white/60'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">assignment_turned_in</span>
            Active Tasks ({tasks.length})
          </button>

          <button
            onClick={() => dispatch(setCurrentSubTab('pending_grading'))}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 ${
              currentSubTab === 'pending_grading'
                ? 'bg-[#4f46e5] text-white shadow-xs'
                : 'text-[#464555] hover:text-[#121c2a] hover:bg-white/60'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">rate_review</span>
            Submissions Awaiting Grading (14)
          </button>

          <button
            onClick={() => dispatch(setCurrentSubTab('archive'))}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 ${
              currentSubTab === 'archive'
                ? 'bg-[#4f46e5] text-white shadow-xs'
                : 'text-[#464555] hover:text-[#121c2a] hover:bg-white/60'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">inventory_2</span>
            Graded Archive (48)
          </button>

          <button
            onClick={() => dispatch(setCurrentSubTab('create'))}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 ${
              currentSubTab === 'create'
                ? 'bg-[#4f46e5] text-white shadow-xs'
                : 'text-[#464555] hover:text-[#121c2a] hover:bg-white/60'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">add_circle</span>
            New Task Creation
          </button>
        </div>

        <div className="hidden lg:flex items-center gap-1.5 pr-3 text-xs text-[#777587]">
          <span className="material-symbols-outlined text-[16px] text-[#006c49]">cloud_done</span>
          Auto-saved 2m ago
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-100 mb-6 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
          {/* Class Filter */}
          <div className="flex items-center gap-2 bg-[#eff4ff] px-3 py-2 rounded-lg border border-indigo-100/60">
            <span className="material-symbols-outlined text-[18px] text-[#777587]">groups</span>
            <div className="flex flex-col flex-1 min-w-0">
              <label className="text-[10px] uppercase text-[#777587] font-bold leading-none">
                Class
              </label>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-[#121c2a] focus:outline-none cursor-pointer truncate"
              >
                <option value="5-a">Class 5-A (Mathematics)</option>
                <option value="all">All Assigned Classes</option>
                <option value="6-b">Class 6-B (Science)</option>
                <option value="7-c">Class 7-C (Mathematics)</option>
              </select>
            </div>
          </div>

          {/* Subject Filter */}
          <div className="flex items-center gap-2 bg-[#eff4ff] px-3 py-2 rounded-lg border border-indigo-100/60">
            <span className="material-symbols-outlined text-[18px] text-[#777587]">auto_stories</span>
            <div className="flex flex-col flex-1 min-w-0">
              <label className="text-[10px] uppercase text-[#777587] font-bold leading-none">
                Subject
              </label>
              <select
                value={subjectFilter}
                onChange={(e) => setSubjectFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-[#121c2a] focus:outline-none cursor-pointer truncate"
              >
                <option value="math">Mathematics</option>
                <option value="science">General Science</option>
                <option value="all">All Subjects</option>
              </select>
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 bg-[#eff4ff] px-3 py-2 rounded-lg border border-indigo-100/60">
            <span className="material-symbols-outlined text-[18px] text-[#777587]">tune</span>
            <div className="flex flex-col flex-1 min-w-0">
              <label className="text-[10px] uppercase text-[#777587] font-bold leading-none">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-xs font-bold text-[#121c2a] focus:outline-none cursor-pointer truncate"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending Review (2)</option>
                <option value="graded">Graded (1)</option>
                <option value="overdue">Missing / Overdue (1)</option>
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
              className="w-full bg-[#eff4ff] pl-9 pr-3 py-2 rounded-lg text-xs sm:text-sm text-[#121c2a] placeholder:text-[#777587] focus:outline-none focus:ring-2 focus:ring-indigo-200 border border-indigo-100/60"
            />
          </div>
          <button
            onClick={handleExportGradeSheet}
            className="p-2 bg-[#eff4ff] hover:bg-[#dee9fc] rounded-lg text-[#464555] transition-colors border border-indigo-100"
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
            <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-100 relative overflow-hidden">
              <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-50 rounded-full blur-2xl pointer-events-none"></div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#eff4ff] text-[#3525cd] text-xs font-bold border border-indigo-100">
                  {currentTask.className} • Module 3
                </span>
                <div className="flex items-center gap-1 text-xs text-[#777587]">
                  <span className="material-symbols-outlined text-[16px] text-[#684000]">
                    calendar_clock
                  </span>
                  Due: {currentTask.deadline}
                </div>
              </div>
              <h2 className="text-base font-bold text-[#121c2a] mb-1 leading-snug">
                {currentTask.title}
              </h2>
              <div className="flex items-center gap-3 text-xs text-[#777587] mb-4">
                <span className="flex items-center gap-1 font-semibold text-[#121c2a]">
                  <span className="material-symbols-outlined text-[16px] text-[#3525cd]">
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
              <div className="space-y-1.5 bg-[#eff4ff] p-3 rounded-xl border border-indigo-100/60">
                <div className="flex justify-between items-center text-xs font-medium">
                  <span className="text-[#464555]">
                    Class Turnout: {currentTask.submittedCount} / {currentTask.totalStudents}
                  </span>
                  <span className="font-bold text-[#121c2a]">
                    {Math.round((currentTask.submittedCount / currentTask.totalStudents) * 100)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-[#dee9fc] rounded-full overflow-hidden flex">
                  <div className="h-full bg-[#006c49]" style={{ width: '65%' }} title="Graded"></div>
                  <div
                    className="h-full bg-[#4f46e5]"
                    style={{ width: '25%' }}
                    title="Pending Review"
                  ></div>
                  <div className="h-full bg-[#ffb95f]" style={{ width: '6%' }} title="Late"></div>
                  <div className="h-full bg-[#ba1a1a]" style={{ width: '4%' }} title="Missing"></div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#777587] pt-0.5">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#006c49] inline-block"></span>
                    18 Graded
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#4f46e5] inline-block"></span>7 Pending
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#ffb95f] inline-block"></span>2 Late
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#ba1a1a] inline-block"></span>1 Missing
                  </span>
                </div>
              </div>
            </div>

            {/* Student Submissions Roster List */}
            <SubmissionQueue statusFilter={statusFilter} searchFilter={searchFilter} />

            {/* Quick bulk grading shortcut */}
            <div className="p-3 bg-[#eff4ff] rounded-xl border border-indigo-100/60 flex items-center justify-between">
              <span className="text-xs text-[#464555]">Need batch evaluation?</span>
              <button
                onClick={() => dispatch(addToast({ message: 'Batch Quick-Grade table opened.', type: 'info' }))}
                className="text-[#3525cd] text-xs font-bold hover:underline flex items-center gap-1"
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

      {/* BOTTOM SECTION: 'Create New Assignment' Trigger Card (visible when not in create tab) */}
      {currentSubTab !== 'create' && (
        <div className="mt-8">
          <CreateTaskForm />
        </div>
      )}
    </div>
  );
};
