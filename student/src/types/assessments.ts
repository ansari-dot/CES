export type QuestionType = 'MCQ' | 'SHORT_ANSWER' | 'LONG_ANSWER';
export type ExamType = 'MONTHLY_TEST' | 'MID_TERM' | 'FINAL_TERM' | 'CLASS_QUIZ';
export type TestStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'RESULTS_PUBLISHED';
export type AttemptStatus =
  | 'NOT_ATTEMPTED'
  | 'UPCOMING'
  | 'LIVE'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'AUTO_EXPIRED'
  | 'GRADED'
  | 'MISSED';

export interface QuestionOption {
  key: string;
  text: string;
}

export interface StudentTestAttempt {
  id: number;
  status: AttemptStatus;
  started_at: string;
  expires_at: string;
  submitted_at: string | null;
  mcq_score: number;
  subjective_score: number;
  total_score: number;
  is_passed: boolean | null;
  teacher_remarks: string | null;
}

export interface StudentMonthlyTest {
  id: number;
  class_id?: number;
  class_name?: string;
  subject_id?: number;
  subject_name?: string;
  subject_code?: string;
  teacher_name?: string;
  examType?: ExamType;
  exam_type?: ExamType;
  termName?: string;
  term_name?: string;
  dateSheetEntryId?: number | null;
  title: string;
  description?: string;
  duration_minutes?: number;
  durationMinutes?: number;
  total_marks?: number;
  totalMarks?: number;
  passing_marks?: number;
  passingMarks?: number;
  available_from?: string;
  availableFrom?: string;
  available_until?: string;
  availableUntil?: string;
  status?: TestStatus;
  testStatus?: TestStatus;
  attemptStatus?: AttemptStatus;
  isMissed?: boolean;
  isLive?: boolean;
  isUpcoming?: boolean;
  secondsUntilOpen?: number;
  secondsRemainingInWindow?: number;
  question_count?: number;
  attempt?: StudentTestAttempt | null;
  attemptId?: number | null;
  totalScore?: number | null;
  isPassed?: boolean | null;
}

export interface ExamQuestion {
  id: number;
  section_name?: string;
  section_instructions?: string | null;
  question_type: QuestionType;
  prompt: string;
  image_url: string | null;
  marks: number;
  options: QuestionOption[] | null;
  savedAnswer?: {
    selected_option: string | null;
    answer_text: string | null;
    attachment_url: string | null;
  } | null;
}

export interface ExamRoomData {
  attempt: {
    id: number;
    test_id: number;
    student_id: number;
    status: AttemptStatus;
    started_at: string;
    expires_at: string;
  };
  /** True when the attempt was already submitted or auto-expired */
  is_completed?: boolean;
  message?: string | null;
  remaining_seconds: number;
  test: {
    id: number;
    title: string;
    description: string | null;
    exam_type?: ExamType;
    term_name?: string | null;
    duration_minutes: number;
    total_marks: number;
    passing_marks: number;
    subject_name?: string;
    class_name?: string;
  };
  questions: ExamQuestion[];
}

export interface SaveDraftPayload {
  questionId: number;
  selectedOption?: string | null;
  answerText?: string | null;
}

export interface StudentTestResult {
  attempt: {
    id: number;
    test_id: number;
    student_id: number;
    status: AttemptStatus;
    started_at: string;
    submitted_at: string;
    mcq_score: number;
    subjective_score: number;
    total_score: number;
    is_passed: boolean;
    teacher_remarks: string | null;
  };
  test: StudentMonthlyTest;
  questions: {
    id: number;
    question_type: QuestionType;
    prompt: string;
    image_url: string | null;
    marks: number;
    options: QuestionOption[] | null;
    correct_option?: string | null;
    rubric_guide?: string | null;
    studentAnswer: {
      selected_option: string | null;
      answer_text: string | null;
      is_correct: boolean | null;
      marks_awarded: number;
      teacher_feedback: string | null;
    } | null;
  }[];
}

