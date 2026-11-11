import { requestApi } from './api';

export interface AcademicHoliday {
  id: number;
  session_id: number;
  title: string;
  holiday_type: 'PUBLIC_HOLIDAY' | 'VACATION' | 'INSTITUTIONAL_BREAK' | 'EXAM_PREP' | 'EMERGENCY_CLOSURE';
  start_date: string;
  end_date: string;
  description: string | null;
  affects_all_classes: boolean | number;
  auto_cancelled_lessons_count: number;
  created_by: number | null;
  createdByName?: string;
  createdByEmail?: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarDaySummary {
  date: string;
  day: number;
  isHoliday: boolean;
  holidayTitle: string | null;
  holidayType: string | null;
  holidayId: number | null;
  classesOccur: boolean;
  lessonsSummary: {
    scheduledCount: number;
    liveCount: number;
    completedCount: number;
    cancelledCount: number;
    totalLessons: number;
  };
}

export interface CalendarOverviewResponse {
  session: {
    id: number;
    name: string;
    start_date: string;
    end_date: string;
    is_current: number;
    status: string;
  } | null;
  year: number;
  month: number;
  holidays: AcademicHoliday[];
  terms: any[];
  days: CalendarDaySummary[];
}

export interface DeclareHolidayPayload {
  sessionId?: number;
  title: string;
  holidayType: 'PUBLIC_HOLIDAY' | 'VACATION' | 'INSTITUTIONAL_BREAK' | 'EXAM_PREP' | 'EMERGENCY_CLOSURE';
  startDate: string;
  endDate: string;
  description?: string;
  affectsAllClasses?: boolean;
}

export interface ActiveHolidayAnnouncement {
  id: number;
  sessionId: number;
  title: string;
  holidayType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  description: string | null;
  affectsAllClasses: boolean;
  autoCancelledLessonsCount: number;
  createdByName: string;
  isCurrent: boolean;
}

export interface HolidayAnnouncementResponse {
  activeHolidays: ActiveHolidayAnnouncement[];
  popupAnnouncement: ActiveHolidayAnnouncement | null;
  isCurrentlyOnHoliday: boolean;
}

export const calendarApi = {
  async getActiveAnnouncement(): Promise<HolidayAnnouncementResponse> {
    return await requestApi<HolidayAnnouncementResponse>('/api/v1/calendar/active-announcement');
  },

  async getOverview(params?: { sessionId?: number; year?: number; month?: number }): Promise<CalendarOverviewResponse> {
    const query = new URLSearchParams();
    if (params?.sessionId) query.append('sessionId', String(params.sessionId));
    if (params?.year) query.append('year', String(params.year));
    if (params?.month) query.append('month', String(params.month));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return await requestApi<CalendarOverviewResponse>(`/api/v1/calendar/overview${qs}`);
  },

  async getHolidays(params?: { sessionId?: number; year?: number; month?: number }): Promise<AcademicHoliday[]> {
    const query = new URLSearchParams();
    if (params?.sessionId) query.append('sessionId', String(params.sessionId));
    if (params?.year) query.append('year', String(params.year));
    if (params?.month) query.append('month', String(params.month));
    const qs = query.toString() ? `?${query.toString()}` : '';
    return await requestApi<AcademicHoliday[]>(`/api/v1/calendar/holidays${qs}`);
  },

  async declareHoliday(payload: DeclareHolidayPayload): Promise<AcademicHoliday> {
    return await requestApi<AcademicHoliday>('/api/v1/calendar/holidays', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateHoliday(id: number, payload: Partial<DeclareHolidayPayload>): Promise<AcademicHoliday> {
    return await requestApi<AcademicHoliday>(`/api/v1/calendar/holidays/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async deleteHoliday(id: number): Promise<{ success: boolean; message: string }> {
    return await requestApi<{ success: boolean; message: string }>(`/api/v1/calendar/holidays/${id}`, {
      method: 'DELETE'
    });
  }
};

