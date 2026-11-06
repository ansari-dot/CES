import React, { useState } from 'react';
import { ChevronDown, ChevronUp, GraduationCap, History, Printer, ScrollText } from 'lucide-react';
import { useChildData, useParent } from '../context/ParentContext';
import { Modal } from './common';

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

const PASS_LABEL: Record<string, { label: string; cls: string }> = {
  PASSED: { label: 'Passed', cls: 'bg-success-bg text-success' },
  FAILED: { label: 'Failed', cls: 'bg-error-bg text-error' },
  SUPPLEMENTARY: { label: 'Supplementary', cls: 'bg-warning-bg text-warning' },
  PENDING: { label: 'Pending', cls: 'bg-muted text-muted-foreground' },
  ABSENT: { label: 'Absent', cls: 'bg-muted text-muted-foreground' }
};

const ENROLL_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  PROMOTED: 'Completed · Promoted',
  RETAINED: 'Completed · Retained',
  GRADUATED: 'Graduated',
  TRANSFERRED: 'Transferred',
  WITHDRAWN: 'Withdrawn'
};

const DECISION_TEXT: Record<string, string> = {
  PROMOTE: 'Promoted',
  RETAIN: 'Retained',
  GRADUATE: 'Graduated',
  WITHDRAW: 'Withdrawn',
  WITHHOLD: 'Decision pending'
};

export default function TermResultsSection() {
  const { selectedChild } = useParent();
  const { data } = useChildData<AcademicHistory>((id) => `/api/v1/results/child/${id}`);
  const [openId, setOpenId] = useState<number | null>(null);
  const [cardResult, setCardResult] = useState<TermResult | null>(null);

  if (!data) return null;
  const latestPromotion = data.promotions[0] || null;
  const studentName = selectedChild?.studentName || '—';

  return (
    <>
      {latestPromotion && (
        <div className="bg-card border border-border rounded-md p-5 flex items-start gap-3">
          <div className="w-9 h-9 rounded-md bg-secondary flex items-center justify-center text-secondary-foreground shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div className="text-sm">
            <div className="font-headings font-bold text-foreground">
              Promotion Status · {latestPromotion.fromSessionName}:{' '}
              {DECISION_TEXT[latestPromotion.decision] || latestPromotion.decision}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {latestPromotion.status === 'EXECUTED' && latestPromotion.decision === 'PROMOTE' && latestPromotion.toClassName
                ? `${studentName} has been enrolled in ${latestPromotion.toClassName} for ${latestPromotion.toSessionName}.`
                : latestPromotion.status === 'EXECUTED' && latestPromotion.decision === 'RETAIN' && latestPromotion.toClassName
                  ? `${studentName} will continue in ${latestPromotion.toClassName} for ${latestPromotion.toSessionName}.`
                  : latestPromotion.decision === 'GRADUATE'
                    ? `${studentName} has completed the final grade at Cambridge Education System.`
                    : 'The final decision will appear here once the school completes the year-end process.'}
            </p>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-md p-6">
        <div className="flex items-center gap-2 mb-1">
          <ScrollText className="w-4 h-4 text-primary" />
          <h3 className="font-headings font-bold text-base text-foreground">Official Term Results</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Examination results published by the school for {studentName}, including previous academic years.
        </p>
        {data.results.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No official term results have been published yet.</p>
        ) : (
          <div className="space-y-2">
            {data.results.map((r) => {
              const pass = PASS_LABEL[r.pass_status] || PASS_LABEL.PENDING;
              const open = openId === r.id;
              return (
                <div key={r.id} className="border border-border rounded-md overflow-hidden">
                  <button
                    onClick={() => setOpenId(open ? null : r.id)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40 transition"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">
                        {r.termName} · {r.sessionName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {r.className} · {Number(r.obtained_marks).toFixed(0)}/{Number(r.total_marks).toFixed(0)} marks
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-bold text-foreground font-mono">
                        {r.percentage != null ? `${Number(r.percentage).toFixed(1)}%` : '—'}
                        {r.overall_grade ? ` · ${r.overall_grade}` : ''}
                      </span>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-sm ${pass.cls}`}>{pass.label}</span>
                      {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </button>
                  {open && (
                    <div className="px-4 pb-4 border-t border-border">
                      <table className="w-full text-xs mt-3">
                        <thead className="text-muted-foreground uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="text-left py-1.5">Subject</th>
                            <th className="text-right py-1.5">Marks</th>
                            <th className="text-right py-1.5">%</th>
                            <th className="text-right py-1.5">Grade</th>
                            <th className="text-right py-1.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {r.subjects.map((s) => (
                            <tr key={s.id}>
                              <td className="py-1.5 font-medium text-foreground">{s.subjectName}</td>
                              <td className="py-1.5 text-right font-mono">
                                {s.is_absent ? 'Absent' : s.obtained_marks != null ? Number(s.obtained_marks).toFixed(0) : '—'} /{' '}
                                {Number(s.total_marks).toFixed(0)}
                              </td>
                              <td className="py-1.5 text-right font-mono">{s.percentage != null ? `${Number(s.percentage).toFixed(1)}%` : '—'}</td>
                              <td className="py-1.5 text-right font-semibold">{s.grade || '—'}</td>
                              <td className="py-1.5 text-right">
                                {s.passed === null ? '—' : s.passed ? (
                                  <span className="text-success font-semibold">Pass</span>
                                ) : (
                                  <span className="text-error font-semibold">Fail</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="flex justify-end mt-3">
                        <button
                          onClick={() => setCardResult(r)}
                          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-sm bg-muted hover:bg-[#ffc53a] text-foreground cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" /> Result Card
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-md p-6">
        <div className="flex items-center gap-2 mb-1">
          <History className="w-4 h-4 text-primary" />
          <h3 className="font-headings font-bold text-base text-foreground">Academic Year History</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">{studentName}'s enrollment across academic years.</p>
        {data.enrollments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">No enrollment history recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {data.enrollments.map((e) => (
              <li key={e.id} className="py-2.5 flex items-center justify-between gap-3">
                <div>
                  <span className="font-semibold text-foreground">{e.sessionName}</span>
                  <span className="text-muted-foreground"> · {e.className}</span>
                  {e.rollNo && <span className="text-muted-foreground text-xs"> · Roll {e.rollNo}</span>}
                </div>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-sm ${
                    e.status === 'ACTIVE'
                      ? 'bg-secondary text-secondary-foreground'
                      : e.status === 'GRADUATED' || e.status === 'PROMOTED'
                        ? 'bg-success-bg text-success'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {ENROLL_LABEL[e.status] || e.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {cardResult && (
        <Modal isOpen onClose={() => setCardResult(null)} title={`Result Card · ${cardResult.termName}`} maxWidth="max-w-xl">
          <div className="print-area space-y-4 text-sm" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' } as React.CSSProperties}>
            <div className="bg-navy text-white rounded-md px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center overflow-hidden shrink-0">
                  <img src="/logowb.png" alt="Cambridge Education System logo" className="w-full h-full object-contain" />
                </div>
                <div className="leading-tight">
                  <div className="font-headings font-extrabold tracking-wide text-lg">CAMBRIDGE</div>
                  <div className="text-xs text-white/85">Education System</div>
                </div>
              </div>
              <div className="font-headings font-extrabold text-xl tracking-[0.15em]">RESULT CARD</div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs bg-muted/40 rounded-sm p-3">
              <span className="text-muted-foreground">Student</span>
              <span className="font-semibold text-right">{studentName}</span>
              <span className="text-muted-foreground">Class</span>
              <span className="text-right">{cardResult.className}</span>
              <span className="text-muted-foreground">Academic Year · Term</span>
              <span className="text-right">
                {cardResult.sessionName} · {cardResult.termName}
              </span>
            </div>

            <table className="w-full text-xs border border-border">
              <thead>
                <tr className="bg-navy text-white">
                  <th className="px-3 py-2 text-left font-bold">SUBJECT</th>
                  <th className="px-3 py-2 text-right font-bold">MARKS</th>
                  <th className="px-3 py-2 text-right font-bold">PERCENT</th>
                  <th className="px-3 py-2 text-right font-bold">GRADE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {cardResult.subjects.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-1.5">{s.subjectName}</td>
                    <td className="px-3 py-1.5 text-right font-mono">
                      {s.is_absent ? 'Absent' : s.obtained_marks != null ? Number(s.obtained_marks).toFixed(0) : '—'} /{' '}
                      {Number(s.total_marks).toFixed(0)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">{s.percentage != null ? `${Number(s.percentage).toFixed(1)}%` : '—'}</td>
                    <td className="px-3 py-1.5 text-right font-semibold">{s.grade || '—'}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {Number(cardResult.obtained_marks).toFixed(0)} / {Number(cardResult.total_marks).toFixed(0)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {cardResult.percentage != null ? `${Number(cardResult.percentage).toFixed(1)}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-right">{cardResult.overall_grade || '—'}</td>
                </tr>
              </tbody>
            </table>

            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                Final Result:{' '}
                <span className="font-bold text-foreground">{(PASS_LABEL[cardResult.pass_status] || PASS_LABEL.PENDING).label}</span>
              </span>
              <span className="text-muted-foreground">
                Published {cardResult.published_at ? String(cardResult.published_at).split('T')[0] : ''}
              </span>
            </div>

            <div className="bg-navy text-white rounded-md px-4 py-2.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-[11px]">
              <span>0300 511 8716</span>
              <span>www.cambridgeeducation.uk.com</span>
              <span>Islamabad Pakistan</span>
            </div>

            <div className="flex justify-end print:hidden">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-sm bg-muted hover:bg-[#ffc53a] text-foreground cursor-pointer"
              >
                <Printer className="w-4 h-4" /> Print / Save as PDF
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
