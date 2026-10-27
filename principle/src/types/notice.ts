export type NoticePriority = 'Normal' | 'High' | 'Urgent';

// 'School-Wide', 'Class N', or a multi-class label such as 'Classes 3, 5' (teacher notices)
export type NoticeAudience = 'School-Wide' | 'Class 1' | 'Class 2' | 'Class 3' | 'Class 4' | 'Class 5' | 'Class 6' | 'Class 7' | 'Class 8' | (string & {});

export type NoticeRecipientRole = 'Teacher' | 'Student' | 'Parent';

export interface SchoolNotice {
  id: string;
  title: string;
  content: string;
  audience: NoticeAudience;
  targetRoles: NoticeRecipientRole[];
  targetClassIds?: number[] | null;
  category?: string | null;
  priority: NoticePriority;
  status: 'Draft' | 'Published' | 'Archived';
  publishDate: string;
  expiryDate?: string;
  createdBy: string;
  createdById?: number;
  createdAt?: string;
  acknowledgedCount?: number;
  canManage?: boolean;
}

export interface NoticeFormPayload {
  title: string;
  content: string;
  audience: NoticeAudience;
  targetRoles: NoticeRecipientRole[];
  priority: NoticePriority;
  status: 'Draft' | 'Published';
  publishDate?: string;
  expiryDate?: string;
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
