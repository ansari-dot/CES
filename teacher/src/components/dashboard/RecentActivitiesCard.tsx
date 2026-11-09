import React from 'react';
import { Zap, Check, FileText, Trophy, Bell, ArrowRight } from 'lucide-react';
import { RecentActivityItem } from '../../services/dashboardApi';

export interface RecentActivitiesCardProps {
  activities: RecentActivityItem[];
  onViewAll?: () => void;
}

export const RecentActivitiesCard: React.FC<RecentActivitiesCardProps> = ({
  activities,
  onViewAll,
}) => {
  const getActivityIcon = (type: string, color?: string) => {
    switch (type) {
      case 'attendance':
        return (
          <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0">
            <Check className="w-4 h-4 stroke-[3]" />
          </div>
        );
      case 'assignment':
        return (
          <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center shrink-0">
            <FileText className="w-4 h-4" />
          </div>
        );
      case 'performance':
        return (
          <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
            <Trophy className="w-4 h-4" />
          </div>
        );
      case 'notice':
      default:
        return (
          <div className="w-8 h-8 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4" />
          </div>
        );
    }
  };

  const displayList =
    activities && activities.length > 0
      ? activities
      : [
          {
            id: '1',
            type: 'attendance' as const,
            title: 'Attendance marked for Class 1A',
            time: '2 min ago',
            color: 'blue',
          },
          {
            id: '2',
            type: 'assignment' as const,
            title: 'New assignment published',
            time: '15 min ago',
            color: 'purple',
          },
          {
            id: '3',
            type: 'performance' as const,
            title: 'Class 2B achieved 95% performance',
            time: '1 hour ago',
            color: 'emerald',
          },
          {
            id: '4',
            type: 'notice' as const,
            title: 'New notice: Exam Schedule Released',
            time: '2 hours ago',
            color: 'amber',
          },
        ];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 sm:p-5 flex flex-col justify-between h-full min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100/80">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-blue-500 fill-blue-500 shrink-0" />
          <h3 className="text-sm font-bold text-slate-900 tracking-tight truncate">
            Recent Activities
          </h3>
        </div>

        <button
          onClick={onViewAll}
          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors shrink-0"
        >
          <span>View All</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* List */}
      <div className="divide-y divide-slate-100/80 pt-1 flex-1 flex flex-col justify-around">
        {displayList.slice(0, 4).map((item) => (
          <div
            key={item.id}
            className="py-2.5 flex items-center justify-between gap-3 group hover:bg-slate-50/60 px-1.5 rounded-xl transition-colors min-w-0"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {getActivityIcon(item.type, item.color)}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800 truncate leading-snug" title={item.title}>
                  {item.title}
                </p>
              </div>
            </div>
            <span className="text-[11px] font-medium text-slate-400 shrink-0">
              {item.time}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

