import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  closeAdjustmentModal,
  submitAdjustmentRequest,
} from '../../store/slices/dutySlice';
import { addToast } from '../../store/slices/uiSlice';
import { Modal } from '../common/Modal';

export const DutyCorrectionModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector((state) => state.duty.isAdjustmentModalOpen);
  const selectedLog = useAppSelector((state) => state.duty.selectedLogForAdjustment);

  const [requestedDuration, setRequestedDuration] = useState<number>(45);
  const [reason, setReason] = useState('');

  if (!isOpen || !selectedLog) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    dispatch(
      submitAdjustmentRequest({
        dutyLogId: selectedLog.id,
        lessonName: `${selectedLog.className} (${selectedLog.subject})`,
        currentDuration: selectedLog.durationMinutes,
        requestedDuration,
        reason,
      })
    );
    dispatch(
      addToast({
        message: 'Duty adjustment memo submitted to Payroll & Academic Operations.',
        type: 'success',
      })
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => dispatch(closeAdjustmentModal())}
      title="Teaching Duty Correction Memo"
      subtitle={`${selectedLog.className} • ${selectedLog.subject} • SRS 15.3`}
      icon="more_time"
      iconBgColor="bg-[#ffe9b0] text-[#8a6400]"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
        <div className="bg-[#f1f1fa] p-3 rounded-lg border border-indigo-100/60">
          <p className="text-xs text-[#545454]">
            Session Date: <strong className="text-[#292929]">{selectedLog.date}</strong>
          </p>
          <p className="text-xs text-[#545454]">
            Recorded Scheduled Time: <strong className="text-[#292929]">{selectedLog.scheduledTime}</strong>
          </p>
          <p className="text-xs text-[#545454]">
            Current Logged Duration: <strong className="text-[#292929]">{selectedLog.durationMinutes} mins</strong>
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#292929] mb-1">
            Requested Verified Duration (Minutes)
          </label>
          <input
            type="number"
            min="10"
            max="180"
            required
            value={requestedDuration}
            onChange={(e) => setRequestedDuration(Number(e.target.value))}
            className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-[#292929] font-bold focus:border-[#36348e] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#292929] mb-1">
            Administrative Justification &amp; Zoom Audit Memo
          </label>
          <textarea
            required
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Session extended by 15 mins for student Q&A. Verified by cloud Zoom recording timestamp."
            className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-[#292929] focus:border-[#36348e] focus:outline-none"
          ></textarea>
        </div>

        <div className="p-2.5 rounded-lg bg-amber-50 text-amber-800 text-[11px] flex items-start gap-1.5 border border-amber-200">
          <span className="material-symbols-outlined text-[16px] text-amber-600 shrink-0 mt-0.5">
            gavel
          </span>
          <span>
            Teachers cannot approve their own duty corrections or payroll adjustments. This memo is
            routed to the Principal for formal validation.
          </span>
        </div>

        <div className="pt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => dispatch(closeAdjustmentModal())}
            className="px-4 py-2 rounded-lg bg-[#e8e8f6] text-[#292929] hover:bg-[#ffedc2] text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-lg bg-[#36348e] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white font-semibold text-xs shadow-md transition-all"
          >
            Submit Memo
          </button>
        </div>
      </form>
    </Modal>
  );
};
