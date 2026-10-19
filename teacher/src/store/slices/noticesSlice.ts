import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { AcademicNotice } from '../../types';
import { requestApi } from '../../services/api';

interface NoticesState {
  notices: AcademicNotice[];
  loading: boolean;
  error: string | null;
}

const initialNotices: AcademicNotice[] = [
  {
    id: '1',
    title: 'Term 2 Examination Timetable Draft Released',
    content:
      'Dean Miller published the draft timetable for grades 4–8. Please cross-check classroom allocations and submit conflict requests before Friday 3:00 PM.',
    author: 'Academic Administration',
    date: 'Today, 08:15 AM',
    targetClassId: 'all',
    targetClassName: 'All Assigned Classes',
    isUrgent: true,
    isPublished: true,
    category: 'Examination & Scheduling',
  },
  {
    id: '2',
    title: 'Zoom Virtual Classroom Maintenance Patch',
    content:
      'Virtual classroom links will experience a 15-minute sync window on Saturday Oct 26 from 11:00 PM – 11:15 PM PKT. No weekday impact expected.',
    author: 'IT Infrastructure Advisory',
    date: 'Yesterday, 04:30 PM',
    targetClassId: 'all',
    targetClassName: 'All Faculty',
    isUrgent: false,
    isPublished: true,
    category: 'Technical',
  },
];

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
      priority?: string;
      audience?: string;
      classId?: number;
    },
    { rejectWithValue }
  ) => {
    try {
      const res = await requestApi<any>('/api/v1/notices', {
        method: 'POST',
        body: JSON.stringify({
          title: payload.title,
          content: payload.content,
          priority: payload.priority || 'NORMAL',
          audience: payload.audience || 'ALL',
          classId: payload.classId || null,
        }),
      });
      return res;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to create notice');
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
  reducers: {
    addNotice: (state, action: PayloadAction<AcademicNotice>) => {
      state.notices.unshift(action.payload);
    },
    deleteNotice: (state, action: PayloadAction<string>) => {
      state.notices = state.notices.filter((n) => n.id !== action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNoticesThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNoticesThunk.fulfilled, (state, action) => {
        state.loading = false;
        if (Array.isArray(action.payload) && action.payload.length > 0) {
          state.notices = action.payload.map((n: any) => ({
            id: String(n.id),
            title: n.title,
            content: n.content,
            author: n.createdByName || n.createdBy || 'Administration',
            date: n.createdAt ? new Date(n.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent',
            targetClassId: n.classId ? String(n.classId) : 'all',
            targetClassName: n.classId ? `Class ${n.classId}` : 'All Assigned Classes',
            isUrgent: n.priority === 'URGENT' || n.priority === 'HIGH',
            isPublished: n.status === 'PUBLISHED',
            category: n.category || 'General',
          }));
        }
      })
      .addCase(fetchNoticesThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createNoticeThunk.fulfilled, (state, action) => {
        if (action.payload) {
          const n = action.payload;
          state.notices.unshift({
            id: String(n.id),
            title: n.title,
            content: n.content,
            author: n.createdByName || 'Faculty Member',
            date: 'Today',
            targetClassId: n.classId ? String(n.classId) : 'all',
            targetClassName: n.classId ? `Class ${n.classId}` : 'All Assigned Classes',
            isUrgent: n.priority === 'URGENT' || n.priority === 'HIGH',
            isPublished: true,
            category: 'General',
          });
        }
      });
  },
});

export const { addNotice, deleteNotice } = noticesSlice.actions;
export default noticesSlice.reducer;
