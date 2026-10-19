import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import {
  closeCorrectionDrawer,
  submitCorrectionVoucher,
} from '../../store/slices/attendanceSlice';
import { addToast } from '../../store/slices/uiSlice';

export const CorrectionDrawer: React.FC = () => {
  const dispatch = useAppDispatch();
  const isOpen = useAppSelector((state) => state.attendance.isCorrectionDrawerOpen);
  const targetLogId = useAppSelector((state) => state.attendance.selectedCorrectionLogId);

  const [studentChoice, setStudentChoice] = useState('#03 Caleb Davis (ADM-5024)');
  const [correctionType, setCorrectionType] = useState('Absent to Excused');
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;

    try {
      const lessonNum = parseInt((targetLogId || '').replace(/\D/g, ''), 10) || 1;
      const proposed = correctionType.includes('Excused') ? 'EXCUSED' : correctionType.includes('Present') ? 'PRESENT' : 'LATE';
      await fetch('/api/v1/attendance/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          lessonId: lessonNum,
          studentId: 1,
          proposedStatus: proposed,
          reason
        })
      });
    } catch {
      // Fallback
    }

    dispatch(
      submitCorrectionVoucher({
        targetLogId: targetLogId || 'SUB-20241022-5A',
        studentId: 'STU-03',
        studentName: studentChoice,
        correctionType,
        reason,
      })
    );
    dispatch(
      addToast({
        message: 'Correction voucher submitted to Academic Operations for approval.',
        type: 'success',
      })
    );
    setReason('');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white h-full shadow-2xl p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#684000] text-[22px]">
                history_toggle_off
              </span>
              <div>
                <h3 className="text-base font-bold text-[#121c2a]">Correction Voucher</h3>
                <span className="text-[11px] text-[#777587]">SRS 6.5 Audit Protocol</span>
              </div>
            </div>
            <button
              onClick={() => dispatch(closeCorrectionDrawer())}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Form */}
          <form id="correctionForm" onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#464555] mb-1">
                Target Submission Log
              </label>
              <input
                type="text"
                readOnly
                value={targetLogId || 'SUB-20241022-5A (Oct 22, 2024)'}
                className="w-full bg-[#eff4ff] rounded-lg px-3 py-2 text-[#121c2a] font-mono text-xs focus:outline-none border border-indigo-100/60"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#464555] mb-1">
                Affected Student
              </label>
              <select
                value={studentChoice}
                onChange={(e) => setStudentChoice(e.target.value)}
                className="w-full bg-[#eff4ff] rounded-lg px-3 py-2 text-[#121c2a] font-medium focus:outline-none border border-indigo-100/60"
              >
                <option value="#03 Caleb Davis (ADM-5024)">#03 Caleb Davis (ADM-5024)</option>
                <option value="#04 Daniel Evans (ADM-5031)">#04 Daniel Evans (ADM-5031)</option>
                <option value="#01 Aiden Cooper (ADM-5012)">#01 Aiden Cooper (ADM-5012)</option>
                <option value="#02 Bella Chen (ADM-5019)">#02 Bella Chen (ADM-5019)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#464555] mb-1">
                Correction Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label
                  className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer border transition-colors ${
                    correctionType === 'Absent to Excused'
                      ? 'border-[#3525cd] bg-indigo-50/60 text-[#3525cd]'
                      : 'border-slate-200 bg-[#eff4ff] text-[#464555]'
                  }`}
                >
                  <input
                    type="radio"
                    name="corr-type"
                    checked={correctionType === 'Absent to Excused'}
                    onChange={() => setCorrectionType('Absent to Excused')}
                    className="accent-[#3525cd]"
                  />
                  <span className="font-semibold text-xs">Absent to Excused</span>
                </label>
                <label
                  className={`flex items-center gap-2 p-2.5 rounded-lg cursor-pointer border transition-colors ${
                    correctionType === 'Late to Present'
                      ? 'border-[#3525cd] bg-indigo-50/60 text-[#3525cd]'
                      : 'border-slate-200 bg-[#eff4ff] text-[#464555]'
                  }`}
                >
                  <input
                    type="radio"
                    name="corr-type"
                    checked={correctionType === 'Late to Present'}
                    onChange={() => setCorrectionType('Late to Present')}
                    className="accent-[#3525cd]"
                  />
                  <span className="font-semibold text-xs">Late to Present</span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#464555] mb-1">
                Administrative Justification
              </label>
              <textarea
                required
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Provide medical note reference, bus dispatch delay ID, or counselor confirmation memo..."
                className="w-full bg-[#eff4ff] rounded-lg p-3 text-[#121c2a] text-xs placeholder:text-[#777587] focus:outline-none focus:ring-2 focus:ring-indigo-300 border border-indigo-100/60"
              ></textarea>
            </div>

            <div className="p-3 rounded-lg bg-[#eff4ff] text-xs text-[#464555] flex items-start gap-2">
              <span className="material-symbols-outlined text-[16px] text-[#684000] shrink-0 mt-0.5">
                info
              </span>
              <span>
                All correction requests appear in official audit registers with your teacher ID:
                TCH-2024-042. SLA for Academic Operations review is ~45 minutes.
              </span>
            </div>
          </form>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
          <button
            type="button"
            onClick={() => dispatch(closeCorrectionDrawer())}
            className="flex-1 py-2 rounded-lg bg-[#e6eeff] text-[#121c2a] font-semibold text-xs sm:text-sm hover:bg-[#dee9fc] transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="correctionForm"
            className="flex-1 py-2 rounded-lg bg-[#3525cd] text-white font-semibold text-xs sm:text-sm hover:bg-[#4f46e5] shadow-md transition-all"
          >
            Send Request
          </button>
        </div>
      </div>
    </div>
  );
};
