import { requestApi } from './api';

export interface StudentThreadItem {
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
  teacherDesignation: string;
  teacherUserId: number;
  studentName: string;
  studentRollNumber: string;
}

export interface AvailableTeacher {
  classId: number;
  teacherId: number;
  teacherName: string;
  teacherDesignation: string;
  subjectId: number;
  subjectName: string;
  subjectCode: string;
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
}

export const studentChatApi = {
  async getThreads() {
    return requestApi<{
      threads: StudentThreadItem[];
      enrollment: { classId: number; className: string; gradeLevel: number } | null;
      availableTeachers: AvailableTeacher[];
    }>('/api/v1/chat/threads');
  },

  async getMessages(threadId: number, params?: { page?: number; limit?: number }) {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.limit) query.set('limit', String(params.limit));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return requestApi<{
      thread: StudentThreadItem;
      messages: { items: ChatMessageItem[]; pagination: any };
    }>(`/api/v1/chat/threads/${threadId}/messages${qs}`);
  },

  async sendMessage(threadId: number, content: string) {
    return requestApi<{
      message: ChatMessageItem;
      policyWarning: string | null;
    }>(`/api/v1/chat/threads/${threadId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
  },

  async markRead(threadId: number) {
    return requestApi<{ success: boolean }>(`/api/v1/chat/threads/${threadId}/read`, {
      method: 'POST'
    });
  },

  async createThread(payload: { classId: number; subjectId: number; targetTeacherId: number }) {
    return requestApi<StudentThreadItem>('/api/v1/chat/threads', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
};

