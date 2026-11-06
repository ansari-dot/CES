export type ExamType = 'MONTHLY_TEST' | 'MID_TERM' | 'FINAL_TERM';

export interface TeacherDateSheetEntry {
  id: number;
  date_sheet_id: number;
  class_id: number;
  class_name: string;
  grade_level?: number;
  subject_id: number;
  subject_name: string;
  subject_code?: string;
  teacher_id?: number | null;
  teacher_name?: string | null;
  exam_date: string; // YYYY-MM-DD
  day_of_week: string; // e.g. "Monday"
  start_time: string; // e.g. "08:00 AM"
  end_time: string; // e.g. "09:30 AM"
  subject_type: string; // e.g. "Scholastic"
  instructions?: string | null;
  order_index?: number;
}

export interface MultipleExamsAttention {
  classId: number;
  className?: string;
  examDate: string;
  dayOfWeek: string;
  exams: {
    subjectName: string;
    subjectCode?: string;
    startTime: string;
    endTime: string;
  }[];
}

export interface TeacherDateSheet {
  id: number;
  academic_session_id: number;
  session_name?: string;
  exam_type: ExamType;
  title: string;
  description?: string | null;
  status: 'PUBLISHED' | 'HIDDEN';
  published_at?: string | null;
  entries: TeacherDateSheetEntry[];
  multipleExamsAttention?: MultipleExamsAttention[];
}

export interface TeacherActiveDateSheetsResponse {
  teacherId: number;
  activeDateSheets: TeacherDateSheet[];
  popupAnnouncement: TeacherDateSheet | null;
}

