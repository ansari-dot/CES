import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { studentDatesheetsApi } from '../../services/datesheetsApi';
import { StudentDateSheet, StudentDateSheetEntry } from '../../types/datesheet';
import {
  CalendarDays,
  X,
  AlertTriangle,
  ArrowRight,
  Printer,
  BellRing
} from 'lucide-react';

export const ExamAnnouncementPopup: React.FC = () => {
  const navigate = useNavigate();
  const [announcement, setAnnouncement] = useState<StudentDateSheet | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    studentDatesheetsApi
      .getActiveDateSheets()
      .then((res) => {
        if (!mounted) return;
        if (res.popupAnnouncement) {
          const sheet = res.popupAnnouncement;
          const storageKey = `dismissed_exam_popup_${sheet.id}`;
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
      sessionStorage.setItem(`dismissed_exam_popup_${announcement.id}`, 'true');
    }
    setIsOpen(false);
  };

  const handleGoToDateSheet = () => {
    handleDismiss();
    navigate('/student/datesheet');
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

  const entries = announcement.entries || [];

  // Group by date to detect multiple examinations on a single day
  const dateGrouping = new Map<string, StudentDateSheetEntry[]>();
  entries.forEach((e) => {
    if (!dateGrouping.has(e.exam_date)) {
      dateGrouping.set(e.exam_date, []);
    }
    dateGrouping.get(e.exam_date)!.push(e);
  });
  const multipleExamsList = Array.from(dateGrouping.entries()).filter(([_, list]) => list.length > 1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Banner Alert Top */}
        <div className="px-6 py-4 bg-[#1b1a47] text-white flex items-center justify-between border-b border-indigo-900/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 shadow-xs">
              <BellRing className="w-5 h-5 animate-bounce" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase font-extrabold tracking-wider px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  {announcement.exam_type.replace('_', ' ')}
                </span>
                <span className="text-xs text-indigo-200">Official Announcement</span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white mt-0.5">
                Examination Date Sheet Announced
              </h2>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition"
            title="Close popup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Timetable Content Body (Matches User's Reference Screenshot) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5 text-slate-900 font-sans">
          
          {/* Title Header */}
          <div className="text-center space-y-1">
            <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">
              {announcement.title} – {announcement.class_name}
            </h1>
            <p className="text-xs text-slate-500 font-semibold">
              Please review all examination dates, subject codes, and arrival timings.
            </p>
          </div>

          {/* Timetable Grid Table */}
          <div className="border-2 border-slate-700 rounded-xs overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead className="bg-slate-200/90 text-slate-900 font-bold border-b-2 border-slate-700 text-center">
                <tr className="divide-x-2 divide-slate-700">
                  <th className="py-2.5 px-2 w-12">S.N.</th>
                  <th className="py-2.5 px-3 w-28">Date</th>
                  <th className="py-2.5 px-3 w-28">Day</th>
                  <th className="py-2.5 px-4 text-left">Subject Name</th>
                  <th className="py-2.5 px-3 w-28">Subject Code</th>
                  <th className="py-2.5 px-3 w-32">Subject Type</th>
                  <th className="py-2.5 px-3 w-24">Start Time</th>
                  <th className="py-2.5 px-3 w-24">End Time</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-700">
                {entries.map((e, index) => (
                  <tr
                    key={e.id || index}
                    className="divide-x-2 divide-slate-700 hover:bg-slate-50/70 transition font-medium"
                  >
                    <td className="py-2 px-2 text-center font-bold text-slate-700">{index + 1}</td>
                    <td className="py-2 px-3 text-center font-bold text-slate-900">
                      {formatDisplayDate(e.exam_date)}
                    </td>
                    <td className="py-2 px-3 text-center text-slate-700">{e.day_of_week}</td>
                    <td className="py-2 px-4 font-bold text-slate-900 uppercase">
                      {e.subject_name}
                    </td>
                    <td className="py-2 px-3 text-center font-mono font-semibold text-slate-800">
                      {e.subject_code || '—'}
                    </td>
                    <td className="py-2 px-3 text-center text-slate-700">
                      {e.subject_type || 'Scholastic'}
                    </td>
                    <td className="py-2 px-3 text-center font-mono font-bold text-slate-800">
                      {e.start_time}
                    </td>
                    <td className="py-2 px-3 text-center font-mono font-bold text-slate-800">
                      {e.end_time}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ATTENTION: Multiple Examinations on a Single Day Box */}
          {multipleExamsList.length > 0 && (
            <div className="space-y-1.5 pt-1 text-xs text-slate-900">
              <div className="font-extrabold uppercase tracking-wide text-slate-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>ATTENTION: Multiple Examinations on a Single Day</span>
              </div>
              <p className="font-medium text-slate-700">
                Please check the timings carefully for the following dates:
              </p>
              <ul className="space-y-1.5 pl-2">
                {multipleExamsList.map(([date, list]) => (
                  <li key={date} className="flex flex-col sm:flex-row sm:items-baseline gap-1">
                    <span className="font-bold text-slate-900">• Date: {formatDisplayDate(date)} ({list[0]?.day_of_week}):</span>
                    <span className="text-slate-800">
                      {list
                        .map(
                          (item) =>
                            `${item.subject_name} (${item.subject_code || ''}) from ${item.start_time} to ${item.end_time}`
                        )
                        .join(' • ')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Instructions Box */}
          {announcement.description && (
            <div className="p-3.5 bg-slate-50 border border-slate-300 rounded-xs text-xs space-y-1">
              <div className="font-bold uppercase tracking-wider text-slate-800">
                Examination Guidelines:
              </div>
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                {announcement.description}
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs text-slate-500">
            You can always access this schedule anytime from the <strong>Date Sheet</strong> page in your sidebar.
          </p>

          <div className="flex items-center gap-2.5 self-end sm:self-auto">
            <button
              onClick={handleDismiss}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition"
            >
              I Have Noted the Schedule
            </button>

            <button
              onClick={handleGoToDateSheet}
              className="px-5 py-2 bg-[#1b1a47] hover:bg-[#ffc53a] hover:text-[#1b1a47] text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 transition"
            >
              <span>View Full Date Sheet Page</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

