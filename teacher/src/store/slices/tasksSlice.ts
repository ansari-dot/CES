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
  error: string | null;
}

const initialTasks: Task[] = [
  {
    id: '13',
    title: 'Assignment 4: Dividing Fractions Practice',
    instructions:
      'Solve 10 problems on fraction division with step-by-step simplification. Invert divisor, multiply numerators and denominators, and express answers in lowest reduced terms.',
    classId: '5',
    className: 'Class 5',
    subject: 'Mathematics',
    assignedDate: 'Oct 18, 2026',
    deadline: 'Oct 24, 11:59 PM',
    totalMarks: 20,
    gradingScale: 'numeric',
    status: 'active',
    submittedCount: 2,
    totalStudents: 5,
    gradedCount: 1,
    pendingCount: 1,
    lateCount: 0,
    missingCount: 3,
    handoutName: 'Fractions_Assignment_4.pdf',
  },
];

const initialSubmissions: Submission[] = [
  {
    id: '1',
    taskId: '13',
    taskTitle: 'Assignment 4: Dividing Fractions Practice',
    studentId: '36',
    studentName: 'Bella Chen',
    studentRoll: '#02',
    studentAdmissionId: 'ADM-2026-002',
    studentAvatar:
      'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=120',
    submittedAt: 'Oct 19, 04:15 PM',
    status: 'pending',
    maxMarks: 20,
    marksAwarded: undefined,
    fileName: 'Bella_Chen_Math_Fractions_Homework.pdf',
    fileSize: '1.4 MB • 2 Pages',
    feedback: '',
    rubricScores: {
      accuracy: 9,
      steps: 5,
      simplification: 4,
    },
    attemptNumber: 1,
  },
  {
    id: '2',
    taskId: '13',
    taskTitle: 'Assignment 4: Dividing Fractions Practice',
    studentId: '35',
    studentName: 'Aiden Cooper',
    studentRoll: '#01',
    studentAdmissionId: 'ADM-2026-001',
    studentAvatar:
      'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=120',
    submittedAt: 'Oct 19, 02:40 PM',
    status: 'graded',
    marksAwarded: 19,
    maxMarks: 20,
    fileName: 'Aiden_Cooper_HW4_Fractions.pdf',
    fileSize: '2.1 MB • 3 Pages',
    feedback: 'Splendid mastery of reciprocal operations and neat cross-simplifications!',
    rubricScores: {
      accuracy: 10,
      steps: 5,
      simplification: 4,
    },
    attemptNumber: 1,
  },
];

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
      const numTaskId = taskId ? (typeof taskId === 'string' ? parseInt(taskId.replace(/\D/g, ''), 10) || null : taskId) : null;
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
    },
    { rejectWithValue }
  ) => {
    try {
      const numSubId = typeof payload.submissionId === 'string' ? parseInt(payload.submissionId.replace(/\D/g, ''), 10) || 1 : payload.submissionId;
      const res = await requestApi<any>(`/api/v1/tasks/submissions/${numSubId}/grade`, {
        method: 'POST',
        body: JSON.stringify({
          marksAwarded: payload.marksAwarded,
          feedback: payload.feedback,
          rubricScores: payload.rubricScores
        })
      });
      return { ...payload, res };
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to grade submission');
    }
  }
);

export const createTaskThunk = createAsyncThunk(
  'tasks/createTask',
  async (taskData: Partial<Task> & { sessionId?: number; subjectId?: number }, { rejectWithValue }) => {
    try {
      const res = await requestApi<any>('/api/v1/tasks', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: taskData.sessionId || 1,
          classId: Number(taskData.classId) || 5,
          subjectId: taskData.subjectId || 1,
          title: taskData.title,
          instructions: taskData.instructions,
          assignedDate: taskData.assignedDate || new Date().toISOString().split('T')[0],
          deadline: taskData.deadline,
          totalMarks: Number(taskData.totalMarks) || 20,
          gradingScale: (taskData.gradingScale || 'numeric').toUpperCase(),
          handoutName: taskData.handoutName
        })
      });
      return res;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to create task');
    }
  }
);

const initialState: TasksState = {
  currentSubTab: 'pending_grading',
  selectedTaskId: '13',
  selectedSubmissionId: '1',
  tasks: initialTasks,
  submissions: initialSubmissions,
  loading: false,
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
    gradeSubmission: (
      state,
      action: PayloadAction<{
        submissionId: string;
        marksAwarded: number;
        feedback: string;
        rubricScores?: { accuracy: number; steps: number; simplification: number };
      }>
    ) => {
      const sub = state.submissions.find((s) => s.id === action.payload.submissionId);
      if (sub) {
        sub.status = 'graded';
        sub.marksAwarded = action.payload.marksAwarded;
        sub.feedback = action.payload.feedback;
        if (action.payload.rubricScores) {
          sub.rubricScores = action.payload.rubricScores;
        }
      }
      const task = state.tasks.find((t) => t.id === state.selectedTaskId);
      if (task) {
        task.gradedCount = state.submissions.filter((s) => s.status === 'graded').length;
        task.pendingCount = state.submissions.filter((s) => s.status === 'pending' || s.status === 'late').length;
      }
    },
    returnForResubmission: (
      state,
      action: PayloadAction<{ submissionId: string; note: string }>
    ) => {
      const sub = state.submissions.find((s) => s.id === action.payload.submissionId);
      if (sub) {
        sub.status = 'resubmit_requested';
        sub.feedback = action.payload.note;
      }
    },
    createNewTask: (state, action: PayloadAction<Task>) => {
      state.tasks.unshift(action.payload);
      state.currentSubTab = 'active';
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
        if (Array.isArray(action.payload) && action.payload.length > 0) {
          state.tasks = action.payload.map((t: any) => ({
            id: String(t.id),
            title: t.title,
            instructions: t.instructions,
            classId: String(t.classId),
            className: t.className || `Class ${t.classNumber || t.classId}`,
            subject: t.subjectName || 'General',
            assignedDate: t.assignedDate ? String(t.assignedDate).split('T')[0] : 'Recent',
            deadline: t.deadline ? String(t.deadline).split('T')[0] : 'Open',
            totalMarks: Number(t.totalMarks) || 20,
            gradingScale: (t.gradingScale ? t.gradingScale.toLowerCase() : 'numeric') as any,
            status: (t.status ? t.status.toLowerCase() : 'active') as any,
            submittedCount: Number(t.submittedCount) || 0,
            totalStudents: Number(t.totalStudents) || 5,
            gradedCount: Number(t.gradedCount) || 0,
            pendingCount: Number(t.pendingCount) || 0,
            lateCount: Number(t.lateCount) || 0,
            missingCount: Number(t.missingCount) || 0,
            handoutName: t.handoutName || undefined,
          }));

          if (!state.selectedTaskId || !state.tasks.find((task) => task.id === state.selectedTaskId)) {
            state.selectedTaskId = state.tasks[0].id;
          }
        }
      })
      .addCase(fetchTasksThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch Submissions
      .addCase(fetchSubmissionsThunk.fulfilled, (state, action) => {
        if (Array.isArray(action.payload) && action.payload.length > 0) {
          state.submissions = action.payload.map((s: any) => {
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
              taskTitle: s.taskTitle || 'Homework Assignment',
              studentId: String(s.studentId),
              studentName: s.studentName || 'Student',
              studentRoll: s.studentRoll || `#${s.studentId}`,
              studentAdmissionId: s.admissionId || `ADM-${s.studentId}`,
              studentAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120',
              submittedAt: s.submittedAt ? new Date(s.submittedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently',
              status: (s.status ? s.status.toLowerCase() : 'pending') as any,
              marksAwarded: s.marksAwarded !== null && s.marksAwarded !== undefined ? Number(s.marksAwarded) : undefined,
              maxMarks: Number(s.maxMarks) || 20,
              fileName: s.fileName || undefined,
              fileSize: s.fileSize || undefined,
              feedback: s.feedback || '',
              rubricScores: parsedRubric,
              attemptNumber: 1,
            };
          });

          if (!state.selectedSubmissionId || !state.submissions.find((sub) => sub.id === state.selectedSubmissionId)) {
            state.selectedSubmissionId = state.submissions[0].id;
          }
        }
      })
      // Grade Submission
      .addCase(gradeSubmissionThunk.fulfilled, (state, action) => {
        const sub = state.submissions.find((s) => s.id === String(action.payload.submissionId));
        if (sub) {
          sub.status = 'graded';
          sub.marksAwarded = action.payload.marksAwarded;
          sub.feedback = action.payload.feedback;
          if (action.payload.rubricScores) {
            sub.rubricScores = action.payload.rubricScores;
          }
        }
        const task = state.tasks.find((t) => t.id === state.selectedTaskId);
        if (task) {
          task.gradedCount = state.submissions.filter((s) => s.status === 'graded').length;
          task.pendingCount = state.submissions.filter((s) => s.status === 'pending' || s.status === 'late').length;
        }
      })
      // Create Task
      .addCase(createTaskThunk.fulfilled, (state, action) => {
        if (action.payload) {
          const t = action.payload;
          const created: Task = {
            id: String(t.id),
            title: t.title,
            instructions: t.instructions,
            classId: String(t.classId),
            className: t.className || `Class ${t.classNumber || t.classId}`,
            subject: t.subjectName || 'General',
            assignedDate: t.assignedDate ? String(t.assignedDate).split('T')[0] : 'Today',
            deadline: t.deadline ? String(t.deadline).split('T')[0] : 'Open',
            totalMarks: Number(t.totalMarks) || 20,
            gradingScale: (t.gradingScale ? t.gradingScale.toLowerCase() : 'numeric') as any,
            status: 'active',
            submittedCount: 0,
            totalStudents: 5,
            gradedCount: 0,
            pendingCount: 0,
            lateCount: 0,
            missingCount: 5,
            handoutName: t.handoutName || undefined,
          };
          state.tasks.unshift(created);
          state.selectedTaskId = created.id;
          state.currentSubTab = 'active';
        }
      });
  },
});

export const {
  setCurrentSubTab,
  setSelectedTaskId,
  setSelectedSubmissionId,
  gradeSubmission,
  returnForResubmission,
  createNewTask,
} = tasksSlice.actions;

export default tasksSlice.reducer;
