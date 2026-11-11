import React from 'react';
import {
  Umbrella,
  Calendar,
  X,
  AlertTriangle,
  Sun,
  BookOpen,
  Building2,
  ChevronRight,
  ShieldCheck,
  Megaphone
} from 'lucide-react';
import { ActiveHolidayAnnouncement } from '../../services/calendarApi';

interface HolidayAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  announcement: ActiveHolidayAnnouncement | null;
}

export const HolidayAnnouncementModal: React.FC<HolidayAnnouncementModalProps> = ({
  isOpen,
  onClose,
  announcement
}) => {
  if (!isOpen || !announcement) return null;

  const getHolidayMeta = (type: string) => {
    switch (type) {
      case 'VACATION':
        return { label: 'Vacation Break', color: 'bg-emerald-50 text-emerald-800 border-emerald-200', icon: Sun };
      case 'PUBLIC_HOLIDAY':
        return { label: 'Public Holiday', color: 'bg-rose-50 text-rose-800 border-rose-200', icon: Umbrella };
      case 'INSTITUTIONAL_BREAK':
        return { label: 'School Break', color: 'bg-amber-50 text-amber-900 border-amber-200', icon: Building2 };
      case 'EXAM_PREP':
        return { label: 'Exam Prep Break', color: 'bg-purple-50 text-purple-800 border-purple-200', icon: BookOpen };
      default:
        return { label: 'Official Holiday', color: 'bg-indigo-50 text-indigo-800 border-indigo-200', icon: Calendar };
    }
  };

  const meta = getHolidayMeta(announcement.holidayType);
  const isSingleDay = announcement.startDate === announcement.endDate;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="relative px-6 py-5 bg-[#191847] text-white overflow-hidden">
          <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-white/5 rounded-full pointer-events-none" />
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 text-amber-300 flex items-center justify-center border border-white/10 shrink-0">
                <Megaphone className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-200 bg-white/10 px-2 py-0.5 rounded">
                  Principal Executive View
                </span>
                <h3 className="text-base font-black text-white tracking-tight mt-0.5">
                  Holiday Break Notice
                </h3>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Main Title & Type Pill */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-black text-[#191847]">{announcement.title}</h2>
              <p className="text-xs text-slate-500 font-medium">Issued by {announcement.createdByName}</p>
            </div>
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-lg border self-start ${meta.color}`}
            >
              <meta.icon className="w-3.5 h-3.5" />
              {meta.label}
            </span>
          </div>

          {/* Date Duration Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-[#36348e] flex items-center justify-center border border-indigo-100 shrink-0">
                <Calendar className="w-4 h-4 stroke-[2.2]" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Break Duration</div>
                <div className="text-xs font-black text-slate-900 flex items-center gap-1.5 mt-0.5">
                  {isSingleDay ? (
                    <span>{announcement.startDate}</span>
                  ) : (
                    <>
                      <span>{announcement.startDate}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                      <span>{announcement.endDate}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            <span className="text-xs font-extrabold text-[#36348e] bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
              {announcement.totalDays} {announcement.totalDays === 1 ? 'Day Off' : 'Days Off'}
            </span>
          </div>

          {/* Policy Notice: Classes Suspended */}
          <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-3.5 flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0 mt-0.5" />
            <div className="text-[11px] text-rose-900 font-medium leading-relaxed">
              <span className="font-black text-rose-950">School-Wide Enforcement Active:</span> All timetable classes, teacher duties, and Zoom live sessions are suppressed and marked cancelled across the LMS.
            </div>
          </div>

          {/* Circular Notes / Description */}
          {announcement.description && (
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200/80">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1">
                Circular Notes
              </div>
              <p className="text-xs text-slate-700 leading-relaxed font-normal">
                {announcement.description}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end">
            <button
              onClick={onClose}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-[#36348e] hover:bg-[#28266e] text-white text-xs font-extrabold rounded-xl shadow-xs transition-colors"
            >
              <ShieldCheck className="w-4 h-4" />
              Acknowledge Notice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

