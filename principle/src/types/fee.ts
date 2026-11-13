export type FeeHeadType = 'Tuition' | 'Admission' | 'Technology' | 'Books' | 'Examination' | 'Other';

export interface FeeHeadItem {
  id: string;
  head: FeeHeadType;
  amount: number;
  isRecurring: boolean; // monthly recurring vs one-time
  description?: string;
}

export interface ClassFeeStructure {
  id: string;
  classNumber: number; // 1 to 8
  academicSession: string;
  heads: FeeHeadItem[];
  totalMonthlyRecurring: number;
  effectiveFrom: string;
  status: 'Active' | 'Archived';
}

export interface StudentConcession {
  id: string;
  studentId: string;
  studentName: string;
  classNumber: number;
  concessionType: 'Percentage' | 'Fixed Amount' | 'Sibling Discount' | 'Merit Scholarship' | 'Need Based';
  value: number; // e.g. 20% or 1000 PKR
  reason: string;
  approvedBy: string;
  effectiveSession: string;
  status: 'Active' | 'Revoked';
  sessionId?: number;
  termId?: number | null;
  termName?: string | null;
  effectiveStartDate?: string | null;
  effectiveEndDate?: string | null;
  feeComponent?: string | null;
  adminNotes?: string | null;
  createdAt?: string;
  revokedAt?: string | null;
  revokedBy?: string | null;
  revokeReason?: string | null;
}

/** Fields accepted when creating or editing a concession. */
export interface ConcessionInput {
  studentId: string;
  concessionType: StudentConcession['concessionType'];
  value: number;
  reason: string;
  sessionId?: number | null;
  termId?: number | null;
  effectiveStartDate?: string | null;
  effectiveEndDate?: string | null;
  feeComponent?: string | null;
  adminNotes?: string | null;
}

export type ChallanStatus = 'Unpaid' | 'Pending Verification' | 'Partially Paid' | 'Paid' | 'Overdue';

export interface FeeBreakdown {
  tuitionFee: number;
  technologyFee: number;
  examinationFee: number;
  booksFee: number;
  admissionFee: number;
  otherFee: number;
  grossAmount: number;
  concessionAmount: number;
  arrearsAmount: number; // carried forward
  lateFeeAmount: number;
  totalPayable: number;
}

export interface MonthlyChallan {
  id: string;
  challanNumber: string; // e.g. CH-2024-05-101
  studentId: string;
  studentName: string;
  rollNumber: string;
  admissionNumber: string;
  classNumber: number;
  billingMonth: string; // "May 2024"
  academicSession: string;
  generationDate: string;
  dueDate: string;
  gracePeriodDays: number;
  breakdown: FeeBreakdown;
  paidAmount: number;
  outstandingBalance: number;
  status: ChallanStatus;
  remindersSentCount: number;
  lastReminderDate?: string;
  /** Student portal account status (ACTIVE / SUSPENDED) for the fee-block button */
  studentPortalStatus?: string;
}

export type PaymentVerificationStatus = 'Pending' | 'Approved' | 'Rejected' | 'Resubmission Requested';

export interface PaymentProofSubmission {
  id: string;
  challanId: string;
  challanNumber: string;
  studentId: string;
  studentName: string;
  parentId: string;
  parentName: string;
  classNumber: number;
  submittedAmount: number;
  bankOrWallet: string; // e.g. "Meezan Bank", "Easypaisa", "HBL"
  transactionReference: string; // e.g. "TXN-8849102"
  paymentDate: string;
  proofDocumentUrl: string;
  submissionTimestamp: string;
  status: PaymentVerificationStatus;
  reviewedBy?: string;
  reviewTimestamp?: string;
  reviewDecisionNote?: string;
  verifiedAmount?: number;
  receiptNumber?: string;
}

// Student whose portal access is restricted for overdue fees
export interface RestrictedStudent {
  studentId: string;
  studentName: string;
  admissionNo: string;
  rollNo: string;
  classNumber: number | null;
  className: string;
  restrictedForMonths: string[];
  reason: string;
  restrictedAt: string;
  portalStatus: string;
  // Balance of the latest unpaid invoice (includes carried-forward arrears)
  outstandingAmount: number;
  outstandingInvoices: { billingMonth: string; status: string; outstanding: number }[];
}
