import React from 'react';
import { useSelector } from 'react-redux';
import { CalendarCheck, Check, X, Clock, FileText } from 'lucide-react';
import { RootState } from '../store';
import StatusChip from '../components/common/StatusChip';
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
          <div className="text-xs text-muted-foreground">Late</div>
        </div>

        <div className="bg-card border border-border rounded-md p-4 flex flex-col items-center justify-center text-center shadow-sm col-span-2 md:col-span-1">
          <div className="w-8 h-8 rounded-sm bg-info-bg flex items-center justify-center text-info mb-1">
            <FileText className="w-4 h-4" />
          </div>
          <div className="text-2xl font-headings font-bold text-foreground">{stats.leave}</div>
          <div className="text-xs text-muted-foreground">Leave</div>
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

      {/* Attendance History */}
      <div className="bg-card border border-border rounded-md p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <span className="font-headings font-bold text-base text-foreground">History</span>
          <div className="flex gap-2">
            <button className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1.5 rounded-sm hover:text-foreground cursor-pointer">
              All subjects
            </button>
            <button className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1.5 rounded-sm hover:text-foreground cursor-pointer">
              This month
            </button>
          </div>
        </div>

        <div className="divide-y divide-border">
          {history.map((record) => (
            <div key={record.id} className="py-3 flex items-center justify-between">
              <div className="w-36 text-xs text-muted-foreground font-medium">
                {record.date}
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-foreground">{record.subject}</div>
                <div className="text-xs text-muted-foreground">{record.teacher}</div>
              </div>
              <StatusChip status={record.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
