import React, { useState, useEffect } from 'react';
import { teacherDatesheetsApi } from '../services/datesheetsApi';
import { TeacherDateSheet, TeacherDateSheetEntry, ExamType } from '../types/datesheet';
import {
  CalendarDays,
  Printer,
  Clock,
  AlertTriangle,
  FileSpreadsheet,
  RotateCw,
  CheckCircle2,
  Calendar,
  Filter,
  GraduationCap
} from 'lucide-react';

export const TeacherDateSheetPage: React.FC = () => {
  const [dateSheets, setDateSheets] = useState<TeacherDateSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');

  useEffect(() => {
    loadDateSheets();
  }, []);

  const loadDateSheets = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await teacherDatesheetsApi.getActiveDateSheets();
      setDateSheets(res.activeDateSheets || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to load examination date sheets.');
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

  // Determine status (Upcoming, Today, Completed)
  const getExamStatus = (dateStr: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (dateStr === todayStr) return { label: 'Today', cls: 'bg-amber-100 text-amber-800 border-amber-300' };
    if (dateStr > todayStr) return { label: 'Upcoming', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
    return { label: 'Completed', cls: 'bg-slate-100 text-slate-600 border-slate-200' };
  };

  // Collect distinct classes across all entries
  const allClasses = Array.from(
    new Map(
      dateSheets
        .flatMap((s) => s.entries || [])
        .map((e) => [e.class_id, { id: e.class_id, name: e.class_name }])
    ).values()
  );

  const filteredSheets = dateSheets
    .filter((ds) => {
      if (selectedCategory !== 'ALL' && ds.exam_type !== selectedCategory) return false;
      return true;
    })
    .map((ds) => {
      if (selectedClassId === 'ALL') return ds;
      const filteredEntries = (ds.entries || []).filter(
        (e) => String(e.class_id) === String(selectedClassId)
      );
      return {
        ...ds,
        entries: filteredEntries
      };
    })
    .filter((ds) => (ds.entries || []).length > 0);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold font-headings text-slate-900 flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-primary" />
            Official Faculty Examination Date Sheets
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Published schedules for classes and subjects assigned to your teaching portfolio
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadDateSheets}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handlePrint}
            disabled={filteredSheets.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary-hover rounded-lg transition-colors shadow-xs disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Timetable
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-1 overflow-x-auto">
          {[
            { id: 'ALL', label: 'All Examinations' },
            { id: 'MONTHLY_TEST', label: 'Monthly Tests' },
            { id: 'MID_TERM', label: 'Mid-Term Exams' },
            { id: 'FINAL_TERM', label: 'Final-Term Exams' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                selectedCategory === cat.id
                  ? 'bg-[#1b1a47] text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {allClasses.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
              <Filter className="w-3 h-3 text-slate-400" />
              Filter Class:
            </span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Assigned Classes ({allClasses.length})</option>
              {allClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
          <RotateCw className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700">Loading Examination Date Sheets...</p>
          <p className="text-xs text-slate-400 mt-1">Fetching your assigned timetable</p>
        </div>
      ) : errorMsg ? (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-center text-rose-800">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <p className="text-sm font-semibold">{errorMsg}</p>
          <button
            onClick={loadDateSheets}
            className="mt-3 px-4 py-1.5 text-xs font-semibold bg-rose-600 text-white rounded-lg hover:bg-rose-700"
          >
            Retry
          </button>
        </div>
      ) : filteredSheets.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <FileSpreadsheet className="w-7 h-7 text-slate-400" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No Examination Date Sheets Active</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            There are currently no active or published examination date sheets for your assigned classes and subjects. Newly published schedules will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {filteredSheets.map((sheet) => {
            const categoryLabel = {
              MONTHLY_TEST: 'Monthly Test',
              MID_TERM: 'Mid-Term Examination',
              FINAL_TERM: 'Final-Term Examination'
            }[sheet.exam_type] || sheet.exam_type;

            return (
              <div
                key={sheet.id}
                className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden print:border-none print:shadow-none"
              >
                {/* Print Header */}
                <div className="hidden print:block text-center border-b pb-4 mb-4">
                  <h1 className="text-xl font-bold uppercase tracking-wide text-slate-900">
                    Cambridge Education System
                  </h1>
                  <h2 className="text-base font-semibold text-slate-700 mt-0.5">
                    Faculty Timetable for {sheet.title} ({categoryLabel})
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Academic Session: {sheet.session_name || 'Current Session'}
                  </p>
                </div>

                {/* Card Title Banner */}
                <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 print:hidden">
                  <div className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-[#1b1a47] text-white">
                          {categoryLabel}
                        </span>
                        <h2 className="text-base font-bold text-slate-900">
                          {sheet.title}
                        </h2>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Academic Session: {sheet.session_name || 'Active Session'}
                        {sheet.published_at && ` · Published: ${new Date(sheet.published_at).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-white border border-slate-200 px-3 py-1 rounded-md text-slate-600 font-medium">
                      {sheet.entries.length} Assigned Paper{sheet.entries.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>

                {/* Subtitle / Instructions */}
                {sheet.description && (
                  <div className="px-5 py-3 bg-amber-50/50 border-b border-amber-100 text-xs text-slate-700">
                    <span className="font-semibold text-slate-900">Notice: </span>
                    {sheet.description}
                  </div>
                )}

                {/* Timetable Table */}
                <div className="p-5">
                  <div className="text-center font-bold text-sm text-slate-900 mb-3 tracking-wide">
                    Timetable for {sheet.title} — Faculty Schedule
                  </div>

                  <div className="border border-slate-300 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800">
                            <th className="py-2.5 px-3 border-r border-slate-300 w-12 text-center">S.N.</th>
                            <th className="py-2.5 px-3 border-r border-slate-300">Date</th>
                            <th className="py-2.5 px-3 border-r border-slate-300">Day</th>
                            <th className="py-2.5 px-3 border-r border-slate-300">Class</th>
                            <th className="py-2.5 px-3 border-r border-slate-300">Subject Name</th>
                            <th className="py-2.5 px-3 border-r border-slate-300">Subject Code</th>
                            <th className="py-2.5 px-3 border-r border-slate-300">Subject Type</th>
                            <th className="py-2.5 px-3 border-r border-slate-300">Start Time</th>
                            <th className="py-2.5 px-3 border-r border-slate-300">End Time</th>
                            <th className="py-2.5 px-3 text-center print:hidden">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {sheet.entries.map((entry, idx) => {
                            const status = getExamStatus(entry.exam_date);
                            return (
                              <tr key={entry.id || idx} className="hover:bg-slate-50/80">
                                <td className="py-2.5 px-3 border-r border-slate-200 text-center font-medium text-slate-600">
                                  {idx + 1}
                                </td>
                                <td className="py-2.5 px-3 border-r border-slate-200 font-semibold text-slate-900 whitespace-nowrap">
                                  {formatDisplayDate(entry.exam_date)}
                                </td>
                                <td className="py-2.5 px-3 border-r border-slate-200 text-slate-700">
                                  {entry.day_of_week}
                                </td>
                                <td className="py-2.5 px-3 border-r border-slate-200 font-bold text-slate-900">
                                  {entry.class_name}
                                </td>
                                <td className="py-2.5 px-3 border-r border-slate-200 font-semibold text-slate-900">
                                  {entry.subject_name}
                                </td>
                                <td className="py-2.5 px-3 border-r border-slate-200 text-slate-600 font-mono">
                                  {entry.subject_code || '—'}
                                </td>
                                <td className="py-2.5 px-3 border-r border-slate-200 text-slate-700">
                                  {entry.subject_type || 'Scholastic'}
                                </td>
                                <td className="py-2.5 px-3 border-r border-slate-200 text-slate-800 font-medium whitespace-nowrap">
                                  {entry.start_time || '—'}
                                </td>
                                <td className="py-2.5 px-3 border-r border-slate-200 text-slate-800 font-medium whitespace-nowrap">
                                  {entry.end_time || '—'}
                                </td>
                                <td className="py-2.5 px-3 text-center print:hidden">
                                  <span
                                    className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${status.cls}`}
                                  >
                                    {status.label}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Multiple Exams Attention Box */}
                  {sheet.multipleExamsAttention && sheet.multipleExamsAttention.length > 0 && (
                    <div className="mt-4 bg-amber-50 border border-amber-300 rounded-lg p-3.5 text-xs text-amber-900">
                      <div className="font-bold flex items-center gap-1.5 uppercase text-amber-950">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        ATTENTION: Multiple Examinations on a Single Day
                      </div>
                      <p className="mt-1 text-amber-800">
                        Please check the timings carefully for the following dates:
                      </p>
                      <ul className="mt-2 space-y-1 list-disc list-inside">
                        {sheet.multipleExamsAttention.map((item, idx) => (
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

                  {/* General Guidelines */}
                  <div className="mt-4 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1">
                    <p className="font-semibold text-slate-800">General Faculty Guidelines:</p>
                    <p>• Question papers and digital exam materials must be locked until 15 minutes before exam start.</p>
                    <p>• Student attendance and invigilation logs must be submitted immediately upon paper conclusion.</p>
                    <p>• Marks entry and grading evaluations should follow Cambridge Education System assessment rubrics.</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

