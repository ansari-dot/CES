import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { ReportCategory } from '../../types';
import { LoadingState } from '../../components/common/StateViews';
import { LetterheadHeader, LetterheadFooter } from '../../components/common/Letterhead';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  Download,
  Printer
} from 'lucide-react';

type ReportCell = string | number;

const CATEGORY_LABELS: Record<ReportCategory, string> = {
  student_records: 'Student Academic & Administrative Records',
  student_marks: 'Subject Marks & Assessment Results',
  student_enrolment: 'Student Enrolment (Classes 1–8)',
  fee_collection: 'Monthly Fee Collection & Arrears',
  teacher_duty_payroll: 'Teacher Duty & Payroll Audits',
  attendance_trends: 'Attendance Trends & Log Delivery',
  lesson_completion: 'Lesson Completion',
  account_suspensions: 'Account Suspension & Access Audit'
};

const TYPE_LABELS: Record<string, string> = { ASSIGNMENT: 'Assignment', QUIZ: 'Quiz', TEST: 'Test', EXAM: 'Examination' };

const CLASS_FILTERED: ReportCategory[] = ['student_records', 'student_marks', 'student_enrolment', 'fee_collection', 'attendance_trends'];

const pct = (v: number | null | undefined) => (v == null ? '—' : `${v}%`);
const rupees = (v: number) => `Rs. ${Math.round(v).toLocaleString()}`;
const shortDate = (v?: string | null) => (v ? String(v).split('T')[0] : '—');

/** RFC 4180 CSV field: always quoted, embedded quotes doubled; guards against spreadsheet formula injection. */
function csvField(value: ReportCell): string {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text) && !/^-?\d+(\.\d+)?%?$/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export const ReportsModule: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>('student_records');
  const [classFilter, setClassFilter] = useState<string>('All');
  const [loading, setLoading] = useState(false);
  const [reportRows, setReportRows] = useState<ReportCell[][]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date>(new Date());

  const toast = useToast();
  const { activeSession } = useAuth();

  const classId = classFilter === 'All' ? null : Number(classFilter);

  const generateReport = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      let rows: ReportCell[][] = [];

      if (selectedCategory === 'student_records') {
        const records = await api.getStudentRecordsReport(classId);
        rows = records.map((r) => [
          r.admissionNo,
          r.rollNo || '—',
          r.studentName,
          r.className,
          shortDate(r.admissionDate),
          r.enrolmentStatus,
          r.attendance.total > 0
            ? `${pct(r.attendance.rate)} (P ${r.attendance.present} / A ${r.attendance.absent} / L ${r.attendance.late})`
            : 'No records',
          rupees(r.fees.outstanding),
          r.fees.latestMonth ? `${r.fees.latestMonth} · ${r.fees.latestStatus}` : 'No challans',
          r.academics.graded > 0 ? `${pct(r.academics.averageScore)} (${r.academics.grade})` : '—',
          pct(r.academics.assignmentAverage),
          pct(r.academics.quizAverage),
          pct(r.academics.testAverage),
          pct(r.academics.examAverage),
          `${r.academics.graded} / ${r.academics.submitted}`,
          r.achievements
        ]);
      } else if (selectedCategory === 'student_marks') {
        const marks = await api.getStudentMarksReport(classId);
        rows = marks.map((m) => [
          m.admissionNo,
          m.studentName,
          m.className,
          m.subjectName,
          m.assessmentTitle,
          TYPE_LABELS[m.taskType] || m.taskType,
          `${m.marksAwarded} / ${m.totalMarks}`,
          pct(m.percentage),
          m.grade,
          shortDate(m.gradedAt),
          m.teacherName
        ]);
      } else if (selectedCategory === 'student_enrolment') {
        const students = await api.getStudents();
        const filtered = students.filter(
          (s) => classFilter === 'All' || s.classNumber === Number(classFilter)
        );
        rows = filtered.map((s) => [
          s.rollNumber,
          s.admissionNumber,
          s.name,
          `Class ${s.classNumber}`,
          s.parentNames?.join(', ') || 'N/A',
          s.enrolmentStatus,
          s.accountStatus
        ]);
      } else if (selectedCategory === 'fee_collection') {
        const challans = await api.getChallans();
        const filtered = challans.filter(
          (ch) => classFilter === 'All' || ch.classNumber === Number(classFilter)
        );
        rows = filtered.map((ch) => [
          ch.challanNumber,
          ch.studentName,
          `Class ${ch.classNumber}`,
          `Rs. ${ch.breakdown.totalPayable.toLocaleString()}`,
          `Rs. ${(ch.paidAmount || 0).toLocaleString()}`,
          `Rs. ${ch.outstandingBalance.toLocaleString()}`,
          ch.status
        ]);
      } else if (selectedCategory === 'teacher_duty_payroll') {
        const drafts = await api.getSalaryDrafts();
        rows = drafts.map((d) => [
          d.staffIdentifier,
          d.teacherName,
          d.salaryModel,
          `${d.completedLessons} / ${d.scheduledLessons} lessons (${d.verifiedHours} hrs)`,
          `Rs. ${d.grossAmount.toLocaleString()}`,
          `Rs. ${d.netPayable.toLocaleString()}`,
          d.status
        ]);
      } else if (selectedCategory === 'account_suspensions') {
        const [teachers, students] = await Promise.all([api.getTeachers(), api.getStudents()]);
        const suspendedTeachers = teachers.filter((t) => t.accountStatus === 'Temporarily Suspended');
        const suspendedStudents = students.filter((s) => s.accountStatus === 'Temporarily Suspended');

        suspendedTeachers.forEach((t) => {
          rows.push([
            'Teacher',
            t.name,
            t.staffIdentifier,
            t.suspensionDetails?.reason || '—',
            t.suspensionDetails?.effectiveDate?.split('T')[0] || '—',
            t.suspensionDetails?.expiryDate?.split('T')[0] || 'Pending review',
            'Restricted Host'
          ]);
        });
        suspendedStudents.forEach((s) => {
          rows.push([
            'Student',
            s.name,
            `Class ${s.classNumber} (Roll ${s.rollNumber})`,
            s.suspensionDetails?.reason || '—',
            s.suspensionDetails?.effectiveDate?.split('T')[0] || '—',
            'Upon principal restoration',
            'Restricted Portal'
          ]);
        });
      } else {
        // Attendance trends
        const attendance = await api.getAttendanceSummaries();
        const filtered = attendance.filter(
          (a) => classFilter === 'All' || a.classNumber === Number(classFilter)
        );
        rows = filtered.map((a) => {
          const p = a.records.filter((r) => r.status === 'Present').length;
          return [
            a.date,
            `Class ${a.classNumber}`,
            a.subjectName,
            a.teacherName,
            `${a.enrolledStudentsCount} enrolled`,
            a.enrolledStudentsCount > 0
              ? `${p} present (${Math.round((p / a.enrolledStudentsCount) * 100)}%)`
              : `${p} present`,
            a.submissionStatus
          ];
        });
      }

      setReportRows(rows);
      setGeneratedAt(new Date());
    } catch (err: unknown) {
      setReportRows([]);
      const message = err instanceof Error ? err.message : 'Failed to compile report records';
      setLoadError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, classFilter, classId, toast]);

  useEffect(() => {
    generateReport();
  }, [generateReport]);

  const getHeaders = (): string[] => {
    switch (selectedCategory) {
      case 'student_records':
        return [
          'Admission No', 'Roll', 'Student Name', 'Class', 'Admitted', 'Enrolment', 'Attendance',
          'Fee Outstanding', 'Latest Challan', 'Overall Score', 'Assignments', 'Quizzes', 'Tests', 'Exams',
          'Graded / Submitted', 'Achievements'
        ];
      case 'student_marks':
        return ['Admission No', 'Student Name', 'Class', 'Subject', 'Assessment', 'Type', 'Marks', 'Percentage', 'Grade', 'Graded On', 'Teacher'];
      case 'student_enrolment':
        return ['Roll', 'Admission No', 'Student Full Name', 'Class', 'Guardian', 'Enrolment', 'Portal Access'];
      case 'fee_collection':
        return ['Challan No', 'Student Name', 'Class', 'Total Payable', 'Paid Amount', 'Outstanding Balance', 'Payment Status'];
      case 'teacher_duty_payroll':
        return ['Staff ID', 'Teacher Name', 'Salary Model', 'Completed Duties', 'Gross Amount', 'Net Authorized', 'Payroll Status'];
      case 'account_suspensions':
        return ['Entity', 'Name', 'Identifier', 'Formal Reason', 'Effective Date', 'Expiry / Review', 'Restricted Privileges'];
      default:
        return ['Lesson Date', 'Class', 'Subject', 'Teacher', 'Enrolled Count', 'Attendance Count', 'Submission'];
    }
  };

  const headers = getHeaders();
  const filterLabel = CLASS_FILTERED.includes(selectedCategory)
    ? classFilter === 'All' ? 'All Classes (1 to 8)' : `Class ${classFilter}`
    : 'All records';

  const handleExportCSV = () => {
    if (reportRows.length === 0) {
      toast.warning('There are no records to export for the current selection.');
      return;
    }
    const lines = [headers.map(csvField).join(','), ...reportRows.map((row) => row.map(csvField).join(','))];
    // BOM so spreadsheet applications open UTF-8 names correctly
    const blob = new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const classPart = CLASS_FILTERED.includes(selectedCategory) && classFilter !== 'All' ? `_class-${classFilter}` : '';
    const sessionPart = activeSession ? `_${String(activeSession).replace(/[^\w-]+/g, '-')}` : '';
    const filename = `school-report_${selectedCategory}${classPart}${sessionPart}_${new Date().toISOString().split('T')[0]}.csv`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    api
      .logReportExport({
        reportType: selectedCategory,
        format: 'CSV',
        filters: { classFilter, session: activeSession },
        rowCount: reportRows.length
      })
      .catch(() => {
        // The download itself succeeded; the audit log entry is best-effort
      });
    toast.success(`Exported ${reportRows.length} records to ${filename}.`);
  };

  const handlePrint = () => {
    if (reportRows.length === 0) {
      toast.warning('There are no records to print for the current selection.');
      return;
    }
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* Landscape pages while this report is printed */}
      <style>{'@media print { @page { size: A4 landscape; margin: 10mm; } }'}</style>

      {/* Top Banner Card in clean white */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Operational Reports & Exports</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Export academic session audits, fee collection statements, teacher duties, and student rolls.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-60"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.75} />
            <span>Print Report</span>
          </button>
          <button
            onClick={handleExportCSV}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter and Category Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs print:hidden">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-slate-500 font-medium">Domain:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as ReportCategory)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 font-semibold focus:outline-none"
          >
            <option value="student_records">{CATEGORY_LABELS.student_records}</option>
            <option value="student_marks">{CATEGORY_LABELS.student_marks}</option>
            <option value="student_enrolment">{CATEGORY_LABELS.student_enrolment}</option>
            <option value="fee_collection">{CATEGORY_LABELS.fee_collection}</option>
            <option value="teacher_duty_payroll">{CATEGORY_LABELS.teacher_duty_payroll}</option>
            <option value="attendance_trends">{CATEGORY_LABELS.attendance_trends}</option>
            <option value="account_suspensions">{CATEGORY_LABELS.account_suspensions}</option>
          </select>

          {CLASS_FILTERED.includes(selectedCategory) && (
            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 focus:outline-none"
            >
              <option value="All">All Classes (1 to 8)</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((c) => (
                <option key={c} value={c}>Class {c}</option>
              ))}
            </select>
          )}
        </div>

        <span className="text-[11px] text-slate-500 font-mono">
          Session: <strong className="text-amber-700">{activeSession}</strong> · Records: {reportRows.length}
        </span>
      </div>

      {/* Print-only letterhead + report heading */}
      <LetterheadHeader />
      <div className="hidden print:block mb-3">
        <h1 className="text-lg font-bold text-slate-900">{CATEGORY_LABELS[selectedCategory]}</h1>
        <p className="text-[11px] text-slate-600 mt-0.5">
          Cambridge Education System · Session {activeSession} · {filterLabel} · {reportRows.length} records · Generated{' '}
          {generatedAt.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* Report Data Grid */}
      {loading ? (
        <LoadingState message="Generating compiled report records..." rows={6} />
      ) : (
        <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs print:shadow-none print:rounded-none print:border-slate-300">
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-left text-xs text-slate-700 print:text-[9px]">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80 uppercase text-[10px] tracking-wider print:text-[8px]">
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} className="px-4 py-3 whitespace-nowrap print:px-1.5 print:py-1.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono bg-white">
                {reportRows.length === 0 ? (
                  <tr>
                    <td colSpan={headers.length} className="px-4 py-8 text-center text-slate-400">
                      {loadError ? `Unable to load this report: ${loadError}` : 'No records available for this report.'}
                    </td>
                  </tr>
                ) : (
                  reportRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors print:break-inside-avoid">
                      {row.map((cell, ci) => (
                        <td
                          key={ci}
                          className={`px-4 py-3 whitespace-nowrap print:px-1.5 print:py-1 print:whitespace-normal ${
                            ci === 0 ? 'text-slate-900 font-semibold' : 'text-slate-700'
                          }`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <LetterheadFooter />
    </div>
  );
};
