import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { fetchMyGrades, AcademicItem } from '../store/slices/gradesSlice';
import { 
  Trophy, 
  ClipboardList, 
  CheckCircle2, 
  Star, 
  TrendingUp, 
  ListFilter, 
  BarChart3, 
  Check, 
  ChevronDown, 
  Sparkles,
  RefreshCw,
  AlertCircle,
  FileText,
  Clock,
  FolderOpen
} from 'lucide-react';
import { LoadingBlock } from '../components/common/LoadingBlock';

type TabFilter = 'all' | 'tasks' | 'tests' | 'midterm';

export default function ResultsProgress() {
  const dispatch = useDispatch<AppDispatch>();
  const { data, loading, error } = useSelector((state: RootState) => state.grades);
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [trendWindow, setTrendWindow] = useState('Last 3 Months');

  useEffect(() => {
    dispatch(fetchMyGrades());
  }, [dispatch]);

  if (loading && !data) {
    return <LoadingBlock message="Loading academic results and progress..." />;
  }

  if (error && !data) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 text-center space-y-4 shadow-sm max-w-lg mx-auto my-12">
        <AlertCircle className="w-12 h-12 text-error mx-auto stroke-[1.8]" />
        <div>
          <h3 className="text-base font-bold text-foreground">Unable to Load Academic Progress</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">{error}</p>
        </div>
        <button
          onClick={() => dispatch(fetchMyGrades())}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-hover transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  // 100% Real Database Data (No mock/dummy data)
  const progress = data?.academicProgress;

  const overallGrade = progress?.overallGrade || {
    percentage: null,
    badge: 'Pending Evaluation',
    comparisonText: 'No graded records yet',
    subtext: 'Complete your coursework to view evaluation.'
  };

  const tasksSummary = progress?.tasksSummary || {
    count: data?.summary?.totalTasks || 0,
    gradedCount: 0,
    avgPercentage: null,
    items: [] as AcademicItem[]
  };

  const testsSummary = progress?.testsSummary || {
    count: 0,
    gradedCount: 0,
    avgPercentage: null,
    items: [] as AcademicItem[]
  };

  const midtermSummary = progress?.midtermSummary || {
    percentage: null,
    status: 'Pending',
    items: [] as AcademicItem[]
  };

  const performanceDonut = progress?.performanceDonut || {
    tasksAvg: 0,
    testsAvg: 0,
    midtermAvg: 0,
    overallGradePct: 0,
    hasData: false
  };

  const gradeTrend = progress?.gradeTrend || [];

  const motivational = progress?.motivational || {
    title: 'Academic Progress Tracking Active',
    subtext: 'Your performance metrics will appear as assignments and tests are graded.'
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'Perfect':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Excellent':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
      case 'Good':
        return 'bg-amber-50 text-amber-700 border-amber-200/80';
      case 'Pass':
        return 'bg-blue-50 text-blue-700 border-blue-200/80';
      case 'Missed':
      case 'Absent':
        return 'bg-rose-50 text-rose-700 border-rose-300 font-extrabold';
      case 'In Review':
        return 'bg-sky-50 text-sky-700 border-sky-200 font-medium';
      case 'Assigned':
      case 'Upcoming':
        return 'bg-slate-100 text-slate-600 border-slate-200 font-medium';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Subtitle */}
      <div>
        <h1 className="font-headings font-bold text-2xl text-slate-900 tracking-tight">
          Results & Progress
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Track your overall performance and view detailed results
        </p>
      </div>

      {/* Top 5 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Overall Grade (Hero Card with Gradient) */}
        <div className="sm:col-span-2 lg:col-span-1 bg-gradient-to-r from-[#292bb2] via-[#3b3db8] to-[#4338ca] text-white p-5 rounded-2xl relative overflow-hidden shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0 border border-white/20 shadow-inner">
            <Trophy className="w-8 h-8 text-[#ffc53a] fill-[#ffc53a]/30 drop-shadow" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-white/85">Overall Grade</div>
            <div className="text-3xl font-extrabold tracking-tight text-white mt-0.5 font-headings">
              {overallGrade.percentage != null ? `${overallGrade.percentage.toFixed(1)}%` : '—'}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className="text-[10px] text-white/80 font-medium">
                {overallGrade.comparisonText}
              </span>
              <span className={`font-bold text-[10px] px-2 py-0.5 rounded-full inline-block ${
                overallGrade.badge === 'Academic Alert' || overallGrade.badge === 'Needs Attention'
                  ? 'bg-rose-200 text-rose-900 border border-rose-300'
                  : 'bg-[#dcfce7] text-[#15803d]'
              }`}>
                {overallGrade.badge}
              </span>
            </div>
            <span className="text-[10px] text-white/70 block mt-0.5 truncate">
              {overallGrade.subtext}
            </span>
          </div>

          <Sparkles className="w-5 h-5 text-white/20 absolute top-3 right-3 pointer-events-none" />
        </div>

        {/* Card 2: Total Tasks */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-slate-500">Total Tasks</span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-slate-900 font-headings">
              {tasksSummary.count}
            </div>
            <div className="text-xs font-semibold text-blue-600 mt-1">
              {tasksSummary.avgPercentage != null ? `Avg: ${tasksSummary.avgPercentage.toFixed(1)}%` : 'No graded tasks'}
            </div>
          </div>
        </div>

        {/* Card 3: Total Tests */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <span className="text-xs font-semibold text-slate-500">Total Tests</span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-slate-900 font-headings">
              {testsSummary.count}
            </div>
            <div className="text-xs font-semibold text-emerald-600 mt-1">
              {testsSummary.avgPercentage != null ? `Avg: ${testsSummary.avgPercentage.toFixed(1)}%` : 'No tests evaluated'}
            </div>
          </div>
        </div>

        {/* Card 4: Midterm Result */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center shrink-0">
              <Star className="w-5 h-5 fill-amber-500" />
            </div>
            <span className="text-xs font-semibold text-slate-500">Midterm Result</span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-slate-900 font-headings">
              {midtermSummary.percentage != null ? `${midtermSummary.percentage.toFixed(1)}%` : '—'}
            </div>
            <div className="text-xs font-semibold text-amber-600 mt-1">
              {midtermSummary.status}
            </div>
          </div>
        </div>

        {/* Card 5: Your Performance (Ascending Mini Bar Chart) */}
        <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Your Performance</span>
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <div className="mt-3 h-12 flex items-end justify-between gap-1.5 px-1">
            {performanceDonut.hasData ? (
              <>
                <div className="w-2.5 bg-indigo-200/80 rounded-t h-[25%]" />
                <div className="w-2.5 bg-indigo-200 rounded-t h-[35%]" />
                <div className="w-2.5 bg-indigo-300 rounded-t h-[48%]" />
                <div className="w-2.5 bg-indigo-400 rounded-t h-[65%]" />
                <div className="w-2.5 bg-indigo-500 rounded-t h-[82%]" />
                <div className="w-2.5 bg-indigo-600 rounded-t h-[98%]" />
              </>
            ) : (
              <>
                <div className="w-2.5 bg-slate-200 rounded-t h-[15%]" />
                <div className="w-2.5 bg-slate-200 rounded-t h-[15%]" />
                <div className="w-2.5 bg-slate-200 rounded-t h-[15%]" />
                <div className="w-2.5 bg-slate-200 rounded-t h-[15%]" />
                <div className="w-2.5 bg-slate-200 rounded-t h-[15%]" />
                <div className="w-2.5 bg-slate-200 rounded-t h-[15%]" />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tab Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer ${
            activeTab === 'all'
              ? 'bg-[#3b3db8] text-white'
              : 'bg-card text-slate-600 border border-border hover:bg-slate-50'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>All Results</span>
        </button>

        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer ${
            activeTab === 'tasks'
              ? 'bg-[#3b3db8] text-white'
              : 'bg-card text-slate-600 border border-border hover:bg-slate-50'
          }`}
        >
          <ClipboardList className="w-3.5 h-3.5" />
          <span>Tasks ({tasksSummary.items.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('tests')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer ${
            activeTab === 'tests'
              ? 'bg-[#3b3db8] text-white'
              : 'bg-card text-slate-600 border border-border hover:bg-slate-50'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Tests ({testsSummary.items.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('midterm')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer ${
            activeTab === 'midterm'
              ? 'bg-[#3b3db8] text-white'
              : 'bg-card text-slate-600 border border-border hover:bg-slate-50'
          }`}
        >
          <Star className="w-3.5 h-3.5" />
          <span>Midterm ({midtermSummary.items.length})</span>
        </button>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Detailed Results Tables (~65% width) */}
        <div className="lg:col-span-8 space-y-5">
          {/* Section Header */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
              <ListFilter className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-headings font-bold text-base text-slate-900">
                Detailed Results
              </h2>
              <p className="text-xs text-slate-400">
                View marks for all tasks, tests and midterm exam
              </p>
            </div>
          </div>

          {/* Table 1: Monthly Tasks */}
          {(activeTab === 'all' || activeTab === 'tasks') && (
            <div className="border border-border/80 rounded-2xl overflow-hidden bg-card shadow-xs">
              {/* Header Ribbon */}
              <div className="bg-[#f5f3ff] border-b border-[#e9d5ff]/70 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                    <ClipboardList className="w-4 h-4" />
                  </div>
                  <span className="font-headings font-bold text-sm text-slate-800">Monthly Tasks</span>
                </div>
                {tasksSummary.avgPercentage != null ? (
                  <span className="bg-white/90 text-emerald-700 font-bold text-xs px-3 py-1 rounded-full border border-emerald-200 shadow-2xs">
                    Average: {tasksSummary.avgPercentage.toFixed(1)}%
                  </span>
                ) : (
                  <span className="bg-white/90 text-slate-500 font-medium text-xs px-2.5 py-0.5 rounded-full border border-slate-200">
                    No Graded Tasks Yet
                  </span>
                )}
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50/60 text-slate-400 uppercase text-[11px] font-semibold border-b border-border">
                    <tr>
                      <th className="px-4 py-3 w-12 font-medium">#</th>
                      <th className="px-4 py-3 font-medium">Task Name</th>
                      <th className="px-4 py-3 font-medium">Marks</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {tasksSummary.items.length > 0 ? (
                      tasksSummary.items.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3.5 text-slate-400 font-mono text-xs">{idx + 1}</td>
                          <td className="px-4 py-3.5 font-semibold text-slate-800">{item.name}</td>
                          <td className={`px-4 py-3.5 font-bold font-mono ${
                            item.status === 'Missed' || item.status === 'Absent' ? 'text-rose-600' : 'text-slate-900'
                          }`}>
                            {item.marksAwarded != null ? `${item.marksAwarded} / ${item.maxMarks}` : `— / ${item.maxMarks}`}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-block px-3 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadgeStyle(item.status)}`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-slate-500 text-xs">{item.date}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                          <div className="flex flex-col items-center justify-center gap-1.5">
                            <FolderOpen className="w-6 h-6 text-slate-300" />
                            <span>No graded tasks or assignments recorded yet.</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Table 2: Monthly Tests */}
          {(activeTab === 'all' || activeTab === 'tests') && (
            <div className="border border-border/80 rounded-2xl overflow-hidden bg-card shadow-xs">
              {/* Header Ribbon */}
              <div className="bg-[#ecfdf5] border-b border-[#a7f3d0]/70 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span className="font-headings font-bold text-sm text-slate-800">Monthly Tests</span>
                </div>
                {testsSummary.avgPercentage != null ? (
                  <span className="bg-white/90 text-emerald-700 font-bold text-xs px-3 py-1 rounded-full border border-emerald-200 shadow-2xs">
                    Average: {testsSummary.avgPercentage.toFixed(1)}%
                  </span>
                ) : (
                  <span className="bg-white/90 text-slate-500 font-medium text-xs px-2.5 py-0.5 rounded-full border border-slate-200">
                    No Tests Taken Yet
                  </span>
                )}
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50/60 text-slate-400 uppercase text-[11px] font-semibold border-b border-border">
                    <tr>
                      <th className="px-4 py-3 w-12 font-medium">#</th>
                      <th className="px-4 py-3 font-medium">Test Name</th>
                      <th className="px-4 py-3 font-medium">Marks</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {testsSummary.items.length > 0 ? (
                      testsSummary.items.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3.5 text-slate-400 font-mono text-xs">{idx + 1}</td>
                          <td className="px-4 py-3.5 font-semibold text-slate-800">{item.name}</td>
                          <td className={`px-4 py-3.5 font-bold font-mono ${
                            item.status === 'Missed' || item.status === 'Absent' ? 'text-rose-600' : 'text-slate-900'
                          }`}>
                            {item.marksAwarded != null ? `${item.marksAwarded} / ${item.maxMarks}` : `— / ${item.maxMarks}`}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-block px-3 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadgeStyle(item.status)}`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-slate-500 text-xs">{item.date}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                          <div className="flex flex-col items-center justify-center gap-1.5">
                            <FileText className="w-6 h-6 text-slate-300" />
                            <span>No monthly tests recorded or completed yet.</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Table 3: Midterm Exam */}
          {(activeTab === 'all' || activeTab === 'midterm') && (
            <div className="border border-border/80 rounded-2xl overflow-hidden bg-card shadow-xs">
              {/* Header Ribbon */}
              <div className="bg-[#fffbeb] border-b border-[#fde68a]/70 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                    <Star className="w-4 h-4 fill-amber-500" />
                  </div>
                  <span className="font-headings font-bold text-sm text-slate-800">Midterm Exam</span>
                </div>
                {midtermSummary.percentage != null ? (
                  <span className="text-amber-800 font-extrabold text-sm px-1">
                    {midtermSummary.percentage.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-slate-500 font-medium text-xs px-2.5 py-0.5 rounded-full bg-white/80 border border-slate-200">
                    Pending Term Evaluation
                  </span>
                )}
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50/60 text-slate-400 uppercase text-[11px] font-semibold border-b border-border">
                    <tr>
                      <th className="px-4 py-3 w-12 font-medium">#</th>
                      <th className="px-4 py-3 font-medium">Exam</th>
                      <th className="px-4 py-3 font-medium">Marks</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {midtermSummary.items.length > 0 ? (
                      midtermSummary.items.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-4 py-3.5 text-slate-400 font-mono text-xs">{idx + 1}</td>
                          <td className="px-4 py-3.5 font-semibold text-slate-800">{item.name}</td>
                          <td className={`px-4 py-3.5 font-bold font-mono ${
                            item.status === 'Missed' || item.status === 'Absent' ? 'text-rose-600' : 'text-slate-900'
                          }`}>
                            {item.marksAwarded != null ? `${item.marksAwarded} / ${item.maxMarks}` : `— / ${item.maxMarks}`}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className={`inline-block px-3 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadgeStyle(item.status)}`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-slate-500 text-xs">{item.date}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-xs text-muted-foreground">
                          <div className="flex flex-col items-center justify-center gap-1.5">
                            <Clock className="w-6 h-6 text-slate-300" />
                            <span>No midterm examination results published for the current academic session yet.</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Performance Summary, Grade Trend, Motivational (~35% width) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Widget 1: Performance Summary Donut Card */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              <h3 className="font-headings font-bold text-sm text-slate-900">
                Performance Summary
              </h3>
            </div>

            <div className="flex items-center justify-between gap-4 pt-1">
              {/* Circular SVG Donut Progress */}
              <div className="relative w-36 h-36 flex items-center justify-center shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                  {/* Track Circle */}
                  <circle
                    cx="60"
                    cy="60"
                    r="48"
                    stroke="#e2e8f0"
                    strokeWidth="11"
                    fill="transparent"
                  />
                  {/* Progress Arc */}
                  {performanceDonut.hasData && overallGrade.percentage != null && (
                    <circle
                      cx="60"
                      cy="60"
                      r="48"
                      stroke="#10b981"
                      strokeWidth="11"
                      strokeDasharray={2 * Math.PI * 48}
                      strokeDashoffset={(2 * Math.PI * 48) * (1 - (overallGrade.percentage / 100))}
                      strokeLinecap="round"
                      fill="transparent"
                      className="transition-all duration-1000 ease-out"
                    />
                  )}
                </svg>

                {/* Center Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-2xl font-extrabold text-slate-900 font-headings tracking-tight">
                    {overallGrade.percentage != null ? `${overallGrade.percentage.toFixed(1)}%` : '—'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase mt-0.5">
                    Overall Grade
                  </span>
                </div>
              </div>

              {/* Legend on Right */}
              <div className="space-y-3 min-w-[110px]">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-600 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                    Tasks
                  </span>
                  <span className="font-bold text-slate-900 font-mono">
                    {tasksSummary.avgPercentage != null ? `${tasksSummary.avgPercentage.toFixed(1)}%` : '—'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-600 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    Tests
                  </span>
                  <span className="font-bold text-slate-900 font-mono">
                    {testsSummary.avgPercentage != null ? `${testsSummary.avgPercentage.toFixed(1)}%` : '—'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-600 font-medium">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                    Midterm
                  </span>
                  <span className="font-bold text-slate-900 font-mono">
                    {midtermSummary.percentage != null ? `${midtermSummary.percentage.toFixed(1)}%` : '—'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Widget 2: Grade Trend Line Chart Card */}
          <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-headings font-bold text-sm text-slate-900">
                Grade Trend
              </h3>
              <div className="relative">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-border px-2.5 py-1 rounded-md transition"
                >
                  <span>{trendWindow}</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </button>
              </div>
            </div>

            {/* SVG Interactive Line Chart matching real data */}
            <div className="pt-2">
              {gradeTrend.length >= 2 ? (
                <div className="relative h-44 w-full">
                  <svg className="w-full h-full overflow-visible" viewBox="0 0 320 150">
                    <defs>
                      <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal Grid lines */}
                    <line x1="35" y1="15" x2="310" y2="15" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                    <text x="5" y="18" fill="#94a3b8" fontSize="9" fontWeight="600">100%</text>

                    <line x1="35" y1="45" x2="310" y2="45" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                    <text x="10" y="48" fill="#94a3b8" fontSize="9" fontWeight="600">75%</text>

                    <line x1="35" y1="75" x2="310" y2="75" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                    <text x="10" y="78" fill="#94a3b8" fontSize="9" fontWeight="600">50%</text>

                    <line x1="35" y1="105" x2="310" y2="105" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3 3" />
                    <text x="10" y="108" fill="#94a3b8" fontSize="9" fontWeight="600">25%</text>

                    <line x1="35" y1="135" x2="310" y2="135" stroke="#e2e8f0" strokeWidth="1" />
                    <text x="15" y="138" fill="#94a3b8" fontSize="9" fontWeight="600">0%</text>

                    {/* Points calculation dynamically */}
                    {(() => {
                      const points = gradeTrend.map((item, idx) => {
                        const x = 75 + (idx * ((310 - 75) / Math.max(1, gradeTrend.length - 1)));
                        const y = 135 - ((item.percentage / 100) * (135 - 15));
                        return { x, y, ...item };
                      });

                      const pathD = points.reduce((acc, p, idx) => {
                        return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
                      }, '');

                      const areaD = `${pathD} L ${points[points.length - 1].x} 135 L ${points[0].x} 135 Z`;

                      return (
                        <>
                          <path d={areaD} fill="url(#trendGradient)" />
                          <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          {points.map((p, idx) => (
                            <g key={idx}>
                              <circle cx={p.x} cy={p.y} r="4.5" fill="#6366f1" stroke="#ffffff" strokeWidth="2" />
                              <text x={p.x} y={p.y - 8} textAnchor="middle" fill="#4338ca" fontSize="10" fontWeight="bold">
                                {p.percentage.toFixed(1)}%
                              </text>
                              <text x={p.x} y="148" textAnchor="middle" fill="#64748b" fontSize="9" fontWeight="500">
                                {p.month}
                              </text>
                            </g>
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                </div>
              ) : (
                <div className="h-40 flex flex-col items-center justify-center text-center p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <BarChart3 className="w-8 h-8 text-slate-300 mb-2" />
                  <span className="text-xs font-semibold text-slate-700">No trend data available yet</span>
                  <span className="text-[11px] text-slate-400 max-w-xs mt-0.5">
                    Grade trends will be tracked automatically as multiple months of tasks and tests are graded.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Widget 3: Encouragement & Academic Standing Banner */}
          <div className={`border rounded-2xl p-4 flex items-center justify-between shadow-2xs transition-colors ${
            progress?.totalMissedCount && progress.totalMissedCount > 0
              ? 'bg-amber-50/90 border-amber-200'
              : 'bg-[#f0fdf4] border-[#bbf7d0]'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full text-white flex items-center justify-center shrink-0 shadow-xs ${
                progress?.totalMissedCount && progress.totalMissedCount > 0
                  ? 'bg-amber-600'
                  : 'bg-emerald-500'
              }`}>
                {progress?.totalMissedCount && progress.totalMissedCount > 0 ? (
                  <AlertCircle className="w-4 h-4 stroke-[2.5]" />
                ) : (
                  <Check className="w-4 h-4 stroke-[3]" />
                )}
              </div>
              <div>
                <h4 className={`font-headings font-bold text-xs ${
                  progress?.totalMissedCount && progress.totalMissedCount > 0
                    ? 'text-amber-950'
                    : 'text-emerald-950'
                }`}>
                  {motivational.title}
                </h4>
                <p className={`text-[11px] mt-0.5 ${
                  progress?.totalMissedCount && progress.totalMissedCount > 0
                    ? 'text-amber-800'
                    : 'text-emerald-700'
                }`}>
                  {motivational.subtext}
                </p>
              </div>
            </div>

            <Trophy className="w-7 h-7 text-amber-500 fill-amber-400 shrink-0 drop-shadow-2xs" />
          </div>
        </div>
      </div>
    </div>
  );
}
