import React, { useState, useEffect } from 'react';
import { useAppSelector } from '../store';
import { assessmentsApi } from '../services/assessmentsApi';
import { MonthlyTest, TestStatus, ExamType } from '../types/assessments';
import { CreateTestModal } from '../components/assessments/CreateTestModal';
import { TestGradingModal } from '../components/assessments/TestGradingModal';
import { Pagination } from '../components/common/Pagination';
import {
  FileText,
  Plus,
  Search,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Users,
  Award,
  ChevronRight,
  Send,
  Lock,
  RotateCw,
  Video,
  Mail,
  Layers,
  Sparkles,
  ClipboardCheck,
  Check
} from 'lucide-react';

export const MonthlyTestsPage: React.FC = () => {
  const teacher = useAppSelector((state) => state.auth.teacher);
  const assignedClasses = teacher?.assignedClasses || [];

  // Deduplicated assigned classes for this teacher
  const uniqueAssignedClasses = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const c of assignedClasses) {
      const cid = String(c.classId || c.id);
      if (!map.has(cid)) {
        map.set(cid, {
          id: cid,
          name: c.className || c.name.split(' - ')[0] || `Class ${c.grade}`
        });
      }
    }
    return Array.from(map.values());
  }, [assignedClasses]);

  const [tests, setTests] = useState<MonthlyTest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [selectedExamType, setSelectedExamType] = useState<string>('all');
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeGradingTestId, setActiveGradingTestId] = useState<number | null>(null);
  const [launchingTestId, setLaunchingTestId] = useState<number | null>(null);
  const [notifyingTestId, setNotifyingTestId] = useState<number | null>(null);

  const handleNotifyLowScorers = async (testId: number, title: string) => {
    if (!window.confirm(`Send academic alert emails and portal notifications to parents of all students with low/failing results for "${title}"?`)) {
      return;
    }

    try {
      setNotifyingTestId(testId);
      const res = await assessmentsApi.notifyLowPerformers(testId, { force: true });
      alert(res.message || 'Parent alerts dispatched successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch parent alerts.');
    } finally {
      setNotifyingTestId(null);
    }
  };

  const handleStartInvigilation = async (testId: number) => {
    try {
      setLaunchingTestId(testId);
      const res = await assessmentsApi.startInvigilation(testId);
      if (res.launchUrl) {
        window.open(res.launchUrl, '_blank');
      }
    } catch (err: any) {
      alert(err.message || 'Unable to launch invigilation session.');
    } finally {
      setLaunchingTestId(null);
    }
  };

  // Pagination State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedClassId, selectedStatus, selectedExamType]);

  useEffect(() => {
    loadTests();
  }, [selectedClassId, selectedStatus, selectedExamType, currentPage, pageSize]);

  const loadTests = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const params: any = {
        page: currentPage,
        limit: pageSize,
      };
      if (selectedExamType !== 'all') params.examType = selectedExamType as ExamType;
      if (selectedClassId !== 'all') params.classId = Number(selectedClassId);
      if (selectedStatus !== 'all') params.status = selectedStatus as TestStatus;

      const res: any = await assessmentsApi.getTests(params);
      setTests(res.tests || []);
      const total = Number(res.total ?? (res.tests ? res.tests.length : 0));
      setTotalRecords(total);
      setTotalPages(res.totalPages ? Number(res.totalPages) : Math.max(1, Math.ceil(total / pageSize)));
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load monthly tests.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (testId: number, status: TestStatus) => {
    try {
      await assessmentsApi.updateTestStatus(testId, status);
      await loadTests();
    } catch (err: any) {
      alert(err.message || 'Failed to update test status.');
    }
  };

  const filteredTests = tests.filter((t) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        (t.subject_name && t.subject_name.toLowerCase().includes(q)) ||
        (t.class_name && t.class_name.toLowerCase().includes(q))
      );
    }
    return true;
  });

  // Calculate statistics
  const totalCount = tests.length;
  const activeCount = tests.filter((t) => t.status === 'PUBLISHED').length;
  const closedCount = tests.filter((t) => t.status === 'CLOSED').length;
  const publishedResultsCount = tests.filter((t) => t.status === 'RESULTS_PUBLISHED').length;

  return (
    <div className="flex flex-col w-full pb-12 space-y-5 animate-in fade-in duration-150">
      {/* ------------------------------------------------------------- */}
      {/* 1. HERO HEADER BANNER                                         */}
      {/* ------------------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#36348e]/10 border border-[#36348e]/20 flex items-center justify-center text-[#36348e] shrink-0 shadow-2xs">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold text-[#36348e] uppercase tracking-wider">
                  Assessments &amp; Testing
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500 font-semibold">Scheduled Evaluations</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Tests &amp; Examination Workstation
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Timed online and physical evaluations, live server countdowns, auto-grading, and instant marks publishing.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <button
              onClick={loadTests}
              className="p-2.5 border border-slate-200/80 text-slate-700 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition shadow-2xs cursor-pointer"
              title="Refresh Tests"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsCreateOpen(true)}
              className="px-4.5 py-2.5 bg-[#36348e] hover:bg-[#2c2a75] text-white rounded-xl text-xs sm:text-sm font-bold shadow-md shadow-indigo-100 flex items-center gap-2 transition active:scale-98 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Test or Exam</span>
            </button>
          </div>
        </div>

        {/* Subtle Decorative Background Element */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#36348e]/5 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. FOUR TOP WAVE KPI STAT CARDS                               */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Tests Created */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-indigo-100/80 hover:border-indigo-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-[#36348e] text-white shadow-sm shadow-indigo-900/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <FileText className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-indigo-50 text-[#36348e] border-indigo-100">
              Total Roster
            </span>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-2xl sm:text-2xl xl:text-3xl font-black text-slate-900 tracking-tight">
              {totalCount}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">
              Total Tests Created
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(69, 67, 168, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#4543a8" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Card 2: Active / Live Windows */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-emerald-100/80 hover:border-emerald-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Clock className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-emerald-50 text-emerald-800 border-emerald-100">
              Live Window
            </span>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-2xl sm:text-2xl xl:text-3xl font-black text-slate-900 tracking-tight">
              {activeCount}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">
              Active Assessment Windows
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(16, 185, 129, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#10b981" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Card 3: Closed / In Evaluation */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-amber-100/80 hover:border-amber-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Lock className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-amber-50 text-amber-900 border-amber-200">
              Evaluating
            </span>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-2xl sm:text-2xl xl:text-3xl font-black text-slate-900 tracking-tight">
              {closedCount}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">
              Closed / In Grading
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(245, 158, 11, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Card 4: Results Published */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-blue-100/80 hover:border-blue-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Award className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-blue-50 text-blue-700 border-blue-100">
              Completed
            </span>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-2xl sm:text-2xl xl:text-3xl font-black text-slate-900 tracking-tight">
              {publishedResultsCount}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">
              Results Published to SIS
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(59, 130, 246, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. EXAM CATEGORY FILTER TABS                                   */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-2 overflow-x-auto">
        {[
          { id: 'all', label: 'All Tests & Exams' },
          { id: 'MONTHLY_TEST', label: 'Monthly Tests' },
          { id: 'MID_TERM', label: 'Mid-Term Exams' },
          { id: 'FINAL_TERM', label: 'Final-Term Exams' },
          { id: 'CLASS_QUIZ', label: 'Class Quizzes' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedExamType(tab.id)}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition whitespace-nowrap cursor-pointer ${
              selectedExamType === tab.id
                ? 'bg-[#36348e] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. FILTER TOOLBAR & SEARCH BAR                                */}
      {/* ------------------------------------------------------------- */}
      <div className="p-4 bg-white border border-slate-200/80 rounded-2xl shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-600">Class:</span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="text-xs border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-100 focus:outline-hidden font-bold text-slate-900 cursor-pointer"
            >
              <option value="all">All Assigned Classes</option>
              {uniqueAssignedClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-600">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs border border-slate-200 rounded-xl px-3 py-1.5 bg-slate-100 focus:outline-hidden font-bold text-slate-900 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published (Active)</option>
              <option value="CLOSED">Closed (In Evaluation)</option>
              <option value="RESULTS_PUBLISHED">Results Published</option>
            </select>
          </div>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search test title or subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-3.5 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium"
          />
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 5. TESTS LIST TABLE                                           */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
            <RotateCw className="w-8 h-8 text-[#36348e] animate-spin" />
            <span className="font-bold text-slate-700">Loading assessment roster...</span>
          </div>
        ) : filteredTests.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs space-y-2">
            <FileText className="w-10 h-10 text-slate-300 mx-auto stroke-1" />
            <p className="font-bold text-base text-slate-700">No monthly tests found</p>
            <p className="text-xs text-slate-400">
              Click &quot;+ Create Test or Exam&quot; above to author an MCQ or subjective assessment.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Test Details</th>
                  <th className="py-3.5 px-3">Class &amp; Subject</th>
                  <th className="py-3.5 px-3">Duration &amp; Marks</th>
                  <th className="py-3.5 px-3">Availability Window</th>
                  <th className="py-3.5 px-3 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTests.map((t) => {
                  const examTypeBadge =
                    {
                      MONTHLY_TEST: { label: 'Monthly Test', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
                      MID_TERM: { label: 'Mid-Term', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
                      FINAL_TERM: { label: 'Final-Term', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                      CLASS_QUIZ: { label: 'Quiz', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
                    }[t.exam_type || 'MONTHLY_TEST'] || {
                      label: t.exam_type || 'Test',
                      cls: 'bg-slate-100 text-slate-700 border-slate-200'
                    };

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${examTypeBadge.cls}`}>
                            {examTypeBadge.label}
                          </span>
                        </div>
                        <div className="font-extrabold text-[#36348e] text-[13px]">{t.title}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <span>{t.question_count || 0} questions</span>
                          {t.description && (
                            <>
                              <span>•</span>
                              <span className="truncate max-w-[200px]">{t.description}</span>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="font-bold text-slate-900">{t.class_name || `Class ${t.class_id}`}</div>
                        <div className="text-[11px] text-[#36348e] font-semibold">{t.subject_name || 'Subject'}</div>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="font-bold text-slate-900 flex items-center gap-1 font-mono">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{t.duration_minutes} Mins</span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Total: <span className="font-bold text-slate-800">{t.total_marks}</span> | Pass:{' '}
                          <span className="font-bold text-slate-800">{t.passing_marks}</span>
                        </div>
                      </td>

                      <td className="py-3.5 px-3">
                        <div className="text-[11px] text-slate-800 font-semibold font-mono">
                          {new Date(t.available_from).toLocaleDateString([], { month: 'short', day: 'numeric' })} —{' '}
                          {new Date(t.available_until).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Closes: {new Date(t.available_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      <td className="py-3.5 px-3 text-center">
                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 border ${
                            t.status === 'PUBLISHED'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : t.status === 'RESULTS_PUBLISHED'
                              ? 'bg-indigo-50 text-[#36348e] border-indigo-200'
                              : t.status === 'CLOSED'
                              ? 'bg-amber-50 text-amber-900 border-amber-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {t.status === 'PUBLISHED' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                          {t.status.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {t.status === 'DRAFT' && (
                            <button
                              onClick={() => handleUpdateStatus(t.id, 'PUBLISHED')}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[11px] transition shadow-2xs cursor-pointer"
                            >
                              Publish
                            </button>
                          )}

                          {t.status === 'PUBLISHED' && (
                            <>
                              <button
                                onClick={() => handleStartInvigilation(t.id)}
                                disabled={launchingTestId === t.id}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[11px] shadow-2xs inline-flex items-center gap-1 transition disabled:opacity-50 cursor-pointer"
                                title="Launch classroom Zoom meeting with host invigilation rights"
                              >
                                <Video className="w-3.5 h-3.5" />
                                <span>{launchingTestId === t.id ? 'Starting...' : 'Invigilate'}</span>
                              </button>

                              <button
                                onClick={() => handleUpdateStatus(t.id, 'CLOSED')}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-[11px] transition border border-slate-200 cursor-pointer"
                                title="Close Window (stop new attempts)"
                              >
                                Close Test
                              </button>
                            </>
                          )}

                          {t.status === 'RESULTS_PUBLISHED' && (
                            <button
                              type="button"
                              onClick={() => handleNotifyLowScorers(t.id, t.title)}
                              disabled={notifyingTestId === t.id}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-bold text-[11px] shadow-2xs inline-flex items-center gap-1 transition disabled:opacity-50 cursor-pointer"
                              title="Send academic performance alert emails & notifications to parents of students who got low or failing results"
                            >
                              <Mail className="w-3.5 h-3.5 text-rose-600" />
                              <span>{notifyingTestId === t.id ? 'Sending...' : 'Alert Parents'}</span>
                            </button>
                          )}

                          <button
                            onClick={() => setActiveGradingTestId(t.id)}
                            className="px-3 py-1.5 bg-[#36348e] hover:bg-[#2c2a75] text-white rounded-xl font-bold text-[11px] shadow-2xs inline-flex items-center gap-1 transition cursor-pointer"
                          >
                            <span>Grading</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Bar */}
      {totalRecords > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalRecords}
          itemsPerPage={pageSize}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={(newSize) => {
            setPageSize(newSize);
            setCurrentPage(1);
          }}
          loading={loading}
        />
      )}

      {/* Create Test Modal */}
      <CreateTestModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={loadTests}
      />

      {/* Grading & Submissions Workstation Modal */}
      {activeGradingTestId && (
        <TestGradingModal
          testId={activeGradingTestId}
          isOpen={!!activeGradingTestId}
          onClose={() => setActiveGradingTestId(null)}
          onRefresh={loadTests}
        />
      )}
    </div>
  );
};
