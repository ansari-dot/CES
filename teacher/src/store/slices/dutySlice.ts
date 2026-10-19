import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { DutyLogItem, DutySummary } from '../../types';
import { requestApi } from '../../services/api';

interface DutyAdjustmentRequest {
  id: string;
  dutyLogId: string;
  lessonName: string;
  currentDuration: number;
  requestedDuration: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedDate: string;
}

interface DutyState {
  summary: DutySummary;
  logs: DutyLogItem[];
  adjustmentRequests: DutyAdjustmentRequest[];
  isAdjustmentModalOpen: boolean;
  selectedLogForAdjustment: DutyLogItem | null;
  loading: boolean;
  error: string | null;
}

const initialSummary: DutySummary = {
  payrollPeriod: 'October 2026 Cycle',
  scheduledLessonsCount: 42,
  completedLessonsCount: 31,
  totalDutyHours: 24.5,
  targetDutyHours: 35.0,
  payrollStatus: 'On Track',
  hourlyRate: 'Rs. 2,500 / hr (Senior Faculty)',
};

const initialLogs: DutyLogItem[] = [
  {
    id: 'DUTY-01',
    date: 'Oct 19, 2026',
    lessonId: '1',
    className: 'Class 5',
    subject: 'Mathematics',
    scheduledTime: '09:00 AM – 09:45 AM',
    durationMinutes: 45,
    status: 'verified',
  },
  {
    id: 'DUTY-02',
    date: 'Oct 19, 2026',
    lessonId: '2',
    className: 'Class 5',
    subject: 'General Science',
    scheduledTime: '10:00 AM – 10:45 AM',
    durationMinutes: 45,
    status: 'verified',
  },
  {
    id: 'DUTY-03',
    date: 'Oct 18, 2026',
    lessonId: '3',
    className: 'Class 6',
    subject: 'General Science',
    scheduledTime: '11:00 AM – 11:45 AM',
    durationMinutes: 45,
    status: 'verified',
  },
];

export const fetchDutySummaryThunk = createAsyncThunk(
  'duty/fetchSummary',
  async (teacherId: number | string | void, { rejectWithValue }) => {
    try {
      const numTeacherId = teacherId ? (typeof teacherId === 'string' ? parseInt(teacherId.replace(/\D/g, ''), 10) || 45 : teacherId) : 45;

      const [dutyRes, draftsRes] = await Promise.all([
        requestApi<any>(`/api/v1/payroll/duty-summary/${numTeacherId}`).catch(() => null),
        requestApi<any[]>(`/api/v1/payroll/drafts?teacherId=${numTeacherId}`).catch(() => []),
      ]);

      return { duty: dutyRes, drafts: Array.isArray(draftsRes) ? draftsRes : [] };
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch duty summary');
    }
  }
);

const initialState: DutyState = {
  summary: initialSummary,
  logs: initialLogs,
  adjustmentRequests: [],
  isAdjustmentModalOpen: false,
  selectedLogForAdjustment: null,
  loading: false,
  error: null,
};

export const dutySlice = createSlice({
  name: 'duty',
  initialState,
  reducers: {
    openAdjustmentModal: (state, action: PayloadAction<DutyLogItem>) => {
      state.selectedLogForAdjustment = action.payload;
      state.isAdjustmentModalOpen = true;
    },
    closeAdjustmentModal: (state) => {
      state.isAdjustmentModalOpen = false;
      state.selectedLogForAdjustment = null;
    },
    submitAdjustmentRequest: (
      state,
      action: PayloadAction<{
        dutyLogId: string;
        lessonName: string;
        currentDuration: number;
        requestedDuration: number;
        reason: string;
      }>
    ) => {
      const newReq: DutyAdjustmentRequest = {
        id: `ADJ-${Date.now().toString().slice(-4)}`,
        dutyLogId: action.payload.dutyLogId,
        lessonName: action.payload.lessonName,
        currentDuration: action.payload.currentDuration,
        requestedDuration: action.payload.requestedDuration,
        reason: action.payload.reason,
        status: 'pending',
        submittedDate: 'Today',
      };
      state.adjustmentRequests.push(newReq);
      state.isAdjustmentModalOpen = false;
      state.selectedLogForAdjustment = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDutySummaryThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDutySummaryThunk.fulfilled, (state, action) => {
        state.loading = false;
        const { duty, drafts } = action.payload;

        if (duty) {
          state.summary = {
            payrollPeriod: duty.payrollMonth || 'October 2026 Cycle',
            scheduledLessonsCount: Number(duty.scheduledLessons) || 42,
            completedLessonsCount: Number(duty.completedLessons) || 31,
            totalDutyHours: Number(duty.verifiedTeachingHours) || 24.5,
            targetDutyHours: 35.0,
            payrollStatus: 'On Track',
            hourlyRate: 'Rs. 2,500 / hr (Senior Faculty)',
          };
        }

        if (drafts.length > 0) {
          const draft = drafts[0];
          state.summary.payrollStatus = (draft.status === 'Approved' ? 'On Track' : draft.status === 'Paid' ? 'On Track' : 'Pending Review') as any;
        }
      })
      .addCase(fetchDutySummaryThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { openAdjustmentModal, closeAdjustmentModal, submitAdjustmentRequest } = dutySlice.actions;
export default dutySlice.reducer;
