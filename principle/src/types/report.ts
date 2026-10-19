export interface AcademicClassPerformance {
  classNumber: number;
  className: string;
  enrolledStudents: number;
  averageScorePercentage: number;
  taskCompletionRate: number;
  attendanceRate: number;
  missingSubmissionsCount: number;
  pendingGradingCount: number;
  publishedResultsStatus: 'Published' | 'Pending Approval' | 'Draft';
  subjectScores: {
    subjectName: string;
    averageScore: number;
    teacherName: string;
  }[];
}

export type ReportCategory =
  | 'student_enrolment'
  | 'fee_collection'
  | 'teacher_duty_payroll'
  | 'attendance_trends'
  | 'lesson_completion'
  | 'account_suspensions';

export interface ReportFilterCriteria {
  session: string;
  classNumber?: number | 'All';
  dateRangeStart?: string;
  dateRangeEnd?: string;
  billingMonth?: string;
}

export interface OperationalReportRow {
  id: string;
  col1: string;
  col2: string;
  col3: string;
  col4: string;
  col5: string;
  col6?: string;
  col7?: string;
}
