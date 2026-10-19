export type NoticePriority = 'Normal' | 'High' | 'Urgent';

export type NoticeAudience = 'School-Wide' | 'Class 1' | 'Class 2' | 'Class 3' | 'Class 4' | 'Class 5' | 'Class 6' | 'Class 7' | 'Class 8';

export interface SchoolNotice {
  id: string;
  title: string;
  content: string;
  audience: NoticeAudience;
  targetRoles: ('Teacher' | 'Student' | 'Parent')[];
  priority: NoticePriority;
  status: 'Draft' | 'Published' | 'Archived';
  publishDate: string;
  expiryDate?: string;
  createdBy: string;
  acknowledgedCount?: number;
}

export type NotificationType =
  | 'Timetable Change'
  | 'Failed Zoom Meeting'
  | 'Missing Attendance'
  | 'Payment Proof Awaiting Review'
  | 'Payment Verified'
  | 'Fee Reminder'
  | 'Account Suspension'
  | 'Salary Draft'
  | 'Correction Request';

export interface OperationalNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  targetRole: string;
  relatedRecordId?: string;
  relatedRecordType?: string;
  timestamp: string;
  isRead: boolean;
  priority: 'Low' | 'Medium' | 'High';
}
