import React, { useState } from 'react';
import Modal from '../common/Modal';
import { UploadCloud, FileText, CheckCircle2 } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../store';
import { submitAssignment, AssignmentItem } from '../../store/slices/assignmentsSlice';
import { submitTaskFile } from '../../store/slices/assignmentsSlice';
import { setToast } from '../../store/slices/studentSlice';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignment.taskId) return;
    setIsSubmitting(true);

    const result = await dispatch(submitTaskFile({
      taskId: assignment.taskId,
      file: file ?? null,
      studentNotes: notes,
    }));

    setIsSubmitting(false);

    if (submitTaskFile.fulfilled.match(result)) {
      // optimistic local state update
      dispatch(submitAssignment({ id: assignment.id, fileName: file?.name ?? 'submission' }));
      dispatch(setToast(`Submitted "${assignment.title}" successfully!`));
      setFile(null);
      setNotes('');
      onClose();
    } else {
      dispatch(setToast(String(result.payload) || 'Submission failed. Please try again.'));
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Submit: ${assignment.title}`} maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {assignment.instructions && (
          <div className="bg-muted p-3.5 rounded-sm text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Teacher Instructions:</span> {assignment.instructions}
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
              onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
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
    </Modal>
  );
}
