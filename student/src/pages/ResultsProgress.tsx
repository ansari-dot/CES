import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { fetchMyGrades } from '../store/slices/gradesSlice';
import { MessageSquareQuote, RefreshCw, AlertCircle, Award, CheckCircle2, BookOpen } from 'lucide-react';
import TermResultsSection from '../components/results/TermResultsSection';
import { LoadingBlock } from '../components/common/LoadingBlock';

export default function ResultsProgress() {
  const dispatch = useDispatch<AppDispatch>();
  const { data, loading, error } = useSelector((state: RootState) => state.grades);

  useEffect(() => {
    dispatch(fetchMyGrades());
  }, [dispatch]);

  if (loading && !data) {
    return <LoadingBlock message="Loading grades and academic progress..." />;
  }

  if (error && !data) {
    return (
      <div className="bg-card border border-border rounded-md p-8 text-center space-y-4 shadow-sm">
        <AlertCircle className="w-10 h-10 text-error mx-auto stroke-[1.8]" />
        <div>
          <h3 className="text-base font-bold text-foreground">Unable to Load Academic Results</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">{error}</p>
        </div>
        <button
          onClick={() => dispatch(fetchMyGrades())}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-bold rounded-sm hover:bg-primary-hover transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const summary = data?.summary;
  const subjects = data?.subjects || [];
  const recentResults = data?.recentResults || [];

  const completionPercent = summary && summary.totalTasks > 0
    ? Math.round((summary.submittedTasks / summary.totalTasks) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* 3 Overview Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Overall Average */}
        <div className="bg-navy text-white rounded-md p-5 shadow-sm relative overflow-hidden">
          <div className="text-xs font-semibold opacity-70 uppercase tracking-wider">Overall Average</div>
          <div className="text-3xl font-headings font-bold mt-1">
            {summary?.overallAverageDisplay || '—'}
          </div>
          <div className="text-xs opacity-80 mt-1 flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-yellow-300 inline shrink-0" />
            <span>
              Grade {summary?.overallGrade || '—'} · GPA {summary ? summary.gpa.toFixed(1) : '—'} / 4.0
            </span>
          </div>
          {summary?.evaluationStatus && (
            <span className="absolute top-4 right-4 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 uppercase tracking-wider">
              {summary.evaluationStatus}
            </span>
          )}
        </div>

        {/* Coursework & Assignments Done */}
        <div className="bg-card border border-border rounded-md p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assignments Done</div>
            <span className="text-[11px] font-semibold text-muted-foreground">
              {summary?.gradedTasks || 0} Graded
            </span>
          </div>
          <div className="text-3xl font-headings font-bold text-foreground mt-1">
            {summary?.submittedTasks || 0}/{summary?.totalTasks || 0}
          </div>
          <div className="w-full bg-muted h-2 rounded-full mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, completionPercent)}%` }}
            />
          </div>
          <div className="text-[11px] text-muted-foreground mt-1.5 flex justify-between">
            <span>{completionPercent}% completed</span>
            {summary && summary.pendingGradingTasks > 0 && (
              <span className="text-amber-600 font-medium">{summary.pendingGradingTasks} awaiting grading</span>
            )}
          </div>
        </div>

        {/* Attendance */}
        <div className="bg-card border border-border rounded-md p-5 shadow-sm">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Attendance</div>
          <div className="text-3xl font-headings font-bold text-foreground mt-1">
            {summary?.attendanceRate != null ? `${summary.attendanceRate}%` : '—'}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 inline shrink-0" />
            <span>Recorded across term class lessons</span>
          </div>
        </div>
      </div>

      {/* Subject Performance Horizontal Bars */}
      <div className="bg-card border border-border rounded-md p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="font-headings font-bold text-base text-foreground">
            Subject performance
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            {subjects.length} Enrolled {subjects.length === 1 ? 'Subject' : 'Subjects'}
          </span>
        </div>

        {subjects.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            <BookOpen className="w-8 h-8 mx-auto text-muted-foreground/60 mb-2" />
            No subject grades recorded yet.
          </div>
        ) : (
          <div className="space-y-4">
            {subjects.map((sub) => (
              <div key={sub.subjectId || sub.subjectName} className="flex items-center gap-4">
                <div className="w-32 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">{sub.subjectName}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{sub.teacherName || sub.subjectCode}</div>
                </div>

                <div className="flex-1 bg-muted h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-500"
                    style={{ width: sub.width || '0%' }}
                  />
                </div>

                <span className="text-xs font-bold text-foreground w-12 text-right">
                  {sub.percentage != null ? `${sub.percentage}%` : '—'}
                </span>

                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-sm w-9 text-center ${
                    sub.grade.startsWith('A')
                      ? 'bg-success-bg text-success'
                      : sub.grade.startsWith('B')
                      ? 'bg-blue-50 text-blue-700'
                      : sub.grade.startsWith('C')
                      ? 'bg-yellow-50 text-yellow-700'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {sub.grade}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Results List */}
      <div className="bg-card border border-border rounded-md p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="font-headings font-bold text-base text-foreground">
            Recent graded results
          </div>
          <span className="text-xs text-muted-foreground">
            {recentResults.length} Graded {recentResults.length === 1 ? 'task' : 'tasks'}
          </span>
        </div>

        {recentResults.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            No graded submissions to display yet. Complete your assignments to receive teacher marks and feedback!
          </div>
        ) : (
          <div className="divide-y divide-border">
            {recentResults.map((item) => (
              <div key={item.submissionId} className="py-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-foreground">{item.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {item.subjectName} · {item.teacherName}
                      {item.gradedAt && (
                        <span> · {new Date(item.gradedAt).toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-foreground font-mono">
                      {item.marksAwarded} / {item.maxMarks}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-sm ${
                        item.grade.startsWith('A')
                          ? 'bg-success-bg text-success'
                          : item.grade.startsWith('B')
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-secondary text-primary'
                      }`}
                    >
                      {item.grade}
                    </span>
                  </div>
                </div>

                {item.feedback && (
                  <div className="bg-muted/40 border-l-2 border-primary/60 px-3 py-1.5 rounded-r text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Teacher feedback: </span>
                    “{item.feedback}”
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Teacher Quote / Evaluation Remark */}
        <div className="mt-5 bg-muted/60 border border-border rounded-sm p-3.5 flex items-start gap-2.5 text-xs text-foreground">
          <MessageSquareQuote className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div>
            {summary?.latestRemark ? (
              <span>
                “{summary.latestRemark.comment}” — <span className="font-semibold">{summary.latestRemark.teacherName}</span> ({summary.latestRemark.subjectName})
              </span>
            ) : (
              <span>
                “Consistent effort and timely assignment submissions lead to continuous academic excellence. Keep striving!” — <span className="font-semibold">Academic Faculty</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Official term results, promotion status & academic year history */}
      <TermResultsSection studentName={summary?.studentName} />
    </div>
  );
}
