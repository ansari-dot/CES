import { requestApi } from './api';
import { TeacherActiveDateSheetsResponse } from '../types/datesheet';

export const teacherDatesheetsApi = {
  /**
   * Get all active published date sheets & popup announcement scoped to teacher's assigned subjects & classes
   */
  async getActiveDateSheets(): Promise<TeacherActiveDateSheetsResponse> {
    return requestApi<TeacherActiveDateSheetsResponse>('/api/v1/datesheets/teacher/active');
  }
};

