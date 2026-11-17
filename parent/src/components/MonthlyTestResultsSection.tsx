import React, { useState } from 'react';
import { Award, CheckCircle2, XCircle, Clock, CalendarDays, Megaphone, PencilLine } from 'lucide-react';
import { useChildData } from '../context/ParentContext';
import { formatDate } from '../lib/format';

/**
 * Checked & published quiz / monthly test / exam results for the selected child.
 * The API only returns attempts that the teacher has fully graded AND whose results
 * have been published, and never includes questions or answer keys.
 */
interface AssessmentResultItem {
  attemptId: number;
  testId: number;
  title: string;
  examType: 'CLASS_QUIZ' | 'MONTHLY_TEST' | 'MID_TERM' | 'FINAL_TERM' | string;
  className: string;
  subjectName: string;
  quizDate: string | null;
  totalMarks: number;
  passingMarks: number;
  mcqScore: number;
  subjectiveScore: number;
  totalScore: number;
  percentage: number;
  isPassed: boolean;
  resultStatus: 'PASSED' | 'BELOW_PASSING';
  teacherRemarks: string | null;
  submittedAt: string | null;
  publishedAt: string | null;
  correctionCount: number;
  lastCorrectedAt: string | null;
}

interface ResultsApiResponse {
  results: AssessmentResultItem[];
}

const TYPE_LABELS: Record<string, string> = {
  CLASS_QUIZ: 'Quiz',
  MONTHLY_TEST: 'Monthly Test',
  MID_TERM: 'Mid-Term',
  FINAL_TERM: 'Final-Term'
};

const FILTERS: { id: string; label: string; match: (t: string) => boolean }[] = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'quiz', label: 'Quizzes', match: (t) => t === 'CLASS_QUIZ' },
  { id: 'monthly', label: 'Monthly Tests', match: (t) => t === 'MONTHLY_TEST' },
  { id: 'exam', label: 'Exams', match: (t) => t === 'MID_TERM' || t === 'FINAL_TERM' }
];

export const MonthlyTestResultsSection: React.FC = () => {
  const [filter, setFilter] = useState('all');
  const { data, loading } = useChildData<ResultsApiResponse>((id) => `/api/v1/assessments/parent/${id}/results`);

  const results: AssessmentResultItem[] = Array.isArray(data?.results) ? data!.results : [];

  if (loading && !data) return null;
  if (results.length === 0) return null;

  const active = FILTERS.find((f) => f.id === filter) || FILTERS[0];
  const visible = results.filter((r) => active.match(r.examType));

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-primary" />
          <h3 className="font-headings font-bold text-base text-foreground">Quizzes, Monthly Tests &amp; Examinations</h3>
        </div>
        <div className="flex gap-1.5">
          {FILTERS.map((f) => {
            const count = results.filter((r) => f.match(r.examType)).length;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-sm text-xs font-bold transition cursor-pointer ${
                  filter === f.id ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {f.label}
                {f.id !== 'all' && count > 0 ? ` (${count})` : ''}
              </button>
            );
          })}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="text-xs text-muted-foreground bg-card border border-border rounded-md px-4 py-5">
          No published {active.label.toLowerCase()} results yet. Results appear here after the teacher checks and publishes them.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {visible.map((r) => (
            <div
              key={r.attemptId}
              className={`bg-card border rounded-md p-4 shadow-xs space-y-3 ${r.isPassed ? 'border-border' : 'border-rose-200 bg-rose-50/20'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">{r.subjectName || 'Subject'}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {TYPE_LABELS[r.examType] || 'Assessment'}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-foreground mt-1 break-words">{r.title}</h4>
                  <div className="text-[11px] text-muted-foreground">{r.className}</div>
                </div>

                <div className="text-right shrink-0">
                  <div
                    className={`text-sm font-mono font-bold px-2 py-0.5 rounded-sm inline-block ${
                      r.isPassed ? 'bg-success-bg text-success border border-success/30' : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}
                  >
                    {r.totalScore} / {r.totalMarks}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center justify-end gap-1">
                    {r.isPassed ? (
                      <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> {r.percentage}% · Passed
                      </span>
                    ) : (
                      <span className="text-rose-600 font-bold flex items-center gap-0.5">
                        <XCircle className="w-3 h-3" /> {r.percentage}% · Below Passing
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground border-t border-border/60 pt-2">
                <div>
                  Passing Mark: <strong className="text-foreground">{r.passingMarks} pts</strong>
                </div>
                <div>
                  Objective / Written: <strong className="text-foreground">{r.mcqScore} + {r.subjectiveScore} pts</strong>
                </div>
              </div>

              {r.teacherRemarks && (
                <div className="text-xs text-muted-foreground italic bg-muted/40 p-2.5 rounded-sm border-l-2 border-primary break-words">
                  “{r.teacherRemarks}”
                </div>
              )}

              {r.correctionCount > 0 && (
                <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-sm px-2.5 py-1.5 flex items-center gap-1.5">
                  <PencilLine className="w-3 h-3 shrink-0" />
                  <span>
                    Result corrected by the teacher{r.lastCorrectedAt ? ` on ${formatDate(r.lastCorrectedAt)}` : ''}. The marks shown are the latest.
                  </span>
                </div>
              )}

              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                {r.quizDate && (
                  <span className="flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" /> Held {formatDate(r.quizDate)}
                  </span>
                )}
                {r.submittedAt && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Submitted {formatDate(r.submittedAt)}
                  </span>
                )}
                {r.publishedAt && (
                  <span className="flex items-center gap-1">
                    <Megaphone className="w-3 h-3" /> Published {formatDate(r.publishedAt)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
