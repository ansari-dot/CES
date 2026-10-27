import React, { useState } from 'react';
import Modal from '../common/Modal';
import { UploadCloud, FileText, CheckCircle2, Paperclip, AlertCircle } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store';
import { AssignmentItem, submitTaskFile, fetchTasks } from '../../store/slices/assignmentsSlice';
import { setToast } from '../../store/slices/studentSlice';
import { openProtectedFile } from '../../services/api';

const MAX_SUBMISSION_BYTES = 10 * 1024 * 1024;

interface SubmitAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: AssignmentItem | null;
}

export default function SubmitAssignmentModal({ isOpen, onClose, assignment }: SubmitAssignmentModalProps) {
  const dispatch = useDispatch<AppDispatch>();
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!assignment) return null;

  const openFile = async (url?: string, name?: string, download = false) => {
    if (!url) return;
    try {
      await openProtectedFile(url, name, download);
    } catch (err: any) {
      dispatch(setToast(err.message || 'Unable to open the file.'));
    }
  };

  const handoutRow = assignment.attachmentUrl ? (
    <button
      type="button"
      onClick={() => openFile(assignment.attachmentUrl, assignment.attachment, true)}
      className="w-full border border-border rounded-sm p-3 flex items-center justify-between text-xs bg-muted/30 hover:bg-muted/60 cursor-pointer"
    >
      <span className="flex items-center gap-2 text-foreground font-medium">
        <Paperclip className="w-4 h-4 text-primary" />
        <span className="truncate max-w-[280px]">{assignment.attachment || 'Assignment handout'}</span>
      </span>
      <span className="text-primary font-semibold shrink-0">Download</span>
    </button>
  ) : null;

  const handleFileChosen = (chosen: File | undefined) => {
    if (!chosen) return;
    if (chosen.size > MAX_SUBMISSION_BYTES) {
      dispatch(setToast('This file is larger than 10 MB. Please upload a smaller file.'));
      return;
    }
    setFile(chosen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignment.taskId) return;
    if (!file && !notes.trim()) {
      dispatch(setToast('Attach your work or add a note before submitting.'));
      return;
    }
    setIsSubmitting(true);

    const result = await dispatch(submitTaskFile({
      taskId: assignment.taskId,
      file: file ?? null,
      studentNotes: notes,
    }));

    setIsSubmitting(false);

    if (submitTaskFile.fulfilled.match(result)) {
      dispatch(setToast(`Submitted "${assignment.title}" successfully!`));
      dispatch(fetchTasks());
      setFile(null);
      setNotes('');
      onClose();
    } else {
      dispatch(setToast(String(result.payload || 'Submission failed. Please try again.')));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        assignment.status === 'Graded'
          ? `Assignment Evaluation: ${assignment.title}`
          : assignment.status === 'Submitted'
          ? `Submission Details: ${assignment.title}`
          : `Submit Assignment: ${assignment.title}`
      }
      maxWidth="max-w-xl"
    >
      {assignment.status === 'Graded' ? (
        <div className="space-y-4">
          {/* Graded Header Score Banner */}
          <div className="bg-success-bg border border-success/30 rounded-md p-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-success uppercase tracking-wider">Evaluation Grade</div>
              <div className="text-3xl font-headings font-bold text-foreground mt-0.5">
                {assignment.score !== undefined ? assignment.score : '—'}
                <span className="text-sm font-normal text-muted-foreground ml-1">/ {assignment.marks}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {assignment.score !== undefined && assignment.marks > 0
                  ? `${Math.round((assignment.score / assignment.marks) * 100)}% achieved`
                  : 'Score registered'}
                {assignment.gradedAt ? ` · Graded ${assignment.gradedAt}` : ''}
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-sm bg-success text-white text-xs font-bold uppercase tracking-wider">
              Graded
            </div>
          </div>

          {/* Teacher Feedback Quote */}
          {assignment.feedback ? (
            <div className="bg-card border border-border rounded-md p-4 space-y-1.5">
              <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-success" />
                Teacher Written Feedback
              </div>
              <p className="text-xs text-muted-foreground italic bg-muted/40 p-3 rounded-sm border-l-2 border-primary">
                “{assignment.feedback}”
              </p>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-sm">
              Your teacher has completed evaluating this assignment.
            </div>
          )}

          {/* Assignment Details */}
          {assignment.instructions && (
            <div className="bg-muted/50 p-3.5 rounded-sm text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Instructions Reference: </span>
              {assignment.instructions}
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-primary text-white text-xs font-bold rounded-sm hover:bg-primary-hover cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      ) : assignment.status === 'Submitted' ? (
        <div className="space-y-4">
          <div className="bg-info-bg border border-info/30 rounded-md p-5 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-info uppercase tracking-wider">Coursework Submitted</div>
              <div className="text-sm font-semibold text-foreground mt-1">
                Awaiting Teacher Grading
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Target Marks: {assignment.marks}
                {assignment.submittedAt ? ` · Submitted ${assignment.submittedAt}` : ''}
                {assignment.isLate ? ' · after the deadline' : ''}
              </div>
              {assignment.receiptId && (
                <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">Receipt {assignment.receiptId}</div>
              )}
            </div>
            <div className="px-3 py-1 rounded-sm bg-info text-white text-xs font-bold">
              In Review
            </div>
          </div>

          {assignment.submittedFileUrl && (
            <button
              type="button"
              onClick={() => openFile(assignment.submittedFileUrl, assignment.submittedFile)}
              className="w-full border border-border rounded-sm p-3 flex items-center justify-between text-xs bg-muted/30 hover:bg-muted/60 cursor-pointer"
            >
              <span className="flex items-center gap-2 text-foreground font-medium">
                <FileText className="w-4 h-4 text-error" />
                <span className="truncate max-w-[280px]">{assignment.submittedFile || 'Your submission'}</span>
              </span>
              <span className="text-primary font-semibold shrink-0">View</span>
            </button>
          )}

          {handoutRow}

          {assignment.instructions && (
            <div className="bg-muted p-3.5 rounded-sm text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Instructions: </span>
              {assignment.instructions}
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-muted text-foreground text-xs font-bold rounded-sm hover:bg-muted/80 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {assignment.resubmitRequested && (
            <div className="bg-warning-bg border border-warning/30 rounded-sm p-3.5 text-xs text-foreground flex gap-2">
              <AlertCircle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Your teacher returned this for resubmission: </span>
                {assignment.feedback || 'Please review and submit again.'}
              </div>
            </div>
          )}

          {assignment.instructions && (
            <div className="bg-muted p-3.5 rounded-sm text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Teacher Instructions:</span> {assignment.instructions}
            </div>
          )}

          {handoutRow}

          {assignment.status === 'Overdue' && (
            <div className="text-xs text-error font-semibold">
              The deadline has passed. Your submission will be marked as late.
            </div>
          )}

          <div className="border-2 border-dashed border-border rounded-md p-6 flex flex-col items-center justify-center text-center bg-card">
            <UploadCloud className="w-10 h-10 text-primary mb-2 stroke-[1.8]" />
            <div className="text-sm font-semibold text-foreground mb-0.5">Drop files here or browse</div>
            <div className="text-xs text-muted-foreground mb-3">PDF, JPG or PNG · max 10 MB each</div>
            <label className="text-xs font-semibold bg-secondary text-primary px-3 py-1.5 rounded-sm cursor-pointer hover:bg-secondary/70">
              Select Document
              <input
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(e) => handleFileChosen(e.target.files?.[0])}
              />
            </label>
          </div>

          {file && (
            <div className="border border-border rounded-sm p-3 flex items-center justify-between text-xs bg-muted/30">
              <div className="flex items-center gap-2 text-foreground font-medium">
                <FileText className="w-4 h-4 text-error" />
                <span className="truncate max-w-[280px]">{file.name}</span>
              </div>
              <span className="text-success font-semibold flex items-center gap-1 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" /> Ready
              </span>
            </div>
          )}

          <textarea
            placeholder="Add a note for your teacher (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full bg-card border border-border rounded-sm px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-border rounded-sm text-sm font-semibold text-foreground hover:bg-muted cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-primary text-white rounded-sm text-sm font-bold hover:bg-primary-hover disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Uploading…' : 'Submit Assignment'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
