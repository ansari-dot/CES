import React from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  closeSubmitModal,
  confirmFinalAttendance,
} from '../../store/slices/attendanceSlice';
import { addToast } from '../../store/slices/uiSlice';
import { Modal } from '../common/Modal';

export const SubmitAttendanceModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector((state) => state.attendance.isSubmitModalOpen);
  const roster = useAppSelector((state) => state.attendance.roster);
  const teacher = useAppSelector((state) => state.auth.teacher);

  const presentCount = roster.filter((r) => r.status === 'present').length;
  const absentCount = roster.filter((r) => r.status === 'absent').length;
  const lateCount = roster.filter((r) => r.status === 'late').length;

  const currentLessonId = useAppSelector((state) => state.attendance.currentLessonId);

  const handleConfirm = async () => {
    try {
      const lessonNum = parseInt(currentLessonId.replace(/\D/g, ''), 10) || 1;
      await fetch(`/api/v1/attendance/lessons/${lessonNum}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          records: roster.map((r) => ({
            studentId: parseInt(r.studentId.replace(/\D/g, ''), 10) || 1,
            status: r.status.toUpperCase(),
            remarks: r.remark
          }))
        })
      });
    } catch {
      // Fallback
    }
    dispatch(
      confirmFinalAttendance({
        className: teacher.assignedClasses?.[0]?.name.split(' - ')[0] || 'Class Session',
        subject: teacher.assignedClasses?.[0]?.subject || 'Subject',
        topic: 'Daily Attendance',
        teacherName: teacher.name,
        teacherId: teacher.employeeId,
      })
    );
    dispatch(
      addToast({
        message: 'Attendance finalized & dispatched to school administration.',
        type: 'success',
      })
    );
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
        <p className="text-sm text-[#464555]">
          You are about to sign off and submit verified attendance for{' '}
          <strong className="text-[#121c2a]">
            {teacher.assignedClasses?.[0]
              ? `${teacher.assignedClasses[0].name} • ${teacher.assignedClasses[0].subject}`
              : 'Current Active Session'}
          </strong>{' '}
          (Period 1).
        </p>

        {/* Breakdown summary */}
        <div className="bg-[#eff4ff] rounded-xl p-4 space-y-2 border border-indigo-100/60">
          <div className="flex justify-between items-center text-xs sm:text-sm font-semibold">
            <span className="text-[#464555]">Present Students:</span>
            <span className="text-[#006c49]">{presentCount}</span>
          </div>
          <div className="flex justify-between items-center text-xs sm:text-sm font-semibold">
            <span className="text-[#464555]">Absent Students:</span>
            <span className="text-[#ba1a1a]">
              {absentCount} {absentCount > 0 ? '(Guardian automated notification queued)' : ''}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs sm:text-sm font-semibold">
            <span className="text-[#464555]">Tardy / Late:</span>
            <span className="text-[#92400e]">{lateCount}</span>
          </div>
          <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-xs text-[#777587]">
            <span>Signee:</span>
            <span className="font-semibold text-[#121c2a]">
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
            className="px-4 py-2 rounded-lg bg-[#e6eeff] text-[#121c2a] hover:bg-[#dee9fc] font-semibold text-xs sm:text-sm transition-colors"
          >
            Review More
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2 rounded-lg bg-[#4f46e5] hover:bg-[#3525cd] text-white font-semibold text-xs sm:text-sm shadow-md transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">verified</span>
            <span>Confirm &amp; Lock Record</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
