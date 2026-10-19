import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { LessonAttendanceSummary, AttendanceCorrectionRequest } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { LoadingState, ErrorState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  History,
  FileCheck2,
  Calendar,
  AlertTriangle,
  Eye,
  Check
} from 'lucide-react';

export const AttendanceModule: React.FC = () => {
  const [summaries, setSummaries] = useState<LessonAttendanceSummary[]>([]);
  const [corrections, setCorrections] = useState<AttendanceCorrectionRequest[]>([]);
  const [selectedSummary, setSelectedSummary] = useState<LessonAttendanceSummary | null>(null);
  const [selectedCorrection, setSelectedCorrection] = useState<AttendanceCorrectionRequest | null>(null);
  const [classFilter, setClassFilter] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Review Correction State
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const toast = useToast();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [sData, cData] = await Promise.all([
        api.getAttendanceSummaries(),
        api.getAttendanceCorrections()
      ]);
      setSummaries(sData);
      setCorrections(cData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load attendance records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReviewCorrection = async (decision: 'Approved' | 'Rejected') => {
    if (!selectedCorrection) return;
    if (!reviewRemarks.trim()) {
      toast.warning('Administrative review remarks are required.');
      return;
    }

    try {
      setReviewSubmitting(true);
      await api.reviewAttendanceCorrection(selectedCorrection.id, decision, reviewRemarks);
      toast.success(`Correction request marked as ${decision}.`);
      setIsReviewModalOpen(false);
      setReviewRemarks('');
      setSelectedCorrection(null);
      loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to review correction');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const filteredSummaries = summaries.filter((s) => {
    if (classFilter !== 'All' && s.classNumber !== Number(classFilter)) return false;
    return true;
  });

  const pendingCorrections = corrections.filter((c) => c.status === 'Pending');

  if (loading) return <LoadingState message="Loading attendance logs from Zoom sessions..." rows={6} />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  return (
    <div className="space-y-6">
      {/* Pending Corrections Alert in light pastel */}
      {pendingCorrections.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/90 text-xs space-y-3 shadow-2xs">
          <div className="flex items-center gap-2 font-semibold text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Teacher Attendance Correction Requests Awaiting Review ({pendingCorrections.length})</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingCorrections.map((corr) => (
              <div
                key={corr.id}
                className="p-3.5 rounded-xl bg-white border border-amber-200 flex flex-col justify-between gap-2 shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span className="font-semibold text-slate-900">Class {corr.classNumber} · {corr.subjectName}</span>
                    <span className="font-mono">{corr.date}</span>
                  </div>
                  <div className="text-slate-700 mt-1">
                    Student: <span className="font-semibold text-slate-900">{corr.studentName}</span>
                  </div>
                  <div className="text-[11px] text-amber-800 font-medium mt-0.5">
                    Proposed: {corr.originalStatus} → <span className="font-bold underline">{corr.proposedStatus}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 italic leading-relaxed">
                    "{corr.teacherReason}" (Requested by: {corr.teacherName})
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setSelectedCorrection(corr);
                      setReviewRemarks('Verified against Zoom meeting attendance log.');
                      setIsReviewModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-[11px] transition-colors shadow-2xs flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Review Request</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Attendance Oversight Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Classroom Attendance Oversight</h2>
            <p className="text-xs text-slate-500">
              Live attendance logs submitted by teachers for online Zoom lessons across Classes 1–8.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none shadow-2xs"
            >
              <option value="All">All Classes (1 to 8)</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
                <option key={c} value={c}>Class {c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80 uppercase text-[11px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Date & Time</th>
                  <th className="px-4 py-3">Class & Subject</th>
                  <th className="px-4 py-3">Faculty</th>
                  <th className="px-4 py-3 text-center">Enrolled</th>
                  <th className="px-4 py-3 text-center">Present / Absent</th>
                  <th className="px-4 py-3 text-center">Submission Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredSummaries.map((summary) => {
                  const presentCount = summary.records.filter((r) => r.status === 'Present').length;
                  const absentCount = summary.records.filter((r) => r.status === 'Absent').length;
                  const lateCount = summary.records.filter((r) => r.status === 'Late').length;

                  return (
                    <tr key={summary.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap font-mono">
                        <div className="font-semibold text-slate-900">{summary.date}</div>
                        <div className="text-[11px] text-slate-500">
                          {summary.startTime} – {summary.endTime}
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">Class {summary.classNumber}</div>
                        <div className="text-[11px] text-amber-700 font-medium">{summary.subjectName}</div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-slate-700 font-medium">
                        {summary.teacherName}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-center font-mono font-semibold text-slate-800">
                        {summary.enrolledStudentsCount}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-center font-mono">
                        {summary.submissionStatus === 'Missing' ? (
                          <span className="text-slate-400 italic">—</span>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-emerald-700 font-semibold">{presentCount} P</span>
                            <span className="text-rose-600 font-semibold">{absentCount} A</span>
                            {lateCount > 0 && <span className="text-amber-700 font-semibold">{lateCount} L</span>}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <StatusBadge status={summary.submissionStatus} />
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <button
                          onClick={() => setSelectedSummary(summary)}
                          title="Inspect Student Attendance Roster"
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors shadow-2xs ml-auto inline-flex items-center"
                        >
                          <Eye className="w-3.5 h-3.5" strokeWidth={1.75} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Attendance Roster Modal */}
      {selectedSummary && (
        <Modal
          isOpen={!!selectedSummary}
          onClose={() => setSelectedSummary(null)}
          title={`Class ${selectedSummary.classNumber} Attendance · ${selectedSummary.subjectName}`}
          description={`Date: ${selectedSummary.date} (${selectedSummary.startTime}–${selectedSummary.endTime}) · Marked by ${selectedSummary.teacherName}`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs">
            {selectedSummary.submissionStatus === 'Missing' ? (
              <div className="p-8 text-center text-slate-600 bg-slate-50 rounded-xl border border-slate-200">
                <AlertCircle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                <h4 className="font-semibold text-slate-900">Attendance Not Submitted Yet</h4>
                <p className="text-xs text-slate-500 mt-1">
                  The subject teacher has not submitted attendance logs for this session. A system alert was triggered.
                </p>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="px-3.5 py-2.5">Roll</th>
                      <th className="px-3.5 py-2.5">Student Name</th>
                      <th className="px-3.5 py-2.5 text-center">Status</th>
                      <th className="px-3.5 py-2.5">Remarks / ISP Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedSummary.records.map((rec) => (
                      <tr key={rec.studentId} className="hover:bg-slate-50/70">
                        <td className="px-3.5 py-2 font-mono font-bold text-slate-900">
                          {rec.rollNumber}
                        </td>
                        <td className="px-3.5 py-2 font-medium text-slate-800">
                          {rec.studentName}
                        </td>
                        <td className="px-3.5 py-2 text-center">
                          <StatusBadge status={rec.status} />
                        </td>
                        <td className="px-3.5 py-2 text-slate-500">
                          {rec.remarks || <span className="text-slate-300">—</span>}
                          {rec.correctionHistory && rec.correctionHistory.length > 0 && (
                            <span className="block text-[10px] text-amber-700 mt-0.5">
                              (Corrected from {rec.correctionHistory[0].previousStatus})
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Review Attendance Correction Modal */}
      {selectedCorrection && (
        <Modal
          isOpen={isReviewModalOpen}
          onClose={() => setIsReviewModalOpen(false)}
          title="Review Attendance Correction Request"
          description={`Class ${selectedCorrection.classNumber} · ${selectedCorrection.subjectName} · Student: ${selectedCorrection.studentName}`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between text-slate-500">
                <span>Teacher: <strong className="text-slate-900">{selectedCorrection.teacherName}</strong></span>
                <span className="font-mono text-[10px]">{selectedCorrection.date}</span>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <div>
                  <span className="text-slate-400 block text-[10px]">Recorded</span>
                  <StatusBadge status={selectedCorrection.originalStatus} />
                </div>
                <span className="text-slate-400 font-bold">→</span>
                <div>
                  <span className="text-slate-400 block text-[10px]">Proposed</span>
                  <StatusBadge status={selectedCorrection.proposedStatus} />
                </div>
              </div>
              <div className="text-[11px] text-slate-700 pt-1 border-t border-slate-200">
                <strong>Teacher's Stated Reason:</strong> {selectedCorrection.teacherReason}
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-medium mb-1">
                Principal Review Remarks <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={reviewRemarks}
                onChange={(e) => setReviewRemarks(e.target.value)}
                rows={2}
                placeholder="State basis for decision (recorded in immutable audit trail)..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:bg-white resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsReviewModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-800 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleReviewCorrection('Rejected')}
                disabled={reviewSubmitting}
                className="px-3.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-medium"
              >
                Reject Request
              </button>
              <button
                type="button"
                onClick={() => handleReviewCorrection('Approved')}
                disabled={reviewSubmitting}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-xs"
              >
                {reviewSubmitting ? 'Recording...' : 'Approve Correction'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
