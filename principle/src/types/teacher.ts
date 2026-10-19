import { AccountStatus } from './auth';

export type SalaryModel = 'Fixed monthly' | 'Per completed lesson' | 'Per hour' | 'Hybrid';

export interface SalaryConfig {
  model: SalaryModel;
  baseMonthlySalary: number;
  perLessonRate: number;
  perHourRate: number;
  allowances: number;
  standardDeductions: number;
  effectiveDate: string;
}

export interface TeacherAssignment {
  id: string;
  classNumber: number; // 1 to 8
  subjectName: string;
  startDate: string;
  endDate?: string;
  status: 'Active' | 'Ended';
}

export interface TeacherDutySummary {
  teacherId: string;
  payrollMonth: string;
  scheduledLessons: number;
  completedLessons: number;
  cancelledLessons: number;
  missedLessons: number;
  approvedLeaveDays: number;
  verifiedTeachingHours: number;
  pendingDutyCorrections: number;
}

export interface Teacher {
  id: string;
  staffIdentifier: string; // e.g. TCH-2024-001
  name: string;
  email: string;
  phone: string;
  designation: string; // e.g. Senior Science Teacher
  joiningDate: string;
  employmentStatus: 'Full-Time' | 'Part-Time' | 'Contract';
  accountStatus: AccountStatus;
  salaryConfig: SalaryConfig;
  assignments: TeacherAssignment[];
  suspensionDetails?: {
    reason: string;
    effectiveDate: string;
    expiryDate?: string;
    internalNote?: string;
    suspendedBy: string;
  };
}
