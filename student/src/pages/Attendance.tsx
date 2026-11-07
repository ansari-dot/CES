import React from 'react';
import { useSelector } from 'react-redux';
import { CalendarCheck, Check, X, Clock, FileText } from 'lucide-react';
import { RootState } from '../store';
import { LoadingBlock } from '../components/common/LoadingBlock';

export default function Attendance() {
  const { overallPercentage, stats, timeline, history, loading } = useSelector((state: RootState) => state.attendance);

  const getTimelineColor = (type: string) => {
    switch (type) {
      case 'present': return 'bg-emerald-500';
      case 'absent': return 'bg-rose-500';
      case 'late': return 'bg-amber-500';
      case 'leave': return 'bg-blue-400';
      default: return 'bg-emerald-500';
    }
  };

  if (loading && history.length === 0) {
    return <LoadingBlock message="Loading your attendance records..." />;
  }

  return (
    <div className="space-y-6">
      {/* 5-Column Stats Header */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-card border border-border rounded-md p-4 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-8 h-8 rounded-sm bg-secondary flex items-center justify-center text-primary mb-1">
            <CalendarCheck className="w-4 h-4" />
          </div>
          <div className="text-2xl font-headings font-bold text-foreground">{overallPercentage}%</div>
          <div className="text-xs text-muted-foreground">Overall</div>
        </div>

        <div className="bg-card border border-border rounded-md p-4 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-8 h-8 rounded-sm bg-success-bg flex items-center justify-center text-success mb-1">
            <Check className="w-4 h-4" />
          </div>
          <div className="text-2xl font-headings font-bold text-foreground">{stats.present}</div>
          <div className="text-xs text-muted-foreground">Present</div>
        </div>

        <div className="bg-card border border-border rounded-md p-4 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-8 h-8 rounded-sm bg-error-bg flex items-center justify-center text-error mb-1">
            <X className="w-4 h-4" />
          </div>
          <div className="text-2xl font-headings font-bold text-foreground">{stats.absent}</div>
          <div className="text-xs text-muted-foreground">Absent</div>
        </div>

        <div className="bg-card border border-border rounded-md p-4 flex flex-col items-center justify-center text-center shadow-sm">
          <div className="w-8 h-8 rounded-sm bg-warning-bg flex items-center justify-center text-warning mb-1">
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-headings font-bold text-foreground">{stats.late}</div>
          <div className="text-xs text-muted-foreground">Leave (L)</div>
        </div>

        <div className="bg-card border border-border rounded-md p-4 flex flex-col items-center justify-center text-center shadow-sm col-span-2 md:col-span-1">
          <div className="w-8 h-8 rounded-sm bg-info-bg flex items-center justify-center text-info mb-1">
            <FileText className="w-4 h-4" />
          </div>
          <div className="text-2xl font-headings font-bold text-foreground">{stats.leave}</div>
          <div className="text-xs text-muted-foreground">Excused (E)</div>
        </div>
      </div>

      {/* 30-Day Strip visualization */}
      <div className="bg-card border border-border rounded-md p-4 shadow-sm">
        <div className="text-xs font-bold text-emerald-600 mb-3 uppercase tracking-wider">
          Last 30 Days · {stats.last30Days}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {timeline.map((type, idx) => (
            <div
              key={idx}
              title={`Day ${idx + 1}: ${type}`}
              className={`h-9 flex-1 min-w-[14px] rounded-sm ${getTimelineColor(type)} transition-opacity hover:opacity-80`}
            />
          ))}
        </div>
      </div>

      {/* Lecture-wise Attendance Register */}
      <div className="bg-card border border-border rounded-md shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <span className="font-headings font-bold text-base text-foreground">History</span>
          <span className="text-xs text-muted-foreground">{history.length} recorded lectures</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-muted/60 text-foreground border-b border-border">
                <th className="px-4 py-2.5 w-24 font-headings font-bold text-xs uppercase tracking-wide">Lecture#</th>
                <th className="px-4 py-2.5 min-w-[200px] font-headings font-bold text-xs uppercase tracking-wide">Date</th>
                <th className="px-4 py-2.5 font-headings font-bold text-xs uppercase tracking-wide">Topics</th>
                <th className="px-4 py-2.5 w-20 text-center font-headings font-bold text-xs uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-10 text-center text-muted-foreground text-xs">
                    No attendance has been recorded for you yet.
                  </td>
                </tr>
              ) : (
                history.map((record, idx) => {
                  const letter =
                    record.status === 'Present' ? 'P' : record.status === 'Absent' ? 'A' : record.status === 'Leave' ? 'L' : 'E';
                  const letterColor =
                    letter === 'P'
                      ? 'text-success'
                      : letter === 'A'
                        ? 'text-error'
                        : letter === 'L'
                          ? 'text-warning'
                          : 'text-primary';
                  const dateLabel = record.date
                    ? new Date(record.date).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'short',
                        day: '2-digit',
                        year: 'numeric',
                      })
                    : '—';
                  return (
                    <tr key={record.id} className="odd:bg-muted/40 hover:bg-muted/60 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-xs text-foreground">{history.length - idx}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground font-medium">{dateLabel}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-sm text-primary font-medium">{record.topic || record.subject}</span>
                        {record.topic && (
                          <span className="block text-[11px] text-muted-foreground">{record.subject} · {record.teacher}</span>
                        )}
                      </td>
                      <td className={`px-4 py-2.5 text-center font-headings font-extrabold text-sm ${letterColor}`} title={record.status}>
                        {letter}
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
  );
}
