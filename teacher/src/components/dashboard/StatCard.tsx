import React from 'react';

export interface StatCardProps {
  title: string;
  value: string | number;
  trend: string;
  trendPositive?: boolean;
  icon: React.ReactNode;
  theme: 'blue' | 'emerald' | 'purple' | 'amber' | 'indigo';
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  trend,
  trendPositive = true,
  icon,
  theme,
  onClick,
}) => {
  const themeStyles = {
    blue: {
      cardBg: 'bg-white',
      border: 'border-blue-100/80 hover:border-blue-300',
      iconBg: 'bg-blue-600 text-white shadow-sm shadow-blue-500/30',
      waveFill: '#3b82f6',
      waveBg: 'rgba(59, 130, 246, 0.08)',
    },
    emerald: {
      cardBg: 'bg-white',
      border: 'border-emerald-100/80 hover:border-emerald-300',
      iconBg: 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/30',
      waveFill: '#10b981',
      waveBg: 'rgba(16, 185, 129, 0.08)',
    },
    indigo: {
      cardBg: 'bg-white',
      border: 'border-indigo-100/80 hover:border-indigo-300',
      iconBg: 'bg-[#36348e] text-white shadow-sm shadow-indigo-900/30',
      waveFill: '#4543a8',
      waveBg: 'rgba(69, 67, 168, 0.08)',
    },
    purple: {
      cardBg: 'bg-white',
      border: 'border-purple-100/80 hover:border-purple-300',
      iconBg: 'bg-purple-600 text-white shadow-sm shadow-purple-500/30',
      waveFill: '#8b5cf6',
      waveBg: 'rgba(139, 92, 246, 0.08)',
    },
    amber: {
      cardBg: 'bg-white',
      border: 'border-amber-100/80 hover:border-amber-300',
      iconBg: 'bg-amber-500 text-white shadow-sm shadow-amber-500/30',
      waveFill: '#f59e0b',
      waveBg: 'rgba(245, 158, 11, 0.08)',
    },
  }[theme];

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl ${themeStyles.cardBg} border ${themeStyles.border} p-4 sm:p-4.5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer group flex flex-col justify-between min-h-[120px]`}
    >
      {/* Top Row: Theme Icon Squircle on Left, Trend Badge Pill on Right */}
      <div className="flex items-center justify-between relative z-10 w-full gap-2">
        <div
          className={`w-10 h-10 rounded-xl ${themeStyles.iconBg} flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform duration-200`}
        >
          {icon}
        </div>

        {/* Trend Indicator Pill */}
        <div
          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border ${
            trendPositive
              ? 'bg-emerald-50 text-emerald-700 border-emerald-100/80'
              : 'bg-rose-50 text-rose-700 border-rose-100/80'
          }`}
        >
          <span className="whitespace-nowrap">{trend}</span>
        </div>
      </div>

      {/* Bottom Area: Large Metric Value & Subtitle (Full width, zero overlap) */}
      <div className="mt-3 relative z-10 min-w-0">
        <div
          className="text-2xl sm:text-2xl xl:text-3xl font-black text-slate-900 tracking-tight leading-tight truncate"
          title={String(value)}
        >
          {value}
        </div>
        <div
          className="text-xs font-semibold text-slate-500 mt-0.5 truncate"
          title={title}
        >
          {title}
        </div>
      </div>

      {/* Decorative Wave SVG at bottom */}
      <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
        <svg
          viewBox="0 0 500 120"
          preserveAspectRatio="none"
          className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity"
        >
          <path
            d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z"
            fill={themeStyles.waveBg}
          />
          <path
            d="M0,45 C150,95 350,5 500,55"
            fill="none"
            stroke={themeStyles.waveFill}
            strokeWidth="2.5"
            strokeOpacity="0.4"
          />
        </svg>
      </div>
    </div>
  );
};

