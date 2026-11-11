import { requestApi } from './api';

export interface ChatThreadItem {
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
  studentName: string;
  studentRollNumber: string;
  studentUserId: number;
  teacherName: string;
  teacherUserId: number;
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

export interface TaughtSubject {
  classId: number;
  className: string;
  gradeLevel: number;
  subjectId: number;
  subjectName: string;
  subjectCode: string;
}

export interface EnrolledStudent {
  studentId: number;
  rollNumber: string;
  studentName: string;
  studentEmail: string;
  userId: number;
}

export const chatApi = {
  async getThreads(params?: { classId?: number; isArchived?: boolean }) {
    const query = new URLSearchParams();
    if (params?.classId) query.set('classId', String(params.classId));
    if (params?.isArchived !== undefined) query.set('isArchived', String(params.isArchived));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return requestApi<{ threads: ChatThreadItem[]; taughtSubjects: TaughtSubject[] }>(`/api/v1/chat/threads${qs}`);
  },

  async getMessages(threadId: number, params?: { page?: number; limit?: number; beforeId?: number }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.beforeId) query.set('beforeId', String(params.beforeId));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return requestApi<{ thread: ChatThreadItem; messages: { items: ChatMessageItem[]; pagination: any } }>(
      `/api/v1/chat/threads/${threadId}/messages${qs}`
    );
  },

  async sendMessage(threadId: number, content: string) {
    return requestApi<{ message: ChatMessageItem; policyWarning: string | null }>(
      `/api/v1/chat/threads/${threadId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({ content })
      }
    );
  },

  async markRead(threadId: number) {
    return requestApi<{ success: boolean }>(`/api/v1/chat/threads/${threadId}/read`, {
      method: 'POST'
    });
  },

  async getClassStudents(classId: number) {
    return requestApi<EnrolledStudent[]>(`/api/v1/chat/classes/${classId}/students`);
  },

  async createThread(payload: { classId: number; subjectId: number; targetStudentId: number }) {
    return requestApi<ChatThreadItem>('/api/v1/chat/threads', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
};

