import { requestApi } from './api';

export interface PrincipalThreadItem {
  id: number;
  academic_session_id: number;
  class_id: number;
  subject_id: number;
  teacher_id: number;
  student_id: number;
  teacher_unread_count: number;
  student_unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  is_archived: boolean;
  className: string;
  gradeLevel: number;
  subjectName: string;
  subjectCode: string;
  teacherName: string;
  studentName: string;
  studentRollNumber: string;
  totalMessages: number;
  violationCount: number;
}

export interface ChatMessageItem {
  id: number;
  thread_id: number;
  sender_user_id: number;
  sender_role: 'TEACHER' | 'STUDENT';
  content: string;
  was_masked: boolean | number;
  has_policy_violation: boolean | number;
  policy_violation_type: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
  senderName?: string;
  senderEmail?: string;
}

export interface PrincipalOversightData {
  items: PrincipalThreadItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  metrics: {
    totalThreads: number;
    totalMessages: number;
    totalViolations: number;
  };
}

export const principalChatApi = {
  async getOversight(params?: {
    classId?: number;
    subjectId?: number;
    teacherId?: number;
    studentId?: number;
    hasViolationsOnly?: boolean;
    page?: number;
    limit?: number;
  }) {
    const query = new URLSearchParams();
    if (params?.classId) query.set('classId', String(params.classId));
    if (params?.subjectId) query.set('subjectId', String(params.subjectId));
    if (params?.teacherId) query.set('teacherId', String(params.teacherId));
    if (params?.studentId) query.set('studentId', String(params.studentId));
    if (params?.hasViolationsOnly) query.set('hasViolationsOnly', 'true');
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return requestApi<PrincipalOversightData>(`/api/v1/chat/oversight${qs}`);
  },

  async getThreadMessages(threadId: number) {
    return requestApi<{
      thread: PrincipalThreadItem;
      messages: { items: ChatMessageItem[]; pagination: any };
    }>(`/api/v1/chat/threads/${threadId}/messages?limit=100`);
  }
};

