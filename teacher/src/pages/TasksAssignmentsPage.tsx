import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { setSelectedTaskId, setCurrentSubTab } from '../store/slices/tasksSlice';
import { setCurrentTab, addToast } from '../store/slices/uiSlice';
import { CreateTaskForm } from '../components/grading/CreateTaskForm';

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

  return (
    <div className="flex flex-col w-full pb-8 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#121c2a]">Tasks &amp; Assignments</h1>
          <p className="text-xs text-[#777587]">Manage homework deadlines, total points, and submissions.</p>
        </div>

        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-3.5 py-2 bg-[#4f46e5] hover:bg-[#3525cd] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
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
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#eff4ff] text-xs text-[#121c2a] placeholder:text-[#777587] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-[#464555]">
          <span>{filteredTasks.length} Assignments</span>
        </div>
      </div>

      {/* Clean Tasks Table */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#eff4ff] text-[#464555] font-bold uppercase tracking-wider border-b border-slate-200 h-10 select-none">
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
                      <span className="font-bold text-[#121c2a] block">{task.title}</span>
                      <span className="text-[11px] text-[#777587] truncate max-w-[280px] block">
                        {task.instructions}
                      </span>
                    </td>

                    <td className="px-3 font-bold text-[#3525cd]">
                      <span className="px-2 py-0.5 rounded bg-[#eff4ff] border border-indigo-100">
                        {task.className}
                      </span>
                    </td>

                    <td className="px-3 text-[#464555] font-semibold">{task.subject}</td>

                    <td className="px-3 font-medium text-[#ba1a1a]">
                      <span className="inline-flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">event</span>
                        {task.deadline}
                      </span>
                    </td>

                    <td className="px-3 text-center font-bold text-[#121c2a]">
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
                          onClick={() =>
                            dispatch(addToast({ message: `Downloaded ${task.handoutName}`, type: 'info' }))
                          }
                          className="p-1 text-[#464555] hover:text-[#121c2a] hover:bg-[#eff4ff] rounded transition-colors"
                          title="Download Handout"
                        >
                          <span className="material-symbols-outlined text-[17px]">attachment</span>
                        </button>
                        <button
                          onClick={() => handleOpenGrading(task.id)}
                          className="px-3 py-1 rounded-lg bg-[#4f46e5] hover:bg-[#3525cd] text-white font-bold text-[11px] shadow-xs"
                        >
                          Grade
                        </button>
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
