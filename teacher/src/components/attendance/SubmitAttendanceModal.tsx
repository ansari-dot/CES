import React from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  closeSubmitModal,
  submitAttendanceThunk,
} from '../../store/slices/attendanceSlice';
import { addToast } from '../../store/slices/uiSlice';
import { Modal } from '../common/Modal';

export const SubmitAttendanceModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector((state) => state.attendance.isSubmitModalOpen);
  const roster = useAppSelector((state) => state.attendance.roster);
  const teacher = useAppSelector((state) => state.auth.teacher);
  const currentLessonId = useAppSelector((state) => state.attendance.currentLessonId);

  const presentCount = roster.filter((r) => r.status === 'present').length;
  const absentCount = roster.filter((r) => r.status === 'absent').length;
  const lateCount = roster.filter((r) => r.status === 'late' || r.status === 'leave').length;
  const excusedCount = roster.filter((r) => r.status === 'excused').length;

  const handleConfirm = async () => {
    try {
      const lessonNum = parseInt(currentLessonId.replace(/\D/g, ''), 10) || 1;
      await dispatch(
        submitAttendanceThunk({
          lessonId: lessonNum,
          records: roster.map((r) => ({
            studentId: r.studentId,
            status: r.status,
            remark: r.remark,
          })),
          isLocked: true,
        })
      ).unwrap();

      dispatch(
        addToast({
          message: 'Attendance finalized & locked into institutional records.',
          type: 'success',
        })
      );
    } catch (err: any) {
      dispatch(addToast({ message: err || 'Failed to finalize attendance', type: 'error' }));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => dispatch(closeSubmitModal())}
      title="Confirm Final Attendance Record"
      subtitle="Sign off and lock attendance per Institutional Compliance SRS 6.2"
      icon="lock_clock"
      iconBgColor="bg-[#d1fae5] text-[#006c49]"
    >
      <div className="space-y-4">
        <p className="text-sm text-[#545454]">
          You are about to sign off and submit verified attendance for{' '}
          <strong className="text-[#292929]">
            {teacher.assignedClasses?.[0]
              ? `${teacher.assignedClasses[0].name} • ${teacher.assignedClasses[0].subject}`
              : 'Current Active Session'}
          </strong>{' '}
          (Period 1).
        </p>

        {/* Breakdown summary */}
        <div className="bg-[#f1f1fa] rounded-xl p-4 space-y-2 border border-indigo-100/60">
          <div className="flex justify-between items-center text-xs sm:text-sm font-semibold">
            <span className="text-[#545454]">Present Students:</span>
            <span className="text-[#006c49]">{presentCount}</span>
          </div>
          <div className="flex justify-between items-center text-xs sm:text-sm font-semibold">
            <span className="text-[#545454]">Absent Students:</span>
            <span className="text-[#ba1a1a]">
              {absentCount} {absentCount > 0 ? '(Guardian automated notification queued)' : ''}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs sm:text-sm font-semibold">
            <span className="text-[#545454]">Tardy / Late:</span>
            <span className="text-[#8a6400]">{lateCount}</span>
          </div>
          <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs text-[#777587]">
            <span>Signee:</span>
            <span className="font-semibold text-[#292929]">
              {teacher.name} ({teacher.employeeId})
            </span>
          </div>
        </div>

        {/* Warning memo */}
        <div className="p-3 rounded-lg bg-amber-50 text-amber-900 text-xs flex items-start gap-2 border border-amber-200">
          <span className="material-symbols-outlined text-[18px] text-amber-700 shrink-0">
            info
          </span>
          <span>
            Once confirmed, this session is permanently locked into the central ledger. Subsequent
            amendments require an administrative correction voucher.
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => dispatch(closeSubmitModal())}
            className="px-4 py-2 rounded-lg bg-[#e8e8f6] text-[#292929] hover:bg-[#ffedc2] font-semibold text-xs sm:text-sm transition-colors"
          >
            Review More
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 rounded-lg bg-[#4543a8] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white font-semibold text-xs sm:text-sm shadow-md transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">verified</span>
            <span>Confirm &amp; Lock Record</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
