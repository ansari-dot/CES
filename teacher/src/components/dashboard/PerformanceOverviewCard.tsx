import React, { useState } from 'react';
import { BarChart3, ChevronDown } from 'lucide-react';
import { PerformanceTrendPoint } from '../../services/dashboardApi';

export interface PerformanceOverviewCardProps {
  period: 'month' | 'term' | 'week';
  overallPerformance: number;
  performanceDelta: string;
  weeklyTrend: PerformanceTrendPoint[];
  onPeriodChange?: (period: 'month' | 'term' | 'week') => void;
}

export const PerformanceOverviewCard: React.FC<PerformanceOverviewCardProps> = ({
  period,
  overallPerformance,
  performanceDelta,
  weeklyTrend,
  onPeriodChange,
}) => {
  const [activeHoverIdx, setActiveHoverIdx] = useState<number | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Default points if empty
  const trendPoints =
    weeklyTrend && weeklyTrend.length > 0
      ? weeklyTrend
      : [
          { week: 'Week 1', label: 'Week 1', score: 50 },
          { week: 'Week 2', label: 'Week 2', score: 72 },
          { week: 'Week 3', label: 'Week 3', score: 78, isHighlight: true },
          { week: 'Week 4', label: 'Week 4', score: 65 },
        ];

  // SVG Chart Geometry
  const svgWidth = 420;
  const svgHeight = 170;
  const paddingX = 40;
  const paddingTop = 25;
  const paddingBottom = 30;

  const chartWidth = svgWidth - paddingX * 2;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const points = trendPoints.map((pt, i) => {
    const x = paddingX + (i / Math.max(1, trendPoints.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - (pt.score / 100) * chartHeight;
    return { x, y, ...pt };
  });

  // Generate smooth cubic bezier SVG path
  let pathD = '';
  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cx1 = p0.x + (p1.x - p0.x) / 2;
      const cy1 = p0.y;
      const cx2 = p0.x + (p1.x - p0.x) / 2;
      const cy2 = p1.y;
      pathD += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p1.x} ${p1.y}`;
    }
  }

  const areaD = pathD
    ? `${pathD} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
    : '';

  // Radial Gauge Geometry
  const gaugeSize = 120;
  const strokeWidth = 10;
  const radius = (gaugeSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (circumference * overallPerformance) / 100;

  const periodLabels = {
    month: 'This Month',
    term: 'This Term',
    week: 'This Week',
  };

  const highlightedPoint =
    activeHoverIdx !== null
      ? points[activeHoverIdx]
      : points.find((p) => p.isHighlight) || points[Math.min(2, points.length - 1)];

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-xs p-5 flex flex-col justify-between">
      {/* Card Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100/80">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Performance Overview
          </h3>
        </div>

        {/* Dropdown Filter */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs font-semibold text-slate-700 border border-slate-200/70 transition-colors"
          >
            <span>{periodLabels[period] || 'This Month'}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-1 w-32 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-30">
              {(['month', 'term', 'week'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    onPeriodChange?.(p);
                    setDropdownOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs font-semibold hover:bg-indigo-50 transition-colors ${
                    period === p ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-700'
                  }`}
                >
                  {periodLabels[p]}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Card Content: Area Chart + Radial Gauge */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center pt-3">
        {/* Left: Spline Area Chart (approx 8 cols) */}
        <div className="md:col-span-8 flex flex-col relative">
          <div className="w-full relative">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto overflow-visible select-none"
            >
              <defs>
                <linearGradient id="performanceAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Y-axis gridlines & labels */}
              {[100, 75, 50, 25, 0].map((val) => {
                const y = paddingTop + chartHeight - (val / 100) * chartHeight;
                return (
                  <g key={`y-${val}`}>
                    <text
                      x={paddingX - 10}
                      y={y + 3}
                      textAnchor="end"
                      className="fill-slate-400 text-[9px] font-medium"
                    >
                      {val}%
                    </text>
                    <line
                      x1={paddingX}
                      y1={y}
                      x2={svgWidth - paddingX + 10}
                      y2={y}
                      stroke="#f1f5f9"
                      strokeWidth="1"
                      strokeDasharray={val === 0 ? undefined : '2,2'}
                    />
                  </g>
                );
              })}

              {/* Gradient Area under curve */}
              {areaD && <path d={areaD} fill="url(#performanceAreaGrad)" />}

              {/* Spline Stroke Curve */}
              {pathD && (
                <path
                  d={pathD}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              )}

              {/* Data points */}
              {points.map((pt, i) => (
                <g
                  key={`pt-${i}`}
                  className="cursor-pointer"
                  onMouseEnter={() => setActiveHoverIdx(i)}
                  onMouseLeave={() => setActiveHoverIdx(null)}
                >
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={pt === highlightedPoint ? 5 : 3.5}
                    className={`${
                      pt === highlightedPoint
                        ? 'fill-blue-600 stroke-white stroke-2'
                        : 'fill-blue-500 hover:fill-blue-700'
                    } transition-all`}
                  />
                  {/* Invisible hit target for smooth hover */}
                  <circle cx={pt.x} cy={pt.y} r={14} fill="transparent" />
                </g>
              ))}

              {/* Highlighted Tooltip Card */}
              {highlightedPoint && (
                <g
                  transform={`translate(${highlightedPoint.x}, ${
                    highlightedPoint.y - 42
                  })`}
                  className="pointer-events-none transition-all duration-150"
                >
                  <rect
                    x="-30"
                    y="0"
                    width="60"
                    height="32"
                    rx="8"
                    fill="#ffffff"
                    filter="drop-shadow(0 4px 6px rgba(0, 0, 0, 0.08))"
                    stroke="#e2e8f0"
                    strokeWidth="1"
                  />
                  {/* Arrow pointing down */}
                  <polygon
                    points="0,37 -5,32 5,32"
                    fill="#ffffff"
                    stroke="#e2e8f0"
                    strokeWidth="1"
                  />
                  <text
                    x="0"
                    y="13"
                    textAnchor="middle"
                    className="fill-slate-900 font-extrabold text-[11px]"
                  >
                    {highlightedPoint.score}%
                  </text>
                  <text
                    x="0"
                    y="25"
                    textAnchor="middle"
                    className="fill-slate-500 font-medium text-[9px]"
                  >
                    {highlightedPoint.label}
                  </text>
                </g>
              )}

              {/* X-axis labels */}
              {points.map((pt, i) => (
                <text
                  key={`lbl-${i}`}
                  x={pt.x}
                  y={paddingTop + chartHeight + 18}
                  textAnchor="middle"
                  className="fill-slate-500 text-[10px] font-semibold"
                >
                  {pt.label}
                </text>
              ))}
            </svg>
          </div>
        </div>

        {/* Right: Circular Donut Gauge (approx 4 cols) */}
        <div className="md:col-span-4 flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-4">
          <div className="relative flex items-center justify-center">
            <svg
              width={gaugeSize}
              height={gaugeSize}
              viewBox={`0 0 ${gaugeSize} ${gaugeSize}`}
              className="transform -rotate-90"
            >
              {/* Background circle track */}
              <circle
                cx={gaugeSize / 2}
                cy={gaugeSize / 2}
                r={radius}
                fill="transparent"
                stroke="#f1f5f9"
                strokeWidth={strokeWidth}
              />
              {/* Active filled circular progress */}
              <circle
                cx={gaugeSize / 2}
                cy={gaugeSize / 2}
                r={radius}
                fill="transparent"
                stroke="#2563eb"
                strokeWidth={strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-700 ease-out"
              />
            </svg>

            {/* Value in center of radial gauge */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black text-slate-900 leading-none">
                {overallPerformance}%
              </span>
            </div>
          </div>

          <div className="text-center mt-2.5">
            <div className="text-xs font-bold text-slate-700">Overall Performance</div>
            <div className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-600 mt-0.5">
              <span>{performanceDelta}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

