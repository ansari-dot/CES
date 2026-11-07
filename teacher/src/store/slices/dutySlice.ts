import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import { DutyLogItem, DutySummary, DailyDutyItem } from '../../types';
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
  dailyBreakdown: DailyDutyItem[];
  selectedDateFilter: string;
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
  targetDutyHours: 24,
  payrollStatus: 'Pending Review',
  hourlyRate: 'Standard Faculty',
  todayTeachingHours: 0,
  todayTeachingMinutes: 0,
  todayCompletedCount: 0,
  todayScheduledCount: 0,
};

const initialLogs: DutyLogItem[] = [];

export const fetchDutySummaryThunk = createAsyncThunk(
  'duty/fetchSummary',
  async (teacherId: number | string | void, { getState, rejectWithValue }) => {
    try {
      const state: any = getState();
      const currentTeacherId =
        teacherId ||
        state?.auth?.teacher?.id ||
        state?.auth?.user?.teacherId ||
        state?.auth?.user?.id;

      let numTeacherId: number | null = null;
      if (currentTeacherId) {
        if (typeof currentTeacherId === 'number') {
          numTeacherId = currentTeacherId;
        } else {
          const parsed = parseInt(String(currentTeacherId).replace(/\D/g, ''), 10);
          if (!isNaN(parsed) && parsed > 0) numTeacherId = parsed;
        }
      }

      if (!numTeacherId) {
        return {
          duty: null,
          drafts: [],
          dailyDuty: null
        };
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
  dailyBreakdown: [],
  selectedDateFilter: 'all',
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
    setSelectedDateFilter: (state, action: PayloadAction<string>) => {
      state.selectedDateFilter = action.payload;
    },
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

        const totalTodayMinutes = Number(duty?.todayTeachingMinutes ?? dailyDuty?.totalTrackedMinutes ?? 0) || 0;
        const todayHours = Math.floor(totalTodayMinutes / 60);
        const todayMinutes = totalTodayMinutes % 60;
        const todayCompleted = Number(duty?.todayCompletedCount ?? dailyDuty?.totalCompletedLessons) || 0;
        const todayScheduled = Number(duty?.todayScheduledCount ?? dailyDuty?.totalScheduledLessons) || 0;
        const totalDutyHours = Number(duty?.verifiedTeachingHours) || Number((totalTodayMinutes / 60).toFixed(2)) || 0;

        if (duty) {
          state.summary = {
            payrollPeriod: duty.payrollMonth || 'Current Cycle',
            scheduledLessonsCount: Number(duty.scheduledLessons) || todayScheduled || 0,
            completedLessonsCount: Number(duty.completedLessons) || todayCompleted || 0,
            totalDutyHours,
            targetDutyHours: Number(duty.targetDutyHours) || 24,
            payrollStatus: (duty.completedLessons > 0 ? 'On Track' : 'No Records') as any,
            hourlyRate: duty.hourlyRate || 'Standard Faculty',
            baseSalary: duty.baseSalary || 45000,
            salaryModel: duty.salaryModel || 'Standard Hybrid',
            perLessonRate: duty.perLessonRate || 1500,
            perHourRate: duty.perHourRate || 1200,
            liveDutyHours: liveHours,
            activeLiveCount: activeLiveLessons,
            todayTeachingHours: todayHours,
            todayTeachingMinutes: todayMinutes,
            todayCompletedCount: todayCompleted,
            todayScheduledCount: todayScheduled
          };
        } else if (dailyDuty) {
          state.summary.totalDutyHours = Math.max(state.summary.totalDutyHours, todayHours);
          state.summary.liveDutyHours = liveHours;
          state.summary.activeLiveCount = activeLiveLessons;
          state.summary.todayTeachingHours = todayHours;
          state.summary.todayTeachingMinutes = todayMinutes;
          state.summary.todayCompletedCount = todayCompleted;
          state.summary.todayScheduledCount = todayScheduled;
        }

        if (drafts.length > 0) {
          const draft = drafts[0];
          state.summary.payrollStatus = (draft.status === 'Approved' ? 'On Track' : draft.status === 'Paid' ? 'On Track' : 'Pending Review') as any;
          if (draft.salaryModel) state.summary.salaryModel = draft.salaryModel;
          if (draft.verifiedHours) state.summary.totalDutyHours = Number(draft.verifiedHours);
        }

        // Daily breakdown
        state.dailyBreakdown = (duty?.dailyBreakdown && duty.dailyBreakdown.length > 0)
          ? duty.dailyBreakdown
          : (dailyDuty?.dailyBreakdown || []);

        // Raw lessons priority: duty.detailedLessons (whole period) > dailyDuty.lessons (single day)
        const rawLessons = (duty?.detailedLessons && duty.detailedLessons.length > 0)
          ? duty.detailedLessons
          : (dailyDuty?.lessons && Array.isArray(dailyDuty.lessons))
          ? dailyDuty.lessons
          : [];

        if (rawLessons.length > 0) {
          state.logs = rawLessons.map((l: any) => {
            const startMs = l.scheduledStart ? new Date(l.scheduledStart).getTime() : 0;
            const endMs = l.scheduledEnd ? new Date(l.scheduledEnd).getTime() : 0;
            const scheduledMins = l.scheduledMinutes || (startMs && endMs ? Math.round((endMs - startMs) / 60000) : 45);

            let status: 'verified' | 'pending' | 'disputed' | 'unverified' | 'flagged' | 'live' = 'pending';
            if (l.isLive || l.status === 'LIVE') {
              status = 'live';
            } else if (l.verificationStatus === 'REQUIRES_REVIEW' || l.verificationStatus === 'FLAGGED') {
              status = 'flagged';
            } else if (l.verificationStatus === 'REJECTED') {
              status = 'unverified';
            } else if (l.verificationStatus === 'VERIFIED' || (l.status === 'COMPLETED' && (Number(l.trackedMinutes) > 0 || Number(l.dutyMinutes) > 0))) {
              status = 'verified';
            } else if (l.verificationStatus === 'UNVERIFIED' || l.status === 'COMPLETED') {
              status = 'unverified';
            }

            const lessonDateStr = l.lessonDate || (l.scheduledStart ? String(l.scheduledStart).split('T')[0] : 'Today');

            return {
              id: `LOG-${l.id}`,
              date: lessonDateStr,
              lessonId: `LES-${l.id}`,
              className: l.className || `Class ${l.classNumber || l.classId}`,
              subject: l.subjectName || 'Subject',
              scheduledTime: `${String(l.scheduledStart || '').substring(11, 16)} - ${String(l.scheduledEnd || '').substring(11, 16)}`,
              durationMinutes: Number(l.dutyMinutes || l.trackedMinutes) || 0,
              scheduledMinutes: scheduledMins,
              status,
              verificationStatus: l.verificationStatus || (l.status === 'COMPLETED' ? 'VERIFIED' : 'PENDING'),
              verificationReason: l.verificationReason,
              isLive: Boolean(l.isLive || l.status === 'LIVE'),
              actualJoinTime: l.actualJoinTime,
              actualLeaveTime: l.actualLeaveTime
            };
          });
        }
      })
      .addCase(fetchDutySummaryThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setSelectedDateFilter, openAdjustmentModal, closeAdjustmentModal, submitAdjustmentRequest } = dutySlice.actions;
export default dutySlice.reducer;

