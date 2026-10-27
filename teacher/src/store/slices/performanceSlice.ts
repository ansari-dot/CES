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

export function mapAchievement(a: any): AchievementItem {
  const when = a.awardedAt || a.createdAt;
  return {
    id: String(a.id),
    studentId: String(a.studentId),
    studentName: a.studentName || 'Student',
    classId: String(a.classId),
    className: a.className || `Class ${a.classId}`,
    badgeType: (a.badgeType ? a.badgeType.toLowerCase() : 'star') as AchievementItem['badgeType'],
    title: a.title,
    reason: a.reason,
    awardedDate: when ? new Date(when).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
    starsCount: Number(a.starsCount) || 0,
    subjectId: a.subjectId != null ? String(a.subjectId) : undefined,
    subjectName: a.subjectName || undefined,
    visibility: a.visibility === 'INTERNAL' ? 'INTERNAL' : 'PUBLISHED',
  };
}

export const fetchPerformanceDataThunk = createAsyncThunk(
  'performance/fetchData',
  async (_, { rejectWithValue }) => {
    try {
      // Both lists are scoped server-side to this teacher's classes and own records
      const [achievementsRes, studentsRes] = await Promise.all([
        requestApi<any[]>('/api/v1/tasks/achievements'),
        requestApi<any[]>('/api/v1/students'),
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

export interface AchievementPayload {
  studentId: string;
  subjectId: string | null;
  badgeType: AchievementItem['badgeType'];
  title: string;
  reason: string;
  starsCount: number;
  visibility: 'PUBLISHED' | 'INTERNAL';
}

export const awardAchievementThunk = createAsyncThunk(
  'performance/awardAchievement',
  async (payload: AchievementPayload, { rejectWithValue }) => {
    try {
      const res = await requestApi<any>('/api/v1/tasks/achievements', {
        method: 'POST',
        body: JSON.stringify({
          ...payload,
          studentId: Number(payload.studentId),
          subjectId: payload.subjectId ? Number(payload.subjectId) : null,
        }),
      });
      return mapAchievement(res);
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to award achievement');
    }
  }
);

export const updateAchievementThunk = createAsyncThunk(
  'performance/updateAchievement',
  async ({ id, payload }: { id: string; payload: AchievementPayload }, { rejectWithValue }) => {
    try {
      const res = await requestApi<any>(`/api/v1/tasks/achievements/${Number(id)}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...payload,
          studentId: Number(payload.studentId),
          subjectId: payload.subjectId ? Number(payload.subjectId) : null,
        }),
      });
      return mapAchievement(res);
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to update record');
    }
  }
);

export const deleteAchievementThunk = createAsyncThunk(
  'performance/deleteAchievement',
  async (id: string, { rejectWithValue }) => {
    try {
      await requestApi(`/api/v1/tasks/achievements/${Number(id)}`, { method: 'DELETE' });
      return id;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to delete record');
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
          state.achievements = achievements.map(mapAchievement);
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
              classId: String(s.currentClassId),
              className: s.className || `Class ${s.classNumber}`,
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
      })
      .addCase(updateAchievementThunk.fulfilled, (state, action) => {
        state.achievements = state.achievements.map((a) => (a.id === action.payload.id ? action.payload : a));
      })
      .addCase(deleteAchievementThunk.fulfilled, (state, action) => {
        state.achievements = state.achievements.filter((a) => a.id !== action.payload);
      });
  },
});

export const { setSelectedStudentId } = performanceSlice.actions;
export default performanceSlice.reducer;
