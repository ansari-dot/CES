import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { requestApi } from '../../services/api';

export interface ResourceItem {
  id: string;
  title: string;
  subject: string;
  teacher: string;
  type: string;
  details: string;
  actionText: string;
  iconType: 'video' | 'pdf' | 'slides' | 'link';
  fileUrl?: string;
  fileName?: string;
  description?: string;
}

interface ResourcesState {
  searchQuery: string;
  selectedSubject: string;
  selectedType: string;
  items: ResourceItem[];
  loading: boolean;
}

const initialState: ResourcesState = {
  searchQuery: '',
  selectedSubject: 'All',
  selectedType: 'All',
  items: [],
  loading: false,
};

function mapIconType(resourceType: string): ResourceItem['iconType'] {
  switch ((resourceType || '').toUpperCase()) {
    case 'RECORDING': return 'video';
    case 'SLIDES': return 'slides';
    case 'PDF':
    case 'DOCUMENT': return 'pdf';
    default: return 'link';
  }
}

export const fetchResources = createAsyncThunk('resources/fetchResources', async (_, { rejectWithValue }) => {
  try {
    return await requestApi<any[]>('/api/v1/tasks/resources');
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

const resourcesSlice = createSlice({
  name: 'resources',
  initialState,
  reducers: {
    setSearchQuery: (state, action: PayloadAction<string>) => { state.searchQuery = action.payload; },
    setSelectedSubject: (state, action: PayloadAction<string>) => { state.selectedSubject = action.payload; },
    setSelectedType: (state, action: PayloadAction<string>) => { state.selectedType = action.payload; },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchResources.pending, (state) => { state.loading = true; })
      .addCase(fetchResources.rejected, (state) => { state.loading = false; })
      .addCase(fetchResources.fulfilled, (state, action) => {
        state.loading = false;
        const list: any[] = Array.isArray(action.payload) ? action.payload : [];
        state.items = list.map((r) => {
          const iconType = mapIconType(r.resourceType || r.resource_type || '');
          const isLink = String(r.resourceType || '').toUpperCase() === 'LINK';
          const details = [
            r.resourceType || 'File',
            r.fileSize || '',
            r.createdAt ? `Uploaded ${new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}` : '',
          ].filter(Boolean).join(' · ');
          return {
            id: String(r.id),
            title: r.title || '',
            subject: r.subjectName || r.subject_name || '',
            teacher: r.uploadedByName || r.uploaded_by_name || '',
            type: r.resourceType || r.resource_type || 'File',
            details,
            actionText: isLink ? 'Open Link' : iconType === 'video' ? 'Open' : 'Open / Download',
            iconType,
            fileUrl: r.fileUrl || r.file_url || '',
            fileName: r.fileName || undefined,
            description: r.description || '',
          };
        });
      });
  },
});

export const { setSearchQuery, setSelectedSubject, setSelectedType } = resourcesSlice.actions;
export default resourcesSlice.reducer;
