import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { requestApi } from '../../services/api';

export interface AlertPreferences {
  classReminders: boolean;
  assignmentDue: boolean;
  resultPublished: boolean;
  feeReminders: boolean;
}

export interface StudentProfile {
  name: string;
  avatar: string;
  grade: string;
  rollNumber: string;
  session: string;
  status: string;
  guardianPhone: string;
  whatsappAlerts: boolean;
  alertPreferences: AlertPreferences;
  stars: number;
  badges: number;
  // backend fields
  studentId?: number;
  userId?: number;
  email?: string;
  admissionNo?: string;
  currentClassId?: number;
  className?: string;
}

export interface DashboardData {
  schedule: any[];
  tasks: any[];
  totalOutstandingFee: number;
  attendanceRate: number;
  achievements: any[];
  isRestricted?: boolean;
  suspensionReason?: string;
}

interface StudentState {
  profile: StudentProfile;
  dashboard: DashboardData | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  dashboardLoading: boolean;
  authError: string | null;
  toastMessage: string | null;
}

const initialState: StudentState = {
  profile: {
    name: 'Student',
    avatar: '',
    grade: '',
    rollNumber: '',
    session: '2026–27',
    status: 'Active',
    guardianPhone: '',
    whatsappAlerts: true,
    alertPreferences: {
      classReminders: true,
      assignmentDue: true,
      resultPublished: true,
      feeReminders: false,
    },
    stars: 0,
    badges: 0,
  },
  dashboard: null,
  isAuthenticated: false,
  authLoading: false,
  dashboardLoading: false,
  authError: null,
  toastMessage: null,
};

// ── Thunks ──────────────────────────────────────────────────────────────────

export const loginStudent = createAsyncThunk(
  'student/login',
  async ({ identifier, password }: { identifier: string; password: string }, { rejectWithValue }) => {
    try {
      const data = await requestApi<any>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      });
      return data;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Login failed');
    }
  }
);

export const fetchMe = createAsyncThunk('student/fetchMe', async (_, { rejectWithValue }) => {
  try {
    return await requestApi<any>('/api/v1/auth/me');
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

export const logoutStudent = createAsyncThunk('student/logout', async () => {
  try {
    await requestApi('/api/v1/auth/logout', { method: 'POST' });
  } catch {
    // ignore — cookies will be cleared server-side
  }
});

export const fetchDashboard = createAsyncThunk('student/fetchDashboard', async (_, { rejectWithValue }) => {
  try {
    return await requestApi<any>('/api/v1/students/me/dashboard');
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

export const changePassword = createAsyncThunk(
  'student/changePassword',
  async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }, { rejectWithValue }) => {
    try {
      await requestApi('/api/v1/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
    } catch (err: any) {
      return rejectWithValue(err.message || 'Password change failed');
    }
  }
);

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapUserToProfile(data: any, existing: StudentProfile): StudentProfile {
  return {
    ...existing,
    name: data.fullName || data.username || existing.name,
    email: data.email || existing.email,
    userId: data.id,
    status: data.status === 'ACTIVE' ? 'Active' : data.status || existing.status,
  };
}

function mapStudentToProfile(student: any, existing: StudentProfile): StudentProfile {
  return {
    ...existing,
    name: student.name || existing.name,
    grade: student.className ? `${student.className}` : existing.grade,
    rollNumber: student.rollNo || student.admissionNo || existing.rollNumber,
    admissionNo: student.admissionNo,
    currentClassId: student.currentClassId,
    className: student.className,
    studentId: student.id,
    userId: student.user_id || existing.userId,
    email: student.email || existing.email,
    guardianPhone: student.phone || existing.guardianPhone,
    status: student.enrollmentStatus === 'ACTIVE' ? 'Active' : student.enrollmentStatus || existing.status,
    avatar: existing.avatar ||
      `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name || 'S')}&background=4f46e5&color=fff`,
  };
}

// ── Slice ────────────────────────────────────────────────────────────────────

const studentSlice = createSlice({
  name: 'student',
  initialState,
  reducers: {
    updatePreferences: (state, action: PayloadAction<Partial<AlertPreferences>>) => {
      state.profile.alertPreferences = { ...state.profile.alertPreferences, ...action.payload };
    },
    toggleWhatsappAlerts: (state) => {
      state.profile.whatsappAlerts = !state.profile.whatsappAlerts;
    },
    setToast: (state, action: PayloadAction<string>) => {
      state.toastMessage = action.payload;
    },
    clearToast: (state) => {
      state.toastMessage = null;
    },
    clearAuthError: (state) => {
      state.authError = null;
    },
  },
  extraReducers: (builder) => {
    // login
    builder
      .addCase(loginStudent.pending, (state) => {
        state.authLoading = true;
        state.authError = null;
      })
      .addCase(loginStudent.fulfilled, (state, action) => {
        state.authLoading = false;
        state.isAuthenticated = true;
        state.profile = mapUserToProfile(action.payload, state.profile);
      })
      .addCase(loginStudent.rejected, (state, action) => {
        state.authLoading = false;
        state.authError = action.payload as string;
      });

    // fetchMe
    builder
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.isAuthenticated = true;
        state.profile = mapUserToProfile(action.payload, state.profile);
      })
      .addCase(fetchMe.rejected, (state) => {
        state.isAuthenticated = false;
      });

    // logout
    builder.addCase(logoutStudent.fulfilled, (state) => {
      state.isAuthenticated = false;
      state.dashboard = null;
    });

    // fetchDashboard
    builder
      .addCase(fetchDashboard.pending, (state) => {
        state.dashboardLoading = true;
      })
      .addCase(fetchDashboard.fulfilled, (state, action) => {
        state.dashboardLoading = false;
        const data = action.payload;
        if (!data) return;
        state.dashboard = {
          schedule: data.schedule || [],
          tasks: data.tasks || [],
          totalOutstandingFee: data.totalOutstandingFee ?? 0,
          attendanceRate: data.attendanceRate ?? 100,
          achievements: data.achievements || [],
          isRestricted: data.isRestricted || false,
          suspensionReason: data.suspensionReason,
        };
        if (data.student) {
          state.profile = mapStudentToProfile(data.student, state.profile);
        }
        // derive stars/badges from achievements
        if (Array.isArray(data.achievements)) {
          state.profile.stars = data.achievements.filter((a: any) => a.badgeType === 'STAR').length;
          state.profile.badges = data.achievements.filter((a: any) => a.badgeType !== 'STAR').length;
        }
      })
      .addCase(fetchDashboard.rejected, (state) => {
        state.dashboardLoading = false;
      });
  },
});

export const { updatePreferences, toggleWhatsappAlerts, setToast, clearToast, clearAuthError } = studentSlice.actions;
export default studentSlice.reducer;
