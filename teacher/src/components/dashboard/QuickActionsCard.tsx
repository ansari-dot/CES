import React from 'react';
import { Zap, Video, FilePlus, ClipboardCheck, Megaphone } from 'lucide-react';

export interface QuickActionsCardProps {
  onStartZoom: () => void;
  onCreateAssignment: () => void;
  onTakeExam: () => void;
  onSendNotice: () => void;
}

export const QuickActionsCard: React.FC<QuickActionsCardProps> = ({
  onStartZoom,
  onCreateAssignment,
  onTakeExam,
  onSendNotice,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 sm:p-5 flex flex-col justify-between h-full min-w-0">
      {/* Header */}
      <div className="flex items-center gap-2 pb-3 border-b border-slate-100/80">
        <Zap className="w-4 h-4 text-blue-500 fill-blue-500 shrink-0" />
        <h3 className="text-sm font-bold text-slate-900 tracking-tight truncate">
          Quick Actions
        </h3>
      </div>

      {/* 2x2 Action Grid */}
      <div className="grid grid-cols-2 gap-2.5 pt-3 flex-1 items-center min-w-0">
        {/* 1. Start Zoom Class */}
        <button
          onClick={onStartZoom}
          className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-blue-50/70 hover:bg-blue-100/80 border border-blue-100 text-blue-900 transition-all hover:scale-[1.02] shadow-2xs group text-center min-w-0"
        >
          <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center mb-1.5 shadow-xs shadow-blue-500/20 group-hover:scale-110 transition-transform">
            <Video className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-bold leading-tight truncate max-w-full">
            Start Zoom
          </span>
        </button>

        {/* 2. Create Assignment */}
        <button
          onClick={onCreateAssignment}
          className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-emerald-50/70 hover:bg-emerald-100/80 border border-emerald-100 text-emerald-900 transition-all hover:scale-[1.02] shadow-2xs group text-center min-w-0"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center mb-1.5 shadow-xs shadow-emerald-500/20 group-hover:scale-110 transition-transform">
            <FilePlus className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-bold leading-tight truncate max-w-full">
            Assignment
          </span>
        </button>

        {/* 3. Take Exam */}
        <button
          onClick={onTakeExam}
          className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-purple-50/70 hover:bg-purple-100/80 border border-purple-100 text-purple-900 transition-all hover:scale-[1.02] shadow-2xs group text-center min-w-0"
        >
          <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center mb-1.5 shadow-xs shadow-purple-500/20 group-hover:scale-110 transition-transform">
            <ClipboardCheck className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-bold leading-tight truncate max-w-full">
            Take Exam
          </span>
        </button>

        {/* 4. Send Notice */}
        <button
          onClick={onSendNotice}
          className="flex flex-col items-center justify-center p-2.5 rounded-xl bg-amber-50/70 hover:bg-amber-100/80 border border-amber-100 text-amber-900 transition-all hover:scale-[1.02] shadow-2xs group text-center min-w-0"
        >
          <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center mb-1.5 shadow-xs shadow-amber-500/20 group-hover:scale-110 transition-transform">
            <Megaphone className="w-4 h-4" />
          </div>
          <span className="text-[11px] font-bold leading-tight truncate max-w-full">
            Send Notice
          </span>
        </button>
      </div>
    </div>
  );
};

