export type AuditRecordType =
  | 'Teacher Account'
  | 'Student Account'
  | 'Parent Relationship'
  | 'Teacher Assignment'
  | 'Timetable Lesson'
  | 'Zoom Link'
  | 'Attendance Correction'
  | 'Fee Structure'
  | 'Monthly Challan'
  | 'Payment Verification'
  | 'Teacher Payroll'
  | 'Notice'
  | 'Portal Access';

export interface AuditLogEntry {
  id: string;
  actorName: string;
  actorRole: string;
  action: string;
  recordType: AuditRecordType;
  recordIdentifier: string;
  timestamp: string;
  reason: string;
  previousValue?: string;
  newValue?: string;
  ipAddress?: string;
}
