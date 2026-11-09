import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { studentAssessmentsApi } from '../services/assessmentsApi';
import { StudentMonthlyTest, StudentTestResult } from '../types/assessments';
import {
  FileText,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  Award,
  Play,
  RotateCw,
  Eye,
  X,
  HelpCircle,
  Lock,
  Globe
} from 'lucide-react';

export default function MonthlyTests() {
  const navigate = useNavigate();

  const [availableTests, setAvailableTests] = useState<StudentMonthlyTest[]>([]);
  const [completedTests, setCompletedTests] = useState<StudentMonthlyTest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'available' | 'completed'>('available');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Confirmation modal before starting test
  const [selectedStartTest, setSelectedStartTest] = useState<StudentMonthlyTest | null>(null);

  // Result Modal
  const [resultModalData, setResultModalData] = useState<StudentTestResult | null>(null);
  const [loadingResult, setLoadingResult] = useState(false);

  useEffect(() => {
    loadTests();
  }, []);

  // The backend returns camelCase fields; map them onto the snake_case
  // names this page renders, and rebuild the nested attempt object.
  const normalizeTest = (t: any): StudentMonthlyTest => ({
    ...t,
    exam_type: t.exam_type ?? t.examType,
    subject_name: t.subject_name ?? t.subjectName,
    total_marks: t.total_marks ?? t.totalMarks,
    duration_minutes: t.duration_minutes ?? t.durationMinutes,
    available_from: t.available_from ?? t.availableFrom,
    available_until: t.available_until ?? t.availableUntil,
    status: t.status ?? t.testStatus,
    attempt:
      t.attempt ??
      (t.attemptId
        ? {
            id: t.attemptId,
            status: t.attemptStatus,
            started_at: t.startedAt,
            submitted_at: t.submittedAt,
            expires_at: t.expiresAt,
            mcq_score: t.mcqScore,
            subjective_score: t.subjectiveScore,
            total_score: t.totalScore,
            is_passed: t.isPassed,
            teacher_remarks: t.teacherRemarks
          }
        : undefined)
  });

  const loadTests = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res: any = await studentAssessmentsApi.getStudentTests();
      const all: StudentMonthlyTest[] = (Array.isArray(res) ? res : res.allTests || []).map(normalizeTest);
      const avail = (res.availableTests ? res.availableTests.map(normalizeTest) : all.filter((t) => !t.isMissed && t.attemptStatus !== 'SUBMITTED' && t.attemptStatus !== 'GRADED'));
      const comp = (res.completedTests ? res.completedTests.map(normalizeTest) : all.filter((t) => t.isMissed || t.attemptStatus === 'SUBMITTED' || t.attemptStatus === 'GRADED'));
      setAvailableTests(avail);
      setCompletedTests(comp);
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to load your examinations.');
    } finally {
      setLoading(false);
    }
  };

  // Live countdown ticker that runs every second for upcoming exams
  useEffect(() => {
    const timer = setInterval(() => {
      setAvailableTests((prev) =>
        prev.map((test) => {
          if (test.available_from) {
            const now = Date.now();
            const openTime = new Date(test.available_from).getTime();
            const diffSecs = Math.floor((openTime - now) / 1000);

            if (diffSecs <= 0 && test.attemptStatus === 'UPCOMING') {
              // Exact time arrived! Dynamically unlock in real time!
              return {
                ...test,
                attemptStatus: 'LIVE',
                isLive: true,
                isUpcoming: false,
                secondsUntilOpen: 0
              };
            }
            if (test.attemptStatus === 'UPCOMING') {
              return {
                ...test,
                secondsUntilOpen: diffSecs
              };
            }
          }
          return test;
        })
      );
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatCountdown = (seconds?: number) => {
    if (!seconds || seconds <= 0) return 'Opening now...';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0 || d > 0) parts.push(`${h}h`);
    if (m > 0 || h > 0 || d > 0) parts.push(`${m}m`);
    parts.push(`${s}s`);
    return parts.join(' ');
  };

  const detectedTimezone = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'Local Device';
    }
  })();

  const formatLocalTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatSchoolPktTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('en-US', {
        timeZone: 'Asia/Karachi',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  };

  const handleStartConfirmed = () => {
    if (!selectedStartTest) return;
    const tId = selectedStartTest.id;
    setSelectedStartTest(null);
    navigate(`/student/tests/${tId}/room`);
  };

  const handleViewResult = async (testId: number) => {
    try {
      setLoadingResult(true);
      const data = await studentAssessmentsApi.getTestResult(testId);
      setResultModalData(data);
    } catch (err: any) {
      alert(err.message || 'Results are not yet released for this test.');
    } finally {
      setLoadingResult(false);
    }
  };

  // Counts
  const availableCount = availableTests.length;
  const completedCount = completedTests.length;
  const missedCount = completedTests.filter((t) => t.isMissed || t.attemptStatus === 'MISSED').length;

  const filteredAvailable = availableTests.filter((t) => {
    if (selectedCategory !== 'ALL') {
      const type = t.examType || t.exam_type || 'MONTHLY_TEST';
      if (type !== selectedCategory) return false;
    }
    return true;
  });

  const filteredCompleted = completedTests.filter((t) => {
    if (selectedCategory !== 'ALL') {
      const type = t.examType || t.exam_type || 'MONTHLY_TEST';
      if (type !== selectedCategory) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-headings text-foreground flex items-center gap-2">
            <Award className="w-6 h-6 text-primary" />
            Tests &amp; Examinations
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Timed evaluations for Monthly Tests, Mid-Term, and Final-Term examinations with server countdown and instant submission.
          </p>
        </div>

        <button
          onClick={loadTests}
          className="p-2 border border-border text-muted-foreground hover:text-foreground hover:bg-card rounded-md transition shadow-xs self-start sm:self-auto"
          title="Refresh tests"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto bg-card p-2 border border-border rounded-md shadow-2xs">
        {[
          { id: 'ALL', label: 'All Examinations' },
          { id: 'MONTHLY_TEST', label: 'Monthly Tests' },
          { id: 'MID_TERM', label: 'Mid-Term Exams' },
          { id: 'FINAL_TERM', label: 'Final-Term Exams' },
          { id: 'CLASS_QUIZ', label: 'Class Quizzes' }
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition whitespace-nowrap ${
              selectedCategory === cat.id
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Counter Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-md p-4 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-sm bg-primary/10 flex items-center justify-center text-primary">
            <FileText className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Available / Upcoming</div>
            <div className="text-xl font-bold font-headings text-foreground">{availableCount}</div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-md p-4 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-sm bg-success-bg flex items-center justify-center text-success">
            <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Completed &amp; Graded</div>
            <div className="text-xl font-bold font-headings text-foreground">{completedCount - missedCount}</div>
          </div>
        </div>

        <div className="bg-card border border-rose-200 bg-rose-50/50 rounded-md p-4 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-sm bg-rose-100 flex items-center justify-center text-rose-600">
            <XCircle className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="text-xs text-rose-600 font-bold uppercase">Missed Tests (Absent)</div>
            <div className="text-xl font-bold font-headings text-rose-700">{missedCount}</div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-md p-4 flex items-center gap-3 shadow-xs">
          <div className="w-10 h-10 rounded-sm bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Globe className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">Detected Timezone</div>
            <div className="text-xs font-bold text-foreground truncate max-w-[120px]">{detectedTimezone}</div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('available')}
          className={`pb-3 border-b-2 transition flex items-center gap-2 ${
            activeTab === 'available'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <span>Available &amp; Active Tests</span>
          {availableCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] bg-primary/10 text-primary font-bold">
              {availableCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`pb-3 border-b-2 transition flex items-center gap-2 ${
            activeTab === 'completed'
              ? 'border-primary text-primary font-bold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <span>Completed &amp; Published Results</span>
          {completedCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] bg-muted text-muted-foreground font-bold">
              {completedCount}
            </span>
          )}
        </button>
      </div>

      {/* Main List */}
      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-xs flex flex-col items-center justify-center gap-2">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Loading your monthly assessments...</span>
        </div>
      ) : activeTab === 'available' ? (
        /* AVAILABLE TESTS */
        filteredAvailable.length === 0 ? (
          <div className="bg-card border border-border rounded-md p-12 text-center text-muted-foreground space-y-2">
            <CheckCircle2 className="w-10 h-10 text-success mx-auto opacity-70" />
            <div className="font-bold text-foreground">You are all caught up!</div>
            <p className="text-xs">There are no pending examinations or tests matching this category.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredAvailable.map((t) => {
              const attempt = t.attempt;
              const isInProgress = attempt?.status === 'IN_PROGRESS';
              const examTypeBadge = {
                MONTHLY_TEST: { label: 'Monthly Test', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
                MID_TERM: { label: 'Mid-Term Exam', cls: 'bg-purple-100 text-purple-800 border-purple-200' },
                FINAL_TERM: { label: 'Final-Term Exam', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
                CLASS_QUIZ: { label: 'Quiz', cls: 'bg-amber-100 text-amber-800 border-amber-200' }
              }[t.examType || t.exam_type || 'MONTHLY_TEST'] || { label: 'Exam', cls: 'bg-slate-100 text-slate-800 border-slate-200' };

              return (
                <div
                  key={t.id}
                  className="bg-card border border-border rounded-md p-5 shadow-xs flex flex-col justify-between hover:border-primary/40 transition space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${examTypeBadge.cls}`}>
                          {examTypeBadge.label}
                        </span>
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                          {t.subject_name || 'Subject'}
                        </span>
                      </div>

                      {isInProgress && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-warning-bg text-warning animate-pulse">
                          In Progress
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold font-headings text-foreground">{t.title}</h3>
                    {t.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                    )}
                  </div>

                  <div className="space-y-3 pt-2 border-t border-border/60 text-xs">
                    <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        <span>Duration: <strong className="text-foreground">{t.duration_minutes} Mins</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5 text-primary" />
                        <span>Total: <strong className="text-foreground">{t.total_marks} Marks</strong></span>
                      </div>
                    </div>

                    {/* Dual-Timezone Display */}
                    <div className="p-2.5 rounded-lg bg-muted/40 border border-border/80 space-y-1 text-[11px]">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <Globe className="w-3 h-3 text-primary" />
                          <span>Your Local Time:</span>
                        </span>
                        <span className="font-semibold text-foreground">
                          {formatLocalTime(t.available_from)} – {formatLocalTime(t.available_until)} ({detectedTimezone})
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground/80">
                        <span>School Ref Time:</span>
                        <span>
                          {formatSchoolPktTime(t.available_from)} – {formatSchoolPktTime(t.available_until)} PKT
                        </span>
                      </div>
                    </div>

                    {/* Action Button: Live Countdown vs Enter Exam Room vs In Progress */}
                    <div className="pt-1">
                      {isInProgress ? (
                        <button
                          onClick={() => navigate(`/student/tests/${t.id}/room`)}
                          className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Resume Exam In Progress</span>
                        </button>
                      ) : t.attemptStatus === 'UPCOMING' ? (
                        <button
                          disabled
                          className="w-full py-2 bg-slate-100 border border-slate-200 text-slate-400 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 cursor-not-allowed"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Locked · Opens in {formatCountdown(t.secondsUntilOpen)}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setSelectedStartTest(t)}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Enter Exam Room</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* COMPLETED TESTS & RESULTS */
        filteredCompleted.length === 0 ? (
          <div className="bg-card border border-border rounded-md p-12 text-center text-muted-foreground space-y-2">
            <FileText className="w-10 h-10 text-muted mx-auto" />
            <div className="font-bold text-foreground">No completed tests yet</div>
            <p className="text-xs">Once you submit a test and results are published, they will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCompleted.map((t) => {
              const attempt = t.attempt;
              const isResultsPublished = t.status === 'RESULTS_PUBLISHED';
              const isMissed = t.isMissed || t.attemptStatus === 'MISSED';

              const examTypeBadge = {
                MONTHLY_TEST: { label: 'Monthly Test', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
                MID_TERM: { label: 'Mid-Term Exam', cls: 'bg-purple-100 text-purple-800 border-purple-200' },
                FINAL_TERM: { label: 'Final-Term Exam', cls: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
                CLASS_QUIZ: { label: 'Quiz', cls: 'bg-amber-100 text-amber-800 border-amber-200' }
              }[t.examType || t.exam_type || 'MONTHLY_TEST'] || { label: 'Exam', cls: 'bg-slate-100 text-slate-800 border-slate-200' };

              if (isMissed) {
                return (
                  <div
                    key={t.id}
                    className="bg-card border-2 border-rose-300 bg-rose-50/20 rounded-md p-5 shadow-xs flex flex-col justify-between space-y-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${examTypeBadge.cls}`}>
                            {examTypeBadge.label}
                          </span>
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                            {t.subject_name || 'Subject'}
                          </span>
                        </div>

                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-300 flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          MISSED (ABSENT)
                        </span>
                      </div>

                      <h3 className="text-base font-bold font-headings text-foreground">{t.title}</h3>
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-md text-xs text-rose-800 space-y-1">
                        <p className="font-bold flex items-center gap-1">
                          <AlertCircle className="w-4 h-4 text-rose-600" />
                          Examination Missed
                        </p>
                        <p className="text-[11px] text-rose-700 leading-relaxed">
                          The scheduled window closed on{' '}
                          <strong>
                            {t.available_until
                              ? new Date(t.available_until).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
                              : 'the scheduled date'}{' '}
                            at {formatLocalTime(t.available_until)} ({detectedTimezone})
                          </strong>
                          . You did not attempt this exam and were marked absent.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-border/60 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Recorded Score:</span>
                        <span className="font-bold text-rose-700">0.0 / {t.total_marks} Marks</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Attendance Status:</span>
                        <span className="font-bold text-rose-600">Absent (0%)</span>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={t.id}
                  className="bg-card border border-border rounded-md p-5 shadow-xs flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${examTypeBadge.cls}`}>
                          {examTypeBadge.label}
                        </span>
                        <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                          {t.subject_name || 'Subject'}
                        </span>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isResultsPublished
                            ? 'bg-success-bg text-success'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {isResultsPublished ? 'Results Published' : 'Under Evaluation'}
                      </span>
                    </div>

                    <h3 className="text-base font-bold font-headings text-foreground">{t.title}</h3>
                  </div>

                  <div className="space-y-3 pt-2 border-t border-border/60 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Submission Date:</span>
                      <span className="font-semibold text-foreground">
                        {attempt?.submitted_at
                          ? new Date(attempt.submitted_at).toLocaleDateString([], {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })
                          : 'Submitted'}
                      </span>
                    </div>

                    {isResultsPublished && attempt && (
                      <div className="p-3 bg-muted/40 rounded-md space-y-1.5 border border-border">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground font-medium">Your Score:</span>
                          <span className="text-sm font-extrabold text-primary">
                            {attempt.total_score} / {t.total_marks} Marks
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground font-medium">Result Status:</span>
                          {attempt.is_passed ? (
                            <span className="text-success font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Passed
                            </span>
                          ) : (
                            <span className="text-destructive font-bold flex items-center gap-1">
                              <XCircle className="w-3.5 h-3.5" /> Needs Improvement
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="pt-1">
                      {isResultsPublished ? (
                        <button
                          onClick={() => handleViewResult(t.id)}
                          className="w-full py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Detailed Marks &amp; Question Review</span>
                        </button>
                      ) : (
                        <div className="text-center py-1.5 text-xs text-muted-foreground font-medium italic">
                          Teacher is grading your subjective answers.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Confirmation Modal to Start Test */}
      {selectedStartTest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-card rounded-xl p-6 max-w-md w-full shadow-2xl border border-border space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
              <Clock className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-bold font-headings text-foreground">
                Ready to Start Your Monthly Test?
              </h3>
              <p className="text-xs text-muted-foreground">
                You are about to start <strong className="text-foreground">{selectedStartTest.title}</strong> (
                {selectedStartTest.duration_minutes} Minutes).
              </p>
              <div className="p-3 bg-warning-bg/40 border border-warning/30 rounded-md text-[11px] text-foreground text-left space-y-1">
                <div className="font-bold text-warning flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  Important Test Rules:
                </div>
                <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                  <li>The server countdown starts immediately when you enter.</li>
                  <li>Refreshing or closing your browser will <strong>not pause</strong> the timer.</li>
                  <li>When time expires, your answers will automatically submit.</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                onClick={() => setSelectedStartTest(null)}
                className="flex-1 py-2 text-xs font-bold text-muted-foreground hover:bg-muted rounded-md transition"
              >
                Not Yet
              </button>
              <button
                onClick={handleStartConfirmed}
                className="flex-1 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-xs font-bold transition shadow-xs"
              >
                Yes, Enter Test Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result Review Modal */}
      {resultModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="px-6 py-4 bg-primary text-primary-foreground flex items-center justify-between">
              <div>
                <h2 className="text-base sm:text-lg font-bold font-headings">
                  {resultModalData.test.title} — Result Review
                </h2>
                <p className="text-xs opacity-80">
                  Subject: {resultModalData.test.subject_name || 'Subject'} | Total Marks: {resultModalData.test.total_marks}
                </p>
              </div>
              <button
                onClick={() => setResultModalData(null)}
                className="p-1.5 hover:bg-white/10 rounded-md transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
              
              {/* Score Banner */}
              <div className="p-4 bg-muted/40 border border-border rounded-xl flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] text-muted-foreground uppercase font-semibold">Your Total Score</div>
                  <div className="text-2xl font-extrabold font-headings text-primary">
                    {resultModalData.attempt.total_score} / {resultModalData.test.total_marks}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-[11px] text-muted-foreground font-semibold">MCQs: {resultModalData.attempt.mcq_score} pts</div>
                    <div className="text-[11px] text-muted-foreground font-semibold">Subjective: {resultModalData.attempt.subjective_score} pts</div>
                  </div>
                  <div>
                    {resultModalData.attempt.is_passed ? (
                      <span className="px-3 py-1 bg-success-bg text-success font-bold text-xs rounded-full flex items-center gap-1 border border-success/30">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Passed
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-destructive/10 text-destructive font-bold text-xs rounded-full flex items-center gap-1 border border-destructive/30">
                        <XCircle className="w-3.5 h-3.5" /> Needs Improvement
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Teacher Remarks (if any) */}
              {resultModalData.attempt.teacher_remarks && (
                <div className="p-3.5 bg-warning-bg/30 border border-warning/40 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-warning">Teacher Remarks:</div>
                  <p className="text-foreground">{resultModalData.attempt.teacher_remarks}</p>
                </div>
              )}

              {/* Questions Review */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Detailed Question Breakdown ({resultModalData.questions.length} Questions)
                </h4>

                {resultModalData.questions.map((q, idx) => {
                  const studentAns = q.studentAnswer;
                  const isMcq = q.question_type === 'MCQ';

                  return (
                    <div
                      key={q.id}
                      className="p-4 bg-card border border-border rounded-xl space-y-3"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-foreground">
                          Question {idx + 1} ({isMcq ? 'MCQ' : 'Subjective'})
                        </span>
                        <span className="font-bold text-primary">
                          Score: {studentAns?.marks_awarded || 0} / {q.marks} pts
                        </span>
                      </div>

                      <div className="text-xs text-foreground font-medium">{q.prompt}</div>

                      {/* If MCQ */}
                      {isMcq ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                          {q.options?.map((opt) => {
                            const isStudentChoice = studentAns?.selected_option === opt.key;
                            const isCorrect = q.correct_option === opt.key;

                            let optStyle = 'bg-muted/40 border-border text-foreground';
                            if (isCorrect) optStyle = 'bg-success-bg border-success/40 text-success font-bold ring-1 ring-success';
                            else if (isStudentChoice && !isCorrect) optStyle = 'bg-destructive/10 border-destructive/40 text-destructive font-bold';

                            return (
                              <div key={opt.key} className={`p-2 rounded-lg border flex items-center gap-2 ${optStyle}`}>
                                <span className="w-4">{opt.key}.</span>
                                <span className="flex-1">{opt.text}</span>
                                {isCorrect && <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
                                {isStudentChoice && !isCorrect && <XCircle className="w-3.5 h-3.5 text-destructive" />}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        /* If Subjective */
                        <div className="space-y-2 text-xs pt-1">
                          <div className="p-3 bg-muted/40 border border-border rounded-lg text-foreground whitespace-pre-wrap">
                            <span className="text-[10px] text-muted-foreground font-bold block mb-1">
                              Your Answer:
                            </span>
                            {studentAns?.answer_text || <span className="italic text-muted-foreground">No answer submitted</span>}
                          </div>

                          {studentAns?.teacher_feedback && (
                            <div className="p-2.5 bg-primary/5 border border-primary/20 rounded-lg text-primary text-[11px]">
                              <span className="font-bold">Teacher Feedback:</span> {studentAns.teacher_feedback}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-muted/40 border-t border-border flex justify-end">
              <button
                onClick={() => setResultModalData(null)}
                className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-xs font-bold transition shadow-xs"
              >
                Close Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

