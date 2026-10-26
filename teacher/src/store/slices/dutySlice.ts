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
  async (teacherId: number | string | void, { getState, rejectWithValue }) => {
    try {
      const state: any = getState();
      const currentTeacherId = teacherId || state?.auth?.teacher?.id;
      let numTeacherId = 16;
      if (currentTeacherId) {
        if (typeof currentTeacherId === 'number') {
          numTeacherId = currentTeacherId;
        } else {
          const parsed = parseInt(String(currentTeacherId).replace(/\D/g, ''), 10);
          if (!isNaN(parsed) && parsed > 0) numTeacherId = parsed;
        }
      }

      const [dutyRes, draftsRes, dailyDutyRes] = await Promise.all([
        requestApi<any>(`/api/v1/payroll/duty-summary/${numTeacherId}`).catch(() => null),
        requestApi<any[]>(`/api/v1/payroll/drafts?teacherId=${numTeacherId}`).catch(() => []),
        requestApi<any>(`/api/v1/zoom/teachers/${numTeacherId}/daily-duty`).catch(() => null)
      ]);

      return {
        duty: dutyRes,
        drafts: Array.isArray(draftsRes) ? draftsRes : [],
        dailyDuty: dailyDutyRes
      };
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
        const { duty, drafts, dailyDuty } = action.payload;

        const liveMinutes = Number(dailyDuty?.totalLiveMinutes) || 0;
        const liveHours = Number(dailyDuty?.totalLiveHours) || 0;
        const activeLiveLessons = Array.isArray(dailyDuty?.lessons)
          ? dailyDuty.lessons.filter((l: any) => l.status === 'LIVE').length
          : 0;

        if (duty) {
          state.summary = {
            payrollPeriod: duty.payrollMonth || 'Current Cycle',
            scheduledLessonsCount: Number(duty.scheduledLessons) || 0,
            completedLessonsCount: Number(duty.completedLessons) || 0,
            totalDutyHours: Number(duty.verifiedTeachingHours) || 0,
            targetDutyHours: Number(duty.targetDutyHours) || 24,
            payrollStatus: (duty.completedLessons > 0 ? 'On Track' : 'No Records') as any,
            hourlyRate: duty.hourlyRate || 'Standard Faculty',
            liveDutyHours: liveHours,
            activeLiveCount: activeLiveLessons
          };
        } else if (dailyDuty) {
          state.summary.liveDutyHours = liveHours;
          state.summary.activeLiveCount = activeLiveLessons;
        }

        if (drafts.length > 0) {
          const draft = drafts[0];
          state.summary.payrollStatus = (draft.status === 'Approved' ? 'On Track' : draft.status === 'Paid' ? 'On Track' : 'Pending Review') as any;
        }

        if (dailyDuty && Array.isArray(dailyDuty.lessons)) {
          state.logs = dailyDuty.lessons.map((l: any) => ({
            id: `LOG-${l.id}`,
            date: dailyDuty.date || new Date().toISOString().split('T')[0],
            lessonId: `LES-${l.id}`,
            className: l.className || 'Class',
            subject: l.subjectName || 'Subject',
            scheduledTime: `${String(l.scheduledStart || '').substring(11, 16)} - ${String(l.scheduledEnd || '').substring(11, 16)}`,
            durationMinutes: l.trackedMinutes || 0,
            status: l.status === 'COMPLETED' ? ('verified' as const) : ('pending' as const)
          }));
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
