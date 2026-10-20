import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { ReportCategory } from '../../types';
import { LoadingState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import {
  FileText,
  Download,
  Filter,
  Printer,
  Table
} from 'lucide-react';

export const ReportsModule: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>('student_enrolment');
  const [classFilter, setClassFilter] = useState<string>('All');
  const [loading, setLoading] = useState(false);
  const [reportRows, setReportRows] = useState<any[]>([]);

  const toast = useToast();
  const { activeSession } = useAuth();

  const generateReport = useCallback(async () => {
    setLoading(true);
    try {
      if (selectedCategory === 'student_enrolment') {
        const students = await api.getStudents();
        const filtered = students.filter(
          (s) => classFilter === 'All' || s.classNumber === Number(classFilter)
        );
        setReportRows(
          filtered.map((s) => ({
            col1: s.rollNumber,
            col2: s.admissionNumber,
            col3: s.name,
            col4: `Class ${s.classNumber}`,
            col5: s.parentNames?.join(', ') || 'N/A',
            col6: s.enrolmentStatus,
            col7: s.accountStatus
          }))
        );
      } else if (selectedCategory === 'fee_collection') {
        const challans = await api.getChallans();
        const filtered = challans.filter(
          (ch) => classFilter === 'All' || ch.classNumber === Number(classFilter)
        );
        setReportRows(
          filtered.map((ch) => ({
            col1: ch.challanNumber,
            col2: ch.studentName,
            col3: `Class ${ch.classNumber}`,
            col4: `Rs. ${ch.breakdown.totalPayable.toLocaleString()}`,
            col5: `Rs. ${(ch.paidAmount || 0).toLocaleString()}`,
            col6: `Rs. ${ch.outstandingBalance.toLocaleString()}`,
            col7: ch.status
          }))
        );
      } else if (selectedCategory === 'teacher_duty_payroll') {
        const drafts = await api.getSalaryDrafts();
        setReportRows(
          drafts.map((d) => ({
            col1: d.staffIdentifier,
            col2: d.teacherName,
            col3: d.salaryModel,
            col4: `${d.completedLessons} / ${d.scheduledLessons} lessons (${d.verifiedHours} hrs)`,
            col5: `Rs. ${d.grossAmount.toLocaleString()}`,
            col6: `Rs. ${d.netPayable.toLocaleString()}`,
            col7: d.status
          }))
        );
      } else if (selectedCategory === 'account_suspensions') {
        const [teachers, students] = await Promise.all([api.getTeachers(), api.getStudents()]);
        const suspendedTeachers = teachers.filter((t) => t.accountStatus === 'Temporarily Suspended');
        const suspendedStudents = students.filter((s) => s.accountStatus === 'Temporarily Suspended');

        const rows: any[] = [];
        suspendedTeachers.forEach((t) => {
          rows.push({
            col1: 'Teacher',
            col2: t.name,
            col3: t.staffIdentifier,
            col4: t.suspensionDetails?.reason || 'Administrative investigation',
            col5: t.suspensionDetails?.effectiveDate?.split('T')[0] || '2024-05-14',
            col6: t.suspensionDetails?.expiryDate?.split('T')[0] || 'Pending review',
            col7: 'Restricted Host'
          });
        });
        suspendedStudents.forEach((s) => {
          rows.push({
            col1: 'Student',
            col2: s.name,
            col3: `Class ${s.classNumber} (Roll ${s.rollNumber})`,
            col4: s.suspensionDetails?.reason || 'Overdue fee non-payment policy',
            col5: s.suspensionDetails?.effectiveDate?.split('T')[0] || '2024-05-10',
            col6: 'Automatic upon fee clearance',
            col7: 'Restricted Portal'
          });
        });
        setReportRows(rows);
      } else {
        // Attendance trends
        const attendance = await api.getAttendanceSummaries();
        const filtered = attendance.filter(
          (a) => classFilter === 'All' || a.classNumber === Number(classFilter)
        );
        setReportRows(
          filtered.map((a) => {
            const p = a.records.filter((r) => r.status === 'Present').length;
            return {
              col1: a.date,
              col2: `Class ${a.classNumber}`,
              col3: a.subjectName,
              col4: a.teacherName,
              col5: `${a.enrolledStudentsCount} enrolled`,
              col6: `${p} present (${Math.round((p / (a.enrolledStudentsCount || 1)) * 100)}%)`,
              col7: a.submissionStatus
            };
          })
        );
      }
    } catch {
      toast.error('Failed to compile report records');
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, classFilter, toast]);

  useEffect(() => {
    generateReport();
  }, [generateReport]);

  const handleExportCSV = () => {
    if (reportRows.length === 0) return;
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      reportRows.map((e) => Object.values(e).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `school_report_${selectedCategory}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Report downloaded in CSV format.');
  };

  const getHeaders = () => {
    switch (selectedCategory) {
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

  return (
    <div className="space-y-4">
      {/* Top Banner Card in clean white */}
      <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Operational Reports & Exports</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Export academic session audits, fee collection statements, teacher duties, and student rolls.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium transition-colors flex items-center gap-1.5 shadow-2xs"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.75} />
            <span>Print Report</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter and Category Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-slate-500 font-medium">Domain:</span>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as ReportCategory)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 font-semibold focus:outline-none"
          >
            <option value="student_enrolment">Student Enrolment (Classes 1–8)</option>
            <option value="fee_collection">Monthly Fee Collection & Arrears</option>
            <option value="teacher_duty_payroll">Teacher Duty & Payroll Audits</option>
            <option value="attendance_trends">Attendance Trends & Log Delivery</option>
            <option value="account_suspensions">Account Suspension & Access Audit</option>
          </select>

          {(selectedCategory === 'student_enrolment' || selectedCategory === 'fee_collection' || selectedCategory === 'attendance_trends') && (
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

      {/* Report Data Grid */}
      {loading ? (
        <LoadingState message="Generating compiled report records..." rows={6} />
      ) : (
        <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200/80 uppercase text-[10px] tracking-wider">
                <tr>
                  {headers.map((h, i) => (
                    <th key={i} className="px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono bg-white">
                {reportRows.length === 0 ? (
                  <tr>
                    <td colSpan={headers.length} className="px-4 py-8 text-center text-slate-400">
                      No records available for this report.
                    </td>
                  </tr>
                ) : (
                  reportRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-900 font-semibold">{row.col1}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">{row.col2}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">{row.col3}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">{row.col4}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">{row.col5}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">{row.col6}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">{row.col7}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
