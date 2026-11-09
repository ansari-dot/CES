import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { studentAssessmentsApi } from '../services/assessmentsApi';
import { ExamRoomData, ExamQuestion } from '../types/assessments';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Send,
  Save,
  ShieldAlert,
  FileText,
  HelpCircle,
  Lock,
  Video
} from 'lucide-react';

export default function ExamRoom() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();

  const [examData, setExamData] = useState<ExamRoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Current Question Index
  const [currentIndex, setCurrentIndex] = useState(0);

  // Student Draft Answers State: map of questionId -> { selectedOption, answerText }
  const [answers, setAnswers] = useState<Record<number, { selectedOption: string | null; answerText: string }>>({});

  // Auto-Save Status
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');

  // Server-Authoritative Timer State
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [isTimeUp, setIsTimeUp] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  // Live Invigilation Session Details
  const [invigilation, setInvigilation] = useState<{
    joinUrl: string;
    meetingId: string;
    passcode: string;
    invigilatorName: string;
    instructions: string;
  } | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isAutoSubmittingRef = useRef<boolean>(false);

  // Waiting room: test exists but has not opened yet (server-authoritative)
  const [waitInfo, setWaitInfo] = useState<{ targetMs: number; test: any } | null>(null);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  // 1. Initial Load of Exam Data & Timer
  useEffect(() => {
    if (!testId) return;

    const loadExam = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);
        const data = await studentAssessmentsApi.startOrResumeTest(Number(testId));

        // Test not open yet: show the live countdown waiting room. The target
        // time is computed against the server clock, never the device clock.
        const raw = data as any;
        if (raw.notOpenYet) {
          const clockOffset = new Date(raw.server_time).getTime() - Date.now();
          const targetMs = new Date(raw.available_from).getTime() - clockOffset;
          setWaitInfo({ targetMs, test: raw.test });
          setWaitSeconds(Math.max(1, Math.ceil((targetMs - Date.now()) / 1000)));
          return;
        }
        setWaitInfo(null);
        setExamData(data);

        // Attempt already submitted / expired: show the submitted screen
        // instead of entering the live room.
        if (data.is_completed) {
          setIsSubmitted(true);
          setRemainingSeconds(0);
          return;
        }

        // Calculate authoritative remaining seconds
        const expiresAt = new Date(data.attempt.expires_at).getTime();
        const now = Date.now();
        const secs = Math.max(0, Math.floor((expiresAt - now) / 1000));
        setRemainingSeconds(secs);

        // Pre-populate saved answers
        const initialAnswers: Record<number, { selectedOption: string | null; answerText: string }> = {};
        data.questions.forEach((q) => {
          initialAnswers[q.id] = {
            selectedOption: q.savedAnswer?.selected_option || null,
            answerText: q.savedAnswer?.answer_text || ''
          };
        });
        setAnswers(initialAnswers);

        // Fetch live invigilation room info
        studentAssessmentsApi.getInvigilationSession(Number(testId))
          .then((inv) => setInvigilation(inv))
          .catch(() => {});
      } catch (err: any) {
        setErrorMsg(err.message || 'Unable to access the test room.');
      } finally {
        setLoading(false);
      }
    };

    loadExam();
  }, [testId, reloadKey]);

  // 1b. Waiting-room ticking countdown; re-enters the room at zero.
  useEffect(() => {
    if (!waitInfo) return;
    const timer = setInterval(() => {
      const secs = Math.ceil((waitInfo.targetMs - Date.now()) / 1000);
      if (secs <= 0) {
        clearInterval(timer);
        setWaitInfo(null);
        setReloadKey((k) => k + 1);
      } else {
        setWaitSeconds(secs);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [waitInfo]);

  // 2. Authoritative Ticking Countdown Timer
  useEffect(() => {
    if (!examData || isSubmitted || isTimeUp) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleTimeExpired();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [examData, isSubmitted, isTimeUp]);

  // 3. Handle Time Expiration (Auto-Submit on 00:00)
  const handleTimeExpired = useCallback(async () => {
    if (isAutoSubmittingRef.current || isSubmitted) return;
    isAutoSubmittingRef.current = true;
    setIsTimeUp(true);
    setIsSubmitting(true);

    try {
      if (examData?.attempt?.id) {
        await studentAssessmentsApi.submitAttempt(examData.attempt.id);
      }
      setIsSubmitted(true);
    } catch {
      // Quiet fallback
      setIsSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  }, [examData, isSubmitted]);

  // 4. Save Draft Answer to Server
  const saveAnswerDraft = async (qId: number, selectedOpt: string | null, text: string) => {
    if (!examData?.attempt?.id || isSubmitted || isTimeUp) return;

    try {
      setSaveStatus('saving');
      await studentAssessmentsApi.saveDraft(examData.attempt.id, {
        questionId: qId,
        selectedOption: selectedOpt,
        answerText: text
      });
      setSaveStatus('saved');
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch {
      setSaveStatus('error');
    }
  };

  // 5. Handle MCQ Option Change
  const handleSelectOption = (optKey: string) => {
    if (isTimeUp || isSubmitted || !currentQuestion) return;
    const qId = currentQuestion.id;
    const currentText = answers[qId]?.answerText || '';

    setAnswers((prev) => ({
      ...prev,
      [qId]: { selectedOption: optKey, answerText: currentText }
    }));

    // Save immediately on option click
    saveAnswerDraft(qId, optKey, currentText);
  };

  // 6. Handle Subjective Answer Change (Debounced)
  const handleTextChange = (text: string) => {
    if (isTimeUp || isSubmitted || !currentQuestion) return;
    const qId = currentQuestion.id;
    const currentOpt = answers[qId]?.selectedOption || null;

    setAnswers((prev) => ({
      ...prev,
      [qId]: { selectedOption: currentOpt, answerText: text }
    }));

    setSaveStatus('saving');
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      saveAnswerDraft(qId, currentOpt, text);
    }, 1000);
  };

  // 7. Manual Submit
  const handleManualSubmit = async () => {
    if (!examData?.attempt?.id || isSubmitted) return;

    try {
      setIsSubmitting(true);
      setShowConfirmModal(false);
      await studentAssessmentsApi.submitAttempt(examData.attempt.id);
      setIsSubmitted(true);
    } catch (err: any) {
      alert(err.message || 'Failed to submit test. Please check your network and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const questions = examData?.questions || [];
  const currentQuestion = questions[currentIndex] as ExamQuestion | undefined;

  // Compute answered counts
  const answeredCount = questions.filter((q) => {
    const a = answers[q.id];
    if (q.question_type === 'MCQ') return !!a?.selectedOption;
    return !!a?.answerText && a.answerText.trim().length > 0;
  }).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white p-4">
        <div className="w-10 h-10 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-sm font-bold tracking-wider uppercase">Entering Secure Examination Room...</h2>
        <p className="text-xs text-slate-400 mt-1">Connecting to authoritative server countdown</p>
      </div>
    );
  }

  // Waiting room: the test opens soon — live server-authoritative countdown
  if (waitInfo) {
    const h = Math.floor(waitSeconds / 3600);
    const m = Math.floor((waitSeconds % 3600) / 60);
    const s = waitSeconds % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-lg text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#f1f1fa] text-[#36348e] flex items-center justify-center mx-auto">
            <Clock className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-800">{waitInfo.test?.title || 'Examination'}</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            {waitInfo.test?.subject_name ? `${waitInfo.test.subject_name} · ` : ''}
            This examination has not opened yet. It will start automatically when the countdown ends.
          </p>
          <div className="font-mono text-3xl font-extrabold text-[#1b1a47] tracking-widest tabular-nums">
            {pad(h)}:{pad(m)}:{pad(s)}
          </div>
          <p className="text-[11px] text-slate-400">Synced with the school server clock — keep this page open.</p>
          <button
            onClick={() => navigate('/student/tests')}
            className="w-full py-2.5 bg-[#1b1a47] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white rounded-xl text-xs font-bold transition shadow-xs"
          >
            Return to Monthly Tests
          </button>
        </div>
      </div>
    );
  }

  if (errorMsg || !examData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-lg text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-800">Exam Room Access Blocked</h2>
          <p className="text-xs text-slate-600 leading-relaxed">{errorMsg || 'Unable to open test room.'}</p>
          <button
            onClick={() => navigate('/student/tests')}
            className="w-full py-2.5 bg-[#1b1a47] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white rounded-xl text-xs font-bold transition shadow-xs"
          >
            Return to Monthly Tests
          </button>
        </div>
      </div>
    );
  }

  // 8. Submitted or Expired Overlay Screen
  if (isSubmitted || isTimeUp) {
    return (
      <div className="min-h-screen bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-lg w-full text-center space-y-5 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {isTimeUp ? 'Time Expired — Test Submitted!' : 'Test Submitted Successfully!'}
            </h2>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              {isTimeUp
                ? 'Your allotted duration has ended. All saved responses have been locked and submitted to your teacher.'
                : 'Your answers have been securely recorded. You will be able to review your detailed marks and teacher feedback once results are published.'}
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">Test:</span>
              <span className="font-bold text-slate-800">{examData.test.title}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Subject:</span>
              <span className="font-bold text-slate-800">{examData.test.subject_name || 'General'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Questions Answered:</span>
              <span className="font-bold text-indigo-700">
                {answeredCount} / {questions.length}
              </span>
            </div>
          </div>

          <button
            onClick={() => navigate('/student/tests')}
            className="w-full py-3 bg-[#1b1a47] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white rounded-xl text-xs font-bold transition shadow-xs"
          >
            Return to Monthly Tests Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Timer Color Classes
  const isWarning = remainingSeconds <= 300 && remainingSeconds > 60; // 1-5 mins
  const isCritical = remainingSeconds <= 60; // < 1 min

  let timerBadgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-300';
  if (isCritical) {
    timerBadgeColor = 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse ring-2 ring-rose-400';
  } else if (isWarning) {
    timerBadgeColor = 'bg-amber-100 text-amber-800 border-amber-300';
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans select-none">
      {/* Top Authoritative Exam Bar */}
      <header className="sticky top-0 z-30 bg-[#1b1a47] text-white border-b border-indigo-950 px-4 sm:px-6 py-3 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Test Meta */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-bold truncate max-w-[240px] sm:max-w-md">
                {examData.test.title}
              </h1>
              <div className="text-[11px] text-indigo-200 flex items-center gap-2">
                <span>{examData.test.subject_name || 'Subject'}</span>
                <span>•</span>
                <span>Total: {examData.test.total_marks} Marks</span>
                <span>•</span>
                <span>Pass: {examData.test.passing_marks} Marks</span>
              </div>
            </div>
          </div>

          {/* Real-Time Countdown Timer & Submit Action */}
          <div className="flex items-center gap-3">
            
            {/* Auto-Save Indicator */}
            <div className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-300">
              {saveStatus === 'saving' && (
                <span className="flex items-center gap-1 text-amber-300">
                  <div className="w-2.5 h-2.5 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
                  Saving...
                </span>
              )}
              {saveStatus === 'saved' && (
                <span className="flex items-center gap-1 text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {lastSavedTime ? `Saved ${lastSavedTime}` : 'All Saved'}
                </span>
              )}
            </div>

            {/* Countdown Badge */}
            <div
              className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 font-mono text-sm sm:text-base font-extrabold shadow-xs ${timerBadgeColor}`}
            >
              <Clock className="w-4 h-4 shrink-0" />
              <span>{formatTime(remainingSeconds)}</span>
            </div>

            {/* Submit Button */}
            <button
              onClick={() => setShowConfirmModal(true)}
              className="px-3.5 py-1.5 bg-[#ffc53a] hover:bg-amber-400 text-[#1b1a47] rounded-xl text-xs font-extrabold shadow-xs flex items-center gap-1 transition shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Submit Test</span>
              <span className="sm:hidden">Submit</span>
            </button>
          </div>
        </div>
      </header>

      {/* Live Examination Invigilation Callout Banner */}
      {invigilation && invigilation.joinUrl && (
        <div className="bg-[#14133b] text-white border-b border-indigo-900/60 px-4 sm:px-6 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              </span>
              <div>
                <span className="text-xs font-bold text-white flex items-center gap-2">
                  Live Examination Invigilation Active
                  <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300">
                    Proctor: {invigilation.invigilatorName}
                  </span>
                </span>
                <p className="text-[11px] text-indigo-200">
                  Camera must remain ON during the entire examination. Classroom Room: <span className="font-mono font-bold text-white">{invigilation.meetingId}</span>
                </p>
              </div>
            </div>

            <a
              href={invigilation.joinUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow-xs shrink-0"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Join Zoom Invigilation</span>
            </a>
          </div>
        </div>
      )}

      {/* Main Examination Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Left Column: Active Question Workspace (3 cols) */}
        <div className="lg:col-span-3 flex flex-col space-y-4">
          {currentQuestion && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 shadow-xs flex-1 flex flex-col space-y-6">
              
              {/* Question Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-[#1b1a47] text-white text-xs font-extrabold flex items-center justify-center">
                    {currentIndex + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-slate-800">
                        Question {currentIndex + 1} of {questions.length}
                      </span>
                      {currentQuestion.section_name && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {currentQuestion.section_name}
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          currentQuestion.question_type === 'MCQ'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}
                      >
                        {currentQuestion.question_type === 'MCQ' ? 'Multiple Choice' : 'Subjective'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-lg">
                  {currentQuestion.marks} {currentQuestion.marks === 1 ? 'Mark' : 'Marks'}
                </div>
              </div>

              {/* Question Prompt */}
              <div className="text-sm sm:text-base font-medium text-slate-900 leading-relaxed whitespace-pre-wrap">
                {currentQuestion.prompt}
              </div>

              {/* Question Body: MCQ Options */}
              {currentQuestion.question_type === 'MCQ' && (
                <div className="space-y-3 pt-2">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Select One Correct Option:
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {currentQuestion.options?.map((opt) => {
                      const isSelected = answers[currentQuestion.id]?.selectedOption === opt.key;

                      return (
                        <div
                          key={opt.key}
                          onClick={() => handleSelectOption(opt.key)}
                          className={`p-3.5 rounded-xl border-2 cursor-pointer flex items-center gap-3 transition ${
                            isSelected
                              ? 'bg-indigo-50/70 border-indigo-600 ring-2 ring-indigo-200 text-slate-900'
                              : 'bg-slate-50/70 border-slate-200 hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <div
                            className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-extrabold shrink-0 transition ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-600 text-white'
                                : 'border-slate-300 bg-white text-slate-600'
                            }`}
                          >
                            {opt.key}
                          </div>
                          <span className="text-xs sm:text-sm font-medium flex-1">{opt.text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Question Body: Subjective Textarea */}
              {currentQuestion.question_type !== 'MCQ' && (
                <div className="space-y-2 pt-2 flex-1 flex flex-col">
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                    <span>Type Your Answer Below:</span>
                    <span className="text-[11px] text-slate-400 font-normal">Auto-saves as you type</span>
                  </label>
                  <textarea
                    rows={8}
                    placeholder="Enter your detailed response here..."
                    value={answers[currentQuestion.id]?.answerText || ''}
                    onChange={(e) => handleTextChange(e.target.value)}
                    className="w-full flex-1 p-4 text-xs sm:text-sm border border-slate-200 rounded-xl bg-slate-50/60 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 leading-relaxed resize-y font-sans"
                  />
                </div>
              )}

              {/* Question Footer Navigation */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition flex items-center gap-1.5 disabled:opacity-40"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                {currentIndex < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                    className="px-5 py-2 bg-[#1b1a47] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                  >
                    <span>Next Question</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowConfirmModal(true)}
                    className="px-5 py-2 bg-[#ffc53a] hover:bg-amber-400 text-[#1b1a47] rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 shadow-xs"
                  >
                    <Send className="w-4 h-4" />
                    <span>Review &amp; Submit</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Question Palette & Test Summary (1 col) */}
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Question Palette
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Click any number to jump to question</p>
            </div>

            {/* Grid of Question Bubbles */}
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentIndex;
                const a = answers[q.id];
                const isAnswered =
                  q.question_type === 'MCQ'
                    ? !!a?.selectedOption
                    : !!a?.answerText && a.answerText.trim().length > 0;

                let btnStyle = 'bg-slate-100 text-slate-600 border-slate-200';
                if (isAnswered) {
                  btnStyle = 'bg-emerald-600 text-white border-emerald-600';
                }
                if (isCurrent) {
                  btnStyle = 'bg-[#1b1a47] text-white border-[#1b1a47] ring-2 ring-amber-400';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-9 rounded-xl border text-xs font-bold flex items-center justify-center transition shadow-2xs ${btnStyle}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="pt-3 border-t border-slate-100 space-y-1.5 text-[11px]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-emerald-600 shrink-0" />
                <span className="text-slate-600">Answered ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-slate-200 shrink-0" />
                <span className="text-slate-600">Unanswered ({questions.length - answeredCount})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-[#1b1a47] ring-1 ring-amber-400 shrink-0" />
                <span className="text-slate-600">Current Question</span>
              </div>
            </div>

            {/* Final Submit Block */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(true)}
                className="w-full py-2.5 bg-[#1b1a47] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Finish &amp; Submit Test</span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-800">Submit Your Test?</h3>
              <p className="text-xs text-slate-500">
                You have answered <span className="font-bold text-indigo-700">{answeredCount}</span> of{' '}
                <span className="font-bold text-slate-800">{questions.length}</span> questions.
              </p>
              {questions.length - answeredCount > 0 && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-semibold mt-2">
                  Warning: You have {questions.length - answeredCount} unanswered questions!
                </div>
              )}
            </div>

            <div className="flex items-center gap-2.5 pt-2">
              <button
                disabled={isSubmitting}
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Keep Working
              </button>
              <button
                disabled={isSubmitting}
                onClick={handleManualSubmit}
                className="flex-1 py-2 bg-[#1b1a47] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                {isSubmitting ? 'Submitting...' : 'Yes, Submit Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

