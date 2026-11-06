import React, { useState, useEffect } from 'react';
import { useAppDispatch } from '../../store';
import { setCurrentTab } from '../../store/slices/uiSlice';
import { teacherDatesheetsApi } from '../../services/datesheetsApi';
import { TeacherDateSheet, TeacherDateSheetEntry } from '../../types/datesheet';
import {
  CalendarDays,
  X,
  AlertTriangle,
  ArrowRight,
  Printer,
  BellRing
} from 'lucide-react';

export const TeacherExamAnnouncementPopup: React.FC = () => {
  const dispatch = useAppDispatch();
  const [announcement, setAnnouncement] = useState<TeacherDateSheet | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    teacherDatesheetsApi
      .getActiveDateSheets()
      .then((res) => {
        if (!mounted) return;
        if (res?.popupAnnouncement && res.popupAnnouncement.entries?.length > 0) {
          const sheet = res.popupAnnouncement;
          const storageKey = `dismissed_teacher_exam_popup_${sheet.id}`;
          const isDismissed = sessionStorage.getItem(storageKey);
          if (!isDismissed) {
            setAnnouncement(sheet);
            setIsOpen(true);
          }
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  const handleDismiss = () => {
    if (announcement) {
      sessionStorage.setItem(`dismissed_teacher_exam_popup_${announcement.id}`, 'true');
    }
    setIsOpen(false);
  };

  const handleGoToDateSheet = () => {
    handleDismiss();
    dispatch(setCurrentTab('datesheet'));
  };

  if (!isOpen || !announcement) return null;

  // Format date to DD-MM-YYYY
  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const categoryBadge = {
    MONTHLY_TEST: { label: 'Monthly Test', bg: 'bg-blue-100 text-blue-800 border-blue-200' },
    MID_TERM: { label: 'Mid-Term Examination', bg: 'bg-purple-100 text-purple-800 border-purple-200' },
    FINAL_TERM: { label: 'Final-Term Examination', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
  }[announcement.exam_type] || { label: announcement.exam_type, bg: 'bg-slate-100 text-slate-800 border-slate-200' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1b1a47] to-[#2a2868] text-white p-5 flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
              <BellRing className="w-5 h-5 text-amber-300 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${categoryBadge.bg}`}>
                  {categoryBadge.label}
                </span>
                <span className="text-xs text-white/75">Official Faculty Schedule</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold font-headings text-white mt-1">
                Examination Announcement: {announcement.title}
              </h2>
              <p className="text-xs text-white/80 mt-0.5">
                Timetable for your assigned teaching subjects and classes
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Dismiss Announcement"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {announcement.description && (
            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200/80">
              {announcement.description}
            </div>
          )}

          {/* Reference Design Table */}
          <div className="border border-slate-300 rounded-lg overflow-hidden shadow-xs">
            <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-300 flex items-center justify-between">
              <span className="font-semibold text-xs text-slate-800 uppercase tracking-wide">
                Assigned Examination Timetable
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {announcement.entries?.length || 0} Scheduled Paper{(announcement.entries?.length || 0) === 1 ? '' : 's'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-300 font-bold text-slate-700">
                    <th className="py-2.5 px-3 border-r border-slate-300 w-12 text-center">S.N.</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Class</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Date</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Day</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Subject Name</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Subject Code</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Subject Type</th>
                    <th className="py-2.5 px-3 border-r border-slate-300">Start Time</th>
                    <th className="py-2.5 px-3">End Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {announcement.entries && announcement.entries.length > 0 ? (
                    announcement.entries.map((entry: TeacherDateSheetEntry, idx: number) => (
                      <tr key={entry.id || idx} className="hover:bg-slate-50/80">
                        <td className="py-2 px-3 border-r border-slate-200 text-center font-medium text-slate-600">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 font-semibold text-slate-900">
                          {entry.class_name}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 font-medium text-slate-800 whitespace-nowrap">
                          {formatDisplayDate(entry.exam_date)}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-slate-700">
                          {entry.day_of_week}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 font-semibold text-slate-900">
                          {entry.subject_name}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-slate-600 font-mono">
                          {entry.subject_code || '—'}
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-slate-700">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                            {entry.subject_type || 'Scholastic'}
                          </span>
                        </td>
                        <td className="py-2 px-3 border-r border-slate-200 text-slate-800 font-medium whitespace-nowrap">
                          {entry.start_time || '—'}
                        </td>
                        <td className="py-2 px-3 text-slate-800 font-medium whitespace-nowrap">
                          {entry.end_time || '—'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-6 text-center text-slate-500">
                        No assigned examination papers found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Attention Box */}
          {announcement.multipleExamsAttention && announcement.multipleExamsAttention.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3.5 text-xs text-amber-900">
              <div className="font-bold flex items-center gap-1.5 uppercase text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                ATTENTION: Multiple Examinations on a Single Day
              </div>
              <p className="mt-1 text-amber-800">
                Please check the timings carefully for the following dates:
              </p>
              <ul className="mt-2 space-y-1 list-disc list-inside">
                {announcement.multipleExamsAttention.map((item, idx) => (
                  <li key={idx} className="leading-relaxed">
                    <span className="font-semibold text-amber-950">
                      Date: {formatDisplayDate(item.examDate)} ({item.dayOfWeek}) {item.className ? `— ${item.className}` : ''}
                    </span>
                    <span className="ml-1 text-amber-900">
                      {item.exams
                        .map(
                          (ex) =>
                            `${ex.subjectName}${ex.subjectCode ? ` (${ex.subjectCode})` : ''} from ${ex.startTime} to ${ex.endTime}`
                        )
                        .join(' • ')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Instructions note */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800">Faculty Guidelines &amp; Invigilation:</p>
            <p>1. Please report to the examination hall or virtual session 15 minutes prior to scheduled start time.</p>
            <p>2. Verify question paper readiness and attendance sheets before commencing examinations.</p>
            <p>3. Submit completed answer scripts or digital grading entries within 48 hours of test completion.</p>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            Print Schedule
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDismiss}
              className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors"
            >
              I Understand / Dismiss
            </button>
            <button
              onClick={handleGoToDateSheet}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors shadow-xs"
            >
              <span>View Full Date Sheet</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

