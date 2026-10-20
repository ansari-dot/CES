import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceSubmissionLog,
  CorrectionVoucher,
} from '../../types';
import { requestApi } from '../../services/api';

interface AttendanceState {
  currentLessonId: string;
  isLocked: boolean;
  remarksExpanded: boolean;
  roster: AttendanceRecord[];
  submittedLogs: AttendanceSubmissionLog[];
  correctionVouchers: CorrectionVoucher[];
  isSubmitModalOpen: boolean;
  isCorrectionDrawerOpen: boolean;
  selectedCorrectionLogId: string;
  loading: boolean;
  error: string | null;
}

const initialRoster: AttendanceRecord[] = [];

const initialSubmittedLogs: AttendanceSubmissionLog[] = [];

export const fetchLessonRosterThunk = createAsyncThunk(
  'attendance/fetchLessonRoster',
  async (lessonId: number | string, { rejectWithValue }) => {
    try {
      const numLessonId = typeof lessonId === 'string' ? parseInt(lessonId.replace(/\D/g, ''), 10) || 1 : lessonId;
      const res = await requestApi<any>(`/api/v1/attendance/lessons/${numLessonId}/roster`);
      return res;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch roster');
    }
  }
);

export const fetchClassRosterThunk = createAsyncThunk(
  'attendance/fetchClassRoster',
  async (classId: number | string, { rejectWithValue }) => {
    try {
      const numClassId = typeof classId === 'string' ? parseInt(classId.replace(/\D/g, ''), 10) || 1 : classId;
      const res = await requestApi<any>(`/api/v1/attendance/classes/${numClassId}/roster`);
      return res;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch class roster');
    }
  }
);

export const submitAttendanceThunk = createAsyncThunk(
  'attendance/submitAttendance',
  async (
    payload: {
      lessonId: number | string;
      records: { studentId: number | string; status: AttendanceStatus; remark?: string }[];
    },
    { rejectWithValue }
  ) => {
    try {
      const numLessonId = typeof payload.lessonId === 'string' ? parseInt(payload.lessonId.replace(/\D/g, ''), 10) || 1 : payload.lessonId;
      const formattedRecords = payload.records.map((r) => ({
        studentId: typeof r.studentId === 'string' ? parseInt(r.studentId.replace(/\D/g, ''), 10) || 35 : r.studentId,
        status: r.status.toUpperCase() as 'PRESENT' | 'ABSENT' | 'LATE' | 'LEAVE',
        remark: r.remark || ''
      }));

      const res = await requestApi<any>(`/api/v1/attendance/lessons/${numLessonId}/submit`, {
        method: 'POST',
        body: JSON.stringify({ records: formattedRecords })
      });
      return { res, lessonId: String(numLessonId), records: payload.records };
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to submit attendance');
    }
  }
);

export const fetchCorrectionVouchersThunk = createAsyncThunk(
  'attendance/fetchCorrectionVouchers',
  async (_, { rejectWithValue }) => {
    try {
      const res = await requestApi<any[]>('/api/v1/attendance/corrections');
      return Array.isArray(res) ? res : [];
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch correction vouchers');
    }
  }
);

export const submitCorrectionVoucherThunk = createAsyncThunk(
  'attendance/submitCorrectionVoucher',
  async (
    payload: {
      targetLogId: string;
      lessonId: number | string;
      studentId: number | string;
      studentName: string;
      correctionType: string;
      reason: string;
    },
    { rejectWithValue }
  ) => {
    try {
      const numLessonId = typeof payload.lessonId === 'string' ? parseInt(payload.lessonId.replace(/\D/g, ''), 10) || 1 : payload.lessonId;
      const numStudentId = typeof payload.studentId === 'string' ? parseInt(payload.studentId.replace(/\D/g, ''), 10) || 35 : payload.studentId;

      const res = await requestApi<any>('/api/v1/attendance/corrections', {
        method: 'POST',
        body: JSON.stringify({
          lessonId: numLessonId,
          studentId: numStudentId,
          proposedStatus: payload.correctionType.toUpperCase(),
          reason: payload.reason
        })
      });

      const newVoucher: CorrectionVoucher = {
        id: `VOUCHER-${res?.id || Date.now().toString().slice(-4)}`,
        targetLogId: payload.targetLogId,
        studentId: String(payload.studentId),
        studentName: payload.studentName,
        correctionType: payload.correctionType,
        reason: payload.reason,
        submittedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'pending',
      };

      return newVoucher;
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to submit correction voucher');
    }
  }
);

const initialState: AttendanceState = {
  currentLessonId: '',
  isLocked: false,
  remarksExpanded: false,
  roster: initialRoster,
  submittedLogs: initialSubmittedLogs,
  correctionVouchers: [],
  isSubmitModalOpen: false,
  isCorrectionDrawerOpen: false,
  selectedCorrectionLogId: '',
  loading: false,
  error: null,
};

export const attendanceSlice = createSlice({
  name: 'attendance',
  initialState,
  reducers: {
    setStudentStatus: (
      state,
      action: PayloadAction<{ studentId: string; status: AttendanceStatus }>
    ) => {
      const student = state.roster.find((s) => s.studentId === action.payload.studentId);
      if (student) {
        student.status = action.payload.status;
      }
    },
    setStudentRemark: (
      state,
      action: PayloadAction<{ studentId: string; remark: string }>
    ) => {
      const student = state.roster.find((s) => s.studentId === action.payload.studentId);
      if (student) {
        student.remark = action.payload.remark;
      }
    },
    markAllRemainingPresent: (state) => {
      state.roster.forEach((s) => {
        s.status = 'present';
      });
    },
    toggleRemarksExpanded: (state) => {
      state.remarksExpanded = !state.remarksExpanded;
    },
    openSubmitModal: (state) => {
      state.isSubmitModalOpen = true;
    },
    closeSubmitModal: (state) => {
      state.isSubmitModalOpen = false;
    },
    confirmFinalAttendance: (
      state,
      action: PayloadAction<{ className?: string; subject?: string; topic?: string; teacherName?: string; teacherId?: string } | undefined>
    ) => {
      state.isLocked = true;
      state.isSubmitModalOpen = false;

      const presentCount = state.roster.filter((r) => r.status === 'present').length;
      const absentCount = state.roster.filter((r) => r.status === 'absent').length;
      const lateCount = state.roster.filter((r) => r.status === 'late').length;
      const leaveCount = state.roster.filter((r) => r.status === 'leave').length;

      const newLog: AttendanceSubmissionLog = {
        id: `SUB-${Date.now().toString().slice(-6)}`,
        lessonId: state.currentLessonId,
        className: action.payload?.className || 'Class Session',
        subject: action.payload?.subject || 'General Subject',
        topic: action.payload?.topic || 'Class Attendance',
        date: 'Today',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        teacherName: action.payload?.teacherName || 'Faculty',
        teacherId: action.payload?.teacherId || '',
        presentCount,
        absentCount,
        lateCount,
        leaveCount,
        totalStudents: state.roster.length,
        isLocked: true,
      };

      state.submittedLogs.unshift(newLog);
    },
    openCorrectionDrawer: (state, action: PayloadAction<string>) => {
      state.selectedCorrectionLogId = action.payload;
      state.isCorrectionDrawerOpen = true;
    },
    closeCorrectionDrawer: (state) => {
      state.isCorrectionDrawerOpen = false;
    },
    submitCorrectionVoucher: (
      state,
      action: PayloadAction<{
        targetLogId: string;
        studentId: string;
        studentName: string;
        correctionType: string;
        reason: string;
      }>
    ) => {
      const newVoucher: CorrectionVoucher = {
        id: `VOUCHER-${Date.now().toString().slice(-4)}`,
        targetLogId: action.payload.targetLogId,
        studentId: action.payload.studentId,
        studentName: action.payload.studentName,
        correctionType: action.payload.correctionType,
        reason: action.payload.reason,
        submittedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'pending',
      };
      state.correctionVouchers.push(newVoucher);
      state.isCorrectionDrawerOpen = false;
    },
  },
  extraReducers: (builder) => {
    builder
      // Fetch Lesson Roster
      .addCase(fetchLessonRosterThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLessonRosterThunk.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.isLocked = Boolean(action.payload.isLocked);
          if (action.payload.lesson?.lessonId) {
            state.currentLessonId = String(action.payload.lesson.lessonId);
          }
          const list = action.payload.roster || action.payload.students || [];
          if (Array.isArray(list)) {
            state.roster = list.map((s: any) => ({
              studentId: String(s.studentId),
              rollNumber: s.rollNumber || '01',
              studentName: s.studentName,
              admissionId: s.admissionNumber || s.admissionId || `ADM-${s.studentId}`,
              avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120',
              status: (s.status ? s.status.toLowerCase() : 'present') as AttendanceStatus,
              remark: s.remarks || '',
              streak: (Number(s.attendanceRate) >= 95 || !s.attendanceRate) ? 'Perfect Attendance Streak' : 'Consistent',
              attendanceRate: Number(s.attendanceRate) || 96,
            }));
          }
        }
      })
      .addCase(fetchLessonRosterThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Fetch Class Roster
      .addCase(fetchClassRosterThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchClassRosterThunk.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.isLocked = Boolean(action.payload.isLocked);
          if (action.payload.lesson?.lessonId) {
            state.currentLessonId = String(action.payload.lesson.lessonId);
          }
          const list = action.payload.roster || action.payload.students || [];
          if (Array.isArray(list)) {
            state.roster = list.map((s: any) => ({
              studentId: String(s.studentId),
              rollNumber: s.rollNumber || '01',
              studentName: s.studentName,
              admissionId: s.admissionNumber || s.admissionId || `ADM-${s.studentId}`,
              avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=120',
              status: (s.status ? s.status.toLowerCase() : 'present') as AttendanceStatus,
              remark: s.remarks || '',
              streak: (Number(s.attendanceRate) >= 95 || !s.attendanceRate) ? 'Perfect Attendance Streak' : 'Consistent',
              attendanceRate: Number(s.attendanceRate) || 96,
            }));
          }
        }
      })
      .addCase(fetchClassRosterThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Submit Attendance
      .addCase(submitAttendanceThunk.fulfilled, (state, action) => {
        state.isLocked = true;
        state.isSubmitModalOpen = false;
        const presentCount = state.roster.filter((r) => r.status === 'present').length;
        const absentCount = state.roster.filter((r) => r.status === 'absent').length;
        const lateCount = state.roster.filter((r) => r.status === 'late').length;
        const leaveCount = state.roster.filter((r) => r.status === 'leave').length;

        const newLog: AttendanceSubmissionLog = {
          id: `SUB-${action.payload.lessonId}-${Date.now().toString().slice(-4)}`,
          lessonId: action.payload.lessonId,
          className: 'Class Session',
          subject: 'General Subject',
          topic: 'Class Attendance',
          date: 'Today',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          teacherName: 'Faculty',
          teacherId: '',
          presentCount,
          absentCount,
          lateCount,
          leaveCount,
          totalStudents: state.roster.length,
          isLocked: true,
        };
        state.submittedLogs.unshift(newLog);
      })
      // Fetch Correction Vouchers
      .addCase(fetchCorrectionVouchersThunk.fulfilled, (state, action) => {
        if (Array.isArray(action.payload)) {
          state.correctionVouchers = action.payload.map((v: any) => ({
            id: `COR-${v.id}`,
            targetLogId: `SUB-${v.lessonId}`,
            studentId: String(v.studentId),
            studentName: v.studentName || 'Student',
            correctionType: v.proposedStatus ? v.proposedStatus.toLowerCase() : 'present',
            reason: v.reason || '',
            submittedAt: v.createdAt ? new Date(v.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently',
            status: (v.status ? v.status.toLowerCase() : 'pending') as 'pending' | 'approved' | 'rejected',
          }));
        }
      })
      // Submit Correction Voucher
      .addCase(submitCorrectionVoucherThunk.fulfilled, (state, action) => {
        state.correctionVouchers.unshift(action.payload);
        state.isCorrectionDrawerOpen = false;
      });
  },
});

export const {
  setStudentStatus,
  setStudentRemark,
  markAllRemainingPresent,
  toggleRemarksExpanded,
  openSubmitModal,
  closeSubmitModal,
  confirmFinalAttendance,
  openCorrectionDrawer,
  closeCorrectionDrawer,
  submitCorrectionVoucher,
} = attendanceSlice.actions;

export default attendanceSlice.reducer;
