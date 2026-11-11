import { requestApi } from './api';

export interface StudentMistake {
  id: number;
  studentId: number;
  studentName: string;
  admissionNo: string;
  rollNo: string | null;
  classId: number;
  className: string;
  subjectId: number;
  subjectName: string;
  subjectCode: string;
  teacherId: number;
  teacherName: string;
  sessionId: number | null;
  topic: string;
  mistakeType: 'CONCEPTUAL' | 'CALCULATION' | 'CARELESS' | 'INCOMPLETE' | 'FORMAT' | 'OTHER';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  remediationPlan: string | null;
  teacherPrivateNotes: string | null;
  status: 'IDENTIFIED' | 'PRACTICING' | 'RETESTED' | 'RESOLVED';
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMistakePayload {
  studentId: number;
  classId: number;
  subjectId: number;
  topic: string;
  mistakeType?: string;
  severity?: string;
  description: string;
  remediationPlan?: string;
  teacherPrivateNotes?: string;
}

export const mistakesApi = {
  getMistakes: async (filters: {
    studentId?: number;
    classId?: string | number;
    subjectId?: string | number;
    status?: string;
    severity?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ mistakes: StudentMistake[]; total: number; totalPages: number; page: number; limit: number }> => {
    const params = new URLSearchParams();
    if (filters.studentId) params.append('studentId', String(filters.studentId));
    if (filters.classId && filters.classId !== 'ALL') params.append('classId', String(filters.classId));
    if (filters.subjectId && filters.subjectId !== 'ALL') params.append('subjectId', String(filters.subjectId));
    if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
    if (filters.severity && filters.severity !== 'ALL') params.append('severity', filters.severity);
    if (filters.search && filters.search.trim()) params.append('search', filters.search.trim());
    if (filters.page) params.append('page', String(filters.page));
    if (filters.limit) params.append('limit', String(filters.limit));

    const qs = params.toString();
    const endpoint = `/api/v1/tasks/mistakes${qs ? `?${qs}` : ''}`;
    const res = await requestApi<any>(endpoint);
    if (res && res.mistakes) {
      return {
        mistakes: res.mistakes,
        total: Number(res.total ?? res.mistakes.length),
        totalPages: Number(res.totalPages ?? 1),
        page: Number(res.page ?? 1),
        limit: Number(res.limit ?? 10)
      };
    }
    const list = Array.isArray(res) ? res : res?.data || [];
    return {
      mistakes: list,
      total: list.length,
      totalPages: 1,
      page: 1,
      limit: list.length
    };
  },

  recordMistake: async (payload: CreateMistakePayload): Promise<StudentMistake> => {
    const res = await requestApi<any>('/api/v1/tasks/mistakes', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res?.data || res;
  },

  updateMistake: async (
    id: number,
    updates: Partial<CreateMistakePayload & { status: string }>
  ): Promise<StudentMistake> => {
    const res = await requestApi<any>(`/api/v1/tasks/mistakes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return res?.data || res;
  },

  deleteMistake: async (id: number): Promise<{ deleted: boolean }> => {
    return await requestApi<{ deleted: boolean }>(`/api/v1/tasks/mistakes/${id}`, {
      method: 'DELETE',
    });
  },
};

