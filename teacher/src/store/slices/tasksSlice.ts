import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { Submission, Task } from '../../types';
import { requestApi } from '../../services/api';

interface TasksState {
  currentSubTab: 'active' | 'pending_grading' | 'archive' | 'create';
  selectedTaskId: string;
  selectedSubmissionId: string;
  tasks: Task[];
  submissions: Submission[];
  loading: boolean;
  submissionsLoading: boolean;
  error: string | null;
}

export interface RosterEntry {
  studentId: number;
  studentName: string;
  rollNo: string | null;
  admissionNo: string;
  submissionId: number | null;
  status: string;
  hasFile: boolean;
  marksAwarded: number | null;
  feedback: string;
}

const initialTasks: Task[] = [];

const initialSubmissions: Submission[] = [];

const formatDateTime = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Open';

export function mapTask(t: any): Task {
  return {
    id: String(t.id),
    title: t.title,
    instructions: t.instructions,
    classId: String(t.classId),
    className: t.className || `Class ${t.classNumber || t.classId}`,
    subject: t.subjectName || 'General',
    subjectId: t.subjectId != null ? String(t.subjectId) : undefined,
    assignedDate: t.assignedDate ? String(t.assignedDate).split('T')[0] : '—',
    deadline: formatDateTime(t.deadline),
    deadlineRaw: t.deadline || undefined,
    totalMarks: Number(t.totalMarks) || 0,
    gradingScale: (t.gradingScale ? t.gradingScale.toLowerCase() : 'numeric') as Task['gradingScale'],
    status: (t.status ? t.status.toLowerCase() : 'active') as Task['status'],
    taskType: (t.taskType || 'ASSIGNMENT') as Task['taskType'],
    submittedCount: Number(t.submittedCount) || 0,
    totalStudents: Number(t.totalStudents) || 0,
    gradedCount: Number(t.gradedCount) || 0,
    pendingCount: Number(t.pendingCount) || 0,
    lateCount: Number(t.lateCount) || 0,
    missingCount: Number(t.missingCount) || 0,
    handoutName: t.handoutName || undefined,
    handoutUrl: t.handoutUrl || undefined,
  };
}

function mapSubmission(s: any): Submission {
  let parsedRubric = s.rubricScores;
  if (typeof parsedRubric === 'string') {
    try {
      parsedRubric = JSON.parse(parsedRubric);
    } catch {
      parsedRubric = undefined;
    }
  }

  return {
    id: String(s.id),
    taskId: String(s.taskId),
    taskTitle: s.taskTitle || 'Assignment',
    studentId: String(s.studentId),
    studentName: s.studentName || 'Student',
    studentRoll: s.studentRoll || `#${s.studentId}`,
    studentAdmissionId: s.admissionId || `ADM-${s.studentId}`,
    studentAvatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(s.studentName || 'S')}&background=4f46e5&color=fff`,
    submittedAt: s.submittedAt
      ? new Date(s.submittedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '',
    status: (s.status ? s.status.toLowerCase() : 'pending') as Submission['status'],
    marksAwarded: s.marksAwarded !== null && s.marksAwarded !== undefined ? Number(s.marksAwarded) : undefined,
    maxMarks: Number(s.maxMarks) || 0,
    fileName: s.fileName || undefined,
    fileSize: s.fileSize || undefined,
    fileUrl: s.fileUrl || undefined,
    studentNotes: s.studentNotes || undefined,
    className: s.className || undefined,
    isLate: Boolean(s.isLate),
    feedback: s.feedback || '',
    rubricScores: parsedRubric || undefined,
    attemptNumber: 1,
  };
}

export const fetchTasksThunk = createAsyncThunk(
  'tasks/fetchTasks',
  async (filters: { classId?: number; subjectId?: number } | void, { rejectWithValue }) => {
    try {
      const q = filters?.classId ? `?classId=${filters.classId}` : '';
      const res = await requestApi<any[]>(`/api/v1/tasks${q}`);
      return Array.isArray(res) ? res : [];
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch tasks');
    }
  }
);

export const fetchSubmissionsThunk = createAsyncThunk(
  'tasks/fetchSubmissions',
  async (taskId: number | string | void, { rejectWithValue }) => {
    try {
      const numTaskId = taskId ? Number(taskId) : null;
      const q = numTaskId ? `?taskId=${numTaskId}` : '';
      const res = await requestApi<any[]>(`/api/v1/tasks/submissions${q}`);
      return Array.isArray(res) ? res : [];
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch submissions');
    }
  }
);

export const gradeSubmissionThunk = createAsyncThunk(
  'tasks/gradeSubmission',
  async (
    payload: {
      submissionId: number | string;
      marksAwarded: number;
      feedback: string;
      rubricScores?: { accuracy: number; steps: number; simplification: number };
      publish?: boolean;
    },
    { rejectWithValue }
  ) => {
    try {
      const res = await requestApi<any>(`/api/v1/tasks/submissions/${Number(payload.submissionId)}/grade`, {
        method: 'POST',
        body: JSON.stringify({
          marksAwarded: payload.marksAwarded,
          feedback: payload.feedback,
          rubricScores: payload.rubricScores,
          publish: payload.publish !== false,
        }),
      });
      return res;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to grade submission');
    }
  }
);

export const returnSubmissionThunk = createAsyncThunk(
  'tasks/returnSubmission',
  async (payload: { submissionId: number | string; note: string }, { rejectWithValue }) => {
    try {
      return await requestApi<any>(`/api/v1/tasks/submissions/${Number(payload.submissionId)}/return`, {
        method: 'POST',
        body: JSON.stringify({ note: payload.note }),
      });
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to return submission');
    }
  }
);

export const createTaskThunk = createAsyncThunk(
  'tasks/createTask',
  async (
    taskData: {
      classId: number;
      subjectId: number;
      title: string;
      instructions: string;
      deadline: string;
      totalMarks: number;
      gradingScale: string;
      taskType: string;
      status: 'ACTIVE' | 'DRAFT';
      notifyParents: boolean;
      handout?: File | null;
    },
    { rejectWithValue }
  ) => {
    try {
      const fd = new FormData();
      fd.append('classId', String(taskData.classId));
      fd.append('subjectId', String(taskData.subjectId));
      fd.append('title', taskData.title);
      fd.append('instructions', taskData.instructions);
      // datetime-local has no zone; send an absolute instant
      fd.append('deadline', new Date(taskData.deadline).toISOString());
      fd.append('totalMarks', String(taskData.totalMarks));
      fd.append('gradingScale', taskData.gradingScale);
      fd.append('taskType', taskData.taskType);
      fd.append('status', taskData.status);
      fd.append('notifyParents', String(taskData.notifyParents));
      if (taskData.handout) fd.append('handout', taskData.handout);

      return await requestApi<any>('/api/v1/tasks', { method: 'POST', body: fd });
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to create task');
    }
  }
);

export const updateTaskStatusThunk = createAsyncThunk(
  'tasks/updateTaskStatus',
  async (payload: { taskId: string; status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED' }, { rejectWithValue }) => {
    try {
      return await requestApi<any>(`/api/v1/tasks/${Number(payload.taskId)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: payload.status }),
      });
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to update task');
    }
  }
);

export const fetchTaskRosterThunk = createAsyncThunk(
  'tasks/fetchTaskRoster',
  async (taskId: string, { rejectWithValue }) => {
    try {
      const res = await requestApi<{ students: RosterEntry[] }>(`/api/v1/tasks/${Number(taskId)}/roster`);
      return Array.isArray(res?.students) ? res.students : [];
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to load class roster');
    }
  }
);

export const recordMarksThunk = createAsyncThunk(
  'tasks/recordMarks',
  async (
    payload: { taskId: string; publish: boolean; entries: { studentId: number; marksAwarded: number; feedback?: string }[] },
    { rejectWithValue }
  ) => {
    try {
      return await requestApi<any>(`/api/v1/tasks/${Number(payload.taskId)}/marks`, {
        method: 'POST',
        body: JSON.stringify({ entries: payload.entries, publish: payload.publish }),
      });
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to save marks');
    }
  }
);

const initialState: TasksState = {
  currentSubTab: 'active',
  selectedTaskId: '',
  selectedSubmissionId: '',
  tasks: initialTasks,
  submissions: initialSubmissions,
  loading: false,
  submissionsLoading: false,
  error: null,
};

export const tasksSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    setCurrentSubTab: (
      state,
      action: PayloadAction<'active' | 'pending_grading' | 'archive' | 'create'>
    ) => {
      state.currentSubTab = action.payload;
    },
    setSelectedTaskId: (state, action: PayloadAction<string>) => {
      state.selectedTaskId = action.payload;
    },
    setSelectedSubmissionId: (state, action: PayloadAction<string>) => {
      state.selectedSubmissionId = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Tasks
      .addCase(fetchTasksThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchTasksThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.tasks = action.payload.map(mapTask);

        if (state.tasks.length > 0) {
          if (!state.selectedTaskId || !state.tasks.find((task) => task.id === state.selectedTaskId)) {
            state.selectedTaskId = state.tasks[0].id;
          }
        } else {
          state.selectedTaskId = '';
        }
      })
      .addCase(fetchTasksThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch Submissions
      .addCase(fetchSubmissionsThunk.pending, (state) => {
        state.submissionsLoading = true;
      })
      .addCase(fetchSubmissionsThunk.rejected, (state) => {
        state.submissionsLoading = false;
      })
      .addCase(fetchSubmissionsThunk.fulfilled, (state, action) => {
        state.submissionsLoading = false;
        state.submissions = action.payload.map(mapSubmission);

        if (state.submissions.length > 0) {
          if (!state.selectedSubmissionId || !state.submissions.find((sub) => sub.id === state.selectedSubmissionId)) {
            state.selectedSubmissionId = state.submissions[0].id;
          }
        } else {
          state.selectedSubmissionId = '';
        }
      })
      // Grade / return: replace the submission with the server's record
      .addCase(gradeSubmissionThunk.fulfilled, (state, action) => {
        if (!action.payload) return;
        const updated = mapSubmission(action.payload);
        state.submissions = state.submissions.map((s) => (s.id === updated.id ? updated : s));
      })
      .addCase(returnSubmissionThunk.fulfilled, (state, action) => {
        if (!action.payload) return;
        const updated = mapSubmission(action.payload);
        state.submissions = state.submissions.map((s) => (s.id === updated.id ? updated : s));
      })
      // Create Task
      .addCase(createTaskThunk.fulfilled, (state, action) => {
        if (!action.payload) return;
        const created = mapTask(action.payload);
        state.tasks.unshift(created);
        state.selectedTaskId = created.id;
        state.currentSubTab = 'active';
      })
      .addCase(updateTaskStatusThunk.fulfilled, (state, action) => {
        if (!action.payload) return;
        const updated = mapTask(action.payload);
        state.tasks = state.tasks.map((t) => (t.id === updated.id ? updated : t));
      });
  },
});

export const {
  setCurrentSubTab,
  setSelectedTaskId,
  setSelectedSubmissionId,
} = tasksSlice.actions;

export default tasksSlice.reducer;
