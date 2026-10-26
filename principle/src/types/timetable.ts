export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';

export type LessonStatus = 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled' | 'Rescheduled' | 'Missed';

export type PublicationStatus = 'Draft' | 'Published';

export interface LessonHistoryEntry {
  id: string;
  lessonId: string;
  timestamp: string;
  changedBy: string;
  changeType: 'Created' | 'Rescheduled' | 'Teacher Changed' | 'Cancelled' | 'Published' | 'Unpublished';
  reason: string;
  previousDetails?: {
    day?: DayOfWeek;
    startTime?: string;
    endTime?: string;
    teacherId?: string;
    teacherName?: string;
  };
  newDetails?: {
    day?: DayOfWeek;
    startTime?: string;
    endTime?: string;
    teacherId?: string;
    teacherName?: string;
  };
}

export interface TimetableLesson {
  id: string;
  classNumber: number; // 1 to 8
  subjectId: string;
  subjectName: string;
  teacherId: string;
  teacherName: string;
  dayOfWeek: DayOfWeek;
  startTime: string; // "09:00"
  endTime: string; // "09:45"
  timezone: string; // "Asia/Karachi"
  academicSession: string;
  publicationStatus: PublicationStatus;
  lessonStatus: LessonStatus;
  zoomMeetingId: string;
  cancellationReason?: string;
  history: LessonHistoryEntry[];
}
