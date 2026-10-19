import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { NavTab, NotificationItem, ToastState } from '../../types';

interface UiState {
  currentTab: NavTab;
  searchQuery: string;
  isNotificationsOpen: boolean;
  isMobileSidebarOpen: boolean;
  notifications: NotificationItem[];
  toasts: ToastState[];
}

const initialNotifications: NotificationItem[] = [
  {
    id: 'NOTIF-01',
    title: 'Attendance Pending Submission',
    message: 'Period 1 (Class 5-A Mathematics) completed at 09:47 AM. Roster awaiting teacher sign-off.',
    type: 'attendance',
    timestamp: '25 min ago',
    read: false,
    targetTab: 'student-attendance',
  },
  {
    id: 'NOTIF-02',
    title: 'New Student Submission Received',
    message: 'Daniel Evans submitted Assignment 4 (+8h late). Review queue updated.',
    type: 'grading',
    timestamp: '1 hour ago',
    read: false,
    targetTab: 'submissions-grading',
  },
  {
    id: 'NOTIF-03',
    title: 'Term 2 Exam Timetable Draft',
    message: 'Dean Miller published draft exam schedule for Grades 4–7.',
    type: 'administrative',
    timestamp: '3 hours ago',
    read: false,
    targetTab: 'notices',
  },
  {
    id: 'NOTIF-04',
    title: 'Zoom Room Verified',
    message: 'Persistent Zoom Pro room 849-2039-1102 health check passed (18ms latency).',
    type: 'zoom',
    timestamp: 'Yesterday',
    read: true,
    targetTab: 'live-lessons',
  },
];

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
});

export const {
  setCurrentTab,
  setSearchQuery,
  toggleMobileSidebar,
  closeMobileSidebar,
  openMobileSidebar,
  toggleNotifications,
  closeNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  addToast,
  removeToast,
} = uiSlice.actions;

export default uiSlice.reducer;

