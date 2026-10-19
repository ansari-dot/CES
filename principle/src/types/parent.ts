import { AccountStatus } from './auth';

export interface Parent {
  id: string;
  name: string;
  email: string;
  phone: string;
  cnicOrIdNumber: string;
  linkedStudentIds: string[];
  verificationStatus: 'Verified' | 'Pending Verification' | 'Rejected';
  accountStatus: AccountStatus;
  occupation?: string;
  relationship: 'Father' | 'Mother' | 'Guardian';
  address?: string;
}
