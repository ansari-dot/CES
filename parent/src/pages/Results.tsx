import React, { useState } from 'react';
import { TrendingUp, Award, ClipboardList, CalendarCheck } from 'lucide-react';
import { useChildData } from '../context/ParentContext';
import { MetricCard, RequireChild, LoadingBlock, ErrorBlock, EmptyBlock } from '../components/common';
import { pct, formatDate, TASK_TYPE_LABELS } from '../lib/format';
import TermResultsSection from '../components/TermResultsSection';

interface ResultsData {
  summary: {
    studentName: string;
    className: string;
    overallAverage: number | null;
    overallGrade: string;
    totalTasks: number;
    submittedTasks: number;
    gradedTasks: number;
    attendanceRate: number | null;
    latestRemark: { teacherName: string; subjectName: string; comment: string; date: string } | null;
  };
  subjects: {
    subjectId: number;
    subjectName: string;
    teacherName: string;
    totalTasks: number;
    gradedTasks: number;
    marksObtained: number;
    maxMarks: number;
    percentage: number | null;
    grade: string;
  }[];
  recentResults: {
    submissionId: number;
    title: string;
    taskType: string;
    subjectName: string;
    teacherName: string;
    marksAwarded: number;
    maxMarks: number;
    percentage: number;
    grade: string;
    feedback: string;
    gradedAt: string;
  }[];
}

function ResultsContent() {
  const { data, loading, error, reload } = useChildData<ResultsData>((id) => `/api/v1/parents/me/children/${id}/results`);
  const [typeFilter, setTypeFilter] = useState('All');

  if (loading && !data) return <LoadingBlock message="Loading published results…" />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!data) return null;

  const { summary, subjects, recentResults } = data;
  const filtered = recentResults.filter((r) => typeFilter === 'All' || (r.taskType || 'ASSIGNMENT') === typeFilter);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={TrendingUp}
          title="Overall Average"
          value={pct(summary.overallAverage)}
          subtitle={summary.overallAverage != null ? `Grade ${summary.overallGrade}` : 'No published results yet'}
          colorScheme="primary"
        />
        <MetricCard icon={Award} title="Graded Assessments" value={summary.gradedTasks} subtitle={`of ${summary.totalTasks} assigned`} colorScheme="success" />
        <MetricCard icon={ClipboardList} title="Submitted" value={summary.submittedTasks} subtitle="Assignments turned in" colorScheme="secondary" />
        <MetricCard icon={CalendarCheck} title="Attendance" value={pct(summary.attendanceRate)} colorScheme="warning" />
      </div>

      <div className="bg-card border border-border rounded-md shadow-sm overflow-x-auto">
        <div className="px-5 py-3 border-b border-border font-headings font-bold text-base text-foreground">Subject-wise performance</div>
        {subjects.length === 0 ? (
          <p className="px-5 py-6 text-xs text-muted-foreground">No subjects are configured for this class yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2.5">Subject</th>
                <th className="px-4 py-2.5">Teacher</th>
                <th className="px-4 py-2.5 text-right">Graded</th>
                <th className="px-4 py-2.5 text-right">Marks</th>
                <th className="px-4 py-2.5 text-right">Average</th>
                <th className="px-4 py-2.5 text-right">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {subjects.map((s) => (
                <tr key={s.subjectId} className="hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{s.subjectName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{s.teacherName}</td>
                  <td className="px-4 py-2.5 text-right">{s.gradedTasks} / {s.totalTasks}</td>
                  <td className="px-4 py-2.5 text-right">{s.gradedTasks > 0 ? `${s.marksObtained} / ${s.maxMarks}` : '—'}</td>
                  <td className="px-4 py-2.5 text-right font-semibold">{pct(s.percentage)}</td>
                  <td className="px-4 py-2.5 text-right font-bold">{s.grade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="font-headings font-bold text-base text-foreground">Published results</div>
        <div className="flex gap-1.5">
          {['All', 'ASSIGNMENT', 'QUIZ', 'TEST', 'EXAM'].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-sm text-xs font-bold transition cursor-pointer ${
                typeFilter === t ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {t === 'All' ? 'All' : TASK_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyBlock title="No published results" description="Marks appear here once teachers publish them." />
      ) : (
        <div className="bg-card border border-border rounded-md divide-y divide-border shadow-sm">
          {filtered.map((r) => (
            <div key={r.submissionId} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold text-foreground">{r.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {TASK_TYPE_LABELS[r.taskType] || 'Assignment'} · {r.subjectName} · {r.teacherName} · Graded {formatDate(r.gradedAt)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-mono font-bold px-2 py-0.5 rounded-sm bg-success-bg text-success border border-success/30">
                    {r.marksAwarded}/{r.maxMarks}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">{r.percentage}% · {r.grade}</div>
                </div>
              </div>
              {r.feedback && (
                <p className="text-xs text-muted-foreground italic bg-muted/40 p-2.5 rounded-sm border-l-2 border-primary mt-2">“{r.feedback}”</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Official term results, promotion status & academic year history */}
      <TermResultsSection />
    </div>
  );
}

export default function Results() {
  return (
    <RequireChild>
      <ResultsContent />
    </RequireChild>
  );
}
