import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: string;
    isPositive?: boolean;
    isNeutral?: boolean;
  };
  progress?: number; // 0 to 100 optional visual progress bar
  onClick?: () => void;
  accentColor?: 'blue' | 'emerald' | 'amber' | 'purple';
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtitle,
  icon,
  trend,
  progress,
  onClick,
  accentColor = 'blue'
}) => {
  const iconBgStyles = {
    blue: 'bg-sky-50 text-sky-600 border border-sky-100/90',
    emerald: 'bg-emerald-50 text-emerald-600 border border-emerald-100/90',
    amber: 'bg-amber-50 text-amber-600 border border-amber-100/90',
    purple: 'bg-indigo-50 text-indigo-600 border border-indigo-100/90'
  }[accentColor];

  const progressBgStyles = {
    blue: 'bg-sky-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    purple: 'bg-indigo-500'
  }[accentColor];

  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-xl bg-white border border-slate-200/80 text-slate-800 flex flex-col justify-between shadow-xs transition-all duration-150 ${
        onClick ? 'cursor-pointer hover:border-slate-300 hover:shadow-sm' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500 truncate font-heading tracking-tight">{label}</span>
        {icon && (
          <div className={`p-1.5 rounded-lg shrink-0 ${iconBgStyles}`}>
            {icon}
          </div>
        )}
      </div>

      <div className="mt-2.5 flex items-baseline justify-between gap-2">
        <div className="text-2xl font-bold tracking-tight text-slate-900 font-heading tabular-nums">
          {value}
        </div>
        {trend && (
          <span
            className={`text-[11px] font-semibold tabular-nums px-2 py-0.5 rounded-md border ${
              trend.isNeutral
                ? 'text-slate-600 bg-slate-50 border-slate-200/80'
                : trend.isPositive
                ? 'text-emerald-700 bg-emerald-50/70 border-emerald-200/70'
                : 'text-rose-700 bg-rose-50/70 border-rose-200/70'
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>

      {typeof progress === 'number' && (
        <div className="mt-2 w-full bg-slate-100 h-1 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${progressBgStyles}`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}

      {subtitle && (
        <div className="mt-2 text-xs text-slate-500 truncate border-t border-slate-100 pt-2 flex items-center gap-1.5">
          <span>{subtitle}</span>
        </div>
      )}
    </div>
  );
};

