import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { LearningResource } from '../../types';
import { requestApi } from '../../services/api';

interface ResourcesState {
  resources: LearningResource[];
  selectedType: string;
  loading: boolean;
  error: string | null;
}

const initialResources: LearningResource[] = [
  {
    id: '1',
    title: 'Reciprocal Rules & Fraction Division Lecture Deck',
    description: 'Illustrated guide covering keep-change-flip mechanics, cross-cancellation, and common pitfalls.',
    classId: '5',
    className: 'Class 5',
    subject: 'Mathematics',
    type: 'slides',
    fileUrl: 'https://resources.edupulse.org/decks/fractions-reciprocals-ch4.pptx',
    fileSize: '4.2 MB',
    uploadDate: 'Oct 21, 2026',
    isPublished: true,
  },
  {
    id: '2',
    title: 'Sample Fraction Word Problems Worksheet #4',
    description: '10 practical real-world scenario problems with step-by-step answer key outline.',
    classId: '5',
    className: 'Class 5',
    subject: 'Mathematics',
    type: 'pdf',
    fileUrl: 'https://resources.edupulse.org/worksheets/fraction_quiz_sample.pdf',
    fileSize: '1.1 MB',
    uploadDate: 'Oct 20, 2026',
    isPublished: true,
  },
  {
    id: '3',
    title: 'Solar & Wind Energy Systems Lab Protocol',
    description: 'Class 6 STEM lab instructions: photovoltaic measurement and turbine rpm logging.',
    classId: '6',
    className: 'Class 6',
    subject: 'General Science',
    type: 'pdf',
    fileUrl: 'https://resources.edupulse.org/labs/solar_wind_lab_protocol.pdf',
    fileSize: '2.8 MB',
    uploadDate: 'Oct 19, 2026',
    isPublished: true,
  },
];

export const fetchResourcesThunk = createAsyncThunk(
  'resources/fetchResources',
  async (filters: { classId?: number; subjectId?: number } | void, { rejectWithValue }) => {
    try {
      const q = filters?.classId ? `?classId=${filters.classId}` : '';
      const res = await requestApi<any[]>(`/api/v1/tasks/resources${q}`);
      return Array.isArray(res) ? res : [];
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch resources');
    }
  }
);

export const createResourceThunk = createAsyncThunk(
  'resources/createResource',
  async (
    payload: {
      classId: number | string;
      subjectId?: number | string;
      title: string;
      description?: string;
      resourceType: string;
      fileUrl?: string;
      fileSize?: string;
      isPublished?: boolean;
    },
    { rejectWithValue }
  ) => {
    try {
      const res = await requestApi<any>('/api/v1/tasks/resources', {
        method: 'POST',
        body: JSON.stringify({
          classId: Number(payload.classId) || 5,
          subjectId: Number(payload.subjectId) || 1,
          title: payload.title,
          description: payload.description || '',
          resourceType: payload.resourceType.toUpperCase(),
          fileUrl: payload.fileUrl || 'https://resources.edupulse.org/notes/sample_doc.pdf',
          fileSize: payload.fileSize || '1.5 MB',
          isPublished: payload.isPublished !== undefined ? payload.isPublished : true,
        }),
      });
      return res;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to create resource');
    }
  }
);

export const deleteResourceThunk = createAsyncThunk(
  'resources/deleteResource',
  async (id: number | string, { rejectWithValue }) => {
    try {
      const numId = typeof id === 'string' ? parseInt(id.replace(/\D/g, ''), 10) || 1 : id;
      await requestApi(`/api/v1/tasks/resources/${numId}`, { method: 'DELETE' });
      return String(id);
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to delete resource');
    }
  }
);

const initialState: ResourcesState = {
  resources: initialResources,
  selectedType: 'all',
  loading: false,
  error: null,
};

export const resourcesSlice = createSlice({
  name: 'resources',
  initialState,
  reducers: {
    setSelectedType: (state, action: PayloadAction<string>) => {
      state.selectedType = action.payload;
    },
    addResource: (state, action: PayloadAction<LearningResource>) => {
      state.resources.unshift(action.payload);
    },
    togglePublish: (state, action: PayloadAction<string>) => {
      const res = state.resources.find((r) => r.id === action.payload);
      if (res) {
        res.isPublished = !res.isPublished;
      }
    },
    deleteResource: (state, action: PayloadAction<string>) => {
      state.resources = state.resources.filter((r) => r.id !== action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchResourcesThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchResourcesThunk.fulfilled, (state, action) => {
        state.loading = false;
        if (Array.isArray(action.payload) && action.payload.length > 0) {
          state.resources = action.payload.map((r: any) => ({
            id: String(r.id),
            title: r.title,
            description: r.description || '',
            classId: String(r.classId),
            className: r.className || `Class ${r.classNumber || r.classId}`,
            subject: r.subjectName || 'General',
            type: (r.resourceType ? r.resourceType.toLowerCase() : 'pdf') as any,
            fileUrl: r.fileUrl || '',
            fileSize: r.fileSize || '1.0 MB',
            uploadDate: r.createdAt ? new Date(r.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent',
            isPublished: Boolean(r.isPublished),
          }));
        }
      })
      .addCase(fetchResourcesThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createResourceThunk.fulfilled, (state, action) => {
        if (action.payload) {
          const r = action.payload;
          state.resources.unshift({
            id: String(r.id),
            title: r.title,
            description: r.description || '',
            classId: String(r.classId),
            className: r.className || `Class ${r.classNumber || r.classId}`,
            subject: r.subjectName || 'General',
            type: (r.resourceType ? r.resourceType.toLowerCase() : 'pdf') as any,
            fileUrl: r.fileUrl || '',
            fileSize: r.fileSize || '1.0 MB',
            uploadDate: 'Today',
            isPublished: Boolean(r.isPublished),
          });
        }
      })
      .addCase(deleteResourceThunk.fulfilled, (state, action) => {
        state.resources = state.resources.filter((r) => r.id !== action.payload);
      });
  },
});

export const { setSelectedType, addResource, togglePublish, deleteResource } = resourcesSlice.actions;
export default resourcesSlice.reducer;
