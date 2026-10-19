import { createSlice, PayloadAction, createAsyncThunk } from '@reduxjs/toolkit';
import {
  PeriodInfo,
  TeacherDutyRosterItem,
  SchoolClassSession,
} from '../../types';

export interface SchoolTimetableState {
  isLoading: boolean;
  lastFetchedAt: string | null;
  activeDay: string;
  activeViewTab: 'sessions' | 'duty_roster' | 'bell_schedule' | 'weekly_matrix';
  selectedGrade: number | 'all';
  selectedPeriodId: string | 'all';
  dutyFilterStatus: 'all' | 'upcoming' | 'checked_in' | 'completed';
  periods: PeriodInfo[];
  sessions: SchoolClassSession[];
  dutyRosters: TeacherDutyRosterItem[];
  currentLivePeriodId: string | null;
}

const initialPeriods: PeriodInfo[] = [
  {
    id: 'P-0',
    periodNumber: 0,
    name: 'Morning Homeroom & Attendance',
    startTime: '08:15 AM',
    endTime: '08:50 AM',
    durationMinutes: 35,
    type: 'homeroom',
    bellChime: true,
    icon: 'meeting_room',
    color: '#6366f1',
  },
  {
    id: 'P-1',
    periodNumber: 1,
    name: 'Period 1 • Core Instruction',
    startTime: '09:00 AM',
    endTime: '09:45 AM',
    durationMinutes: 45,
    type: 'instructional',
    bellChime: true,
    icon: 'calculate',
    color: '#3525cd',
  },
  {
    id: 'P-BREAK-1',
    periodNumber: 0,
    name: 'Morning Nutrition & Recess',
    startTime: '09:45 AM',
    endTime: '10:15 AM',
    durationMinutes: 30,
    type: 'break',
    bellChime: true,
    icon: 'bakery_dining',
    color: '#d97706',
  },
  {
    id: 'P-2',
    periodNumber: 2,
    name: 'Period 2 • Science & Discovery',
    startTime: '10:30 AM',
    endTime: '11:15 AM',
    durationMinutes: 45,
    type: 'instructional',
    bellChime: true,
    icon: 'science',
    color: '#059669',
  },
  {
    id: 'P-LUNCH',
    periodNumber: 0,
    name: 'Midday Lunch & Recreation',
    startTime: '11:15 AM',
    endTime: '12:15 PM',
    durationMinutes: 60,
    type: 'break',
    bellChime: true,
    icon: 'restaurant',
    color: '#ea580c',
  },
  {
    id: 'P-3',
    periodNumber: 3,
    name: 'Period 3 • Applied STEM & Math',
    startTime: '01:00 PM',
    endTime: '01:45 PM',
    durationMinutes: 45,
    type: 'instructional',
    bellChime: true,
    icon: 'memory',
    color: '#2563eb',
  },
  {
    id: 'P-4',
    periodNumber: 4,
    name: 'Period 4 • Experiments & Lab Practicals',
    startTime: '02:15 PM',
    endTime: '03:00 PM',
    durationMinutes: 45,
    type: 'instructional',
    bellChime: true,
    icon: 'biotech',
    color: '#7c3aed',
  },
  {
    id: 'P-DUTY-DISMISSAL',
    periodNumber: 5,
    name: 'Campus Dismissal & Bus Lane Departure',
    startTime: '03:00 PM',
    endTime: '03:30 PM',
    durationMinutes: 30,
    type: 'duty',
    bellChime: true,
    icon: 'directions_bus',
    color: '#0284c7',
  },
];

const initialSessions: SchoolClassSession[] = [
  {
    id: 'SES-01',
    periodId: 'P-1',
    periodNumber: 1,
    classId: '5-math-a',
    className: 'Class 5-A',
    grade: 5,
    section: 'A',
    subject: 'Mathematics',
    subjectCode: 'MTH-501',
    topic: 'Fraction Division & Reciprocal Logic',
    teacherId: 'TCH-2024-042',
    teacherName: 'Sarah Jenkins, M.Ed.',
    teacherAvatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDTrQl2B4wg4lWgPYqqgevaiCo3-9mQxTR4xfWpaJ3I-8i_atux_OqKZjYe4HL_Dor2EDf10hA1R87akVqx4w_HH-KIcmrPBJwnSN8Qqb01Gyba-PUya9Sv331n-YSrRPwu2yp6Eb8Hs-HyOb6M9ITT9zvamMBVnnMhe2sZ501gxVmj3PDoFGfQmSkkGHu-mpJW3Z_GyjAkRad8U0514qk38wWGHKw-sySFmFh_JiL-c72s1XvnsJHd',
    roomNumber: 'STEM 204B',
    roomType: 'classroom',
    zoomMeetingId: '849-2039-1102',
    zoomPasscode: 'MATH5A',
    dayOfWeek: 'Wednesday',
    startTime: '09:00 AM',
    endTime: '09:45 AM',
    status: 'completed',
    enrolledStudentsCount: 26,
    colorTag: 'indigo',
    subjectIcon: 'calculate',
  },
  {
    id: 'SES-02',
    periodId: 'P-2',
    periodNumber: 2,
    classId: '6-sci-b',
    className: 'Class 6-B',
    grade: 6,
    section: 'B',
    subject: 'General Science',
    subjectCode: 'SCI-602',
    topic: 'Solar & Wind Energy Systems',
    teacherId: 'TCH-2024-042',
    teacherName: 'Sarah Jenkins, M.Ed.',
    teacherAvatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDTrQl2B4wg4lWgPYqqgevaiCo3-9mQxTR4xfWpaJ3I-8i_atux_OqKZjYe4HL_Dor2EDf10hA1R87akVqx4w_HH-KIcmrPBJwnSN8Qqb01Gyba-PUya9Sv331n-YSrRPwu2yp6Eb8Hs-HyOb6M9ITT9zvamMBVnnMhe2sZ501gxVmj3PDoFGfQmSkkGHu-mpJW3Z_GyjAkRad8U0514qk38wWGHKw-sySFmFh_JiL-c72s1XvnsJHd',
    roomNumber: 'Science Lab 1',
    roomType: 'laboratory',
    zoomMeetingId: '849-2039-1102',
    zoomPasscode: 'SCI6B',
    dayOfWeek: 'Wednesday',
    startTime: '10:30 AM',
    endTime: '11:15 AM',
    status: 'live',
    enrolledStudentsCount: 28,
    colorTag: 'emerald',
    subjectIcon: 'energy_savings_leaf',
  },
  {
    id: 'SES-03',
    periodId: 'P-3',
    periodNumber: 3,
    classId: '4-sci-a',
    className: 'Class 4-A',
    grade: 4,
    section: 'A',
    subject: 'Mathematics',
    subjectCode: 'MTH-401',
    topic: 'Multiplication Tables & Rapid Recall',
    teacherId: 'TCH-2024-042',
    teacherName: 'Sarah Jenkins, M.Ed.',
    teacherAvatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDTrQl2B4wg4lWgPYqqgevaiCo3-9mQxTR4xfWpaJ3I-8i_atux_OqKZjYe4HL_Dor2EDf10hA1R87akVqx4w_HH-KIcmrPBJwnSN8Qqb01Gyba-PUya9Sv331n-YSrRPwu2yp6Eb8Hs-HyOb6M9ITT9zvamMBVnnMhe2sZ501gxVmj3PDoFGfQmSkkGHu-mpJW3Z_GyjAkRad8U0514qk38wWGHKw-sySFmFh_JiL-c72s1XvnsJHd',
    roomNumber: 'Room 102',
    roomType: 'classroom',
    zoomMeetingId: '712-4491-0021',
    zoomPasscode: 'MATH4A',
    dayOfWeek: 'Wednesday',
    startTime: '01:00 PM',
    endTime: '01:45 PM',
    status: 'scheduled',
    enrolledStudentsCount: 24,
    colorTag: 'blue',
    subjectIcon: 'functions',
  },
  {
    id: 'SES-04',
    periodId: 'P-4',
    periodNumber: 4,
    classId: '7-math-c',
    className: 'Class 7-C',
    grade: 7,
    section: 'C',
    subject: 'Science Lab',
    subjectCode: 'SCI-703',
    topic: 'Plant Cellular Respiration Microscopy',
    teacherId: 'TCH-2024-042',
    teacherName: 'Sarah Jenkins, M.Ed.',
    teacherAvatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDTrQl2B4wg4lWgPYqqgevaiCo3-9mQxTR4xfWpaJ3I-8i_atux_OqKZjYe4HL_Dor2EDf10hA1R87akVqx4w_HH-KIcmrPBJwnSN8Qqb01Gyba-PUya9Sv331n-YSrRPwu2yp6Eb8Hs-HyOb6M9ITT9zvamMBVnnMhe2sZ501gxVmj3PDoFGfQmSkkGHu-mpJW3Z_GyjAkRad8U0514qk38wWGHKw-sySFmFh_JiL-c72s1XvnsJHd',
    roomNumber: 'Science Lab 3',
    roomType: 'laboratory',
    zoomMeetingId: '994-1182-3847',
    zoomPasscode: 'LAB7C',
    dayOfWeek: 'Wednesday',
    startTime: '02:15 PM',
    endTime: '03:00 PM',
    status: 'scheduled',
    enrolledStudentsCount: 25,
    colorTag: 'purple',
    subjectIcon: 'biotech',
  },
  // Additional cross-grade sessions for visual richness
  {
    id: 'SES-05',
    periodId: 'P-1',
    periodNumber: 1,
    classId: '3-eng-a',
    className: 'Class 3-A',
    grade: 3,
    section: 'A',
    subject: 'English & Reading',
    subjectCode: 'ENG-301',
    topic: 'Phonetics & Reading Comprehension',
    teacherId: 'TCH-2024-018',
    teacherName: 'Marcus Vance, B.Ed.',
    teacherAvatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCGW2dnAqrNmJk1_AN0FdpGjN2J-I_ebxUiwfP2zSlTQnETA2pLQow4vOl0MPKth5UupojfUgfAUtqv8uWi2WtTxSsIvciqxVS-SO__QUorb_D4-VfxFI4thBt2_onxJZQHfMelTVHDiZbGa2DHIbk6z5U7HSWGyycUDnVCMxu-mkDgtnzc3ROpmOdrE72oZgwIXec9kNI-3AyAZ2RKUOdTESatMHj38_mhnc6a7-MYHvkxj7tB-peN',
    roomNumber: 'Room 105',
    roomType: 'classroom',
    dayOfWeek: 'Wednesday',
    startTime: '09:00 AM',
    endTime: '09:45 AM',
    status: 'completed',
    enrolledStudentsCount: 22,
    colorTag: 'amber',
    subjectIcon: 'auto_stories',
  },
  {
    id: 'SES-06',
    periodId: 'P-2',
    periodNumber: 2,
    classId: '8-rob-a',
    className: 'Class 8-A',
    grade: 8,
    section: 'A',
    subject: 'Robotics & STEM',
    subjectCode: 'ROB-801',
    topic: 'Sensor Feedback & Arduino Logic',
    teacherId: 'TCH-2024-009',
    teacherName: 'Elena Rostova, Ph.D.',
    teacherAvatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDoM35EAl5NZULLlKYnrZeD1-dsWKZNdDvmz6CHl-cCszT0j7SDxdm19IoO1UqtkAcROR5qGK2fbI6-ThPR4SvWUVj31OjGv44NUSVWiXhiokQOQ4dH9GHYhLVpIXtejEP-Y5Otvndzd9Ur6lngw4dGLRYbgvyuaqPGrZDroTLGS0wbBB_rqTS0FPSThQXwwGutlbrU0vM5Ao_zPbMCmTzdCWA5aUnZ56cGtPTIxzjwGC1jcmgLfG0K',
    roomNumber: 'Robotics Suite',
    roomType: 'laboratory',
    dayOfWeek: 'Wednesday',
    startTime: '10:30 AM',
    endTime: '11:15 AM',
    status: 'live',
    enrolledStudentsCount: 24,
    colorTag: 'rose',
    subjectIcon: 'smart_toy',
  },
];

const initialDutyRosters: TeacherDutyRosterItem[] = [
  {
    id: 'DUTY-ROST-01',
    dutyType: 'gate_welcome',
    dutyName: 'Morning Campus Arrival & Gate Greeting',
    zone: 'Main Archway West Gate',
    teacherId: 'TCH-2024-042',
    teacherName: 'Sarah Jenkins, M.Ed.',
    teacherAvatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDTrQl2B4wg4lWgPYqqgevaiCo3-9mQxTR4xfWpaJ3I-8i_atux_OqKZjYe4HL_Dor2EDf10hA1R87akVqx4w_HH-KIcmrPBJwnSN8Qqb01Gyba-PUya9Sv331n-YSrRPwu2yp6Eb8Hs-HyOb6M9ITT9zvamMBVnnMhe2sZ501gxVmj3PDoFGfQmSkkGHu-mpJW3Z_GyjAkRad8U0514qk38wWGHKw-sySFmFh_JiL-c72s1XvnsJHd',
    date: 'Oct 23, 2024',
    dayOfWeek: 'Wednesday',
    startTime: '08:00 AM',
    endTime: '08:30 AM',
    status: 'completed',
    notes: 'Bus convoys arrived on time; safety vests distributed.',
    icon: 'door_front',
    color: '#006c49',
  },
  {
    id: 'DUTY-ROST-02',
    dutyType: 'recess_supervision',
    dutyName: 'Morning Recess Yard Supervision',
    zone: 'East Field & Playground Zone A',
    teacherId: 'TCH-2024-018',
    teacherName: 'Marcus Vance, B.Ed.',
    teacherAvatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCGW2dnAqrNmJk1_AN0FdpGjN2J-I_ebxUiwfP2zSlTQnETA2pLQow4vOl0MPKth5UupojfUgfAUtqv8uWi2WtTxSsIvciqxVS-SO__QUorb_D4-VfxFI4thBt2_onxJZQHfMelTVHDiZbGa2DHIbk6z5U7HSWGyycUDnVCMxu-mkDgtnzc3ROpmOdrE72oZgwIXec9kNI-3AyAZ2RKUOdTESatMHj38_mhnc6a7-MYHvkxj7tB-peN',
    date: 'Oct 23, 2024',
    dayOfWeek: 'Wednesday',
    startTime: '09:45 AM',
    endTime: '10:15 AM',
    status: 'checked_in',
    notes: 'Grade 4-6 outdoor ball games monitored.',
    icon: 'sports_baseball',
    color: '#d97706',
  },
  {
    id: 'DUTY-ROST-03',
    dutyType: 'cafeteria_check',
    dutyName: 'Midday Cafeteria & Nutrition Hall',
    zone: 'Central Dining Pavilion (Tables 1-12)',
    teacherId: 'TCH-2024-042',
    teacherName: 'Sarah Jenkins, M.Ed.',
    teacherAvatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDTrQl2B4wg4lWgPYqqgevaiCo3-9mQxTR4xfWpaJ3I-8i_atux_OqKZjYe4HL_Dor2EDf10hA1R87akVqx4w_HH-KIcmrPBJwnSN8Qqb01Gyba-PUya9Sv331n-YSrRPwu2yp6Eb8Hs-HyOb6M9ITT9zvamMBVnnMhe2sZ501gxVmj3PDoFGfQmSkkGHu-mpJW3Z_GyjAkRad8U0514qk38wWGHKw-sySFmFh_JiL-c72s1XvnsJHd',
    date: 'Oct 23, 2024',
    dayOfWeek: 'Wednesday',
    startTime: '11:15 AM',
    endTime: '12:00 PM',
    status: 'upcoming',
    notes: 'Allergy-aware line supervision & tray clearing.',
    icon: 'lunch_dining',
    color: '#ea580c',
  },
  {
    id: 'DUTY-ROST-04',
    dutyType: 'lab_safety',
    dutyName: 'Science Lab Equipment & Chemical Audit',
    zone: 'STEM Wing Preparatory Suite 200',
    teacherId: 'TCH-2024-009',
    teacherName: 'Elena Rostova, Ph.D.',
    teacherAvatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDoM35EAl5NZULLlKYnrZeD1-dsWKZNdDvmz6CHl-cCszT0j7SDxdm19IoO1UqtkAcROR5qGK2fbI6-ThPR4SvWUVj31OjGv44NUSVWiXhiokQOQ4dH9GHYhLVpIXtejEP-Y5Otvndzd9Ur6lngw4dGLRYbgvyuaqPGrZDroTLGS0wbBB_rqTS0FPSThQXwwGutlbrU0vM5Ao_zPbMCmTzdCWA5aUnZ56cGtPTIxzjwGC1jcmgLfG0K',
    date: 'Oct 23, 2024',
    dayOfWeek: 'Wednesday',
    startTime: '01:45 PM',
    endTime: '02:15 PM',
    status: 'upcoming',
    notes: 'Post-experiment glassware sterilization & eye-wash test.',
    icon: 'sanitizer',
    color: '#7c3aed',
  },
  {
    id: 'DUTY-ROST-05',
    dutyType: 'bus_departure',
    dutyName: 'Afternoon Bus Lane & Parent Pickup',
    zone: 'South Bus Loop (Bays 1-8)',
    teacherId: 'TCH-2024-042',
    teacherName: 'Sarah Jenkins, M.Ed.',
    teacherAvatar:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDTrQl2B4wg4lWgPYqqgevaiCo3-9mQxTR4xfWpaJ3I-8i_atux_OqKZjYe4HL_Dor2EDf10hA1R87akVqx4w_HH-KIcmrPBJwnSN8Qqb01Gyba-PUya9Sv331n-YSrRPwu2yp6Eb8Hs-HyOb6M9ITT9zvamMBVnnMhe2sZ501gxVmj3PDoFGfQmSkkGHu-mpJW3Z_GyjAkRad8U0514qk38wWGHKw-sySFmFh_JiL-c72s1XvnsJHd',
    date: 'Oct 23, 2024',
    dayOfWeek: 'Wednesday',
    startTime: '03:00 PM',
    endTime: '03:30 PM',
    status: 'upcoming',
    notes: 'Walkie-talkie channel 4 with security officers.',
    icon: 'directions_bus',
    color: '#0284c7',
  },
];

const initialState: SchoolTimetableState = {
  isLoading: false,
  lastFetchedAt: 'Oct 23, 2024 08:30 AM',
  activeDay: 'Wednesday',
  activeViewTab: 'sessions',
  selectedGrade: 'all',
  selectedPeriodId: 'all',
  dutyFilterStatus: 'all',
  periods: initialPeriods,
  sessions: initialSessions,
  dutyRosters: initialDutyRosters,
  currentLivePeriodId: 'P-2',
};

// Simulated async thunk to fetch fresh school timetable data
export const fetchSchoolTimetable = createAsyncThunk(
  'schoolTimetable/fetchSchoolTimetable',
  async (_, { rejectWithValue }) => {
    try {
      // Simulate rapid network latency
      await new Promise((resolve) => setTimeout(resolve, 400));
      return {
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
    } catch {
      return rejectWithValue('Failed to load school timetable state.');
    }
  }
);

export const schoolTimetableSlice = createSlice({
  name: 'schoolTimetable',
  initialState,
  reducers: {
    setActiveDay: (state, action: PayloadAction<string>) => {
      state.activeDay = action.payload;
    },
    setActiveViewTab: (
      state,
      action: PayloadAction<'sessions' | 'duty_roster' | 'bell_schedule' | 'weekly_matrix'>
    ) => {
      state.activeViewTab = action.payload;
    },
    setSelectedGrade: (state, action: PayloadAction<number | 'all'>) => {
      state.selectedGrade = action.payload;
    },
    setSelectedPeriodId: (state, action: PayloadAction<string | 'all'>) => {
      state.selectedPeriodId = action.payload;
    },
    setDutyFilterStatus: (
      state,
      action: PayloadAction<'all' | 'upcoming' | 'checked_in' | 'completed'>
    ) => {
      state.dutyFilterStatus = action.payload;
    },
    updateDutyStatus: (
      state,
      action: PayloadAction<{
        dutyId: string;
        status: 'upcoming' | 'checked_in' | 'completed' | 'swapped';
      }>
    ) => {
      const duty = state.dutyRosters.find((d) => d.id === action.payload.dutyId);
      if (duty) {
        duty.status = action.payload.status;
      }
    },
    toggleSessionLive: (state, action: PayloadAction<string>) => {
      const session = state.sessions.find((s) => s.id === action.payload);
      if (session) {
        session.status = session.status === 'live' ? 'completed' : 'live';
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSchoolTimetable.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchSchoolTimetable.fulfilled, (state, action) => {
        state.isLoading = false;
        state.lastFetchedAt = `Today at ${action.payload.timestamp}`;
      })
      .addCase(fetchSchoolTimetable.rejected, (state) => {
        state.isLoading = false;
      });
  },
});

export const {
  setActiveDay,
  setActiveViewTab,
  setSelectedGrade,
  setSelectedPeriodId,
  setDutyFilterStatus,
  updateDutyStatus,
  toggleSessionLive,
} = schoolTimetableSlice.actions;

export default schoolTimetableSlice.reducer;
