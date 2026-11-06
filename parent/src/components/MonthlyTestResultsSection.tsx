import React from 'react';
import { Award, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useChildData } from '../context/ParentContext';
import { formatDate } from '../lib/format';

interface MonthlyTestResultItem {
  testId: number;
  title: string;
  examType?: string;
  subjectName: string;
  totalMarks: number;
  passingMarks: number;
  durationMinutes: number;
  mcqScore: number;
  subjectiveScore: number;
  totalScore: number;
  isPassed: boolean;
  teacherRemarks: string | null;
  submittedAt: string | null;
}

interface MonthlyTestApiResponse {
  results: MonthlyTestResultItem[];
}

export const MonthlyTestResultsSection: React.FC = () => {
  const { data, loading } = useChildData<MonthlyTestApiResponse>(
    (id) => `/api/v1/assessments/parent/${id}/results`
  );

  const results = data?.results || [];

  if (loading && !data) {
    return null;
  }

  if (results.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5 text-primary" />
          <h3 className="font-headings font-bold text-base text-foreground">
            Tests &amp; Examinations Results
          </h3>
        </div>
        <span className="text-xs text-muted-foreground font-semibold">
          {results.length} Published {results.length === 1 ? 'Exam' : 'Exams'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {results.map((r) => {
          const percentage = Math.round((r.totalScore / (r.totalMarks || 1)) * 100);

          return (
            <div
              key={r.testId}
              className="bg-card border border-border rounded-md p-4 shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    {r.subjectName || 'Subject'}
                  </span>
                  <h4 className="text-sm font-bold text-foreground mt-1">{r.title}</h4>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-mono font-bold px-2 py-0.5 rounded-sm bg-success-bg text-success border border-success/30 inline-block">
                    {r.totalScore} / {r.totalMarks}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {percentage}% · {r.isPassed ? 'Passed' : 'Needs Work'}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground border-t border-border/60 pt-2">
                <div>
                  MCQ Score: <strong className="text-foreground">{r.mcqScore} pts</strong>
                </div>
                <div>
                  Subjective: <strong className="text-foreground">{r.subjectiveScore} pts</strong>
                </div>
              </div>

              {r.teacherRemarks && (
                <div className="text-xs text-muted-foreground italic bg-muted/40 p-2.5 rounded-sm border-l-2 border-primary">
                  “{r.teacherRemarks}”
                </div>
              )}

              {r.submittedAt && (
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Submitted on {formatDate(r.submittedAt)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

