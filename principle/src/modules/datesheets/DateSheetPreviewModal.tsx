import React, { useState } from 'react';
import { ExaminationDateSheet, DateSheetEntry } from '../../types/datesheet';
import { X, Printer, Calendar, Clock, AlertTriangle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  dateSheet: ExaminationDateSheet;
}

export const DateSheetPreviewModal: React.FC<Props> = ({ isOpen, onClose, dateSheet }) => {
  const entries = dateSheet.entries || [];

  // Group entries by class_id
  const classMap = new Map<number, { classId: number; className: string; entries: DateSheetEntry[] }>();
  entries.forEach((e) => {
    if (!classMap.has(e.class_id)) {
      classMap.set(e.class_id, {
        classId: e.class_id,
        className: e.class_name || `Class ${e.class_id}`,
        entries: []
      });
    }
    classMap.get(e.class_id)!.entries.push(e);
  });

  const classGroups = Array.from(classMap.values());
  const [selectedClassId, setSelectedClassId] = useState<number>(
    classGroups[0]?.classId || 1
  );

  if (!isOpen) return null;

  const currentClassGroup = classGroups.find((g) => g.classId === selectedClassId) || classGroups[0];
  const classEntries = currentClassGroup ? currentClassGroup.entries : [];

  // Helper: Format date to DD-MM-YYYY
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

  // Group by date to detect multiple examinations on a single day for the active class
  const dateGrouping = new Map<string, DateSheetEntry[]>();
  classEntries.forEach((e) => {
    if (!dateGrouping.has(e.exam_date)) {
      dateGrouping.set(e.exam_date, []);
    }
    dateGrouping.get(e.exam_date)!.push(e);
  });

  const multipleExamsList = Array.from(dateGrouping.entries()).filter(([_, list]) => list.length > 1);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-none print:max-h-none print:rounded-none">
        
        {/* Header Bar (Hidden when printing) */}
        <div className="px-6 py-4 bg-[#1b1a47] text-white flex items-center justify-between border-b border-indigo-900/30 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center">
              <Calendar className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                Date Sheet Timetable Preview
              </h2>
              <p className="text-xs text-indigo-200">
                Official Examination Timetable &amp; Schedule
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold rounded-lg text-xs shadow-xs flex items-center gap-1.5 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Timetable</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Class Selection Tabs (if multiple classes) */}
        {classGroups.length > 1 && (
          <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto print:hidden">
            <span className="text-xs font-semibold text-slate-500 mr-1 shrink-0">View Class:</span>
            {classGroups.map((cg) => (
              <button
                key={cg.classId}
                onClick={() => setSelectedClassId(cg.classId)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition shrink-0 ${
                  selectedClassId === cg.classId
                    ? 'bg-[#1b1a47] text-white shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {cg.className} ({cg.entries.length} papers)
              </button>
            ))}
          </div>
        )}

        {/* Printable Timetable Area (Matches Reference Design Screenshot) */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-slate-900 font-sans print:p-4">
          
          {/* Main Title */}
          <div className="text-center space-y-1">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {dateSheet.title} – {currentClassGroup?.className || 'Class'}
            </h1>
            {dateSheet.session_name && (
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Academic Session: {dateSheet.session_name}
              </p>
            )}
          </div>

          {/* Timetable Table */}
          <div className="border-2 border-slate-700 rounded-xs overflow-hidden">
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
                  <th className="py-2.5 px-3 w-32">Invigilator</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-slate-700">
                {classEntries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-slate-400">
                      No examination entries scheduled for this class.
                    </td>
                  </tr>
                ) : (
                  classEntries.map((e, index) => (
                    <tr
                      key={e.id || index}
                      className="divide-x-2 divide-slate-700 hover:bg-slate-50/50 transition font-medium"
                    >
                      <td className="py-2 px-2 text-center font-bold text-slate-700">{index + 1}</td>
                      <td className="py-2 px-3 text-center font-bold text-slate-900">
                        <div>{formatDisplayDate(e.exam_date)}</div>
                        {e.is_date_changed && (
                          <div className="text-[9px] font-bold text-rose-600 bg-rose-50 px-1 py-0.5 rounded-sm mt-0.5 inline-block">
                            Date Rescheduled
                          </div>
                        )}
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
                      <td className="py-2 px-3 text-center text-slate-700">
                        {e.teacher_name || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ATTENTION: Multiple Examinations on a Single Day Box */}
          {multipleExamsList.length > 0 && (
            <div className="space-y-2 pt-2 text-xs text-slate-900">
              <div className="font-extrabold uppercase tracking-wide text-slate-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 print:hidden" />
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

          {/* Examination Instructions / Notes */}
          {dateSheet.description && (
            <div className="p-4 bg-slate-50 border border-slate-300 rounded-xs text-xs space-y-1">
              <div className="font-bold uppercase tracking-wider text-slate-800">
                General Examination Guidelines &amp; Instructions:
              </div>
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                {dateSheet.description}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

