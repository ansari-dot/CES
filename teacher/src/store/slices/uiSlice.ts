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

const initialNotifications: NotificationItem[] = [];

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

