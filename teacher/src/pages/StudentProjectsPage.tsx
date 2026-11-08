import React, { useState, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { toggleMilestone } from '../store/slices/projectsSlice';
import { addToast } from '../store/slices/uiSlice';
import {
  FolderKanban,
  Plus,
  Calendar,
  Users,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  FolderOpen,
  Sparkles,
  TrendingUp,
  Layers
} from 'lucide-react';

export const StudentProjectsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const projects = useAppSelector((state) => state.projects.projects);
  const selectedClassId = useAppSelector((state) => state.auth.selectedClassId);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  const filteredProjects = useMemo(() => {
    return projects.filter(
      (p) => selectedClassId === 'all' || p.classId === selectedClassId
    );
  }, [projects, selectedClassId]);

  // Metrics
  const totalProjects = projects.length;
  const totalTeams = projects.reduce((acc, p) => acc + (p.teamsCount || 0), 0);
  const totalMilestones = projects.reduce((acc, p) => acc + p.milestones.length, 0);
  const completedMilestones = projects.reduce(
    (acc, p) => acc + p.milestones.filter((m) => m.completed).length,
    0
  );
  const overallMilestoneRate = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 100;

  return (
    <div className="flex flex-col w-full pb-16 space-y-5 bg-[#f6f7fb] min-h-screen p-3 sm:p-5 lg:p-6 rounded-2xl">
      {/* ------------------------------------------------------------- */}
      {/* 1. HERO HEADER BANNER */}
      {/* ------------------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#36348e] text-white flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
              <FolderKanban className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  Collaborative Learning
                </span>
                <span className="text-[11px] font-extrabold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  Project Tracker
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#1e1b4b] tracking-tight mt-1">
                Student Projects &amp; Milestones
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Monitor team deliverables, verify step milestones, and track student group progress.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              dispatch(
                addToast({
                  message: 'Opening new Project modal...',
                  type: 'info',
                })
              )
            }
            className="px-4.5 py-2.5 rounded-xl bg-[#36348e] hover:bg-[#2c2a75] text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md shadow-indigo-100 self-start md:self-auto cursor-pointer active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. TOP 4 WAVE KPI CARDS */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Projects */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-blue-100/80 hover:border-blue-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <FolderKanban className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-blue-50 text-blue-700 border-blue-100">
              <span>Active</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
              {totalProjects}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Active Student Projects
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(59, 130, 246, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Milestone Rate */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-emerald-100/80 hover:border-emerald-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-emerald-50 text-emerald-700 border-emerald-100">
              <span>{overallMilestoneRate}% Complete</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight leading-tight">
              {completedMilestones} <span className="text-sm font-semibold text-slate-400">/ {totalMilestones}</span>
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Milestones Verified
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(16, 185, 129, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#10b981" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Total Teams */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-purple-100/80 hover:border-purple-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white shadow-sm shadow-purple-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-purple-50 text-purple-700 border-purple-100">
              <span>Student Cohorts</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-purple-800 tracking-tight leading-tight">
              {totalTeams}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Project Teams Engaged
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(139, 92, 246, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Avg Progress */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-amber-100/80 hover:border-amber-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <TrendingUp className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-amber-50 text-amber-800 border-amber-200">
              <span>Velocity</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-amber-800 tracking-tight leading-tight">
              {projects.length > 0 ? Math.round(projects.reduce((acc, p) => acc + p.progress, 0) / projects.length) : 0}%
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Average Completion Rate
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
      {/* 3. PROJECTS TABLE */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200/70 h-11 select-none text-[11px]">
                <th className="px-5 py-2 min-w-[220px]">Project Details</th>
                <th className="px-5 py-2 w-28">Class</th>
                <th className="px-5 py-2 w-32">Subject</th>
                <th className="px-5 py-2 w-36">Deadline</th>
                <th className="px-5 py-2 text-center w-40">Progress</th>
                <th className="px-5 py-2 text-center w-28">Teams</th>
                <th className="px-5 py-2 text-right w-36">Milestones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <FolderOpen className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold text-xs text-slate-700">No active student projects found.</p>
                  </td>
                </tr>
              ) : (
                filteredProjects.map((project) => {
                  const isExpanded = expandedProjectId === project.id;

                  return (
                    <React.Fragment key={project.id}>
                      <tr
                        className={`hover:bg-slate-50/80 h-14 transition-colors ${
                          isExpanded ? 'bg-indigo-50/30' : ''
                        }`}
                      >
                        <td className="px-5 py-2">
                          <span className="font-bold text-slate-900 block">{project.title}</span>
                          <span className="text-[11px] text-slate-400 truncate max-w-[260px] block">
                            {project.description}
                          </span>
                        </td>

                        <td className="px-5 py-2">
                          <span className="inline-block px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-xs border border-indigo-200">
                            {project.className}
                          </span>
                        </td>

                        <td className="px-5 py-2 font-semibold text-slate-700">{project.subject}</td>

                        <td className="px-5 py-2">
                          <span className="inline-flex items-center gap-1.5 font-bold text-amber-800 text-xs">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{project.deadline}</span>
                          </span>
                        </td>

                        <td className="px-5 py-2 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-20 bg-slate-100 h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-[#36348e] h-full transition-all duration-300"
                                style={{ width: `${project.progress}%` }}
                              ></div>
                            </div>
                            <span className="font-mono text-xs font-bold text-slate-700">{project.progress}%</span>
                          </div>
                        </td>

                        <td className="px-5 py-2 text-center">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono font-bold text-xs">
                            {project.teamsCount} teams
                          </span>
                        </td>

                        <td className="px-5 py-2 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setExpandedProjectId(isExpanded ? null : project.id)
                            }
                            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[#36348e] font-bold text-xs inline-flex items-center gap-1 transition-all shadow-2xs cursor-pointer active:scale-[0.98]"
                          >
                            <span>{isExpanded ? 'Hide' : 'Checklist'}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Milestones Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/70 border-b border-slate-200">
                          <td colSpan={7} className="p-4 sm:p-5">
                            <span className="text-[11px] uppercase font-bold text-slate-400 block mb-2 tracking-wider">
                              Milestone Verification &amp; Stage Sign-off
                            </span>
                            <div className="flex flex-wrap gap-2">
                              {project.milestones.map((m) => (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => {
                                    dispatch(
                                      toggleMilestone({
                                        projectId: project.id,
                                        milestoneId: m.id,
                                      })
                                    );
                                    dispatch(
                                      addToast({
                                        message: `Milestone "${m.title}" status toggled`,
                                        type: 'info',
                                      })
                                    );
                                  }}
                                  className={`px-3 py-1.5 rounded-xl text-xs flex items-center gap-2 border transition-all cursor-pointer ${
                                    m.completed
                                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold shadow-2xs'
                                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                                  }`}
                                >
                                  {m.completed ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                  ) : (
                                    <Circle className="w-4 h-4 text-slate-400" />
                                  )}
                                  <span>{m.title}</span>
                                  <span className="text-[10px] text-slate-400 font-mono">({m.dueDate})</span>
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
