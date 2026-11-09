import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  closeSubmitModal,
  submitAttendanceThunk,
} from '../../store/slices/attendanceSlice';
import { addToast } from '../../store/slices/uiSlice';
import { Modal } from '../common/Modal';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  CalendarOff,
  BellRing,
  AlertTriangle,
  Lock,
  ArrowRight
} from 'lucide-react';

export const SubmitAttendanceModal: React.FC = () => {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector((state) => state.attendance.isSubmitModalOpen);
  const roster = useAppSelector((state) => state.attendance.roster);
  const teacher = useAppSelector((state) => state.auth.teacher);
  const currentLessonId = useAppSelector((state) => state.attendance.currentLessonId);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const presentCount = roster.filter((r) => r.status === 'present').length;
  const absentCount = roster.filter((r) => r.status === 'absent').length;
  const lateCount = roster.filter((r) => r.status === 'late').length;
  const excusedCount = roster.filter((r) => r.status === 'excused' || r.status === 'leave').length;
  const totalStudents = roster.length;
  const notifyCount = absentCount + lateCount + excusedCount;

  const handleConfirm = async () => {
    setIsSubmitting(true);
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
          message: `Attendance finalized and locked. ${notifyCount > 0 ? `Alerts queued for ${notifyCount} parents.` : ''}`,
          type: 'success',
        })
      );
    } catch (err: any) {
      dispatch(addToast({ message: err || 'Failed to finalize attendance', type: 'error' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => dispatch(closeSubmitModal())}
      title="Finalize Attendance Submission"
      subtitle="Sign off and lock attendance per Institutional Compliance SRS 6.2"
      icon={<Lock className="w-5 h-5 text-indigo-700" />}
      iconBgColor="bg-indigo-100 text-[#36348e]"
    >
      <div className="space-y-4 pt-1">
        <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
          You are officially signing off and locking attendance for{' '}
          <strong className="text-slate-900 font-bold">
            {teacher.assignedClasses?.[0]
              ? `${teacher.assignedClasses[0].name} • ${teacher.assignedClasses[0].subject}`
              : 'Current Active Session'}
          </strong>
          .
        </p>

        {/* Breakdown 4-Stat Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-emerald-700 mb-1">
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Present</span>
            </div>
            <span className="text-2xl font-black text-emerald-800">{presentCount}</span>
            <span className="block text-[10px] text-emerald-600 font-semibold mt-0.5">
              {totalStudents > 0 ? Math.round((presentCount / totalStudents) * 100) : 100}%
            </span>
          </div>

          <div className="bg-rose-50/80 border border-rose-200/80 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-rose-700 mb-1">
              <XCircle className="w-4 h-4 stroke-[2.5]" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Absent</span>
            </div>
            <span className="text-2xl font-black text-rose-800">{absentCount}</span>
            <span className="block text-[10px] text-rose-600 font-semibold mt-0.5">
              Parents Alerted
            </span>
          </div>

          <div className="bg-amber-50/80 border border-amber-200/80 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-amber-800 mb-1">
              <Clock className="w-4 h-4 stroke-[2.5]" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Late</span>
            </div>
            <span className="text-2xl font-black text-amber-900">{lateCount}</span>
            <span className="block text-[10px] text-amber-700 font-semibold mt-0.5">
              Tardy Logged
            </span>
          </div>

          <div className="bg-indigo-50/80 border border-indigo-200/80 rounded-xl p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-indigo-700 mb-1">
              <CalendarOff className="w-4 h-4 stroke-[2.5]" />
              <span className="text-[11px] font-bold uppercase tracking-wider">On Leave</span>
            </div>
            <span className="text-2xl font-black text-indigo-900">{excusedCount}</span>
            <span className="block text-[10px] text-indigo-600 font-semibold mt-0.5">
              Excused
            </span>
          </div>
        </div>

        {/* Parent Alerts Preview Card */}
        <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-[#36348e] flex items-center justify-center shrink-0 mt-0.5">
            <BellRing className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <span className="font-bold text-[#1e1b4b] block">Automatic Guardian Notification</span>
            <p className="text-slate-600 mt-0.5">
              {notifyCount > 0 ? (
                <>
                  Our institutional alert system will immediately notify parents of the{' '}
                  <strong className="text-indigo-900 font-bold">{notifyCount} student{notifyCount > 1 ? 's' : ''}</strong> marked Absent, Late, or On Leave.
                </>
              ) : (
                'All enrolled students are marked present. No absence alerts will be dispatched.'
              )}
            </p>
          </div>
        </div>

        {/* Compliance Warning */}
        <div className="p-3 rounded-xl bg-amber-50 text-amber-900 text-xs flex items-start gap-2.5 border border-amber-200/80">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <p className="text-amber-800 leading-relaxed">
            Once locked, this roster cannot be edited directly. Any subsequent revisions require an administrative correction voucher.
          </p>
        </div>

        {/* Teacher Signature Line */}
        <div className="px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
          <span>Verified By Signee:</span>
          <span className="font-bold text-slate-900">
            {teacher.name || 'Faculty Member'} {teacher.employeeId ? `(${teacher.employeeId})` : ''}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => dispatch(closeSubmitModal())}
            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            Review More
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-xl bg-[#36348e] hover:bg-[#2c2a75] text-white font-bold text-xs shadow-md shadow-indigo-100 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-[0.98]"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{isSubmitting ? 'Finalizing...' : 'Confirm & Lock Record'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
