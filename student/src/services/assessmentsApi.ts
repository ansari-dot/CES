import { requestApi } from './api';
import {
  StudentMonthlyTest,
  ExamRoomData,
  SaveDraftPayload,
  StudentTestResult
} from '../types/assessments';

export const studentAssessmentsApi = {
  /**
   * Fetch available, upcoming, and completed monthly tests for the enrolled student
   */
  async getStudentTests(): Promise<{
    availableTests: StudentMonthlyTest[];
    completedTests: StudentMonthlyTest[];
  }> {
    return requestApi<{
      availableTests: StudentMonthlyTest[];
      completedTests: StudentMonthlyTest[];
    }>('/api/v1/assessments/student/available');
  },

  /**
   * Start or resume a test attempt. Returns server-enforced countdown timer and questions (with answers masked).
   */
  async startOrResumeTest(testId: number): Promise<ExamRoomData> {
    return requestApi<ExamRoomData>(`/api/v1/assessments/student/${testId}/start`, {
      method: 'POST'
    });
  },

  /**
   * Save a draft answer (debounced or on option select)
   */
  async saveDraft(attemptId: number, payload: SaveDraftPayload): Promise<{ success: boolean }> {
    return requestApi<{ success: boolean }>(
      `/api/v1/assessments/student/attempts/${attemptId}/save-draft`,
      {
        method: 'PUT',
        body: JSON.stringify(payload)
      }
    );
  },

  /**
   * Final submit of the test attempt (triggered manually or auto-triggered on timer expiration)
   */
  async submitAttempt(attemptId: number): Promise<{
    attempt: any;
    mcqScore: number;
    totalAnswered: number;
  }> {
    return requestApi<{
      attempt: any;
      mcqScore: number;
      totalAnswered: number;
    }>(`/api/v1/assessments/student/attempts/${attemptId}/submit`, {
      method: 'POST'
    });
  },

  /**
   * View test results and question reviews once published by the teacher
   */
  async getTestResult(testId: number): Promise<StudentTestResult> {
    return requestApi<StudentTestResult>(`/api/v1/assessments/student/${testId}/result`);
  },

  /**
   * Fetch live Zoom invigilation session details for active exam
   */
  async getInvigilationSession(testId: number): Promise<{
    testId: number;
    title: string;
    examType: string;
    schedulingMode: string;
    className: string;
    subjectName: string;
    invigilatorName: string;
    meetingId: string;
    joinUrl: string;
    passcode: string;
    topic: string;
    instructions: string;
  }> {
    return requestApi<any>(`/api/v1/assessments/${testId}/invigilation-session`);
  }
};

