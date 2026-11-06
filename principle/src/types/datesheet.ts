export type ExamType = 'MONTHLY_TEST' | 'MID_TERM' | 'FINAL_TERM';
export type DateSheetStatus = 'DRAFT' | 'PUBLISHED' | 'HIDDEN';

export interface DateSheetEntry {
  id?: number;
  date_sheet_id?: number;
  class_id: number;
  class_name?: string;
  grade_level?: number;
  subject_id: number;
  subject_name?: string;
  subject_code?: string;
  teacher_id?: number | null;
  teacher_name?: string | null;
  exam_date: string; // YYYY-MM-DD
  day_of_week: string; // e.g. "Monday"
  start_time: string; // e.g. "08:00 AM"
  end_time: string; // e.g. "09:30 AM"
  subject_type: string; // e.g. "Scholastic", "Co-Scholastic"
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

export interface ExaminationDateSheet {
  id: number;
  academic_session_id: number;
  session_name?: string;
  exam_type: ExamType;
  title: string;
  description?: string | null;
  status: DateSheetStatus;
  is_published: boolean;
  published_at?: string | null;
  created_by?: number;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  total_exams?: number;
  applicable_classes?: {
    id: number;
    name: string;
    examCount: number;
  }[];
  entries?: DateSheetEntry[];
  multipleExamsAttention?: MultipleExamsAttention[];
}

export interface CreateDateSheetPayload {
  academicSessionId?: number;
  examType: ExamType;
  title: string;
  description?: string | null;
  status?: DateSheetStatus;
  entries: {
    classId: number;
    subjectId: number;
    teacherId?: number | null;
    examDate: string;
    dayOfWeek?: string;
    startTime: string;
    endTime: string;
    subjectType?: string;
    instructions?: string | null;
    orderIndex?: number;
  }[];
}

