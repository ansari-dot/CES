import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { requestApi } from '../../services/api';

export interface SubjectGradeItem {
  subjectId: number;
  subjectName: string;
  subjectCode: string;
  teacherName: string;
  totalTasks: number;
  gradedTasks: number;
  marksObtained: number;
  maxMarks: number;
  percentage: number | null;
  grade: string;
  width: string;
}

export interface RecentGradeResult {
  submissionId: number;
  taskId: number;
  title: string;
  subjectName: string;
  teacherName: string;
  marksAwarded: number;
  maxMarks: number;
  percentage: number;
  grade: string;
  rubricScores: Record<string, number> | null;
  feedback: string;
  submittedAt: string;
  gradedAt: string;
}

export interface GradesSummary {
  id: number;
  admissionNumber: string;
  rollNumber: string;
  classId: number;
  classNumber: number;
  className: string;
  studentName: string;
  overallAverage: number | null;
  overallAverageDisplay: string;
  overallGrade: string;
  gpa: number;
  totalTasks: number;
  submittedTasks: number;
  gradedTasks: number;
  pendingGradingTasks: number;
  overdueTasks: number;
  attendanceRate: number;
  latestRemark: {
    teacherName: string;
    subjectName: string;
    comment: string;
    date: string;
  } | null;
  evaluationStatus: string;
}

export interface AcademicItem {
  id: number;
  name: string;
  marksAwarded: number | null;
  maxMarks: number;
  percentage: number | null;
  status: string;
  date: string;
  isMissed?: boolean;
}

export interface AcademicProgressData {
  overallGrade: {
    percentage: number | null;
    badge: string;
    comparisonText: string;
    subtext: string;
  };
  tasksSummary: {
    count: number;
    gradedCount?: number;
    missedCount?: number;
    avgPercentage: number | null;
    items: AcademicItem[];
  };
  testsSummary: {
    count: number;
    gradedCount?: number;
    missedCount?: number;
    avgPercentage: number | null;
    items: AcademicItem[];
  };
  midtermSummary: {
    percentage: number | null;
    status: string;
    items: AcademicItem[];
  };
  performanceDonut: {
    tasksAvg: number;
    testsAvg: number;
    midtermAvg: number;
    overallGradePct: number;
    hasData?: boolean;
  };
  totalMissedCount?: number;
  gradeTrend: {
    month: string;
    percentage: number;
  }[];
  motivational: {
    title: string;
    subtext: string;
  };
}

export interface GradesReport {
  summary: GradesSummary;
  subjects: SubjectGradeItem[];
  recentResults: RecentGradeResult[];
  academicProgress?: AcademicProgressData;
}

interface GradesState {
  data: GradesReport | null;
  loading: boolean;
  error: string | null;
}

const initialState: GradesState = {
  data: null,
  loading: false,
  error: null,
};

export const fetchMyGrades = createAsyncThunk(
  'grades/fetchMyGrades',
  async (_, { rejectWithValue }) => {
    try {
      const data = await requestApi<GradesReport>('/api/v1/students/me/grades');
      return data;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch grades');
    }
  }
);

const gradesSlice = createSlice({
  name: 'grades',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyGrades.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchMyGrades.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(fetchMyGrades.rejected, (state, action) => {
        state.loading = false;
        state.error = (action.payload as string) || 'Failed to load grades';
      });
  },
});

export default gradesSlice.reducer;
