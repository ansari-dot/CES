import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppDispatch } from '../store';
import { addToast } from '../store/slices/uiSlice';
import { requestApi } from '../services/api';
import { BrandLoader } from '../components/common/BrandLoader';

interface TermRow {
  id: number;
  session_id: number;
  name: string;
  start_date: string;
  end_date: string;
  exam_start_date: string | null;
  exam_end_date: string | null;
  is_final: number;
  status: string;
}

interface StatusItem {
  classId: number;
  subjectId: number;
  subjectName: string;
  subjectCode: string;
  examTotalMarks: number;
  hasExam: boolean;
  totalStudents: number;
  gradedStudents: number;
  missingStudents: number;
  submission: { status: string; submittedAt: string; note: string | null } | null;
}

interface ResultRow {
  id: number;
  studentName: string;
  admissionNo: string;
  rollNo: string;
  obtained_marks: number;
  total_marks: number;
  percentage: number | null;
  overall_grade: string | null;
  pass_status: string;
  result_status: string;
}

const PASS_COLORS: Record<string, string> = {
  PASSED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FAILED: 'bg-red-50 text-[#ba1a1a] border-red-200',
  SUPPLEMENTARY: 'bg-[#fff8e5] text-[#8a6400] border-[#ffe9b0]',
  PENDING: 'bg-[#f1f1fa] text-[#545454] border-[#c7c4d8]',
  ABSENT: 'bg-[#f1f1fa] text-[#545454] border-[#c7c4d8]'
};

export const ExamResultsPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const [session, setSession] = useState<any | null>(null);
  const [terms, setTerms] = useState<TermRow[]>([]);
  const [termId, setTermId] = useState<number | null>(null);
  const [items, setItems] = useState<StatusItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [classResults, setClassResults] = useState<ResultRow[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);

  // Load the active academic year and its terms.
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const sessions = await requestApi<any[]>('/api/v1/sessions');
        const current = (sessions || []).find((s) => s.is_current) || (sessions || [])[0];
        if (!current) {
          setError('No academic year is configured yet.');
          return;
        }
        setSession(current);
        const termRows = await requestApi<TermRow[]>(`/api/v1/sessions/${current.id}/terms`);
        setTerms(termRows || []);
        if (termRows && termRows.length > 0) {
          const preferred = termRows.find((t) => t.is_final) || termRows[termRows.length - 1];
          setTermId(preferred.id);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load the academic year');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadStatus = useCallback(async () => {
    if (!termId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await requestApi<{ items: StatusItem[] }>(`/api/v1/results/teacher-status?termId=${termId}`);
      setItems(data.items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load marks status');
    } finally {
      setLoading(false);
    }
  }, [termId]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const classIds = useMemo(() => Array.from(new Set(items.map((i) => i.classId))).sort((a, b) => a - b), [items]);

  useEffect(() => {
    if (classIds.length > 0 && (selectedClassId === null || !classIds.includes(selectedClassId))) {
      setSelectedClassId(classIds[0]);
    }
  }, [classIds, selectedClassId]);

  const loadClassResults = useCallback(async () => {
    if (!termId || !selectedClassId) return;
    try {
      setResultsLoading(true);
      const rows = await requestApi<ResultRow[]>(`/api/v1/results?termId=${termId}&classId=${selectedClassId}`);
      setClassResults(rows || []);
    } catch {
      setClassResults([]);
    } finally {
      setResultsLoading(false);
    }
  }, [termId, selectedClassId]);

  useEffect(() => {
    loadClassResults();
  }, [loadClassResults]);

  const submitMarks = async (item: StatusItem) => {
    if (!termId) return;
    const key = `${item.classId}-${item.subjectId}`;
    try {
      setSubmittingKey(key);
      await requestApi('/api/v1/results/submit-marks', {
        method: 'POST',
        body: JSON.stringify({ classId: item.classId, subjectId: item.subjectId, termId })
      });
      dispatch(
        addToast({
          title: 'Marks Submitted',
          message: `${item.subjectName} (Class ${item.classId}) marks were handed off for principal review.`,
          type: 'success'
        })
      );
      loadStatus();
    } catch (err: any) {
      dispatch(addToast({ title: 'Submission Failed', message: err.message || 'Could not submit marks.', type: 'error' }));
    } finally {
      setSubmittingKey(null);
    }
  };

  const term = terms.find((t) => t.id === termId) || null;
  const passCount = classResults.filter((r) => r.pass_status === 'PASSED').length;
  const failCount = classResults.filter((r) => r.pass_status === 'FAILED').length;
  const supplCount = classResults.filter((r) => r.pass_status === 'SUPPLEMENTARY').length;

  return (
    <div className="flex flex-col w-full pb-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <span className="text-[11px] uppercase tracking-wider text-[#36348e] font-bold">Examinations</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#292929] tracking-tight">Exam Results & Marks Submission</h1>
          <p className="text-xs text-[#545454] mt-1">
            {session ? `Academic Year ${session.name}` : ''}
            {term ? ` · ${term.name}` : ''} · Enter exam marks via Tasks (type: Examination), then submit each subject for review.
          </p>
        </div>
        {terms.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#545454] uppercase tracking-wider">Term</span>
            <select
              value={termId ?? ''}
              onChange={(e) => setTermId(Number(e.target.value))}
              className="px-3 py-1.5 rounded-lg border border-[#c7c4d8] bg-white text-xs font-semibold text-[#292929] focus:outline-none focus:ring-2 focus:ring-[#36348e]/20"
            >
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.is_final ? '· Final' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white p-8 rounded-2xl shadow-xs border border-slate-100 flex items-center justify-center">
          <BrandLoader message="Loading examination status..." size="sm" />
        </div>
      ) : error ? (
        <div className="bg-white p-10 rounded-2xl shadow-xs border border-slate-100 text-center">
          <p className="text-sm text-[#ba1a1a] font-semibold">{error}</p>
          <button
            onClick={loadStatus}
            className="mt-3 px-4 py-2 rounded-lg bg-[#36348e] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white text-xs font-bold transition-colors"
          >
            Retry
          </button>
        </div>
      ) : terms.length === 0 ? (
        <div className="bg-white p-10 rounded-2xl shadow-xs border border-slate-100 text-center text-sm text-[#545454]">
          The school has not defined terms for the current academic year yet. Marks submission opens once the principal
          configures terms and examination periods.
        </div>
      ) : (
        <>
          {/* Marks hand-off per assigned class & subject */}
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-100 mb-6">
            <h2 className="text-sm font-bold text-[#292929] mb-1">My Marks Submission Status</h2>
            <p className="text-[11px] text-[#545454] mb-4">
              Grade every student's examination (Submissions & Grading → bulk marks entry), then submit the subject. Missing
              marks are counted automatically.
            </p>
            {items.length === 0 ? (
              <p className="text-xs text-[#545454]">No class-subject assignments found for your account.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-[#292929]">
                  <thead className="text-[#545454] font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="px-3 py-2">Class</th>
                      <th className="px-3 py-2">Subject</th>
                      <th className="px-3 py-2 text-right">Exam Marks Pool</th>
                      <th className="px-3 py-2 text-right">Graded / Students</th>
                      <th className="px-3 py-2 text-right">Missing</th>
                      <th className="px-3 py-2">Hand-off</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => {
                      const key = `${item.classId}-${item.subjectId}`;
                      return (
                        <tr key={key} className="hover:bg-[#f9f9fc]">
                          <td className="px-3 py-2.5 font-bold">Class {item.classId}</td>
                          <td className="px-3 py-2.5">
                            {item.subjectName} <span className="text-[#777587] font-mono text-[10px]">{item.subjectCode}</span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono">
                            {item.hasExam ? item.examTotalMarks : <span className="text-[#8a6400] font-semibold">No exam yet</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono">
                            {item.gradedStudents} / {item.totalStudents}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono">
                            {item.missingStudents > 0 ? (
                              <span className="text-[#ba1a1a] font-bold">{item.missingStudents}</span>
                            ) : (
                              <span className="text-emerald-700">0</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            {item.submission ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                                <span className="material-symbols-outlined text-[13px]">check_circle</span>
                                Submitted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border bg-[#f1f1fa] text-[#545454] border-[#c7c4d8] text-[10px] font-bold">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <button
                              onClick={() => submitMarks(item)}
                              disabled={submittingKey === key || !item.hasExam}
                              className="px-3 py-1.5 rounded-lg bg-[#36348e] hover:bg-[#ffc53a] hover:text-[#1b1a47] disabled:opacity-40 text-white text-[11px] font-bold transition-colors"
                              title={!item.hasExam ? 'Create an Examination task for this subject first' : 'Submit marks for principal review'}
                            >
                              {submittingKey === key ? 'Submitting…' : item.submission ? 'Re-submit' : 'Submit for Review'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Class result preview */}
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-bold text-[#292929]">Class Result Preview</h2>
                <p className="text-[11px] text-[#545454]">
                  Computed term results of your classes (read-only — approval and publication are done by the principal).
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {classIds.map((cid) => (
                  <button
                    key={cid}
                    onClick={() => setSelectedClassId(cid)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                      selectedClassId === cid
                        ? 'bg-[#ffc53a] text-[#1b1a47] shadow-xs'
                        : 'bg-[#f1f1fa] text-[#545454] hover:bg-[#ffedc2]'
                    }`}
                  >
                    Class {cid}
                  </button>
                ))}
              </div>
            </div>

            {resultsLoading ? (
              <div className="py-8 flex items-center justify-center">
                <BrandLoader message="Loading class results..." size="sm" />
              </div>
            ) : classResults.length === 0 ? (
              <p className="text-xs text-[#545454] py-6 text-center">
                No computed results for this class and term yet. Results appear once the principal runs computation.
              </p>
            ) : (
              <>
                <div className="flex items-center gap-4 mb-3 text-[11px] font-bold">
                  <span className="text-emerald-700">Passed: {passCount}</span>
                  <span className="text-[#ba1a1a]">Failed: {failCount}</span>
                  <span className="text-[#8a6400]">Supplementary: {supplCount}</span>
                  <span className="text-[#545454]">Total: {classResults.length}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-[#292929]">
                    <thead className="text-[#545454] font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="px-3 py-2">Student</th>
                        <th className="px-3 py-2 text-right">Marks</th>
                        <th className="px-3 py-2 text-right">%</th>
                        <th className="px-3 py-2">Grade</th>
                        <th className="px-3 py-2">Outcome</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {classResults.map((r) => (
                        <tr key={r.id} className="hover:bg-[#f9f9fc]">
                          <td className="px-3 py-2.5">
                            <span className="font-bold">{r.studentName}</span>{' '}
                            <span className="text-[#777587] font-mono text-[10px]">{r.admissionNo}</span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono">
                            {Number(r.obtained_marks).toFixed(0)} / {Number(r.total_marks).toFixed(0)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono">
                            {r.percentage != null ? `${Number(r.percentage).toFixed(1)}%` : '—'}
                          </td>
                          <td className="px-3 py-2.5 font-bold">{r.overall_grade || '—'}</td>
                          <td className="px-3 py-2.5">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                                PASS_COLORS[r.pass_status] || PASS_COLORS.PENDING
                              }`}
                            >
                              {r.pass_status.charAt(0) + r.pass_status.slice(1).toLowerCase()}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-[10px] font-bold text-[#545454]">{r.result_status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};
