import { requestApi } from './api';

export interface PerformanceTrendPoint {
  week: string;
  label: string;
  score: number;
  isHighlight?: boolean;
}

export interface UpcomingClassItem {
  id: string;
  classCode: string;
  badgeBg: string;
  badgeColor: string;
  className: string;
  subject: string;
  timeSlot: string;
  status: string;
  room: string;
  zoomRoomId: string;
  zoomPasscode: string;
  joinUrl: string;
}

export interface RecentActivityItem {
  id: string;
  type: 'attendance' | 'assignment' | 'performance' | 'notice';
  title: string;
  time: string;
  color: string;
}

export interface SubjectDistributionItem {
  name: string;
  count: number;
  percentage: number;
  color: string;
}

export interface DutyHoursSummary {
  totalDutyHours: number;
  totalDutyMinutes: number;
  displayDutyHours: string;
  completedLessonsCount: number;
  todayTeachingHours: number;
  todayTeachingMinutes: number;
  trend: string;
}

export interface TeacherDashboardSummary {
  teacher: {
    id: string;
    rawId: number;
    name: string;
    email: string;
    designation: string;
    avatar: string;
    status: string;
  };
  metrics: {
    totalStudents: number;
    totalStudentsTrend: string;
    todaysClassesCount: number;
    todaysClassesCompleted: number;
    todaysClassesTrend: string;
    dutyHours?: DutyHoursSummary;
    pendingTasksCount: number;
    pendingTasksTrend: string;
    classPerformance: number;
    classPerformanceTrend: string;
  };
  performanceOverview: {
    period: 'month' | 'term' | 'week';
    overallPerformance: number;
    performanceDelta: string;
    weeklyTrend: PerformanceTrendPoint[];
  };
  upcomingClasses: UpcomingClassItem[];
  recentActivities: RecentActivityItem[];
  subjectDistribution: {
    totalStudents: number;
    subjects: SubjectDistributionItem[];
  };
}

export async function fetchTeacherDashboardSummary(
  period: 'month' | 'term' | 'week' = 'month'
): Promise<TeacherDashboardSummary> {
  return await requestApi<TeacherDashboardSummary>(`/api/v1/teachers/dashboard-summary?period=${period}`);
}

