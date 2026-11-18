import { requestApi, requestBlob } from './api';

export interface CertificateTemplate {
  id: number;
  categoryId: number;
  categoryName: string;
  name: string;
  certificateTitle: string;
  description: string | null;
  designPreset: 'CLASSIC' | 'MODERN' | 'ELEGANT';
  orientation: 'LANDSCAPE' | 'PORTRAIT';
  pageSize: 'A4' | 'LETTER';
  primaryColor: string;
  accentColor: string;
  previewUrl: string;
}

export interface CertificateCategory {
  id: number;
  name: string;
  description: string | null;
  templates: CertificateTemplate[];
}

export interface RecipientData {
  classes: { id: number; name: string }[];
  academicSessions: { id: number; name: string; isCurrent: boolean }[];
  students: { id: number; name: string; rollNo: string | null; admissionNo: string }[];
  subjects: { id: number; name: string }[];
}

export interface IssuedCertificate {
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
  status: 'ACTIVE' | 'REVOKED';
  revokedAt: string | null;
  revokeReason?: string | null;
  pdfUrl: string;
}

export interface CertificateFields {
  achievementTitle: string;
  achievementDescription?: string;
  remarks?: string;
  subjectId?: number | null;
  academicSessionId?: number | null;
  issueDate: string;
}

export interface IssuePayload extends CertificateFields {
  templateId: number;
  classId: number;
  mode: 'SELECTED' | 'CLASS';
  studentIds: number[];
  idempotencyKey: string;
}

export const certificatesApi = {
  catalog: () => requestApi<CertificateCategory[]>('/api/v1/certificates/catalog'),
  recipients: (classId?: number) =>
    requestApi<RecipientData>(`/api/v1/certificates/recipients${classId ? `?classId=${classId}` : ''}`),
  templatePreview: (templateId: number) => requestBlob(`/api/v1/certificates/templates/${templateId}/preview`),
  personalizedPreview: (payload: CertificateFields & { templateId: number; classId: number; studentId?: number }) =>
    requestBlob('/api/v1/certificates/preview', { method: 'POST', body: JSON.stringify(payload) }),
  issue: (payload: IssuePayload) =>
    requestApi<{ batchId: number; replayed: boolean; issuedCount: number; certificates: IssuedCertificate[] }>(
      '/api/v1/certificates/issue',
      { method: 'POST', body: JSON.stringify(payload) }
    ),
  issued: (params: Record<string, string | number | undefined>) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '' && v !== null) qs.append(k, String(v));
    });
    return requestApi<{ items: IssuedCertificate[]; total: number; page: number; limit: number; totalPages: number }>(
      `/api/v1/certificates/issued?${qs.toString()}`
    );
  },
  pdf: (id: number) => requestBlob(`/api/v1/certificates/${id}/pdf`)
};

export function newRequestKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }
}

/** Save a PDF blob with a file name. */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
