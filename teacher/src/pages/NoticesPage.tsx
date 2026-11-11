import React, { useState, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { archiveNoticeThunk } from '../store/slices/noticesSlice';
import { addToast } from '../store/slices/uiSlice';
import { CreateNoticeModal } from '../components/notices/CreateNoticeModal';
import {
  Bell,
  Plus,
  Megaphone,
  Trash2,
  CheckCircle2,
  FileText,
  X,
  AlertTriangle,
  Users,
  Search,
  Filter,
  Layers,
  Calendar,
  Sparkles
} from 'lucide-react';

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const handleRemove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Withdraw this notice from student and parent portals?')) return;
    const result = await dispatch(archiveNoticeThunk(id));
    if (archiveNoticeThunk.fulfilled.match(result)) {
      dispatch(addToast({ message: 'Notice removed from broadcast stream.', type: 'info' }));
    } else {
      dispatch(addToast({ message: String(result.payload || 'Failed to remove notice.'), type: 'error' }));
    }
  };

  // Metrics
  const totalNotices = notices.length;
  const urgentCount = notices.filter((n) => n.isUrgent).length;
  const publishedCount = notices.filter((n) => n.isPublished !== false).length;
  const targetClassesCount = new Set(notices.map((n) => n.targetClassName).filter(Boolean)).size;

  // Filtered
  const filteredNotices = useMemo(() => {
    return notices.filter((n) => {
      if (selectedCategory !== 'all' && n.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return (
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          (n.targetClassName && n.targetClassName.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [notices, selectedCategory, searchQuery]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    notices.forEach((n) => {
      if (n.category) set.add(n.category);
    });
    return Array.from(set);
  }, [notices]);

  return (
    <div className="flex flex-col w-full pb-12 space-y-5 animate-in fade-in duration-150">
      {/* ------------------------------------------------------------- */}
      {/* 1. HERO HEADER BANNER */}
      {/* ------------------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#36348e] text-white flex items-center justify-center shadow-md shadow-indigo-100 shrink-0">
              <Megaphone className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  Campus Communication
                </span>
                <span className="text-[11px] font-extrabold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  Broadcast Hub
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#1e1b4b] tracking-tight mt-1">
                Academic Notices &amp; Bulletins
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Broadcast institutional exam schedules, homework updates, and classroom notifications to assigned students and guardians.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-4.5 py-2.5 rounded-xl bg-[#36348e] hover:bg-[#2c2a75] text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md shadow-indigo-100 self-start md:self-auto cursor-pointer active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Create Notice</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. TOP 4 WAVE KPI CARDS */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Notices */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-blue-100/80 hover:border-blue-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Bell className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-blue-50 text-blue-700 border-blue-100">
              <span>All Broadcasts</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight">
              {totalNotices}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Total Bulletins Issued
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(59, 130, 246, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Active Published */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-emerald-100/80 hover:border-emerald-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-emerald-50 text-emerald-700 border-emerald-100">
              <span>Active Feeds</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-emerald-700 tracking-tight leading-tight">
              {publishedCount}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Live in Student &amp; Parent Portals
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(16, 185, 129, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#10b981" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Urgent Alerts */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-rose-100/80 hover:border-rose-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white shadow-sm shadow-rose-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <AlertTriangle className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border ${urgentCount > 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-500 border-slate-200'}`}>
              <span>{urgentCount > 0 ? 'High Priority' : 'Normal Stream'}</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-rose-700 tracking-tight leading-tight">
              {urgentCount}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Urgent Priority Notices
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(244, 63, 94, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#f43f5e" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Target Classes */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-amber-100/80 hover:border-amber-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Users className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-amber-50 text-amber-800 border-amber-200">
              <span>Audience Reach</span>
            </div>
          </div>
          <div className="mt-3 relative z-10 min-w-0">
            <div className="text-2xl sm:text-3xl font-black text-amber-800 tracking-tight leading-tight">
              {targetClassesCount || 1}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5 truncate">
              Target Class Cohorts
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60 group-hover:opacity-85 transition-opacity">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(245, 158, 11, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. FILTER & SEARCH TOOLBAR */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer whitespace-nowrap ${
              selectedCategory === 'all'
                ? 'bg-[#36348e] text-white shadow-2xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            All Categories ({totalNotices})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-[#36348e] text-white shadow-2xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search bulletins..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300 transition-all placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 4. NOTICES STREAM LIST */}
      {/* ------------------------------------------------------------- */}
      <div className="space-y-3.5">
        {filteredNotices.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-xs text-slate-400">
            <Megaphone className="w-9 h-9 mx-auto mb-2 text-slate-300" />
            <p className="font-bold text-xs text-slate-700">No Notices Published</p>
            <p className="text-[11px] text-slate-400 mt-0.5">There are no academic bulletins or announcements matching your filter.</p>
          </div>
        ) : (
          filteredNotices.map((notice) => (
            <div
              key={notice.id}
              onClick={() => setActiveNotice(notice as NoticeItem)}
              className={`p-5 rounded-2xl shadow-xs border transition-all cursor-pointer ${
                notice.isUrgent
                  ? 'bg-rose-50/40 border-rose-200 hover:shadow-md hover:border-rose-300'
                  : 'bg-white border-slate-200/80 hover:shadow-md hover:border-slate-300'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                      notice.isUrgent
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    }`}
                  >
                    {notice.category || 'General'}
                  </span>
                  {notice.targetClassName && (
                    <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                      Target: {notice.targetClassName}
                    </span>
                  )}
                  <span className="text-slate-300">•</span>
                  <span className="text-xs text-slate-400 font-mono">{notice.date}</span>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  {notice.canManage && (
                    <button
                      type="button"
                      onClick={(e) => handleRemove(notice.id, e)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Withdraw Notice"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-1.5 leading-snug">
                {notice.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed line-clamp-2">
                {notice.content}
              </p>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Published by: <strong className="text-slate-800">{notice.author || 'Administration'}</strong></span>
                {notice.isPublished ? (
                  <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Visible to {notice.recipients || 'all recipients'}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-slate-400">
                    <FileText className="w-3.5 h-3.5" />
                    <span>{notice.status || 'Draft'}</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs" onClick={() => setActiveNotice(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 border border-slate-200 animate-in fade-in zoom-in-95 duration-150" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                  activeNotice.isUrgent ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                }`}>
                  {activeNotice.category}
                </span>
                {activeNotice.targetClassName && (
                  <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                    Target: {activeNotice.targetClassName}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveNotice(null)}
                className="w-8 h-8 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h2 className="text-lg font-bold text-slate-900 leading-snug">{activeNotice.title}</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{activeNotice.content}</p>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>By {activeNotice.author} · {activeNotice.date}</span>
              {activeNotice.isPublished && (
                <span className="text-emerald-700 font-semibold">Visible to {activeNotice.recipients || 'recipients'}</span>
              )}
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setActiveNotice(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
