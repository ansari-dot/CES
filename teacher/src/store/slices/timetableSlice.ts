import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { TimetableLesson } from '../../types';
import { requestApi } from '../../services/api';
import {
  DEFAULT_SCHOOL_TIMEZONE,
  getBrowserTimeZone,
  isValidTimeZone,
  parseUtcInstant,
  formatTimeInZone,
  dateKeyInZone
} from '../../lib/timezone';

interface TimetableState {
  viewMode: 'agenda' | 'grid';
  currentWeekLabel: string;
  lessons: TimetableLesson[];
  activeLessonModal: TimetableLesson | null;
  activeProblemModalLesson: TimetableLesson | null;
  isLoading: boolean;
  timezone: string;
  timezoneSource: 'ip' | 'browser' | 'fallback';
  schoolTimezone: string;
}

const browserTz = getBrowserTimeZone();

export const detectTeacherTimezoneThunk = createAsyncThunk(
  'timetable/detectTimezone',
  async (_, { rejectWithValue }) => {
    try {
      const data = await requestApi<{ timezone: string; source: 'ip' | 'browser' | 'fallback'; schoolTimezone: string }>(
        `/api/v1/geo/timezone${browserTz ? `?browserTz=${encodeURIComponent(browserTz)}` : ''}`
      );
      if (isValidTimeZone(data?.timezone)) {
        return data;
      }
      return {
        timezone: browserTz || DEFAULT_SCHOOL_TIMEZONE,
        source: browserTz ? ('browser' as const) : ('fallback' as const),
        schoolTimezone: DEFAULT_SCHOOL_TIMEZONE
      };
    } catch {
      return {
        timezone: browserTz || DEFAULT_SCHOOL_TIMEZONE,
        source: browserTz ? ('browser' as const) : ('fallback' as const),
        schoolTimezone: DEFAULT_SCHOOL_TIMEZONE
      };
    }
  }
);

export const fetchTeacherLessonsThunk = createAsyncThunk(
  'timetable/fetchTeacherLessons',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as { timetable: TimetableState };
      const targetTz = state.timetable.timezone || browserTz || DEFAULT_SCHOOL_TIMEZONE;

      // Fetch lessons for a 14-day rolling window
      const today = new Date();
      const startDate = today.toISOString().split('T')[0];
      const endDate = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const data = await requestApi<any[]>(`/api/v1/timetable/my-lessons?startDate=${startDate}&endDate=${endDate}`);

      if (Array.isArray(data) && data.length > 0) {
        return data.map((l: any) => {
          const startInstant = parseUtcInstant(l.startAt || l.start_at);
          const endInstant = parseUtcInstant(l.endAt || l.end_at);

          const startTime = startInstant ? formatTimeInZone(startInstant, targetTz) : '09:00 AM';
          const endTime = endInstant ? formatTimeInZone(endInstant, targetTz) : '09:45 AM';
          const lessonDate = startInstant ? dateKeyInZone(startInstant, targetTz) : (l.lessonDate || startDate);
          const dayOfWeek = startInstant
            ? startInstant.toLocaleDateString('en-US', { weekday: 'long', timeZone: targetTz })
            : 'Monday';

          return {
            id: `LES-${String(l.id).padStart(2, '0')}`,
            rawId: l.id,
            classId: `${l.classNumber}-${(l.subjectCode || 'sub').toLowerCase()}-a`,
            className: l.className,
            subject: l.subjectName,
            topic: l.topicCovered || 'Core Instruction & Practical Exercises',
            date: lessonDate,
            dayOfWeek,
            startTime,
            endTime,
            periodNumber: 1,
            room: `Online Classroom (Class ${l.classNumber})`,
            status: (l.status === 'LIVE'
              ? 'live'
              : l.status === 'COMPLETED'
              ? 'completed'
              : l.status === 'CANCELLED'
              ? 'cancelled'
              : 'scheduled') as any,
            zoomRoomId: l.meetingNumber || '',
            zoomPasscode: `CLASS${l.classNumber}#`,
            deliveryLogged: Boolean(l.deliveryLoggedAt),
            attendanceSubmitted: false,
            notes: l.teachingNotes || ''
          };
        });
      }
      return [];
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch teacher lessons');
    }
  }
);

const initialState: TimetableState = {
  viewMode: 'agenda',
  currentWeekLabel: 'Academic Year 2026–2027',
  lessons: [],
  activeLessonModal: null,
  activeProblemModalLesson: null,
  isLoading: false,
  timezone: browserTz || DEFAULT_SCHOOL_TIMEZONE,
  timezoneSource: browserTz ? 'browser' : 'fallback',
  schoolTimezone: DEFAULT_SCHOOL_TIMEZONE,
};

export const timetableSlice = createSlice({
  name: 'timetable',
  initialState,
  reducers: {
    setViewMode: (state, action: PayloadAction<'agenda' | 'grid'>) => {
      state.viewMode = action.payload;
    },
    setCurrentWeekLabel: (state, action: PayloadAction<string>) => {
      state.currentWeekLabel = action.payload;
    },
    setTimezone: (
      state,
      action: PayloadAction<{ timezone: string; source: 'ip' | 'browser' | 'fallback'; schoolTimezone?: string }>
    ) => {
      state.timezone = action.payload.timezone;
      state.timezoneSource = action.payload.source;
      if (action.payload.schoolTimezone) state.schoolTimezone = action.payload.schoolTimezone;
    },
    openLessonModal: (state, action: PayloadAction<TimetableLesson>) => {
      state.activeLessonModal = action.payload;
    },
    closeLessonModal: (state) => {
      state.activeLessonModal = null;
    },
    openProblemModal: (state, action: PayloadAction<TimetableLesson>) => {
      state.activeProblemModalLesson = action.payload;
    },
    closeProblemModal: (state) => {
      state.activeProblemModalLesson = null;
    },
    markLessonCompleted: (
      state,
      action: PayloadAction<{
        lessonId: string;
        topic: string;
        actualStartTime: string;
        actualEndTime: string;
        notes: string;
        resourceAttachmentUrl?: string;
      }>
    ) => {
      const lesson = state.lessons.find((l) => l.id === action.payload.lessonId);
      if (lesson) {
        lesson.status = 'completed';
        lesson.deliveryLogged = true;
        lesson.topic = action.payload.topic;
        lesson.actualStartTime = action.payload.actualStartTime;
        lesson.actualEndTime = action.payload.actualEndTime;
        lesson.notes = action.payload.notes;
        if (action.payload.resourceAttachmentUrl) {
          lesson.resourceAttachmentUrl = action.payload.resourceAttachmentUrl;
        }
      }
      state.activeLessonModal = null;
    },
    markLessonStarted: (state, action: PayloadAction<string>) => {
      const lesson = state.lessons.find((l) => l.id === action.payload);
      if (lesson) {
        lesson.status = 'started';
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(detectTeacherTimezoneThunk.fulfilled, (state, action) => {
        if (action.payload) {
          state.timezone = action.payload.timezone;
          state.timezoneSource = action.payload.source;
          if (action.payload.schoolTimezone) {
            state.schoolTimezone = action.payload.schoolTimezone;
          }
        }
      })
      .addCase(fetchTeacherLessonsThunk.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchTeacherLessonsThunk.fulfilled, (state, action) => {
        state.isLoading = false;
        if (Array.isArray(action.payload)) {
          state.lessons = action.payload;
        }
      })
      .addCase(fetchTeacherLessonsThunk.rejected, (state) => {
        state.isLoading = false;
      });
  },
});

export const {
  setViewMode,
  setCurrentWeekLabel,
  setTimezone,
  openLessonModal,
  closeLessonModal,
  openProblemModal,
  closeProblemModal,
  markLessonCompleted,
  markLessonStarted,
} = timetableSlice.actions;

export default timetableSlice.reducer;
