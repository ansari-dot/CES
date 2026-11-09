import { requestApi } from './api';
import {
  MonthlyTest,
  CreateTestPayload,
  SubmissionRosterItem,
  StudentAttemptDetail,
  GradeSubmissionPayload,
  TestStatus,
  ExamType
} from '../types/assessments';

export const assessmentsApi = {
  /**
   * List monthly tests for the authenticated teacher
   */
  async getTests(params?: {
    classId?: number;
    subjectId?: number;
    status?: TestStatus;
    examType?: ExamType;
    page?: number;
    limit?: number;
  }): Promise<{ tests: MonthlyTest[]; pagination: any }> {
    const query = new URLSearchParams();
    if (params?.classId) query.append('classId', String(params.classId));
    if (params?.subjectId) query.append('subjectId', String(params.subjectId));
    if (params?.status) query.append('status', params.status);
    if (params?.examType) query.append('examType', params.examType);
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));

    const qs = query.toString() ? `?${query.toString()}` : '';
    return requestApi<{ tests: MonthlyTest[]; pagination: any }>(`/api/v1/assessments${qs}`);
  },

  /**
   * Get single test with its question bank
   */
  async getTestById(testId: number): Promise<{ test: MonthlyTest; questions: any[] }> {
    return requestApi<{ test: MonthlyTest; questions: any[] }>(`/api/v1/assessments/${testId}`);
  },

  /**
   * Create a new monthly test with questions
   */
  async createTest(payload: CreateTestPayload): Promise<{ test: MonthlyTest; questionCount: number }> {
    return requestApi<{ test: MonthlyTest; questionCount: number }>('/api/v1/assessments', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  /**
   * Transition test status (e.g. DRAFT -> PUBLISHED, PUBLISHED -> CLOSED, etc.)
   */
  async updateTestStatus(testId: number, status: TestStatus): Promise<{ test: MonthlyTest }> {
    return requestApi<{ test: MonthlyTest }>(`/api/v1/assessments/${testId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  /**
   * Fetch submissions roster for a specific monthly test
   */
  async getTestSubmissions(testId: number): Promise<{
    test: MonthlyTest;
    submissions: SubmissionRosterItem[];
    rosterSummary: { totalEnrolled: number; totalSubmitted: number; totalGraded: number };
  }> {
    return requestApi<{
      test: MonthlyTest;
      submissions: SubmissionRosterItem[];
      rosterSummary: { totalEnrolled: number; totalSubmitted: number; totalGraded: number };
    }>(`/api/v1/assessments/${testId}/submissions`);
  },

  /**
   * Fetch student attempt details and answers for grading
   */
  async getAttemptDetail(testId: number, attemptId: number): Promise<StudentAttemptDetail> {
    return requestApi<StudentAttemptDetail>(`/api/v1/assessments/${testId}/submissions/${attemptId}`);
  },

  /**
   * Submit subjective marks and feedback for a student attempt
   */
  async submitGrades(
    testId: number,
    attemptId: number,
    payload: GradeSubmissionPayload
  ): Promise<{ attempt: any }> {
    return requestApi<{ attempt: any }>(`/api/v1/assessments/${testId}/submissions/${attemptId}/grade`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  /**
   * Publish results for the entire test
   */
  async publishResults(testId: number): Promise<{ test: MonthlyTest; publishedCount: number }> {
    return requestApi<{ test: MonthlyTest; publishedCount: number }>(`/api/v1/assessments/${testId}/publish-results`, {
      method: 'POST'
    });
  },

  /**
   * Launch authorized Zoom invigilation session for assigned exam
   */
  async startInvigilation(testId: number): Promise<{
    testId: number;
    title: string;
    meetingId: string;
    launchUrl: string;
    hostKey?: string;
    sessionStartedAt: string;
    dutySessionId: number;
    role: string;
  }> {
    return requestApi<any>(`/api/v1/assessments/${testId}/start-invigilation`, {
      method: 'POST'
    });
  },

  /**
   * Send performance alert emails & notifications to parents of students
   * who scored low or failed this monthly test.
   */
  async notifyLowPerformers(
    testId: number,
    options?: { thresholdPercentage?: number; customNote?: string; force?: boolean }
  ): Promise<{
    success: boolean;
    totalEvaluated: number;
    lowPerformersCount: number;
    alertsSent: number;
    message: string;
  }> {
    return requestApi<any>(`/api/v1/assessments/${testId}/notify-low-performers`, {
      method: 'POST',
      body: JSON.stringify(options || {})
    });
  },

  /**
   * Send performance alert email & notification to the parent of a single student attempt
   */
  async notifyAttemptParent(
    testId: number,
    attemptId: number,
    options?: { customNote?: string }
  ): Promise<{
    success: boolean;
    alertsSent: number;
    message: string;
  }> {
    return requestApi<any>(`/api/v1/assessments/${testId}/attempts/${attemptId}/notify-parent`, {
      method: 'POST',
      body: JSON.stringify(options || {})
    });
  }
};

