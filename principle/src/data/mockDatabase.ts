import {
  UserProfile,
  Teacher,
  Student,
  Parent,
  AcademicSession,
  SchoolClass,
  TimetableLesson,
  ClassZoomMeeting,
  LessonAttendanceSummary,
  AttendanceCorrectionRequest,
  ClassFeeStructure,
  StudentConcession,
  MonthlyChallan,
  PaymentProofSubmission,
  TeacherSalaryDraft,
  SchoolNotice,
  OperationalNotification,
  AuditLogEntry,
  AcademicClassPerformance
} from '../types';

export interface SchoolDatabase {
  principalProfile: UserProfile;
  academicSessions: AcademicSession[];
  activeSession: string;
  classes: SchoolClass[];
  teachers: Teacher[];
  students: Student[];
  parents: Parent[];
  zoomMeetings: ClassZoomMeeting[];
  timetableLessons: TimetableLesson[];
  attendanceSummaries: LessonAttendanceSummary[];
  attendanceCorrections: AttendanceCorrectionRequest[];
  feeStructures: ClassFeeStructure[];
  concessions: StudentConcession[];
  challans: MonthlyChallan[];
  paymentProofs: PaymentProofSubmission[];
  salaryDrafts: TeacherSalaryDraft[];
  notices: SchoolNotice[];
  notifications: OperationalNotification[];
  auditLogs: AuditLogEntry[];
  academicPerformances: AcademicClassPerformance[];
}

export const emptyDatabase: SchoolDatabase = {
  principalProfile: {
    id: '141',
    name: 'Prof. Tariq Mahmood',
    email: 'principal@school.pk',
    phone: '+92 300 9876543',
    role: 'Principal',
    designation: 'Principal & Academic Director',
    accountStatus: 'Active',
    lastLogin: new Date().toISOString(),
    joiningDate: '2023-01-01'
  },
  academicSessions: [],
  activeSession: '2026-2027',
  classes: [],
  teachers: [],
  students: [],
  parents: [],
  zoomMeetings: [],
  timetableLessons: [],
  attendanceSummaries: [],
  attendanceCorrections: [],
  feeStructures: [],
  concessions: [],
  challans: [],
  paymentProofs: [],
  salaryDrafts: [],
  notices: [],
  notifications: [],
  auditLogs: [],
  academicPerformances: []
};

export const initialDatabase: SchoolDatabase = emptyDatabase;
