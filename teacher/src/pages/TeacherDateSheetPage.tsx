import React, { useState, useEffect } from 'react';
import { teacherDatesheetsApi } from '../services/datesheetsApi';
import { TeacherDateSheet, TeacherDateSheetEntry } from '../types/datesheet';
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
  GraduationCap,
  Shield,
  Layers,
  Sparkles
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

  // Determine status (Upcoming, Today, Completed, Changed)
  const getExamStatus = (entry: TeacherDateSheetEntry) => {
    if (entry.is_date_changed) return { label: 'Date Changed', cls: 'bg-rose-50 text-rose-700 border-rose-200' };
    const todayStr = new Date().toISOString().split('T')[0];
    if (entry.exam_date === todayStr) return { label: 'Today', cls: 'bg-amber-50 text-amber-800 border-amber-200' };
    if (entry.exam_date > todayStr) return { label: 'Upcoming', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200' };
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

  // Metrics
  const totalSheets = dateSheets.length;
  const allEntries = dateSheets.flatMap((s) => s.entries || []);
  const totalPapers = allEntries.length;
  const todayStr = new Date().toISOString().split('T')[0];
  const upcomingPapers = allEntries.filter((e) => e.exam_date >= todayStr).length;
  const invigilationDuties = allEntries.filter((e) => Boolean(e.teacher_id)).length;

  return (
    <div className="flex flex-col w-full pb-16 space-y-5 bg-[#f6f7fb] min-h-screen p-3 sm:p-5 lg:p-6 rounded-2xl">
      {/* ------------------------------------------------------------- */}
      {/* 1. HERO HEADER BANNER                                         */}
      {/* ------------------------------------------------------------- */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-xs print:hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#36348e]/10 border border-[#36348e]/20 flex items-center justify-center text-[#36348e] shrink-0 shadow-2xs">
              <CalendarDays className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold text-[#36348e] uppercase tracking-wider">
                  Academic Assessment
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-xs text-slate-500 font-semibold">Official Published Date Sheets</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Examination Date Sheets &amp; Timetables
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Official institutional schedules for term exams, monthly tests, and invigilation duties.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            <button
              onClick={loadDateSheets}
              disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200/80 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
            >
              <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handlePrint}
              disabled={filteredSheets.length === 0}
              className="flex items-center gap-1.5 px-4.5 py-2 text-xs font-bold text-white bg-[#36348e] hover:bg-[#2c2a75] rounded-xl transition-all shadow-md shadow-indigo-100 disabled:opacity-50 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Print Timetable
            </button>
          </div>
        </div>

        {/* Subtle Decorative Background Element */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#36348e]/5 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. FOUR TOP WAVE KPI STAT CARDS                               */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 print:hidden">
        {/* Card 1: Active Date Sheets */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-indigo-100/80 hover:border-indigo-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-[#36348e] text-white shadow-sm shadow-indigo-900/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <CalendarDays className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-indigo-50 text-[#36348e] border-indigo-100">
              Published
            </span>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-2xl sm:text-2xl xl:text-3xl font-black text-slate-900 tracking-tight">
              {totalSheets}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">
              Active Exam Date Sheets
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(69, 67, 168, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#4543a8" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Card 2: Total Exam Papers */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-blue-100/80 hover:border-blue-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Layers className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-blue-50 text-blue-700 border-blue-100">
              Total Papers
            </span>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-2xl sm:text-2xl xl:text-3xl font-black text-slate-900 tracking-tight">
              {totalPapers}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">
              Assigned Examination Papers
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(59, 130, 246, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Card 3: Upcoming Papers */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-emerald-100/80 hover:border-emerald-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-emerald-50 text-emerald-800 border-emerald-100">
              Scheduled
            </span>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-2xl sm:text-2xl xl:text-3xl font-black text-slate-900 tracking-tight">
              {upcomingPapers}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">
              Upcoming &amp; Live Today
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(16, 185, 129, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#10b981" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>

        {/* Card 4: Invigilation Duties */}
        <div className="relative overflow-hidden rounded-2xl bg-white border border-amber-100/80 hover:border-amber-300 p-4 sm:p-4.5 shadow-xs transition-all duration-200 group flex flex-col justify-between min-h-[120px]">
          <div className="flex items-center justify-between relative z-10 w-full gap-2">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-500/30 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Shield className="w-5 h-5" />
            </div>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 border bg-amber-50 text-amber-900 border-amber-200">
              Faculty Duty
            </span>
          </div>
          <div className="mt-3 relative z-10">
            <div className="text-2xl sm:text-2xl xl:text-3xl font-black text-amber-950 tracking-tight">
              {invigilationDuties}
            </div>
            <div className="text-xs font-semibold text-slate-500 mt-0.5">
              Invigilator Shifts Assigned
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-10 pointer-events-none overflow-hidden z-0">
            <svg viewBox="0 0 500 120" preserveAspectRatio="none" className="w-full h-full opacity-60">
              <path d="M0,40 C150,90 350,0 500,50 L500,120 L0,120 Z" fill="rgba(245, 158, 11, 0.08)" />
              <path d="M0,45 C150,95 350,5 500,55" fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeOpacity="0.4" />
            </svg>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. FILTER TOOLBAR                                              */}
      {/* ------------------------------------------------------------- */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: 'All Examinations' },
            { id: 'MONTHLY_TEST', label: 'Monthly Tests' },
            { id: 'CLASS_QUIZ', label: 'Class Quizzes' },
            { id: 'MID_TERM', label: 'Mid-Term Exams' },
            { id: 'FINAL_TERM', label: 'Final-Term Exams' }
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-[#36348e] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {allClasses.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 flex items-center gap-1 font-semibold">
              <Filter className="w-3.5 h-3.5 text-[#36348e]" />
              Class:
            </span>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="text-xs bg-slate-100 border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-900 focus:outline-hidden cursor-pointer"
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

      {/* ------------------------------------------------------------- */}
      {/* 4. MAIN DATE SHEETS LIST                                      */}
      {/* ------------------------------------------------------------- */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <RotateCw className="w-8 h-8 text-[#36348e] animate-spin mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-800">Loading Examination Date Sheets...</p>
          <p className="text-xs text-slate-400 mt-1">Fetching your assigned curriculum timetable</p>
        </div>
      ) : errorMsg ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center text-rose-800">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-2" />
          <p className="text-sm font-bold">{errorMsg}</p>
          <button
            onClick={loadDateSheets}
            className="mt-3 px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : filteredSheets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <FileSpreadsheet className="w-7 h-7 text-slate-400" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No Examination Date Sheets Active</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
            There are currently no active or published examination date sheets for your assigned classes and subjects. Newly published schedules will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filteredSheets.map((sheet) => {
            const categoryLabel =
              ({
                CLASS_QUIZ: 'Class Quiz',
                MONTHLY_TEST: 'Monthly Test',
                MID_TERM: 'Mid-Term Examination',
                FINAL_TERM: 'Final-Term Examination'
              } as Record<string, string>)[sheet.exam_type] || sheet.exam_type;

            return (
              <div
                key={sheet.id}
                className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden print:border-none print:shadow-none"
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
                <div className="bg-slate-50 px-5 sm:px-6 py-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-[#36348e] flex items-center justify-center border border-indigo-100 shrink-0">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-lg bg-[#36348e] text-white">
                          {categoryLabel}
                        </span>
                        <h2 className="text-base font-black text-slate-900">
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
                    <span className="text-xs bg-white border border-slate-200 px-3 py-1 rounded-xl text-slate-700 font-bold shadow-2xs">
                      {sheet.entries.length} Assigned Paper{sheet.entries.length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>

                {/* Subtitle / Instructions */}
                {sheet.description && (
                  <div className="px-5 sm:px-6 py-3 bg-amber-50/60 border-b border-amber-100 text-xs text-amber-950 flex items-center gap-2">
                    <span className="font-bold text-amber-950">Notice:</span>
                    <span>{sheet.description}</span>
                  </div>
                )}

                {/* Timetable Table */}
                <div className="p-4 sm:p-6">
                  <div className="text-center font-bold text-sm text-slate-900 mb-3 tracking-wide">
                    Timetable for {sheet.title} — Faculty Examination Register
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                            <th className="py-2.5 px-3 border-r border-slate-200 w-12 text-center">#</th>
                            <th className="py-2.5 px-3 border-r border-slate-200">Date</th>
                            <th className="py-2.5 px-3 border-r border-slate-200">Day</th>
                            <th className="py-2.5 px-3 border-r border-slate-200">Class</th>
                            <th className="py-2.5 px-3 border-r border-slate-200">Subject Name</th>
                            <th className="py-2.5 px-3 border-r border-slate-200">Subject Code</th>
                            <th className="py-2.5 px-3 border-r border-slate-200">Type</th>
                            <th className="py-2.5 px-3 border-r border-slate-200">Start Time</th>
                            <th className="py-2.5 px-3 border-r border-slate-200">End Time</th>
                            <th className="py-2.5 px-3 border-r border-slate-200">Faculty Role</th>
                            <th className="py-2.5 px-3 text-center print:hidden">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {sheet.entries.map((entry, idx) => {
                            const status = getExamStatus(entry);
                            const isAssignedInvigilator = Boolean(entry.teacher_id);
                            return (
                              <tr key={entry.id || idx} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-3 px-3 border-r border-slate-200 text-center font-semibold text-slate-500">
                                  {idx + 1}
                                </td>
                                <td className="py-3 px-3 border-r border-slate-200 font-mono font-bold text-slate-900 whitespace-nowrap">
                                  {formatDisplayDate(entry.exam_date)}
                                </td>
                                <td className="py-3 px-3 border-r border-slate-200 text-slate-700 font-medium">
                                  {entry.day_of_week}
                                </td>
                                <td className="py-3 px-3 border-r border-slate-200 font-bold text-slate-900">
                                  {entry.class_name}
                                </td>
                                <td className="py-3 px-3 border-r border-slate-200 font-bold text-slate-900">
                                  {entry.subject_name}
                                  {entry.is_date_changed && entry.previous_exam_date && (
                                    <span className="block text-[10px] text-rose-600 font-bold mt-0.5">
                                      ⚠️ Rescheduled (Prev: {formatDisplayDate(entry.previous_exam_date)} {entry.previous_start_time || ''})
                                    </span>
                                  )}
                                </td>
                                <td className="py-3 px-3 border-r border-slate-200 text-slate-600 font-mono">
                                  {entry.subject_code || '—'}
                                </td>
                                <td className="py-3 px-3 border-r border-slate-200 text-slate-700">
                                  {entry.subject_type || 'Scholastic'}
                                </td>
                                <td className="py-3 px-3 border-r border-slate-200 text-slate-800 font-mono font-semibold whitespace-nowrap">
                                  {entry.start_time || '—'}
                                </td>
                                <td className="py-3 px-3 border-r border-slate-200 text-slate-800 font-mono font-semibold whitespace-nowrap">
                                  {entry.end_time || '—'}
                                </td>
                                <td className="py-3 px-3 border-r border-slate-200">
                                  <span
                                    className={`px-2 py-0.5 text-[10px] font-bold rounded-lg ${
                                      isAssignedInvigilator
                                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                        : 'bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    {isAssignedInvigilator ? 'Invigilator' : 'Subject Faculty'}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-center print:hidden">
                                  <span
                                    className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${status.cls}`}
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
                    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-950">
                      <div className="font-extrabold flex items-center gap-1.5 uppercase text-amber-950 tracking-wide">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        ATTENTION: Multiple Examinations on a Single Day
                      </div>
                      <p className="mt-1 text-amber-800 font-medium">
                        Please review period timings carefully for the following sessions:
                      </p>
                      <ul className="mt-2 space-y-1 list-disc list-inside">
                        {sheet.multipleExamsAttention.map((item, idx) => (
                          <li key={idx} className="leading-relaxed">
                            <span className="font-bold text-amber-950">
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
                  <div className="mt-4 p-4 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-600 space-y-1.5">
                    <p className="font-bold text-slate-800">Faculty Examination Protocol:</p>
                    <p>• Question papers and digital exam materials remain securely locked until 15 minutes before the start time.</p>
                    <p>• Student attendance and invigilation rosters must be verified and submitted immediately upon paper conclusion.</p>
                    <p>• Marks entry and grading evaluations must adhere to Cambridge Education System standardized rubrics.</p>
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
