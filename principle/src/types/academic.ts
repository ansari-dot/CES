export interface AcademicSession {
  id: string;
  name: string; // e.g. "2024-2025"
  startDate: string;
  endDate: string;
  status: 'Draft' | 'Active' | 'Archived';
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  classNumber: number; // 1 to 8
  weeklyLessons: number;
  assignedTeacherIds: string[];
}

export interface SchoolClass {
  classNumber: number; // 1 to 8
  name: string; // e.g. "Class 1", "Class 8"
  academicSession: string;
  isActive: boolean;
  totalStudents: number;
  subjects: Subject[];
}
