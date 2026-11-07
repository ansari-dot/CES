export type AssessmentType = 'ASSIGNMENT' | 'QUIZ' | 'TEST' | 'EXAM';

export interface AcademicOversightFilters {
  subjectId?: number | null;
  taskType?: AssessmentType | null;
}

export interface StudentSupportFlag {
  studentId: number;
  studentName: string;
  rollNo: string | null;
  admissionNo: string;
  averageScore: number | null;
  attendanceRate: number | null;
  missingSubmissions: number;
  reasons: string[];
}

// Percentages are null when no records exist yet (never estimated)
export interface AcademicClassPerformance {
  classId: number;
  classNumber: number;
  className: string;
  enrolledStudents: number;
  assessmentsCount: number;
  gradedResultsCount: number;
  averageScorePercentage: number | null;
  taskCompletionRate: number | null;
  attendanceRate: number | null;
  missingSubmissionsCount: number;
  pendingGradingCount: number;
  publishedResultsStatus: 'Published' | 'Pending Approval' | 'Draft';
  term: string;
  subjectScores: {
    subjectId: number;
    subjectName: string;
    averageScore: number | null;
    gradedCount: number;
    assessmentsCount: number;
    teacherName: string;
  }[];
  assessmentBreakdown: {
    taskType: AssessmentType;
    assessments: number;
    graded: number;
    averageScore: number | null;
  }[];
  recentAssessments: {
    taskId: number;
    title: string;
    taskType: AssessmentType;
    subjectName: string;
    deadline: string;
    totalMarks: number;
    submitted: number;
    graded: number;
    enrolled: number;
    averageScore: number | null;
  }[];
  trend: { month: string; averageScore: number | null; graded: number }[];
  studentsNeedingSupport: StudentSupportFlag[];
}

export interface StudentRecordReportRow {
  id: string;
  admissionNo: string;
  rollNo: string;
  studentName: string;
  className: string;
  classNumber: number;
  admissionDate: string | null;
  enrolmentStatus: string;
  attendance: { present: number; absent: number; late: number; excused: number; total: number; rate: number | null };
  fees: { totalBilled: number; totalPaid: number; outstanding: number; latestMonth: string | null; latestStatus: string | null };
  academics: {
    submitted: number;
    graded: number;
    averageScore: number | null;
    grade: string;
    assignmentAverage: number | null;
    quizAverage: number | null;
    testAverage: number | null;
    examAverage: number | null;
  };
  achievements: number;
  terminalResult?: {
    obtainedMarks: number | null;
    totalMarks: number;
    percentage: number | null;
    grade: string;
    status: string;
    resultStatus: string;
  };
}

export interface StudentMarksReportRow {
  id: string;
  admissionNo: string;
  studentName: string;
  className: string;
  classNumber: number;
  subjectName: string;
  assessmentTitle: string;
  taskType: AssessmentType;
  marksAwarded: number;
  totalMarks: number;
  percentage: number | null;
  grade: string;
  gradedAt: string | null;
  teacherName: string;
  feedback: string;
}

export type ReportCategory =
  | 'student_records'
  | 'student_marks'
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
