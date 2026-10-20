import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { AcademicClassPerformance } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import {
  GraduationCap,
  BookOpen,
  Send,
  CheckCircle2,
  AlertTriangle,
  Award,
  TrendingUp,
  FileSpreadsheet,
  Eye
} from 'lucide-react';

export const AcademicOversightModule: React.FC = () => {
  const [performances, setPerformances] = useState<AcademicClassPerformance[]>([]);
  const [selectedClass, setSelectedClass] = useState<AcademicClassPerformance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const toast = useToast();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getAcademicPerformances();
      setPerformances(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load academic data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprovePublication = async (classNumber: number) => {
    try {
      await api.approveResultPublication(classNumber);
      toast.success(`Academic results for Class ${classNumber} published to Parent & Student portals.`);
      loadData();
    } catch {
      toast.error('Failed to publish results');
    }
  };

  if (loading) return <LoadingState message="Aggregating academic evaluations & term grades across Classes 1–8..." rows={6} />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

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

        <div className="flex items-center gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium shadow-2xs">
            Classes 1 through 8
          </span>
        </div>
      </div>

      {/* Grid of Classes 1–8 Performance Cards */}
      {performances.length === 0 ? (
        <EmptyState
          title="No Academic Performance Records"
          description="No evaluation, assessment, or exam records have been recorded for Classes 1 to 8 yet."
        />
      ) : (
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
                      {perf.averageScorePercentage}%
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {perf.enrolledStudents} students
                    </span>
                  </div>

                  {/* Visual thin score bar */}
                  <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden mt-1.5">
                    <div
                      className={`h-full rounded-full ${
                        perf.averageScorePercentage >= 80
                          ? 'bg-emerald-500'
                          : perf.averageScorePercentage >= 70
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${perf.averageScorePercentage}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px] font-mono">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Tasks Comp</span>
                    <span className="text-slate-700 font-semibold">{perf.taskCompletionRate}%</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Attendance</span>
                    <span className="text-slate-700 font-semibold">{perf.attendanceRate}%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                  <span>{perf.missingSubmissionsCount} pending tasks</span>
                  {perf.pendingGradingCount > 0 ? (
                    <span className="text-amber-700 font-semibold">{perf.pendingGradingCount} awaiting grade</span>
                  ) : (
                    <span className="text-emerald-700 font-semibold">Graded</span>
                  )}
                </div>
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
                  className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-medium transition-colors flex items-center gap-1 shadow-xs"
                >
                  <Send className="w-3 h-3" />
                  <span>Publish</span>
                </button>
              )}
            </div>
          </div>
        ))}
        </div>
      )}

      {/* Subject Performance Breakdown Modal */}
      {selectedClass && (
        <Modal
          isOpen={!!selectedClass}
          onClose={() => setSelectedClass(null)}
          title={`Academic Subject Breakdown · ${selectedClass.className}`}
          description={`Enrolled Students: ${selectedClass.enrolledStudents} · Class Average: ${selectedClass.averageScorePercentage}%`}
          maxWidth="lg"
        >
          <div className="space-y-3 text-xs">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-3.5 py-2.5">Subject Name</th>
                    <th className="px-3.5 py-2.5">Teacher in Charge</th>
                    <th className="px-3.5 py-2.5 text-right font-mono">Average Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedClass.subjectScores.map((sub, i) => (
                    <tr key={i} className="hover:bg-slate-50/70">
                      <td className="px-3.5 py-2.5 font-semibold text-slate-900">{sub.subjectName}</td>
                      <td className="px-3.5 py-2.5 text-slate-500">{sub.teacherName}</td>
                      <td className="px-3.5 py-2.5 font-mono text-right font-bold text-amber-700">
                        {sub.averageScore}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
