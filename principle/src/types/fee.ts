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

export interface SchoolBankAccount {
  id: number;
  bankName: string;
  branchName: string;
  accountTitle: string;
  accountNumber: string;
  iban: string;
  isDefault: boolean;
  status: 'ACTIVE' | 'ARCHIVED';
  instructions?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AccountBreakdownItem {
  id: number;
  bankName: string;
  accountNumber: string;
  accountTitle: string;
  isDefault: boolean;
  status: string;
  totalChallans: number;
  totalBilled: number;
  totalCollected: number;
  totalOutstanding: number;
  paidCount: number;
  unpaidCount: number;
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
  bankAccountId?: number | null;
  bankAccount?: SchoolBankAccount;
  /** Frozen per-challan payment details (current revision) printed on the voucher */
  paymentDetails?: ChallanPaymentDetails | null;
}

/** One revision of the recipient / payment details printed on a challan. */
export interface ChallanPaymentDetails {
  revision: number;
  source: 'ISSUED_SNAPSHOT' | 'PRINCIPAL_EDIT' | 'BANK_REASSIGNMENT';
  accountTitle: string;
  bankName: string | null;
  branchName: string | null;
  accountNumber: string | null;
  iban: string | null;
  paymentMethod: string;
  instructions: string | null;
  qr: {
    enabled: boolean;
    uploaded: boolean;
    label: string | null;
    /** Authenticated, access-checked image URL (never a storage path) */
    url: string | null;
    sizeBytes: number | null;
    attestedAt: string | null;
  };
  changeReason: string | null;
  updatedAt: string;
  updatedBy: string;
}

export interface ChallanPaymentDetailsResponse {
  challanId: number;
  challanNumber: string;
  status: string;
  editable: boolean;
  lockedReason: string | null;
  current: ChallanPaymentDetails | null;
  history: ChallanPaymentDetails[];
  revision?: number;
}

export interface ChallanPaymentDetailsInput {
  accountTitle: string;
  bankName?: string;
  branchName?: string;
  accountNumber?: string;
  iban?: string;
  paymentMethod: string;
  instructions?: string;
  reason: string;
  confirmRevision: boolean;
  expectedRevision: number;
  qrAction: 'keep' | 'replace' | 'remove';
  qrEnabled: boolean;
  qrAttested?: boolean;
  qrLabel?: string;
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
  targetBankAccountId?: number | null;
  targetBankAccount?: SchoolBankAccount;
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
