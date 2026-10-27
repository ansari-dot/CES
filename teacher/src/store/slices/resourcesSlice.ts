import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { LearningResource } from '../../types';
import { requestApi } from '../../services/api';

interface ResourcesState {
  resources: LearningResource[];
  selectedType: string;
  loading: boolean;
  error: string | null;
}

const initialResources: LearningResource[] = [];

// Backend resource types <-> portal resource types
const TYPE_TO_UI: Record<string, LearningResource['type']> = {
  PDF: 'pdf',
  SLIDES: 'slides',
  RECORDING: 'recording',
  DOCUMENT: 'notes',
  LINK: 'link',
};

const TYPE_TO_API: Record<LearningResource['type'], string> = {
  pdf: 'PDF',
  slides: 'SLIDES',
  recording: 'RECORDING',
  notes: 'DOCUMENT',
  link: 'LINK',
};

function mapResource(r: any): LearningResource {
  return {
    id: String(r.id),
    title: r.title,
    description: r.description || '',
    classId: String(r.classId),
    className: r.className || `Class ${r.classNumber || r.classId}`,
    subject: r.subjectName || 'General',
    type: TYPE_TO_UI[String(r.resourceType || '').toUpperCase()] || 'pdf',
    fileUrl: r.fileUrl || '',
    fileName: r.fileName || undefined,
    fileSize: r.fileSize || undefined,
    uploadDate: r.createdAt
      ? new Date(r.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
      : '—',
    isPublished: Boolean(r.isPublished),
  };
}

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
      classId: number;
      subjectId: number;
      title: string;
      description?: string;
      type: LearningResource['type'];
      file?: File | null;
      linkUrl?: string;
      isPublished: boolean;
    },
    { rejectWithValue }
  ) => {
    try {
      const fd = new FormData();
      fd.append('classId', String(payload.classId));
      fd.append('subjectId', String(payload.subjectId));
      fd.append('title', payload.title);
      fd.append('description', payload.description || '');
      fd.append('resourceType', TYPE_TO_API[payload.type]);
      fd.append('isPublished', String(payload.isPublished));
      if (payload.file) fd.append('file', payload.file);
      else if (payload.linkUrl) fd.append('fileUrl', payload.linkUrl);

      return await requestApi<any>('/api/v1/tasks/resources', { method: 'POST', body: fd });
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to upload resource');
    }
  }
);

export const toggleResourcePublishThunk = createAsyncThunk(
  'resources/togglePublish',
  async (payload: { id: string; isPublished: boolean }, { rejectWithValue }) => {
    try {
      return await requestApi<any>(`/api/v1/tasks/resources/${Number(payload.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublished: payload.isPublished }),
      });
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to update resource');
    }
  }
);

export const deleteResourceThunk = createAsyncThunk(
  'resources/deleteResource',
  async (id: string, { rejectWithValue }) => {
    try {
      await requestApi(`/api/v1/tasks/resources/${Number(id)}`, { method: 'DELETE' });
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
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchResourcesThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchResourcesThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.resources = action.payload.map(mapResource);
      })
      .addCase(fetchResourcesThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(createResourceThunk.fulfilled, (state, action) => {
        if (action.payload) state.resources.unshift(mapResource(action.payload));
      })
      .addCase(toggleResourcePublishThunk.fulfilled, (state, action) => {
        if (!action.payload) return;
        const updated = mapResource(action.payload);
        state.resources = state.resources.map((r) => (r.id === updated.id ? updated : r));
      })
      .addCase(deleteResourceThunk.fulfilled, (state, action) => {
        state.resources = state.resources.filter((r) => r.id !== action.payload);
      });
  },
});

export const { setSelectedType } = resourcesSlice.actions;
export default resourcesSlice.reducer;
