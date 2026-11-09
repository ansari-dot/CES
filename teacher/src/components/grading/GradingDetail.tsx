import React, { useState, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  gradeSubmissionThunk,
  returnSubmissionThunk,
  fetchTasksThunk,
  fetchSubmissionsThunk,
} from '../../store/slices/tasksSlice';
import { addToast } from '../../store/slices/uiSlice';
import { openProtectedFile } from '../../services/api';
import {
  FileEdit,
  CheckCircle2,
  RotateCcw,
  Edit3,
  Clock,
  Info,
  ShieldCheck,
  FileText,
  Eye,
  Download,
  Zap,
  Send
} from 'lucide-react';

export const GradingDetail: React.FC = () => {
  const dispatch = useAppDispatch();
  const selectedSubmissionId = useAppSelector((state) => state.tasks.selectedSubmissionId);
  const submissions = useAppSelector((state) => state.tasks.submissions);
  const tasks = useAppSelector((state) => state.tasks.tasks);
  const selectedTaskId = useAppSelector((state) => state.tasks.selectedTaskId);

  const submission = submissions.find((s) => s.id === selectedSubmissionId) || submissions[0];
  const currentTask = tasks.find((t) => t.id === submission?.taskId) || tasks.find((t) => t.id === selectedTaskId);

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
        <FileEdit className="w-10 h-10 mb-2 text-slate-300 mx-auto" />
        <p className="font-semibold text-sm text-[#292929]">No Submission Selected</p>
        <p className="text-xs text-[#777587] mt-1">Select a student from the queue on the left to grade their submission.</p>
      </div>
    );
  }

  const refreshGradebook = () => {
    // Refresh tasks and submissions so queue & class average update live
    dispatch(fetchTasksThunk());
    dispatch(fetchSubmissionsThunk(submission.taskId));
  };

  const handlePublishGrade = async (publish: boolean) => {
    if (!Number.isFinite(score) || score < 0 || score > submission.maxMarks) {
      dispatch(
        addToast({ message: `Marks must be a number between 0 and ${submission.maxMarks}.`, type: 'error' })
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await dispatch(
        gradeSubmissionThunk({
          submissionId: submission.id,
          marksAwarded: score,
          rubricScores: { accuracy, steps, simplification },
          feedback,
          publish,
        })
      );

      if (gradeSubmissionThunk.fulfilled.match(result)) {
        dispatch(
          addToast({
            message: publish
              ? `Grade published for ${submission.studentName} (${score}/${submission.maxMarks}). The student and parents can now see it.`
              : `Draft grade saved for ${submission.studentName}. It stays hidden from the student until published.`,
            type: 'success',
          })
        );
        refreshGradebook();
      } else {
        dispatch(
          addToast({
            message: String(result.payload || 'Failed to save the grade.'),
            type: 'error',
          })
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturnResubmission = async () => {
    const note = prompt('Enter instructions for the student explaining what to correct before resubmitting:', '');
    if (!note || !note.trim()) return;

    const result = await dispatch(returnSubmissionThunk({ submissionId: submission.id, note: note.trim() }));
    if (returnSubmissionThunk.fulfilled.match(result)) {
      dispatch(
        addToast({
          message: `Submission returned to ${submission.studentName} for resubmission.`,
          type: 'info',
        })
      );
      refreshGradebook();
    } else {
      dispatch(addToast({ message: String(result.payload || 'Failed to return the submission.'), type: 'error' }));
    }
  };

  const handleOpenFile = async (download: boolean) => {
    if (!submission.fileUrl) return;
    try {
      await openProtectedFile(submission.fileUrl, submission.fileName, download);
    } catch (err: any) {
      dispatch(addToast({ message: err.message || 'Unable to open the submitted file.', type: 'error' }));
    }
  };

  const isPublished = submission.status === 'graded';
  const hasDraftGrade = !isPublished && submission.marksAwarded !== undefined;

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
              <h2 className="text-xl font-bold text-[#292929]">{submission.studentName}</h2>
              <span className="px-2 py-0.5 rounded-md bg-[#dfdff2] text-[#545454] text-xs font-semibold">
                {submission.studentAdmissionId}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-[#777587] mt-0.5">
              <span>{submission.className || currentTask?.className || '—'}</span>
              <span>•</span>
              <span>Roll {submission.studentRoll}</span>
              <span>•</span>
              {isPublished ? (
                <span className="text-[#006c49] font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Grade published
                </span>
              ) : submission.status === 'resubmit_requested' ? (
                <span className="text-[#ba1a1a] font-bold flex items-center gap-1">
                  <RotateCcw className="w-3.5 h-3.5" /> Returned for resubmission
                </span>
              ) : hasDraftGrade ? (
                <span className="text-[#7a5b00] font-bold flex items-center gap-1">
                  <Edit3 className="w-3.5 h-3.5" /> Draft grade (not visible to student)
                </span>
              ) : (
                <span className="text-[#36348e] font-bold flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Awaiting review
                  {submission.isLate ? ' · Late' : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs px-2.5 py-1 rounded-full bg-[#f1f1fa] text-[#36348e] font-bold border border-indigo-100">
            {submission.submittedAt || 'Awaiting Submission'}
          </span>
        </div>
      </div>

      {/* Task Assignment Prompt Mini-Card */}
      {currentTask && (
        <div className="bg-[#f1f1fa] p-4 rounded-xl space-y-1 border border-indigo-100/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wide text-[#545454] flex items-center gap-1.5">
              <Info className="w-4 h-4 text-[#36348e]" />
              Assignment Instructions
            </span>
            <span className="text-xs text-[#36348e] font-bold">{currentTask.title}</span>
          </div>
          <p className="text-xs text-[#292929] leading-relaxed">
            &quot;{currentTask.instructions}&quot;
          </p>
        </div>
      )}

      {/* Submitted Files Artifact Box */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#545454] uppercase tracking-wider">
            Student Submission Artifact
          </span>
          <span className="text-[11px] text-[#006c49] font-semibold flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" />
            File type checked on upload
          </span>
        </div>

        {submission.fileName || submission.fileUrl ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-[#e8e8f6]/60 rounded-xl border border-indigo-100/60">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-[#fee2e2] text-[#ba1a1a] flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="truncate">
                <p className="text-xs sm:text-sm font-bold text-[#292929] truncate">
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
                onClick={() => handleOpenFile(false)}
                className="px-3 py-1.5 rounded-lg bg-white text-[#36348e] text-xs font-bold hover:bg-[#ffedc2] shadow-xs flex items-center gap-1 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" /> Preview
              </button>
              <button
                type="button"
                onClick={() => handleOpenFile(true)}
                className="px-3 py-1.5 rounded-lg bg-white text-[#545454] text-xs font-bold hover:text-[#292929] hover:bg-[#ffedc2] shadow-xs flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-[#f1f1fa] rounded-xl text-center text-xs text-[#777587] border border-indigo-100/60">
            No attached document for this submission.
          </div>
        )}

        {submission.studentNotes && (
          <div className="p-3 bg-[#f1f1fa] rounded-xl text-xs text-[#292929] border border-indigo-100/60">
            <span className="font-bold text-[#545454]">Student note: </span>
            {submission.studentNotes}
          </div>
        )}
      </div>

      {/* Grading Rubric & Marks Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#292929]">Grading Rubric &amp; Marks Awarded</h3>
            <p className="text-xs text-[#777587]">
              Breakdown calculated from standardized grade criteria
            </p>
          </div>
          {/* Large Score Input Tile */}
          <div className="flex items-center gap-2 bg-[#f1f1fa] px-4 py-2 rounded-xl border border-indigo-100">
            <label
              htmlFor="totalScoreInput"
              className="text-xs font-bold uppercase tracking-wider text-[#545454]"
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
              className="w-16 h-10 text-center text-lg font-bold text-[#36348e] bg-white rounded-lg shadow-xs focus:outline-none focus:ring-2 focus:ring-[#36348e]"
            />
            <span className="text-base font-semibold text-[#777587]">
              / {submission.maxMarks}
            </span>
          </div>
        </div>

        {/* Breakdown Matrix */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {/* Criterion 1 */}
          <div className="bg-[#f1f1fa] p-3 rounded-xl space-y-1 border border-indigo-100/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#292929]">Accuracy</span>
              <span className="text-xs font-bold text-[#006c49]">{accuracy} / 10</span>
            </div>
            <div className="w-full bg-[#d7d7ee] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#006c49] h-full"
                style={{ width: `${(accuracy / 10) * 100}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-[#777587]">9 of 10 equations correct</p>
          </div>

          {/* Criterion 2 */}
          <div className="bg-[#f1f1fa] p-3 rounded-xl space-y-1 border border-indigo-100/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#292929]">Working Steps</span>
              <span className="text-xs font-bold text-[#006c49]">{steps} / 5</span>
            </div>
            <div className="w-full bg-[#d7d7ee] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#006c49] h-full"
                style={{ width: `${(steps / 5) * 100}%` }}
              ></div>
            </div>
            <p className="text-[10px] text-[#777587]">Clear step-by-step logic</p>
          </div>

          {/* Criterion 3 */}
          <div className="bg-[#f1f1fa] p-3 rounded-xl space-y-1 border border-indigo-100/50">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#292929]">Simplification</span>
              <span className="text-xs font-bold text-[#7a5b00]">{simplification} / 5</span>
            </div>
            <div className="w-full bg-[#d7d7ee] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-[#7a5b00] h-full"
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
          <label className="text-xs font-bold text-[#292929] flex items-center gap-1.5">
            <Edit3 className="w-4 h-4 text-[#36348e]" />
            Teacher Written Feedback
          </label>
          <button
            type="button"
            onClick={handleInsertQuickPhrase}
            className="text-xs text-[#36348e] font-bold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" /> Quick Phrases
          </button>
        </div>
        <textarea
          rows={3}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          className="w-full bg-[#f1f1fa] p-3 rounded-xl text-xs sm:text-sm text-[#292929] placeholder:text-[#777587] focus:outline-hidden focus:ring-2 focus:ring-[#36348e]/30 border border-indigo-100/60"
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
          className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-[#dfdff2] hover:bg-[#d7d7ee] text-[#ba1a1a] font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          Return for Resubmission
        </button>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button
            type="button"
            disabled={isSubmitting || isPublished}
            title={isPublished ? 'This grade is already published' : undefined}
            onClick={() => handlePublishGrade(false)}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-lg bg-[#e8e8f6] text-[#292929] hover:bg-[#ffedc2] font-semibold text-xs sm:text-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            Save Draft
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => handlePublishGrade(true)}
            className="flex-1 sm:flex-initial px-6 py-2.5 rounded-lg bg-[#36348e] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            {isSubmitting ? 'Publishing Marks...' : 'Submit & Publish Grade'}
          </button>
        </div>
      </div>
    </div>
  );
};
