import { requestApi } from '../../services/api';

const M = '/api/v1/montessori';
const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
};
const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE';
export type ProgressStatus = 'EXCELLENT' | 'COMPLETED' | 'IMPROVING' | 'NEEDS_PRACTICE' | 'NOT_STARTED';

export interface MSection {
  id: number;
  name: string;
  description: string | null;
  displayOrder: number;
  isActive: boolean;
  sessionId: number;
  sessionName: string;
  studentCount: number;
  classTeacher: { assignmentId: number; teacherId: number; name: string; since: string } | null;
  assistants: { assignmentId: number; teacherId: number; name: string; since: string }[];
}
export interface MTeacher {
  id: number;
  name: string;
  employeeNo: string;
  employmentStatus: string;
  accountStatus: string;
  regularAssignmentCount: number;
  montessoriAssignments: { assignmentId: number; sectionId: number; sectionName: string; role: string; since: string; studentCount: number }[];
}
export interface MAssignment {
  id: number;
  sectionName: string;
  teacherName: string;
  role: string;
  startDate: string;
  endDate: string | null;
  active: boolean;
  endReason: string | null;
  assignedBy: string | null;
  endedBy: string | null;
}
export interface MStudent {
  id: number;
  name: string;
  admissionNo: string;
  rollNo: string | null;
  regularClassName: string | null;
  currentAllocation: { allocationId: number; sectionId: number; sectionName: string } | null;
}
export interface MRosterStudent {
  studentId: number;
  name: string;
  admissionNo: string;
  regularClassName: string | null;
  allocationId: number;
  attendanceId?: number | null;
  status?: AttendanceStatus | null;
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
  sectionName: string;
  activityId: number;
  activityTitle: string;
  learningAreaName: string;
  status: ProgressStatus;
  remarks: string | null;
  improvementSuggestions: string | null;
  observationNotes: string | null;
  completionDate: string | null;
  observedOn: string;
  teacherName: string | null;
  sessionName: string;
  corrected?: boolean;
}
export interface Totals {
  PRESENT: number;
  ABSENT: number;
  LATE: number;
  LEAVE: number;
  total: number;
  attendanceRate?: number | null;
}
type Page<T> = { items: T[]; total: number; page: number; limit: number };

export const montessoriApi = {
  dashboard: () => requestApi<any>(`${M}/dashboard`),
  sections: (includeInactive = false) => requestApi<MSection[]>(`${M}/sections${qs({ includeInactive })}`),
  createSection: (body: { name: string; description?: string }) => requestApi<{ id: number }>(`${M}/sections`, json('POST', body)),
  updateSection: (id: number, body: { name?: string; description?: string | null }) => requestApi(`${M}/sections/${id}`, json('PUT', body)),
  setSectionStatus: (id: number, isActive: boolean) => requestApi(`${M}/sections/${id}/status`, json('PATCH', { isActive })),
  reorderSections: (orderedIds: number[]) => requestApi(`${M}/sections/reorder`, json('PUT', { orderedIds })),
  learningAreas: (includeInactive = false) =>
    requestApi<{ id: number; name: string; description: string | null; isActive: boolean }[]>(`${M}/learning-areas${qs({ includeInactive })}`),
  saveLearningArea: (id: number | null, body: { name?: string; description?: string; isActive?: boolean }) =>
    requestApi(id ? `${M}/learning-areas/${id}` : `${M}/learning-areas`, json(id ? 'PUT' : 'POST', body)),
  teachers: () => requestApi<MTeacher[]>(`${M}/teachers`),
  assignments: (params: { sectionId?: number; teacherId?: number }) => requestApi<MAssignment[]>(`${M}/assignments${qs(params)}`),
  assignTeacher: (sectionId: number, body: { teacherId: number; role: 'CLASS_TEACHER' | 'ASSISTANT'; replaceExisting?: boolean; reason?: string }) =>
    requestApi(`${M}/sections/${sectionId}/assignments`, json('POST', body)),
  endAssignment: (id: number, reason: string) => requestApi(`${M}/assignments/${id}/end`, json('POST', { reason })),
  availableStudents: (params: { search?: string; classId?: number | ''; unallocatedOnly?: boolean; page?: number; limit?: number }) =>
    requestApi<Page<MStudent>>(`${M}/students/available${qs(params)}`),
  allocationHistory: (studentId: number) => requestApi<any[]>(`${M}/students/${studentId}/allocations`),
  allocate: (sectionId: number, studentIds: number[]) => requestApi(`${M}/sections/${sectionId}/allocations`, json('POST', { studentIds })),
  transfer: (studentIds: number[], toSectionId: number, reason: string) => requestApi(`${M}/allocations/transfer`, json('POST', { studentIds, toSectionId, reason })),
  removeAllocation: (allocationId: number, reason: string) => requestApi(`${M}/allocations/${allocationId}/end`, json('POST', { reason })),
  sectionStudents: (sectionId: number) => requestApi<MRosterStudent[]>(`${M}/sections/${sectionId}/students`),
  attendance: (sectionId: number, date: string) =>
    requestApi<{ section: { id: number; name: string }; date: string; isMarked: boolean; canEdit: boolean; students: MRosterStudent[] }>(
      `${M}/sections/${sectionId}/attendance${qs({ date })}`
    ),
  saveAttendance: (sectionId: number, body: { date: string; reason?: string; records: { studentId: number; status: AttendanceStatus; remarks?: string | null }[] }) =>
    requestApi<{ created: number; corrected: number }>(`${M}/sections/${sectionId}/attendance`, json('PUT', body)),
  attendanceReport: (params: { sectionId?: number | ''; studentId?: number | ''; from?: string; to?: string }) =>
    requestApi<{ students: (Totals & { studentId: number; name: string; sectionName: string })[]; days: (Totals & { date: string })[]; totals: Totals }>(
      `${M}/attendance/report${qs(params)}`
    ),
  activities: (params: Record<string, string | number | undefined>) => requestApi<Page<MActivity>>(`${M}/activities${qs(params)}`),
  progress: (params: Record<string, string | number | undefined>) => requestApi<Page<MProgress>>(`${M}/progress${qs(params)}`),
  progressHistory: (id: number) => requestApi<{ id: number; previousValues: any; reason: string; changedBy: string; at: string }[]>(`${M}/progress/${id}/history`),
  sectionReport: (id: number, params: { from?: string; to?: string }) => requestApi<any>(`${M}/reports/sections/${id}${qs(params)}`),
  studentReport: (id: number, params: { from?: string; to?: string }) => requestApi<any>(`${M}/reports/students/${id}${qs(params)}`),
  liveClasses: (params: { scope?: 'upcoming' | 'previous' | 'all'; sectionId?: number | '' }) => requestApi<MLiveClass[]>(`${M}/live-classes${qs(params)}`),
  liveClassOptions: () => requestApi<{ zoomApiConfigured: boolean; timezone: string }>(`${M}/live-classes/options`),
  createLiveClass: (body: MLiveClassInput) => requestApi<MLiveClass>(`${M}/live-classes`, json('POST', body)),
  updateLiveClass: (id: number, body: MLiveClassInput) => requestApi<MLiveClass>(`${M}/live-classes/${id}`, json('PUT', body)),
  cancelLiveClass: (id: number, reason: string) => requestApi<MLiveClass>(`${M}/live-classes/${id}/cancel`, json('POST', { reason }))
};

export type LiveClassState = 'UPCOMING' | 'LIVE' | 'COMPLETED' | 'CANCELLED';
export interface MLiveClass {
  id: number;
  sectionId: number;
  sectionName: string;
  teacherId: number;
  teacherName: string;
  title: string;
  description: string | null;
  date: string;
  startTime: string;
  endTime: string;
  startAt: string;
  endAt: string;
  timezone: string;
  state: LiveClassState;
  joinUrl: string | null;
  passcode: string | null;
  cancelReason: string | null;
  meetingSource: 'MANUAL' | 'ZOOM_API';
  zoomMeetingId: string | null;
}
export interface MLiveClassInput {
  sectionId: number;
  teacherId: number;
  title: string;
  description?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  meetingMode: 'MANUAL' | 'ZOOM_API';
  joinUrl?: string | null;
  passcode?: string | null;
}

export const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = { PRESENT: 'Present', ABSENT: 'Absent', LATE: 'Late', LEAVE: 'Leave' };
export const PROGRESS_LABELS: Record<ProgressStatus, string> = {
  EXCELLENT: 'Excellent',
  COMPLETED: 'Completed',
  IMPROVING: 'Improving',
  NEEDS_PRACTICE: 'Needs Practice',
  NOT_STARTED: 'Not Started'
};
export const PROGRESS_STYLES: Record<ProgressStatus, string> = {
  EXCELLENT: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  COMPLETED: 'bg-sky-50 text-sky-700 border-sky-200',
  IMPROVING: 'bg-amber-50 text-amber-700 border-amber-200',
  NEEDS_PRACTICE: 'bg-rose-50 text-rose-700 border-rose-200',
  NOT_STARTED: 'bg-slate-100 text-slate-600 border-slate-200'
};

export const todayLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
export const fmtDate = (v?: string | null) =>
  v ? new Date(`${String(v).slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
