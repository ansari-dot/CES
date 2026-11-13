export type NavTab =
  | 'dashboard'
  | 'timetable'
  | 'live-lessons'
  | 'student-attendance'
  | 'monthly-tests'
  | 'datesheet'
  | 'learning-resources'
  | 'tasks-assignments'
  | 'submissions-grading'
  | 'student-projects'
  | 'student-performance'
  | 'exam-results'
  | 'achievements-feedback'
  | 'notices'
  | 'duty-salary'
  | 'profile-settings'
  | 'student-mistakes'
  | 'student-chat';

export interface AssignedClass {
  id: string;
  classId?: number;
  className?: string;
  name: string;
  grade: number;
  section: string;
  subjectId?: number;
  subject: string;
  subjectCode?: string;
  enrolledCount: number;
  zoomRoomId: string;
  zoomPasscode: string;
  hostKey?: string;
  joinUrl?: string;
  roomName: string;
}

export interface TeacherProfile {
  id: string;
  name: string;
  employeeId: string;
  email: string;
  phone: string;
  designation: string;
  avatar: string;
  term: string;
  timezone: string;
  isDutyClockedIn: boolean;
  assignedClasses: AssignedClass[];
}

export interface Student {
  id: string;
  rollNumber: string;
  admissionId: string;
  name: string;
  avatar: string;
  classId: string;
  streak: string;
  attendanceRate: number;
  isRepresentative?: boolean;
}

export interface TimetableLesson {
  id: string;
  rawId?: number;
  rawClassId?: number;
  classId: string;
  className: string;
  subject: string;
  topic: string;
  date: string; // YYYY-MM-DD
  dayOfWeek: string;
  startTime: string; // e.g. "09:00 AM"
  endTime: string;   // e.g. "09:45 AM"
  periodNumber: number;
  room: string;
  status: 'scheduled' | 'started' | 'live' | 'completed' | 'cancelled' | 'rescheduled';
  zoomRoomId: string;
  zoomPasscode: string;
  hostKey?: string;
  joinUrl?: string;
  sessionState?: string;
  deliveryLogged: boolean;
  attendanceSubmitted: boolean;
  isCompleted?: boolean;
  actualStartTime?: string;
  actualEndTime?: string;
  verifiedDutyMinutes?: number;
  startAt?: string;
  endAt?: string;
  notes?: string;
  resourceAttachmentUrl?: string;
}

export type PeriodType = 'instructional' | 'break' | 'duty' | 'assembly' | 'homeroom';

export interface PeriodInfo {
  id: string;
  periodNumber: number;
  name: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  type: PeriodType;
  bellChime: boolean;
  icon: string;
  color: string;
}

export type DutyType =
  | 'gate_welcome'
  | 'hallway_monitor'
  | 'recess_supervision'
  | 'cafeteria_check'
  | 'lab_safety'
  | 'bus_departure';

export interface TeacherDutyRosterItem {
  id: string;
  dutyType: DutyType;
  dutyName: string;
  zone: string;
  teacherId: string;
  teacherName: string;
  teacherAvatar: string;
  date: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  status: 'upcoming' | 'checked_in' | 'completed' | 'swapped';
  notes?: string;
  icon: string;
  color: string;
}

export interface SchoolClassSession {
  id: string;
  periodId: string;
  periodNumber: number;
  classId: string;
  className: string;
  grade: number;
  section: string;
  subject: string;
  subjectCode: string;
  topic: string;
  teacherId: string;
  teacherName: string;
  teacherAvatar: string;
  roomNumber: string;
  roomType: 'classroom' | 'laboratory' | 'gymnasium' | 'auditorium' | 'virtual_zoom';
  zoomMeetingId?: string;
  zoomPasscode?: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'live' | 'completed' | 'cancelled';
  enrolledStudentsCount: number;
  colorTag: string;
  subjectIcon: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'leave' | 'excused';

export interface AttendanceRecord {
  studentId: string;
  rollNumber: string;
  studentName: string;
  admissionId: string;
  avatar: string;
  status: AttendanceStatus;
  remark: string;
  streak?: string;
  attendanceRate: number;
  isRepresentative?: boolean;
}

export interface AttendanceSubmissionLog {
  id: string;
  lessonId: string;
  className: string;
  subject: string;
  topic: string;
  date: string;
  time: string;
  teacherName: string;
  teacherId: string;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  leaveCount: number;
  totalStudents: number;
  isLocked: boolean;
  submittedAt?: string;
}

export interface CorrectionVoucher {
  id: string;
  targetLogId: string;
  studentId: string;
  studentName: string;
  correctionType: string;
  reason: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface Task {
  id: string;
  title: string;
  instructions: string;
  classId: string;
  className: string;
  subject: string;
  assignedDate: string;
  deadline: string;
  totalMarks: number;
  gradingScale: 'numeric' | 'letter' | 'rubric' | 'passfail';
  status: 'draft' | 'active' | 'archived';
  submittedCount: number;
  totalStudents: number;
  gradedCount: number;
  pendingCount: number;
  lateCount: number;
  missingCount: number;
  handoutName?: string;
  handoutUrl?: string;
  taskType: 'ASSIGNMENT' | 'QUIZ' | 'TEST' | 'EXAM';
  subjectId?: string;
  deadlineRaw?: string;
}

export interface Submission {
  id: string;
  taskId: string;
  taskTitle: string;
  studentId: string;
  studentName: string;
  studentRoll: string;
  studentAdmissionId: string;
  studentAvatar: string;
  submittedAt: string;
  status: 'pending' | 'graded' | 'late' | 'missing' | 'resubmit_requested';
  marksAwarded?: number;
  maxMarks: number;
  fileName?: string;
  fileSize?: string;
  fileUrl?: string;
  studentNotes?: string;
  className?: string;
  isLate?: boolean;
  feedback?: string;
  rubricScores?: {
    accuracy: number;
    steps: number;
    simplification: number;
  };
  attemptNumber: number;
}

export interface ProjectMilestone {
  id: string;
  title: string;
  dueDate: string;
  completed: boolean;
}

export interface StudentProject {
  id: string;
  title: string;
  description: string;
  classId: string;
  className: string;
  subject: string;
  deadline: string;
  progressPercent: number;
  totalGroups: number;
  pendingReviewCount: number;
  status: 'active' | 'completed' | 'draft';
  milestones: ProjectMilestone[];
}

export interface LearningResource {
  id: string;
  title: string;
  description: string;
  classId: string;
  className: string;
  subject: string;
  type: 'pdf' | 'recording' | 'slides' | 'notes' | 'link';
  fileUrl: string;
  fileName?: string;
  fileSize?: string;
  uploadDate: string;
  isPublished: boolean;
}

export interface AcademicNotice {
  id: string;
  title: string;
  content: string;
  author: string;
  date: string;
  targetClassId: string;
  targetClassName: string;
  isUrgent: boolean;
  isPublished: boolean;
  category: string;
  canManage?: boolean;
  recipients?: string;
  status?: string;
  isRead?: boolean;
  publishedAt?: string;
}

export interface AchievementItem {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  badgeType: 'star' | 'medal' | 'trophy' | 'certificate' | 'feedback';
  title: string;
  reason: string;
  awardedDate: string;
  starsCount: number;
  subjectId?: string;
  subjectName?: string;
  visibility?: 'PUBLISHED' | 'INTERNAL';
}

export interface DailyDutyItem {
  date: string;
  dayName: string;
  totalScheduledLessons: number;
  completedLessons: number;
  totalDutyMinutes: number;
  totalDutyHours: number;
  isToday: boolean;
  lessons?: any[];
}

export interface DutySummary {
  payrollPeriod: string;
  scheduledLessonsCount: number;
  completedLessonsCount: number;
  totalDutyHours: number;
  targetDutyHours: number;
  payrollStatus: 'On Track' | 'Pending Review' | 'Adjusted' | 'No Records';
  hourlyRate: string;
  baseSalary?: number;
  salaryModel?: string;
  perLessonRate?: number;
  perHourRate?: number;
  liveDutyHours?: number;
  activeLiveCount?: number;
  todayTeachingHours?: number;
  todayTeachingMinutes?: number;
  todayCompletedCount?: number;
  todayScheduledCount?: number;
}

export interface DutyLogItem {
  id: string;
  date: string;
  lessonId: string;
  className: string;
  subject: string;
  scheduledTime: string;
  durationMinutes: number;
  scheduledMinutes?: number;
  status: 'verified' | 'pending' | 'disputed' | 'unverified' | 'flagged' | 'live';
  verificationStatus?: 'VERIFIED' | 'UNVERIFIED' | 'FLAGGED' | 'REQUIRES_REVIEW' | 'REJECTED' | 'ABSENT' | 'LIVE';
  verificationReason?: string;
  isLive?: boolean;
  actualJoinTime?: string;
  actualLeaveTime?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'timetable' | 'attendance' | 'grading' | 'administrative' | 'zoom';
  timestamp: string;
  read: boolean;
  targetTab?: NavTab;
  category?: string;
  timeAgo?: string;
  // raw values used for sidebar activity counters
  rawType?: string;
  recordType?: string;
  createdAt?: string;
}

export interface ToastState {
  id: string;
  title?: string;
  message: string;
  type: 'success' | 'error' | 'info';
}
