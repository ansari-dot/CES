import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { requestApi } from '../../services/api';

export interface AttendanceRecord {
  id: string;
  date: string;
  subject: string;
  teacher: string;
  status: string;
}

export interface AttendanceStats {
  present: number;
  absent: number;
  late: number;
  leave: number;
  totalLessons: number;
  last30Days: string;
}

interface AttendanceState {
  overallPercentage: number;
  stats: AttendanceStats;
  timeline: string[];
  history: AttendanceRecord[];
  loading: boolean;
}

const initialState: AttendanceState = {
  overallPercentage: 0,
  stats: { present: 0, absent: 0, late: 0, leave: 0, totalLessons: 0, last30Days: '' },
  timeline: [],
  history: [],
  loading: false,
};

export const fetchAttendanceStats = createAsyncThunk('attendance/fetchStats', async (_, { rejectWithValue }) => {
  try {
    return await requestApi<any>('/api/v1/attendance/stats');
  } catch (err: any) {
    return rejectWithValue(err.message);
  }
});

const attendanceSlice = createSlice({
  name: 'attendance',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAttendanceStats.pending, (state) => { state.loading = true; })
      .addCase(fetchAttendanceStats.rejected, (state) => { state.loading = false; })
      .addCase(fetchAttendanceStats.fulfilled, (state, action) => {
        state.loading = false;
        const d = action.payload;
        if (!d) return;

        const present = Number(d.present || d.presentCount || 0);
        const absent = Number(d.absent || d.absentCount || 0);
        const late = Number(d.late || d.lateCount || 0);
        const leave = Number(d.leave || d.leaveCount || d.excused || 0);
        const total = present + absent + late + leave;
        // Same rule as the server and the parent portal: present + late over marked lessons
        const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

        state.overallPercentage = rate;
        state.stats = {
          present,
          absent,
          late,
          leave,
          totalLessons: total,
          last30Days: `${rate}% Present`,
        };

        // Build timeline from records if provided
        if (Array.isArray(d.records)) {
          state.history = d.records.slice(0, 30).map((r: any) => ({
            id: String(r.id),
            date: r.lessonDate || r.lesson_date || '',
            subject: r.subjectName || r.subject_name || '',
            teacher: r.teacherName || r.teacher_name || '',
            status: r.status === 'PRESENT' ? 'Present' : r.status === 'ABSENT' ? 'Absent' : r.status === 'LATE' ? 'Late' : 'Leave',
          }));
          state.timeline = d.records.slice(0, 30).map((r: any) => {
            switch (r.status) {
              case 'PRESENT': return 'present';
              case 'ABSENT': return 'absent';
              case 'LATE': return 'late';
              default: return 'leave';
            }
          });
        }
      });
  },
});

export default attendanceSlice.reducer;
