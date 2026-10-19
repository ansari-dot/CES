import { SalaryModel } from './teacher';

export type PayrollDraftStatus = 'Draft' | 'Submitted for Approval' | 'Approved' | 'Returned for Correction' | 'Rejected' | 'Paid';

export interface SalaryAdjustment {
  id: string;
  type: 'Addition' | 'Deduction';
  title: string;
  amount: number;
  reason: string;
  authorizedBy: string;
}

export interface TeacherSalaryDraft {
  id: string;
  teacherId: string;
  teacherName: string;
  staffIdentifier: string;
  payrollMonth: string; // "May 2024"
  salaryModel: SalaryModel;
  
  // Duty metrics for the month
  scheduledLessons: number;
  completedLessons: number;
  cancelledLessons: number;
  missedLessons: number;
  approvedLeaveDays: number;
  verifiedHours: number;

  // Calculation components
  basePay: number;
  ratePerUnit: number; // rate per lesson or per hour if applicable
  lessonOrHourlyEarning: number;
  allowances: number;
  standardDeductions: number;
  adjustments: SalaryAdjustment[];
  calculationFormula: string;
  grossAmount: number;
  netPayable: number;

  status: PayrollDraftStatus;
  generatedAt: string;
  generatedBy: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewRemarks?: string;
  paymentRecord?: {
    paymentMethod: 'Bank Transfer' | 'Direct Deposit';
    paymentReference: string;
    paidAt: string;
    paidAmount: number;
  };
  salarySlipNumber?: string;
}
