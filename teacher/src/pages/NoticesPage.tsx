import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { deleteNotice } from '../store/slices/noticesSlice';
import { addToast } from '../store/slices/uiSlice';
import { CreateNoticeModal } from '../components/notices/CreateNoticeModal';

export const NoticesPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const notices = useAppSelector((state) => state.notices.notices);

  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex flex-col w-full pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold text-[#3525cd] uppercase tracking-wider">
              Campus Communication
            </span>
            <span className="text-[#c7c4d8]">•</span>
            <span className="text-xs text-[#464555]">SRS Section 13</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#121c2a] tracking-tight">
            Academic Notices &amp; Bulletins
          </h1>
          <p className="text-xs sm:text-sm text-[#464555] mt-0.5">
            Broadcast institutional exam schedules, homework updates, and classroom notifications to
            assigned students and guardians.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 bg-[#4f46e5] hover:bg-[#3525cd] text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center gap-2 self-start md:self-auto"
        >
          <span className="material-symbols-outlined text-[18px]">add_alert</span>
          <span>Create Notice</span>
        </button>
      </div>

      {/* Notices Stream */}
      <div className="space-y-4">
        {notices.map((notice) => (
          <div
            key={notice.id}
            className={`p-6 rounded-2xl shadow-sm border transition-all ${
              notice.isUrgent
                ? 'bg-red-50/40 border-red-200'
                : 'bg-white border-slate-100 hover:shadow-md'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    notice.isUrgent
                      ? 'bg-[#fee2e2] text-[#991b1b]'
                      : 'bg-indigo-100 text-[#3525cd]'
                  }`}
                >
                  {notice.category}
                </span>
                <span className="text-xs text-[#777587]">Target: {notice.targetClassName}</span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-[#777587]">{notice.date}</span>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  onClick={() => {
                    dispatch(deleteNotice(notice.id));
                    dispatch(addToast({ message: 'Notice removed from broadcast stream.', type: 'info' }));
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                  title="Delete Notice"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-[#121c2a] mb-2 leading-snug">
              {notice.title}
            </h2>
            <p className="text-xs sm:text-sm text-[#464555] leading-relaxed">{notice.content}</p>

            <div className="mt-4 pt-3 border-t border-slate-100/80 flex items-center justify-between text-xs text-[#777587]">
              <span>Published by: {notice.author}</span>
              <span className="inline-flex items-center gap-1 text-[#006c49] font-semibold">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                Delivered to Student &amp; Parent Portals
              </span>
            </div>
          </div>
        ))}
      </div>

      <CreateNoticeModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};
