import { reportsRepository } from './reports.repository.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';

export const reportsService = {
  async getStudentEnrolmentReport(filters) {
    return await reportsRepository.getStudentEnrolmentReport(filters);
  },

  async getFeeCollectionReport(filters) {
    return await reportsRepository.getFeeCollectionReport(filters);
  },

  async getTeacherDutyPayrollReport(filters) {
    return await reportsRepository.getTeacherDutyPayrollReport(filters);
  },

  async getAttendanceTrendsReport(filters) {
    return await reportsRepository.getAttendanceTrendsReport(filters);
  },

  async getAcademicPerformances(filters) {
    return await reportsRepository.getAcademicPerformances(filters);
  },

  async approveResultPublication({ classNumber, sessionId, term, userId }) {
    if (!classNumber) {
      throw new AppError('Class number is required', 422, ErrorCodes.VALIDATION_ERROR);
    }
    const result = await reportsRepository.approveResultPublication({
      classNumber: Number(classNumber),
      sessionId,
      term,
      userId
    });
    if (!result) {
      throw new AppError('Class not found', 404, ErrorCodes.NOT_FOUND);
    }
    return result;
  },

  async exportReportData({ reportType, format = 'csv', filters = {}, userId }) {
    let rows = [];
    let headers = [];

    switch (reportType) {
      case 'student_enrolment':
        rows = await reportsRepository.getStudentEnrolmentReport(filters);
        headers = ['Roll No', 'Admission No', 'Student Name', 'Class', 'Gender', 'Enrolment Status', 'Portal Status'];
        break;
      case 'fee_collection': {
        const feeData = await reportsRepository.getFeeCollectionReport(filters);
        rows = feeData.rows;
        headers = ['Challan No', 'Student Name', 'Class', 'Total Payable', 'Paid Amount', 'Outstanding Balance', 'Status'];
        break;
      }
      case 'teacher_duty_payroll':
        rows = await reportsRepository.getTeacherDutyPayrollReport(filters);
        headers = ['Staff ID', 'Teacher Name', 'Salary Model', 'Completed Lessons', 'Gross Amount', 'Net Payable', 'Payroll Status'];
        break;
      case 'attendance_trends':
        rows = await reportsRepository.getAttendanceTrendsReport(filters);
        headers = ['Date', 'Class', 'Subject', 'Teacher', 'Enrolled Count', 'Attendance Record', 'Submission Status'];
        break;
      default:
        throw new AppError(`Unsupported report type: ${reportType}`, 422, ErrorCodes.VALIDATION_ERROR);
    }

    await reportsRepository.logReportExport({
      reportType,
      exportFormat: format,
      filterParameters: filters,
      rowCount: rows.length,
      userId
    });

    if (format === 'json') {
      return {
        filename: `report_${reportType}_${Date.now()}.json`,
        contentType: 'application/json',
        content: JSON.stringify(rows, null, 2),
        rowCount: rows.length
      };
    }

    // Default: CSV format
    const csvRows = [headers.join(',')];
    for (const r of rows) {
      const line = [
        `"${r.col1 || ''}"`,
        `"${r.col2 || ''}"`,
        `"${r.col3 || ''}"`,
        `"${r.col4 || ''}"`,
        `"${r.col5 || ''}"`,
        `"${r.col6 || ''}"`,
        `"${r.col7 || ''}"`
      ];
      csvRows.push(line.join(','));
    }

    return {
      filename: `report_${reportType}_${Date.now()}.csv`,
      contentType: 'text/csv',
      content: csvRows.join('\n'),
      rowCount: rows.length
    };
  }
};
