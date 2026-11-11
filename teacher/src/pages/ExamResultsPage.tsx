import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppDispatch } from '../store';
import { addToast } from '../store/slices/uiSlice';
import { requestApi } from '../services/api';
import { BrandLoader } from '../components/common/BrandLoader';
import { ExamMarksEntryModal } from '../components/exams/ExamMarksEntryModal';
import { Pagination } from '../components/common/Pagination';
import {
  Award,
  Layers,
  CheckCircle2,
  AlertCircle,
  FileEdit,
  Send,
  RotateCw,
  Users,
  Search,
  Filter,
  GraduationCap,
  BookOpen,
  Calendar,
  Sparkles,
  TrendingUp,
  Clock
} from 'lucide-react';

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
  FAILED: 'bg-rose-50 text-rose-700 border-rose-200',
  SUPPLEMENTARY: 'bg-amber-50 text-amber-800 border-amber-200',
  PENDING: 'bg-slate-50 text-slate-600 border-slate-200',
  ABSENT: 'bg-slate-50 text-slate-600 border-slate-200'
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
  const [searchQuery, setSearchQuery] = useState('');
  const [marksEntryModal, setMarksEntryModal] = useState<{
    open: boolean;
    classId: number | null;
    subjectId: number | null;
    subjectName: string;
  }>({
    open: false,
    classId: null,
    subjectId: null,
    subjectName: ''
  });

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

  // Aggregate Metrics
  const totalSubjects = items.length;
  const totalStudentsCount = items.reduce((acc, i) => acc + i.totalStudents, 0);
  const gradedStudentsCount = items.reduce((acc, i) => acc + i.gradedStudents, 0);
  const missingStudentsCount = items.reduce((acc, i) => acc + i.missingStudents, 0);
  const submittedItemsCount = items.filter((i) => Boolean(i.submission)).length;
  const overallProgressRate = totalStudentsCount > 0 ? Math.round((gradedStudentsCount / totalStudentsCount) * 100) : 100;

  // Class Results Filtered
  const [resultsPage, setResultsPage] = useState(1);
  const [resultsLimit, setResultsLimit] = useState(10);

  useEffect(() => {
    setResultsPage(1);
  }, [selectedClassId, searchQuery]);

  const filteredClassResults = useMemo(() => {
    if (!searchQuery.trim()) return classResults;
    const q = searchQuery.toLowerCase().trim();
    return classResults.filter((r) =>
      r.studentName.toLowerCase().includes(q) ||
      r.admissionNo.toLowerCase().includes(q) ||
      (r.rollNo && r.rollNo.toLowerCase().includes(q))
    );
  }, [classResults, searchQuery]);

  const totalResultsPages = Math.ceil(filteredClassResults.length / resultsLimit) || 1;
  const paginatedClassResults = useMemo(() => {
    const start = (resultsPage - 1) * resultsLimit;
    return filteredClassResults.slice(start, start + resultsLimit);
  }, [filteredClassResults, resultsPage, resultsLimit]);

  const passCount = classResults.filter((r) => r.pass_status === 'PASSED').length;
  const failCount = classResults.filter((r) => r.pass_status === 'FAILED').length;
  const supplCount = classResults.filter((r) => r.pass_status === 'SUPPLEMENTARY').length;

  return (
    <div className="flex flex-col w-full pb-12 space-y-5 animate-in fade-in duration-150">
      {/* ------------------------------------------------------------- */}
      {/* 1. HERO HEADER BANNER */}
      {/* ------------------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#36348e] text-white flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
              <Award className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  Examinations &amp; Grading
                </span>
                {session && (
                  <span className="text-[11px] font-extrabold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                    Session: {session.name}
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#1e1b4b] tracking-tight mt-1">
                Exam Results &amp; Marks Hand-off
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Record student marks across assigned subjects and hand off completed batches for principal verification.
              </p>
            </div>
          </div>

          {/* Term Selector & Refresh */}
          <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
            {terms.length > 0 && (
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-2xs">
                <Calendar className="w-3.5 h-3.5 text-indigo-700" />
                <span className="text-xs font-bold text-slate-600">Term:</span>
                <select
                  value={termId ?? ''}
                  onChange={(e) => setTermId(Number(e.target.value))}
                  className="bg-transparent text-xs font-bold text-[#1e1b4b] focus:outline-none cursor-pointer"
                >
                  {terms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.is_final ? '· Final' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={loadStatus}
              disabled={loading}
              className="p-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 rounded-xl transition shadow-2xs cursor-pointer"
              title="Refresh examination status"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. TOP 4 WAVE KPI CARDS */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Assigned Subjects */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-blue-100/80 hover:border-blue-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Layers className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-blue-50 text-blue-700 border-blue-100">
              <span>{classIds.length} Classes</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
              {totalSubjects}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Assigned Exam Subjects
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(59, 130, 246, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Card 2: Graded Students */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-emerald-100/80 hover:border-emerald-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-emerald-50 text-emerald-700 border-emerald-100">
              <span>{overallProgressRate}% Complete</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight leading-tight">
              {gradedStudentsCount} <span className="text-sm font-semibold text-slate-400">/ {totalStudentsCount}</span>
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Students Graded
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(16, 185, 129, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#10b981" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Card 3: Missing Marks */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-rose-100/80 hover:border-rose-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white shadow-sm shadow-rose-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <AlertCircle className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border ${missingStudentsCount > 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
              <span>{missingStudentsCount > 0 ? 'Action Required' : 'All Clear'}</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-rose-700 tracking-tight leading-tight">
              {missingStudentsCount}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Missing Marks Unrecorded
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(244, 63, 94, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Card 4: Hand-Off Submissions */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-amber-100/80 hover:border-amber-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Send className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-amber-50 text-amber-800 border-amber-200">
              <span>Review Status</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-amber-900 tracking-tight leading-tight">
              {submittedItemsCount} <span className="text-sm font-semibold text-slate-400">/ {totalSubjects}</span>
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Handed Off for Review
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

      {loading ? (
        <div className="bg-white p-12 rounded-2xl shadow-xs border border-slate-200/80 flex items-center justify-center">
          <BrandLoader message="Loading examination status..." size="sm" />
        </div>
      ) : error ? (
        <div className="bg-white p-10 rounded-2xl shadow-xs border border-slate-200/80 text-center">
          <AlertCircle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <p className="text-sm text-rose-700 font-bold">{error}</p>
          <button
            onClick={loadStatus}
            className="mt-3 px-4 py-2 rounded-xl bg-[#36348e] hover:bg-[#2c2a75] text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            Retry Loading
          </button>
        </div>
      ) : terms.length === 0 ? (
        <div className="bg-white p-10 rounded-2xl shadow-xs border border-slate-200/80 text-center text-sm text-slate-500">
          The school has not defined terms for the current academic year yet. Marks submission opens once the principal
          configures terms and examination periods.
        </div>
      ) : (
        <>
          {/* ------------------------------------------------------------- */}
          {/* 3. MY MARKS SUBMISSION STATUS CARD */}
          {/* ------------------------------------------------------------- */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 text-[#36348e] flex items-center justify-center shrink-0">
                  <FileEdit className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-[#1e1b4b]">
                    Marks Submission Register
                  </h2>
                  <p className="text-xs text-slate-500">
                    Enter examination scores for students and hand off completed batches to academic operations
                  </p>
                </div>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <Users className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-slate-700 text-xs">No class-subject assignments found for your account.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200/70 h-11 select-none text-[11px]">
                      <th className="px-5 py-2 min-w-[120px]">Class</th>
                      <th className="px-5 py-2 min-w-[180px]">Subject</th>
                      <th className="px-5 py-2 text-right w-32">Total Marks</th>
                      <th className="px-5 py-2 text-right w-40">Graded Progress</th>
                      <th className="px-5 py-2 text-center w-28">Missing</th>
                      <th className="px-5 py-2 text-center w-36">Hand-off Status</th>
                      <th className="px-5 py-2 text-right min-w-[180px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => {
                      const key = `${item.classId}-${item.subjectId}`;
                      const isHandedOff = Boolean(item.submission);

                      return (
                        <tr key={key} className="hover:bg-slate-50/80 h-14 transition-colors">
                          <td className="px-5 py-2 font-bold text-slate-900">
                            Class {item.classId}
                          </td>
                          <td className="px-5 py-2">
                            <span className="font-bold text-slate-900 block">{item.subjectName}</span>
                            <span className="text-[11px] font-mono text-slate-400">{item.subjectCode}</span>
                          </td>
                          <td className="px-5 py-2 text-right font-mono font-bold text-slate-700">
                            {item.hasExam ? (
                              <span>{item.examTotalMarks} pts</span>
                            ) : (
                              <span className="text-amber-700 font-semibold text-xs">Pending paper</span>
                            )}
                          </td>
                          <td className="px-5 py-2 text-right">
                            <div className="flex flex-col items-end">
                              <span className="font-mono font-bold text-slate-800 text-xs">
                                {item.gradedStudents} / {item.totalStudents}
                              </span>
                              <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                                <div
                                  className="h-full bg-emerald-600 rounded-full transition-all"
                                  style={{
                                    width: `${item.totalStudents > 0 ? (item.gradedStudents / item.totalStudents) * 100 : 0}%`
                                  }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-2 text-center">
                            {item.missingStudents > 0 ? (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                {item.missingStudents} missing
                              </span>
                            ) : (
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Complete
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-2 text-center">
                            {isHandedOff ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Submitted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border bg-amber-50 text-amber-800 border-amber-200 text-xs font-bold">
                                <Clock className="w-3.5 h-3.5" />
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setMarksEntryModal({
                                    open: true,
                                    classId: item.classId,
                                    subjectId: item.subjectId,
                                    subjectName: item.subjectName
                                  })
                                }
                                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-[#36348e] text-xs font-bold transition-all shadow-2xs flex items-center gap-1 cursor-pointer active:scale-[0.98]"
                              >
                                <FileEdit className="w-3.5 h-3.5" />
                                <span>Enter Marks</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => submitMarks(item)}
                                disabled={submittingKey === key || !item.hasExam}
                                className="px-3 py-1.5 rounded-xl bg-[#36348e] hover:bg-[#2c2a75] disabled:opacity-40 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer active:scale-[0.98]"
                                title={!item.hasExam ? 'Enter marks first or configure exam paper' : 'Submit marks for principal review'}
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>{submittingKey === key ? 'Submitting…' : isHandedOff ? 'Re-submit' : 'Submit'}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ------------------------------------------------------------- */}
          {/* 4. CLASS RESULT PREVIEW CARD */}
          {/* ------------------------------------------------------------- */}
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-[#36348e] flex items-center justify-center shrink-0">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <h2 className="text-sm sm:text-base font-extrabold text-[#1e1b4b]">
                    Class Result Preview
                  </h2>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 ml-10">
                  Computed term evaluations (formal publication signed off by administration)
                </p>
              </div>

              {/* Class Tabs & Search */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[180px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search student or roll #..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all placeholder:text-slate-400"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  {classIds.map((cid) => (
                    <button
                      key={cid}
                      type="button"
                      onClick={() => setSelectedClassId(cid)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        selectedClassId === cid
                          ? 'bg-[#36348e] text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      Class {cid}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {resultsLoading ? (
              <div className="py-12 flex items-center justify-center">
                <BrandLoader message="Loading class results..." size="sm" />
              </div>
            ) : classResults.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Award className="w-9 h-9 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-slate-700 text-xs">No computed results for Class {selectedClassId} in this term yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Results appear once administration executes mark consolidation.</p>
              </div>
            ) : (
              <>
                {/* Result Summary Bar */}
                <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center gap-4 flex-wrap text-xs font-bold">
                  <span className="text-emerald-700 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
                    Passed: {passCount}
                  </span>
                  <span className="text-rose-700 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600 inline-block"></span>
                    Failed: {failCount}
                  </span>
                  <span className="text-amber-800 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                    Supplementary: {supplCount}
                  </span>
                  <span className="text-slate-500 font-medium ml-auto">
                    Total Enrolled: {classResults.length}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200/70 h-11 select-none text-[11px]">
                        <th className="px-5 py-2 min-w-[200px]">Student Details</th>
                        <th className="px-5 py-2 text-right w-28">Obtained Marks</th>
                        <th className="px-5 py-2 text-right w-24">Percentage</th>
                        <th className="px-5 py-2 text-center w-24">Overall Grade</th>
                        <th className="px-5 py-2 text-center w-32">Academic Outcome</th>
                        <th className="px-5 py-2 text-center w-28">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {paginatedClassResults.map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/80 h-14 transition-colors">
                          <td className="px-5 py-2">
                            <span className="font-bold text-slate-900 block">{r.studentName}</span>
                            <span className="text-[11px] font-mono text-slate-400">
                              {r.admissionNo} {r.rollNo ? `· Roll #${r.rollNo}` : ''}
                            </span>
                          </td>
                          <td className="px-5 py-2 text-right font-mono font-bold text-slate-800">
                            {Number(r.obtained_marks).toFixed(0)} <span className="text-slate-400 font-normal">/ {Number(r.total_marks).toFixed(0)}</span>
                          </td>
                          <td className="px-5 py-2 text-right font-mono font-bold text-slate-900">
                            {r.percentage != null ? `${Number(r.percentage).toFixed(1)}%` : '—'}
                          </td>
                          <td className="px-5 py-2 text-center">
                            <span className="inline-block px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-extrabold text-xs border border-indigo-200">
                              {r.overall_grade || '—'}
                            </span>
                          </td>
                          <td className="px-5 py-2 text-center">
                            <span
                              className={`inline-flex px-2.5 py-0.5 rounded-full border text-xs font-bold ${
                                PASS_COLORS[r.pass_status] || PASS_COLORS.PENDING
                              }`}
                            >
                              {r.pass_status.charAt(0) + r.pass_status.slice(1).toLowerCase()}
                            </span>
                          </td>
                          <td className="px-5 py-2 text-center text-xs font-semibold text-slate-500">
                            {r.result_status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filteredClassResults.length > 0 && (
                  <div className="mt-4">
                    <Pagination
                      currentPage={resultsPage}
                      totalPages={totalResultsPages}
                      totalItems={filteredClassResults.length}
                      itemsPerPage={resultsLimit}
                      onPageChange={(page) => setResultsPage(page)}
                      onItemsPerPageChange={(limit) => {
                        setResultsLimit(limit);
                        setResultsPage(1);
                      }}
                      pageSizeOptions={[10, 25, 50]}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {marksEntryModal.open && marksEntryModal.classId && marksEntryModal.subjectId && termId && (
        <ExamMarksEntryModal
          isOpen={marksEntryModal.open}
          onClose={() => setMarksEntryModal({ open: false, classId: null, subjectId: null, subjectName: '' })}
          classId={marksEntryModal.classId}
          subjectId={marksEntryModal.subjectId}
          subjectName={marksEntryModal.subjectName}
          termId={termId}
          onSaved={() => {
            loadStatus();
            loadClassResults();
          }}
        />
      )}
    </div>
  );
};
