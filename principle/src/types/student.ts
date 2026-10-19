import { AccountStatus } from './auth';

export interface StudentTransferHistory {
  id: string;
  previousClass: number;
  newClass: number;
  academicSession: string;
  effectiveDate: string;
  reason: string;
  transferredBy: string;
}

export interface Student {
  id: string;
  name: string;
  admissionNumber: string; // e.g. ADM-2024-101
  rollNumber: string; // e.g. 101
  classNumber: number; // 1 to 8
  section?: string;
  academicSession: string;
  admissionDate: string;
  parentIds: string[];
  parentNames?: string[];
  contactPhone: string;
  contactEmail: string;
  enrolmentStatus: 'Active' | 'Withdrawn' | 'Graduated' | 'Suspended';
  accountStatus: AccountStatus;
  transferHistory: StudentTransferHistory[];
  suspensionDetails?: {
    reason: string;
    effectiveDate: string;
    expiryDate?: string;
    internalNote?: string;
    isFeeNonPayment?: boolean;
    suspendedBy: string;
  };
}
