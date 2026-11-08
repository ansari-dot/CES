import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  closeAdjustmentModal,
  submitAdjustmentRequest,
} from '../../store/slices/dutySlice';
import { addToast } from '../../store/slices/uiSlice';
import { Modal } from '../common/Modal';
import { Clock, ShieldAlert } from 'lucide-react';

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
      subtitle={`${selectedLog.className} • ${selectedLog.subject} • Official Faculty Audit`}
      icon={<Clock className="w-5 h-5 text-amber-600" />}
      iconBgColor="bg-amber-50 text-amber-700 border border-amber-200"
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <p className="text-xs text-slate-600">
            Session Date: <strong className="text-slate-900 font-bold">{selectedLog.date}</strong>
          </p>
          <p className="text-xs text-slate-600 mt-1">
            Recorded Scheduled Time: <strong className="text-slate-900 font-bold">{selectedLog.scheduledTime}</strong>
          </p>
          <p className="text-xs text-slate-600 mt-1">
            Current Logged Duration: <strong className="text-slate-900 font-bold">{selectedLog.durationMinutes} mins</strong>
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1">
            Requested Verified Duration (Minutes)
          </label>
          <input
            type="number"
            min="10"
            max="180"
            required
            value={requestedDuration}
            onChange={(e) => setRequestedDuration(Number(e.target.value))}
            className="w-full h-10 px-3 bg-white border border-slate-300 rounded-xl text-slate-900 font-bold focus:border-[#36348e] focus:outline-hidden"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1">
            Administrative Justification &amp; Zoom Audit Memo
          </label>
          <textarea
            required
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Session extended by 15 mins for student Q&A. Verified by cloud Zoom recording timestamp."
            className="w-full p-3 bg-white border border-slate-300 rounded-xl text-slate-900 focus:border-[#36348e] focus:outline-hidden"
          ></textarea>
        </div>

        <div className="p-3 rounded-xl bg-amber-50 text-amber-900 text-xs flex items-start gap-2 border border-amber-200">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <span>
            Faculty members cannot unilaterally approve their own duty corrections. This memo is
            routed to the Principal for formal administrative validation.
          </span>
        </div>

        <div className="pt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => dispatch(closeAdjustmentModal())}
            className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-5 py-2 rounded-xl bg-[#36348e] hover:bg-[#2c2a75] text-white font-bold text-xs shadow-md transition-all cursor-pointer"
          >
            Submit Memo
          </button>
        </div>
      </form>
    </Modal>
  );
};
