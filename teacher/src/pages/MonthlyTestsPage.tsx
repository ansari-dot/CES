import React, { useState, useEffect } from 'react';
import { useAppSelector } from '../store';
import { assessmentsApi } from '../services/assessmentsApi';
import { MonthlyTest, TestStatus, ExamType } from '../types/assessments';
import { CreateTestModal } from '../components/assessments/CreateTestModal';
import { TestGradingModal } from '../components/assessments/TestGradingModal';
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
  RefreshCw
} from 'lucide-react';

export const MonthlyTestsPage: React.FC = () => {
  const teacher = useAppSelector((state) => state.auth.teacher);
  const assignedClasses = teacher?.assignedClasses || [];

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

  useEffect(() => {
    loadTests();
  }, [selectedClassId, selectedStatus, selectedExamType]);

  const loadTests = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const params: any = {};
      if (selectedExamType !== 'all') params.examType = selectedExamType as ExamType;
      if (selectedClassId !== 'all') params.classId = Number(selectedClassId);
      if (selectedStatus !== 'all') params.status = selectedStatus as TestStatus;

      const res = await assessmentsApi.getTests(params);
      setTests(res.tests || []);
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
    <div className="flex flex-col w-full pb-8 space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1b1a47] flex items-center gap-2">
            <FileText className="w-6 h-6 text-[#ffc53a]" />
            Tests &amp; Examinations
          </h1>
          <p className="text-xs text-[#777587]">
            Timed evaluations for Monthly Tests, Mid-Term, and Final-Term examinations with server countdown, auto-grading, and marks publishing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadTests}
            className="p-2 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition shadow-2xs"
            title="Refresh Tests"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 bg-[#1b1a47] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Test or Exam</span>
          </button>
        </div>
      </div>

      {/* Exam Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto bg-white p-2 border border-slate-200 rounded-xl shadow-2xs">
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
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
              selectedExamType === tab.id
                ? 'bg-[#1b1a47] text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Metrics Counter Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Total Tests Created</div>
          <div className="text-2xl font-extrabold text-[#1b1a47] mt-0.5">{totalCount}</div>
        </div>
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <div className="text-[11px] font-semibold text-emerald-600 uppercase">Active / Live Windows</div>
          <div className="text-2xl font-extrabold text-emerald-700 mt-0.5">{activeCount}</div>
        </div>
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <div className="text-[11px] font-semibold text-amber-600 uppercase">Closed / Evaluation</div>
          <div className="text-2xl font-extrabold text-amber-700 mt-0.5">{closedCount}</div>
        </div>
        <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <div className="text-[11px] font-semibold text-indigo-600 uppercase">Results Published</div>
          <div className="text-2xl font-extrabold text-indigo-700 mt-0.5">{publishedResultsCount}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-slate-600">Class:</span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium"
            >
              <option value="all">All Assigned Classes</option>
              {assignedClasses.map((c) => (
                <option key={c.classId || c.id} value={String(c.classId || c.id)}>
                  {c.className || c.name} {c.section ? `(${c.section})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-slate-600">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-slate-50 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-medium"
            >
              <option value="all">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published (Active)</option>
              <option value="CLOSED">Closed (In Evaluation)</option>
              <option value="RESULTS_PUBLISHED">Results Published</option>
            </select>
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search test title or subject..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
          />
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tests List Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <span>Loading assessment roster...</span>
          </div>
        ) : filteredTests.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs space-y-2">
            <FileText className="w-8 h-8 text-slate-300 mx-auto stroke-1" />
            <p className="font-semibold text-slate-600">No monthly tests found</p>
            <p className="text-[11px] text-slate-400">
              Click &quot;+ Create Monthly Test&quot; above to author an MCQ or subjective assessment.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3.5">Test Details</th>
                  <th className="py-3 px-3">Class &amp; Subject</th>
                  <th className="py-3 px-3">Duration &amp; Marks</th>
                  <th className="py-3 px-3">Availability Window</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTests.map((t) => {
                  const examTypeBadge = {
                    MONTHLY_TEST: { label: 'Monthly Test', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
                    MID_TERM: { label: 'Mid-Term', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
                    FINAL_TERM: { label: 'Final-Term', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
                    CLASS_QUIZ: { label: 'Quiz', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
                  }[t.exam_type || 'MONTHLY_TEST'] || { label: t.exam_type || 'Test', cls: 'bg-slate-100 text-slate-700 border-slate-200' };

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${examTypeBadge.cls}`}>
                            {examTypeBadge.label}
                          </span>
                        </div>
                        <div className="font-bold text-[#1b1a47] text-[13px]">{t.title}</div>
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

                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-800">{t.class_name || `Class ${t.class_id}`}</div>
                      <div className="text-[11px] text-indigo-700 font-semibold">{t.subject_name || 'Subject'}</div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-500" />
                        <span>{t.duration_minutes} Mins</span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Total: <span className="font-bold text-slate-800">{t.total_marks}</span> | Pass:{' '}
                        <span className="font-bold text-slate-800">{t.passing_marks}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="text-[11px] text-slate-700 font-medium">
                        {new Date(t.available_from).toLocaleDateString([], { month: 'short', day: 'numeric' })} —{' '}
                        {new Date(t.available_until).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Closes: {new Date(t.available_until).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                          t.status === 'PUBLISHED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : t.status === 'RESULTS_PUBLISHED'
                            ? 'bg-indigo-100 text-indigo-800'
                            : t.status === 'CLOSED'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {t.status === 'PUBLISHED' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                        {t.status.replace('_', ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {t.status === 'DRAFT' && (
                          <button
                            onClick={() => handleUpdateStatus(t.id, 'PUBLISHED')}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] transition shadow-2xs"
                          >
                            Publish
                          </button>
                        )}

                        {t.status === 'PUBLISHED' && (
                          <button
                            onClick={() => handleUpdateStatus(t.id, 'CLOSED')}
                            className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold text-[11px] transition"
                            title="Close Window (stop new attempts)"
                          >
                            Close Test
                          </button>
                        )}

                        <button
                          onClick={() => setActiveGradingTestId(t.id)}
                          className="px-3 py-1 bg-[#1b1a47] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white rounded-lg font-bold text-[11px] shadow-2xs inline-flex items-center gap-1 transition"
                        >
                          <span>Grading &amp; Roster</span>
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

