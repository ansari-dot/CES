import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { LoadingState, EmptyState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import {
  FileText,
  Calendar,
  CheckCircle,
  Clock,
  AlertCircle,
  PlusCircle,
  Send,
  Printer,
  History,
  ShieldCheck,
  RotateCcw,
  Sparkles
} from 'lucide-react';

interface SupplementaryExamsTabProps {
  year: { id: number; name: string; status: string };
}

export const SupplementaryExamsTab: React.FC<SupplementaryExamsTabProps> = ({ year }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [failedSubjects, setFailedSubjects] = useState<any[]>([]);
  const [supplementaryList, setSupplementaryList] = useState<any[]>([]);
  const [dateSheetEntries, setDateSheetEntries] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [classes, setClasses] = useState<any[]>([]);

  // Modals state
  const [scheduleModal, setScheduleModal] = useState<{ open: boolean; record: any | null }>({ open: false, record: null });
  const [scheduleMode, setScheduleMode] = useState<'MODE_A' | 'MODE_B'>('MODE_A');
  const [selectedDateSheetEntryId, setSelectedDateSheetEntryId] = useState<number | null>(null);
  const [examDate, setExamDate] = useState<string>('');

  const [marksModal, setMarksModal] = useState<{ open: boolean; record: any | null }>({ open: false, record: null });
  const [obtainedMarks, setObtainedMarks] = useState<string>('');
  const [isAbsent, setIsAbsent] = useState<boolean>(false);
  const [marksRemarks, setMarksRemarks] = useState<string>('');

  const [correctionModal, setCorrectionModal] = useState<{ open: boolean; record: any | null }>({ open: false, record: null });
  const [correctionReason, setCorrectionReason] = useState<string>('');
  const [correctionMarks, setCorrectionMarks] = useState<string>('');
  const [correctionAbsent, setCorrectionAbsent] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [failed, supp, clsList, dsList] = await Promise.all([
        api.listFailedTerminalSubjects({ sessionId: year.id }).catch(() => []),
        api.listSupplementaryExams({ sessionId: year.id }).catch(() => ({ data: [] })),
        api.getClasses().catch(() => []),
        api.getDateSheetEntries ? api.getDateSheetEntries().catch(() => []) : []
      ]);
      setFailedSubjects(Array.isArray(failed) ? failed : []);
      setSupplementaryList(Array.isArray(supp?.data) ? supp.data : Array.isArray(supp) ? supp : []);
      setClasses(clsList || []);
      setDateSheetEntries(Array.isArray(dsList) ? dsList : []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load supplementary exams data');
    } finally {
      setLoading(false);
    }
  }, [year.id, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInitialize = async (finalResultSubjectId: number) => {
    try {
      setActionLoading(true);
      await api.initializeSupplementaryExam(finalResultSubjectId);
      toast.success('Supplementary examination initialized for candidate');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Initialization failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleScheduleSubmit = async () => {
    if (!scheduleModal.record) return;
    try {
      setActionLoading(true);
      await api.scheduleSupplementaryExam(scheduleModal.record.id, {
        mode: scheduleMode,
        dateSheetEntryId: scheduleMode === 'MODE_A' ? selectedDateSheetEntryId || undefined : undefined,
        examDate: examDate || undefined
      });
      toast.success('Supplementary examination scheduled successfully');
      setScheduleModal({ open: false, record: null });
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Scheduling failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarksSubmit = async () => {
    if (!marksModal.record) return;
    try {
      setActionLoading(true);
      await api.recordSupplementaryMarks(marksModal.record.id, {
        obtainedMarks: isAbsent ? null : Number(obtainedMarks),
        isAbsent,
        remarks: marksRemarks
      });
      toast.success('Supplementary marks recorded in draft');
      setMarksModal({ open: false, record: null });
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Marks recording failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitForApproval = async (id: number) => {
    try {
      setActionLoading(true);
      await api.submitSupplementaryMarks(id);
      toast.success('Marks submitted for Principal approval');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Submission failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      setActionLoading(true);
      await api.approveSupplementaryResult(id);
      toast.success('Supplementary result approved');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublish = async (id: number) => {
    try {
      setActionLoading(true);
      await api.publishSupplementaryResult(id);
      toast.success('Supplementary result officially published and made authoritative for promotion');
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Publication failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCorrectionSubmit = async () => {
    if (!correctionModal.record) return;
    try {
      setActionLoading(true);
      await api.issueSupplementaryCorrection(correctionModal.record.id, {
        correctionReason,
        obtainedMarks: correctionAbsent ? null : Number(correctionMarks),
        isAbsent: correctionAbsent
      });
      toast.success('Auditable correction published. Prior version superseded.');
      setCorrectionModal({ open: false, record: null });
      await loadData();
    } catch (err: any) {
      toast.error(err.message || 'Correction failed');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredFailed = failedSubjects.filter(
    (f) => selectedClassId === 'all' || String(f.class_id) === selectedClassId
  );

  const filteredSupp = supplementaryList.filter(
    (s) => selectedClassId === 'all' || String(s.class_id) === selectedClassId
  );

  if (loading) {
    return <LoadingState message="Loading supplementary examinations and re-sit ledger..." />;
  }

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[11px] font-semibold tracking-wide uppercase mb-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              Authoritative Secondary Ledger
            </div>
            <h2 className="text-xl font-bold tracking-tight">Supplementary Examination Ledger</h2>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Official re-sit administration for candidates who failed subjects in Terminal Examinations. 
              Supplementary outcomes are independently tracked, require Principal publication authority, 
              and clear promotion eligibility without mutating original Terminal Exam marks cards.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="bg-slate-800/90 border border-slate-700 text-white text-xs rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="all">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* SECTION 1: Active Supplementary Examinations */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Supplementary Examination Attempts</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Live lifecycle: Scheduling → Marks Entry → Principal Approval → Publication
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
            {filteredSupp.length} Registered
          </span>
        </div>

        {filteredSupp.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No supplementary records found"
              description="Candidates with failed Terminal Exam subjects will appear in the candidate list below for initialization."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Student & Class</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Attempt / Ver</th>
                  <th className="px-4 py-3">Exam Date</th>
                  <th className="px-4 py-3">Marks Awarded</th>
                  <th className="px-4 py-3">Outcome</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSupp.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{s.student_name}</div>
                      <div className="text-[11px] text-slate-400">
                        {s.class_name} · Adm: {s.admission_no || 'N/A'}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {s.subject_name}
                      <span className="ml-1 text-[10px] text-slate-400">({s.subject_code})</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px]">
                      Attempt {s.attempt_number} · v{s.correction_version}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px]">
                      {s.exam_date ? String(s.exam_date).split('T')[0] : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {s.is_absent ? (
                        <span className="text-rose-600 font-semibold">ABSENT</span>
                      ) : s.obtained_marks !== null ? (
                        `${s.obtained_marks} / ${s.max_marks}`
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {s.status === 'PUBLISHED' ? (
                        s.is_passed ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                            <CheckCircle className="w-3 h-3" /> CLEARED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[11px] font-bold">
                            FAILED
                          </span>
                        )
                      ) : (
                        <span className="text-slate-400 italic">Pending Pub</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {s.status === 'AWAITING_SCHEDULE' && (
                          <button
                            onClick={() => {
                              setScheduleModal({ open: true, record: s });
                              setExamDate('');
                              setSelectedDateSheetEntryId(null);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-[11px] font-semibold flex items-center gap-1"
                          >
                            <Calendar className="w-3 h-3" /> Schedule
                          </button>
                        )}

                        {['SCHEDULED', 'DRAFT'].includes(s.status) && (
                          <button
                            onClick={() => {
                              setMarksModal({ open: true, record: s });
                              setObtainedMarks(s.obtained_marks !== null ? String(s.obtained_marks) : '');
                              setIsAbsent(Boolean(s.is_absent));
                              setMarksRemarks(s.remarks || '');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 text-[11px] font-semibold flex items-center gap-1"
                          >
                            <FileText className="w-3 h-3" /> Enter Marks
                          </button>
                        )}

                        {s.status === 'DRAFT' && (
                          <button
                            onClick={() => handleSubmitForApproval(s.id)}
                            disabled={actionLoading}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-[11px] font-semibold flex items-center gap-1"
                          >
                            <Send className="w-3 h-3" /> Submit
                          </button>
                        )}

                        {s.status === 'SUBMITTED' && (
                          <button
                            onClick={() => handleApprove(s.id)}
                            disabled={actionLoading}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-semibold flex items-center gap-1"
                          >
                            <CheckCircle className="w-3 h-3" /> Approve
                          </button>
                        )}

                        {s.status === 'APPROVED' && (
                          <button
                            onClick={() => handlePublish(s.id)}
                            disabled={actionLoading}
                            className="px-3 py-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 text-[11px] font-bold flex items-center gap-1 shadow-xs"
                          >
                            <Sparkles className="w-3 h-3" /> Publish Result
                          </button>
                        )}

                        {s.status === 'PUBLISHED' && (
                          <button
                            onClick={() => {
                              setCorrectionModal({ open: true, record: s });
                              setCorrectionMarks(String(s.obtained_marks || ''));
                              setCorrectionAbsent(Boolean(s.is_absent));
                              setCorrectionReason('');
                            }}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-[11px] font-medium flex items-center gap-1"
                            title="Issue an auditable correction"
                          >
                            <RotateCcw className="w-3 h-3 text-amber-600" /> Correction
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 2: Failed Terminal Subjects Eligible for Re-sit */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Eligible Terminal Exam Failure Candidates</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Derived from published Terminal Exam results with passed = 0
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700">
            {filteredFailed.length} Subject Failures
          </span>
        </div>

        {filteredFailed.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No pending subject failures"
              description="All students in the selected class have passed their Terminal Examination subjects, or results have not yet been published."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3">Student & Roll No</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Failed Subject</th>
                  <th className="px-4 py-3">Terminal Marks</th>
                  <th className="px-4 py-3">Grade</th>
                  <th className="px-4 py-3">Supplementary State</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFailed.map((f) => (
                  <tr key={f.final_result_subject_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{f.student_name}</div>
                      <div className="text-[11px] text-slate-400">Adm: {f.admission_no || 'N/A'}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{f.class_name}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {f.subject_name}
                      <span className="ml-1 text-[10px] text-slate-400">({f.subject_code})</span>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {f.original_is_absent ? (
                        <span className="text-rose-600 font-semibold">ABSENT</span>
                      ) : (
                        `${f.original_obtained_marks} / ${f.original_max_marks}`
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-rose-600">
                      {f.original_grade || 'F'}
                    </td>
                    <td className="px-4 py-3">
                      {f.active_supplementary_id ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-semibold">
                          <CheckCircle className="w-3 h-3" /> Initialized ({f.supplementary_status})
                        </span>
                      ) : (
                        <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full text-[11px] font-medium">
                          Awaiting Initialization
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!f.active_supplementary_id && (
                        <button
                          onClick={() => handleInitialize(f.final_result_subject_id)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1 ml-auto shadow-xs"
                        >
                          <PlusCircle className="w-3.5 h-3.5" /> Initialize Exam
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SCHEDULE MODAL */}
      {scheduleModal.open && (
        <Modal
          title="Schedule Supplementary Examination"
          onClose={() => setScheduleModal({ open: false, record: null })}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Candidate Details</label>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div className="font-bold text-slate-900">{scheduleModal.record?.student_name}</div>
                <div className="text-slate-500">
                  {scheduleModal.record?.class_name} · Subject: {scheduleModal.record?.subject_name}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Scheduling Route</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setScheduleMode('MODE_A')}
                  className={`p-3 rounded-xl border text-xs font-semibold text-left transition-all ${
                    scheduleMode === 'MODE_A'
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="font-bold mb-0.5">Mode A: Date Sheet</div>
                  <div className="text-[11px] text-slate-500 font-normal">Official supplementary exam timetable entry</div>
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleMode('MODE_B')}
                  className={`p-3 rounded-xl border text-xs font-semibold text-left transition-all ${
                    scheduleMode === 'MODE_B'
                      ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="font-bold mb-0.5">Mode B: Direct Schedule</div>
                  <div className="text-[11px] text-slate-500 font-normal">Classroom/invigilator direct exam date</div>
                </button>
              </div>
            </div>

            {scheduleMode === 'MODE_A' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date Sheet Entry</label>
                <select
                  value={selectedDateSheetEntryId || ''}
                  onChange={(e) => setSelectedDateSheetEntryId(Number(e.target.value) || null)}
                  className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select Official Date Sheet Entry...</option>
                  {dateSheetEntries.map((ds) => (
                    <option key={ds.id} value={ds.id}>
                      {ds.subject_name || 'Subject'} · {String(ds.exam_date).split('T')[0]} ({ds.start_time} - {ds.end_time})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Examination Date</label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setScheduleModal({ open: false, record: null })}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleScheduleSubmit}
                disabled={actionLoading || !examDate}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shadow-xs"
              >
                Confirm Schedule
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* MARKS ENTRY MODAL */}
      {marksModal.open && (
        <Modal
          title="Record Supplementary Examination Marks"
          onClose={() => setMarksModal({ open: false, record: null })}
        >
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div className="font-bold text-slate-900">{marksModal.record?.student_name}</div>
              <div className="text-slate-500">
                Subject: {marksModal.record?.subject_name} · Maximum Marks: {marksModal.record?.max_marks}
              </div>
            </div>

            <div className="flex items-center gap-2 p-3 bg-amber-50/50 rounded-xl border border-amber-200/60">
              <input
                type="checkbox"
                id="isAbsentCheck"
                checked={isAbsent}
                onChange={(e) => setIsAbsent(e.target.checked)}
                className="w-4 h-4 text-amber-600 rounded-sm"
              />
              <label htmlFor="isAbsentCheck" className="text-xs font-semibold text-amber-900 cursor-pointer">
                Candidate was absent for this supplementary examination
              </label>
            </div>

            {!isAbsent && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Obtained Marks (out of {marksModal.record?.max_marks})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={marksModal.record?.max_marks}
                  value={obtainedMarks}
                  onChange={(e) => setObtainedMarks(e.target.value)}
                  placeholder="e.g. 65"
                  className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Invigilator / Examiner Remarks</label>
              <textarea
                value={marksRemarks}
                onChange={(e) => setMarksRemarks(e.target.value)}
                rows={2}
                placeholder="Optional notes or remarks on re-sit performance..."
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setMarksModal({ open: false, record: null })}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleMarksSubmit}
                disabled={actionLoading || (!isAbsent && !obtainedMarks)}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold shadow-xs"
              >
                Save Marks in Draft
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* AUDITABLE CORRECTION MODAL */}
      {correctionModal.open && (
        <Modal
          title="Issue Auditable Correction (Published Result)"
          onClose={() => setCorrectionModal({ open: false, record: null })}
        >
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 leading-relaxed">
              <strong>Database Immutability Enforcement:</strong> Published supplementary results cannot be modified in-place.
              Issuing a correction increments the version number, creates an immutable audit trail, and marks the prior published version as superseded.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Correction Justification & Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                rows={3}
                placeholder="State the formal scrutiny or re-checking reason for this correction (min 10 characters)..."
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <input
                type="checkbox"
                id="corrAbsentCheck"
                checked={correctionAbsent}
                onChange={(e) => setCorrectionAbsent(e.target.checked)}
                className="w-4 h-4 text-amber-600 rounded-sm"
              />
              <label htmlFor="corrAbsentCheck" className="text-xs font-semibold text-slate-700 cursor-pointer">
                Candidate was absent
              </label>
            </div>

            {!correctionAbsent && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Corrected Obtained Marks (out of {correctionModal.record?.max_marks})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={correctionModal.record?.max_marks}
                  value={correctionMarks}
                  onChange={(e) => setCorrectionMarks(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCorrectionModal({ open: false, record: null })}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCorrectionSubmit}
                disabled={actionLoading || correctionReason.trim().length < 10}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold shadow-xs flex items-center gap-1.5"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Publish Correction
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

