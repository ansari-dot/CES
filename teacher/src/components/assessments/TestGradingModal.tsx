import React, { useState, useEffect } from 'react';
import { assessmentsApi } from '../../services/assessmentsApi';
import {
  MonthlyTest,
  SubmissionRosterItem,
  StudentAttemptDetail
} from '../../types/assessments';
import {
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Award,
  AlertTriangle,
  User,
  Send,
  Save,
  ArrowLeft,
  ChevronRight,
  ShieldCheck,
  FileText,
  Mail
} from 'lucide-react';

interface Props {
  testId: number;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export const TestGradingModal: React.FC<Props> = ({ testId, isOpen, onClose, onRefresh }) => {
  const [test, setTest] = useState<MonthlyTest | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionRosterItem[]>([]);
  const [summary, setSummary] = useState<{ totalEnrolled: number; totalSubmitted: number; totalGraded: number }>({
    totalEnrolled: 0,
    totalSubmitted: 0,
    totalGraded: 0
  });
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Selected student attempt for grading
  const [activeAttemptDetail, setActiveAttemptDetail] = useState<StudentAttemptDetail | null>(null);
  const [gradingMarks, setGradingMarks] = useState<Record<number, number>>({});
  const [gradingFeedback, setGradingFeedback] = useState<Record<number, string>>({});
  const [teacherRemarks, setTeacherRemarks] = useState('');
  const [isSavingGrades, setIsSavingGrades] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isNotifyingLow, setIsNotifyingLow] = useState(false);
  const [notifyingAttemptId, setNotifyingAttemptId] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && testId) {
      loadSubmissions();
    }
  }, [isOpen, testId]);

  const loadSubmissions = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await assessmentsApi.getTestSubmissions(testId);
      setTest(res.test);
      setSubmissions(res.submissions || []);
      setSummary(res.rosterSummary || { totalEnrolled: 0, totalSubmitted: 0, totalGraded: 0 });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load test submissions.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAttempt = async (attemptId: number) => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const detail = await assessmentsApi.getAttemptDetail(testId, attemptId);
      setActiveAttemptDetail(detail);

      // Initialize grading state
      const marksMap: Record<number, number> = {};
      const feedbackMap: Record<number, string> = {};
      detail.questions.forEach((q) => {
        marksMap[q.id] = q.studentAnswer?.marks_awarded !== undefined ? Number(q.studentAnswer.marks_awarded) : 0;
        feedbackMap[q.id] = q.studentAnswer?.teacher_feedback || '';
      });
      setGradingMarks(marksMap);
      setGradingFeedback(feedbackMap);
      setTeacherRemarks(detail.attempt.teacher_remarks || '');
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to load student answers.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGrades = async () => {
    if (!activeAttemptDetail) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    // Validate marks bounds
    for (const q of activeAttemptDetail.questions) {
      if (q.question_type !== 'MCQ') {
        const awarded = gradingMarks[q.id] || 0;
        if (awarded < 0 || awarded > q.marks) {
          setErrorMsg(`Marks for Question #${q.id} must be between 0 and ${q.marks}.`);
          return;
        }
      }
    }

    try {
      setIsSavingGrades(true);
      const gradesPayload = activeAttemptDetail.questions.map((q) => ({
        questionId: q.id,
        marksAwarded: q.question_type === 'MCQ' ? (q.studentAnswer?.marks_awarded || 0) : Number(gradingMarks[q.id] || 0),
        teacherFeedback: gradingFeedback[q.id] || ''
      }));

      await assessmentsApi.submitGrades(testId, activeAttemptDetail.attempt.id, {
        grades: gradesPayload,
        teacherRemarks: teacherRemarks.trim() || undefined
      });

      setSuccessMsg('Grades and feedback saved successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);

      // Refresh data
      await loadSubmissions();
      const updated = await assessmentsApi.getAttemptDetail(testId, activeAttemptDetail.attempt.id);
      setActiveAttemptDetail(updated);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save student grades.');
    } finally {
      setIsSavingGrades(false);
    }
  };

  const handlePublishResults = async () => {
    if (!window.confirm('Are you sure you want to publish results? All students and parents will immediately be able to view their final marks, question reviews, and teacher feedback.')) {
      return;
    }

    try {
      setIsPublishing(true);
      setErrorMsg(null);
      await assessmentsApi.publishResults(testId);
      setSuccessMsg('Results published successfully to Students and Parents!');
      await loadSubmissions();
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to publish test results.');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleNotifyLowPerformers = async () => {
    if (!window.confirm('Send academic performance alert emails and portal notices to parents of all students who scored below the passing standard?')) {
      return;
    }

    try {
      setIsNotifyingLow(true);
      setErrorMsg(null);
      const res = await assessmentsApi.notifyLowPerformers(testId, { force: true });
      setSuccessMsg(res.message || 'Parent alerts dispatched successfully!');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to dispatch parent alerts.');
    } finally {
      setIsNotifyingLow(false);
    }
  };

  const handleNotifySingleAttempt = async (attemptId: number) => {
    try {
      setNotifyingAttemptId(attemptId);
      setErrorMsg(null);
      const res = await assessmentsApi.notifyAttemptParent(testId, attemptId);
      setSuccessMsg(res.message || 'Alert email and portal notice sent to parent!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to notify parent.');
    } finally {
      setNotifyingAttemptId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#1b1a47] text-white flex items-center justify-between border-b border-indigo-900/30">
          <div className="flex items-center gap-3">
            {activeAttemptDetail ? (
              <button
                onClick={() => setActiveAttemptDetail(null)}
                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition flex items-center gap-1 text-xs font-semibold mr-1"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Roster
              </button>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
              </div>
            )}
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                {activeAttemptDetail
                  ? `Grading: ${activeAttemptDetail.attempt.student_name} (${activeAttemptDetail.attempt.roll_number})`
                  : `Test Submissions & Grading: ${test?.title || 'Monthly Test'}`}
              </h2>
              <p className="text-xs text-indigo-200">
                {activeAttemptDetail
                  ? `Class: ${test?.class_name || 'Class'} | Duration: ${test?.duration_minutes} Mins | Total: ${test?.total_marks} Marks`
                  : `Class: ${test?.class_name || 'Class'} | Subject: ${test?.subject_name || 'General'}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!activeAttemptDetail && test?.status !== 'RESULTS_PUBLISHED' && (
              <button
                disabled={isPublishing || summary.totalSubmitted === 0}
                onClick={handlePublishResults}
                className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold rounded-lg text-xs shadow-xs flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isPublishing ? 'Publishing...' : 'Publish Results'}</span>
              </button>
            )}
            {test?.status === 'RESULTS_PUBLISHED' && (
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 rounded-lg text-xs font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Results Published
              </span>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-slate-800">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* VIEW A: CLASS SUBMISSIONS ROSTER */}
          {!activeAttemptDetail && (
            <div className="space-y-4">
              {/* Stat Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-[11px] text-slate-500 font-semibold uppercase">Total Enrolled</div>
                  <div className="text-xl font-extrabold text-slate-800">{summary.totalEnrolled}</div>
                </div>
                <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl">
                  <div className="text-[11px] text-indigo-700 font-semibold uppercase">Submitted</div>
                  <div className="text-xl font-extrabold text-indigo-900">{summary.totalSubmitted}</div>
                </div>
                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                  <div className="text-[11px] text-emerald-700 font-semibold uppercase">Graded</div>
                  <div className="text-xl font-extrabold text-emerald-900">{summary.totalGraded}</div>
                </div>
                <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
                  <div className="text-[11px] text-amber-700 font-semibold uppercase">Pending Evaluation</div>
                  <div className="text-xl font-extrabold text-amber-900">
                    {Math.max(0, summary.totalSubmitted - summary.totalGraded)}
                  </div>
                </div>
              </div>

              {/* Alert Actions Bar */}
              {(() => {
                const lowPerformersCount = submissions.filter(
                  (s) => s.isPassed === false || (s.attemptId != null && test?.passing_marks != null && s.totalScore != null && s.totalScore < test.passing_marks)
                ).length;

                return (
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] ${
                        lowPerformersCount > 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {lowPerformersCount} Low/Failing {lowPerformersCount === 1 ? 'Score' : 'Scores'}
                      </span>
                      <span className="text-slate-500">
                        Passing standard: <strong>{test?.passing_marks} marks</strong>
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={isNotifyingLow || lowPerformersCount === 0}
                      onClick={handleNotifyLowPerformers}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold shadow-xs flex items-center gap-1.5 transition disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Send Academic Alert emails & in-app portal notifications to all parents of failing students"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>{isNotifyingLow ? 'Dispatching Alerts...' : 'Alert Parents of Low Scorers'}</span>
                    </button>
                  </div>
                );
              })()}

              {/* Roster Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Roll #</th>
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">MCQ Score</th>
                      <th className="py-2.5 px-3">Subjective</th>
                      <th className="py-2.5 px-3">Total Score</th>
                      <th className="py-2.5 px-3">Pass/Fail</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {submissions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-slate-400">
                          No enrolled students found for this class.
                        </td>
                      </tr>
                    ) : (
                      submissions.map((sub) => (
                        <tr key={sub.studentId} className="hover:bg-slate-50/70 transition">
                          <td className="py-2.5 px-3 font-semibold text-slate-600">{sub.rollNumber}</td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">{sub.studentName}</td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                sub.status === 'GRADED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : sub.status === 'SUBMITTED'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : sub.status === 'IN_PROGRESS'
                                  ? 'bg-amber-100 text-amber-800 animate-pulse'
                                  : sub.status === 'MISSED'
                                  ? 'bg-rose-100 text-rose-800 font-extrabold border border-rose-300'
                                  : sub.status === 'AUTO_EXPIRED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {sub.status === 'MISSED' ? 'MISSED (ABSENT)' : sub.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-700">
                            {sub.attemptId ? `${sub.mcqScore} pts` : '—'}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-700">
                            {sub.attemptId ? `${sub.subjectiveScore} pts` : '—'}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-indigo-700">
                            {sub.attemptId ? `${sub.totalScore} / ${test?.total_marks}` : '—'}
                          </td>
                          <td className="py-2.5 px-3 font-semibold">
                            {sub.isPassed === null ? (
                              '—'
                            ) : sub.isPassed ? (
                              <span className="text-emerald-600 font-bold flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Passed
                              </span>
                            ) : (
                              <span className="text-rose-600 font-bold flex items-center gap-1">
                                <XCircle className="w-3.5 h-3.5" /> Failed
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {sub.attemptId ? (
                              <div className="flex items-center justify-end gap-1.5">
                                {(sub.isPassed === false || (sub.totalScore != null && test?.passing_marks != null && sub.totalScore < test.passing_marks)) && (
                                  <button
                                    type="button"
                                    disabled={notifyingAttemptId === sub.attemptId}
                                    onClick={() => handleNotifySingleAttempt(sub.attemptId!)}
                                    title="Send Alert Email & Portal Notification to Parent"
                                    className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 transition disabled:opacity-50"
                                  >
                                    <Mail className="w-3 h-3 text-rose-600" />
                                    <span>{notifyingAttemptId === sub.attemptId ? '...' : 'Alert Parent'}</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => handleOpenAttempt(sub.attemptId!)}
                                  className="px-3 py-1 bg-[#1b1a47] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white rounded-lg font-bold text-[11px] shadow-2xs inline-flex items-center gap-1 transition"
                                >
                                  <span>{sub.status === 'GRADED' ? 'Review / Edit' : 'Evaluate'}</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : sub.status === 'MISSED' ? (
                              <span className="text-rose-600 text-[11px] font-bold">Absent (0.0)</span>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">Not attempted</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW B: INDIVIDUAL STUDENT ATTEMPT EVALUATION */}
          {activeAttemptDetail && (
            <div className="space-y-5">
              {/* Attempt Meta Header */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-slate-500">Student:</span>{' '}
                  <span className="font-bold text-slate-900">{activeAttemptDetail.attempt.student_name}</span> (Roll: {activeAttemptDetail.attempt.roll_number})
                </div>
                <div>
                  <span className="text-slate-500">Submission Trigger:</span>{' '}
                  <span className="font-bold text-slate-800">
                    {activeAttemptDetail.attempt.submitted_at
                      ? `Submitted (${new Date(activeAttemptDetail.attempt.submitted_at).toLocaleTimeString()})`
                      : 'In Progress'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Current Score:</span>
                  <span className={`px-2.5 py-1 font-extrabold rounded-lg ${
                    test?.passing_marks != null && activeAttemptDetail.attempt.total_score < test.passing_marks
                      ? 'bg-rose-100 text-rose-900 border border-rose-200'
                      : 'bg-indigo-100 text-indigo-900'
                  }`}>
                    {activeAttemptDetail.attempt.total_score} / {activeAttemptDetail.test.total_marks} Marks
                  </span>
                </div>
              </div>

              {/* Low Score Alert Banner for Individual Attempt */}
              {(activeAttemptDetail.attempt.is_passed === false || (test?.passing_marks != null && activeAttemptDetail.attempt.total_score < test.passing_marks)) && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-rose-800 font-semibold">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                    <span>
                      Performance Notice: Student score ({activeAttemptDetail.attempt.total_score}/{activeAttemptDetail.test.total_marks}) is below the required passing standard ({test?.passing_marks} marks).
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={notifyingAttemptId === activeAttemptDetail.attempt.id}
                    onClick={() => handleNotifySingleAttempt(activeAttemptDetail.attempt.id)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition shadow-xs disabled:opacity-50"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>{notifyingAttemptId === activeAttemptDetail.attempt.id ? 'Sending...' : 'Send Alert Email to Parent'}</span>
                  </button>
                </div>
              )}

              {/* Questions Grading List */}
              <div className="space-y-4">
                {activeAttemptDetail.questions.map((q, idx) => {
                  const studentAns = q.studentAnswer;
                  const isMcq = q.question_type === 'MCQ';

                  return (
                    <div
                      key={q.id}
                      className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3"
                    >
                      {/* Question Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-md bg-[#1b1a47] text-white text-xs font-bold flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-700">
                            {isMcq ? 'Multiple Choice Question (Auto-Graded)' : 'Subjective Question (Teacher Evaluation)'}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-indigo-700">Max: {q.marks} Marks</span>
                      </div>

                      {/* Question Prompt */}
                      <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-lg text-xs text-slate-800 font-medium">
                        {q.prompt}
                      </div>

                      {/* If MCQ */}
                      {isMcq ? (
                        <div className="space-y-2 pt-1 text-xs">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {q.options?.map((opt) => {
                              const isSelected = studentAns?.selected_option === opt.key;
                              const isCorrect = q.correct_option === opt.key;

                              let cardStyle = 'bg-slate-50 border-slate-200';
                              if (isCorrect) cardStyle = 'bg-emerald-50 border-emerald-300 ring-1 ring-emerald-300';
                              else if (isSelected && !isCorrect) cardStyle = 'bg-rose-50 border-rose-300 ring-1 ring-rose-300';

                              return (
                                <div key={opt.key} className={`p-2 rounded-lg border flex items-center gap-2 ${cardStyle}`}>
                                  <span className="font-bold w-4">{opt.key}.</span>
                                  <span className="flex-1">{opt.text}</span>
                                  {isCorrect && (
                                    <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                                    </span>
                                  )}
                                  {isSelected && !isCorrect && (
                                    <span className="text-[10px] font-bold text-rose-700 flex items-center gap-0.5">
                                      <XCircle className="w-3.5 h-3.5" /> Student Choice
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <div className="text-[11px] font-semibold text-slate-600">
                            Auto-awarded score: <span className="text-emerald-700 font-bold">{studentAns?.marks_awarded || 0} pts</span>
                          </div>
                        </div>
                      ) : (
                        /* If Subjective */
                        <div className="space-y-3 pt-1 text-xs">
                          {/* Student Written Answer */}
                          <div>
                            <label className="block text-[11px] font-bold text-slate-600 mb-1">
                              Student's Written Response:
                            </label>
                            <div className="p-3 bg-slate-100/80 border border-slate-300 rounded-lg whitespace-pre-wrap font-sans text-slate-900 min-h-[60px]">
                              {studentAns?.answer_text ? (
                                studentAns.answer_text
                              ) : (
                                <span className="text-slate-400 italic">No answer submitted by student.</span>
                              )}
                            </div>
                          </div>

                          {/* Rubric Guide (if any) */}
                          {q.rubric_guide && (
                            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px]">
                              <span className="font-bold">Grading Rubric Guide:</span> {q.rubric_guide}
                            </div>
                          )}

                          {/* Marks Input & Feedback */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Marks Awarded (0 – {q.marks}) *
                              </label>
                              <input
                                type="number"
                                min="0"
                                max={q.marks}
                                step="0.5"
                                value={gradingMarks[q.id] ?? 0}
                                onChange={(e) =>
                                  setGradingMarks({ ...gradingMarks, [q.id]: Number(e.target.value) })
                                }
                                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 font-bold text-indigo-700 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Feedback / Comment for Student
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. Well explained, but formula had minor sign error."
                                value={gradingFeedback[q.id] || ''}
                                onChange={(e) =>
                                  setGradingFeedback({ ...gradingFeedback, [q.id]: e.target.value })
                                }
                                className="w-full border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Overall Teacher Remarks */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Overall Teacher Remarks / Performance Feedback:
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Excellent conceptual grasp. Pay closer attention to units in calculation problems."
                  value={teacherRemarks}
                  onChange={(e) => setTeacherRemarks(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-lg p-2.5 bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveAttemptDetail(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSavingGrades}
                  onClick={handleSaveGrades}
                  className="px-5 py-2 bg-[#1b1a47] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingGrades ? 'Saving...' : 'Save Evaluation'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

