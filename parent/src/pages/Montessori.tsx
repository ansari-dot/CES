import React from 'react';
import { Sparkles, CalendarCheck, CheckCircle2, AlertTriangle, BookOpen, Video } from 'lucide-react';
import { useChildData, useParent } from '../context/ParentContext';
import { RequireChild, LoadingBlock, ErrorBlock, EmptyBlock, MetricCard } from '../components/common';
import { formatDate } from '../lib/format';

/**
 * Montessori progress for the selected (linked) child. Read-only: data comes from
 * /api/v1/montessori/parent/children/:id, which verifies the parent–child link.
 */
type ProgressStatus = 'EXCELLENT' | 'COMPLETED' | 'IMPROVING' | 'NEEDS_PRACTICE' | 'NOT_STARTED';
const LABELS: Record<ProgressStatus, string> = {
  EXCELLENT: 'Excellent',
  COMPLETED: 'Completed',
  IMPROVING: 'Improving',
  NEEDS_PRACTICE: 'Needs Practice',
  NOT_STARTED: 'Not Started'
};
const STYLES: Record<ProgressStatus, string> = {
  EXCELLENT: 'bg-emerald-100 text-emerald-700',
  COMPLETED: 'bg-sky-100 text-sky-700',
  IMPROVING: 'bg-amber-100 text-amber-700',
  NEEDS_PRACTICE: 'bg-rose-100 text-rose-700',
  NOT_STARTED: 'bg-muted text-muted-foreground'
};
const ATT: Record<string, string> = { PRESENT: 'Present', ABSENT: 'Absent', LATE: 'Late', LEAVE: 'Leave' };

const Status: React.FC<{ s: ProgressStatus }> = ({ s }) => (
  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${STYLES[s]}`}>{LABELS[s]}</span>
);

/**
 * Upcoming Montessori live classes of the child's current section. The server verifies the
 * parent–child link and releases the Zoom link only inside the join window.
 */
function LiveClassesCard() {
  const { data, loading, error, reload } = useChildData<{ section: { name: string } | null; upcoming: any[] }>(
    (id) => `/api/v1/montessori/parent/children/${id}/live-classes`
  );
  return (
    <div className="bg-card border border-border rounded-md shadow-sm">
      <div className="px-5 py-3 border-b border-border font-headings font-bold text-base flex items-center gap-2">
        <Video className="w-4 h-4 text-primary" /> Upcoming live classes
      </div>
      {loading && !data ? (
        <p className="px-5 py-6 text-xs text-muted-foreground">Loading live classes…</p>
      ) : error ? (
        <p className="px-5 py-6 text-xs text-muted-foreground">
          {error} <button onClick={reload} className="text-primary font-semibold hover:underline cursor-pointer">Retry</button>
        </p>
      ) : !data || data.upcoming.length === 0 ? (
        <p className="px-5 py-6 text-xs text-muted-foreground">No upcoming live classes are scheduled.</p>
      ) : (
        <div className="divide-y divide-border">
          {data.upcoming.map((c: any) => (
            <div key={c.id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <div className="font-semibold">
                  {c.title} {c.state === 'LIVE' && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 ml-1">Live now</span>}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(c.date)} · {c.startTime} – {c.endTime} · {c.teacherName}
                </div>
                {c.description && <div className="text-xs text-muted-foreground mt-0.5">{c.description}</div>}
                {c.canJoin && c.passcode && <div className="text-xs text-muted-foreground mt-0.5">Passcode: <span className="font-mono font-bold">{c.passcode}</span></div>}
              </div>
              {c.canJoin && c.joinUrl ? (
                <a href={c.joinUrl} target="_blank" rel="noopener noreferrer" className="bg-primary text-white text-xs font-bold px-4 py-2 rounded-sm inline-flex items-center justify-center gap-1.5 shrink-0">
                  <Video className="w-3.5 h-3.5" /> Join Live Class
                </a>
              ) : (
                <span className="text-[11px] text-muted-foreground shrink-0">Link opens 10 min before start</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MontessoriContent() {
  const { selectedChild } = useParent();
  const { data, loading, error, reload } = useChildData<any>((id) => `/api/v1/montessori/parent/children/${id}`);

  if (loading && !data) return <LoadingBlock message="Loading Montessori progress…" />;
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!data) return null;
  if (!data.currentSection && data.history.length === 0) {
    return <EmptyBlock title="Not enrolled in Montessori" description={`${selectedChild?.studentName || 'This child'} is not allocated to a Montessori section.`} />;
  }

  return (
    <div className="space-y-6">
      <div className="bg-primary text-white rounded-lg p-6 flex items-center gap-4 shadow-sm">
        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <div className="font-headings font-bold text-2xl">{data.currentSection ? data.currentSection.name : 'Montessori'}</div>
          <div className="text-xs opacity-80 mt-0.5">
            {data.currentSection ? `${data.currentSection.sessionName} · ` : ''}
            {data.teachers.length ? `Teacher: ${data.teachers.map((t: any) => t.name).join(', ')}` : 'Teacher not assigned yet'}
          </div>
        </div>
      </div>

      {data.currentSection && <LiveClassesCard />}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard icon={CalendarCheck} title="Attendance" value={data.attendance.attendanceRate != null ? `${data.attendance.attendanceRate}%` : '—'} subtitle={`${data.attendance.total} day(s) recorded`} colorScheme="primary" />
        <MetricCard icon={CheckCircle2} title="Activities Completed" value={data.completedActivities.length} subtitle="Latest teacher assessment" colorScheme="success" />
        <MetricCard icon={AlertTriangle} title="Needs Practice" value={data.needsImprovement.length} subtitle="Areas to support at home" colorScheme="warning" />
      </div>

      {data.needsImprovement.length > 0 && (
        <div className="bg-card border border-border rounded-md shadow-sm">
          <div className="px-5 py-3 border-b border-border font-headings font-bold text-base">Areas to practise</div>
          <div className="divide-y divide-border">
            {data.needsImprovement.map((p: any) => (
              <div key={p.id} className="px-5 py-3 flex items-start justify-between gap-3 text-sm">
                <div>
                  <div className="font-semibold">{p.activityTitle} <span className="text-xs text-muted-foreground font-normal">· {p.learningAreaName}</span></div>
                  {p.remarks && <div className="text-xs text-muted-foreground">{p.remarks}</div>}
                  {p.improvementSuggestions && <div className="text-xs text-primary mt-0.5">Suggestion: {p.improvementSuggestions}</div>}
                </div>
                <Status s={p.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-md shadow-sm">
          <div className="px-5 py-3 border-b border-border font-headings font-bold text-base flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /> Recent learning activities</div>
          {data.recentActivities.length === 0 ? (
            <p className="px-5 py-6 text-xs text-muted-foreground">No activities shared yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {data.recentActivities.map((a: any) => (
                <div key={a.id} className="px-5 py-2.5 text-sm">
                  <div className="font-semibold">{a.title}</div>
                  <div className="text-xs text-muted-foreground">{a.learningAreaName} · {formatDate(a.activityDate)}</div>
                  {a.objectives && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{a.objectives}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-card border border-border rounded-md shadow-sm">
          <div className="px-5 py-3 border-b border-border font-headings font-bold text-base">Recent attendance</div>
          {data.attendance.recent.length === 0 ? (
            <p className="px-5 py-6 text-xs text-muted-foreground">No attendance recorded yet.</p>
          ) : (
            <div className="px-5 py-3 flex flex-wrap gap-2">
              {data.attendance.recent.map((a: any) => (
                <span key={a.date} className={`text-[11px] px-2 py-1 rounded-sm ${a.status === 'ABSENT' ? 'bg-rose-100 text-rose-700' : a.status === 'LEAVE' ? 'bg-sky-100 text-sky-700' : a.status === 'LATE' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {formatDate(a.date)} · {ATT[a.status]}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-md shadow-sm">
        <div className="px-5 py-3 border-b border-border font-headings font-bold text-base">Progress history & teacher remarks</div>
        {data.history.length === 0 ? (
          <p className="px-5 py-6 text-xs text-muted-foreground">No progress recorded yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {data.history.map((h: any) => (
              <div key={h.id} className="px-5 py-3 flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <div className="font-semibold">{h.activityTitle} <span className="text-xs text-muted-foreground font-normal">· {h.learningAreaName} · {formatDate(h.observedOn)}</span></div>
                  {h.remarks && <div className="text-xs text-muted-foreground">“{h.remarks}”</div>}
                  {h.observationNotes && <div className="text-xs text-muted-foreground italic">{h.observationNotes}</div>}
                  {h.teacherName && <div className="text-[11px] text-muted-foreground/80">{h.teacherName}</div>}
                </div>
                <Status s={h.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Montessori() {
  return (
    <RequireChild>
      <MontessoriContent />
    </RequireChild>
  );
}
