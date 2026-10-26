import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { TimetableLesson } from '../../types';
import { requestApi } from '../../services/api';
import { fetchDutySummaryThunk } from './dutySlice';
import { fetchSchoolTimetable } from './schoolTimetableSlice';
import {
  DEFAULT_SCHOOL_TIMEZONE,
  getBrowserTimeZone,
  isValidTimeZone,
  parseUtcInstant,
  formatTimeInZone,
  dateKeyInZone,
  dayOfWeekInZone,
  convertRecurringSlotToZoned
} from '../../lib/timezone';

interface TimetableState {
  viewMode: 'agenda' | 'grid';
  currentWeekLabel: string;
  lessons: TimetableLesson[];
  activeLessonModal: TimetableLesson | null;
  activeProblemModalLesson: TimetableLesson | null;
  isLoading: boolean;
  timezone: string;
  timezoneSource: 'ip' | 'browser' | 'fallback' | 'manual';
  schoolTimezone: string;
}

const browserTz = getBrowserTimeZone();

export const detectTeacherTimezoneThunk = createAsyncThunk(
  'timetable/detectTimezone',
  async (_, { dispatch, getState }) => {
    const state = getState() as any;
    if (state.timetable?.timezoneSource === 'manual') {
      return {
        timezone: state.timetable.timezone,
        source: 'manual' as const,
        schoolTimezone: state.timetable.schoolTimezone || DEFAULT_SCHOOL_TIMEZONE
      };
    }

    let detected: { timezone: string; source: 'ip' | 'browser' | 'fallback' | 'manual'; schoolTimezone: string } = {
      timezone: browserTz || DEFAULT_SCHOOL_TIMEZONE,
      source: browserTz ? ('browser' as const) : ('fallback' as const),
      schoolTimezone: DEFAULT_SCHOOL_TIMEZONE
    };

    try {
      const data = await requestApi<{ timezone: string; source: 'ip' | 'browser' | 'fallback'; schoolTimezone: string }>(
        `/api/v1/geo/timezone${browserTz ? `?browserTz=${encodeURIComponent(browserTz)}` : ''}`
      );
      if (isValidTimeZone(data?.timezone)) {
        detected = data;
      }
    } catch {
      // keep fallback
    }

    dispatch(setTimezone(detected));
    await Promise.all([
      dispatch(fetchTeacherLessonsThunk()),
      dispatch(fetchSchoolTimetable())
    ]);
    return detected;
  }
);

export const changeTeacherTimezoneThunk = createAsyncThunk(
  'timetable/changeTimezone',
  async (
    payload: { timezone: string; source?: 'ip' | 'browser' | 'fallback' | 'manual'; schoolTimezone?: string },
    { dispatch }
  ) => {
    dispatch(
      setTimezone({
        timezone: payload.timezone,
        source: payload.source || 'manual',
        schoolTimezone: payload.schoolTimezone,
      })
    );
    await Promise.all([
      dispatch(fetchTeacherLessonsThunk()),
      dispatch(fetchSchoolTimetable())
    ]);
    return payload;
  }
);

export const fetchTeacherLessonsThunk = createAsyncThunk(
  'timetable/fetchTeacherLessons',
  async (_, { getState, rejectWithValue }) => {
    try {
      const state = getState() as any;
      const teacherTz = state.timetable?.timezone || browserTz || DEFAULT_SCHOOL_TIMEZONE;
      const schoolTz = state.timetable?.schoolTimezone || DEFAULT_SCHOOL_TIMEZONE;

      const [todayRes, lessonsRes, slotsRes] = await Promise.all([
        requestApi<any[]>('/api/v1/zoom/my-class-session').catch(() => []),
        requestApi<any[]>('/api/v1/timetable/my-lessons').catch(() => []),
        requestApi<any[]>('/api/v1/timetable/my-slots').catch(() => [])
      ]);

      const todayList = Array.isArray(todayRes) ? todayRes : [];
      const lessonsList = Array.isArray(lessonsRes) ? lessonsRes : [];
      const slotsList = Array.isArray(slotsRes) ? slotsRes : [];

      const combinedLessons: TimetableLesson[] = [];
      const seenLessonIds = new Set<number>();
      const seenSlotIds = new Set<number>();
      const seenDayTimeSlots = new Set<string>();

      // 1. Process dated lessons in teacher's regional timezone
      const listToProcess = lessonsList.length > 0 ? lessonsList : todayList;
      for (const l of listToProcess) {
        if (l.id && seenLessonIds.has(Number(l.id))) continue;
        if (l.id) seenLessonIds.add(Number(l.id));

        const slotIdNum = Number(l.slotId || l.slot_id);
        if (slotIdNum) seenSlotIds.add(slotIdNum);

        const startInstant = parseUtcInstant(l.startAt || l.start_at);
        const endInstant = parseUtcInstant(l.endAt || l.end_at);

        let startTimeStr = '09:00';
        let endTimeStr = '09:45';
        let dateStr = l.lessonDate || new Date().toISOString().split('T')[0];
        let dayOfWeek = 'Monday';

        if (startInstant && endInstant) {
          startTimeStr = formatTimeInZone(startInstant, teacherTz);
          endTimeStr = formatTimeInZone(endInstant, teacherTz);
          dateStr = dateKeyInZone(startInstant, teacherTz);
          dayOfWeek = dayOfWeekInZone(startInstant, teacherTz);
        } else if (l.startTime && l.endTime) {
          const zoned = convertRecurringSlotToZoned(
            { weekday: l.weekday || 1, startTime: l.startTime, endTime: l.endTime },
            schoolTz,
            teacherTz
          );
          startTimeStr = zoned.startTime;
          endTimeStr = zoned.endTime;
          dayOfWeek = zoned.dayOfWeek;
        }

        const startH = parseInt(startTimeStr.substring(0, 2), 10);
        let periodNum = 1;
        if (startH >= 14) periodNum = 4;
        else if (startH >= 13) periodNum = 3;
        else if (startH >= 10) periodNum = 2;

        const dayTimeKey = `${dayOfWeek}-${startTimeStr}-${l.classId}`;
        seenDayTimeSlots.add(dayTimeKey);

        combinedLessons.push({
          id: `LES-${String(l.id).padStart(2, '0')}`,
          rawId: l.id,
          classId: `${l.classNumber}-${(l.subjectCode || 'sub').toLowerCase()}-a`,
          className: l.className || `Class ${l.classNumber}`,
          subject: l.subjectName,
          topic: l.topicCovered || 'Core Instruction & Practical Exercises',
          date: dateStr,
          dayOfWeek,
          startTime: startTimeStr,
          endTime: endTimeStr,
          periodNumber: periodNum,
          room: `Online Live Classroom (Room ${l.classNumber})`,
          status: (l.status === 'LIVE' ? 'live' : l.status === 'COMPLETED' ? 'completed' : 'scheduled') as any,
          zoomRoomId: l.zoomRoomId || l.meetingNumber || `900${l.classNumber}000${l.classNumber}`,
          zoomPasscode: l.zoomPasscode || `CLASS${l.classNumber}#`,
          hostKey: l.hostKey || '884422',
          joinUrl: l.zoomJoinUrl || l.joinUrl || `https://zoom.us/j/${l.zoomRoomId || l.meetingNumber || `900${l.classNumber}000${l.classNumber}`}`,
          sessionState: l.sessionState || (l.status === 'LIVE' ? 'LIVE' : 'SCHEDULED'),
          actualStartTime: l.actualStartAt || l.actual_start_at || l.teacherJoinedAt || l.teacher_joined_at || (l.status === 'LIVE' ? l.startAt : undefined),
          actualEndTime: l.actualEndAt || l.actual_end_at || l.handoverAt || l.handover_at || undefined,
          startAt: l.startAt || l.start_at,
          endAt: l.endAt || l.end_at,
          deliveryLogged: Boolean(l.deliveryLoggedAt),
          attendanceSubmitted: false,
          notes: l.teachingNotes || ''
        });
      }

      // 2. Also populate weekly recurring slots converted to teacher's regional timezone
      const todayWeekday = new Date().getDay() === 0 ? 7 : new Date().getDay();
      for (const s of slotsList) {
        const slotIdNum = Number(s.id);
        if (slotIdNum && seenSlotIds.has(slotIdNum)) {
          continue; // Slot already has dated lessons; do not duplicate
        }

        const zoned = convertRecurringSlotToZoned(
          { weekday: s.weekday, startTime: s.startTime, endTime: s.endTime },
          schoolTz,
          teacherTz
        );

        const dayOfWeek = zoned.dayOfWeek;
        const sTimeStr = zoned.startTime;
        const eTimeStr = zoned.endTime;
        const dayTimeKey = `${dayOfWeek}-${sTimeStr}-${s.classId}`;
        if (seenDayTimeSlots.has(dayTimeKey)) {
          continue;
        }
        seenDayTimeSlots.add(dayTimeKey);

        const startH = parseInt(sTimeStr.substring(0, 2), 10);
        let periodNum = 1;
        if (startH >= 14) periodNum = 4;
        else if (startH >= 13) periodNum = 3;
        else if (startH >= 10) periodNum = 2;

        // Calculate accurate date for this slot's weekday in the current week
        const diffDays = (s.weekday || 1) - todayWeekday;
        const targetD = new Date();
        targetD.setDate(targetD.getDate() + diffDays);
        const dateStr = dateKeyInZone(targetD, teacherTz);

        combinedLessons.push({
          id: `SLOT-${String(s.id).padStart(2, '0')}`,
          rawId: s.id,
          classId: `${s.classNumber}-${(s.subjectCode || 'sub').toLowerCase()}-a`,
          className: s.className || `Class ${s.classNumber}`,
          subject: s.subjectName,
          topic: 'Core Instruction & Practical Exercises',
          date: dateStr,
          dayOfWeek,
          startTime: sTimeStr,
          endTime: eTimeStr,
          periodNumber: periodNum,
          room: `Online Live Classroom (Room ${s.classNumber})`,
          status: 'scheduled' as any,
          zoomRoomId: s.zoomMeetingId || `900${s.classNumber}000${s.classNumber}`,
          zoomPasscode: s.zoomPasscode || `CLASS${s.classNumber}#`,
          hostKey: s.hostKey || '884422',
          joinUrl: s.zoomJoinUrl || `https://zoom.us/j/${s.zoomMeetingId || `900${s.classNumber}000${s.classNumber}`}`,
          sessionState: 'SCHEDULED',
          deliveryLogged: false,
          attendanceSubmitted: false,
          notes: ''
        });
      }

      return combinedLessons;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch teacher lessons');
    }
  }
);

export const endLessonThunk = createAsyncThunk(
  'timetable/endLesson',
  async (
    { lessonId, topic, notes }: { lessonId: number; topic?: string; notes?: string },
    { dispatch, rejectWithValue }
  ) => {
    try {
      const res = await requestApi<any>(`/api/v1/zoom/sessions/${lessonId}/end`, {
        method: 'POST',
        body: JSON.stringify({ topic, notes })
      });
      await Promise.all([
        dispatch(fetchTeacherLessonsThunk()),
        dispatch(fetchDutySummaryThunk())
      ]);
      return res;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to end lesson');
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
      action: PayloadAction<{ timezone: string; source: 'ip' | 'browser' | 'fallback' | 'manual'; schoolTimezone?: string }>
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
      .addCase(changeTeacherTimezoneThunk.fulfilled, (state, action) => {
        if (action.payload) {
          state.timezone = action.payload.timezone;
          state.timezoneSource = action.payload.source || 'manual';
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
