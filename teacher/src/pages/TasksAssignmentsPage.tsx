import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { setSelectedTaskId, setCurrentSubTab, updateTaskStatusThunk } from '../store/slices/tasksSlice';
import { setCurrentTab, addToast } from '../store/slices/uiSlice';
import { CreateTaskForm } from '../components/grading/CreateTaskForm';
import { openProtectedFile } from '../services/api';

const TYPE_LABELS: Record<string, string> = { ASSIGNMENT: 'Assignment', QUIZ: 'Quiz', TEST: 'Class Test', EXAM: 'Examination' };

export const TasksAssignmentsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const tasks = useAppSelector((state) => state.tasks.tasks);
  const selectedClassId = useAppSelector((state) => state.auth.selectedClassId);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');

  const filteredTasks = tasks.filter((t) => {
    if (selectedClassId !== 'all' && t.classId !== selectedClassId) return false;
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        t.className.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q)
      );
    }
    return true;
  });

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

  return (
    <div className="flex flex-col w-full pb-8 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#292929]">Tasks &amp; Assignments</h1>
          <p className="text-xs text-[#777587]">Manage homework deadlines, total points, and submissions.</p>
        </div>

        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-3.5 py-2 bg-[#4543a8] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-[17px]">
            {showCreateForm ? 'close' : 'add_task'}
          </span>
          <span>{showCreateForm ? 'Close Form' : 'New Assignment'}</span>
        </button>
      </div>

      {showCreateForm && (
        <div className="mb-4">
          <CreateTaskForm />
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-[#777587]">
            search
          </span>
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Search assignments..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#f1f1fa] text-xs text-[#292929] placeholder:text-[#777587] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-[#545454]">
          <span>{filteredTasks.length} Assignments</span>
        </div>
      </div>

      {/* Clean Tasks Table */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#f1f1fa] text-[#545454] font-bold uppercase tracking-wider border-b border-slate-200 h-10 select-none">
                <th className="px-3 min-w-[200px]">Assignment Title</th>
                <th className="px-3 w-24">Class</th>
                <th className="px-3 w-28">Subject</th>
                <th className="px-3 w-32">Deadline</th>
                <th className="px-3 text-center w-24">Total Marks</th>
                <th className="px-3 text-center w-28">Turnout Ratio</th>
                <th className="px-3 text-right w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-[#777587]">
                    <span className="material-symbols-outlined text-3xl mb-1 text-slate-300">assignment_late</span>
                    <p className="font-medium text-xs">No assignments or tasks found.</p>
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50 h-13 transition-colors">
                    <td className="px-3">
                      <span className="font-bold text-[#292929] block">
                        {task.title}
                        {task.status === 'draft' && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-100 text-[#777587] text-[10px] font-bold uppercase">Draft</span>
                        )}
                      </span>
                      <span className="text-[11px] text-[#777587] truncate max-w-[280px] block">
                        {TYPE_LABELS[task.taskType] || 'Assignment'} · {task.instructions}
                      </span>
                    </td>

                    <td className="px-3 font-bold text-[#36348e]">
                      <span className="px-2 py-0.5 rounded bg-[#f1f1fa] border border-indigo-100">
                        {task.className}
                      </span>
                    </td>

                    <td className="px-3 text-[#545454] font-semibold">{task.subject}</td>

                    <td className="px-3 font-medium text-[#ba1a1a]">
                      <span className="inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">event</span>
                        {task.deadline}
                      </span>
                    </td>

                    <td className="px-3 text-center font-bold text-[#292929]">
                      {task.totalMarks} pts
                    </td>

                    <td className="px-3 text-center">
                      <span className="font-bold text-[#006c49]">
                        {task.submittedCount} / {task.totalStudents}
                      </span>
                      <div className="w-16 bg-slate-100 h-1 rounded-full overflow-hidden mx-auto mt-1">
                        <div
                          className="bg-[#006c49] h-full"
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

                    <td className="px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenHandout(task.handoutUrl, task.handoutName)}
                          disabled={!task.handoutUrl}
                          className="p-1 text-[#545454] hover:text-[#292929] hover:bg-[#fff4d6] rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title={task.handoutUrl ? `Download ${task.handoutName || 'handout'}` : 'No handout attached'}
                        >
                          <span className="material-symbols-outlined text-[17px]">attachment</span>
                        </button>
                        {task.status === 'draft' ? (
                          <button
                            onClick={() => handlePublishDraft(task.id, task.title)}
                            className="px-3 py-1 rounded-lg bg-[#006c49] hover:bg-[#065f46] text-white font-bold text-[11px] shadow-xs"
                          >
                            Publish
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenGrading(task.id)}
                            className="px-3 py-1 rounded-lg bg-[#4543a8] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white font-bold text-[11px] shadow-xs"
                          >
                            Grade
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
