import React, { useEffect, useState } from 'react';
import { useAppDispatch } from '../../store';
import {
  fetchTaskRosterThunk,
  recordMarksThunk,
  fetchTasksThunk,
  fetchSubmissionsThunk,
  RosterEntry,
} from '../../store/slices/tasksSlice';
import { addToast } from '../../store/slices/uiSlice';
import { Modal } from '../common/Modal';
import { Task } from '../../types';

interface QuickGradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: Task | undefined;
}

/**
 * Records marks for the whole class roster of one assessment (e.g. a quiz or
 * test taken in class). Saves into the same grade records used by the grading
 * queue, student and parent portals and the principal's reports.
 */
export const QuickGradeModal: React.FC<QuickGradeModalProps> = ({ isOpen, onClose, task }) => {
  const dispatch = useAppDispatch();
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [marks, setMarks] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !task) return;
    setLoading(true);
    setError(null);
    dispatch(fetchTaskRosterThunk(task.id)).then((result) => {
      setLoading(false);
      if (fetchTaskRosterThunk.fulfilled.match(result)) {
        setRoster(result.payload);
        const initial: Record<number, string> = {};
        result.payload.forEach((r) => {
          initial[r.studentId] = r.marksAwarded != null ? String(r.marksAwarded) : '';
        });
        setMarks(initial);
      } else {
        setError(String(result.payload || 'Failed to load the class roster.'));
      }
    });
  }, [isOpen, task, dispatch]);

  if (!task) return null;

  const save = async (publish: boolean) => {
    const entries: { studentId: number; marksAwarded: number }[] = [];
    for (const r of roster) {
      const raw = (marks[r.studentId] ?? '').trim();
      if (raw === '') continue;
      const value = Number(raw);
      if (!Number.isFinite(value) || value < 0 || value > task.totalMarks) {
        dispatch(addToast({ message: `${r.studentName}: marks must be between 0 and ${task.totalMarks}.`, type: 'error' }));
        return;
      }
      entries.push({ studentId: r.studentId, marksAwarded: value });
    }
    if (entries.length === 0) {
      dispatch(addToast({ message: 'Enter marks for at least one student.', type: 'error' }));
      return;
    }

    setSaving(true);
    const result = await dispatch(recordMarksThunk({ taskId: task.id, entries, publish }));
    setSaving(false);

    if (recordMarksThunk.fulfilled.match(result)) {
      dispatch(
        addToast({
          message: publish
            ? `Marks published for ${entries.length} students in "${task.title}".`
            : `Draft marks saved for ${entries.length} students. Students will not see them until published.`,
          type: 'success',
        })
      );
      dispatch(fetchTasksThunk());
      dispatch(fetchSubmissionsThunk(task.id));
      onClose();
    } else {
      dispatch(addToast({ message: String(result.payload || 'Failed to save marks.'), type: 'error' }));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Quick-Grade Table"
      subtitle={`${task.title} · ${task.className} · Max ${task.totalMarks} marks`}
      icon="speed"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4 text-xs sm:text-sm">
        {loading ? (
          <p className="py-8 text-center text-[#777587] text-xs">Loading class roster…</p>
        ) : error ? (
          <p className="py-8 text-center text-[#ba1a1a] text-xs">{error}</p>
        ) : roster.length === 0 ? (
          <p className="py-8 text-center text-[#777587] text-xs">No active students are enrolled in this class.</p>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0">
                <tr className="bg-[#f1f1fa] text-[#545454] font-bold uppercase tracking-wider border-b border-slate-200 h-9">
                  <th className="px-3">Student</th>
                  <th className="px-3 w-32">Status</th>
                  <th className="px-3 w-28 text-right">Marks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {roster.map((r) => (
                  <tr key={r.studentId} className="h-11">
                    <td className="px-3">
                      <span className="font-bold text-[#292929] block">{r.studentName}</span>
                      <span className="text-[11px] text-[#777587] font-mono">
                        {r.admissionNo}
                        {r.rollNo ? ` · Roll ${r.rollNo}` : ''}
                      </span>
                    </td>
                    <td className="px-3 text-[11px] text-[#545454]">
                      {r.status === 'GRADED'
                        ? 'Published'
                        : r.status === 'NOT_SUBMITTED'
                        ? 'Not submitted'
                        : r.marksAwarded != null
                        ? 'Draft marks'
                        : r.hasFile
                        ? 'Submitted'
                        : 'Pending'}
                    </td>
                    <td className="px-3 text-right">
                      <input
                        type="number"
                        min={0}
                        max={task.totalMarks}
                        step="0.5"
                        value={marks[r.studentId] ?? ''}
                        onChange={(e) => setMarks((prev) => ({ ...prev, [r.studentId]: e.target.value }))}
                        className="w-20 h-8 text-center font-bold text-[#36348e] bg-[#f1f1fa] rounded-lg border border-indigo-100 focus:outline-none focus:ring-2 focus:ring-[#36348e]/30"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[11px] text-[#777587]">
          Leave a field empty to skip that student. Published marks appear in the Student and Parent portals and in the Principal's academic reports.
        </p>

        <div className="pt-1 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#e8e8f6] text-[#292929] hover:bg-[#ffedc2] text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || loading || roster.length === 0}
            onClick={() => save(false)}
            className="px-4 py-2 rounded-lg bg-[#e8e8f6] text-[#292929] hover:bg-[#ffedc2] text-xs font-semibold disabled:opacity-50"
          >
            Save Draft
          </button>
          <button
            type="button"
            disabled={saving || loading || roster.length === 0}
            onClick={() => save(true)}
            className="px-5 py-2 rounded-lg bg-[#36348e] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white font-semibold text-xs shadow-md transition-all disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Publish Marks'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
