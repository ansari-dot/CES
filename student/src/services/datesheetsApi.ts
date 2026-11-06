import { requestApi } from './api';
import { StudentActiveDateSheetsResponse } from '../types/datesheet';

export const studentDatesheetsApi = {
  /**
   * Fetch active published date sheets and announcement popup for the student's enrolled class
   */
  async getActiveDateSheets(): Promise<StudentActiveDateSheetsResponse> {
    return requestApi<StudentActiveDateSheetsResponse>('/api/v1/datesheets/student/active');
  }
};

