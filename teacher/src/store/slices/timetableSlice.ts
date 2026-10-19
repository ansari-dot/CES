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

const initialLessons: TimetableLesson[] = [
  {
    id: 'LES-163',
    classId: '5-math-a',
    className: 'Class 5',
    subject: 'Mathematics',
    topic: 'Fraction Division & Word Problems',
    date: '2026-10-19',
    dayOfWeek: 'Monday',
    startTime: '09:00 AM',
    endTime: '09:45 AM',
    periodNumber: 1,
    room: 'Online Classroom (Grade 5)',
    status: 'scheduled',
    zoomRoomId: '90050005',
    zoomPasscode: 'CLASS5#',
    deliveryLogged: false,
    attendanceSubmitted: false,
  },
  {
    id: 'LES-164',
    classId: '5-sci-a',
    className: 'Class 5',
    subject: 'General Science',
    topic: 'Solar & Wind Energy Systems',
    date: '2026-10-19',
    dayOfWeek: 'Monday',
    startTime: '10:30 AM',
    endTime: '11:15 AM',
    periodNumber: 2,
    room: 'Online Classroom (Grade 5)',
    status: 'scheduled',
    zoomRoomId: '90050005',
    zoomPasscode: 'CLASS5#',
    deliveryLogged: false,
    attendanceSubmitted: false,
  },
  {
    id: 'LES-165',
    classId: '6-sci-a',
    className: 'Class 6',
    subject: 'General Science',
    topic: 'Kinetic & Potential Energy Conversions',
    date: '2026-10-19',
    dayOfWeek: 'Monday',
    startTime: '01:00 PM',
    endTime: '01:45 PM',
    periodNumber: 3,
    room: 'Online Classroom (Grade 6)',
    status: 'scheduled',
    zoomRoomId: '90060006',
    zoomPasscode: 'CLASS6#',
    deliveryLogged: false,
    attendanceSubmitted: false,
  }
];

export const fetchTeacherLessonsThunk = createAsyncThunk(
  'timetable/fetchTeacherLessons',
  async (_, { rejectWithValue }) => {
    try {
      const data = await requestApi<any[]>('/api/v1/zoom/my-class-session');
      if (Array.isArray(data) && data.length > 0) {
        return data.map((l: any) => ({
          id: `LES-${String(l.id).padStart(2, '0')}`,
          rawId: l.id,
          classId: `${l.classNumber}-${(l.subjectCode || 'sub').toLowerCase()}-a`,
          className: l.className,
          subject: l.subjectName,
          topic: l.topicCovered || 'Core Instruction & Practical Exercises',
          date: l.lessonDate || new Date().toISOString().split('T')[0],
          dayOfWeek: new Date(l.lessonDate || Date.now()).toLocaleDateString('en-US', { weekday: 'long' }),
          startTime: l.startAt ? String(l.startAt).substring(11, 16) : '09:00 AM',
          endTime: l.endAt ? String(l.endAt).substring(11, 16) : '09:45 AM',
          periodNumber: 1,
          room: `Online Live Classroom (Room ${l.classNumber})`,
          status: (l.status === 'LIVE' ? 'live' : l.status === 'COMPLETED' ? 'completed' : 'scheduled') as any,
          zoomRoomId: l.meetingNumber || `900${l.classNumber}000${l.classNumber}`,
          zoomPasscode: `CLASS${l.classNumber}#`,
          deliveryLogged: Boolean(l.deliveryLoggedAt),
          attendanceSubmitted: false,
          notes: l.teachingNotes || ''
        }));
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
        if (Array.isArray(action.payload) && action.payload.length > 0) {
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
