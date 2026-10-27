import React from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { setSelectedSubmissionId } from '../../store/slices/tasksSlice';

interface SubmissionQueueProps {
  statusFilter: string;
  searchFilter: string;
}

export const SubmissionQueue: React.FC<SubmissionQueueProps> = ({
  statusFilter,
  searchFilter,
}) => {
  const dispatch = useAppDispatch();
  const submissions = useAppSelector((state) => state.tasks.submissions);
  const selectedSubmissionId = useAppSelector((state) => state.tasks.selectedSubmissionId);

  const filteredSubmissions = submissions.filter((sub) => {
    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending' && !(sub.status === 'pending' || sub.status === 'late')) {
        return false;
      }
      if (statusFilter === 'graded' && sub.status !== 'graded') {
        return false;
      }
      if (statusFilter === 'overdue' && sub.status !== 'missing') {
        return false;
      }
    }

    // Search filter
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      return (
        sub.studentName.toLowerCase().includes(q) ||
        sub.studentRoll.toLowerCase().includes(q) ||
        sub.studentAdmissionId.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
      <div className="p-4 bg-[#eff4ff]/60 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-[#121c2a]">Roster Queue</span>
          <span className="px-2 py-0.5 rounded-full bg-[#dee9fc] text-[#464555] text-xs font-semibold">
            {filteredSubmissions.length} Shown
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-[#464555]">
          <span className="material-symbols-outlined text-[16px]">swap_vert</span>
          <span className="font-semibold">Sort: Roll #</span>
        </div>
      </div>

      <div className="p-2 space-y-1">
        {filteredSubmissions.length === 0 ? (
          <div className="py-10 text-center text-[#777587]">
            <span className="material-symbols-outlined text-3xl mb-1 text-slate-300">inbox</span>
            <p className="font-semibold text-xs text-[#121c2a]">No Submissions in Queue</p>
            <p className="text-[11px] text-[#777587] mt-0.5">There are no student submissions matching the filter criteria.</p>
          </div>
        ) : (
          filteredSubmissions.map((sub) => {
            const isSelected = sub.id === selectedSubmissionId;

          return (
            <div
              key={sub.id}
              onClick={() => dispatch(setSelectedSubmissionId(sub.id))}
              className={`p-3 rounded-xl transition-all cursor-pointer relative ${
                isSelected
                  ? 'bg-indigo-50/70 shadow-sm border border-indigo-200'
                  : 'bg-white hover:bg-[#eff4ff]/60 border border-transparent'
              }`}
            >
              {isSelected && (
                <div className="absolute left-0 top-3 bottom-3 w-1 bg-[#3525cd] rounded-r"></div>
              )}
              <div className="flex items-start justify-between gap-2 pl-2">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <img
                      src={sub.studentAvatar}
                      alt={sub.studentName}
                      className={`w-10 h-10 rounded-full object-cover shadow-xs ${
                        sub.status === 'missing' ? 'grayscale opacity-70' : ''
                      }`}
                    />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                        sub.status === 'graded'
                          ? 'bg-[#006c49]'
                          : sub.status === 'late'
                          ? 'bg-[#ffb95f]'
                          : sub.status === 'missing'
                          ? 'bg-[#ba1a1a]'
                          : 'bg-[#4f46e5]'
                      }`}
                    ></span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-xs sm:text-sm font-bold text-[#121c2a]">
                        {sub.studentName}
                      </h4>
                      <span className="text-[11px] font-mono text-[#777587]">
                        {sub.studentRoll}
                      </span>
                    </div>
                    <p
                      className={`text-[11px] ${
                        sub.status === 'missing' ? 'text-[#ba1a1a]' : 'text-[#777587]'
                      }`}
                    >
                      {sub.submittedAt ? `Submitted ${sub.submittedAt}` : 'No submission received'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  {sub.status === 'graded' ? (
                    <span className="px-2 py-0.5 rounded-full bg-[#d1fae5] text-[#065f46] text-[11px] font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">check_circle</span>
                      {sub.marksAwarded} / {sub.maxMarks}
                    </span>
                  ) : sub.status === 'late' ? (
                    <span className="px-2 py-0.5 rounded-full bg-[#ffddb8] text-[#92400e] text-[11px] font-bold flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[12px]">warning</span> Late
                    </span>
                  ) : sub.status === 'resubmit_requested' ? (
                    <span className="px-2 py-0.5 rounded-full bg-[#fee2e2] text-[#991b1b] text-[11px] font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">undo</span> Returned
                    </span>
                  ) : sub.status === 'missing' ? (
                    <span className="px-2 py-0.5 rounded-full bg-[#fee2e2] text-[#991b1b] text-[11px] font-bold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px]">schedule</span> Missing
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-[#dee9fc] text-[#3525cd] text-[11px] font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#3525cd] animate-pulse"></span>
                      Pending Review
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })
        )}
      </div>
    </div>
  );
};
