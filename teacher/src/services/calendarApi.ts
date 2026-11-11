import { requestApi } from './api';

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

export const teacherCalendarApi = {
  async getActiveAnnouncement(): Promise<HolidayAnnouncementResponse> {
    return requestApi<HolidayAnnouncementResponse>('/api/v1/calendar/active-announcement');
  }
};

