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

const initialMetrics: StudentPerformanceMetric[] = [
  {
    studentId: '35',
    name: 'Aiden Cooper',
    rollNumber: '#01',
    admissionId: 'ADM-2026-001',
    avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=120',
    classId: '5',
    className: 'Class 5',
    attendanceRate: 98,
    taskCompletionRate: 100,
    averageQuizScore: 95,
    streakStatus: 'High Performer',
    improvementArea: 'Word Problem speed',
    starsCount: 14,
  },
  {
    studentId: '36',
    name: 'Bella Chen',
    rollNumber: '#02',
    admissionId: 'ADM-2026-002',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=120',
    classId: '5',
    className: 'Class 5',
    attendanceRate: 100,
    taskCompletionRate: 98,
    averageQuizScore: 92,
    streakStatus: 'Consistent Leader',
    improvementArea: 'Reciprocal fractions double-checking',
    starsCount: 18,
  },
  {
    studentId: '37',
    name: 'Caleb Davis',
    rollNumber: '#03',
    admissionId: 'ADM-2026-003',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120',
    classId: '5',
    className: 'Class 5',
    attendanceRate: 91,
    taskCompletionRate: 85,
    averageQuizScore: 80,
    streakStatus: 'Needs Monitoring',
    improvementArea: 'On-time homework submission',
    starsCount: 6,
  },
  {
    studentId: '38',
    name: 'Daniel Evans',
    rollNumber: '#04',
    admissionId: 'ADM-2026-004',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=120',
    classId: '5',
    className: 'Class 5',
    attendanceRate: 94,
    taskCompletionRate: 90,
    averageQuizScore: 84,
    streakStatus: 'Steady Growth',
    improvementArea: 'Punctuality to morning periods',
    starsCount: 8,
  },
  {
    studentId: '39',
    name: 'Zainab Fatima',
    rollNumber: '#05',
    admissionId: 'ADM-2026-005',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=120',
    classId: '5',
    className: 'Class 5',
    attendanceRate: 97,
    taskCompletionRate: 95,
    averageQuizScore: 89,
    streakStatus: 'Group Captain',
    improvementArea: 'Advanced fraction reductions',
    starsCount: 12,
  },
];

const initialAchievements: AchievementItem[] = [
  {
    id: '1',
    studentId: '36',
    studentName: 'Bella Chen',
    classId: '5',
    className: 'Class 5',
    badgeType: 'star',
    title: 'Excellence in Fraction Logic',
    reason: 'Demonstrated superb step-by-step problem presentation in peer study group.',
    awardedDate: 'Oct 19, 2026',
    starsCount: 5,
  },
  {
    id: '2',
    studentId: '35',
    studentName: 'Aiden Cooper',
    classId: '5',
    className: 'Class 5',
    badgeType: 'medal',
    title: 'Math Marathon Streak',
    reason: 'Maintained 100% quiz completion and highest accuracy on Module 3 check-in.',
    awardedDate: 'Oct 18, 2026',
    starsCount: 3,
  },
];

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
  selectedStudentId: '36',
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

        if (Array.isArray(achievements) && achievements.length > 0) {
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

        if (Array.isArray(students) && students.length > 0) {
          state.metrics = students.map((s: any) => {
            const studentAchievements = state.achievements.filter((a) => a.studentId === String(s.id));
            const totalStars = studentAchievements.reduce((sum, a) => sum + a.starsCount, 10);

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
              streakStatus: 'High Performer',
              improvementArea: 'Consistent practice',
              starsCount: totalStars,
            };
          });

          if (!state.selectedStudentId || !state.metrics.find((m) => m.studentId === state.selectedStudentId)) {
            state.selectedStudentId = state.metrics[0].studentId;
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
