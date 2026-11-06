import { requestApi } from './api';
import {
  ExaminationDateSheet,
  CreateDateSheetPayload,
  ExamType,
  DateSheetStatus
} from '../types/datesheet';

export const datesheetsApi = {
  /**
   * List date sheets with optional filtering
   */
  async getDateSheets(params?: {
    academicSessionId?: number;
    examType?: ExamType;
    status?: DateSheetStatus;
    isPublished?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ dateSheets: ExaminationDateSheet[]; pagination: any }> {
    const query = new URLSearchParams();
    if (params?.academicSessionId) query.append('academicSessionId', String(params.academicSessionId));
    if (params?.examType) query.append('examType', params.examType);
    if (params?.status) query.append('status', params.status);
    if (params?.isPublished !== undefined) query.append('isPublished', String(params.isPublished));
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));

    const qs = query.toString() ? `?${query.toString()}` : '';
    return requestApi<{ dateSheets: ExaminationDateSheet[]; pagination: any }>(`/api/v1/datesheets${qs}`);
  },

  /**
   * Get date sheet by ID with full class schedules
   */
  async getDateSheetById(id: number): Promise<ExaminationDateSheet> {
    return requestApi<ExaminationDateSheet>(`/api/v1/datesheets/${id}`);
  },

  /**
   * Create new date sheet with multi-class entries
   */
  async createDateSheet(payload: CreateDateSheetPayload): Promise<ExaminationDateSheet> {
    return requestApi<ExaminationDateSheet>('/api/v1/datesheets', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  /**
   * Update date sheet and replace schedule entries
   */
  async updateDateSheet(id: number, payload: Partial<CreateDateSheetPayload>): Promise<ExaminationDateSheet> {
    return requestApi<ExaminationDateSheet>(`/api/v1/datesheets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  /**
   * Toggle Publish / Hide status
   */
  async togglePublishStatus(id: number, isPublished: boolean): Promise<ExaminationDateSheet> {
    return requestApi<ExaminationDateSheet>(`/api/v1/datesheets/${id}/publish`, {
      method: 'PATCH',
      body: JSON.stringify({ isPublished })
    });
  },

  /**
   * Delete date sheet
   */
  async deleteDateSheet(id: number): Promise<void> {
    return requestApi<void>(`/api/v1/datesheets/${id}`, {
      method: 'DELETE'
    });
  }
};

