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
  events?: { id: number; title: string; eventType: string }[];
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

export type CalendarEventType =
  | 'VACATION'
  | 'PUBLIC_HOLIDAY'
  | 'EMERGENCY_CLOSURE'
  | 'SPECIAL_HOLIDAY'
  | 'EXAMINATION'
  | 'SCHOOL_EVENT'
  | 'PARENT_MEETING'
  | 'ANNOUNCEMENT'
  | 'INSTITUTIONAL_BREAK'
  | 'EXAM_PREP';

export type CalendarAudience = 'ALL' | 'STUDENTS' | 'PARENTS' | 'STUDENTS_PARENTS' | 'TEACHERS' | 'STAFF';

export interface CalendarEvent {
  id: number;
  sessionId: number;
  title: string;
  holidayType: string;
  eventType: CalendarEventType;
  isHoliday: boolean;
  startDate: string;
  endDate: string;
  totalDays: number;
  startTime: string | null;
  endTime: string | null;
  description: string | null;
  targetAudience: CalendarAudience;
  classIds: number[];
  affectsAllClasses: boolean;
  isFullDayHoliday: boolean;
  classesSuspended: boolean;
  sendNotification: boolean;
  isPublished: boolean;
  autoCancelledLessonsCount: number;
  createdByName: string;
}

export interface CalendarEventPayload {
  sessionId?: number;
  title: string;
  eventType: CalendarEventType;
  startDate: string;
  endDate: string;
  startTime?: string | null;
  endTime?: string | null;
  description?: string | null;
  targetAudience: CalendarAudience;
  affectsAllClasses: boolean;
  classIds: number[];
  isFullDayHoliday: boolean;
  classesSuspended: boolean;
  sendNotification: boolean;
  isPublished?: boolean;
  confirmConflicts?: boolean;
}

export interface CalendarConflict {
  kind: string;
  id: number;
  title: string;
  reason: string;
  startDate?: string;
  endDate?: string;
  date?: string;
}

export const calendarApi = {
  async getEvents(params: { year?: number; month?: number; startDate?: string; endDate?: string } = {}): Promise<CalendarEvent[]> {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') query.append(k, String(v));
    });
    const qs = query.toString() ? `?${query.toString()}` : '';
    return await requestApi<CalendarEvent[]>(`/api/v1/calendar/events${qs}`);
  },

  async createEvent(payload: CalendarEventPayload): Promise<CalendarEvent & { conflicts: CalendarConflict[] }> {
    return await requestApi(`/api/v1/calendar/events`, { method: 'POST', body: JSON.stringify(payload) });
  },

  async updateEvent(id: number, payload: CalendarEventPayload): Promise<CalendarEvent & { changedFields: string[] }> {
    return await requestApi(`/api/v1/calendar/events/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },

  async deleteEvent(id: number): Promise<{ success: boolean; restoredLessons: number; message: string }> {
    return await requestApi(`/api/v1/calendar/events/${id}`, { method: 'DELETE' });
  },

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

