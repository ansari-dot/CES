import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { closeProblemModal } from '../../store/slices/timetableSlice';
import { addToast } from '../../store/slices/uiSlice';
import { Modal } from '../common/Modal';

export const ZoomProblemModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const lesson = useAppSelector((state) => state.timetable.activeProblemModalLesson);

  const [issueType, setIssueType] = useState('Host SSO Authentication Failed');
  const [urgency, setUrgency] = useState<'medium' | 'critical'>('medium');
  const [details, setDetails] = useState('');

  if (!lesson) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(closeProblemModal());
    dispatch(
      addToast({
        message: `IT Helpdesk Ticket transmitted for ${lesson.className} (${issueType}). Diagnostic trace attached.`,
        type: 'error',
      })
    );
  };

  return (
    <Modal
      isOpen={!!lesson}
      onClose={() => dispatch(closeProblemModal())}
      title="Report Zoom Issue"
      subtitle={`${lesson.className} Room • ID: ${lesson.zoomRoomId} • SRS 5.3`}
      icon="warning"
      iconBgColor="bg-[#fee2e2] text-[#ba1a1a]"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
        <div>
          <label className="block text-xs font-semibold text-[#121c2a] mb-1">
            Issue Classification
          </label>
          <select
            value={issueType}
            onChange={(e) => setIssueType(e.target.value)}
            className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-[#121c2a] focus:border-[#3525cd] focus:outline-none"
          >
            <option>Host SSO Authentication Failed</option>
            <option>Audio / Echo Interference</option>
            <option>Students Locked in Waiting Room</option>
            <option>Screen Sharing Disabled by Host Error</option>
            <option>Unexpected Room Disconnection</option>
            <option>Bandwidth Jitter / Video Freeze</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#121c2a] mb-1">Urgency Level</label>
          <div className="grid grid-cols-2 gap-2">
            <label
              className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer border transition-colors ${
                urgency === 'medium'
                  ? 'border-[#684000] bg-amber-50 text-[#92400e]'
                  : 'border-slate-200 bg-[#eff4ff] text-[#464555]'
              }`}
            >
              <input
                type="radio"
                name="urgency"
                checked={urgency === 'medium'}
                onChange={() => setUrgency('medium')}
                className="accent-[#684000]"
              />
              <span className="text-xs font-semibold">Post-Lesson (Log only)</span>
            </label>

            <label
              className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer border transition-colors ${
                urgency === 'critical'
                  ? 'border-[#ba1a1a] bg-red-50 text-[#ba1a1a]'
                  : 'border-slate-200 bg-[#eff4ff] text-[#464555]'
              }`}
            >
              <input
                type="radio"
                name="urgency"
                checked={urgency === 'critical'}
                onChange={() => setUrgency('critical')}
                className="accent-[#ba1a1a]"
              />
              <span className="text-xs font-semibold">Critical (Live now)</span>
            </label>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#121c2a] mb-1">
            Diagnostic Details
          </label>
          <textarea
            rows={3}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Include error codes, affected student names, or device info..."
            className="w-full p-3 bg-white border border-slate-200 rounded-lg text-[#121c2a] focus:border-[#3525cd] focus:outline-none"
          ></textarea>
        </div>

        <div className="pt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => dispatch(closeProblemModal())}
            className="px-4 py-2 rounded-lg bg-[#e6eeff] text-[#121c2a] hover:bg-[#dee9fc] text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-lg bg-[#ba1a1a] hover:bg-[#991b1b] text-white font-semibold text-xs shadow-md transition-all"
          >
            Transmit IT Ticket
          </button>
        </div>
      </form>
    </Modal>
  );
};
