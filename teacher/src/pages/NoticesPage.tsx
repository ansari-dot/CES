import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { archiveNoticeThunk } from '../store/slices/noticesSlice';
import { addToast } from '../store/slices/uiSlice';
import { CreateNoticeModal } from '../components/notices/CreateNoticeModal';

interface NoticeItem {
  id: string;
  title: string;
  content: string;
  category?: string;
  targetClassName?: string;
  date?: string;
  author?: string;
  isUrgent?: boolean;
  isPublished?: boolean;
  status?: string;
  recipients?: string;
  canManage?: boolean;
}

export const NoticesPage: React.FC = () => {
  const dispatch = useAppDispatch();
  const notices = useAppSelector((state) => state.notices.notices);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeNotice, setActiveNotice] = useState<NoticeItem | null>(null);

  const handleRemove = async (id: string) => {
    if (!window.confirm('Withdraw this notice from student and parent portals?')) return;
    const result = await dispatch(archiveNoticeThunk(id));
    if (archiveNoticeThunk.fulfilled.match(result)) {
      dispatch(addToast({ message: 'Notice removed from broadcast stream.', type: 'info' }));
    } else {
      dispatch(addToast({ message: String(result.payload || 'Failed to remove notice.'), type: 'error' }));
    }
  };

  return (
    <div className="flex flex-col w-full pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold text-[#36348e] uppercase tracking-wider">
              Campus Communication
            </span>
            <span className="text-[#c7c4d8]">•</span>
            <span className="text-xs text-[#545454]">SRS Section 13</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#292929] tracking-tight">
            Academic Notices &amp; Bulletins
          </h1>
          <p className="text-xs sm:text-sm text-[#545454] mt-0.5">
            Broadcast institutional exam schedules, homework updates, and classroom notifications to
            assigned students and guardians.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2.5 bg-[#4543a8] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all flex items-center gap-2 self-start md:self-auto"
        >
          <span className="material-symbols-outlined text-[18px]">add_alert</span>
          <span>Create Notice</span>
        </button>
      </div>

      {/* Notices Stream */}
      <div className="space-y-4">
        {notices.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100 shadow-sm text-[#777587]">
            <span className="material-symbols-outlined text-4xl mb-2 text-slate-300">campaign</span>
            <p className="font-semibold text-sm text-[#292929]">No Notices Published</p>
            <p className="text-xs text-[#777587] mt-1">There are no academic bulletins or announcements at this time.</p>
          </div>
        ) : (
          notices.map((notice) => (
            <div
              key={notice.id}
              className={`p-6 rounded-2xl shadow-sm border transition-all cursor-pointer ${
                notice.isUrgent
                  ? 'bg-red-50/40 border-red-200 hover:shadow-md'
                  : 'bg-white border-slate-100 hover:shadow-md'
              }`}
              onClick={() => setActiveNotice(notice as NoticeItem)}
            >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    notice.isUrgent
                      ? 'bg-[#fee2e2] text-[#991b1b]'
                      : 'bg-indigo-100 text-[#36348e]'
                  }`}
                >
                  {notice.category}
                </span>
                <span className="text-xs text-[#777587]">Target: {notice.targetClassName}</span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-[#777587]">{notice.date}</span>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                {notice.canManage && (
                  <button
                    onClick={() => handleRemove(notice.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                    title="Delete Notice"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                )}
              </div>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-[#292929] mb-2 leading-snug">
              {notice.title}
            </h2>
            <p className="text-xs sm:text-sm text-[#545454] leading-relaxed">{notice.content}</p>

            <div className="mt-4 pt-3 border-t border-slate-100/80 flex items-center justify-between text-xs text-[#777587]">
              <span>Published by: {notice.author}</span>
              {notice.isPublished ? (
                <span className="inline-flex items-center gap-1 text-[#006c49] font-semibold">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  Visible to {notice.recipients || 'recipients'} in their portals
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-semibold">
                  <span className="material-symbols-outlined text-[14px]">draft</span>
                  {notice.status || 'Not published'}
                </span>
              )}
            </div>
          </div>
        ))
        )}
      </div>

      <CreateNoticeModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      {/* Notice Detail Modal */}
      {activeNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setActiveNotice(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  activeNotice.isUrgent ? 'bg-red-100 text-red-800' : 'bg-indigo-100 text-[#36348e]'
                }`}>{activeNotice.category}</span>
                {activeNotice.targetClassName && <span className="text-xs text-slate-500">Target: {activeNotice.targetClassName}</span>}
              </div>
              <button onClick={() => setActiveNotice(null)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors shrink-0">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
            <h2 className="text-lg font-bold text-[#292929] leading-snug">{activeNotice.title}</h2>
            <p className="text-sm text-[#545454] leading-relaxed whitespace-pre-wrap">{activeNotice.content}</p>
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>By {activeNotice.author} · {activeNotice.date}</span>
              {activeNotice.isPublished && (
                <span className="text-[#006c49] font-semibold">Visible to {activeNotice.recipients || 'recipients'}</span>
              )}
            </div>
            <div className="flex justify-end">
              <button onClick={() => setActiveNotice(null)} className="px-4 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
