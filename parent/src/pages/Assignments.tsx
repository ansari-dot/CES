import React, { useState } from 'react';
import { Clock, Send, CheckCircle2, AlertCircle, Paperclip } from 'lucide-react';
import { useChildData, useParent } from '../context/ParentContext';
import { openProtectedFile } from '../services/api';
import { StatusChip, RequireChild, LoadingBlock, ErrorBlock, EmptyBlock } from '../components/common';
import { formatDateTime, TASK_TYPE_LABELS } from '../lib/format';

interface AssignmentRow {
  id: number;
  title: string;
  instructions: string;
  taskType: string;
  subjectName: string;
  teacherName: string;
  deadline: string;
  totalMarks: number;
  status: string;
  handoutName: string | null;
  handoutUrl: string | null;
  submissionStatus: 'PENDING' | 'OVERDUE' | 'SUBMITTED' | 'GRADED';
  resubmitRequested: boolean;
  submittedAt: string | null;
  isLate: boolean;
  marksAwarded: number | null;
  feedback: string;
  gradedAt: string | null;
}

const STATUS_LABELS: Record<AssignmentRow['submissionStatus'], string> = {
  PENDING: 'Not Submitted',
  OVERDUE: 'Overdue',
  SUBMITTED: 'Submitted',
  GRADED: 'Graded',
};

function AssignmentsContent() {
  const { showToast } = useParent();
  const { data, loading, error, reload } = useChildData<AssignmentRow[]>((id) => `/api/v1/parents/me/children/${id}/assignments`);
  const [filter, setFilter] = useState('All');

  if (loading && !data) return <LoadingBlock message="Loading assignments…" />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  const items = data || [];

  const counts = {
    pending: items.filter((i) => i.submissionStatus === 'PENDING').length,
    submitted: items.filter((i) => i.submissionStatus === 'SUBMITTED').length,
    graded: items.filter((i) => i.submissionStatus === 'GRADED').length,
    overdue: items.filter((i) => i.submissionStatus === 'OVERDUE').length,
  };

  const filtered = items.filter((i) => filter === 'All' || i.submissionStatus === filter);

  const downloadHandout = async (item: AssignmentRow) => {
    if (!item.handoutUrl) return;
    try {
      await openProtectedFile(item.handoutUrl, item.handoutName || undefined, true);
    } catch (err: any) {
      showToast(err.message || 'Unable to download the handout', 'error');
    }
  };

  const tiles = [
    { label: 'Not Submitted', value: counts.pending, icon: Clock, cls: 'bg-warning-bg text-warning' },
    { label: 'Submitted', value: counts.submitted, icon: Send, cls: 'bg-info-bg text-info' },
    { label: 'Graded', value: counts.graded, icon: CheckCircle2, cls: 'bg-success-bg text-success' },
    { label: 'Overdue', value: counts.overdue, icon: AlertCircle, cls: 'bg-error-bg text-error' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.label} className="bg-card border border-border rounded-md p-4 flex items-center gap-3 shadow-sm">
              <div className={`w-10 h-10 rounded-sm flex items-center justify-center ${t.cls}`}>
                <Icon className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground font-medium">{t.label}</div>
                <div className="text-xl font-bold font-headings text-foreground">{t.value}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 flex-wrap">
        {['All', 'PENDING', 'SUBMITTED', 'GRADED', 'OVERDUE'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-sm text-xs font-bold transition cursor-pointer ${
              filter === f ? 'bg-primary text-white' : 'bg-card border border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {f === 'All' ? 'All' : STATUS_LABELS[f as AssignmentRow['submissionStatus']]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyBlock title="No assignments" description="Assignments, quizzes and tests set by teachers will appear here." />
      ) : (
        <div className="bg-card border border-border rounded-md divide-y divide-border shadow-sm overflow-hidden">
          {filtered.map((item) => {
            const border =
              item.submissionStatus === 'GRADED'
                ? 'border-l-success'
                : item.submissionStatus === 'SUBMITTED'
                ? 'border-l-info'
                : item.submissionStatus === 'OVERDUE'
                ? 'border-l-error'
                : 'border-l-warning';
            return (
              <div key={item.id} className={`p-4 border-l-4 ${border}`}>
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-foreground">{item.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {TASK_TYPE_LABELS[item.taskType] || 'Assignment'} · {item.subjectName} · {item.teacherName} · Due {formatDateTime(item.deadline)} · {item.totalMarks} marks
                    </div>
                    {item.submittedAt && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Submitted {formatDateTime(item.submittedAt)}
                        {item.isLate ? ' · after the deadline' : ''}
                      </div>
                    )}
                    {item.resubmitRequested && (
                      <div className="text-xs text-warning font-semibold mt-1">Returned by the teacher for resubmission{item.feedback ? `: ${item.feedback}` : ''}</div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {item.submissionStatus === 'GRADED' && item.marksAwarded != null && (
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-sm bg-success-bg text-success border border-success/30">
                        {item.marksAwarded}/{item.totalMarks}
                      </span>
                    )}
                    <StatusChip status={item.resubmitRequested ? 'Returned' : STATUS_LABELS[item.submissionStatus]} />
                  </div>
                </div>

                {item.submissionStatus === 'GRADED' && item.feedback && (
                  <p className="text-xs text-muted-foreground italic bg-muted/40 p-2.5 rounded-sm border-l-2 border-primary mt-2">“{item.feedback}”</p>
                )}

                {item.handoutUrl && (
                  <button
                    onClick={() => downloadHandout(item)}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline cursor-pointer"
                  >
                    <Paperclip className="w-3.5 h-3.5" /> {item.handoutName || 'Download handout'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Assignments() {
  return (
    <RequireChild>
      <AssignmentsContent />
    </RequireChild>
  );
}
