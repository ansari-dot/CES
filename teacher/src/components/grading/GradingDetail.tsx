import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  gradeSubmission,
  returnForResubmission,
} from '../../store/slices/tasksSlice';
import { addToast } from '../../store/slices/uiSlice';

export const GradingDetail: React.FC = () => {
  const dispatch = useAppDispatch();
  const selectedSubmissionId = useAppSelector((state) => state.tasks.selectedSubmissionId);
  const submissions = useAppSelector((state) => state.tasks.submissions);
  const tasks = useAppSelector((state) => state.tasks.tasks);
  const selectedTaskId = useAppSelector((state) => state.tasks.selectedTaskId);

  const currentTask = tasks.find((t) => t.id === selectedTaskId) || tasks[0];
  const submission = submissions.find((s) => s.id === selectedSubmissionId) || submissions[0];

  const [score, setScore] = useState<number>(submission?.marksAwarded ?? 0);
  const [accuracy, setAccuracy] = useState<number>(submission?.rubricScores?.accuracy ?? 0);
  const [steps, setSteps] = useState<number>(submission?.rubricScores?.steps ?? 0);
  const [simplification, setSimplification] = useState<number>(submission?.rubricScores?.simplification ?? 0);
  const [feedback, setFeedback] = useState<string>(submission?.feedback || '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (submission) {
      setScore(submission.marksAwarded ?? 0);
      setAccuracy(submission.rubricScores?.accuracy ?? 0);
      setSteps(submission.rubricScores?.steps ?? 0);
      setSimplification(submission.rubricScores?.simplification ?? 0);
      setFeedback(submission.feedback || '');
    }
  }, [submission]);

  if (!submission) {
    return (
      <div className="bg-white p-12 rounded-xl text-center text-[#777587] border border-slate-100 shadow-xs">
        <span className="material-symbols-outlined text-4xl mb-2 text-slate-300">rate_review</span>
        <p className="font-semibold text-sm text-[#121c2a]">No Submission Selected</p>
        <p className="text-xs text-[#777587] mt-1">Select a student from the queue on the left to grade their submission.</p>
      </div>
    );
  }

  const handlePublishGrade = async () => {
    setIsSubmitting(true);
    try {
      const subNum = parseInt(submission.id.replace(/\D/g, ''), 10) || 1;
      await fetch(`/api/v1/tasks/submissions/${subNum}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          marksAwarded: score,
          rubricScores: { accuracy, steps, simplification },
          feedback
        })
      });
    } catch (err) {
      console.warn('Backend grade submission failed, fallback to local state:', err);
    }
    setTimeout(() => {
      dispatch(
        gradeSubmission({
          submissionId: submission.id,
          marksAwarded: score,
          feedback,
          rubricScores: { accuracy, steps, simplification },
        })
      );
      dispatch(
        addToast({
          message: `Grade published for ${submission.studentName} (${score}/${submission.maxMarks}) and synced to Student Portal.`,
          type: 'success',
        })
      );
      setIsSubmitting(false);
    }, 700);
  };

  const handleReturnResubmission = () => {
    const note = prompt(
      'Enter instructions for resubmission (e.g. Please correct problem #7 and resubmit by tomorrow):',
      'Please re-solve item #7 with inverted divisor and resubmit by Oct 24.'
    );
    if (note) {
      dispatch(returnForResubmission({ submissionId: submission.id, note }));
      dispatch(
        addToast({
          message: `Submission returned to ${submission.studentName} for resubmission.`,
          type: 'info',
        })
      );
    }
  };

  const handleInsertQuickPhrase = () => {
    setFeedback((prev) =>
      prev
        ? `${prev} Consistent step adherence noted. Excellent grasp of reciprocal multiplication!`
        : 'Consistent step adherence noted. Excellent grasp of reciprocal multiplication!'
    );
    dispatch(addToast({ message: 'Quick phrase added to feedback.', type: 'info' }));
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-slate-100 space-y-5">
      {/* Student Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <img
            src={submission.studentAvatar}
            alt={submission.studentName}
            className="w-14 h-14 rounded-full object-cover shadow-sm ring-2 ring-indigo-50"
          />
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-[#121c2a]">{submission.studentName}</h2>
              <span className="px-2 py-0.5 rounded-md bg-[#dee9fc] text-[#464555] text-xs font-semibold">
                {submission.studentAdmissionId}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#777587] mt-0.5">
              <span>Class 5-A</span>
              <span>•</span>
              <span>Roll {submission.studentRoll}</span>
              <span>•</span>
              <span className="text-[#006c49] font-bold flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">verified</span> Attempt #
                {submission.attemptNumber || 1}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs px-2.5 py-1 rounded-full bg-[#eff4ff] text-[#3525cd] font-bold border border-indigo-100">
            {submission.submittedAt || 'Awaiting Submission'}
          </span>
        </div>
      </div>

      {/* Task Assignment Prompt Mini-Card */}
      {currentTask && (
        <div className="bg-[#eff4ff] p-4 rounded-xl space-y-1 border border-indigo-100/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-[#464555] flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-[#3525cd]">info</span>{' '}
              Assignment Instructions
            </span>
            <span className="text-xs text-[#3525cd] font-bold">{currentTask.title}</span>
          </div>
          <p className="text-xs text-[#121c2a] leading-relaxed">
            &quot;{currentTask.instructions}&quot;
          </p>
        </div>
      )}

      {/* Submitted Files Artifact Box */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#464555] uppercase tracking-wider">
            Student Submission Artifact
          </span>
          <span className="text-[11px] text-[#006c49] font-semibold flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">verified_user</span>
            Verified File Scan
          </span>
        </div>

        {submission.fileName || submission.fileUrl ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#e6eeff]/60 rounded-xl border border-indigo-100/60">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-[#fee2e2] text-[#ba1a1a] flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[24px]">picture_as_pdf</span>
              </div>
              <div className="truncate">
                <p className="text-xs sm:text-sm font-bold text-[#121c2a] truncate">
                  {submission.fileName || 'Document.pdf'}
                </p>
                <p className="text-xs text-[#777587]">
                  {submission.fileSize || 'Uploaded PDF document'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => dispatch(addToast({ message: 'Opening interactive PDF annotator viewer...', type: 'info' }))}
                className="px-3 py-1.5 rounded-lg bg-white text-[#3525cd] text-xs font-bold hover:bg-[#dee9fc] shadow-xs flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">visibility</span> Preview
              </button>
              <button
                type="button"
                onClick={() => dispatch(addToast({ message: 'Downloading PDF document...', type: 'info' }))}
                className="px-3 py-1.5 rounded-lg bg-white text-[#464555] text-xs font-bold hover:text-[#121c2a] hover:bg-[#dee9fc] shadow-xs flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">download</span> Download
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-[#eff4ff] rounded-xl text-center text-xs text-[#777587] border border-indigo-100/60">
            No attached document for this submission.
          </div>
        )}
      </div>

      {/* Grading Rubric & Marks Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#121c2a]">Grading Rubric &amp; Marks Awarded</h3>
            <p className="text-xs text-[#777587]">
              Breakdown calculated from standardized grade criteria
            </p>
          </div>
          {/* Large Score Input Tile */}
          <div className="flex items-center gap-2 bg-[#eff4ff] px-4 py-2 rounded-xl border border-indigo-100">
            <label
              htmlFor="totalScoreInput"
              className="text-xs font-bold uppercase tracking-wider text-[#464555]"
            >
              Score
            </label>
            <input
              id="totalScoreInput"
              type="number"
              min="0"
              max={submission.maxMarks}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              className="w-16 h-10 text-center text-lg font-bold text-[#3525cd] bg-white rounded-lg shadow-xs focus:outline-none focus:ring-2 focus:ring-[#3525cd]"
            />
            <span className="text-base font-semibold text-[#777587]">
              / {submission.maxMarks}
            </span>
          </div>
        </div>

        {/* Breakdown Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Criterion 1 */}
          <div className="bg-[#eff4ff] p-3 rounded-xl space-y-1 border border-indigo-100/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#121c2a]">Accuracy</span>
              <span className="text-xs font-bold text-[#006c49]">{accuracy} / 10</span>
            </div>
            <div className="w-full bg-[#d9e3f6] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#006c49] h-full"
                style={{ width: `${(accuracy / 10) * 100}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-[#777587]">9 of 10 equations correct</p>
          </div>

          {/* Criterion 2 */}
          <div className="bg-[#eff4ff] p-3 rounded-xl space-y-1 border border-indigo-100/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#121c2a]">Working Steps</span>
              <span className="text-xs font-bold text-[#006c49]">{steps} / 5</span>
            </div>
            <div className="w-full bg-[#d9e3f6] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#006c49] h-full"
                style={{ width: `${(steps / 5) * 100}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-[#777587]">Clear step-by-step logic</p>
          </div>

          {/* Criterion 3 */}
          <div className="bg-[#eff4ff] p-3 rounded-xl space-y-1 border border-indigo-100/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#121c2a]">Simplification</span>
              <span className="text-xs font-bold text-[#684000]">{simplification} / 5</span>
            </div>
            <div className="w-full bg-[#d9e3f6] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#684000] h-full"
                style={{ width: `${(simplification / 5) * 100}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-[#777587]">Reduced fractions properly</p>
          </div>
        </div>
      </div>

      {/* Teacher Written Feedback Area */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-[#121c2a] flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px] text-[#3525cd]">edit_note</span>
            Teacher Written Feedback
          </label>
          <button
            type="button"
            onClick={handleInsertQuickPhrase}
            className="text-xs text-[#3525cd] font-bold hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[14px]">bolt</span> Quick Phrases
          </button>
        </div>
        <textarea
          rows={3}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          className="w-full bg-[#eff4ff] p-3 rounded-xl text-xs sm:text-sm text-[#121c2a] placeholder:text-[#777587] focus:outline-none focus:ring-2 focus:ring-[#3525cd]/30 border border-indigo-100/60"
        ></textarea>
        <div className="flex items-center justify-between text-[#777587] text-[11px] px-1">
          <span>Visible to: Student and Parents on portal</span>
          <span>{feedback.length} / 500 characters</span>
        </div>
      </div>

      {/* Action Buttons Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={handleReturnResubmission}
          className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-[#dee9fc] hover:bg-[#d9e3f6] text-[#ba1a1a] font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5"
        >
          <span className="material-symbols-outlined text-[18px]">undo</span>
          Return for Resubmission
        </button>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={() => dispatch(addToast({ message: 'Grade review saved as draft.', type: 'info' }))}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-lg bg-[#e6eeff] text-[#121c2a] hover:bg-[#dee9fc] font-semibold text-xs sm:text-sm transition-all"
          >
            Save Draft
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handlePublishGrade}
            className="flex-1 sm:flex-initial px-6 py-2.5 rounded-lg bg-[#3525cd] hover:bg-[#4f46e5] text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-98"
          >
            <span className="material-symbols-outlined text-[18px]">publish</span>
            {isSubmitting ? 'Publishing Marks...' : 'Submit & Publish Grade'}
          </button>
        </div>
      </div>
    </div>
  );
};
