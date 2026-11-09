import React, { useState } from 'react';
import { PieChart, ChevronDown } from 'lucide-react';
import { SubjectDistributionItem } from '../../services/dashboardApi';

export interface SubjectDistributionCardProps {
  totalStudents: number;
  subjects: SubjectDistributionItem[];
}

export const SubjectDistributionCard: React.FC<SubjectDistributionCardProps> = ({
  totalStudents = 120,
  subjects,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'month' | 'term'>('month');

  const defaultSubjects: SubjectDistributionItem[] = [
    { name: 'Mathematics', count: 36, percentage: 30, color: '#2563eb' },
    { name: 'Science', count: 34, percentage: 28, color: '#10b981' },
    { name: 'Computer', count: 30, percentage: 25, color: '#8b5cf6' },
    { name: 'English', count: 20, percentage: 17, color: '#f59e0b' },
  ];

  const displaySubjects = subjects && subjects.length > 0 ? subjects : defaultSubjects;

  // Compute SVG Donut Chart Slices (Compact size prevents horizontal blowout)
  const size = 104;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;
  const slices = displaySubjects.map((sub) => {
    const strokeDasharray = `${(sub.percentage / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
    accumulatedPercent += sub.percentage;
    return {
      ...sub,
      strokeDasharray,
      strokeDashoffset,
    };
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-4 sm:p-5 flex flex-col justify-between h-full min-w-0">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100/80">
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-blue-500 shrink-0" />
          <h3 className="text-sm font-bold text-slate-900 tracking-tight truncate">
            Subject Distribution
          </h3>
        </div>

        <div className="relative shrink-0">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 border border-slate-200/70 transition-colors"
          >
            <span>{selectedPeriod === 'month' ? 'This Month' : 'This Term'}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-1 w-28 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-30">
              <button
                onClick={() => {
                  setSelectedPeriod('month');
                  setDropdownOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs font-semibold hover:bg-indigo-50 text-slate-700"
              >
                This Month
              </button>
              <button
                onClick={() => {
                  setSelectedPeriod('term');
                  setDropdownOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs font-semibold hover:bg-indigo-50 text-slate-700"
              >
                This Term
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Donut + Legend */}
      <div className="flex items-center gap-3 pt-3 min-w-0 flex-1">
        {/* Donut Chart */}
        <div className="relative flex items-center justify-center shrink-0">
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="transform -rotate-90 select-none"
          >
            {slices.map((slice, i) => (
              <circle
                key={`slice-${i}`}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={slice.color}
                strokeWidth={strokeWidth}
                strokeDasharray={slice.strokeDasharray}
                strokeDashoffset={slice.strokeDashoffset}
                className="transition-all duration-500"
              />
            ))}
          </svg>

          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-lg font-black text-slate-900 leading-none">
              {totalStudents}
            </span>
            <span className="text-[10px] font-semibold text-slate-400 mt-0.5">
              Students
            </span>
          </div>
        </div>

        {/* Legend with guaranteed truncation and no text collision */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-0 pl-1">
          {displaySubjects.map((sub, i) => (
            <div key={`leg-${i}`} className="flex items-center justify-between text-xs min-w-0 gap-1.5">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: sub.color }}
                />
                <span
                  className="font-semibold text-slate-700 truncate text-[11px] leading-tight"
                  title={`${sub.name} (${sub.percentage}%)`}
                >
                  {sub.name}
                </span>
              </div>
              <span className="font-bold text-slate-900 shrink-0 text-[11px] ml-1">
                {sub.percentage}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

