import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { TimetableLesson } from '../../types';
import { requestApi } from '../../services/api';

interface TimetableState {
  viewMode: 'agenda' | 'grid';
  currentWeekLabel: string;
  lessons: TimetableLesson[];
  activeLessonModal: TimetableLesson | null;
  activeProblemModalLesson: TimetableLesson | null;
  isLoading: boolean;
}

const initialLessons: TimetableLesson[] = [];

export const fetchTeacherLessonsThunk = createAsyncThunk(
  'timetable/fetchTeacherLessons',
  async (_, { rejectWithValue }) => {
    try {
      // Fetch lessons for a 14-day window so the weekly grid is populated
      const today = new Date();
      const startDate = today.toISOString().split('T')[0];
      const endDate = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const data = await requestApi<any[]>(`/api/v1/timetable/my-lessons?startDate=${startDate}&endDate=${endDate}`);
      if (Array.isArray(data) && data.length > 0) {
        return data.map((l: any) => {
          const startStr: string = l.startAt || l.start_at || '';
          const endStr: string = l.endAt || l.end_at || '';
          // startAt is stored as 'YYYY-MM-DD HH:MM:SS' school wall-clock time
          const startTime = startStr.length >= 16 ? startStr.substring(11, 16) : '09:00';
          const endTime = endStr.length >= 16 ? endStr.substring(11, 16) : '09:45';
          const lessonDate: string = l.lessonDate || startStr.substring(0, 10) || new Date().toISOString().split('T')[0];
          return {
            id: `LES-${String(l.id).padStart(2, '0')}`,
            rawId: l.id,
            classId: `${l.classNumber}-${(l.subjectCode || 'sub').toLowerCase()}-a`,
            className: l.className,
            subject: l.subjectName,
            topic: l.topicCovered || 'Core Instruction & Practical Exercises',
            date: lessonDate,
            dayOfWeek: new Date(lessonDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }),
            startTime,
            endTime,
            periodNumber: 1,
            room: `Online Live Classroom (Room ${l.classNumber})`,
            status: (l.status === 'LIVE' ? 'live' : l.status === 'COMPLETED' ? 'completed' : 'scheduled') as any,
            zoomRoomId: l.meetingNumber || `900${l.classNumber}000${l.classNumber}`,
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
  lessons: initialLessons,
  activeLessonModal: null,
  activeProblemModalLesson: null,
  isLoading: false,
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
  openLessonModal,
  closeLessonModal,
  openProblemModal,
  closeProblemModal,
  markLessonCompleted,
  markLessonStarted,
} = timetableSlice.actions;

export default timetableSlice.reducer;
