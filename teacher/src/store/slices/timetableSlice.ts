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
      const [todayRes, lessonsRes, slotsRes] = await Promise.all([
        requestApi<any[]>('/api/v1/zoom/my-class-session').catch(() => []),
        requestApi<any[]>('/api/v1/timetable/lessons').catch(() => []),
        requestApi<any[]>('/api/v1/timetable/slots').catch(() => [])
      ]);

      const daysMap: Record<number, string> = {
        1: 'Monday',
        2: 'Tuesday',
        3: 'Wednesday',
        4: 'Thursday',
        5: 'Friday',
        6: 'Saturday',
        7: 'Sunday'
      };

      const todayList = Array.isArray(todayRes) ? todayRes : [];
      const lessonsList = Array.isArray(lessonsRes) ? lessonsRes : [];
      const slotsList = Array.isArray(slotsRes) ? slotsRes : [];

      const combinedLessons: TimetableLesson[] = [];
      const seenKeys = new Set<string>();

      // 1. Process dated lessons
      const listToProcess = lessonsList.length > 0 ? lessonsList : todayList;
      for (const l of listToProcess) {
        const dateStr = l.lessonDate || (l.startAt ? String(l.startAt).split('T')[0] : new Date().toISOString().split('T')[0]);
        const dObj = new Date(dateStr + 'T12:00:00Z');
        const dayOfWeek = dObj.toLocaleDateString('en-US', { weekday: 'long' });

        const startH = l.startAt ? new Date(l.startAt).getHours() : parseInt(String(l.startTime || '09').substring(0, 2), 10);
        let periodNum = 1;
        if (startH >= 14) periodNum = 4;
        else if (startH >= 13) periodNum = 3;
        else if (startH >= 10) periodNum = 2;

        const key = `${dayOfWeek}-${periodNum}-${l.classId}`;
        seenKeys.add(key);

        combinedLessons.push({
          id: `LES-${String(l.id).padStart(2, '0')}`,
          rawId: l.id,
          classId: `${l.classNumber}-${(l.subjectCode || 'sub').toLowerCase()}-a`,
          className: l.className || `Class ${l.classNumber}`,
          subject: l.subjectName,
          topic: l.topicCovered || 'Core Instruction & Practical Exercises',
          date: dateStr,
          dayOfWeek,
          startTime: l.startAt ? String(l.startAt).substring(11, 16) : '09:00 AM',
          endTime: l.endAt ? String(l.endAt).substring(11, 16) : '09:45 AM',
          periodNumber: periodNum,
          room: `Online Live Classroom (Room ${l.classNumber})`,
          status: (l.status === 'LIVE' ? 'live' : l.status === 'COMPLETED' ? 'completed' : 'scheduled') as any,
          zoomRoomId: l.meetingNumber || `900${l.classNumber}000${l.classNumber}`,
          zoomPasscode: `CLASS${l.classNumber}#`,
          deliveryLogged: Boolean(l.deliveryLoggedAt),
          attendanceSubmitted: false,
          notes: l.teachingNotes || ''
        });
      }

      // 2. Also populate weekly recurring slots so the full weekly matrix is visible
      for (const s of slotsList) {
        const dayOfWeek = daysMap[s.weekday] || 'Monday';
        const startH = parseInt(String(s.startTime).substring(0, 2), 10);
        let periodNum = 1;
        if (startH >= 14) periodNum = 4;
        else if (startH >= 13) periodNum = 3;
        else if (startH >= 10) periodNum = 2;

        const key = `${dayOfWeek}-${periodNum}-${s.classId}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          combinedLessons.push({
            id: `SLOT-${String(s.id).padStart(2, '0')}`,
            rawId: s.id,
            classId: `${s.classNumber}-${(s.subjectCode || 'sub').toLowerCase()}-a`,
            className: s.className || `Class ${s.classNumber}`,
            subject: s.subjectName,
            topic: 'Core Instruction & Practical Exercises',
            date: new Date().toISOString().split('T')[0],
            dayOfWeek,
            startTime: String(s.startTime).substring(0, 5),
            endTime: String(s.endTime).substring(0, 5),
            periodNumber: periodNum,
            room: `Online Live Classroom (Room ${s.classNumber})`,
            status: 'scheduled' as any,
            zoomRoomId: `900${s.classNumber}000${s.classNumber}`,
            zoomPasscode: `CLASS${s.classNumber}#`,
            deliveryLogged: false,
            attendanceSubmitted: false,
            notes: ''
          });
        }
      }

      return combinedLessons;
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
