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
  payrollPeriod: 'Current Cycle',
  scheduledLessonsCount: 0,
  completedLessonsCount: 0,
  totalDutyHours: 0,
  targetDutyHours: 0,
  payrollStatus: 'Pending Review',
  hourlyRate: 'Standard Faculty',
};

const initialLogs: DutyLogItem[] = [];

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
            payrollPeriod: duty.payrollMonth || 'Current Cycle',
            scheduledLessonsCount: Number(duty.scheduledLessons) || 0,
            completedLessonsCount: Number(duty.completedLessons) || 0,
            totalDutyHours: Number(duty.verifiedTeachingHours) || 0,
            targetDutyHours: Number(duty.targetDutyHours) || 0,
            payrollStatus: (duty.completedLessons > 0 ? 'On Track' : 'No Records') as any,
            hourlyRate: duty.hourlyRate || 'Standard Faculty',
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
