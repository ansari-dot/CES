import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { AcademicNotice } from '../../types';
import { requestApi } from '../../services/api';

interface NoticesState {
  notices: AcademicNotice[];
  loading: boolean;
  error: string | null;
}

const initialNotices: AcademicNotice[] = [];

function mapNotice(n: any): AcademicNotice {
  const roles: string[] = Array.isArray(n.targetRoles) ? n.targetRoles : [];
  const classIds: number[] | null = Array.isArray(n.targetClassIds) ? n.targetClassIds : null;
  return {
    id: String(n.id),
    title: n.title,
    content: n.content,
    author: n.createdBy || 'Administration',
    date: n.publishDate
      ? new Date(`${n.publishDate}T00:00:00`).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
      : '—',
    targetClassId: classIds && classIds.length === 1 ? String(classIds[0]) : 'all',
    targetClassName: n.audience || 'School-Wide',
    isUrgent: n.priority === 'Urgent' || n.priority === 'High',
    isPublished: n.status === 'Published',
    status: n.status,
    category: n.category || 'General',
    canManage: Boolean(n.canManage),
    recipients: roles.length === 3 ? 'Everyone' : roles.map((r) => `${r}s`).join(' & '),
    isRead: n.isRead === undefined ? undefined : Boolean(n.isRead),
    publishedAt: n.createdAt || n.publishDate || undefined,
  };
}

export const fetchNoticesThunk = createAsyncThunk(
  'notices/fetchNotices',
  async (_, { rejectWithValue }) => {
    try {
      const res = await requestApi<any[]>('/api/v1/notices');
      return Array.isArray(res) ? res : [];
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch notices');
    }
  }
);

export const createNoticeThunk = createAsyncThunk(
  'notices/createNotice',
  async (
    payload: {
      title: string;
      content: string;
      priority: 'Normal' | 'High';
      category: string;
      targetClassIds: number[];
    },
    { rejectWithValue }
  ) => {
    try {
      return await requestApi<any>('/api/v1/notices', {
        method: 'POST',
        body: JSON.stringify({
          title: payload.title,
          content: payload.content,
          priority: payload.priority,
          category: payload.category,
          targetClassIds: payload.targetClassIds,
          targetRoles: ['Student', 'Parent'],
        }),
      });
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to create notice');
    }
  }
);

export const archiveNoticeThunk = createAsyncThunk(
  'notices/archiveNotice',
  async (id: string, { rejectWithValue }) => {
    try {
      await requestApi(`/api/v1/notices/${Number(id)}/archive`, { method: 'POST' });
      return id;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to remove notice');
    }
  }
);

const initialState: NoticesState = {
  notices: initialNotices,
  loading: false,
  error: null,
};

export const noticesSlice = createSlice({
  name: 'notices',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchNoticesThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNoticesThunk.fulfilled, (state, action) => {
        state.loading = false;
        // Archived notices remain in the school history but are not shown in the stream
        state.notices = action.payload.filter((n: any) => n.status !== 'Archived').map(mapNotice);
      })
      .addCase(fetchNoticesThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createNoticeThunk.fulfilled, (state, action) => {
        if (action.payload) state.notices.unshift(mapNotice(action.payload));
      })
      .addCase(archiveNoticeThunk.fulfilled, (state, action) => {
        state.notices = state.notices.filter((n) => n.id !== action.payload);
      });
  },
});

export default noticesSlice.reducer;
