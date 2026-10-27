import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../../services/api';
import { AcademicClassPerformance, AssessmentType, StudentSupportFlag } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { StatCard } from '../../components/common/StatCard';
import { Modal } from '../../components/common/Modal';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import {
  GraduationCap,
  BookOpen,
  Send,
  AlertTriangle,
  TrendingUp,
  FileSpreadsheet,
  Eye,
  Users,
  CalendarCheck
} from 'lucide-react';

const TYPE_LABELS: Record<AssessmentType, string> = {
  ASSIGNMENT: 'Assignments',
  QUIZ: 'Quizzes',
  TEST: 'Tests',
  EXAM: 'Examinations'
};

const pct = (value: number | null | undefined) => (value == null ? '—' : `${value}%`);

const scoreBarColor = (value: number | null) =>
  value == null ? 'bg-slate-300' : value >= 80 ? 'bg-emerald-500' : value >= 70 ? 'bg-amber-500' : 'bg-rose-500';

const formatMonth = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
};

/** Weighted average of class averages by the number of graded results behind each. */
function weightedAverage(rows: { value: number | null; weight: number }[]): number | null {
  const usable = rows.filter((r) => r.value != null && r.weight > 0);
  const total = usable.reduce((s, r) => s + r.weight, 0);
  if (total === 0) return null;
  return Math.round(usable.reduce((s, r) => s + (r.value as number) * r.weight, 0) / total);
}

export const AcademicOversightModule: React.FC = () => {
  const [performances, setPerformances] = useState<AcademicClassPerformance[]>([]);
  const [selectedClass, setSelectedClass] = useState<AcademicClassPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<{ id: string; name: string; code: string }[]>([]);
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [publishing, setPublishing] = useState<number | null>(null);

  const toast = useToast();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getAcademicPerformances({
        subjectId: subjectFilter !== 'all' ? Number(subjectFilter) : null,
        taskType: typeFilter !== 'all' ? (typeFilter as AssessmentType) : null
      });
      setPerformances(data);
      setSelectedClass((prev) => (prev ? data.find((d) => d.classNumber === prev.classNumber) || null : null));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load academic data');
    } finally {
      setLoading(false);
    }
  }, [subjectFilter, typeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    api.getAllSubjects().then(setSubjects).catch(() => setSubjects([]));
  }, []);

  const handleApprovePublication = async (classNumber: number) => {
    try {
      setPublishing(classNumber);
      await api.approveResultPublication(classNumber);
      toast.success(`Academic results for Class ${classNumber} marked as published.`);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to publish results');
    } finally {
      setPublishing(null);
    }
  };

  const summary = useMemo(() => {
    const enrolled = performances.reduce((s, p) => s + p.enrolledStudents, 0);
    const graded = performances.reduce((s, p) => s + p.gradedResultsCount, 0);
    const pendingGrading = performances.reduce((s, p) => s + p.pendingGradingCount, 0);
    const average = weightedAverage(performances.map((p) => ({ value: p.averageScorePercentage, weight: p.gradedResultsCount })));
    const attendance = weightedAverage(performances.map((p) => ({ value: p.attendanceRate, weight: p.enrolledStudents })));
    return { enrolled, graded, pendingGrading, average, attendance };
  }, [performances]);

  const supportList = useMemo(
    () =>
      performances.flatMap((p) =>
        p.studentsNeedingSupport.map((s) => ({ ...s, className: p.className }))
      ) as (StudentSupportFlag & { className: string })[],
    [performances]
  );

  const filterControls = (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <select
        value={subjectFilter}
        onChange={(e) => setSubjectFilter(e.target.value)}
        className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium shadow-2xs focus:outline-none"
      >
        <option value="all">All Subjects</option>
        {subjects.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>
      <select
        value={typeFilter}
        onChange={(e) => setTypeFilter(e.target.value)}
        className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium shadow-2xs focus:outline-none"
      >
        <option value="all">All Assessments</option>
        {(Object.keys(TYPE_LABELS) as AssessmentType[]).map((t) => (
          <option key={t} value={t}>{TYPE_LABELS[t]}</option>
        ))}
      </select>
      <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium shadow-2xs">
        Classes 1 through 8
      </span>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Top Banner Card in clean white */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">School-Wide Academic Oversight</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Supervise Class 1–8 learning outcomes, task completion, subject-wise averages, and result publication workflows.
          </p>
        </div>

        {filterControls}
      </div>

      {loading ? (
        <LoadingState message="Aggregating academic evaluations & term grades across Classes 1–8..." rows={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : performances.length === 0 ? (
        <EmptyState
          title="No Academic Performance Records"
          description="No evaluation, assessment, or exam records have been recorded for Classes 1 to 8 yet."
        />
      ) : (
        <>
          {/* School-wide summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Enrolled Students"
              value={summary.enrolled}
              subtitle="Active across Classes 1–8"
              icon={<Users className="w-4 h-4" />}
              accentColor="blue"
            />
            <StatCard
              label="School Average Score"
              value={pct(summary.average)}
              subtitle={`${summary.graded} published results`}
              icon={<TrendingUp className="w-4 h-4" />}
              accentColor="emerald"
              progress={summary.average ?? undefined}
            />
            <StatCard
              label="Attendance Rate"
              value={pct(summary.attendance)}
              subtitle="Present + late over marked lessons"
              icon={<CalendarCheck className="w-4 h-4" />}
              accentColor="purple"
              progress={summary.attendance ?? undefined}
            />
            <StatCard
              label="Awaiting Grading"
              value={summary.pendingGrading}
              subtitle={`${supportList.length} students flagged for support`}
              icon={<FileSpreadsheet className="w-4 h-4" />}
              accentColor="amber"
            />
          </div>

          {/* Grid of Classes 1–8 Performance Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {performances.map((perf) => (
              <div
                key={perf.classNumber}
                className="p-4 rounded-2xl bg-white border border-slate-200/90 flex flex-col justify-between gap-3 shadow-xs hover:border-slate-300 transition-all duration-150"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      {perf.className}
                    </span>
                    <StatusBadge status={perf.publishedResultsStatus} />
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div>
                      <span className="text-slate-400 text-[10px] uppercase tracking-wider block">Average Term Score</span>
                      <div className="flex items-baseline justify-between mt-0.5">
                        <span className="text-xl font-bold font-mono text-slate-900">
                          {pct(perf.averageScorePercentage)}
                        </span>
                        <span className="text-[11px] text-slate-500 font-mono">
                          {perf.enrolledStudents} students
                        </span>
                      </div>

                      {/* Visual thin score bar */}
                      <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden mt-1.5">
                        <div
                          className={`h-full rounded-full ${scoreBarColor(perf.averageScorePercentage)}`}
                          style={{ width: `${perf.averageScorePercentage ?? 0}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px] font-mono">
                      <div>
                        <span className="text-slate-400 block text-[10px]">Tasks Comp</span>
                        <span className="text-slate-700 font-semibold">{pct(perf.taskCompletionRate)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px]">Attendance</span>
                        <span className="text-slate-700 font-semibold">{pct(perf.attendanceRate)}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                      <span>
                        {perf.assessmentsCount === 0
                          ? 'No assessments yet'
                          : `${perf.missingSubmissionsCount} missed submissions`}
                      </span>
                      {perf.pendingGradingCount > 0 ? (
                        <span className="text-amber-700 font-semibold">{perf.pendingGradingCount} awaiting grade</span>
                      ) : perf.gradedResultsCount > 0 ? (
                        <span className="text-emerald-700 font-semibold">Graded</span>
                      ) : null}
                    </div>

                    {perf.studentsNeedingSupport.length > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-rose-700 font-semibold">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{perf.studentsNeedingSupport.length} need academic support</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                  <button
                    onClick={() => setSelectedClass(perf)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-medium transition-colors flex items-center gap-1 shadow-2xs"
                  >
                    <Eye className="w-3 h-3 text-slate-400" />
                    <span>Subject Roster</span>
                  </button>

                  {perf.publishedResultsStatus !== 'Published' && (
                    <button
                      onClick={() => handleApprovePublication(perf.classNumber)}
                      disabled={publishing === perf.classNumber || perf.gradedResultsCount === 0}
                      title={perf.gradedResultsCount === 0 ? 'No graded results to publish yet' : undefined}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-medium transition-colors flex items-center gap-1 shadow-xs"
                    >
                      <Send className="w-3 h-3" />
                      <span>{publishing === perf.classNumber ? 'Publishing...' : 'Publish'}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Students needing academic support */}
          <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <h3 className="text-sm font-semibold text-slate-900">Students Who May Need Academic Support</h3>
              </div>
              <span className="text-[11px] text-slate-500">
                Average below 50%, attendance below 75%, or 3+ missed submissions
              </span>
            </div>
            {supportList.length === 0 ? (
              <div className="px-5 py-8 text-center text-xs text-slate-400">
                No students are currently flagged based on the recorded results and attendance.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="px-4 py-2.5">Student</th>
                      <th className="px-4 py-2.5">Class</th>
                      <th className="px-4 py-2.5 text-right font-mono">Average</th>
                      <th className="px-4 py-2.5 text-right font-mono">Attendance</th>
                      <th className="px-4 py-2.5 text-right font-mono">Missed</th>
                      <th className="px-4 py-2.5">Indicators</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {supportList.map((s) => (
                      <tr key={`${s.className}-${s.studentId}`} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2.5">
                          <span className="font-semibold text-slate-900 block">{s.studentName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{s.admissionNo}{s.rollNo ? ` · Roll ${s.rollNo}` : ''}</span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600">{s.className}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold">{pct(s.averageScore)}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{pct(s.attendanceRate)}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{s.missingSubmissions}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {s.reasons.map((r) => (
                              <span key={r} className="px-1.5 py-0.5 rounded-md bg-rose-50 border border-rose-200/70 text-rose-700 text-[10px] font-medium">
                                {r}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Subject Performance Breakdown Modal */}
      {selectedClass && (
        <Modal
          isOpen={!!selectedClass}
          onClose={() => setSelectedClass(null)}
          title={`Academic Subject Breakdown · ${selectedClass.className}`}
          description={`Enrolled Students: ${selectedClass.enrolledStudents} · Class Average: ${pct(selectedClass.averageScorePercentage)} · ${selectedClass.term}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-3.5 py-2.5">Subject Name</th>
                    <th className="px-3.5 py-2.5">Teacher in Charge</th>
                    <th className="px-3.5 py-2.5 text-right font-mono">Graded</th>
                    <th className="px-3.5 py-2.5 text-right font-mono">Average Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedClass.subjectScores.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3.5 py-6 text-center text-slate-400">
                        No subjects are configured for this class.
                      </td>
                    </tr>
                  ) : (
                    selectedClass.subjectScores.map((sub) => (
                      <tr key={sub.subjectId} className="hover:bg-slate-50/70">
                        <td className="px-3.5 py-2.5 font-semibold text-slate-900">{sub.subjectName}</td>
                        <td className="px-3.5 py-2.5 text-slate-500">{sub.teacherName}</td>
                        <td className="px-3.5 py-2.5 font-mono text-right text-slate-500">
                          {sub.gradedCount} / {sub.assessmentsCount} tasks
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-right font-bold text-amber-700">
                          {pct(sub.averageScore)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Assessment type breakdown & trend */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-1.5 mb-2 text-slate-900 font-semibold">
                  <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                  <span>Assessment Results by Type</span>
                </div>
                {selectedClass.assessmentBreakdown.length === 0 ? (
                  <p className="text-slate-400 text-[11px]">No assessments recorded.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedClass.assessmentBreakdown.map((b) => (
                      <div key={b.taskType} className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-600">{TYPE_LABELS[b.taskType]} ({b.assessments})</span>
                        <span className="font-mono font-semibold text-slate-900">
                          {pct(b.averageScore)} <span className="text-slate-400 font-normal">· {b.graded} graded</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-2xs">
                <div className="flex items-center gap-1.5 mb-2 text-slate-900 font-semibold">
                  <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                  <span>Monthly Performance Trend</span>
                </div>
                {selectedClass.trend.length === 0 ? (
                  <p className="text-slate-400 text-[11px]">Not enough graded results to show a trend.</p>
                ) : (
                  <div className="space-y-1.5">
                    {selectedClass.trend.map((t) => (
                      <div key={t.month} className="text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-600">{formatMonth(t.month)}</span>
                          <span className="font-mono font-semibold text-slate-900">{pct(t.averageScore)}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden mt-0.5">
                          <div className={`h-full rounded-full ${scoreBarColor(t.averageScore)}`} style={{ width: `${t.averageScore ?? 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent assessments */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center gap-1.5 text-slate-900 font-semibold">
                <GraduationCap className="w-3.5 h-3.5 text-slate-400" />
                <span>Recent Assessments, Quizzes & Examinations</span>
              </div>
              {selectedClass.recentAssessments.length === 0 ? (
                <p className="px-3.5 py-5 text-center text-slate-400">No assessments have been created for this class.</p>
              ) : (
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="px-3.5 py-2">Assessment</th>
                      <th className="px-3.5 py-2">Subject</th>
                      <th className="px-3.5 py-2 text-right font-mono">Submitted</th>
                      <th className="px-3.5 py-2 text-right font-mono">Average</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedClass.recentAssessments.map((a) => (
                      <tr key={a.taskId} className="hover:bg-slate-50/70">
                        <td className="px-3.5 py-2">
                          <span className="font-semibold text-slate-900 block">{a.title}</span>
                          <span className="text-[10px] text-slate-400">{TYPE_LABELS[a.taskType]} · {a.totalMarks} marks</span>
                        </td>
                        <td className="px-3.5 py-2 text-slate-500">{a.subjectName}</td>
                        <td className="px-3.5 py-2 text-right font-mono text-slate-500">
                          {a.submitted}/{a.enrolled} · {a.graded} graded
                        </td>
                        <td className="px-3.5 py-2 text-right font-mono font-bold text-amber-700">{pct(a.averageScore)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 leading-relaxed">
              Grade modifications are managed by assigned subject teachers. The Principal reviews and authorizes official publication to Parent Portal.
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedClass(null)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
