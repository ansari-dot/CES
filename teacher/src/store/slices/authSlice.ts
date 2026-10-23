import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { TeacherProfile } from '../../types';
import { requestApi } from '../../services/api';

// Temporary password typed at login (memory only) so the first-login popup
// does not ask for it again.
let temporaryPassword: string | null = null;
export const getTemporaryPassword = () => temporaryPassword;

interface AuthState {
  isAuthenticated: boolean;
  teacher: TeacherProfile;
  selectedClassId: string; // 'all' or specific classId
  rememberMe: boolean;
  activeRole: 'teacher' | 'lead' | 'coordinator';
  loginError: string | null;
  // Account still has the temporary password issued at creation
  mustChangePassword: boolean;
  username: string;
}

export const initialAssignedClasses: any[] = [];

export const DEFAULT_LIVE_TEACHER: TeacherProfile = {
  id: '',
  name: 'Faculty Member',
  employeeId: '',
  email: '',
  phone: '',
  designation: 'Faculty',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120',
  term: 'Academic Year 2026–2027',
  timezone: 'PKT (UTC+5)',
  isDutyClockedIn: false,
  assignedClasses: [],
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
  selectedClassId: '',
  rememberMe: !!parsedAuth?.isAuthenticated,
  activeRole: 'teacher',
  loginError: null,
  mustChangePassword: false,
  username: '',
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
        state.mustChangePassword = Boolean(user.mustChangePassword);
        state.username = user.username || '';
        state.rememberMe = !!action.payload.rememberMe;
        const classes = Array.isArray(user.assignedClasses) ? user.assignedClasses : [];
        state.teacher = {
          id: user.teacherProfile?.id || (user.id ? `TCH-${String(user.id).padStart(3, '0')}` : ''),
          name: user.fullName || user.username || 'Faculty Member',
          employeeId: user.teacherProfile?.employeeId || user.username || '',
          email: user.email || '',
          phone: user.phone || '',
          designation: user.teacherProfile?.designation || 'Faculty Member',
          avatar: DEFAULT_LIVE_TEACHER.avatar,
          term: 'Academic Year 2026–2027',
          timezone: 'PKT (UTC+5)',
          isDutyClockedIn: false,
          assignedClasses: classes
        };
        state.selectedClassId = classes.length > 0 ? classes[0].id : '';
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
          state.mustChangePassword = Boolean(user.mustChangePassword);
          state.username = user.username || '';
          const classes = Array.isArray(user.assignedClasses) ? user.assignedClasses : [];
          state.teacher = {
            id: user.teacherProfile?.id || `TCH-${String(user.id).padStart(3, '0')}`,
            name: user.fullName || user.username || 'Faculty Member',
            employeeId: user.teacherProfile?.employeeId || user.username || '',
            email: user.email || '',
            phone: user.phone || '',
            designation: user.teacherProfile?.designation || 'Faculty Member',
            avatar: DEFAULT_LIVE_TEACHER.avatar,
            term: 'Academic Year 2026–2027',
            timezone: 'PKT (UTC+5)',
            isDutyClockedIn: false,
            assignedClasses: classes
          };
          state.selectedClassId = classes.length > 0 ? classes[0].id : '';
        }
      })
      .addCase(completeFirstPasswordSetupThunk.fulfilled, (state, action) => {
        state.mustChangePassword = Boolean(action.payload?.mustChangePassword);
      })
      .addCase(completeFirstPasswordSetupThunk.rejected, (state, action) => {
        // Password was changed but automatic sign-in failed: return to login
        if (action.payload === 'RELOGIN_REQUIRED') {
          state.isAuthenticated = false;
          state.mustChangePassword = false;
          state.loginError = 'Password updated. Please sign in with your new password.';
          if (typeof window !== 'undefined') localStorage.removeItem('edupulse_auth_state');
      .addCase(checkTeacherSessionThunk.rejected, (state) => {
        state.isAuthenticated = false;
        state.teacher = DEFAULT_LIVE_TEACHER;
        if (typeof window !== 'undefined') {
          localStorage.removeItem('edupulse_auth_state');
          sessionStorage.removeItem('edupulse_session_auth');
        }
      })
      .addCase(logoutTeacherThunk.fulfilled, (state) => {
        state.isAuthenticated = false;
        state.mustChangePassword = false;
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
      temporaryPassword = data?.mustChangePassword ? credentials.password : null;
      // Reject non-teacher accounts — students/admins must use their own portal
      if (data.role !== 'TEACHER' && data.role !== 'ADMIN') {
        await requestApi('/api/v1/auth/logout', { method: 'POST' }).catch(() => {});
        return rejectWithValue('This portal is for teachers only. Please use the correct portal for your role.');
      }
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

// First login: replace the temporary password, then sign in again with the new
// one (the server ends the old session when a password changes).
export const completeFirstPasswordSetupThunk = createAsyncThunk(
  'auth/completeFirstPasswordSetup',
  async (
    { username, currentPassword, newPassword }: { username: string; currentPassword: string; newPassword: string },
    { rejectWithValue }
  ) => {
    try {
      await requestApi('/api/v1/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword })
      });
    } catch (err: any) {
      return rejectWithValue(err.message || 'Could not set your password');
    }
    temporaryPassword = null;
    try {
      return await requestApi<any>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: username, password: newPassword })
      });
    } catch {
      return rejectWithValue('RELOGIN_REQUIRED');
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
