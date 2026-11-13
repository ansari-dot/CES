import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { NavTab, NotificationItem, ToastState } from '../../types';
import { requestApi } from '../../services/api';

interface UiState {
  currentTab: NavTab;
  searchQuery: string;
  isNotificationsOpen: boolean;
  isMobileSidebarOpen: boolean;
  notifications: NotificationItem[];
  toasts: ToastState[];
}

const initialNotifications: NotificationItem[] = [];

export const fetchTeacherNotificationsThunk = createAsyncThunk(
  'ui/fetchTeacherNotifications',
  async (_, { rejectWithValue }) => {
    try {
      const data = await requestApi<any[]>('/api/v1/notices/notifications');
      if (!Array.isArray(data)) return [];

      const mapped: NotificationItem[] = data.map((n: any) => {
        let type: NotificationItem['type'] = 'administrative';
        let targetTab: NavTab = 'dashboard';

        const rawType = (n.type || '').toLowerCase();
        const recType = (n.relatedRecordType || '').toLowerCase();

        if (rawType.includes('zoom') || recType.includes('zoom')) {
          type = 'zoom';
          targetTab = 'live-lessons';
        } else if (rawType.includes('attendance') || recType.includes('attendance')) {
          type = 'attendance';
          targetTab = 'student-attendance';
        } else if (rawType.includes('task') || recType.includes('task') || rawType.includes('submission')) {
          type = 'grading';
          targetTab = 'tasks-assignments';
        } else if (rawType.includes('timetable') || recType.includes('timetable') || rawType.includes('substitute')) {
          type = 'timetable';
          targetTab = 'timetable';
        } else if (rawType.includes('notice') || recType.includes('notice')) {
          type = 'administrative';
          targetTab = 'notices';
        }

        return {
          id: String(n.id),
          title: n.title,
          message: n.message,
          type,
          timestamp: n.timestamp ? new Date(n.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now',
          read: Boolean(n.isRead),
          targetTab,
          rawType: n.type || '',
          recordType: n.relatedRecordType || '',
          createdAt: n.createdAt || n.timestamp || undefined
        };
      });

      return mapped;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch operational notifications');
    }
  }
);

export const markNotificationReadThunk = createAsyncThunk(
  'ui/markNotificationRead',
  async (id: string) => {
    try {
      if (!id.startsWith('remind-5m-')) {
        await requestApi(`/api/v1/notices/notifications/${id}/read`, { method: 'POST' });
      }
    } catch (_) {}
    return id;
  }
);

export const markAllNotificationsReadThunk = createAsyncThunk(
  'ui/markAllNotificationsRead',
  async () => {
    try {
      await requestApi('/api/v1/notices/notifications/read-all', { method: 'POST' });
    } catch (_) {}
  }
);

const initialState: UiState = {
  currentTab: 'dashboard',
  searchQuery: '',
  isNotificationsOpen: false,
  isMobileSidebarOpen: false,
  notifications: initialNotifications,
  toasts: [],
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setCurrentTab: (state, action: PayloadAction<NavTab>) => {
      state.currentTab = action.payload;
      state.isMobileSidebarOpen = false;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    toggleMobileSidebar: (state) => {
      state.isMobileSidebarOpen = !state.isMobileSidebarOpen;
    },
    closeMobileSidebar: (state) => {
      state.isMobileSidebarOpen = false;
    },
    openMobileSidebar: (state) => {
      state.isMobileSidebarOpen = true;
    },
    toggleNotifications: (state) => {
      state.isNotificationsOpen = !state.isNotificationsOpen;
    },
    closeNotifications: (state) => {
      state.isNotificationsOpen = false;
    },
    addNotification: (state, action: PayloadAction<NotificationItem>) => {
      const exists = state.notifications.some((n) => n.id === action.payload.id);
      if (!exists) {
        state.notifications.unshift(action.payload);
      }
    },
    markNotificationAsRead: (state, action: PayloadAction<string>) => {
      const n = state.notifications.find((notif) => notif.id === action.payload);
      if (n) {
        n.read = true;
      }
    },
    markAllNotificationsAsRead: (state) => {
      state.notifications.forEach((n) => {
        n.read = true;
      });
    },
    addToast: (
      state,
      action: PayloadAction<{
        title?: string;
        message: string;
        type?: 'success' | 'error' | 'info';
      }>
    ) => {
      const newToast: ToastState = {
        id: `toast-${Date.now()}-${Math.random()}`,
        title: action.payload.title,
        message: action.payload.message,
        type: action.payload.type || 'success',
      };
      state.toasts.push(newToast);
    },
    removeToast: (state, action: PayloadAction<string>) => {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTeacherNotificationsThunk.fulfilled, (state, action) => {
        if (Array.isArray(action.payload)) {
          const incoming = action.payload;
          const localPreLesson = state.notifications.filter((n) => n.id.startsWith('remind-5m-'));
          const incomingIds = new Set(incoming.map((n) => n.id));
          const merged = [...incoming, ...localPreLesson.filter((n) => !incomingIds.has(n.id))];
          state.notifications = merged;
        }
      })
      .addCase(markNotificationReadThunk.fulfilled, (state, action) => {
        const notif = state.notifications.find((n) => n.id === action.payload);
        if (notif) notif.read = true;
      })
      .addCase(markAllNotificationsReadThunk.fulfilled, (state) => {
        state.notifications.forEach((n) => {
          n.read = true;
        });
      });
  },
});

export const {
  setCurrentTab,
  setSearchQuery,
  toggleMobileSidebar,
  closeMobileSidebar,
  openMobileSidebar,
  toggleNotifications,
  closeNotifications,
  addNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  addToast,
  removeToast,
} = uiSlice.actions;

export default uiSlice.reducer;

