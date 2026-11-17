import React, { useState, useEffect, useCallback } from 'react';
import {
  GraduationCap,
  Calendar,
  ChevronRight,
  ArrowLeft,
  Printer,
  CheckCircle2,
  AlertCircle,
  Clock,
  BookOpen,
  User,
  Award,
  Layers,
  FileText,
  Percent,
  TrendingUp,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { api } from '../../services/api';

interface StudentAnnualPerformanceSummaryProps {
  studentId: number;
  initialSessionId?: number | null;
  onClose?: () => void;
  onNavigateToMarksEntry?: (subjectId: number, classId: number) => void;
}

const PASS_COLORS: Record<string, string> = {
  PASSED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FAILED: 'bg-rose-50 text-rose-700 border-rose-200',
  SUPPLEMENTARY: 'bg-amber-50 text-amber-800 border-amber-200',
  PENDING: 'bg-slate-50 text-slate-600 border-slate-200'
};

const GRADE_COLORS: Record<string, string> = {
  'A*': 'bg-emerald-100 text-emerald-800 font-black',
  A: 'bg-emerald-50 text-emerald-700 font-bold',
  B: 'bg-blue-50 text-blue-700 font-bold',
  C: 'bg-indigo-50 text-indigo-700 font-bold',
  D: 'bg-amber-50 text-amber-700 font-semibold',
  E: 'bg-orange-50 text-orange-700 font-semibold',
  U: 'bg-rose-50 text-rose-700 font-bold'
};

export const StudentAnnualPerformanceSummary: React.FC<StudentAnnualPerformanceSummaryProps> = ({
  studentId,
  initialSessionId,
  onClose,
  onNavigateToMarksEntry
}) => {
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(initialSessionId || null);
  const [summaryData, setSummaryData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Detailed subject state (when user clicks a subject)
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [subjectDetail, setSubjectDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getStudentAnnualSummary(studentId, selectedSessionId || undefined);
      setSummaryData(res);
      if (!selectedSessionId && res?.session?.id) {
        setSelectedSessionId(res.session.id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load student annual academic performance');
    } finally {
      setLoading(false);
    }
  }, [studentId, selectedSessionId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleSelectSubject = async (subId: number) => {
    setSelectedSubjectId(subId);
    try {
      setDetailLoading(true);
      setDetailError(null);
      const detail = await api.getSubjectDetailedMarks(studentId, subId, selectedSessionId || undefined);
      setSubjectDetail(detail);
    } catch (err: any) {
      setDetailError(err?.message || 'Failed to load detailed subject marks');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleBackToSummary = () => {
    setSelectedSubjectId(null);
    setSubjectDetail(null);
    setDetailError(null);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
        <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
        <div className="text-sm font-semibold text-slate-700">Loading student annual academic summary...</div>
      </div>
    );
  }

  if (error || !summaryData) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
        <div className="text-sm font-bold text-slate-800">{error || 'Data not found'}</div>
        <button
          onClick={fetchSummary}
          className="px-4 py-2 bg-indigo-900 text-white rounded-xl text-xs font-bold hover:bg-indigo-800 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  const { student, session, sessions, subjects, overallPercentage, overallGrade, passStatus } = summaryData;

  return (
    <div className="space-y-6">
      {/* ── HEADER CARD: Student info & Academic Year Selector ───────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 md:p-6 print:border-none print:shadow-none print:p-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-900 flex items-center justify-center shrink-0">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 tracking-tight">{student.studentName}</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  {student.className}
                </span>
              </div>
              <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                <span>Admission No: <strong className="text-slate-700">{student.admissionNo}</strong></span>
                <span>•</span>
                <span>Roll No: <strong className="text-slate-700">{student.rollNo || '—'}</strong></span>
                <span>•</span>
                <span>Session: <strong className="text-indigo-900">{session?.name}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 print:hidden">
            {/* Academic Year Selector */}
            {sessions && sessions.length > 1 && (
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <select
                  value={selectedSessionId || session.id}
                  onChange={(e) => setSelectedSessionId(Number(e.target.value))}
                  className="bg-transparent text-xs font-bold text-slate-800 outline-hidden cursor-pointer"
                >
                  {sessions.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.is_current ? '(Current)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Summary</span>
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold transition cursor-pointer"
              >
                Close
              </button>
            )}
          </div>
        </div>

        {/* Overall Annual Standing Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 text-xs">
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Subjects</span>
            <span className="text-base font-extrabold text-slate-900 font-mono mt-0.5 block">{subjects.length}</span>
          </div>
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Annual Percentage</span>
            <span className="text-base font-extrabold text-indigo-950 font-mono mt-0.5 block">
              {overallPercentage != null ? `${overallPercentage}%` : '—'}
            </span>
          </div>
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Annual Grade</span>
            <span className="text-base font-extrabold text-slate-900 mt-0.5 block">
              {overallGrade || '—'}
            </span>
          </div>
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Promotion Status</span>
            <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold mt-0.5 border ${PASS_COLORS[passStatus] || PASS_COLORS.PENDING}`}>
              {passStatus || 'Pending'}
            </span>
          </div>
        </div>
      </div>

      {/* ── CONDITIONAL VIEW: DETAIL OR MAIN TABLE ───────────────────────── */}
      {selectedSubjectId && subjectDetail ? (
        /* ========================================================================= */
        /* 2. CLICKING A SUBJECT – DETAILED MARKS PAGE                              */
        /* ========================================================================= */
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Breadcrumb Navigation */}
          <div className="flex items-center justify-between print:hidden">
            <button
              onClick={handleBackToSummary}
              className="inline-flex items-center gap-2 text-xs font-bold text-indigo-900 hover:text-indigo-700 bg-white border border-slate-200 px-3.5 py-2 rounded-xl transition shadow-2xs cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Subject Summary</span>
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Viewing Subject:</span>
              <span className="px-2.5 py-1 bg-indigo-50 text-indigo-900 border border-indigo-100 rounded-lg text-xs font-bold">
                {subjectDetail.subject.name} ({subjectDetail.subject.code})
              </span>
            </div>
          </div>

          {/* Subject Detail Header */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-700" />
                <h3 className="text-base font-extrabold text-slate-900">{subjectDetail.subject.name}</h3>
                <span className="text-xs font-mono text-slate-400">({subjectDetail.subject.code})</span>
              </div>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>Assigned Teacher: <strong className="text-slate-700">{subjectDetail.subject.teacherName}</strong></span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Subject Final Result</span>
                <span className="text-lg font-black text-slate-900 font-mono">
                  {subjectDetail.annualWeightedResult.finalPercentage != null
                    ? `${subjectDetail.annualWeightedResult.finalPercentage}%`
                    : '—'}
                </span>
                <span className="ml-2 inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-900">
                  Grade {subjectDetail.annualWeightedResult.grade || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION A: Quiz Marks */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-800 text-xs font-black flex items-center justify-center">A</span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Class Quiz Marks</h4>
              </div>
              <div className="text-xs font-bold text-slate-600">
                Category Total: <span className="font-mono text-slate-900">{subjectDetail.quizzes.summary.obtainedMarks} / {subjectDetail.quizzes.summary.totalMarks}</span>
                {subjectDetail.quizzes.summary.percentage != null && (
                  <span className="ml-2 px-2 py-0.5 rounded bg-indigo-50 text-indigo-900 font-bold">
                    {subjectDetail.quizzes.summary.percentage}%
                  </span>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-2.5 w-10">#</th>
                    <th className="px-4 py-2.5">Quiz Title</th>
                    <th className="px-4 py-2.5 text-center">Date</th>
                    <th className="px-4 py-2.5 text-right font-mono">Total Marks</th>
                    <th className="px-4 py-2.5 text-right font-mono">Obtained Marks</th>
                    <th className="px-4 py-2.5 text-right font-mono">Percentage</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subjectDetail.quizzes.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-5 text-center text-slate-400">No quizzes administered yet.</td>
                    </tr>
                  ) : (
                    subjectDetail.quizzes.items.map((item: any, idx: number) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-800">{item.title}</td>
                        <td className="px-4 py-2.5 text-center text-slate-500 font-mono">{item.date}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-500">{item.totalMarks}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                          {item.obtainedMarks != null ? item.obtainedMarks : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                          {item.percentage != null ? `${item.percentage}%` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.status === 'PUBLISHED' || item.status === 'GRADED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : item.status === 'ABSENT'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION B: Assignment / Homework Marks */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-800 text-xs font-black flex items-center justify-center">B</span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Assignments & Homework Tasks</h4>
              </div>
              <div className="text-xs font-bold text-slate-600">
                Category Total: <span className="font-mono text-slate-900">{subjectDetail.assignments.summary.obtainedMarks} / {subjectDetail.assignments.summary.totalMarks}</span>
                {subjectDetail.assignments.summary.percentage != null && (
                  <span className="ml-2 px-2 py-0.5 rounded bg-indigo-50 text-indigo-900 font-bold">
                    {subjectDetail.assignments.summary.percentage}%
                  </span>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-2.5 w-10">#</th>
                    <th className="px-4 py-2.5">Assignment</th>
                    <th className="px-4 py-2.5 text-center">Due Date</th>
                    <th className="px-4 py-2.5 text-right font-mono">Total Marks</th>
                    <th className="px-4 py-2.5 text-right font-mono">Obtained Marks</th>
                    <th className="px-4 py-2.5 text-right font-mono">Percentage</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subjectDetail.assignments.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-5 text-center text-slate-400">No assignments assigned yet.</td>
                    </tr>
                  ) : (
                    subjectDetail.assignments.items.map((item: any, idx: number) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-800">{item.title}</td>
                        <td className="px-4 py-2.5 text-center text-slate-500 font-mono">{item.date}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-500">{item.totalMarks}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                          {item.obtainedMarks != null ? item.obtainedMarks : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                          {item.percentage != null ? `${item.percentage}%` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.status === 'PUBLISHED' || item.status === 'GRADED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : item.status === 'ABSENT'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION C: Monthly Test Marks */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-800 text-xs font-black flex items-center justify-center">C</span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Monthly Test Marks</h4>
              </div>
              <div className="text-xs font-bold text-slate-600">
                Category Total: <span className="font-mono text-slate-900">{subjectDetail.monthlyTests.summary.obtainedMarks} / {subjectDetail.monthlyTests.summary.totalMarks}</span>
                {subjectDetail.monthlyTests.summary.percentage != null && (
                  <span className="ml-2 px-2 py-0.5 rounded bg-indigo-50 text-indigo-900 font-bold">
                    {subjectDetail.monthlyTests.summary.percentage}%
                  </span>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-2.5 w-10">#</th>
                    <th className="px-4 py-2.5">Monthly Test</th>
                    <th className="px-4 py-2.5 text-center">Date</th>
                    <th className="px-4 py-2.5 text-right font-mono">Total Marks</th>
                    <th className="px-4 py-2.5 text-right font-mono">Obtained Marks</th>
                    <th className="px-4 py-2.5 text-right font-mono">Percentage</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subjectDetail.monthlyTests.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-5 text-center text-slate-400">No monthly tests recorded yet.</td>
                    </tr>
                  ) : (
                    subjectDetail.monthlyTests.items.map((item: any, idx: number) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-800">{item.title}</td>
                        <td className="px-4 py-2.5 text-center text-slate-500 font-mono">{item.date}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-500">{item.totalMarks}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                          {item.obtainedMarks != null ? item.obtainedMarks : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                          {item.percentage != null ? `${item.percentage}%` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.status === 'PUBLISHED' || item.status === 'GRADED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : item.status === 'ABSENT'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION D: Mid-Term Examination */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-800 text-xs font-black flex items-center justify-center">D</span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Mid-Term Examination</h4>
              </div>
              <div className="text-xs font-bold text-slate-600">
                Exam Aggregate: <span className="font-mono text-slate-900">{subjectDetail.midTerm.summary.obtainedMarks} / {subjectDetail.midTerm.summary.totalMarks}</span>
                {subjectDetail.midTerm.summary.percentage != null && (
                  <span className="ml-2 px-2 py-0.5 rounded bg-indigo-50 text-indigo-900 font-bold">
                    {subjectDetail.midTerm.summary.percentage}%
                  </span>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-2.5 w-10">#</th>
                    <th className="px-4 py-2.5">Examination Paper</th>
                    <th className="px-4 py-2.5 text-center">Date</th>
                    <th className="px-4 py-2.5 text-right font-mono">Total Marks</th>
                    <th className="px-4 py-2.5 text-right font-mono">Obtained Marks</th>
                    <th className="px-4 py-2.5 text-right font-mono">Percentage</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subjectDetail.midTerm.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-5 text-center text-slate-400">No mid-term examination records.</td>
                    </tr>
                  ) : (
                    subjectDetail.midTerm.items.map((item: any, idx: number) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-800">{item.title}</td>
                        <td className="px-4 py-2.5 text-center text-slate-500 font-mono">{item.date}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-500">{item.totalMarks}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                          {item.obtainedMarks != null ? item.obtainedMarks : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                          {item.percentage != null ? `${item.percentage}%` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.status === 'PUBLISHED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : item.status === 'ABSENT'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION E: Terminal Examination */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-800 text-xs font-black flex items-center justify-center">E</span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Terminal / Final Examination</h4>
              </div>
              <div className="text-xs font-bold text-slate-600">
                Exam Aggregate: <span className="font-mono text-slate-900">{subjectDetail.terminal.summary.obtainedMarks} / {subjectDetail.terminal.summary.totalMarks}</span>
                {subjectDetail.terminal.summary.percentage != null && (
                  <span className="ml-2 px-2 py-0.5 rounded bg-indigo-50 text-indigo-900 font-bold">
                    {subjectDetail.terminal.summary.percentage}%
                  </span>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold border-b border-slate-100">
                  <tr>
                    <th className="px-4 py-2.5 w-10">#</th>
                    <th className="px-4 py-2.5">Paper Name</th>
                    <th className="px-4 py-2.5 text-center">Examination Date</th>
                    <th className="px-4 py-2.5 text-right font-mono">Total Marks</th>
                    <th className="px-4 py-2.5 text-right font-mono">Obtained Marks</th>
                    <th className="px-4 py-2.5 text-right font-mono">Percentage</th>
                    <th className="px-4 py-2.5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subjectDetail.terminal.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-5 text-center text-slate-400">No terminal examination records.</td>
                    </tr>
                  ) : (
                    subjectDetail.terminal.items.map((item: any, idx: number) => (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-4 py-2.5 font-semibold text-slate-800">{item.title}</td>
                        <td className="px-4 py-2.5 text-center text-slate-500 font-mono">{item.date}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-500">{item.totalMarks}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                          {item.obtainedMarks != null ? item.obtainedMarks : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-900">
                          {item.percentage != null ? `${item.percentage}%` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.status === 'PUBLISHED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : item.status === 'ABSENT'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-amber-50 text-amber-700'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION F: Annual Weighted Result (Formula Breakdown) */}
          <div className="bg-white rounded-2xl border border-indigo-200/90 shadow-sm overflow-hidden">
            <div className="px-5 py-4 bg-indigo-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                <h4 className="text-sm font-black uppercase tracking-wider">Annual Weighted Assessment Result</h4>
              </div>
              <div className="text-xs text-white/80 font-mono">
                Formula: (MT × 0.25) + (M × 0.15) + (A × 0.10) + (T × 0.50)
              </div>
            </div>

            <div className="p-5 space-y-4">
              <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100/90 text-slate-700 text-[10px] uppercase font-bold border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5">Assessment Category</th>
                    <th className="px-4 py-2.5 text-center">Policy Weight</th>
                    <th className="px-4 py-2.5 text-right font-mono">Category Percentage</th>
                    <th className="px-4 py-2.5 text-right font-mono">Weighted Contribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  <tr>
                    <td className="px-4 py-2.5 font-semibold text-slate-800 font-sans">Mid-Term Examination</td>
                    <td className="px-4 py-2.5 text-center text-slate-600">25%</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">
                      {subjectDetail.annualWeightedResult.midTerm?.percentage != null
                        ? `${subjectDetail.annualWeightedResult.midTerm.percentage}%`
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                      {subjectDetail.annualWeightedResult.midTerm?.contribution != null
                        ? `${subjectDetail.annualWeightedResult.midTerm.contribution}%`
                        : '0.00%'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-semibold text-slate-800 font-sans">Monthly Tests</td>
                    <td className="px-4 py-2.5 text-center text-slate-600">15%</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">
                      {subjectDetail.annualWeightedResult.monthly?.percentage != null
                        ? `${subjectDetail.annualWeightedResult.monthly.percentage}%`
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                      {subjectDetail.annualWeightedResult.monthly?.contribution != null
                        ? `${subjectDetail.annualWeightedResult.monthly.contribution}%`
                        : '0.00%'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-semibold text-slate-800 font-sans">
                      Tasks / Assignments <span className="text-[10px] text-slate-400 font-normal font-sans">(includes eligible class quizzes)</span>
                    </td>
                    <td className="px-4 py-2.5 text-center text-slate-600">10%</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">
                      {subjectDetail.annualWeightedResult.assignments?.percentage != null
                        ? `${subjectDetail.annualWeightedResult.assignments.percentage}%`
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                      {subjectDetail.annualWeightedResult.assignments?.contribution != null
                        ? `${subjectDetail.annualWeightedResult.assignments.contribution}%`
                        : '0.00%'}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-semibold text-slate-800 font-sans">Terminal Examination</td>
                    <td className="px-4 py-2.5 text-center text-slate-600">50%</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">
                      {subjectDetail.annualWeightedResult.terminal?.percentage != null
                        ? `${subjectDetail.annualWeightedResult.terminal.percentage}%`
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-900">
                      {subjectDetail.annualWeightedResult.terminal?.contribution != null
                        ? `${subjectDetail.annualWeightedResult.terminal.contribution}%`
                        : '0.00%'}
                    </td>
                  </tr>
                  <tr className="bg-indigo-50/60 font-bold border-t-2 border-indigo-200">
                    <td className="px-4 py-3 text-indigo-950 font-sans">Final Calculated Result</td>
                    <td className="px-4 py-3 text-center text-indigo-950">100%</td>
                    <td className="px-4 py-3 text-right text-indigo-950">—</td>
                    <td className="px-4 py-3 text-right text-base text-indigo-950">
                      {subjectDetail.annualWeightedResult.finalPercentage != null
                        ? `${subjectDetail.annualWeightedResult.finalPercentage}%`
                        : '—'}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-600 font-medium">Final Academic Grade:</span>
                  <span className={`px-3 py-1 rounded-lg text-sm font-black ${
                    GRADE_COLORS[subjectDetail.annualWeightedResult.grade] || 'bg-slate-100 text-slate-800'
                  }`}>
                    {subjectDetail.annualWeightedResult.grade || '—'}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                    subjectDetail.annualWeightedResult.isPassed
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {subjectDetail.annualWeightedResult.isPassed ? 'Passed' : 'Failed'}
                  </span>
                </div>

                {subjectDetail.annualWeightedResult.supplementary && (
                  <div className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Cleared via Re-Sit Examination (Grade {subjectDetail.annualWeightedResult.supplementary.grade})</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* 1. MAIN STUDENT PERFORMANCE SUMMARY TABLE                                */
        /* ========================================================================= */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Subject-wise Academic Performance</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Click any subject row to inspect the full itemized breakdown of quizzes, assignments, and examination marks.
              </p>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Weights: MT 25% · Monthly 15% · Tasks 10% · Terminal 50%
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 text-[10px] uppercase font-bold border-b border-slate-200 tracking-wider">
                <tr>
                  <th className="px-4 py-3 w-10">#</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Assigned Teacher</th>
                  <th className="px-3 py-3 text-right font-mono">Quizzes</th>
                  <th className="px-3 py-3 text-right font-mono">Assignments</th>
                  <th className="px-3 py-3 text-right font-mono">Monthly Tests</th>
                  <th className="px-3 py-3 text-right font-mono">Mid-Term</th>
                  <th className="px-3 py-3 text-right font-mono">Terminal</th>
                  <th className="px-4 py-3 text-right font-mono">Annual %</th>
                  <th className="px-3 py-3 text-center">Grade</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-3 py-3 text-center print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subjects.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-slate-400">
                      No subjects configured for this student.
                    </td>
                  </tr>
                ) : (
                  subjects.map((sub: any, idx: number) => (
                    <tr
                      key={sub.subjectId}
                      onClick={() => handleSelectSubject(sub.subjectId)}
                      className="hover:bg-indigo-50/40 cursor-pointer transition-colors group"
                      title="Click to view detailed assessment breakdown"
                    >
                      <td className="px-4 py-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-900 group-hover:text-indigo-900 transition-colors block">
                          {sub.subjectName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{sub.subjectCode}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-medium">
                        {sub.teacherName}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-slate-600">
                        {sub.quizzesPct != null ? `${sub.quizzesPct}%` : '—'}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-slate-600">
                        {sub.assignmentsPct != null ? `${sub.assignmentsPct}%` : '—'}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-slate-600">
                        {sub.monthlyTestsPct != null ? `${sub.monthlyTestsPct}%` : '—'}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-slate-600">
                        {sub.midTermPct != null ? `${sub.midTermPct}%` : '—'}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-slate-600">
                        {sub.terminalPct != null ? `${sub.terminalPct}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-black text-slate-900 text-sm">
                        {sub.annualPercentage != null ? `${sub.annualPercentage}%` : '—'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                          GRADE_COLORS[sub.grade] || 'text-slate-400'
                        }`}>
                          {sub.grade || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          sub.status === 'PUBLISHED'
                            ? sub.isPassed
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {sub.status === 'PUBLISHED' ? (sub.isPassed ? 'Passed' : 'Failed') : sub.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center print:hidden">
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
