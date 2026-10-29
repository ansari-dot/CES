export interface ZoomRenewalHistory {
  id: string;
  previousMeetingId: string;
  newMeetingId: string;
  renewedAt: string;
  renewedBy: string;
  reason: string;
}

export interface ClassZoomMeeting {
  id: string;
  classNumber: number; // 1 to 8
  zoomMeetingId: string; // e.g. "892 4810 9921"
  passcode: string;
  joinUrl: string; // student/teacher safe join link
  hostKey?: string; // 6-digit Host Claim PIN
  accountEmail?: string; // Specific Zoom Pro Account identifier
  hostName?: string;
  hostZoomUserId?: string;
  concurrencySlot?: number;
  webhookVerifiedAt?: string;
  lastWebhookEventAt?: string;
  configNotes?: string;
  status: 'Active' | 'Requires Renewal' | 'Reported Failure' | 'Expired';
  createdDate: string;
  lastRenewalDate: string;
  expiryDate: string;
  lastHealthCheckDate: string;
  healthCheckStatus: 'Operational' | 'Degraded' | 'Failed';
  renewalHistory: ZoomRenewalHistory[];
}

export interface AttendanceReviewItem {
  id: number;
  lessonId: number | null;
  zoomMeetingId: string;
  participantName: string;
  participantEmail: string | null;
  role: string;
  verificationStatus: 'REQUIRES_REVIEW' | 'FLAGGED' | 'VERIFIED' | 'REJECTED' | 'UNVERIFIED';
  verificationReason: string;
  identityMethod: string | null;
  joinedAt: string;
  leftAt: string | null;
  durationSeconds: number | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewerName: string | null;
  className: string | null;
  classNumber: number | null;
  subjectName: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  lessonStatus: string | null;
  matchedTeacherName: string | null;
}
