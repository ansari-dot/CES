export type QuestionType = 'MCQ' | 'SHORT_ANSWER' | 'LONG_ANSWER';
export type ExamType = 'MONTHLY_TEST' | 'MID_TERM' | 'FINAL_TERM' | 'CLASS_QUIZ';
export type TestStatus = 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'RESULTS_PUBLISHED';
export type AttemptStatus = 'NOT_ATTEMPTED' | 'IN_PROGRESS' | 'SUBMITTED' | 'AUTO_EXPIRED' | 'GRADED' | 'MISSED';

export interface QuestionOption {
  key: string;
  text: string;
}

export interface AssessmentQuestion {
  id?: number;
  testId?: number;
  sectionName?: string;
  sectionInstructions?: string | null;
  questionType: QuestionType;
  prompt: string;
  imageUrl?: string | null;
  marks: number;
  options?: QuestionOption[] | null;
  correctOption?: string | null;
  rubricGuide?: string | null;
  orderIndex?: number;
}

export interface MonthlyTest {
  id: number;
  academic_session_id: number;
  class_id: number;
  class_name?: string;
  grade?: number;
  section?: string;
  subject_id: number;
  subject_name?: string;
  teacher_id: number;
  teacher_name?: string;
  exam_type?: ExamType;
  date_sheet_entry_id?: number | null;
  /** Set when the quiz was drafted with AI; PENDING_REVIEW must be confirmed before publishing */
  ai_review_status?: 'NOT_APPLICABLE' | 'PENDING_REVIEW' | 'REVIEWED';
  results_published_at?: string | null;
  term_name?: string | null;
  title: string;
  description?: string;
  duration_minutes: number;
  total_marks: number;
  passing_marks: number;
  available_from: string;
  available_until: string;
  status: TestStatus;
  created_at: string;
  updated_at: string;
  question_count?: number;
  total_attempts?: number;
  submitted_count?: number;
  graded_count?: number;
}

export interface CreateTestPayload {
  academicSessionId?: number;
  classId: number;
  subjectId: number;
  examType?: ExamType;
  dateSheetEntryId?: number | null;
  termName?: string;
  title: string;
  description?: string;
  durationMinutes: number;
  totalMarks: number;
  passingMarks: number;
  availableFrom: string;
  availableUntil: string;
  status?: 'DRAFT' | 'PUBLISHED';
  questions: {
    sectionName?: string;
    sectionInstructions?: string | null;
    questionType: QuestionType;
    prompt: string;
    imageUrl?: string | null;
    marks: number;
    options?: QuestionOption[] | null;
    correctOption?: string | null;
    rubricGuide?: string | null;
  }[];
}

export interface SubmissionRosterItem {
  studentId: number;
  studentName: string;
  rollNumber: string;
  admissionNumber: string;
  avatar?: string;
  attemptId: number | null;
  status: AttemptStatus;
  startedAt: string | null;
  submittedAt: string | null;
  mcqScore: number;
  subjectiveScore: number;
  totalScore: number;
  isPassed: boolean | null;
  submissionTrigger: 'MANUAL' | 'AUTO_EXPIRED' | null;
  teacherRemarks: string | null;
}

export interface StudentAttemptDetail {
  attempt: {
    id: number;
    test_id: number;
    student_id: number;
    status: AttemptStatus;
    started_at: string;
    expires_at: string;
    submitted_at: string | null;
    mcq_score: number;
    subjective_score: number;
    total_score: number;
    is_passed: boolean | null;
    teacher_remarks: string | null;
    student_name: string;
    roll_number: string;
    admission_number: string;
  };
  test: MonthlyTest;
  questions: {
    id: number;
    question_type: QuestionType;
    prompt: string;
    image_url: string | null;
    marks: number;
    options: QuestionOption[] | null;
    correct_option: string | null;
    rubric_guide: string | null;
    studentAnswer: {
      selected_option: string | null;
      answer_text: string | null;
      attachment_url: string | null;
      is_correct: boolean | null;
      marks_awarded: number;
      teacher_feedback: string | null;
    } | null;
  }[];
}

export interface GradeQuestionPayload {
  questionId: number;
  marksAwarded: number;
  teacherFeedback?: string;
}

export interface GradeSubmissionPayload {
  grades: GradeQuestionPayload[];
  teacherRemarks?: string;
  /** Required by the server when changing a result that is already published to parents */
  correctionReason?: string;
}


// -------------------------------------------------------------
// AI Quiz Generator
// -------------------------------------------------------------
export type AiQuestionType = 'MCQ' | 'TRUE_FALSE' | 'FILL_IN_THE_BLANK' | 'SHORT_ANSWER';
export type AiDifficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'MIXED';

export interface AiStatus {
  configured: boolean;
  provider: string | null;
  questionTypes: AiQuestionType[];
  difficulties: AiDifficulty[];
  maxQuestions: number;
}

interface AiContext {
  classId: number;
  subjectId: number;
  topics: string[];
  syllabus?: string;
  instructions?: string;
  allowOutsideSyllabus?: boolean;
  idempotencyKey: string;
}

export interface AiGenerateQuizPayload extends AiContext {
  title: string;
  difficulty: AiDifficulty;
  questionCount: number;
  questionTypes: AiQuestionType[];
  totalMarks: number;
  durationMinutes: number;
}

export interface AiRegenerateQuestionPayload extends AiContext {
  difficulty: Exclude<AiDifficulty, 'MIXED'>;
  questionType: AiQuestionType;
  marks: number;
  existingQuestions: string[];
}

/** A drafted question in the quiz builder's format (maps onto the existing engine). */
export interface AiDraftQuestion {
  sectionName: string;
  questionType: QuestionType;
  prompt: string;
  marks: number;
  options: QuestionOption[];
  correctOption: string;
  rubricGuide: string;
  aiMeta: { sourceType: AiQuestionType; difficulty: 'EASY' | 'MEDIUM' | 'HARD'; topic: string };
}

export interface AiGeneratedQuiz {
  generationId: number;
  cached: boolean;
  provider: string | null;
  model: string | null;
  difficulty: AiDifficulty;
  totalMarks: number;
  durationMinutes: number;
  title: string;
  questions: AiDraftQuestion[];
}
