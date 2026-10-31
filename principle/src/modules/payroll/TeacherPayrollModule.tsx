import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { TeacherSalaryDraft } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { LoadingState, ErrorState } from '../../components/common/StateViews';
import { LetterheadHeader, LetterheadFooter } from '../../components/common/Letterhead';
import { useToast } from '../../context/ToastContext';
import { useSocketEvent } from '../../hooks/useSocket';
import { RealtimeEvents } from '../../services/socketService';
import {
  Banknote,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Calculator,
  Plus,
  Printer,
  Calendar,
  Eye,
  FileCheck2,
  Lock,
  AlertTriangle
} from 'lucide-react';

const AVAILABLE_MONTHS = [
  'October 2026',
  'September 2026',
  'August 2026',
  'July 2026',
  'June 2026',
  'May 2026',
  'April 2026',
  'March 2026',
  'February 2026',
  'January 2026'
];

export const TeacherPayrollModule: React.FC = () => {
  const [drafts, setDrafts] = useState<TeacherSalaryDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>('October 2026');
  const [isGenerating, setIsGenerating] = useState(false);
  const [pendingReviewsCount, setPendingReviewsCount] = useState<number>(0);

  // Details & Approval Modal
  const [selectedDraft, setSelectedDraft] = useState<TeacherSalaryDraft | null>(null);
  const [selectedDutySummary, setSelectedDutySummary] = useState<any>(null);
  const [loadingDutySummary, setLoadingDutySummary] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Adjustment Modal
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState<'Addition' | 'Deduction'>('Addition');
  const [adjustmentTitle, setAdjustmentTitle] = useState('');
  const [adjustmentAmount, setAdjustmentAmount] = useState<number>(1000);
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjSubmitting, setAdjSubmitting] = useState(false);

  // Settle Payment Modal (Atomic Financial Settlement)
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'Bank Transfer' | 'Direct Deposit' | 'Cheque'>('Bank Transfer');
  const [paymentReference, setPaymentReference] = useState('');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [settleSubmitting, setSettleSubmitting] = useState(false);

  const toast = useToast();

  const loadDrafts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [data, reviews] = await Promise.all([
        api.getSalaryDrafts(selectedMonth),
        api.getAttendanceReviews({ status: 'REQUIRES_REVIEW' }).catch(() => [])
      ]);
      setDrafts(data);
      setPendingReviewsCount(Array.isArray(reviews) ? reviews.length : 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load salary drafts');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  useSocketEvent(RealtimeEvents.PAYROLL_SUMMARY_UPDATED, () => {
    loadDrafts();
  });
  useSocketEvent(RealtimeEvents.TEACHER_DUTY_UPDATED, () => {
    loadDrafts();
  });

  const handleGenerateDrafts = async () => {
    try {
      setIsGenerating(true);
      const res = await api.generateSalaryDrafts(selectedMonth);
      toast.success(
        res.generatedCount > 0
          ? `Generated ${res.generatedCount} monthly salary drafts for ${selectedMonth} using verified Zoom duty logs.`
          : res.message || `Salary drafts for ${selectedMonth} processed.`
      );
      loadDrafts();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate drafts');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReviewDraft = async (
    decision: 'Approved' | 'Returned for Correction' | 'Rejected'
  ) => {
    if (!selectedDraft) return;
    if ((decision === 'Returned for Correction' || decision === 'Rejected') && !reviewRemarks.trim()) {
      toast.warning('A reason note is required when rejecting or returning salary drafts.');
      return;
    }

    try {
      setReviewSubmitting(true);
      const updated = await api.reviewSalaryDraft(selectedDraft.id, decision, reviewRemarks);
      toast.success(
        decision === 'Approved'
          ? `Salary slip issued for ${selectedDraft.teacherName} (Slip: ${updated.salarySlipNumber || 'Issued'}).`
          : `Salary draft marked: ${decision}.`
      );
      setIsDetailsModalOpen(false);
      setSelectedDraft(null);
      loadDrafts();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Review action failed');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleAddAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDraft) return;
    if (!adjustmentTitle.trim() || !adjustmentReason.trim()) {
      toast.warning('Please enter adjustment title and recorded justification.');
      return;
    }

    try {
      setAdjSubmitting(true);
      const updated = await api.addSalaryAdjustment(selectedDraft.id, {
        type: adjustmentType,
        title: adjustmentTitle,
        amount: Number(adjustmentAmount),
        reason: adjustmentReason
      });
      setSelectedDraft(updated);
      toast.success(`Salary adjustment of Rs. ${adjustmentAmount.toLocaleString()} applied.`);
      setIsAdjustmentModalOpen(false);
      setAdjustmentTitle('');
      setAdjustmentReason('');
      loadDrafts();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Adjustment failed');
    } finally {
      setAdjSubmitting(false);
    }
  };

  const handleOpenDraftDetails = async (draft: TeacherSalaryDraft) => {
    setSelectedDraft(draft);
    setReviewRemarks(
      draft.status === 'Submitted for Approval'
        ? 'All duty logs and Zoom attendance verified. Approved.'
        : ''
    );
    setIsDetailsModalOpen(true);
    setSelectedDutySummary(null);
    try {
      setLoadingDutySummary(true);
      const summaryData = await api.getTeacherDutySummary(draft.teacherId, selectedMonth);
      setSelectedDutySummary(summaryData);
    } catch {
      setSelectedDutySummary(null);
    } finally {
      setLoadingDutySummary(false);
    }
  };

  const handleOpenSettleModal = (draft: TeacherSalaryDraft) => {
    setSelectedDraft(draft);
    setPaidAmount(draft.netPayable);
    setPaymentReference(`HBL-FT-${Date.now().toString().slice(-6)}`);
    setPaymentMethod('Bank Transfer');
    setIsSettleModalOpen(true);
  };

  const handleSettlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDraft) return;

    try {
      setSettleSubmitting(true);
      const updated = await api.settleSalaryPayment(selectedDraft.id, {
        paymentMethod,
        paymentReference: paymentReference.trim() || undefined,
        paidAmount: Number(paidAmount)
      });
      setSelectedDraft(updated);
      toast.success(`Payment settled for ${selectedDraft.teacherName} (Slip: ${updated.salarySlipNumber || updated.id}).`);
      setIsSettleModalOpen(false);
      loadDrafts();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Payment settlement failed');
    } finally {
      setSettleSubmitting(false);
    }
  };

  if (loading) return <LoadingState message="Loading teacher duty summaries & payroll calculation engine..." rows={6} />;
  if (error) return <ErrorState message={error} onRetry={loadDrafts} />;

  return (
    <div className="space-y-4">
      {/* Top Banner Card in clean white */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Teacher Salary &amp; Payroll Preparation</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Automatic monthly payroll powered by verified Zoom classroom duty tracking and transparent salary formulas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Month Selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent font-bold text-slate-900 border-none outline-none cursor-pointer text-xs"
            >
              {AVAILABLE_MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Generate Drafts Button */}
          <button
            onClick={handleGenerateDrafts}
            disabled={isGenerating}
            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            title="Batch calculate teacher salary drafts for selected month from verified Zoom duty records"
          >
            <Calculator className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'Calculating...' : 'Generate Monthly Drafts'}</span>
          </button>

          <span className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium shadow-2xs">
            {drafts.filter((d) => d.status === 'Submitted for Approval').length} Awaiting Authorization
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-medium shadow-2xs">
            {drafts.filter((d) => d.status === 'Approved').length} Ready for Disbursement
          </span>
        </div>
      </div>

      {/* Attendance Review Warning Alert Banner */}
      {pendingReviewsCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/90 shadow-2xs flex items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-amber-900">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-amber-950">
                {pendingReviewsCount} Faculty Zoom Duty Session{pendingReviewsCount > 1 ? 's' : ''} Require Attendance Review
              </span>
              <p className="text-amber-800 text-[11px] mt-0.5 leading-relaxed">
                Faculty sessions with unverified display names or identity discrepancies are held in escrow. They are currently excluded from calculated teaching hours until approved in the <strong>Classroom Zoom Links &amp; Attendance Review</strong> module.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Salary Drafts List */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80 uppercase text-[11px] tracking-wider">
              <tr>
                <th className="px-4 py-3">Faculty / Staff ID</th>
                <th className="px-4 py-3">Salary Model</th>
                <th className="px-4 py-3 text-center">Duty Metrics</th>
                <th className="px-4 py-3 font-mono text-right">Gross Amount</th>
                <th className="px-4 py-3 font-mono text-right">Net Payable</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {drafts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No teacher salary drafts found.
                  </td>
                </tr>
              ) : (
                drafts.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{d.teacherName}</div>
                      <div className="font-mono text-[10px] text-slate-400">{d.staffIdentifier} · {d.payrollMonth}</div>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-amber-700 font-medium text-[11px]">{d.salaryModel}</span>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-center font-mono">
                      <div className="flex items-center justify-center gap-1.5 text-[11px]">
                        <span className="text-emerald-700 font-semibold">{d.completedLessons} Comp</span>
                        <span className="text-slate-400">/</span>
                        <span className="text-slate-500">{d.scheduledLessons} Sched</span>
                        {d.missedLessons > 0 && <span className="text-rose-600 font-semibold">({d.missedLessons} Missed)</span>}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {d.verifiedHours} verified teaching hrs
                      </div>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap font-mono text-right text-slate-600">
                      Rs. {d.grossAmount.toLocaleString()}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap font-mono text-right font-bold text-emerald-700 text-sm">
                      Rs. {d.netPayable.toLocaleString()}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <StatusBadge status={d.status} />
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <button
                        onClick={() => handleOpenDraftDetails(d)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5 shadow-xs ${
                          d.status === 'Paid'
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            : d.status === 'Approved'
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-amber-600 hover:bg-amber-500 text-white'
                        }`}
                      >
                        {d.status === 'Paid' ? (
                          <>
                            <FileCheck2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                            <span>View Slip</span>
                          </>
                        ) : d.status === 'Approved' ? (
                          <>
                            <Banknote className="w-3.5 h-3.5" strokeWidth={1.75} />
                            <span>Settle / View</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" strokeWidth={1.75} />
                            <span>Audit & Approve</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Salary Draft Calculation Details & Approval Modal */}
      {selectedDraft && (
        <Modal
          isOpen={isDetailsModalOpen}
          onClose={() => setIsDetailsModalOpen(false)}
          title={`Payroll Calculation Audit · ${selectedDraft.teacherName}`}
          description={`Period: ${selectedDraft.payrollMonth} · Model: ${selectedDraft.salaryModel} · ID: ${selectedDraft.staffIdentifier}`}
          maxWidth="2xl"
        >
          <div className="print-area space-y-4 text-xs">
            {/* Official letterhead on printed salary slips / receipts */}
            <LetterheadHeader />
            <div className="hidden print:block mb-2">
              <h1 className="text-sm font-bold text-slate-900">Salary Slip · {selectedDraft.teacherName}</h1>
              <p className="text-[10px] text-slate-600">Period: {selectedDraft.payrollMonth} · Staff ID: {selectedDraft.staffIdentifier}</p>
            </div>
            {/* Calculation Formula Banner */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-amber-700 font-semibold">
                <Calculator className="w-4 h-4" />
                <span>Transparent Calculation Formula</span>
              </div>
              <div className="font-mono text-slate-700 text-[11px] bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed shadow-2xs">
                {selectedDraft.calculationFormula}
              </div>
            </div>

            {/* Duty metrics & components */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 font-mono">
              <div>
                <span className="text-slate-500 block text-[10px]">Base Pay</span>
                <span className="text-sm font-semibold text-slate-900">Rs. {selectedDraft.basePay.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Lesson/Hourly Earnings</span>
                <span className="text-sm font-semibold text-slate-900">Rs. {selectedDraft.lessonOrHourlyEarning.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Allowances</span>
                <span className="text-sm font-semibold text-emerald-700">+Rs. {selectedDraft.allowances.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px]">Standard Deductions</span>
                <span className="text-sm font-semibold text-rose-700">-Rs. {selectedDraft.standardDeductions.toLocaleString()}</span>
              </div>
            </div>

            {/* Daily Duty Hours Tracking Section */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-700 font-semibold">
                  <Calendar className="w-4 h-4" />
                  <span>Verified Classroom Teaching Duty &amp; Daily Tracking</span>
                </div>
                {loadingDutySummary && (
                  <span className="text-[11px] text-slate-400 animate-pulse">Loading live duty logs...</span>
                )}
              </div>

              {selectedDutySummary ? (
                <div className="space-y-3">
                  {/* Today Duty Highlight Banner */}
                  <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-emerald-950 block">Today's Teaching Duty:</span>
                      <span className="text-[11px]">
                        {selectedDutySummary.todayTeachingHours || 0} hrs ({selectedDutySummary.todayTeachingMinutes || 0} mins) taught today • {selectedDutySummary.todayCompletedCount || 0} of {selectedDutySummary.todayScheduledCount || 0} classes completed
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 text-[10px] font-bold">
                      {selectedDutySummary.todayCompletedCount > 0 ? 'Duty Recorded' : 'No Classes Today'}
                    </span>
                  </div>

                  {/* Daily Duty Breakdown Table */}
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
                    <div className="p-2 bg-slate-100/70 border-b border-slate-200 font-bold text-slate-700 text-[11px] flex justify-between">
                      <span>Daily Hours Breakdown ({selectedDutySummary.dailyBreakdown?.length || 0} Days)</span>
                      <span>Total: {selectedDutySummary.verifiedTeachingHours} hrs ({selectedDutySummary.totalDutyMinutes || 0}m)</span>
                    </div>

                    {selectedDutySummary.dailyBreakdown?.length === 0 ? (
                      <div className="p-4 text-center text-slate-400 italic">No daily teaching duty logs found for this period.</div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                        {selectedDutySummary.dailyBreakdown.map((day: any) => (
                          <div key={day.date} className="p-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-900">{day.date}</span>
                              {day.dayName && <span className="text-[10px] text-slate-500 uppercase">({day.dayName})</span>}
                              {day.isToday && (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold">Today</span>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-[11px]">
                              <span className="text-slate-600 font-medium">{day.completedLessons}/{day.totalScheduledLessons} classes</span>
                              <span className="font-mono font-bold text-emerald-700">{day.totalDutyHours} hrs ({day.totalDutyMinutes}m)</span>
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">✓ Zoom Verified</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Individual Verified Lessons Log */}
                  {selectedDutySummary.detailedLessons?.length > 0 && (
                    <details className="group">
                      <summary className="cursor-pointer text-[11px] font-semibold text-indigo-700 hover:underline flex items-center gap-1 select-none">
                        <span>View All {selectedDutySummary.detailedLessons.length} Detailed Zoom Session Logs</span>
                      </summary>
                      <div className="mt-2 bg-white rounded-lg border border-slate-200 overflow-hidden divide-y divide-slate-100 max-h-40 overflow-y-auto">
                        {selectedDutySummary.detailedLessons.map((les: any) => (
                          <div key={les.id} className="p-2 flex items-center justify-between text-[11px]">
                            <div>
                              <span className="font-bold text-slate-900">{les.className} - {les.subjectName}</span>
                              <div className="text-[10px] text-slate-500 font-mono">
                                {les.lessonDate} · {les.scheduledMinutes}m sched · Join: {les.actualJoinTime ? String(les.actualJoinTime).substring(11, 16) : 'N/A'} · Leave: {les.actualLeaveTime ? String(les.actualLeaveTime).substring(11, 16) : 'N/A'}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-mono font-bold text-emerald-700 block">{les.dutyMinutes || les.trackedMinutes || 0} mins ({les.dutyHours || les.trackedHours || 0} hrs)</span>
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">{les.verificationStatus || les.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-white rounded-lg border border-slate-200 text-slate-500 italic text-center">
                  Duty calculation for {selectedDraft.payrollMonth}: {selectedDraft.verifiedHours} hrs ({selectedDraft.completedLessons} completed lessons).
                </div>
              )}
            </div>

            {/* Adjustments Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">Authorized Salary Adjustments / Bonuses</span>
                {selectedDraft.status !== 'Approved' && selectedDraft.status !== 'Paid' && selectedDraft.status !== 'Rejected' ? (
                  <button
                    onClick={() => setIsAdjustmentModalOpen(true)}
                    className="text-amber-700 hover:underline flex items-center gap-1 text-[11px] font-medium"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Adjustment</span>
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>Adjustments locked ({selectedDraft.status})</span>
                  </span>
                )}
              </div>

              {selectedDraft.adjustments.length === 0 ? (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 italic text-center">
                  No manual additions or deductions applied.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {selectedDraft.adjustments.map((adj) => (
                    <div
                      key={adj.id}
                      className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between shadow-2xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-900">{adj.title}</span>
                        <div className="text-[10px] text-slate-500">{adj.reason} (Auth: {adj.authorizedBy})</div>
                      </div>
                      <span
                        className={`font-mono font-bold ${
                          adj.type === 'Addition' ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {adj.type === 'Addition' ? '+' : '-'}Rs. {adj.amount.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Net Amount Box */}
            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between font-mono">
              <span className="font-semibold text-emerald-900">Final Net Authorized Payable</span>
              <span className="text-xl font-bold text-emerald-700">
                Rs. {selectedDraft.netPayable.toLocaleString()}
              </span>
            </div>

            {/* Authorization Action Section */}
            {selectedDraft.status === 'Submitted for Approval' || selectedDraft.status === 'Draft' ? (
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Principal Review Remarks <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    value={reviewRemarks}
                    onChange={(e) => setReviewRemarks(e.target.value)}
                    rows={2}
                    placeholder="Enter review remarks for formal payroll audit..."
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleReviewDraft('Rejected')}
                    disabled={reviewSubmitting}
                    className="px-3.5 py-1.5 rounded-lg bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 font-medium transition-colors"
                  >
                    Reject Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReviewDraft('Returned for Correction')}
                    disabled={reviewSubmitting}
                    className="px-3.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-700 font-medium transition-colors"
                  >
                    Return for Correction
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReviewDraft('Approved')}
                    disabled={reviewSubmitting}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-xs transition-colors"
                  >
                    {reviewSubmitting ? 'Recording...' : 'Approve Salary Draft'}
                  </button>
                </div>
              </div>
            ) : selectedDraft.status === 'Approved' ? (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Approved Salary Slip</span>
                    <span className="font-mono text-slate-900 font-semibold">
                      Slip No: {selectedDraft.salarySlipNumber || 'SLIP-APPROVED'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      Approved by {selectedDraft.reviewedBy || 'Principal'} on {new Date(selectedDraft.reviewedAt || Date.now()).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => window.print()}
                      className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium flex items-center gap-1.5 shadow-2xs transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" strokeWidth={1.75} />
                      <span>Print Slip</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsDetailsModalOpen(false);
                        handleOpenSettleModal(selectedDraft);
                      }}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center gap-1.5 shadow-xs transition-colors"
                    >
                      <Banknote className="w-3.5 h-3.5" strokeWidth={1.75} />
                      <span>Disburse / Settle Payment</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : selectedDraft.status === 'Paid' ? (
              <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="text-emerald-800 font-semibold block text-[10px]">Payment Settled & Disbursed</span>
                  <span className="font-mono text-slate-900 font-semibold">
                    Slip No: {selectedDraft.salarySlipNumber || 'PAID-SLIP'}
                  </span>
                  <span className="text-[10px] text-slate-600 block">
                    Settled via {selectedDraft.paymentRecord?.paymentMethod || 'Bank Transfer'} · Ref: {selectedDraft.paymentRecord?.paymentReference || 'N/A'}
                  </span>
                </div>
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium flex items-center gap-1.5 shadow-2xs transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>Print Receipt</span>
                </button>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200">
                <span className="text-rose-800 font-semibold block text-[10px]">Status: {selectedDraft.status}</span>
                <span className="text-[11px] text-rose-700">Remarks: {selectedDraft.reviewRemarks || 'No remarks recorded.'}</span>
              </div>
            )}

            <div className="flex items-center justify-end pt-2 border-t border-slate-100 print:hidden">
              <button
                type="button"
                onClick={() => setIsDetailsModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <LetterheadFooter />
          </div>
        </Modal>
      )}

      {/* Manual Salary Adjustment Modal */}
      <Modal
        isOpen={isAdjustmentModalOpen}
        onClose={() => setIsAdjustmentModalOpen(false)}
        title="Apply Salary Adjustment / Bonus"
        description="Records an audit-logged addition or deduction to the teacher's monthly payroll draft."
      >
        <form onSubmit={handleAddAdjustmentSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-medium mb-1">Adjustment Type *</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAdjustmentType('Addition')}
                className={`p-2 rounded-lg border font-semibold transition-colors ${
                  adjustmentType === 'Addition'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                + Addition (Bonus / Extra Lesson)
              </button>
              <button
                type="button"
                onClick={() => setAdjustmentType('Deduction')}
                className={`p-2 rounded-lg border font-semibold transition-colors ${
                  adjustmentType === 'Deduction'
                    ? 'bg-rose-50 border-rose-300 text-rose-800'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                - Deduction (Penalty / Absence)
              </button>
            </div>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Adjustment Title *</label>
            <input
              type="text"
              required
              value={adjustmentTitle}
              onChange={(e) => setAdjustmentTitle(e.target.value)}
              placeholder="e.g. Science Fair Preparation Bonus"
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Amount (PKR) *</label>
            <input
              type="number"
              required
              min="1"
              value={adjustmentAmount}
              onChange={(e) => setAdjustmentAmount(Number(e.target.value))}
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Documented Justification / Reason *</label>
            <textarea
              required
              rows={2}
              value={adjustmentReason}
              onChange={(e) => setAdjustmentReason(e.target.value)}
              placeholder="State the administrative justification for this salary modification..."
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsAdjustmentModalOpen(false)}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={adjSubmitting}
              className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-xs"
            >
              {adjSubmitting ? 'Applying...' : 'Apply Adjustment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Atomic Salary Disbursement Settlement Modal */}
      <Modal
        isOpen={isSettleModalOpen}
        onClose={() => setIsSettleModalOpen(false)}
        title={`Disburse & Settle Salary · ${selectedDraft?.teacherName}`}
        description="Records an atomic payment settlement with double-payout prevention and audit ledger logging."
      >
        <form onSubmit={handleSettlePaymentSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-700 font-medium mb-1">Payment Method *</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as any)}
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800"
            >
              <option value="Bank Transfer">Bank Transfer (1LINK / Raast)</option>
              <option value="Direct Deposit">Direct Deposit</option>
              <option value="Cheque">Official School Cheque</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Payment Reference / Transaction ID *</label>
            <input
              type="text"
              required
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              placeholder="e.g. HBL-FT-8849201"
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-700 font-medium mb-1">Disbursed Amount (PKR) *</label>
            <input
              type="number"
              required
              min="1"
              value={paidAmount}
              onChange={(e) => setPaidAmount(Number(e.target.value))}
              className="w-full bg-white border border-slate-200 rounded-lg p-2 text-slate-800 font-mono text-sm font-semibold text-emerald-700"
            />
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-800 text-[11px] leading-relaxed">
            <strong>ACID Protection:</strong> This settlement runs inside an isolated database transaction with row-level pessimistic locking. Double disbursements and concurrent race conditions are strictly blocked.
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsSettleModalOpen(false)}
              className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={settleSubmitting}
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-xs"
            >
              {settleSubmitting ? 'Settling Payment...' : 'Confirm Disbursement'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
