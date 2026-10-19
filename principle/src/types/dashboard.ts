export interface DashboardMetrics {
  totalActiveStudents: number;
  activeTeachers: number;
  inactiveTeachers: number;
  todayScheduledLessons: number;
  completedLessonsToday: number;
  cancelledLessonsToday: number;
  missedLessonsToday: number;
  overallAttendancePercentage: number;
  monthlyFeeCollectedAmount: number;
  monthlyFeeTargetAmount: number;
  outstandingArrearsAmount: number;
  pendingPaymentProofsCount: number;
  pendingSalaryDraftsCount: number;
  pendingAttendanceCorrectionsCount: number;
  enrolmentByClass: { classNumber: number; count: number }[];
}
