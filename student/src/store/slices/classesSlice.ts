import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { requestApi } from '../../services/api';
import {
  DEFAULT_SCHOOL_TIMEZONE,
  getBrowserTimeZone,
  parseUtcInstant,
  schoolWallTimeToDate,
  formatTimeInZone,
  dateKeyInZone,
  dayLabelFromKey,
} from '../../lib/timezone';

export interface NextClass {
  id: string;
  subject: string;
  topic: string;
  teacher: string;
  grade: string;
  className?: string;
  duration: string;
  time: string;
  timeEnd: string;
  startsInMinutes: number;
  secondsLeft: number;
  zoomLink: string;
  joinUrl?: string;
  passcode?: string;
  meetingId?: string;
  sessionState?: string;
  statusMessage?: string;
  lessonId?: number;
  isLiveNow: boolean;
}

export interface TodayClass {
  id: string;
  time: string;
  endTime: string;
  subject: string;
  topic: string;
  teacher: string;
  duration: string;
  status: string;
  sessionState?: string;
  joinable: boolean;
  lessonId?: number;
  zoomLink?: string;
  passcode?: string;
  meetingId?: string;
}

export interface TimetableLesson {
  id: string;
  time: string;
  subject: string;
  topic: string;
  teacher: string;
  joinableAt?: string;
  status: string;
  border?: string;
  lessonId?: number;
}

export interface CompletedLesson {
  id: string;
  subject: string;
  topic: string;
  teacher: string;
  time: string;
  status: string;
  hasNotes: boolean;
}

export interface TimetableDay {
  key: string; // local date "YYYY-MM-DD" in the student's timezone
  label: string; // "Mon 19"
}

export type TimezoneSource = 'ip' | 'browser' | 'fallback';

interface ClassesState {
  nextClass: NextClass;
  todayClasses: TodayClass[];
  // Keyed by local date "YYYY-MM-DD" in the student's timezone
  weeklyTimetable: Record<string, TimetableLesson[]>;
  timetableDays: TimetableDay[];
  recentlyCompleted: CompletedLesson[];
  zoomSession: {
    joinUrl: string | null;
    passcode: string | null;
    meetingId?: string | null;
    sessionState?: string | null;
    statusMessage?: string | null;
    inWindow: boolean;
    canJoin?: boolean;
  } | null;
  loading: boolean;
  // Lessons exactly as returned by the API (authoritative, never modified)
  rawLessons: any[];
  timezone: string;
  timezoneSource: TimezoneSource;
  schoolTimezone: string;
}

const defaultNextClass: NextClass = {
  id: '',
  subject: '',
  topic: '',
  teacher: '',
  grade: '',
  duration: '45 min',
  time: '',
  timeEnd: '',
  startsInMinutes: 0,
  secondsLeft: 0,
  zoomLink: '',
  isLiveNow: false,
};

const browserTz = getBrowserTimeZone();

const initialState: ClassesState = {
  nextClass: defaultNextClass,
  todayClasses: [],
  weeklyTimetable: {},
  timetableDays: [],
  recentlyCompleted: [],
  zoomSession: null,
  loading: false,
  rawLessons: [],
  timezone: browserTz || DEFAULT_SCHOOL_TIMEZONE,
  timezoneSource: browserTz ? 'browser' : 'fallback',
  schoolTimezone: DEFAULT_SCHOOL_TIMEZONE,
};

const BORDERS = ['border-primary', 'border-success', 'border-warning', 'border-info'];

function durationLabel(start: Date | null, end: Date | null): string {
  if (!start || !end) return '45 min';
  const mins = Math.round((end.getTime() - start.getTime()) / 60000);
  return mins > 0 ? `${mins} min` : '45 min';
}

/**
 * Re-derive every timetable view from the raw lessons for the given timezone.
 * Lessons are placed on the student's local calendar date, which may differ
 * from the school date when conversion crosses midnight.
 */
function deriveSchedule(state: ClassesState) {
  const tz = state.timezone;
  const schoolTz = state.schoolTimezone;
  const now = Date.now();
  const todayKey = dateKeyInZone(new Date(now), tz);

  const lessons = state.rawLessons
    .map((l) => {
      const start = parseUtcInstant(l.startAt || l.start_at) || schoolWallTimeToDate(l.startAt || l.start_at || '', schoolTz);
      const end = parseUtcInstant(l.endAt || l.end_at) || schoolWallTimeToDate(l.endAt || l.end_at || '', schoolTz);
      return { l, start, end };
    })
    .filter((x): x is { l: any; start: Date; end: Date } => Boolean(x.start && x.end))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const fmt = (d: Date | null) => (d ? formatTimeInZone(d, tz) : '');
  const minutesUntil = (d: Date | null) => (d ? Math.round((d.getTime() - now) / 60000) : 999);

  const todayLessons = lessons.filter((x) => dateKeyInZone(x.start!, tz) === todayKey);

  state.todayClasses = todayLessons.map(({ l, start, end }) => {
    const mins = minutesUntil(start);
    return {
      id: String(l.id),
      lessonId: l.id,
      time: fmt(start),
      endTime: fmt(end),
      subject: l.subjectName || '',
      topic: l.topicCovered || '',
      teacher: l.teacherName || '',
      duration: durationLabel(start, end),
      status: l.status === 'LIVE' ? 'Live' : l.status === 'COMPLETED' ? 'Completed' : 'Upcoming',
      sessionState: l.sessionState,
      joinable: l.status === 'LIVE' || (mins >= -5 && mins <= 10),
      zoomLink: l.zoomJoinUrl || l.joinUrl,
      passcode: l.zoomPasscode || l.passcode,
      meetingId: l.zoomRoomId || l.meetingNumber,
    };
  });

  const upcoming = todayLessons.find(
    ({ l, start }) => l.status !== 'COMPLETED' && l.status !== 'CANCELLED' && minutesUntil(start) >= -15
  );
  if (upcoming) {
    const mins = minutesUntil(upcoming.start);
    state.nextClass = {
      ...state.nextClass,
      id: String(upcoming.l.id),
      lessonId: upcoming.l.id,
      subject: upcoming.l.subjectName || '',
      topic: upcoming.l.topicCovered || '',
      teacher: upcoming.l.teacherName || '',
      grade: upcoming.l.classNumber ? `Grade ${upcoming.l.classNumber}` : '',
      className: upcoming.l.className || '',
      duration: durationLabel(upcoming.start, upcoming.end),
      time: fmt(upcoming.start),
      timeEnd: fmt(upcoming.end),
      startsInMinutes: Math.max(0, mins),
      secondsLeft: Math.max(0, mins) * 60,
      zoomLink: upcoming.l.zoomJoinUrl || upcoming.l.joinUrl || state.nextClass.zoomLink,
      joinUrl: upcoming.l.zoomJoinUrl || upcoming.l.joinUrl || state.nextClass.joinUrl,
      passcode: upcoming.l.zoomPasscode || upcoming.l.passcode || state.nextClass.passcode,
      meetingId: upcoming.l.zoomRoomId || upcoming.l.meetingNumber || state.nextClass.meetingId,
      sessionState: upcoming.l.sessionState,
      isLiveNow: upcoming.l.status === 'LIVE' || upcoming.l.sessionState === 'LIVE',
    };
  } else {
    state.nextClass = {
      ...defaultNextClass,
      zoomLink: state.nextClass.zoomLink,
      joinUrl: state.nextClass.joinUrl,
      passcode: state.nextClass.passcode,
      meetingId: state.nextClass.meetingId,
    };
  }

  const grouped: Record<string, TimetableLesson[]> = {};
  for (const { l, start, end } of lessons) {
    const key = dateKeyInZone(start!, tz);
    if (!grouped[key]) grouped[key] = [];
    const idx = grouped[key].length;
    const mins = minutesUntil(start);
    grouped[key].push({
      id: String(l.id),
      lessonId: l.id,
      time: `${fmt(start)} - ${fmt(end)}`,
      subject: l.subjectName || '',
      topic: l.topicCovered || '',
      teacher: l.teacherName || '',
      joinableAt: mins >= 0 && mins <= 10 && l.status !== 'CANCELLED' ? fmt(start) : undefined,
      status: l.status || 'SCHEDULED',
      border: BORDERS[idx % BORDERS.length],
    });
  }
  state.weeklyTimetable = grouped;
  state.timetableDays = Object.keys(grouped)
    .sort()
    .map((key) => ({ key, label: dayLabelFromKey(key) }));

  state.recentlyCompleted = lessons
    .filter(({ l }) => l.status === 'COMPLETED' || l.status === 'CANCELLED')
    .slice(0, 5)
    .map(({ l, start }) => ({
      id: String(l.id),
      subject: l.subjectName || '',
      topic: l.topicCovered || '',
      teacher: l.teacherName || '',
      time: fmt(start),
      status: l.status === 'CANCELLED' ? 'Cancelled' : 'Completed',
      hasNotes: Boolean(l.resourceUrl),
    }));
}

export const fetchTimetable = createAsyncThunk('classes/fetchTimetable', async (_, { rejectWithValue }) => {
  try {
    return await requestApi<any[]>('/api/v1/students/me/timetable');
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

export const fetchStudentZoomSession = createAsyncThunk('classes/fetchZoomSession', async (_, { rejectWithValue }) => {
  try {
    return await requestApi<any>('/api/v1/zoom/student-class-session');
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

export const joinLesson = createAsyncThunk('classes/joinLesson', async (lessonId: number, { rejectWithValue }) => {
  try {
    return await requestApi<any>(`/api/v1/students/me/live-lesson/${lessonId}/join`);
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

const classesSlice = createSlice({
  name: 'classes',
  initialState,
  reducers: {
    // Called by useTimezone when the detected timezone changes. Only the
    // display is recomputed; the schedule itself is untouched.
    setTimezone: (
      state,
      action: PayloadAction<{ timezone: string; source: TimezoneSource; schoolTimezone?: string }>
    ) => {
      state.timezone = action.payload.timezone;
      state.timezoneSource = action.payload.source;
      if (action.payload.schoolTimezone) state.schoolTimezone = action.payload.schoolTimezone;
      deriveSchedule(state);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTimetable.pending, (state) => { state.loading = true; })
      .addCase(fetchTimetable.rejected, (state) => { state.loading = false; })
      .addCase(fetchTimetable.fulfilled, (state, action) => {
        state.loading = false;
        state.rawLessons = Array.isArray(action.payload) ? action.payload : [];
        deriveSchedule(state);
      });

    builder.addCase(fetchStudentZoomSession.fulfilled, (state, action) => {
      const d = action.payload;
      if (d) {
        state.zoomSession = {
          joinUrl: d.joinUrl || null,
          passcode: d.passcode || null,
          meetingId: d.meetingId || null,
          sessionState: d.sessionState || null,
          statusMessage: d.statusMessage || null,
          inWindow: d.inWindow ?? false,
          canJoin: d.canJoin ?? Boolean(d.joinUrl),
        };
        if (d.joinUrl || d.passcode || d.meetingId) {
          state.nextClass = {
            ...state.nextClass,
            zoomLink: d.joinUrl || state.nextClass.zoomLink,
            joinUrl: d.joinUrl || state.nextClass.joinUrl,
            passcode: d.passcode || state.nextClass.passcode,
            meetingId: d.meetingId || state.nextClass.meetingId,
            sessionState: d.sessionState || state.nextClass.sessionState,
            statusMessage: d.statusMessage || state.nextClass.statusMessage,
          };
        }
      }
    });

    builder.addCase(joinLesson.fulfilled, (state, action) => {
      const d = action.payload;
      if (d) {
        state.zoomSession = {
          joinUrl: d.joinUrl || null,
          passcode: d.passcode || null,
          meetingId: d.meetingId || null,
          sessionState: d.sessionState || null,
          statusMessage: d.message || null,
          inWindow: d.inWindow ?? true,
          canJoin: d.canJoin ?? Boolean(d.joinUrl),
        };
        if (d.joinUrl || d.passcode || d.meetingId) {
          state.nextClass = {
            ...state.nextClass,
            zoomLink: d.joinUrl || state.nextClass.zoomLink,
            joinUrl: d.joinUrl || state.nextClass.joinUrl,
            passcode: d.passcode || state.nextClass.passcode,
            meetingId: d.meetingId || state.nextClass.meetingId,
            sessionState: d.sessionState || state.nextClass.sessionState,
            statusMessage: d.message || state.nextClass.statusMessage,
          };
        }
      }
    });
  },
});

export const { setTimezone } = classesSlice.actions;
export default classesSlice.reducer;
