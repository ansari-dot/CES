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
  RefreshCw
} from 'lucide-react';
import { requestApi } from '../services/api';

interface StudentAnnualPerformanceSummaryProps {
  childId: number;
  initialSessionId?: number | null;
  onClose?: () => void;
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
  childId,
  initialSessionId,
  onClose
}) => {
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(initialSessionId || null);
  const [summaryData, setSummaryData] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Drilldown state
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [detailedMarks, setDetailedMarks] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Fetch summary
  const loadSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const url = selectedSessionId
        ? `/api/v1/results/child/${childId}/annual-summary?sessionId=${selectedSessionId}`
        : `/api/v1/results/child/${childId}/annual-summary`;
      const res = await requestApi<any>(url);
      setSummaryData(res);
      if (res?.session?.id && !selectedSessionId) {
        setSelectedSessionId(res.session.id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load annual academic performance summary.');
    } finally {
      setLoading(false);
    }
  }, [childId, selectedSessionId]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // Fetch detailed marks for a clicked subject
  const loadSubjectDetails = useCallback(
    async (subjectId: number) => {
      try {
        setDetailLoading(true);
        setDetailError(null);
        setSelectedSubjectId(subjectId);
        const url = selectedSessionId
          ? `/api/v1/results/students/${childId}/subjects/${subjectId}/detailed-marks?sessionId=${selectedSessionId}`
          : `/api/v1/results/students/${childId}/subjects/${subjectId}/detailed-marks`;
        const res = await requestApi<any>(url);
        setDetailedMarks(res);
      } catch (err: any) {
        setDetailError(err?.message || 'Failed to load detailed marks for this subject.');
      } finally {
        setDetailLoading(false);
      }
    },
    [childId, selectedSessionId]
  );

  const handlePrint = () => {
    window.print();
  };

  if (loading && !summaryData) {
    return (
      <div className="py-16 text-center space-y-3">
        <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
        <p className="text-xs text-muted-foreground font-medium">
          Loading annual academic performance summary...
        </p>
      </div>
    );
  }

  if (error && !summaryData) {
    return (
      <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-2xl max-w-lg mx-auto space-y-3">
        <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
        <h3 className="text-sm font-bold text-rose-900">Unable to Load Annual Performance</h3>
        <p className="text-xs text-rose-700">{error}</p>
        <button
          type="button"
          onClick={loadSummary}
          className="px-4 py-2 bg-rose-600 text-white text-xs font-semibold rounded-xl hover:bg-rose-700 transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  const student = summaryData?.student;
  const session = summaryData?.session;
  const sessions = summaryData?.sessions || [];
  const subjects: any[] = summaryData?.subjects || [];

  return (
    <div className="space-y-6 print:space-y-4">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border print:hidden">
        <div className="flex items-center gap-3">
          {selectedSubjectId ? (
            <button
              type="button"
              onClick={() => {
                setSelectedSubjectId(null);
                setDetailedMarks(null);
              }}
              className="px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              <span>Back to All Subjects</span>
            </button>
          ) : onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-muted-foreground" />
              <span>Close</span>
            </button>
          ) : null}

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white border border-[#004aad]/25 p-1 shadow-xs flex items-center justify-center shrink-0">
              <img
                src="/logowb.png"
                alt="Cambridge Education System"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/logo.jpeg';
                }}
              />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <span>
                  {selectedSubjectId && detailedMarks
                    ? `${detailedMarks.subject?.name} — Detailed Evaluation`
                    : 'Annual Academic Performance Summary'}
                </span>
              </h2>
              <p className="text-xs text-muted-foreground">
                Official Cambridge Grading Policy (Mid-Term 25% · Monthly Tests 15% · Tasks 10% · Terminal 50%)
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {sessions.length > 0 && (
            <div className="flex items-center gap-1.5 bg-muted/60 px-3 py-1.5 rounded-xl border border-border text-xs">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-muted-foreground font-medium">Session:</span>
              <select
                value={selectedSessionId || ''}
                onChange={(e) => setSelectedSessionId(Number(e.target.value))}
                className="bg-transparent font-bold text-foreground border-none focus:outline-none cursor-pointer text-xs"
              >
                {sessions.map((s: any) => (
                  <option key={s.id} value={s.id} className="text-slate-900">
                    {s.name} {s.is_current ? '(Current)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={handlePrint}
            className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs transition"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Summary</span>
          </button>
        </div>
      </div>

      {/* Official School Letterhead (Visible when printing) */}
      <div className="hidden print:flex items-center justify-between border-b-2 border-[#004aad] pb-4 mb-4 text-left">
        <div className="flex items-center gap-3">
          <img src="/logowb.png" alt="Cambridge Education System" className="w-16 h-16 object-contain shrink-0" />
          <div>
            <h1 className="text-xl font-black uppercase tracking-wider text-[#004aad]">
              Cambridge Education System
            </h1>
            <p className="text-xs text-slate-700 font-bold">
              Official Student Annual Academic Evaluation &amp; Progress Transcript
            </p>
            <p className="text-[11px] text-[#c8952b] font-semibold mt-0.5">
              Academic Session: {session?.name || 'Current'} · Cambridge Curriculum Standard
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="text-xs font-mono font-bold text-slate-900 block">OFFICIAL RESULT CARD</span>
          <span className="text-[10px] text-slate-500 block">Issued: {new Date().toLocaleDateString('en-GB')}</span>
        </div>
      </div>

      {/* 2. Student Info Header Card */}
      {student && (
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-xs">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Student Name</span>
              <span className="font-bold text-foreground text-sm block mt-0.5">{student.studentName}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Admission No</span>
              <span className="font-mono font-semibold text-foreground block mt-0.5">{student.admissionNo}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Roll Number</span>
              <span className="font-mono font-semibold text-foreground block mt-0.5">
                {student.rollNo ? `S-${student.rollNo.padStart(3, '0')}` : '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Class &amp; Section</span>
              <span className="font-bold text-foreground block mt-0.5">{student.className}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Overall Annual %</span>
              <span className="font-mono font-black text-primary text-sm block mt-0.5">
                {summaryData.overallPercentage != null ? `${summaryData.overallPercentage}%` : '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Annual Grade</span>
              <span className="block mt-0.5">
                {summaryData.overallGrade ? (
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-black border ${
                      GRADE_COLORS[summaryData.overallGrade] || 'bg-muted text-foreground'
                    }`}
                  >
                    {summaryData.overallGrade}
                  </span>
                ) : (
                  '—'
                )}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Main View vs Detailed View */}
      {!selectedSubjectId ? (
        /* MAIN SUBJECT-WISE ANNUAL SUMMARY TABLE */
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  <span>Subject-wise Assessment &amp; Annual Weighted Performance</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Click any subject to view itemized quiz, assignment, monthly test, and examination marks.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-foreground">
                <thead className="bg-muted/70 text-muted-foreground font-semibold border-b border-border text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3 w-12 text-center">#</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Teacher</th>
                    <th className="px-4 py-3 text-center">Quizzes</th>
                    <th className="px-4 py-3 text-center">Assignments (10%)</th>
                    <th className="px-4 py-3 text-center">Monthly Tests (15%)</th>
                    <th className="px-4 py-3 text-center">Mid-Term (25%)</th>
                    <th className="px-4 py-3 text-center">Terminal (50%)</th>
                    <th className="px-4 py-3 text-center bg-primary/5 font-bold">Annual %</th>
                    <th className="px-4 py-3 text-center bg-primary/5 font-bold">Grade</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-right print:hidden">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {subjects.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-4 py-8 text-center text-muted-foreground">
                        No subject performance records available for this session.
                      </td>
                    </tr>
                  ) : (
                    subjects.map((sub, idx) => {
                      return (
                        <tr
                          key={sub.subjectId}
                          onClick={() => loadSubjectDetails(sub.subjectId)}
                          className="hover:bg-muted/50 transition-colors cursor-pointer group"
                        >
                          <td className="px-4 py-3 text-center font-mono text-muted-foreground">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <span className="font-bold text-foreground group-hover:text-primary transition-colors block">
                              {sub.subjectName}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-mono block">
                              {sub.subjectCode}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <User className="w-3 h-3 text-muted-foreground shrink-0" />
                              <span>{sub.teacherName || '—'}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-muted-foreground">
                            {sub.quizPercentage != null ? `${sub.quizPercentage}%` : '—'}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-muted-foreground">
                            {sub.assignmentPercentage != null ? `${sub.assignmentPercentage}%` : '—'}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-muted-foreground">
                            {sub.monthlyTestPercentage != null ? `${sub.monthlyTestPercentage}%` : '—'}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-muted-foreground">
                            {sub.midTermPercentage != null ? `${sub.midTermPercentage}%` : '—'}
                          </td>
                          <td className="px-4 py-3 text-center font-mono text-muted-foreground">
                            {sub.terminalPercentage != null ? `${sub.terminalPercentage}%` : '—'}
                          </td>
                          <td className="px-4 py-3 text-center font-mono font-bold text-primary bg-primary/5 text-sm">
                            {sub.annualPercentage != null ? `${sub.annualPercentage}%` : '—'}
                          </td>
                          <td className="px-4 py-3 text-center bg-primary/5">
                            {sub.grade ? (
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-bold border ${
                                  GRADE_COLORS[sub.grade] || 'bg-muted text-foreground'
                                }`}
                              >
                                {sub.grade}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                PASS_COLORS[sub.passStatus] || 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {sub.passStatus || 'PENDING'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right print:hidden">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                loadSubjectDetails(sub.subjectId);
                              }}
                              className="px-2.5 py-1 rounded-lg border border-border hover:bg-muted text-foreground text-[11px] font-semibold inline-flex items-center gap-1 transition-colors"
                            >
                              <span>View Marks</span>
                              <ChevronRight className="w-3 h-3 text-muted-foreground" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* DETAILED SUBJECT VIEW (Sections A-F) */
        <div className="space-y-6">
          {detailLoading && !detailedMarks ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
              <p className="text-xs text-muted-foreground">Loading itemized marks breakdown...</p>
            </div>
          ) : detailError ? (
            <div className="p-6 text-center bg-rose-50 border border-rose-200 rounded-2xl space-y-3">
              <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
              <p className="text-xs text-rose-700">{detailError}</p>
              <button
                type="button"
                onClick={() => selectedSubjectId && loadSubjectDetails(selectedSubjectId)}
                className="px-4 py-2 bg-rose-600 text-white text-xs font-semibold rounded-xl"
              >
                Retry
              </button>
            </div>
          ) : detailedMarks ? (
            <div className="space-y-6">
              {/* Detailed Subject Banner */}
              <div className="p-4 rounded-2xl bg-card border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                    Subject Assessment Breakdown
                  </span>
                  <h3 className="text-base font-bold text-foreground mt-0.5">
                    {detailedMarks.subject?.name} ({detailedMarks.subject?.code})
                  </h3>
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5 mt-0.5">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Teacher: {detailedMarks.teacherName || 'Unassigned'}</span>
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Annual Result</span>
                    <span className="text-lg font-black text-primary font-mono block">
                      {detailedMarks.weightedCalculation?.finalPercentage != null
                        ? `${detailedMarks.weightedCalculation.finalPercentage}%`
                        : '—'}
                    </span>
                  </div>
                  {detailedMarks.weightedCalculation?.grade && (
                    <span
                      className={`px-3 py-1.5 rounded-xl text-sm font-black border ${
                        GRADE_COLORS[detailedMarks.weightedCalculation.grade] || 'bg-muted text-foreground'
                      }`}
                    >
                      Grade {detailedMarks.weightedCalculation.grade}
                    </span>
                  )}
                </div>
              </div>

              {/* Section A: Quizzes */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                      A
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Class Quizzes</h4>
                      <p className="text-[11px] text-muted-foreground">
                        {detailedMarks.gradingPolicy?.include_quizzes_in_assignments
                          ? 'Included within Tasks / Assignments (10% category)'
                          : 'Recorded formative quizzes'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Category Total</span>
                    <span className="text-xs font-mono font-bold text-foreground">
                      {detailedMarks.quizzes?.categoryPercentage != null
                        ? `${detailedMarks.quizzes.categoryPercentage}%`
                        : '—'}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/60 text-muted-foreground font-semibold text-[10px] uppercase border-b border-border">
                      <tr>
                        <th className="px-4 py-2 w-10 text-center">#</th>
                        <th className="px-4 py-2">Quiz Title</th>
                        <th className="px-4 py-2">Date</th>
                        <th className="px-4 py-2 text-center">Total Marks</th>
                        <th className="px-4 py-2 text-center">Obtained Marks</th>
                        <th className="px-4 py-2 text-center">Percentage</th>
                        <th className="px-4 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {detailedMarks.quizzes?.items?.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-4 text-center text-muted-foreground text-xs">
                            No quizzes recorded for this subject.
                          </td>
                        </tr>
                      ) : (
                        detailedMarks.quizzes?.items?.map((item: any, i: number) => (
                          <tr key={item.id || i} className="hover:bg-muted/30">
                            <td className="px-4 py-2 text-center font-mono text-muted-foreground">{i + 1}</td>
                            <td className="px-4 py-2 font-medium text-foreground">{item.title}</td>
                            <td className="px-4 py-2 text-muted-foreground font-mono">{item.date}</td>
                            <td className="px-4 py-2 text-center font-mono text-foreground">{item.totalMarks}</td>
                            <td className="px-4 py-2 text-center font-mono font-bold text-foreground">
                              {item.obtainedMarks != null ? item.obtainedMarks : '—'}
                            </td>
                            <td className="px-4 py-2 text-center font-mono text-primary font-semibold">
                              {item.percentage != null ? `${item.percentage}%` : '—'}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
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

              {/* Section B: Assignments & Tasks */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold text-xs">
                      B
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Assignments &amp; Homework Tasks (10% Weight)</h4>
                      <p className="text-[11px] text-muted-foreground">
                        Published academic coursework and assigned projects
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Category Aggregate</span>
                    <span className="text-xs font-mono font-bold text-emerald-700">
                      {detailedMarks.assignments?.categoryPercentage != null
                        ? `${detailedMarks.assignments.categoryPercentage}%`
                        : '—'}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/60 text-muted-foreground font-semibold text-[10px] uppercase border-b border-border">
                      <tr>
                        <th className="px-4 py-2 w-10 text-center">#</th>
                        <th className="px-4 py-2">Assignment / Task</th>
                        <th className="px-4 py-2">Due Date</th>
                        <th className="px-4 py-2 text-center">Total Marks</th>
                        <th className="px-4 py-2 text-center">Obtained Marks</th>
                        <th className="px-4 py-2 text-center">Percentage</th>
                        <th className="px-4 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {detailedMarks.assignments?.items?.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-4 text-center text-muted-foreground text-xs">
                            No assignments recorded for this subject.
                          </td>
                        </tr>
                      ) : (
                        detailedMarks.assignments?.items?.map((item: any, i: number) => (
                          <tr key={item.id || i} className="hover:bg-muted/30">
                            <td className="px-4 py-2 text-center font-mono text-muted-foreground">{i + 1}</td>
                            <td className="px-4 py-2 font-medium text-foreground">{item.title}</td>
                            <td className="px-4 py-2 text-muted-foreground font-mono">{item.date}</td>
                            <td className="px-4 py-2 text-center font-mono text-foreground">{item.totalMarks}</td>
                            <td className="px-4 py-2 text-center font-mono font-bold text-foreground">
                              {item.obtainedMarks != null ? item.obtainedMarks : '—'}
                            </td>
                            <td className="px-4 py-2 text-center font-mono text-emerald-700 font-semibold">
                              {item.percentage != null ? `${item.percentage}%` : '—'}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
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

              {/* Section C: Monthly Tests */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs">
                      C
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Monthly Tests (15% Weight)</h4>
                      <p className="text-[11px] text-muted-foreground">
                        Scheduled monthly curriculum tests conducted through the academic year
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Category Total</span>
                    <span className="text-xs font-mono font-bold text-amber-700">
                      {detailedMarks.monthlyTests?.categoryPercentage != null
                        ? `${detailedMarks.monthlyTests.categoryPercentage}%`
                        : '—'}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/60 text-muted-foreground font-semibold text-[10px] uppercase border-b border-border">
                      <tr>
                        <th className="px-4 py-2 w-10 text-center">#</th>
                        <th className="px-4 py-2">Test Name</th>
                        <th className="px-4 py-2">Test Date</th>
                        <th className="px-4 py-2 text-center">Total Marks</th>
                        <th className="px-4 py-2 text-center">Obtained Marks</th>
                        <th className="px-4 py-2 text-center">Percentage</th>
                        <th className="px-4 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {detailedMarks.monthlyTests?.items?.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-4 text-center text-muted-foreground text-xs">
                            No monthly tests recorded for this subject.
                          </td>
                        </tr>
                      ) : (
                        detailedMarks.monthlyTests?.items?.map((item: any, i: number) => (
                          <tr key={item.id || i} className="hover:bg-muted/30">
                            <td className="px-4 py-2 text-center font-mono text-muted-foreground">{i + 1}</td>
                            <td className="px-4 py-2 font-medium text-foreground">{item.title}</td>
                            <td className="px-4 py-2 text-muted-foreground font-mono">{item.date}</td>
                            <td className="px-4 py-2 text-center font-mono text-foreground">{item.totalMarks}</td>
                            <td className="px-4 py-2 text-center font-mono font-bold text-foreground">
                              {item.obtainedMarks != null ? item.obtainedMarks : '—'}
                            </td>
                            <td className="px-4 py-2 text-center font-mono text-amber-700 font-semibold">
                              {item.percentage != null ? `${item.percentage}%` : '—'}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
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

              {/* Section D: Mid-Term Examination */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs">
                      D
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Mid-Term Examination (25% Weight)</h4>
                      <p className="text-[11px] text-muted-foreground">Formal mid-term examination paper evaluation</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Category Total</span>
                    <span className="text-xs font-mono font-bold text-blue-700">
                      {detailedMarks.midTerm?.categoryPercentage != null
                        ? `${detailedMarks.midTerm.categoryPercentage}%`
                        : '—'}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/60 text-muted-foreground font-semibold text-[10px] uppercase border-b border-border">
                      <tr>
                        <th className="px-4 py-2 w-10 text-center">#</th>
                        <th className="px-4 py-2">Examination Paper</th>
                        <th className="px-4 py-2">Date</th>
                        <th className="px-4 py-2 text-center">Total Marks</th>
                        <th className="px-4 py-2 text-center">Obtained Marks</th>
                        <th className="px-4 py-2 text-center">Percentage</th>
                        <th className="px-4 py-2 text-center">Publication Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {detailedMarks.midTerm?.items?.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-4 text-center text-muted-foreground text-xs">
                            No mid-term examination paper recorded.
                          </td>
                        </tr>
                      ) : (
                        detailedMarks.midTerm?.items?.map((item: any, i: number) => (
                          <tr key={item.id || i} className="hover:bg-muted/30">
                            <td className="px-4 py-2 text-center font-mono text-muted-foreground">{i + 1}</td>
                            <td className="px-4 py-2 font-medium text-foreground">{item.title}</td>
                            <td className="px-4 py-2 text-muted-foreground font-mono">{item.date}</td>
                            <td className="px-4 py-2 text-center font-mono text-foreground">{item.totalMarks}</td>
                            <td className="px-4 py-2 text-center font-mono font-bold text-foreground">
                              {item.obtainedMarks != null ? item.obtainedMarks : '—'}
                            </td>
                            <td className="px-4 py-2 text-center font-mono text-blue-700 font-semibold">
                              {item.percentage != null ? `${item.percentage}%` : '—'}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
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

              {/* Section E: Terminal Examination */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs">
                      E
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">Terminal / Final Examination (50% Weight)</h4>
                      <p className="text-[11px] text-muted-foreground">Official terminal examination papers</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Category Total</span>
                    <span className="text-xs font-mono font-bold text-indigo-700">
                      {detailedMarks.terminal?.categoryPercentage != null
                        ? `${detailedMarks.terminal.categoryPercentage}%`
                        : '—'}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/60 text-muted-foreground font-semibold text-[10px] uppercase border-b border-border">
                      <tr>
                        <th className="px-4 py-2 w-10 text-center">#</th>
                        <th className="px-4 py-2">Paper Name</th>
                        <th className="px-4 py-2">Exam Date</th>
                        <th className="px-4 py-2 text-center">Total Marks</th>
                        <th className="px-4 py-2 text-center">Obtained Marks</th>
                        <th className="px-4 py-2 text-center">Percentage</th>
                        <th className="px-4 py-2 text-center">Publication Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {detailedMarks.terminal?.items?.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-4 text-center text-muted-foreground text-xs">
                            No terminal examination paper recorded.
                          </td>
                        </tr>
                      ) : (
                        detailedMarks.terminal?.items?.map((item: any, i: number) => (
                          <tr key={item.id || i} className="hover:bg-muted/30">
                            <td className="px-4 py-2 text-center font-mono text-muted-foreground">{i + 1}</td>
                            <td className="px-4 py-2 font-medium text-foreground">{item.title}</td>
                            <td className="px-4 py-2 text-muted-foreground font-mono">{item.date}</td>
                            <td className="px-4 py-2 text-center font-mono text-foreground">{item.totalMarks}</td>
                            <td className="px-4 py-2 text-center font-mono font-bold text-foreground">
                              {item.obtainedMarks != null ? item.obtainedMarks : '—'}
                            </td>
                            <td className="px-4 py-2 text-center font-mono text-indigo-700 font-semibold">
                              {item.percentage != null ? `${item.percentage}%` : '—'}
                            </td>
                            <td className="px-4 py-2 text-center">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
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

              {/* Section F: Annual Weighted Result Breakdown */}
              <div className="bg-card border-2 border-primary/20 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 bg-primary/5 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-xs">
                      F
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">
                        Annual Weighted Result (Official Formula Breakdown)
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        Final Subject % = (MT × 0.25) + (Monthly × 0.15) + (Tasks × 0.10) + (Terminal × 0.50)
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      Single Backend Truth
                    </span>
                    <span className="text-[11px] font-bold text-primary">Unified Calculation Engine</span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/70 text-muted-foreground font-semibold text-[10px] uppercase border-b border-border">
                      <tr>
                        <th className="px-5 py-3">Assessment Category</th>
                        <th className="px-5 py-3 text-center">Official Weight</th>
                        <th className="px-5 py-3 text-center">Student Category %</th>
                        <th className="px-5 py-3 text-center">Contribution</th>
                        <th className="px-5 py-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {detailedMarks.weightedCalculation?.breakdown?.map((cat: any) => (
                        <tr key={cat.category} className="hover:bg-muted/30">
                          <td className="px-5 py-3 font-semibold text-foreground">{cat.category}</td>
                          <td className="px-5 py-3 text-center font-mono font-medium text-foreground">{cat.weight}%</td>
                          <td className="px-5 py-3 text-center font-mono font-medium text-foreground">
                            {cat.studentPercentage != null ? `${cat.studentPercentage}%` : '—'}
                          </td>
                          <td className="px-5 py-3 text-center font-mono font-bold text-primary">
                            {cat.contribution != null ? `${cat.contribution}%` : '—'}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                              {cat.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/60 font-bold border-t-2 border-border text-foreground">
                      <tr>
                        <td className="px-5 py-3 uppercase tracking-wider text-[11px]">Total Annual Subject Result</td>
                        <td className="px-5 py-3 text-center font-mono">100%</td>
                        <td className="px-5 py-3 text-center font-mono">—</td>
                        <td className="px-5 py-3 text-center font-mono text-base font-black text-primary">
                          {detailedMarks.weightedCalculation?.finalPercentage != null
                            ? `${detailedMarks.weightedCalculation.finalPercentage}%`
                            : '—'}
                        </td>
                        <td className="px-5 py-3 text-center">
                          {detailedMarks.weightedCalculation?.grade && (
                            <span
                              className={`inline-block px-3 py-1 rounded text-xs font-black border ${
                                GRADE_COLORS[detailedMarks.weightedCalculation.grade] || 'bg-muted text-foreground'
                              }`}
                            >
                              Grade {detailedMarks.weightedCalculation.grade} (
                              {detailedMarks.weightedCalculation.passStatus})
                            </span>
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
export default StudentAnnualPerformanceSummary;
