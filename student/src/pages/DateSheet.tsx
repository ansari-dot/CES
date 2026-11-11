import React, { useState, useEffect } from 'react';
import { studentDatesheetsApi } from '../services/datesheetsApi';
import { StudentDateSheet, StudentDateSheetEntry, ExamType } from '../types/datesheet';
import {
  CalendarDays,
  Printer,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  RotateCw,
  CheckCircle2,
  Calendar
} from 'lucide-react';

export default function DateSheet() {
  const [dateSheets, setDateSheets] = useState<StudentDateSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  useEffect(() => {
    loadDateSheets();
  }, []);

  const loadDateSheets = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await studentDatesheetsApi.getActiveDateSheets();
      setDateSheets(res.activeDateSheets || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to load your examination date sheet.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

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

  // Determine status (Upcoming, Today, Completed, Changed)
  const getExamStatus = (entry: StudentDateSheetEntry) => {
    if (entry.is_date_changed) return { label: 'Date Changed', cls: 'bg-rose-100 text-rose-800 border-rose-300' };
    const todayStr = new Date().toISOString().split('T')[0];
    if (entry.exam_date === todayStr) return { label: 'Today', cls: 'bg-amber-100 text-amber-800 border-amber-300' };
    if (entry.exam_date > todayStr) return { label: 'Upcoming', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    return { label: 'Completed', cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  };

  const filteredSheets = dateSheets.filter((ds) => {
    if (selectedCategory !== 'ALL' && ds.exam_type !== selectedCategory) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-headings text-foreground flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-primary" />
            Official Examination Date Sheet &amp; Timetable
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Published schedules for your enrolled class, including subjects, codes, and timings.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={loadDateSheets}
            className="p-2 border border-border text-muted-foreground hover:text-foreground hover:bg-card rounded-md transition shadow-xs"
            title="Refresh date sheets"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {filteredSheets.length > 0 && (
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
            >
              <Printer className="w-4 h-4" />
              <span>Print Timetable</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto print:hidden">
        {[
          { id: 'ALL', label: 'All Schedules' },
          { id: 'MID_TERM', label: 'Mid-Term Examinations' },
          { id: 'FINAL_TERM', label: 'Final-Term Examinations' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedCategory(tab.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition shrink-0 ${
              selectedCategory === tab.id
                ? 'bg-primary text-primary-foreground shadow-2xs'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-xs">
          {errorMsg}
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="py-16 text-center text-muted-foreground text-xs flex flex-col items-center justify-center gap-2">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span>Loading official timetable...</span>
        </div>
      ) : filteredSheets.length === 0 ? (
        <div className="bg-card border border-border rounded-md p-12 text-center text-muted-foreground space-y-2">
          <CalendarDays className="w-10 h-10 text-muted mx-auto stroke-1" />
          <div className="font-bold text-foreground">No examination date sheets published yet</div>
          <p className="text-xs">
            When the school announces upcoming Mid-Term or Final / Terminal examination schedules for your class, they will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {filteredSheets.map((ds) => {
            const entries = ds.entries || [];

            // Detect multiple examinations on single day
            const dateGrouping = new Map<string, StudentDateSheetEntry[]>();
            entries.forEach((e) => {
              if (!dateGrouping.has(e.exam_date)) {
                dateGrouping.set(e.exam_date, []);
              }
              dateGrouping.get(e.exam_date)!.push(e);
            });
            const multipleExamsList = Array.from(dateGrouping.entries()).filter(([_, list]) => list.length > 1);

            return (
              <div
                key={ds.id}
                className="bg-card border border-border rounded-xl p-5 sm:p-7 shadow-xs space-y-5 print:border-none print:shadow-none print:p-0"
              >
                {/* Title */}
                <div className="text-center space-y-1 border-b border-border pb-4">
                  <div className="inline-block text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-primary/10 text-primary mb-1 print:hidden">
                    {ds.exam_type.replace('_', ' ')}
                  </div>
                  <h2 className="text-lg sm:text-2xl font-black font-headings text-foreground tracking-tight">
                    {ds.title} – {ds.class_name}
                  </h2>
                  {ds.session_name && (
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                      Academic Session: {ds.session_name}
                    </p>
                  )}
                </div>

                {/* Timetable Table (Exact User Reference Design) */}
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
                        <th className="py-2.5 px-3 w-24 print:hidden">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-slate-700">
                      {entries.map((e, index) => {
                        const statusObj = getExamStatus(e);

                        return (
                          <tr
                            key={e.id || index}
                            className="divide-x-2 divide-slate-700 hover:bg-muted/30 transition font-medium"
                          >
                            <td className="py-2 px-2 text-center font-bold text-slate-700">{index + 1}</td>
                            <td className="py-2 px-3 text-center font-bold text-slate-900">
                              {formatDisplayDate(e.exam_date)}
                            </td>
                            <td className="py-2 px-3 text-center text-slate-700">{e.day_of_week}</td>
                            <td className="py-2 px-4 font-bold text-slate-900 uppercase">
                              {e.subject_name}
                              {e.instructions && (
                                <span className="block text-[11px] font-normal text-muted-foreground normal-case italic">
                                  Note: {e.instructions}
                                </span>
                              )}
                              {e.is_date_changed && e.previous_exam_date && (
                                <span className="block text-[10px] text-rose-600 font-semibold normal-case mt-0.5">
                                  ⚠️ Rescheduled (Previous: {formatDisplayDate(e.previous_exam_date)} {e.previous_start_time || ''})
                                </span>
                              )}
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
                            <td className="py-2 px-3 text-center print:hidden">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusObj.cls}`}
                              >
                                {statusObj.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ATTENTION: Multiple Examinations on a Single Day Box */}
                {multipleExamsList.length > 0 && (
                  <div className="space-y-1.5 pt-1 text-xs text-foreground">
                    <div className="font-extrabold uppercase tracking-wide flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-warning print:hidden" />
                      <span>ATTENTION: Multiple Examinations on a Single Day</span>
                    </div>
                    <p className="font-medium text-muted-foreground">
                      Please check the timings carefully for the following dates:
                    </p>
                    <ul className="space-y-1.5 pl-2">
                      {multipleExamsList.map(([date, list]) => (
                        <li key={date} className="flex flex-col sm:flex-row sm:items-baseline gap-1">
                          <span className="font-bold">• Date: {formatDisplayDate(date)} ({list[0]?.day_of_week}):</span>
                          <span className="text-foreground">
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
                {ds.description && (
                  <div className="p-3.5 bg-muted/40 border border-border rounded-xs text-xs space-y-1">
                    <div className="font-bold uppercase tracking-wider text-foreground">
                      General Instructions:
                    </div>
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {ds.description}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

