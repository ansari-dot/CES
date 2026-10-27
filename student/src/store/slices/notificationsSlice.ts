import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { requestApi } from '../../services/api';

export interface NotificationItem {
  id: string;
  category: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  iconType: 'video' | 'clipboard' | 'receipt' | 'check' | 'calendar' | 'star';
  link: string;
}

interface NotificationsState {
  unreadCount: number;
  activeFilter: string;
  items: NotificationItem[];
  loading: boolean;
}

const initialState: NotificationsState = {
  unreadCount: 0,
  activeFilter: 'All',
  items: [],
  loading: false,
};

function mapIconType(type: string): NotificationItem['iconType'] {
  const t = (type || '').toUpperCase();
  if (t.includes('CLASS') || t.includes('ZOOM') || t.includes('LESSON')) return 'video';
  if (t.includes('TASK') || t.includes('ASSIGN')) return 'clipboard';
  if (t.includes('FEE') || t.includes('CHALLAN') || t.includes('PAYMENT')) return 'receipt';
  if (t.includes('RESULT') || t.includes('GRADE')) return 'check';
  if (t.includes('BADGE') || t.includes('ACHIEVE') || t.includes('STAR')) return 'star';
  return 'calendar';
}

function mapCategory(type: string): string {
  const t = (type || '').toUpperCase();
  if (t.includes('CLASS') || t.includes('ZOOM') || t.includes('LESSON')) return 'Classes';
  if (t.includes('TASK') || t.includes('ASSIGN')) return 'Assignments';
  if (t.includes('FEE') || t.includes('CHALLAN') || t.includes('PAYMENT')) return 'Fees';
  if (t.includes('RESULT') || t.includes('GRADE')) return 'Results';
  if (t.includes('BADGE') || t.includes('ACHIEVE') || t.includes('STAR')) return 'Notices';
  return 'Notices';
}

/** Page that holds the record behind a notification; notices are read in place. */
function linkFor(recordType: string | undefined, type: string): string {
  switch (recordType) {
    case 'Task':
      return (type || '').toUpperCase().includes('RESULT') ? '/student/progress' : '/student/homework';
    case 'Submission':
      return '/student/progress';
    case 'Resource':
      return '/student/learning';
    case 'Achievement':
      return '/student/achievements';
    case 'Notice':
      return '';
    default:
      return '';
  }
}

export const fetchNotifications = createAsyncThunk('notifications/fetch', async (_, { rejectWithValue }) => {
  try {
    return await requestApi<any[]>('/api/v1/notices/notifications');
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

export const markNotificationRead = createAsyncThunk(
  'notifications/markRead',
  async (id: string, { rejectWithValue }) => {
    try {
      await requestApi(`/api/v1/notices/notifications/${id}/read`, { method: 'POST' });
      return id;
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

export const markAllNotificationsRead = createAsyncThunk('notifications/markAllRead', async (_, { rejectWithValue }) => {
  try {
    await requestApi('/api/v1/notices/notifications/read-all', { method: 'POST' });
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    setFilter: (state, action: PayloadAction<string>) => { state.activeFilter = action.payload; },
    // local-only fallback mark-read (used by Notifications page click before API resolves)
    markAsRead: (state, action: PayloadAction<string>) => {
      const item = state.items.find((i) => i.id === action.payload);
      if (item && !item.read) {
        item.read = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    },
    markAllAsRead: (state) => {
      state.items.forEach((i) => { i.read = true; });
      state.unreadCount = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state) => { state.loading = true; })
      .addCase(fetchNotifications.rejected, (state) => { state.loading = false; })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.loading = false;
        const list: any[] = Array.isArray(action.payload) ? action.payload : [];
        state.items = list.map((n) => {
          const when = n.createdAt || n.timestamp;
          return {
            id: String(n.id),
            category: mapCategory(n.type || ''),
            title: n.title || '',
            description: n.fullMessage || n.message || '',
            time: when ? new Date(when).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '',
            read: Boolean(n.isRead || n.is_read),
            iconType: mapIconType(n.type || ''),
            link: linkFor(n.relatedRecordType, n.type),
          };
        });
        state.unreadCount = state.items.filter((i) => !i.read).length;
      });

    builder.addCase(markNotificationRead.fulfilled, (state, action) => {
      const item = state.items.find((i) => i.id === action.payload);
      if (item && !item.read) {
        item.read = true;
        state.unreadCount = Math.max(0, state.unreadCount - 1);
      }
    });

    builder.addCase(markAllNotificationsRead.fulfilled, (state) => {
      state.items.forEach((i) => { i.read = true; });
      state.unreadCount = 0;
    });
  },
});

export const { setFilter, markAsRead, markAllAsRead } = notificationsSlice.actions;
export default notificationsSlice.reducer;
