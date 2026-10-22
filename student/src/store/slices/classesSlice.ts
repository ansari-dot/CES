import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { requestApi } from '../../services/api';

export interface NextClass {
  id: string;
  subject: string;
  topic: string;
  teacher: string;
  grade: string;
  duration: string;
  time: string;
  timeEnd: string;
  startsInMinutes: number;
  secondsLeft: number;
  zoomLink: string;
  joinUrl?: string;
  passcode?: string;
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
  joinable: boolean;
  lessonId?: number;
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

interface ClassesState {
  nextClass: NextClass;
  todayClasses: TodayClass[];
  weeklyTimetable: Record<string, TimetableLesson[]>;
  recentlyCompleted: CompletedLesson[];
  zoomSession: { joinUrl: string | null; passcode: string | null; inWindow: boolean } | null;
  loading: boolean;
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

const initialState: ClassesState = {
  nextClass: defaultNextClass,
  todayClasses: [],
  weeklyTimetable: {},
  recentlyCompleted: [],
  zoomSession: null,
  loading: false,
};

function formatTime(val: string): string {
  if (!val) return '';
  const t = val.includes('T') ? val.split('T')[1] : val;
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

function minutesUntil(val: string): number {
  if (!val) return 999;
  const diff = new Date(val).getTime() - Date.now();
  return Math.round(diff / 60000);
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${days[d.getDay()]} ${d.getDate()}`;
}

const BORDERS = ['border-primary', 'border-success', 'border-warning', 'border-info'];

export const fetchTimetable = createAsyncThunk('classes/fetchTimetable', async (_, { rejectWithValue }) => {
  try {
    return await requestApi<any[]>('/api/v1/timetable/lessons');
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
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTimetable.pending, (state) => { state.loading = true; })
      .addCase(fetchTimetable.rejected, (state) => { state.loading = false; })
      .addCase(fetchTimetable.fulfilled, (state, action) => {
        state.loading = false;
        const lessons: any[] = Array.isArray(action.payload) ? action.payload : [];
        if (!lessons.length) return;

        const todayStr = new Date().toISOString().split('T')[0];
        const todayLessons = lessons.filter((l) =>
          (l.lessonDate || l.lesson_date || '').split('T')[0] === todayStr
        );

        state.todayClasses = todayLessons.map((l) => {
          const start = l.startAt || l.start_at || '';
          const end = l.endAt || l.end_at || '';
          const mins = minutesUntil(start);
          return {
            id: String(l.id),
            lessonId: l.id,
            time: formatTime(start),
            endTime: formatTime(end),
            subject: l.subjectName || '',
            topic: l.topicCovered || '',
            teacher: l.teacherName || '',
            duration: '45 min',
            status: l.status === 'LIVE' ? 'Live' : l.status === 'COMPLETED' ? 'Completed' : 'Upcoming',
            joinable: l.status === 'LIVE' || (mins >= -5 && mins <= 10),
          };
        });

        const upcoming = todayLessons.find((l) => {
          const mins = minutesUntil(l.startAt || l.start_at || '');
          return l.status !== 'COMPLETED' && l.status !== 'CANCELLED' && mins >= -15;
        });
        if (upcoming) {
          const mins = minutesUntil(upcoming.startAt || upcoming.start_at || '');
          state.nextClass = {
            id: String(upcoming.id),
            lessonId: upcoming.id,
            subject: upcoming.subjectName || '',
            topic: upcoming.topicCovered || '',
            teacher: upcoming.teacherName || '',
            grade: '',
            duration: '45 min',
            time: formatTime(upcoming.startAt || upcoming.start_at || ''),
            timeEnd: formatTime(upcoming.endAt || upcoming.end_at || ''),
            startsInMinutes: Math.max(0, mins),
            secondsLeft: Math.max(0, mins) * 60,
            zoomLink: '',
            isLiveNow: upcoming.status === 'LIVE',
          };
        }

        const grouped: Record<string, TimetableLesson[]> = {};
        for (const l of lessons) {
          const dateStr = (l.lessonDate || l.lesson_date || '').split('T')[0];
          if (!dateStr) continue;
          const label = dayLabel(dateStr);
          if (!grouped[label]) grouped[label] = [];
          const idx = grouped[label].length;
          const start = l.startAt || l.start_at || '';
          const end = l.endAt || l.end_at || '';
          const mins = minutesUntil(start);
          grouped[label].push({
            id: String(l.id),
            lessonId: l.id,
            time: `${formatTime(start)} - ${formatTime(end)}`,
            subject: l.subjectName || '',
            topic: l.topicCovered || '',
            teacher: l.teacherName || '',
            joinableAt: mins >= 0 && mins <= 10 ? formatTime(start) : undefined,
            status: l.status || 'SCHEDULED',
            border: BORDERS[idx % BORDERS.length],
          });
        }
        state.weeklyTimetable = grouped;

        state.recentlyCompleted = lessons
          .filter((l) => l.status === 'COMPLETED' || l.status === 'CANCELLED')
          .slice(0, 5)
          .map((l) => ({
            id: String(l.id),
            subject: l.subjectName || '',
            topic: l.topicCovered || '',
            teacher: l.teacherName || '',
            time: formatTime(l.startAt || l.start_at || ''),
            status: l.status === 'CANCELLED' ? 'Cancelled' : 'Completed',
            hasNotes: Boolean(l.resourceUrl),
          }));
      });

    builder.addCase(fetchStudentZoomSession.fulfilled, (state, action) => {
      const d = action.payload;
      if (d) {
        state.zoomSession = { joinUrl: d.joinUrl || null, passcode: d.passcode || null, inWindow: d.inWindow ?? false };
        if (d.joinUrl) {
          state.nextClass = { ...state.nextClass, zoomLink: d.joinUrl, joinUrl: d.joinUrl, passcode: d.passcode };
        }
      }
    });

    builder.addCase(joinLesson.fulfilled, (state, action) => {
      const d = action.payload;
      if (d?.joinUrl) {
        state.zoomSession = { joinUrl: d.joinUrl, passcode: d.passcode || null, inWindow: d.inWindow ?? true };
        state.nextClass = { ...state.nextClass, zoomLink: d.joinUrl, joinUrl: d.joinUrl, passcode: d.passcode };
      }
    });
  },
});

export default classesSlice.reducer;
