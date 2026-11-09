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
      isLocked?: boolean;
    },
    { rejectWithValue }
  ) => {
    try {
      const numLessonId = typeof payload.lessonId === 'string' ? parseInt(payload.lessonId.replace(/\D/g, ''), 10) || 1 : payload.lessonId;
      const formattedRecords = payload.records.map((r) => {
        let st = (r.status || 'present').toUpperCase();
        if (st === 'PRESENT' || st === 'P') st = 'PRESENT';
        else if (st === 'ABSENT' || st === 'A') st = 'ABSENT';
        else if (st === 'LATE' || st === 'L') st = 'LATE';
        else if (st === 'LEAVE' || st === 'EXCUSED' || st === 'E') st = 'EXCUSED';
        return {
          studentId: typeof r.studentId === 'string' ? parseInt(r.studentId.replace(/\D/g, ''), 10) : r.studentId,
          status: st,
          remarks: r.remark || '',
          remark: r.remark || ''
        };
      }).filter((r) => Number.isFinite(r.studentId));

      const res = await requestApi<any>(`/api/v1/attendance/lessons/${numLessonId}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          records: formattedRecords,
          isLocked: payload.isLocked !== undefined ? payload.isLocked : true
        })
      });
      return {
        res,
        lessonId: String(numLessonId),
        records: payload.records,
        isLocked: payload.isLocked !== undefined ? payload.isLocked : true
      };
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to submit attendance');
    }
  }
);

export const fetchSubmittedLogsThunk = createAsyncThunk(
  'attendance/fetchSubmittedLogs',
  async (_, { rejectWithValue }) => {
    try {
      const res = await requestApi<any[]>('/api/v1/attendance/submissions');
      return Array.isArray(res) ? res : [];
    } catch (err: any) {
      return rejectWithValue(err.message || 'Failed to fetch submitted attendance records');
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
      const numLessonId = typeof payload.lessonId === 'string' ? parseInt(payload.lessonId.replace(/\D/g, ''), 10) : payload.lessonId;
      const numStudentId = typeof payload.studentId === 'string' ? parseInt(payload.studentId.replace(/\D/g, ''), 10) : payload.studentId;

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
    markAllAbsent: (state) => {
      state.roster.forEach((s) => {
        s.status = 'absent';
      });
    },
    markAllLate: (state) => {
      state.roster.forEach((s) => {
        s.status = 'late';
      });
    },
    markAllExcused: (state) => {
      state.roster.forEach((s) => {
        s.status = 'excused';
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
      const leaveCount = state.roster.filter((r) => r.status === 'excused' || r.status === 'leave').length;

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
            state.roster = list.map((s: any) => {
              let st: AttendanceStatus = 'present';
              const raw = (s.status || 'PRESENT').toUpperCase();
              if (raw === 'ABSENT' || raw === 'A') st = 'absent';
              else if (raw === 'LATE' || raw === 'L') st = 'late';
              else if (raw === 'EXCUSED' || raw === 'LEAVE' || raw === 'E') st = 'excused';
              else st = 'present';

              return {
                studentId: String(s.studentId),
                rollNumber: s.rollNumber || '01',
                studentName: s.studentName,
                admissionId: s.admissionNumber || s.admissionId || `ADM-${s.studentId}`,
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(s.studentName || 'Student')}&background=36348e&color=fff`,
                status: st,
                remark: s.remarks || s.remark || '',
                streak: (Number(s.attendanceRate) >= 95 || !s.attendanceRate) ? 'Perfect Attendance Streak' : 'Consistent',
                attendanceRate: Number(s.attendanceRate) || 96,
              };
            });
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
            state.roster = list.map((s: any) => {
              let st: AttendanceStatus = 'present';
              const raw = (s.status || 'PRESENT').toUpperCase();
              if (raw === 'ABSENT' || raw === 'A') st = 'absent';
              else if (raw === 'LATE' || raw === 'L') st = 'late';
              else if (raw === 'EXCUSED' || raw === 'LEAVE' || raw === 'E') st = 'excused';
              else st = 'present';

              return {
                studentId: String(s.studentId),
                rollNumber: s.rollNumber || '01',
                studentName: s.studentName,
                admissionId: s.admissionNumber || s.admissionId || `ADM-${s.studentId}`,
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(s.studentName || 'Student')}&background=36348e&color=fff`,
                status: st,
                remark: s.remarks || s.remark || '',
                streak: (Number(s.attendanceRate) >= 95 || !s.attendanceRate) ? 'Perfect Attendance Streak' : 'Consistent',
                attendanceRate: Number(s.attendanceRate) || 96,
              };
            });
          }
        }
      })
      .addCase(fetchClassRosterThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      // Submit Attendance
      .addCase(submitAttendanceThunk.fulfilled, (state, action) => {
        state.isLocked = action.payload.isLocked !== false;
        state.isSubmitModalOpen = false;
        const presentCount = state.roster.filter((r) => r.status === 'present').length;
        const absentCount = state.roster.filter((r) => r.status === 'absent').length;
        const lateCount = state.roster.filter((r) => r.status === 'late').length;
        const leaveCount = state.roster.filter((r) => r.status === 'excused' || r.status === 'leave').length;

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
          isLocked: action.payload.isLocked !== false,
        };
        state.submittedLogs.unshift(newLog);
      })
      // Fetch Submitted Logs (persistent history from the server)
      .addCase(fetchSubmittedLogsThunk.fulfilled, (state, action) => {
        if (Array.isArray(action.payload)) {
          state.submittedLogs = action.payload.map((s: any) => ({
            id: `SUB-${s.id}`,
            lessonId: String(s.lessonId),
            className: s.className || 'Class Session',
            subject: s.subjectName || 'Subject',
            topic: 'Class Attendance',
            date: s.lessonDate ? String(s.lessonDate).slice(0, 10) : 'Recent',
            time: s.submittedAt
              ? new Date(s.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
              : '',
            submittedAt: s.submittedAt
              ? `${String(s.lessonDate || s.submittedAt).slice(0, 10)} ${new Date(s.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : String(s.lessonDate || '').slice(0, 10),
            teacherName: 'You',
            teacherId: '',
            presentCount: Number(s.presentCount) || 0,
            absentCount: Number(s.absentCount) || 0,
            lateCount: Number(s.lateCount) || 0,
            leaveCount: Number(s.excusedCount) || 0,
            totalStudents: Number(s.totalEnrolled) || 0,
            isLocked: Boolean(s.isLocked),
          }));
        }
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
  markAllAbsent,
  markAllLate,
  markAllExcused,
  toggleRemarksExpanded,
  openSubmitModal,
  closeSubmitModal,
  confirmFinalAttendance,
  openCorrectionDrawer,
  closeCorrectionDrawer,
  submitCorrectionVoucher,
} = attendanceSlice.actions;

export default attendanceSlice.reducer;
