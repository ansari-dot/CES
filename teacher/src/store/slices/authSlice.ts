import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { TeacherProfile } from '../../types';
import { requestApi } from '../../services/api';

interface AuthState {
  isAuthenticated: boolean;
  teacher: TeacherProfile;
  selectedClassId: string; // 'all' or specific classId
  rememberMe: boolean;
  activeRole: 'teacher' | 'lead' | 'coordinator';
  loginError: string | null;
}

export const initialAssignedClasses = [
  {
    id: '5-math-a',
    name: 'Class 5 - Mathematics',
    grade: 5,
    section: 'A',
    subject: 'Mathematics',
    enrolledCount: 5,
    zoomRoomId: '90050005',
    zoomPasscode: 'CLASS5#',
    roomName: 'Online Classroom (Grade 5)',
  },
  {
    id: '5-sci-a',
    name: 'Class 5 - General Science',
    grade: 5,
    section: 'A',
    subject: 'General Science',
    enrolledCount: 5,
    zoomRoomId: '90050005',
    zoomPasscode: 'CLASS5#',
    roomName: 'Online Classroom (Grade 5)',
  },
  {
    id: '6-sci-a',
    name: 'Class 6 - General Science',
    grade: 6,
    section: 'A',
    subject: 'General Science',
    enrolledCount: 5,
    zoomRoomId: '90060006',
    zoomPasscode: 'CLASS6#',
    roomName: 'Online Classroom (Grade 6)',
  },
];

export const DEFAULT_LIVE_TEACHER: TeacherProfile = {
  id: 'TCH-045',
  name: 'Ms. Sarah Jenkins, M.Ed.',
  employeeId: 'TCH-2024-042',
  email: 'teacher@school.pk',
  phone: '+92 300 1234567',
  designation: 'Senior Faculty • STEM Division',
  avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDTrQl2B4wg4lWgPYqqgevaiCo3-9mQxTR4xfWpaJ3I-8i_atux_OqKZjYe4HL_Dor2EDf10hA1R87akVqx4w_HH-KIcmrPBJwnSN8Qqb01Gyba-PUya9Sv331n-YSrRPwu2yp6Eb8Hs-HyOb6M9ITT9zvamMBVnnMhe2sZ501gxVmj3PDoFGfQmSkkGHu-mpJW3Z_GyjAkRad8U0514qk38wWGHKw-sySFmFh_JiL-c72s1XvnsJHd',
  term: 'Academic Year 2026–2027',
  timezone: 'PKT (UTC+5)',
  isDutyClockedIn: true,
  assignedClasses: initialAssignedClasses,
};

// Check if user was previously remembered
const savedAuth = typeof window !== 'undefined' ? localStorage.getItem('edupulse_auth_state') : null;
let parsedAuth: { isAuthenticated: boolean; email?: string } | null = null;
if (savedAuth) {
  try {
    parsedAuth = JSON.parse(savedAuth);
  } catch {
    parsedAuth = null;
  }
}

const initialState: AuthState = {
  isAuthenticated: !!parsedAuth?.isAuthenticated,
  teacher: DEFAULT_LIVE_TEACHER,
  selectedClassId: '5-math-a',
  rememberMe: !!parsedAuth?.isAuthenticated,
  activeRole: 'teacher',
  loginError: null,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    login: (
      state,
      action: PayloadAction<{
        email: string;
        role?: 'teacher' | 'lead' | 'coordinator';
        rememberMe?: boolean;
      }>
    ) => {
      const emailLower = action.payload.email.toLowerCase().trim();
      const matchedTeacher = {
        ...DEFAULT_LIVE_TEACHER,
        email: emailLower,
        name: action.payload.email.split('@')[0].replace('.', ' ').toUpperCase() || 'Faculty Member',
      };

      state.teacher = matchedTeacher;
      state.isAuthenticated = true;
      state.loginError = null;
      state.rememberMe = !!action.payload.rememberMe;
      if (action.payload.role) {
        state.activeRole = action.payload.role;
      }

      if (action.payload.rememberMe && typeof window !== 'undefined') {
        localStorage.setItem(
          'edupulse_auth_state',
          JSON.stringify({ isAuthenticated: true, email: emailLower })
        );
      } else if (typeof window !== 'undefined') {
        sessionStorage.setItem('edupulse_session_auth', 'true');
        localStorage.removeItem('edupulse_auth_state');
      }
    },
    logout: (state) => {
      state.isAuthenticated = false;
      state.loginError = null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('edupulse_auth_state');
        sessionStorage.removeItem('edupulse_session_auth');
      }
    },
    setLoginError: (state, action: PayloadAction<string | null>) => {
      state.loginError = action.payload;
    },
    setSelectedClassId: (state, action: PayloadAction<string>) => {
      state.selectedClassId = action.payload;
    },
    toggleClockInOut: (state) => {
      state.teacher.isDutyClockedIn = !state.teacher.isDutyClockedIn;
    },
    updateContactInfo: (
      state,
      action: PayloadAction<{ phone?: string; email?: string }>
    ) => {
      if (action.payload.phone) state.teacher.phone = action.payload.phone;
      if (action.payload.email) state.teacher.email = action.payload.email;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginTeacherThunk.pending, (state) => {
        state.loginError = null;
      })
      .addCase(loginTeacherThunk.fulfilled, (state, action) => {
        const user = action.payload.data;
        state.isAuthenticated = true;
        state.loginError = null;
        state.rememberMe = !!action.payload.rememberMe;
        const classes = Array.isArray(user.assignedClasses) && user.assignedClasses.length > 0
          ? user.assignedClasses
          : initialAssignedClasses;
        state.teacher = {
          id: user.teacherProfile?.id || `TCH-${String(user.id).padStart(3, '0')}`,
          name: user.fullName || user.username,
          employeeId: user.teacherProfile?.employeeId || user.username,
          email: user.email || `${user.username}@school.pk`,
          phone: user.phone || '+92 300 1234567',
          designation: user.teacherProfile?.designation || 'Senior Faculty • STEM Division',
          avatar: DEFAULT_LIVE_TEACHER.avatar,
          term: 'Academic Year 2026–2027',
          timezone: 'PKT (UTC+5)',
          isDutyClockedIn: true,
          assignedClasses: classes
        };
        if (classes.length > 0) {
          state.selectedClassId = classes[0].id;
        }
        if (action.payload.rememberMe && typeof window !== 'undefined') {
          localStorage.setItem('edupulse_auth_state', JSON.stringify({ isAuthenticated: true, email: user.email }));
        }
      })
      .addCase(loginTeacherThunk.rejected, (state, action) => {
        state.loginError = (action.payload as string) || 'Invalid institutional email or password.';
        state.isAuthenticated = false;
      })
      .addCase(checkTeacherSessionThunk.fulfilled, (state, action) => {
        const user = action.payload;
        if (user && user.id) {
          state.isAuthenticated = true;
          const classes = Array.isArray(user.assignedClasses) && user.assignedClasses.length > 0
            ? user.assignedClasses
            : initialAssignedClasses;
          state.teacher = {
            id: user.teacherProfile?.id || `TCH-${String(user.id).padStart(3, '0')}`,
            name: user.fullName || user.username,
            employeeId: user.teacherProfile?.employeeId || user.username,
            email: user.email || `${user.username}@school.pk`,
            phone: user.phone || '+92 300 1234567',
            designation: user.teacherProfile?.designation || 'Senior Faculty • STEM Division',
            avatar: DEFAULT_LIVE_TEACHER.avatar,
            term: 'Academic Year 2026–2027',
            timezone: 'PKT (UTC+5)',
            isDutyClockedIn: true,
            assignedClasses: classes
          };
          if (classes.length > 0) {
            state.selectedClassId = classes[0].id;
          }
        }
      })
      .addCase(logoutTeacherThunk.fulfilled, (state) => {
        state.isAuthenticated = false;
        state.loginError = null;
        if (typeof window !== 'undefined') {
          localStorage.removeItem('edupulse_auth_state');
          sessionStorage.removeItem('edupulse_session_auth');
        }
      });
  }
});

export const loginTeacherThunk = createAsyncThunk(
  'auth/loginTeacher',
  async (
    credentials: { identifier: string; password: string; rememberMe?: boolean },
    { rejectWithValue }
  ) => {
    try {
      const data = await requestApi<any>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: credentials.identifier,
          password: credentials.password
        })
      });
      return { data, rememberMe: credentials.rememberMe };
    } catch (err: any) {
      return rejectWithValue(err.message || 'Authentication failed. Please verify credentials.');
    }
  }
);

export const checkTeacherSessionThunk = createAsyncThunk(
  'auth/checkSession',
  async (_, { rejectWithValue }) => {
    try {
      const data = await requestApi<any>('/api/v1/auth/me');
      return data;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

export const logoutTeacherThunk = createAsyncThunk(
  'auth/logoutTeacher',
  async () => {
    try {
      await requestApi('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // quiet fallback
    }
  }
);

export const {
  login,
  logout,
  setLoginError,
  setSelectedClassId,
  toggleClockInOut,
  updateContactInfo,
} = authSlice.actions;

export default authSlice.reducer;
