import { requestApi } from './api';

export interface AdminCertificate {
  id: number;
  certificateNumber: string;
  certificateTitle: string;
  categoryId: number;
  categoryName: string;
  templateName: string;
  achievementTitle: string;
  achievementDescription: string | null;
  remarks: string | null;
  studentId: number;
  studentName: string;
  classId: number;
  className: string;
  subjectName: string | null;
  academicYear: string | null;
  issueDate: string;
  issuedBy: string;
  teacherId: number | null;
  status: 'ACTIVE' | 'REVOKED';
  revokedAt: string | null;
  revokeReason?: string | null;
  pdfUrl: string;
  history?: { action: string; actorName: string; actorRole: string; reason: string | null; at: string }[];
  templateVersion?: number;
}

export interface AdminTemplate {
  id: number;
  categoryId: number;
  categoryName: string;
  categoryActive: boolean;
  name: string;
  certificateTitle: string;
  description: string | null;
  designPreset: 'CLASSIC' | 'MODERN' | 'ELEGANT';
  orientation: 'LANDSCAPE' | 'PORTRAIT';
  pageSize: 'A4' | 'LETTER';
  primaryColor: string;
  accentColor: string;
  bodyText: string;
  showTeacherSignature: boolean;
  showPrincipalSignature: boolean;
  principalName: string | null;
  hasBackground: boolean;
  hasLogo: boolean;
  hasPrincipalSignature: boolean;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  version: number;
  previewUrl: string;
  certificateCount: number;
}

export interface AdminCategory {
  id: number;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  templateCount: number;
  certificateCount: number;
}

export interface CertificateEvent {
  id: number;
  action: string;
  certificateNumber: string | null;
  studentName: string | null;
  templateName: string | null;
  actorName: string;
  actorRole: string | null;
  reason: string | null;
  details: any;
  at: string;
}

const qs = (params: Record<string, string | number | undefined>) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '' && v !== null) q.append(k, String(v));
  });
  return q.toString();
};

export const certificatesAdminApi = {
  issued: (params: Record<string, string | number | undefined>) =>
    requestApi<{ items: AdminCertificate[]; total: number; page: number; limit: number; totalPages: number }>(
      `/api/v1/certificates/issued?${qs(params)}`
    ),
  details: (id: number) => requestApi<AdminCertificate>(`/api/v1/certificates/${id}`),
  revoke: (id: number, reason: string) =>
    requestApi<AdminCertificate>(`/api/v1/certificates/${id}/revoke`, { method: 'POST', body: JSON.stringify({ reason }) }),
  categories: () => requestApi<AdminCategory[]>('/api/v1/certificates/admin/categories'),
  saveCategory: (id: number | null, body: Partial<Pick<AdminCategory, 'name' | 'description' | 'sortOrder' | 'isActive'>>) =>
    requestApi<{ id: number }>(id ? `/api/v1/certificates/admin/categories/${id}` : '/api/v1/certificates/admin/categories', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(body)
    }),
  templates: () => requestApi<AdminTemplate[]>('/api/v1/certificates/admin/templates'),
  saveTemplate: (id: number | null, form: FormData) =>
    requestApi<{ id: number }>(id ? `/api/v1/certificates/admin/templates/${id}` : '/api/v1/certificates/admin/templates', {
      method: id ? 'PUT' : 'POST',
      body: form
    }),
  setTemplateStatus: (id: number, status: AdminTemplate['status']) =>
    requestApi<AdminTemplate>(`/api/v1/certificates/admin/templates/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  events: (params: Record<string, string | number | undefined>) => requestApi<CertificateEvent[]>(`/api/v1/certificates/admin/events?${qs(params)}`),
  teachers: () => requestApi<{ id: number; name: string }[]>('/api/v1/teachers'),
  classes: () => requestApi<{ id: number; name: string }[]>('/api/v1/classes')
};

export const SUPPORTED_PLACEHOLDERS = [
  'student_name',
  'class_name',
  'achievement_title',
  'achievement_description',
  'issue_date',
  'teacher_name',
  'subject_name',
  'academic_year',
  'certificate_id',
  'school_name'
];
