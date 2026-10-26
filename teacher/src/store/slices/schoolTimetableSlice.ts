import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import {
  PeriodInfo,
  TeacherDutyRosterItem,
  SchoolClassSession,
} from '../../types';
import { requestApi } from '../../services/api';
import {
  DEFAULT_SCHOOL_TIMEZONE,
  getBrowserTimeZone,
  convertRecurringSlotToZoned,
} from '../../lib/timezone';

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

const initialPeriods: PeriodInfo[] = [];
const initialSessions: SchoolClassSession[] = [];
const initialDutyRosters: TeacherDutyRosterItem[] = [];

const initialState: SchoolTimetableState = {
  isLoading: false,
  lastFetchedAt: null,
  activeDay: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
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
      const state = getState() as any;
      const teacherTz = state.timetable?.timezone || getBrowserTimeZone() || DEFAULT_SCHOOL_TIMEZONE;
      const schoolTz = state.timetable?.schoolTimezone || DEFAULT_SCHOOL_TIMEZONE;

      const data = await requestApi<any[]>('/api/v1/timetable/my-slots');

      // Convert slots from school timezone to teacher's local timezone
      const zonedSlots = Array.isArray(data)
        ? data.map((s: any) => {
            const zoned = convertRecurringSlotToZoned(
              { weekday: s.weekday, startTime: s.startTime, endTime: s.endTime },
              schoolTz,
              teacherTz
            );
            return {
              ...s,
              dayOfWeek: zoned.dayOfWeek,
              startTime: zoned.startTime,
              endTime: zoned.endTime
            };
          })
        : [];

      const periods: PeriodInfo[] = [];
      const seenTimes = new Set<string>();
      let pIdx = 1;
      const sortedSlots = [...zonedSlots].sort((a: any, b: any) =>
        String(a.startTime).localeCompare(String(b.startTime))
      );

      for (const s of sortedSlots) {
        const timeKey = `${String(s.startTime).substring(0, 5)}-${String(s.endTime).substring(0, 5)}`;
        if (!seenTimes.has(timeKey)) {
          seenTimes.add(timeKey);
          const sTime = String(s.startTime).substring(0, 5);
          const eTime = String(s.endTime).substring(0, 5);
          const [sh, sm] = sTime.split(':').map(Number);
          const [eh, em] = eTime.split(':').map(Number);
          const dur = (eh * 60 + em) - (sh * 60 + sm);

          periods.push({
            id: `P-${pIdx}`,
            periodNumber: pIdx,
            name: `Period ${pIdx} • ${s.className || `Class ${s.classNumber}`} (${s.subjectName})`,
            startTime: sTime,
            endTime: eTime,
            durationMinutes: dur > 0 ? dur : 45,
            type: 'instructional',
            bellChime: true,
            icon: 'school',
            color: '#3525cd',
          });
          pIdx++;
        }
      }

      const sessions: SchoolClassSession[] = zonedSlots.map((s: any) => {
        const sTime = String(s.startTime).substring(0, 5);
        const matchingPeriod = periods.find((p) => p.startTime === sTime);
        const periodNum = matchingPeriod ? matchingPeriod.periodNumber : 1;

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
          teacherName: s.teacherName || 'Assigned Faculty',
          teacherAvatar: '',
          roomNumber: `Online Live Classroom (Room ${s.classNumber})`,
          roomType: 'virtual_zoom',
          zoomMeetingId: s.zoomMeetingId || `900${s.classNumber}000${s.classNumber}`,
          zoomPasscode: s.zoomPasscode || `CLASS${s.classNumber}#`,
          dayOfWeek: s.dayOfWeek || 'Monday',
          startTime: String(s.startTime).substring(0, 5),
          endTime: String(s.endTime).substring(0, 5),
          status: 'scheduled',
          enrolledStudentsCount: 25,
          colorTag: '#3525cd',
          subjectIcon: 'school'
        };
      });

      return {
        sessions,
        periods,
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
        if (Array.isArray(payload?.periods)) {
          state.periods = payload.periods;
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
