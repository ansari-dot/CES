export type ExamType = 'MONTHLY_TEST' | 'CLASS_QUIZ' | 'MID_TERM' | 'FINAL_TERM';

export interface StudentDateSheetEntry {
  id: number;
  date_sheet_id: number;
  class_id: number;
  class_name: string;
  grade_level?: number;
  subject_id: number;
  subject_name: string;
  subject_code?: string;
  exam_date: string; // YYYY-MM-DD
  day_of_week: string; // e.g. "Monday"
  start_time: string; // e.g. "08:00 AM"
  end_time: string; // e.g. "09:30 AM"
  subject_type: string; // e.g. "Scholastic"
  instructions?: string | null;
  is_date_changed?: boolean;
  previous_exam_date?: string | null;
  previous_start_time?: string | null;
  previous_end_time?: string | null;
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

export interface StudentDateSheet {
  id: number;
  academic_session_id: number;
  session_name?: string;
  exam_type: ExamType;
  title: string;
  description?: string | null;
  published_at?: string | null;
  class_id: number;
  class_name: string;
  entries: StudentDateSheetEntry[];
  multipleExamsAttention?: MultipleExamsAttention[];
}

export interface StudentActiveDateSheetsResponse {
  studentClassId: number;
  activeDateSheets: StudentDateSheet[];
  popupAnnouncement: StudentDateSheet | null;
}

