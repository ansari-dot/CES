import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { toggleMilestone } from '../store/slices/projectsSlice';
import { addToast } from '../store/slices/uiSlice';

export const StudentProjectsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const projects = useAppSelector((state) => state.projects.projects);
  const selectedClassId = useAppSelector((state) => state.auth.selectedClassId);

  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  const filteredProjects =
    selectedClassId === 'all'
      ? projects
      : projects.filter((p) => p.classId === selectedClassId);

  return (
    <div className="flex flex-col w-full pb-8 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#121c2a]">Student Projects</h1>
          <p className="text-xs text-[#777587]">Monitor team progress, verify stage milestones, and evaluate deliverables.</p>
        </div>

        <button
          onClick={() =>
            dispatch(
              addToast({
                message: 'Opening new Project modal...',
                type: 'info',
              })
            )
          }
          className="px-3.5 py-2 bg-[#4f46e5] hover:bg-[#3525cd] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-[17px]">add_box</span>
          <span>New Project</span>
        </button>
      </div>

      {/* Clean Projects Table */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-[#eff4ff] text-[#464555] font-bold uppercase tracking-wider border-b border-slate-200 h-10 select-none">
                <th className="px-3 min-w-[200px]">Project Title</th>
                <th className="px-3 w-24">Class</th>
                <th className="px-3 w-28">Subject</th>
                <th className="px-3 w-32">Deadline</th>
                <th className="px-3 text-center w-36">Milestone Progress</th>
                <th className="px-3 text-center w-28">Teams</th>
                <th className="px-3 text-right w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProjects.map((project) => {
                const isExpanded = expandedProjectId === project.id;

                return (
                  <React.Fragment key={project.id}>
                    <tr
                      className={`hover:bg-slate-50 h-13 transition-colors ${
                        isExpanded ? 'bg-indigo-50/20' : ''
                      }`}
                    >
                      <td className="px-3">
                        <span className="font-bold text-[#121c2a] block">{project.title}</span>
                        <span className="text-[11px] text-[#777587] truncate max-w-[260px] block">
                          {project.description}
                        </span>
                      </td>

                      <td className="px-3 font-bold text-[#3525cd]">
                        <span className="px-2 py-0.5 rounded bg-[#eff4ff] border border-indigo-100">
                          {project.className}
                        </span>
                      </td>

                      <td className="px-3 text-[#464555] font-semibold">{project.subject}</td>

                      <td className="px-3 font-medium text-[#684000]">
                        <span className="inline-flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">event</span>
                          {project.deadline}
                        </span>
                      </td>

                      <td className="px-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <span className="font-bold text-[#006c49]">{project.progressPercent}%</span>
                          <div className="w-16 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="bg-[#006c49] h-full"
                              style={{ width: `${project.progressPercent}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 text-center font-bold text-[#121c2a]">
                        {project.totalGroups} Teams
                      </td>

                      <td className="px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() =>
                              setExpandedProjectId(isExpanded ? null : project.id)
                            }
                            className="px-2.5 py-1 rounded-lg bg-[#eff4ff] hover:bg-[#dee9fc] text-[#3525cd] text-[11px] font-bold"
                          >
                            {isExpanded ? 'Hide' : 'Milestones'}
                          </button>
                          <button
                            onClick={() =>
                              dispatch(
                                addToast({
                                  message: `Opened team artifacts for ${project.title}`,
                                  type: 'info',
                                })
                              )
                            }
                            className="px-3 py-1 rounded-lg bg-[#4f46e5] hover:bg-[#3525cd] text-white text-[11px] font-bold shadow-xs"
                          >
                            Review
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expandable Milestones Row */}
                    {isExpanded && (
                      <tr className="bg-[#f8f9ff]">
                        <td colSpan={7} className="p-3 border-b border-indigo-100">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-bold uppercase text-[#777587] mr-1">
                              Milestone Checks:
                            </span>
                            {project.milestones.map((m) => (
                              <button
                                key={m.id}
                                onClick={() => {
                                  dispatch(
                                    toggleMilestone({
                                      projectId: project.id,
                                      milestoneId: m.id,
                                    })
                                  );
                                  dispatch(
                                    addToast({
                                      message: `Milestone "${m.title}" toggled`,
                                      type: 'info',
                                    })
                                  );
                                }}
                                className={`px-2.5 py-1 rounded-lg text-xs flex items-center gap-1.5 border transition-all ${
                                  m.completed
                                    ? 'bg-[#d1fae5] border-emerald-200 text-[#065f46] font-semibold'
                                    : 'bg-white border-slate-200 text-[#464555] hover:bg-slate-50'
                                }`}
                              >
                                <span className="material-symbols-outlined text-[15px]">
                                  {m.completed ? 'check_circle' : 'radio_button_unchecked'}
                                </span>
                                <span>{m.title}</span>
                                <span className="text-[10px] text-[#777587]">({m.dueDate})</span>
                              </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
