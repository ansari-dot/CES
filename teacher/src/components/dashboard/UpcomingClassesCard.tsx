import React from 'react';
import { Calendar, Clock, ArrowRight, Video } from 'lucide-react';
import { UpcomingClassItem } from '../../services/dashboardApi';

export interface UpcomingClassesCardProps {
  classes: UpcomingClassItem[];
  onJoinClass: (classItem: UpcomingClassItem) => void;
  onViewAll?: () => void;
  joiningClassId?: string | null;
}

export const UpcomingClassesCard: React.FC<UpcomingClassesCardProps> = ({
  classes,
  onJoinClass,
  onViewAll,
  joiningClassId,
}) => {
  const getBadgeStyle = (code: string, color?: string) => {
    if (color === 'emerald' || code.includes('1')) {
      return 'bg-emerald-50 text-emerald-800 border border-emerald-200/60';
    }
    if (color === 'amber' || code.includes('2')) {
      return 'bg-amber-50 text-amber-800 border border-amber-200/60';
    }
    if (color === 'purple' || code.includes('3')) {
      return 'bg-purple-50 text-purple-800 border border-purple-200/60';
    }
    return 'bg-blue-50 text-blue-800 border border-blue-200/60';
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 flex flex-col justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100/80">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Upcoming Classes
          </h3>
        </div>

        <button
          onClick={onViewAll}
          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors"
        >
          <span>View All</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Class List */}
      <div className="divide-y divide-slate-100/80 pt-1 flex-1 flex flex-col justify-around">
        {classes.length === 0 ? (
          <div className="py-8 text-center text-slate-400">
            <Calendar className="w-6 h-6 mx-auto mb-1.5 text-slate-300" />
            <p className="text-xs font-semibold">No classes scheduled for today</p>
          </div>
        ) : (
          classes.slice(0, 3).map((item) => {
            const isJoining = joiningClassId === item.id;
            const isLive = item.status === 'live';

            return (
              <div
                key={item.id}
                className="py-3 flex items-center justify-between gap-3 group hover:bg-slate-50/60 px-2 rounded-xl transition-colors"
              >
                {/* Left: Code badge + Name & Time */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${getBadgeStyle(
                      item.classCode,
                      item.badgeColor
                    )}`}
                  >
                    {item.classCode}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {item.className}
                      </h4>
                      {isLive && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5 font-medium">
                      <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>{item.timeSlot}</span>
                    </div>
                  </div>
                </div>

                {/* Right: Join Button */}
                <button
                  onClick={() => onJoinClass(item)}
                  disabled={isJoining}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 flex items-center gap-1.5 ${
                    isLive
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-pulse'
                      : 'bg-blue-600 hover:bg-blue-700 text-white hover:shadow-blue-500/20'
                  } disabled:opacity-50`}
                >
                  <Video className="w-3 h-3" />
                  <span>{isJoining ? 'Joining...' : isLive ? 'Re-Join' : 'Join'}</span>
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

