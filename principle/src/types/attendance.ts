export type AttendanceStatus = 'Present' | 'Absent' | 'Late' | 'Leave';

export interface StudentAttendanceRecord {
  studentId: string;
  studentName: string;
  rollNumber: string;
  status: AttendanceStatus;
  markedAt: string;
  markedBy: string; // teacher name
  remarks?: string;
  correctionHistory?: {
    previousStatus: AttendanceStatus;
    newStatus: AttendanceStatus;
    correctedBy: string;
    reason: string;
    timestamp: string;
  }[];
}

export interface AttendanceCorrectionRequest {
  id: string;
  lessonId: string;
  classNumber: number;
  subjectName: string;
  date: string;
  teacherId: string;
  teacherName: string;
  studentId: string;
  studentName: string;
  originalStatus: AttendanceStatus;
  proposedStatus: AttendanceStatus;
  teacherReason: string;
  requestedAt: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  reviewedBy?: string;
  reviewRemarks?: string;
  reviewedAt?: string;
}

export interface LessonAttendanceSummary {
  id: string;
  lessonId: string;
  classNumber: number;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  date: string;
  startTime: string;
  endTime: string;
  enrolledStudentsCount: number;
  submissionStatus: 'Submitted' | 'Missing' | 'Pending Review';
  submittedAt?: string;
  records: StudentAttendanceRecord[];
}
