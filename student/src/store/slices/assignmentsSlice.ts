import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { requestApi } from '../../services/api';

export interface AssignmentItem {
  id: string;
  taskId?: number;
  title: string;
  subject: string;
  teacher: string;
  dueDate: string;
  dueBadge: string;
  marks: number;
  score?: number;
  status: 'Pending' | 'Submitted' | 'Graded' | 'Overdue';
  instructions?: string;
  rubric?: string;
  attachment?: string;
  attachmentSize?: string;
  hoursLeft?: number;
  submittedFile?: string;
  uploadProgress?: number;
  receiptId?: string;
  feedback?: string;
}

export interface Milestone {
  id: string;
  title: string;
  completed: boolean;
}

export interface ProjectItem {
  id: string;
  title: string;
  subject?: string;
  teacher?: string;
  totalMarks?: number;
  score?: string;
  status: string;
  dueDate?: string;
  submittedDate?: string;
  receipt?: string;
  description?: string;
  notes?: string;
  feedback?: string;
  milestones?: Milestone[];
}

interface AssignmentsState {
  filter: string;
  items: AssignmentItem[];
  projects: ProjectItem[];
  loading: boolean;
  submitting: boolean;
}

const initialState: AssignmentsState = {
  filter: 'All',
  items: [],
  projects: [],
  loading: false,
  submitting: false,
};

function hoursUntil(deadline: string): number {
  if (!deadline) return 0;
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.max(0, Math.round(diff / 3600000));
}

function dueBadge(deadline: string, status: string): string {
  if (status === 'SUBMITTED' || status === 'GRADED') return status === 'GRADED' ? 'Graded' : 'Submitted';
  const hours = hoursUntil(deadline);
  if (hours <= 0) return 'Overdue';
  if (hours <= 24) return 'Tomorrow';
  const days = Math.round(hours / 24);
  return `In ${days} days`;
}

function mapStatus(backendStatus: string): AssignmentItem['status'] {
  switch (backendStatus) {
    case 'SUBMITTED': return 'Submitted';
    case 'GRADED': return 'Graded';
    case 'OVERDUE': return 'Overdue';
    default: return 'Pending';
  }
}

export const fetchTasks = createAsyncThunk('assignments/fetchTasks', async (_, { rejectWithValue }) => {
  try {
    return await requestApi<any[]>('/api/v1/tasks');
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

export const submitTaskFile = createAsyncThunk(
  'assignments/submitTask',
  async ({ taskId, file, studentNotes }: { taskId: number; file: File | null; studentNotes?: string }, { rejectWithValue }) => {
    try {
      let body: FormData | string;
      let headers: Record<string, string> = {};
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        if (studentNotes) fd.append('studentNotes', studentNotes);
        body = fd;
      } else {
        body = JSON.stringify({ studentNotes });
        headers['Content-Type'] = 'application/json';
      }
      return await requestApi<any>(`/api/v1/tasks/${taskId}/submit`, {
        method: 'POST',
        body,
        headers,
      });
    } catch (err: any) {
      return rejectWithValue(err.message);
    }
  }
);

const assignmentsSlice = createSlice({
  name: 'assignments',
  initialState,
  reducers: {
    setFilter: (state, action: PayloadAction<string>) => {
      state.filter = action.payload;
    },
    // kept for optimistic local update after successful submit
    submitAssignment: (state, action: PayloadAction<{ id: string; fileName: string }>) => {
      const { id, fileName } = action.payload;
      const item = state.items.find((i) => i.id === id);
      if (item) {
        item.status = 'Submitted';
        item.submittedFile = fileName || 'submission_file.pdf';
        item.uploadProgress = 100;
        item.receiptId = `REC-${Math.floor(1000 + Math.random() * 9000)}`;
      }
    },
    toggleMilestone: (state, action: PayloadAction<{ projectId: string; milestoneId: string }>) => {
      const { projectId, milestoneId } = action.payload;
      const proj = state.projects.find((p) => p.id === projectId);
      if (proj?.milestones) {
        const ms = proj.milestones.find((m) => m.id === milestoneId);
        if (ms) ms.completed = !ms.completed;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTasks.pending, (state) => { state.loading = true; })
      .addCase(fetchTasks.rejected, (state) => { state.loading = false; })
      .addCase(fetchTasks.fulfilled, (state, action) => {
        state.loading = false;
        const tasks: any[] = Array.isArray(action.payload) ? action.payload : [];
        state.items = tasks.map((t) => {
          const submissionStatus = t.submissionStatus || 'PENDING';
          const status = mapStatus(submissionStatus);
          const deadline = t.dueDate || t.deadline || '';
          return {
            id: String(t.id),
            taskId: t.id,
            title: t.title || '',
            subject: t.subjectName || '',
            teacher: t.teacherName || '',
            dueDate: deadline ? new Date(deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '',
            dueBadge: dueBadge(deadline, submissionStatus),
            marks: t.maxMarks || t.totalMarks || t.total_marks || 20,
            score: t.marksObtained != null ? Number(t.marksObtained) : undefined,
            status,
            instructions: t.instructions || '',
            feedback: t.feedback || '',
            hoursLeft: hoursUntil(deadline),
          };
        });
      });

    builder
      .addCase(submitTaskFile.pending, (state) => { state.submitting = true; })
      .addCase(submitTaskFile.rejected, (state) => { state.submitting = false; })
      .addCase(submitTaskFile.fulfilled, (state, action) => {
        state.submitting = false;
        const sub = action.payload;
        if (!sub) return;
        const item = state.items.find((i) => i.taskId === sub.taskId || String(i.taskId) === String(sub.task_id));
        if (item) {
          item.status = 'Submitted';
          item.receiptId = `REC-${sub.id}`;
          item.uploadProgress = 100;
        }
      });
  },
});

export const { setFilter, submitAssignment, toggleMilestone } = assignmentsSlice.actions;
export default assignmentsSlice.reducer;
