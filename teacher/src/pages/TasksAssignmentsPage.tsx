import React, { useState, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { setSelectedTaskId, setCurrentSubTab, updateTaskStatusThunk } from '../store/slices/tasksSlice';
import { setCurrentTab, addToast } from '../store/slices/uiSlice';
import { CreateTaskForm } from '../components/grading/CreateTaskForm';
import { openProtectedFile } from '../services/api';
import {
  FileText,
  Plus,
  X,
  Search,
  Calendar,
  Paperclip,
  CheckCircle2,
  Clock,
  ArrowRight,
  Layers,
  Users,
  Award,
  Sparkles
} from 'lucide-react';

const TYPE_LABELS: Record<string, string> = {
  ASSIGNMENT: 'Assignment',
  QUIZ: 'Quiz',
  TEST: 'Class Test',
  EXAM: 'Examination'
};

export const TasksAssignmentsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const tasks = useAppSelector((state) => state.tasks.tasks);
  const selectedClassId = useAppSelector((state) => state.auth.selectedClassId);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (selectedClassId !== 'all' && t.classId !== selectedClassId) return false;
      if (filterQuery.trim()) {
        const q = filterQuery.toLowerCase().trim();
        return (
          t.title.toLowerCase().includes(q) ||
          t.className.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [tasks, selectedClassId, filterQuery]);

  const handleOpenGrading = (taskId: string) => {
    dispatch(setSelectedTaskId(taskId));
    dispatch(setCurrentSubTab('pending_grading'));
    dispatch(setCurrentTab('submissions-grading'));
  };

  const handleOpenHandout = async (url?: string, name?: string) => {
    if (!url) return;
    try {
      await openProtectedFile(url, name, true);
    } catch (err: any) {
      dispatch(addToast({ message: err.message || 'Unable to download the handout.', type: 'error' }));
    }
  };

  const handlePublishDraft = async (taskId: string, taskTitle: string) => {
    const result = await dispatch(updateTaskStatusThunk({ taskId, status: 'ACTIVE' }));
    if (updateTaskStatusThunk.fulfilled.match(result)) {
      dispatch(addToast({ message: `"${taskTitle}" is now visible to the class.`, type: 'success' }));
    } else {
      dispatch(addToast({ message: String(result.payload || 'Failed to publish the task.'), type: 'error' }));
    }
  };

  // Metrics
  const totalTasks = tasks.length;
  const totalSubmissions = tasks.reduce((acc, t) => acc + (t.submittedCount || 0), 0);
  const activeTasksCount = tasks.filter((t) => t.status !== 'draft').length;
  const draftTasksCount = tasks.filter((t) => t.status === 'draft').length;

  return (
    <div className="flex flex-col w-full pb-16 space-y-5 bg-[#f6f7fb] min-h-screen p-3 sm:p-5 lg:p-6 rounded-2xl">
      {/* ------------------------------------------------------------- */}
      {/* 1. HERO HEADER BANNER */}
      {/* ------------------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#36348e] text-white flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
              <FileText className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  Coursework &amp; Evaluations
                </span>
                <span className="text-[11px] font-extrabold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  Deadlines &amp; Grading
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#1e1b4b] tracking-tight mt-1">
                Tasks &amp; Homework Assignments
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Create new homework tasks, manage deadlines, attach worksheet handouts, and review turnout rates.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4.5 py-2.5 rounded-xl bg-[#36348e] hover:bg-[#2c2a75] text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md shadow-indigo-100 self-start md:self-auto cursor-pointer active:scale-[0.98]"
          >
            {showCreateForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>{showCreateForm ? 'Close Form' : 'New Assignment'}</span>
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="animate-in fade-in slide-in-from-top-2 duration-200">
          <CreateTaskForm />
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 2. TOP 4 WAVE KPI CARDS */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tasks */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-blue-100/80 hover:border-blue-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-blue-50 text-blue-700 border-blue-100">
              <span>All Courses</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
              {totalTasks}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Assignments Created
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(59, 130, 246, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Submissions Received */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-emerald-100/80 hover:border-emerald-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-emerald-50 text-emerald-700 border-emerald-100">
              <span>Turnout</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight leading-tight">
              {totalSubmissions}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Student Submissions Received
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(16, 185, 129, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#10b981" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Active Homework */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-purple-100/80 hover:border-purple-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white shadow-sm shadow-purple-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Clock className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-purple-50 text-purple-700 border-purple-100">
              <span>Open Deadlines</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-purple-800 tracking-tight leading-tight">
              {activeTasksCount}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Live Active Tasks
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(139, 92, 246, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Drafts */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-amber-100/80 hover:border-amber-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Layers className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-amber-50 text-amber-800 border-amber-200">
              <span>Unpublished</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-amber-800 tracking-tight leading-tight">
              {draftTasksCount}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Draft Assignments
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(245, 158, 11, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. SEARCH & FILTER TOOLBAR */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 flex items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search assignments or subjects..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all placeholder:text-slate-400"
          />
        </div>

        <span className="text-xs font-bold text-slate-500">
          Showing {filteredTasks.length} Assignment{filteredTasks.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. TASKS TABLE */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200/70 h-11 select-none text-[11px]">
                <th className="px-5 py-2 min-w-[220px]">Assignment Title</th>
                <th className="px-5 py-2 w-28">Class</th>
                <th className="px-5 py-2 w-32">Subject</th>
                <th className="px-5 py-2 w-36">Deadline</th>
                <th className="px-5 py-2 text-center w-28">Total Points</th>
                <th className="px-5 py-2 text-center w-36">Turnout Ratio</th>
                <th className="px-5 py-2 text-right w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <FileText className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-xs text-slate-700">No assignments or tasks found.</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Create a new assignment or clear your search.</p>
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50/80 h-14 transition-colors">
                    <td className="px-5 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 block">{task.title}</span>
                        {task.status === 'draft' && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 text-[10px] font-extrabold uppercase border border-amber-200">
                            Draft
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 truncate max-w-[280px] block">
                        {TYPE_LABELS[task.taskType] || 'Assignment'} · {task.instructions || 'No special instructions'}
                      </span>
                    </td>

                    <td className="px-5 py-2">
                      <span className="inline-block px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-xs border border-indigo-200">
                        {task.className}
                      </span>
                    </td>

                    <td className="px-5 py-2 font-semibold text-slate-700">{task.subject}</td>

                    <td className="px-5 py-2">
                      <span className="inline-flex items-center gap-1.5 font-bold text-rose-700 text-xs">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{task.deadline}</span>
                      </span>
                    </td>

                    <td className="px-5 py-2 text-center font-bold text-slate-900 font-mono">
                      {task.totalMarks} pts
                    </td>

                    <td className="px-5 py-2 text-center">
                      <span className="font-bold text-emerald-700 text-xs font-mono">
                        {task.submittedCount} / {task.totalStudents}
                      </span>
                      <div className="w-20 bg-slate-100 h-1.5 rounded-full overflow-hidden mx-auto mt-1">
                        <div
                          className="bg-emerald-600 h-full transition-all"
                          style={{
                            width: `${
                              task.totalStudents > 0
                                ? (task.submittedCount / task.totalStudents) * 100
                                : 0
                            }%`,
                          }}
                        ></div>
                      </div>
                    </td>

                    <td className="px-5 py-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenHandout(task.handoutUrl, task.handoutName)}
                          disabled={!task.handoutUrl}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                          title={task.handoutUrl ? `Download ${task.handoutName || 'handout'}` : 'No handout attached'}
                        >
                          <Paperclip className="w-4 h-4" />
                        </button>

                        {task.status === 'draft' ? (
                          <button
                            type="button"
                            onClick={() => handlePublishDraft(task.id, task.title)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer active:scale-[0.98]"
                          >
                            Publish
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenGrading(task.id)}
                            className="px-3 py-1.5 rounded-xl bg-[#36348e] hover:bg-[#2c2a75] text-white font-bold text-xs shadow-2xs transition-all flex items-center gap-1 cursor-pointer active:scale-[0.98]"
                          >
                            <span>Grade</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
