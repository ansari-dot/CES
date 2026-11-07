import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { 
  ScrollText, 
  Printer, 
  Download, 
  Award, 
  CheckCircle2, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  GraduationCap, 
  History, 
  RefreshCw, 
  Calendar, 
  FileCheck, 
  School,
  Clock,
  Sparkles
} from 'lucide-react';
import { RootState } from '../store';
import { requestApi } from '../services/api';
import Modal from '../components/common/Modal';
import { LoadingBlock } from '../components/common/LoadingBlock';

interface SubjectRow {
  id: number;
  subjectName: string;
  subjectCode: string;
  total_marks: number;
  obtained_marks: number | null;
  percentage: number | null;
  grade: string | null;
  is_absent: number;
  passed: number | null;
  teacher_remarks: string | null;
  supplementary?: {
    is_passed: number;
    obtained_marks: number | null;
    max_marks: number;
    grade: string | null;
    is_absent: number;
    attempt_number: number;
    published_at: string;
  } | null;
}

interface TermResult {
  id: number;
  termName: string;
  isFinalTerm: number;
  sessionName: string;
  className: string;
  total_marks: number;
  obtained_marks: number;
  percentage: number | null;
  overall_grade: string | null;
  pass_status: string;
  published_at: string;
  remarks: string | null;
  subjects: SubjectRow[];
}

interface EnrollmentRow {
  id: number;
  status: string;
  className: string;
  sessionName: string;
  isCurrent: number;
  rollNo: string | null;
}

interface PromotionRow {
  decision: string;
  status: string;
  fromSessionName: string;
  toSessionName: string | null;
  toClassName: string | null;
}

interface AcademicHistory {
  results: TermResult[];
  enrollments: EnrollmentRow[];
  promotions: PromotionRow[];
}

const PASS_LABEL: Record<string, { label: string; cls: string; badgeCls: string }> = {
  PASSED: { 
    label: 'Passed', 
    cls: 'bg-success-bg text-success border border-success/30',
    badgeCls: 'bg-emerald-500 text-white'
  },
  FAILED: { 
    label: 'Failed', 
    cls: 'bg-error-bg text-error border border-error/30',
    badgeCls: 'bg-rose-500 text-white'
  },
  SUPPLEMENTARY: { 
    label: 'Supplementary Exam Required', 
    cls: 'bg-warning-bg text-warning border border-warning/30',
    badgeCls: 'bg-amber-500 text-white'
  },
  PENDING: { 
    label: 'Under Evaluation', 
    cls: 'bg-muted text-muted-foreground border border-border',
    badgeCls: 'bg-slate-500 text-white'
  },
  ABSENT: { 
    label: 'Absent', 
    cls: 'bg-muted text-muted-foreground border border-border',
    badgeCls: 'bg-slate-500 text-white'
  }
};

const DECISION_TEXT: Record<string, string> = {
  PROMOTE: 'Promoted to Next Class',
  RETAIN: 'Retained in Current Class',
  GRADUATE: 'Graduated / Completed Final Year',
  WITHDRAW: 'Withdrawn',
  WITHHOLD: 'Decision Pending'
};

export default function Results() {
  const profile = useSelector((state: RootState) => state.student.profile);
  const [data, setData] = useState<AcademicHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<number | null>(null);
  const [cardToPrint, setCardToPrint] = useState<TermResult | null>(null);

  const fetchResults = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await requestApi<AcademicHistory>('/api/v1/results/me');
      setData(res);
      // Auto expand the latest result card by default
      if (res && res.results && res.results.length > 0) {
        setExpandedCardId(res.results[0].id);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load official examination results.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const handlePrint = () => {
    window.print();
  };

  if (loading && !data) {
    return <LoadingBlock message="Loading official examination results and transcripts..." />;
  }

  if (error && !data) {
    return (
      <div className="bg-card border border-border rounded-md p-8 text-center space-y-4 shadow-sm max-w-xl mx-auto my-12">
        <AlertCircle className="w-12 h-12 text-error mx-auto stroke-[1.8]" />
        <div>
          <h3 className="text-lg font-bold text-foreground">Unable to Load Examination Results</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">{error}</p>
        </div>
        <button
          onClick={fetchResults}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-sm hover:bg-primary-hover transition cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry Loading</span>
        </button>
      </div>
    );
  }

  const results = data?.results || [];
  const latestPromotion = data?.promotions && data.promotions[0] ? data.promotions[0] : null;

  // Distinguish terminal result cards from regular mid-term tests
  const terminalCards = results.filter(r => r.isFinalTerm === 1);
  const otherCards = results.filter(r => r.isFinalTerm !== 1);

  return (
    <div className="space-y-6">
      {/* Top Banner / Page Heading */}
      <div className="bg-navy text-white rounded-md p-6 shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <span className="p-1.5 rounded bg-white/10 text-secondary">
                <ScrollText className="w-5 h-5" />
              </span>
              <h1 className="font-headings font-bold text-2xl text-white tracking-tight">
                Examination Results & Transcripts
              </h1>
            </div>
            <p className="text-xs text-white/80 max-w-2xl leading-relaxed mt-1">
              Official terminal examination result cards and subject-wise academic evaluations. 
              Your permanent Terminal Result Card from completed academic classes and current evaluations are preserved here for download and printing.
            </p>
          </div>

          {results.length > 0 && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setCardToPrint(results[0])}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-sm bg-secondary text-secondary-foreground font-bold text-xs shadow hover:bg-white hover:text-navy transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Latest Result Card</span>
              </button>
            </div>
          )}
        </div>

        {/* Decorative background glow */}
        <div className="absolute -right-8 -bottom-8 w-44 h-44 rounded-full bg-secondary/10 blur-2xl pointer-events-none" />
      </div>

      {/* Promotion / Placement Notification Card (if exists) */}
      {latestPromotion && (
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-sky-50 border border-emerald-200 rounded-md p-4 flex items-start gap-3.5 shadow-xs">
          <div className="w-10 h-10 rounded-md bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-xs">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div className="text-xs flex-1">
            <div className="flex items-center gap-2">
              <span className="font-headings font-bold text-emerald-950 text-sm">
                Academic Advancement Status · {latestPromotion.fromSessionName}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 text-emerald-900">
                {DECISION_TEXT[latestPromotion.decision] || latestPromotion.decision}
              </span>
            </div>
            <p className="text-emerald-800 mt-1 leading-relaxed">
              {latestPromotion.status === 'EXECUTED' && latestPromotion.decision === 'PROMOTE' && latestPromotion.toClassName
                ? `Officially promoted and enrolled into ${latestPromotion.toClassName} for the ${latestPromotion.toSessionName || 'upcoming'} academic session.`
                : latestPromotion.status === 'EXECUTED' && latestPromotion.decision === 'RETAIN' && latestPromotion.toClassName
                  ? `Continuing in ${latestPromotion.toClassName} for session ${latestPromotion.toSessionName}.`
                  : latestPromotion.decision === 'GRADUATE'
                    ? 'Congratulations on graduating and successfully completing the curriculum at Cambridge Education System!'
                    : 'The final academic board decision has been recorded.'}
            </p>
          </div>
        </div>
      )}

      {/* Main Results List */}
      {results.length === 0 ? (
        <div className="bg-card border border-border rounded-md p-12 text-center space-y-3 shadow-xs">
          <FileCheck className="w-12 h-12 text-muted-foreground/60 mx-auto" />
          <h3 className="font-headings font-bold text-base text-foreground">
            No Official Results Published Yet
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Your examination result cards will appear here once the academic administration finalizes and publishes the official terminal results.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Section: Terminal Result Cards (Current & Historical) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-headings font-bold text-base text-foreground flex items-center gap-2">
                  <Award className="w-4 h-4 text-primary" />
                  <span>Terminal Examination Result Cards</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Permanent academic transcripts including your previous completed class and current evaluation.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                {results.length} {results.length === 1 ? 'Record' : 'Records'} Available
              </span>
            </div>

            {results.map((result, idx) => {
              const passMeta = PASS_LABEL[result.pass_status] || PASS_LABEL.PENDING;
              const isExpanded = expandedCardId === result.id;
              const isTerminal = result.isFinalTerm === 1;

              return (
                <div 
                  key={result.id} 
                  className={`bg-card border transition-all duration-200 rounded-md overflow-hidden shadow-xs ${
                    isTerminal ? 'border-primary/30 ring-1 ring-primary/10' : 'border-border'
                  }`}
                >
                  {/* Card Header Row */}
                  <div className="p-4 sm:p-5 bg-card flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/80">
                    <div className="flex items-start gap-3.5">
                      <div className={`w-11 h-11 rounded-md flex items-center justify-center shrink-0 ${
                        isTerminal ? 'bg-primary text-white shadow-xs' : 'bg-muted text-muted-foreground'
                      }`}>
                        {isTerminal ? <Award className="w-6 h-6" /> : <ScrollText className="w-6 h-6" />}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-headings font-bold text-base text-foreground">
                            {result.termName}
                          </h3>
                          {isTerminal ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-amber-600" />
                              <span>Official Terminal Result Card</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              Mid-Term Evaluation
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${passMeta.cls}`}>
                            {passMeta.label}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                          <span className="font-semibold text-foreground">{result.className}</span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                            Session: {result.sessionName}
                          </span>
                          {result.published_at && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                Published: {new Date(result.published_at).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stats & Action Buttons */}
                    <div className="flex items-center gap-3 sm:gap-4 shrink-0 justify-between md:justify-end pt-2 md:pt-0 border-t md:border-t-0 border-border">
                      <div className="text-right">
                        <div className="font-headings font-extrabold text-base text-foreground font-mono">
                          {Number(result.obtained_marks).toFixed(0)} <span className="text-muted-foreground text-xs font-normal">/ {Number(result.total_marks).toFixed(0)}</span>
                        </div>
                        <div className="text-xs text-muted-foreground font-medium flex items-center justify-end gap-1.5">
                          <span className="font-bold text-foreground">
                            {result.percentage != null ? `${Number(result.percentage).toFixed(1)}%` : '—'}
                          </span>
                          {result.overall_grade && (
                            <span className="px-1.5 py-0.2 rounded bg-muted font-bold text-foreground">
                              Grade {result.overall_grade}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Download / Print Button */}
                      <button
                        onClick={() => setCardToPrint(result)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-sm bg-primary hover:bg-primary-hover hover:text-navy text-white text-xs font-bold transition shadow-xs cursor-pointer"
                        title="Download or Print Official Result Card"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Download / Print</span>
                        <span className="sm:hidden">Print</span>
                      </button>

                      {/* Expand / Collapse Button */}
                      <button
                        onClick={() => setExpandedCardId(isExpanded ? null : result.id)}
                        className="p-2 rounded-sm border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                        aria-label={isExpanded ? "Collapse subjects" : "Expand subjects"}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Subject Marks Table */}
                  {isExpanded && (
                    <div className="p-4 sm:p-5 bg-card space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-headings font-bold text-xs uppercase tracking-wider text-muted-foreground">
                          Subject-Wise Marks Breakdown
                        </h4>
                        <span className="text-xs text-muted-foreground">
                          {result.subjects.length} Subjects Evaluated
                        </span>
                      </div>

                      {/* High-quality Real World School Table */}
                      <div className="overflow-x-auto border border-border rounded-sm">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-muted/80 text-muted-foreground uppercase text-[10px] font-bold border-b border-border">
                            <tr>
                              <th className="px-3.5 py-2.5">#</th>
                              <th className="px-3.5 py-2.5">Subject</th>
                              <th className="px-3.5 py-2.5 text-right">Max Marks</th>
                              <th className="px-3.5 py-2.5 text-right">Obtained</th>
                              <th className="px-3.5 py-2.5 text-right">Percentage</th>
                              <th className="px-3.5 py-2.5 text-center">Grade</th>
                              <th className="px-3.5 py-2.5 text-center">Status</th>
                              <th className="px-3.5 py-2.5">Teacher Observations</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {result.subjects.map((sub, sIdx) => {
                              const isPassed = sub.passed === 1;
                              const isSupplementary = sub.supplementary?.is_passed === 1;

                              return (
                                <tr key={sub.id} className="hover:bg-muted/30 transition-colors">
                                  <td className="px-3.5 py-2.5 text-muted-foreground font-mono">
                                    {sIdx + 1}
                                  </td>
                                  <td className="px-3.5 py-2.5">
                                    <div className="font-semibold text-foreground">{sub.subjectName}</div>
                                    <div className="text-[10px] text-muted-foreground font-mono">{sub.subjectCode}</div>
                                  </td>
                                  <td className="px-3.5 py-2.5 text-right font-mono font-medium text-muted-foreground">
                                    {Number(sub.total_marks).toFixed(0)}
                                  </td>
                                  <td className="px-3.5 py-2.5 text-right font-mono font-bold text-foreground">
                                    {sub.is_absent ? (
                                      <span className="text-error">Absent</span>
                                    ) : sub.obtained_marks != null ? (
                                      Number(sub.obtained_marks).toFixed(0)
                                    ) : (
                                      '—'
                                    )}
                                  </td>
                                  <td className="px-3.5 py-2.5 text-right font-mono font-semibold">
                                    {sub.percentage != null ? `${Number(sub.percentage).toFixed(1)}%` : '—'}
                                  </td>
                                  <td className="px-3.5 py-2.5 text-center">
                                    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                                      sub.grade?.startsWith('A') 
                                        ? 'bg-success-bg text-success' 
                                        : sub.grade?.startsWith('B')
                                        ? 'bg-blue-50 text-blue-700'
                                        : sub.grade?.startsWith('C')
                                        ? 'bg-amber-50 text-amber-700'
                                        : 'bg-muted text-muted-foreground'
                                    }`}>
                                      {sub.grade || '—'}
                                    </span>
                                  </td>
                                  <td className="px-3.5 py-2.5 text-center">
                                    {isSupplementary ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                        <span>Cleared (Re-sit: {sub.supplementary?.grade})</span>
                                      </span>
                                    ) : sub.passed === null ? (
                                      <span className="text-muted-foreground">—</span>
                                    ) : isPassed ? (
                                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-success-bg text-success">
                                        Pass
                                      </span>
                                    ) : (
                                      <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-error-bg text-error">
                                        Fail
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-3.5 py-2.5 text-muted-foreground italic text-[11px] max-w-xs truncate">
                                    {sub.teacher_remarks || 'Satisfactory performance.'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          {/* Table Footer Totals Row */}
                          <tfoot className="bg-muted/60 font-bold border-t-2 border-border text-foreground">
                            <tr>
                              <td colSpan={2} className="px-3.5 py-2.5 uppercase tracking-wider">
                                Grand Total / Aggregate
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-mono">
                                {Number(result.total_marks).toFixed(0)}
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-mono text-primary">
                                {Number(result.obtained_marks).toFixed(0)}
                              </td>
                              <td className="px-3.5 py-2.5 text-right font-mono">
                                {result.percentage != null ? `${Number(result.percentage).toFixed(1)}%` : '—'}
                              </td>
                              <td className="px-3.5 py-2.5 text-center">
                                {result.overall_grade || '—'}
                              </td>
                              <td className="px-3.5 py-2.5 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${passMeta.cls}`}>
                                  {passMeta.label}
                                </span>
                              </td>
                              <td className="px-3.5 py-2.5 text-muted-foreground text-[11px] font-normal not-italic">
                                Evaluated by School Academic Board
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>

                      {/* Card Footer Notes & Print Quick Button */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 text-xs">
                        <div className="text-muted-foreground">
                          {result.remarks ? (
                            <span className="italic">"{result.remarks}"</span>
                          ) : (
                            <span>Official examination transcript published by Controller of Examinations.</span>
                          )}
                        </div>

                        <button
                          onClick={() => setCardToPrint(result)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-sm bg-muted hover:bg-secondary hover:text-secondary-foreground text-foreground transition cursor-pointer self-start sm:self-auto"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Generate Official Printable Result Card</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Official Result Card Modal (Printable & Downloadable via print-to-PDF) */}
      {cardToPrint && (
        <Modal
          isOpen={!!cardToPrint}
          onClose={() => setCardToPrint(null)}
          title="Official Terminal Examination Result Card"
          maxWidth="max-w-2xl"
        >
          <div className="space-y-5 print-area">
            {/* Top Certificate Header */}
            <div className="bg-navy text-white rounded-md p-5 flex items-center justify-between print:rounded-none print:p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white p-1 overflow-hidden shrink-0">
                  <img
                    src="/logowb.png"
                    alt="Cambridge Education System Logo"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/logo.jpeg';
                    }}
                  />
                </div>
                <div>
                  <div className="font-headings font-extrabold text-lg tracking-wide uppercase">
                    CAMBRIDGE EDUCATION SYSTEM
                  </div>
                  <div className="text-xs text-white/80">
                    Excellence in Modern & Cambridge Academic Curriculum
                  </div>
                </div>
              </div>

              <div className="text-right hidden sm:block print:block">
                <div className="font-headings font-extrabold text-sm tracking-wider uppercase text-secondary">
                  RESULT CARD
                </div>
                <div className="text-[10px] text-white/70">
                  Official Academic Transcript
                </div>
              </div>
            </div>

            {/* Student & Class Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/40 p-3.5 rounded-md text-xs border border-border">
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase">Student Name</span>
                <span className="font-bold text-foreground text-sm">{profile.name || 'Student'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase">Roll / Admission No</span>
                <span className="font-mono font-bold text-foreground">{profile.rollNumber || 'CES-STU'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase">Class & Section</span>
                <span className="font-bold text-foreground">{cardToPrint.className}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px] uppercase">Academic Session</span>
                <span className="font-bold text-foreground">{cardToPrint.sessionName}</span>
              </div>
            </div>

            {/* Official Subject Marks Table */}
            <div className="border border-border rounded-sm overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-navy text-white text-[11px]">
                    <th className="px-3 py-2 text-left font-bold">SUBJECT</th>
                    <th className="px-3 py-2 text-right font-bold">MAX MARKS</th>
                    <th className="px-3 py-2 text-right font-bold">OBTAINED</th>
                    <th className="px-3 py-2 text-right font-bold">PERCENT</th>
                    <th className="px-3 py-2 text-center font-bold">GRADE</th>
                    <th className="px-3 py-2 text-center font-bold">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {cardToPrint.subjects.map((s) => (
                    <tr key={s.id}>
                      <td className="px-3 py-2 font-medium text-foreground">
                        {s.subjectName}
                        {s.supplementary?.is_passed ? (
                          <span className="text-[10px] text-emerald-700 font-bold block">
                            [Cleared via Re-sit: Grade {s.supplementary.grade}]
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                        {Number(s.total_marks).toFixed(0)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-foreground">
                        {s.is_absent ? 'Absent' : s.obtained_marks != null ? Number(s.obtained_marks).toFixed(0) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {s.percentage != null ? `${Number(s.percentage).toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-3 py-2 text-center font-bold">
                        {s.grade || '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {s.supplementary?.is_passed ? (
                          <span className="text-emerald-700 font-bold text-[10px]">Cleared</span>
                        ) : s.passed ? (
                          <span className="text-success font-semibold">Pass</span>
                        ) : (
                          <span className="text-error font-semibold">Fail</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {/* Totals Row */}
                  <tr className="font-bold bg-muted/50 border-t-2 border-border text-foreground">
                    <td className="px-3 py-2 uppercase">Total Aggregate</td>
                    <td className="px-3 py-2 text-right font-mono">{Number(cardToPrint.total_marks).toFixed(0)}</td>
                    <td className="px-3 py-2 text-right font-mono text-primary font-extrabold">
                      {Number(cardToPrint.obtained_marks).toFixed(0)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {cardToPrint.percentage != null ? `${Number(cardToPrint.percentage).toFixed(1)}%` : '—'}
                    </td>
                    <td className="px-3 py-2 text-center font-extrabold text-sm text-primary">
                      {cardToPrint.overall_grade || '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="font-extrabold">
                        {(PASS_LABEL[cardToPrint.pass_status] || PASS_LABEL.PENDING).label}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Official Signatures & Seal Section (for printing) */}
            <div className="pt-6 pb-2 grid grid-cols-3 gap-6 text-center text-xs">
              <div>
                <div className="border-b border-border w-32 mx-auto mb-1.5 h-6" />
                <span className="text-muted-foreground text-[10px] uppercase font-semibold">
                  Class Teacher
                </span>
              </div>
              <div>
                <div className="border-b border-border w-32 mx-auto mb-1.5 h-6" />
                <span className="text-muted-foreground text-[10px] uppercase font-semibold">
                  Controller of Exams
                </span>
              </div>
              <div>
                <div className="border-b border-border w-32 mx-auto mb-1.5 h-6" />
                <span className="text-muted-foreground text-[10px] uppercase font-semibold">
                  Principal Signature & Seal
                </span>
              </div>
            </div>

            {/* Institution Footer */}
            <div className="bg-navy text-white rounded-md px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] print:rounded-none">
              <span>Tel: 0300 511 8716</span>
              <span>Web: www.cambridgeeducation.uk.com</span>
              <span>Islamabad, Pakistan</span>
            </div>

            {/* Print & Download Action Buttons (Hidden when printing) */}
            <div className="flex items-center justify-between pt-2 border-t border-border print:hidden">
              <span className="text-xs text-muted-foreground">
                Tip: Use "Save as PDF" in the print destination to download a digital PDF file.
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCardToPrint(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-sm border border-border hover:bg-muted text-foreground transition cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-sm bg-primary text-white hover:bg-primary-hover hover:text-navy transition shadow-sm cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print / Save as PDF</span>
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

