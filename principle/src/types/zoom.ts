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
  configNotes?: string;
  status: 'Active' | 'Requires Renewal' | 'Reported Failure' | 'Expired';
  createdDate: string;
  lastRenewalDate: string;
  expiryDate: string;
  lastHealthCheckDate: string;
  healthCheckStatus: 'Operational' | 'Degraded' | 'Failed';
  renewalHistory: ZoomRenewalHistory[];
}
