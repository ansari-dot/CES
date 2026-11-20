import { requestApi } from './api';

const M = '/api/v1/montessori';
const qs = (params: Record<string, string | number | undefined | null>) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
};
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export type MAttendance = 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE';
export type MProgressStatus = 'EXCELLENT' | 'COMPLETED' | 'IMPROVING' | 'NEEDS_PRACTICE' | 'NOT_STARTED';

export interface MySection {
  id: number;
  name: string;
  description: string | null;
  sessionName: string;
  role: 'CLASS_TEACHER' | 'ASSISTANT';
  since: string;
  studentCount: number;
  attendanceMarkedToday: boolean;
}
export interface MRosterStudent {
  studentId: number;
  name: string;
  admissionNo: string;
  rollNo: string | null;
  allocationId: number;
  status?: MAttendance | null;
  remarks?: string | null;
  updatedBy?: string | null;
}
export interface MActivity {
  id: number;
  sectionId: number;
  sectionName: string;
  learningAreaId: number;
  learningAreaName: string;
  title: string;
  description: string | null;
  objectives: string | null;
  activityDate: string;
  attachmentUrl: string | null;
  attachmentName: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  teacherName: string | null;
  progressCount?: number;
}
export interface MProgress {
  id: number;
  studentId: number;
  studentName: string;
  activityId: number;
  activityTitle: string;
  learningAreaName: string;
  status: MProgressStatus;
  remarks: string | null;
  improvementSuggestions: string | null;
  observationNotes: string | null;
  completionDate: string | null;
  observedOn: string;
  teacherName: string | null;
  corrected?: boolean;
}
type Page<T> = { items: T[]; total: number; page: number; limit: number };

export const montessoriApi = {
  mySections: () => requestApi<MySection[]>(`${M}/my/sections`),
  students: (sectionId: number) => requestApi<MRosterStudent[]>(`${M}/sections/${sectionId}/students`),
  attendance: (sectionId: number, date: string) =>
    requestApi<{ date: string; isMarked: boolean; canEdit: boolean; students: MRosterStudent[] }>(`${M}/sections/${sectionId}/attendance${qs({ date })}`),
  saveAttendance: (sectionId: number, body: { date: string; reason?: string; records: { studentId: number; status: MAttendance; remarks?: string | null }[] }) =>
    requestApi<{ created: number; corrected: number }>(`${M}/sections/${sectionId}/attendance`, json('PUT', body)),
  learningAreas: () => requestApi<{ id: number; name: string }[]>(`${M}/learning-areas`),
  activities: (params: Record<string, string | number | undefined>) => requestApi<Page<MActivity>>(`${M}/activities${qs(params)}`),
  createActivity: (body: Record<string, unknown>) => requestApi<MActivity>(`${M}/activities`, json('POST', body)),
  updateActivity: (id: number, body: Record<string, unknown>) => requestApi<MActivity>(`${M}/activities/${id}`, json('PUT', body)),
  setActivityStatus: (id: number, status: 'ACTIVE' | 'ARCHIVED') => requestApi<MActivity>(`${M}/activities/${id}/status`, json('PATCH', { status })),
  progress: (params: Record<string, string | number | undefined>) => requestApi<Page<MProgress>>(`${M}/progress${qs(params)}`),
  recordProgress: (body: { activityId: number; observedOn?: string; records: Record<string, unknown>[] }) => requestApi<MProgress[]>(`${M}/progress`, json('POST', body)),
  correctProgress: (id: number, body: Record<string, unknown>) => requestApi<MProgress>(`${M}/progress/${id}`, json('PUT', body)),
  studentReport: (studentId: number) => requestApi<any>(`${M}/reports/students/${studentId}`),
  myLiveClasses: () => requestApi<{ upcoming: MLiveClass[]; previous: MLiveClass[] }>(`${M}/my/live-classes`)
};

export interface MLiveClass {
  id: number;
  sectionId: number;
  sectionName: string;
  teacherName: string;
  title: string;
  description: string | null;
  date: string;
  startTime: string;
  endTime: string;
  timezone: string;
  state: 'UPCOMING' | 'LIVE' | 'COMPLETED' | 'CANCELLED';
  canJoin: boolean;
  joinUrl: string | null;
  passcode: string | null;
  cancelReason: string | null;
}

export const ATTENDANCE_LABELS: Record<MAttendance, string> = { PRESENT: 'Present', ABSENT: 'Absent', LATE: 'Late', LEAVE: 'Leave' };
export const PROGRESS_LABELS: Record<MProgressStatus, string> = {
  EXCELLENT: 'Excellent',
  COMPLETED: 'Completed',
  IMPROVING: 'Improving',
  NEEDS_PRACTICE: 'Needs Practice',
  NOT_STARTED: 'Not Started'
};
export const PROGRESS_STYLES: Record<MProgressStatus, string> = {
  EXCELLENT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  COMPLETED: 'bg-sky-50 text-sky-700 border-sky-200',
  IMPROVING: 'bg-amber-50 text-amber-700 border-amber-200',
  NEEDS_PRACTICE: 'bg-rose-50 text-rose-700 border-rose-200',
  NOT_STARTED: 'bg-slate-100 text-slate-600 border-slate-200'
};
export const todayLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const fmtDate = (v?: string | null) =>
  v ? new Date(`${String(v).slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
