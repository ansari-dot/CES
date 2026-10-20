import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { AchievementItem } from '../../types';
import { requestApi } from '../../services/api';

interface StudentPerformanceMetric {
  studentId: string;
  name: string;
  rollNumber: string;
  admissionId: string;
  avatar: string;
  classId: string;
  className: string;
  attendanceRate: number;
  taskCompletionRate: number;
  averageQuizScore: number;
  streakStatus: string;
  improvementArea: string;
  starsCount: number;
}

interface PerformanceState {
  metrics: StudentPerformanceMetric[];
  achievements: AchievementItem[];
  selectedStudentId: string | null;
  loading: boolean;
  error: string | null;
}

const initialMetrics: StudentPerformanceMetric[] = [];

const initialAchievements: AchievementItem[] = [];

export const fetchPerformanceDataThunk = createAsyncThunk(
  'performance/fetchData',
  async (_, { rejectWithValue }) => {
    try {
      const [achievementsRes, studentsRes] = await Promise.all([
        requestApi<any[]>('/api/v1/tasks/achievements').catch(() => []),
        requestApi<any[]>('/api/v1/students?classId=5').catch(() => []),
      ]);

      return {
        achievements: Array.isArray(achievementsRes) ? achievementsRes : [],
        students: Array.isArray(studentsRes) ? studentsRes : [],
      };
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch performance data');
    }
  }
);

export const awardAchievementThunk = createAsyncThunk(
  'performance/awardAchievement',
  async (
    payload: {
      studentId: number | string;
      studentName?: string;
      classId?: number | string;
      badgeType: string;
      title: string;
      reason: string;
      starsCount: number;
    },
    { rejectWithValue }
  ) => {
    try {
      const numStudentId = typeof payload.studentId === 'string' ? parseInt(payload.studentId.replace(/\D/g, ''), 10) || 35 : payload.studentId;
      const numClassId = typeof payload.classId === 'string' ? parseInt(payload.classId.replace(/\D/g, ''), 10) || 5 : payload.classId || 5;

      const res = await requestApi<any>('/api/v1/tasks/achievements', {
        method: 'POST',
        body: JSON.stringify({
          studentId: numStudentId,
          classId: numClassId,
          badgeType: payload.badgeType.toUpperCase(),
          title: payload.title,
          reason: payload.reason,
          starsCount: payload.starsCount,
        }),
      });

      const item: AchievementItem = {
        id: String(res?.id || Date.now()),
        studentId: String(payload.studentId),
        studentName: payload.studentName || 'Student',
        classId: String(numClassId),
        className: `Class ${numClassId}`,
        badgeType: payload.badgeType.toLowerCase() as any,
        title: payload.title,
        reason: payload.reason,
        awardedDate: 'Today',
        starsCount: payload.starsCount,
      };

      return item;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to award achievement');
    }
  }
);

const initialState: PerformanceState = {
  metrics: initialMetrics,
  achievements: initialAchievements,
  selectedStudentId: null,
  loading: false,
  error: null,
};

export const performanceSlice = createSlice({
  name: 'performance',
  initialState,
  reducers: {
    setSelectedStudentId: (state, action: PayloadAction<string>) => {
      state.selectedStudentId = action.payload;
    },
    awardAchievement: (state, action: PayloadAction<AchievementItem>) => {
      state.achievements.unshift(action.payload);
      const student = state.metrics.find((m) => m.studentId === action.payload.studentId);
      if (student) {
        student.starsCount += action.payload.starsCount;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPerformanceDataThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPerformanceDataThunk.fulfilled, (state, action) => {
        state.loading = false;
        const { achievements, students } = action.payload;

        if (Array.isArray(achievements)) {
          state.achievements = achievements.map((a: any) => ({
            id: String(a.id),
            studentId: String(a.studentId),
            studentName: a.studentName || 'Student',
            classId: String(a.classId),
            className: a.className || `Class ${a.classId}`,
            badgeType: (a.badgeType ? a.badgeType.toLowerCase() : 'star') as any,
            title: a.title,
            reason: a.reason,
            awardedDate: a.createdAt ? new Date(a.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent',
            starsCount: Number(a.starsCount) || 3,
          }));
        }

        if (Array.isArray(students)) {
          state.metrics = students.map((s: any) => {
            const studentAchievements = state.achievements.filter((a) => a.studentId === String(s.id));
            const totalStars = studentAchievements.reduce((sum, a) => sum + a.starsCount, 0);

            return {
              studentId: String(s.id),
              name: s.name,
              rollNumber: s.rollNo || `#${s.id}`,
              admissionId: s.admissionNo || `ADM-${s.id}`,
              avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120',
              classId: String(s.classNumber || 5),
              className: `Class ${s.classNumber || 5}`,
              attendanceRate: 96,
              taskCompletionRate: 95,
              averageQuizScore: 90,
              streakStatus: 'Consistent',
              improvementArea: 'Consistent practice',
              starsCount: totalStars,
            };
          });

          if (state.metrics.length > 0) {
            if (!state.selectedStudentId || !state.metrics.find((m) => m.studentId === state.selectedStudentId)) {
              state.selectedStudentId = state.metrics[0].studentId;
            }
          } else {
            state.selectedStudentId = null;
          }
        }
      })
      .addCase(fetchPerformanceDataThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(awardAchievementThunk.fulfilled, (state, action) => {
        state.achievements.unshift(action.payload);
        const student = state.metrics.find((m) => m.studentId === action.payload.studentId);
        if (student) {
          student.starsCount += action.payload.starsCount;
        }
      });
  },
});

export const { setSelectedStudentId, awardAchievement } = performanceSlice.actions;
export default performanceSlice.reducer;
