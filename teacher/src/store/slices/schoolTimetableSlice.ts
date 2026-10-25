import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import {
  PeriodInfo,
  TeacherDutyRosterItem,
  SchoolClassSession,
} from '../../types';
import { requestApi } from '../../services/api';

export interface SchoolTimetableState {
  isLoading: boolean;
  lastFetchedAt: string | null;
  activeDay: string;
  activeViewTab: 'sessions' | 'duty_roster' | 'bell_schedule' | 'weekly_matrix';
  selectedGrade: number | 'all';
  selectedPeriodId: string | 'all';
  dutyFilterStatus: 'all' | 'upcoming' | 'checked_in' | 'completed';
  periods: PeriodInfo[];
  sessions: SchoolClassSession[];
  dutyRosters: TeacherDutyRosterItem[];
  currentLivePeriodId: string | null;
}

const initialPeriods: PeriodInfo[] = [
  {
    id: 'P-0',
    periodNumber: 0,
    name: 'Morning Homeroom & Attendance',
    startTime: '08:15 AM',
    endTime: '08:50 AM',
    durationMinutes: 35,
    type: 'homeroom',
    bellChime: true,
    icon: 'meeting_room',
    color: '#6366f1',
  },
  {
    id: 'P-1',
    periodNumber: 1,
    name: 'Period 1 • Core Instruction',
    startTime: '09:00 AM',
    endTime: '09:45 AM',
    durationMinutes: 45,
    type: 'instructional',
    bellChime: true,
    icon: 'calculate',
    color: '#3525cd',
  },
  {
    id: 'P-BREAK-1',
    periodNumber: 0,
    name: 'Morning Nutrition & Recess',
    startTime: '09:45 AM',
    endTime: '10:15 AM',
    durationMinutes: 30,
    type: 'break',
    bellChime: true,
    icon: 'bakery_dining',
    color: '#d97706',
  },
  {
    id: 'P-2',
    periodNumber: 2,
    name: 'Period 2 • Science & Discovery',
    startTime: '10:30 AM',
    endTime: '11:15 AM',
    durationMinutes: 45,
    type: 'instructional',
    bellChime: true,
    icon: 'science',
    color: '#059669',
  },
  {
    id: 'P-LUNCH',
    periodNumber: 0,
    name: 'Midday Lunch & Recreation',
    startTime: '11:15 AM',
    endTime: '12:15 PM',
    durationMinutes: 60,
    type: 'break',
    bellChime: true,
    icon: 'restaurant',
    color: '#ea580c',
  },
  {
    id: 'P-3',
    periodNumber: 3,
    name: 'Period 3 • Applied STEM & Math',
    startTime: '01:00 PM',
    endTime: '01:45 PM',
    durationMinutes: 45,
    type: 'instructional',
    bellChime: true,
    icon: 'memory',
    color: '#2563eb',
  },
  {
    id: 'P-4',
    periodNumber: 4,
    name: 'Period 4 • Experiments & Lab Practicals',
    startTime: '02:15 PM',
    endTime: '03:00 PM',
    durationMinutes: 45,
    type: 'instructional',
    bellChime: true,
    icon: 'biotech',
    color: '#7c3aed',
  },
  {
    id: 'P-DUTY-DISMISSAL',
    periodNumber: 5,
    name: 'Campus Dismissal & Bus Lane Departure',
    startTime: '03:00 PM',
    endTime: '03:30 PM',
    durationMinutes: 30,
    type: 'duty',
    bellChime: true,
    icon: 'directions_bus',
    color: '#0284c7',
  },
];

const initialSessions: SchoolClassSession[] = [];
const initialDutyRosters: TeacherDutyRosterItem[] = [];

const initialState: SchoolTimetableState = {
  isLoading: false,
  lastFetchedAt: null,
  activeDay: 'Wednesday',
  activeViewTab: 'sessions',
  selectedGrade: 'all',
  selectedPeriodId: 'all',
  dutyFilterStatus: 'all',
  periods: initialPeriods,
  sessions: initialSessions,
  dutyRosters: initialDutyRosters,
  currentLivePeriodId: null,
};

export const fetchSchoolTimetable = createAsyncThunk(
  'schoolTimetable/fetchSchoolTimetable',
  async (_, { getState, rejectWithValue }) => {
    try {
      const data = await requestApi<any[]>('/api/v1/timetable/slots');
      const daysMap: Record<number, string> = {
        1: 'Monday',
        2: 'Tuesday',
        3: 'Wednesday',
        4: 'Thursday',
        5: 'Friday',
        6: 'Saturday',
        7: 'Sunday'
      };

      const sessions: SchoolClassSession[] = Array.isArray(data)
        ? data.map((s: any) => {
            const startH = parseInt(String(s.startTime).substring(0, 2), 10);
            let periodNum = 1;
            if (startH >= 14) periodNum = 4;
            else if (startH >= 13) periodNum = 3;
            else if (startH >= 10) periodNum = 2;

            return {
              id: `SLOT-${s.id}`,
              periodId: `P-${periodNum}`,
              periodNumber: periodNum,
              classId: String(s.classId),
              className: s.className || `Class ${s.classNumber}`,
              grade: Number(s.classNumber),
              section: 'A',
              subject: s.subjectName,
              subjectCode: s.subjectCode || 'SUB',
              topic: 'Core Instruction & Live Lesson',
              teacherId: String(s.teacherId),
              teacherName: s.teacherName,
              teacherAvatar: '',
              roomNumber: `Online Live Classroom (Room ${s.classNumber})`,
              roomType: 'virtual_zoom',
              zoomMeetingId: s.zoomMeetingId || `900${s.classNumber}000${s.classNumber}`,
              zoomPasscode: s.zoomPasscode || `CLASS${s.classNumber}#`,
              dayOfWeek: daysMap[s.weekday] || 'Monday',
              startTime: String(s.startTime).substring(0, 5),
              endTime: String(s.endTime).substring(0, 5),
              status: 'scheduled',
              enrolledStudentsCount: 25,
              colorTag: '#3525cd',
              subjectIcon: 'school'
            };
          })
        : [];

      return {
        sessions,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to load school timetable state.');
    }
  }
);

export const schoolTimetableSlice = createSlice({
  name: 'schoolTimetable',
  initialState,
  reducers: {
    setActiveDay: (state, action: PayloadAction<string>) => {
      state.activeDay = action.payload;
    },
    setActiveViewTab: (
      state,
      action: PayloadAction<'sessions' | 'duty_roster' | 'bell_schedule' | 'weekly_matrix'>
    ) => {
      state.activeViewTab = action.payload;
    },
    setSelectedGrade: (state, action: PayloadAction<number | 'all'>) => {
      state.selectedGrade = action.payload;
    },
    setSelectedPeriodId: (state, action: PayloadAction<string | 'all'>) => {
      state.selectedPeriodId = action.payload;
    },
    setDutyFilterStatus: (
      state,
      action: PayloadAction<'all' | 'upcoming' | 'checked_in' | 'completed'>
    ) => {
      state.dutyFilterStatus = action.payload;
    },
    updateDutyStatus: (
      state,
      action: PayloadAction<{
        dutyId: string;
        status: 'upcoming' | 'checked_in' | 'completed' | 'swapped';
      }>
    ) => {
      const duty = state.dutyRosters.find((d) => d.id === action.payload.dutyId);
      if (duty) {
        duty.status = action.payload.status;
      }
    },
    toggleSessionLive: (state, action: PayloadAction<string>) => {
      const session = state.sessions.find((s) => s.id === action.payload);
      if (session) {
        session.status = session.status === 'live' ? 'completed' : 'live';
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSchoolTimetable.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchSchoolTimetable.fulfilled, (state, action) => {
        state.isLoading = false;
        const payload = action.payload as any;
        state.lastFetchedAt = `Today at ${payload?.timestamp || ''}`;
        if (Array.isArray(payload?.sessions)) {
          state.sessions = payload.sessions;
        }
      })
      .addCase(fetchSchoolTimetable.rejected, (state) => {
        state.isLoading = false;
      });
  },
});

export const {
  setActiveDay,
  setActiveViewTab,
  setSelectedGrade,
  setSelectedPeriodId,
  setDutyFilterStatus,
  updateDutyStatus,
  toggleSessionLive,
} = schoolTimetableSlice.actions;

export default schoolTimetableSlice.reducer;
