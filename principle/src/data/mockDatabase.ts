import {
  UserProfile,
  Teacher,
  Student,
  Parent,
  AcademicSession,
  SchoolClass,
  TimetableLesson,
  ClassZoomMeeting,
  LessonAttendanceSummary,
  AttendanceCorrectionRequest,
  ClassFeeStructure,
  StudentConcession,
  MonthlyChallan,
  PaymentProofSubmission,
  TeacherSalaryDraft,
  SchoolNotice,
  OperationalNotification,
  AuditLogEntry,
  AcademicClassPerformance
} from '../types';

export interface SchoolDatabase {
  principalProfile: UserProfile;
  academicSessions: AcademicSession[];
  activeSession: string;
  classes: SchoolClass[];
  teachers: Teacher[];
  students: Student[];
  parents: Parent[];
  zoomMeetings: ClassZoomMeeting[];
  timetableLessons: TimetableLesson[];
  attendanceSummaries: LessonAttendanceSummary[];
  attendanceCorrections: AttendanceCorrectionRequest[];
  feeStructures: ClassFeeStructure[];
  concessions: StudentConcession[];
  challans: MonthlyChallan[];
  paymentProofs: PaymentProofSubmission[];
  salaryDrafts: TeacherSalaryDraft[];
  notices: SchoolNotice[];
  notifications: OperationalNotification[];
  auditLogs: AuditLogEntry[];
  academicPerformances: AcademicClassPerformance[];
}

export const initialDatabase: SchoolDatabase = {
  principalProfile: {
    id: 'USR-PRIN-01',
    name: 'Dr. Tariq Mahmood',
    email: 'principal@iqraonlineacademy.edu.pk',
    phone: '+92 300 8472910',
    role: 'Principal',
    designation: 'Principal & Operational Academic Director',
    accountStatus: 'Active',
    lastLogin: '2026-10-19T08:30:00Z',
    joiningDate: '2022-01-15'
  },

  academicSessions: [
    {
      id: 'SES-2024-2025',
      name: '2024-2025',
      startDate: '2024-04-01',
      endDate: '2025-03-31',
      status: 'Active'
    },
    {
      id: 'SES-2025-2026',
      name: '2025-2026',
      startDate: '2025-04-01',
      endDate: '2026-03-31',
      status: 'Draft'
    },
    {
      id: 'SES-2023-2024',
      name: '2023-2024',
      startDate: '2023-04-01',
      endDate: '2024-03-31',
      status: 'Archived'
    }
  ],

  activeSession: '2024-2025',

  classes: [
    {
      classNumber: 1,
      name: 'Class 1',
      academicSession: '2024-2025',
      isActive: true,
      totalStudents: 28,
      subjects: [
        { id: 'SUB-1-ENG', name: 'English', code: 'ENG-01', classNumber: 1, weeklyLessons: 5, assignedTeacherIds: ['TCH-02'] },
        { id: 'SUB-1-MTH', name: 'Mathematics', code: 'MTH-01', classNumber: 1, weeklyLessons: 5, assignedTeacherIds: ['TCH-01'] },
        { id: 'SUB-1-SCI', name: 'General Science', code: 'SCI-01', classNumber: 1, weeklyLessons: 4, assignedTeacherIds: ['TCH-01'] },
        { id: 'SUB-1-URD', name: 'Urdu', code: 'URD-01', classNumber: 1, weeklyLessons: 4, assignedTeacherIds: ['TCH-05'] },
        { id: 'SUB-1-ISL', name: 'Islamiat & Nazra', code: 'ISL-01', classNumber: 1, weeklyLessons: 3, assignedTeacherIds: ['TCH-04'] }
      ]
    },
    {
      classNumber: 2,
      name: 'Class 2',
      academicSession: '2024-2025',
      isActive: true,
      totalStudents: 30,
      subjects: [
        { id: 'SUB-2-ENG', name: 'English', code: 'ENG-02', classNumber: 2, weeklyLessons: 5, assignedTeacherIds: ['TCH-02'] },
        { id: 'SUB-2-MTH', name: 'Mathematics', code: 'MTH-02', classNumber: 2, weeklyLessons: 5, assignedTeacherIds: ['TCH-01'] },
        { id: 'SUB-2-SCI', name: 'General Science', code: 'SCI-02', classNumber: 2, weeklyLessons: 4, assignedTeacherIds: ['TCH-01'] },
        { id: 'SUB-2-URD', name: 'Urdu', code: 'URD-02', classNumber: 2, weeklyLessons: 4, assignedTeacherIds: ['TCH-05'] },
        { id: 'SUB-2-ISL', name: 'Islamiat & Nazra', code: 'ISL-02', classNumber: 2, weeklyLessons: 3, assignedTeacherIds: ['TCH-04'] }
      ]
    },
    {
      classNumber: 3,
      name: 'Class 3',
      academicSession: '2024-2025',
      isActive: true,
      totalStudents: 32,
      subjects: [
        { id: 'SUB-3-ENG', name: 'English', code: 'ENG-03', classNumber: 3, weeklyLessons: 5, assignedTeacherIds: ['TCH-02'] },
        { id: 'SUB-3-MTH', name: 'Mathematics', code: 'MTH-03', classNumber: 3, weeklyLessons: 5, assignedTeacherIds: ['TCH-01'] },
        { id: 'SUB-3-SCI', name: 'General Science', code: 'SCI-03', classNumber: 3, weeklyLessons: 4, assignedTeacherIds: ['TCH-01'] },
        { id: 'SUB-3-SST', name: 'Social Studies', code: 'SST-03', classNumber: 3, weeklyLessons: 3, assignedTeacherIds: ['TCH-05'] },
        { id: 'SUB-3-CMP', name: 'Computer Basics', code: 'CMP-03', classNumber: 3, weeklyLessons: 3, assignedTeacherIds: ['TCH-03'] }
      ]
    },
    {
      classNumber: 4,
      name: 'Class 4',
      academicSession: '2024-2025',
      isActive: true,
      totalStudents: 29,
      subjects: [
        { id: 'SUB-4-ENG', name: 'English', code: 'ENG-04', classNumber: 4, weeklyLessons: 5, assignedTeacherIds: ['TCH-02'] },
        { id: 'SUB-4-MTH', name: 'Mathematics', code: 'MTH-04', classNumber: 4, weeklyLessons: 5, assignedTeacherIds: ['TCH-01'] },
        { id: 'SUB-4-SCI', name: 'General Science', code: 'SCI-04', classNumber: 4, weeklyLessons: 4, assignedTeacherIds: ['TCH-01'] },
        { id: 'SUB-4-CMP', name: 'Computer Studies', code: 'CMP-04', classNumber: 4, weeklyLessons: 3, assignedTeacherIds: ['TCH-03'] },
        { id: 'SUB-4-ISL', name: 'Islamiat', code: 'ISL-04', classNumber: 4, weeklyLessons: 3, assignedTeacherIds: ['TCH-04'] }
      ]
    },
    {
      classNumber: 5,
      name: 'Class 5',
      academicSession: '2024-2025',
      isActive: true,
      totalStudents: 34,
      subjects: [
        { id: 'SUB-5-ENG', name: 'English Literature', code: 'ENG-05', classNumber: 5, weeklyLessons: 5, assignedTeacherIds: ['TCH-02'] },
        { id: 'SUB-5-MTH', name: 'Mathematics', code: 'MTH-05', classNumber: 5, weeklyLessons: 5, assignedTeacherIds: ['TCH-01'] },
        { id: 'SUB-5-SCI', name: 'General Science', code: 'SCI-05', classNumber: 5, weeklyLessons: 4, assignedTeacherIds: ['TCH-01'] },
        { id: 'SUB-5-CMP', name: 'Computer Coding', code: 'CMP-05', classNumber: 5, weeklyLessons: 3, assignedTeacherIds: ['TCH-03'] },
        { id: 'SUB-5-SST', name: 'Social Studies', code: 'SST-05', classNumber: 5, weeklyLessons: 3, assignedTeacherIds: ['TCH-05'] }
      ]
    },
    {
      classNumber: 6,
      name: 'Class 6',
      academicSession: '2024-2025',
      isActive: true,
      totalStudents: 36,
      subjects: [
        { id: 'SUB-6-ENG', name: 'English Grammar & Comp', code: 'ENG-06', classNumber: 6, weeklyLessons: 5, assignedTeacherIds: ['TCH-02'] },
        { id: 'SUB-6-MTH', name: 'Mathematics (Algebra)', code: 'MTH-06', classNumber: 6, weeklyLessons: 5, assignedTeacherIds: ['TCH-01'] },
        { id: 'SUB-6-SCI', name: 'Integrated Science', code: 'SCI-06', classNumber: 6, weeklyLessons: 5, assignedTeacherIds: ['TCH-01'] },
        { id: 'SUB-6-CMP', name: 'Computer Science', code: 'CMP-06', classNumber: 6, weeklyLessons: 4, assignedTeacherIds: ['TCH-03'] },
        { id: 'SUB-6-URD', name: 'Urdu Literature', code: 'URD-06', classNumber: 6, weeklyLessons: 4, assignedTeacherIds: ['TCH-05'] }
      ]
    },
    {
      classNumber: 7,
      name: 'Class 7',
      academicSession: '2024-2025',
      isActive: true,
      totalStudents: 35,
      subjects: [
        { id: 'SUB-7-ENG', name: 'English', code: 'ENG-07', classNumber: 7, weeklyLessons: 5, assignedTeacherIds: ['TCH-02'] },
        { id: 'SUB-7-MTH', name: 'Advanced Mathematics', code: 'MTH-07', classNumber: 7, weeklyLessons: 5, assignedTeacherIds: ['TCH-01'] },
        { id: 'SUB-7-SCI', name: 'Physics & Chemistry', code: 'SCI-07', classNumber: 7, weeklyLessons: 5, assignedTeacherIds: ['TCH-01'] },
        { id: 'SUB-7-CMP', name: 'Computer Science', code: 'CMP-07', classNumber: 7, weeklyLessons: 4, assignedTeacherIds: ['TCH-03'] },
        { id: 'SUB-7-HIS', name: 'History & Geography', code: 'HIS-07', classNumber: 7, weeklyLessons: 3, assignedTeacherIds: ['TCH-05'] }
      ]
    },
    {
      classNumber: 8,
      name: 'Class 8',
      academicSession: '2024-2025',
      isActive: true,
      totalStudents: 38,
      subjects: [
        { id: 'SUB-8-ENG', name: 'English Language', code: 'ENG-08', classNumber: 8, weeklyLessons: 5, assignedTeacherIds: ['TCH-02'] },
        { id: 'SUB-8-MTH', name: 'Pre-O-Level Mathematics', code: 'MTH-08', classNumber: 8, weeklyLessons: 5, assignedTeacherIds: ['TCH-01'] },
        { id: 'SUB-8-SCI', name: 'Physics & Chemistry', code: 'SCI-08', classNumber: 8, weeklyLessons: 5, assignedTeacherIds: ['TCH-01'] },
        { id: 'SUB-8-CMP', name: 'Computer Science & Python', code: 'CMP-08', classNumber: 8, weeklyLessons: 4, assignedTeacherIds: ['TCH-03'] },
        { id: 'SUB-8-PAK', name: 'Pakistan Studies', code: 'PAK-08', classNumber: 8, weeklyLessons: 3, assignedTeacherIds: ['TCH-05'] }
      ]
    }
  ],

  teachers: [
    {
      id: 'TCH-01',
      staffIdentifier: 'TCH-2024-001',
      name: 'Mrs. Farhana Yasmin',
      email: 'farhana.yasmin@iqraonlineacademy.edu.pk',
      phone: '+92 321 4455667',
      designation: 'Head of Mathematics & Natural Sciences',
      joiningDate: '2021-08-10',
      employmentStatus: 'Full-Time',
      accountStatus: 'Active',
      salaryConfig: {
        model: 'Fixed monthly',
        baseMonthlySalary: 85000,
        perLessonRate: 0,
        perHourRate: 0,
        allowances: 8000,
        standardDeductions: 4500,
        effectiveDate: '2024-04-01'
      },
      assignments: [
        { id: 'ASG-01', classNumber: 1, subjectName: 'Mathematics', startDate: '2024-04-01', status: 'Active' },
        { id: 'ASG-02', classNumber: 2, subjectName: 'Mathematics', startDate: '2024-04-01', status: 'Active' },
        { id: 'ASG-03', classNumber: 5, subjectName: 'Mathematics', startDate: '2024-04-01', status: 'Active' },
        { id: 'ASG-04', classNumber: 8, subjectName: 'Pre-O-Level Mathematics', startDate: '2024-04-01', status: 'Active' }
      ]
    },
    {
      id: 'TCH-02',
      staffIdentifier: 'TCH-2024-002',
      name: 'Mr. Kamran Bilal',
      email: 'kamran.bilal@iqraonlineacademy.edu.pk',
      phone: '+92 333 9988771',
      designation: 'Senior English Department Lead',
      joiningDate: '2022-03-01',
      employmentStatus: 'Contract',
      accountStatus: 'Active',
      salaryConfig: {
        model: 'Per completed lesson',
        baseMonthlySalary: 0,
        perLessonRate: 1500,
        perHourRate: 0,
        allowances: 3000,
        standardDeductions: 1000,
        effectiveDate: '2024-04-01'
      },
      assignments: [
        { id: 'ASG-05', classNumber: 4, subjectName: 'English', startDate: '2024-04-01', status: 'Active' },
        { id: 'ASG-06', classNumber: 6, subjectName: 'English Grammar & Comp', startDate: '2024-04-01', status: 'Active' },
        { id: 'ASG-07', classNumber: 8, subjectName: 'English Language', startDate: '2024-04-01', status: 'Active' }
      ]
    },
    {
      id: 'TCH-03',
      staffIdentifier: 'TCH-2024-003',
      name: 'Ms. Sana Zehra',
      email: 'sana.zehra@iqraonlineacademy.edu.pk',
      phone: '+92 345 1122334',
      designation: 'Computer Science & ICT Instructor',
      joiningDate: '2023-01-10',
      employmentStatus: 'Full-Time',
      accountStatus: 'Active',
      salaryConfig: {
        model: 'Fixed monthly',
        baseMonthlySalary: 72000,
        perLessonRate: 0,
        perHourRate: 0,
        allowances: 5000,
        standardDeductions: 3200,
        effectiveDate: '2024-04-01'
      },
      assignments: [
        { id: 'ASG-08', classNumber: 3, subjectName: 'Computer Basics', startDate: '2024-04-01', status: 'Active' },
        { id: 'ASG-09', classNumber: 5, subjectName: 'Computer Coding', startDate: '2024-04-01', status: 'Active' },
        { id: 'ASG-10', classNumber: 8, subjectName: 'Computer Science & Python', startDate: '2024-04-01', status: 'Active' }
      ]
    },
    {
      id: 'TCH-04',
      staffIdentifier: 'TCH-2024-004',
      name: 'Qari Abdul Rasheed',
      email: 'qari.rasheed@iqraonlineacademy.edu.pk',
      phone: '+92 312 8877665',
      designation: 'Department of Islamic Studies & Tajweed',
      joiningDate: '2021-11-20',
      employmentStatus: 'Part-Time',
      accountStatus: 'Active',
      salaryConfig: {
        model: 'Per hour',
        baseMonthlySalary: 0,
        perLessonRate: 0,
        perHourRate: 1800,
        allowances: 2000,
        standardDeductions: 800,
        effectiveDate: '2024-04-01'
      },
      assignments: [
        { id: 'ASG-11', classNumber: 1, subjectName: 'Islamiat & Nazra', startDate: '2024-04-01', status: 'Active' },
        { id: 'ASG-12', classNumber: 2, subjectName: 'Islamiat & Nazra', startDate: '2024-04-01', status: 'Active' },
        { id: 'ASG-13', classNumber: 4, subjectName: 'Islamiat', startDate: '2024-04-01', status: 'Active' }
      ]
    },
    {
      id: 'TCH-05',
      staffIdentifier: 'TCH-2024-005',
      name: 'Ms. Mahnoor Malik',
      email: 'mahnoor.malik@iqraonlineacademy.edu.pk',
      phone: '+92 301 5566778',
      designation: 'Social Sciences & Humanities Faculty',
      joiningDate: '2023-06-15',
      employmentStatus: 'Full-Time',
      accountStatus: 'Active',
      salaryConfig: {
        model: 'Hybrid',
        baseMonthlySalary: 45000,
        perLessonRate: 800,
        perHourRate: 0,
        allowances: 4000,
        standardDeductions: 2000,
        effectiveDate: '2024-04-01'
      },
      assignments: [
        { id: 'ASG-14', classNumber: 3, subjectName: 'Social Studies', startDate: '2024-04-01', status: 'Active' },
        { id: 'ASG-15', classNumber: 6, subjectName: 'Urdu Literature', startDate: '2024-04-01', status: 'Active' },
        { id: 'ASG-16', classNumber: 8, subjectName: 'Pakistan Studies', startDate: '2024-04-01', status: 'Active' }
      ]
    },
    {
      id: 'TCH-06',
      staffIdentifier: 'TCH-2024-006',
      name: 'Mr. Zafar Iqbal',
      email: 'zafar.iqbal@iqraonlineacademy.edu.pk',
      phone: '+92 334 2233445',
      designation: 'Junior Science Instructor',
      joiningDate: '2023-09-01',
      employmentStatus: 'Full-Time',
      accountStatus: 'Temporarily Suspended',
      salaryConfig: {
        model: 'Fixed monthly',
        baseMonthlySalary: 55000,
        perLessonRate: 0,
        perHourRate: 0,
        allowances: 2500,
        standardDeductions: 1500,
        effectiveDate: '2024-04-01'
      },
      assignments: [],
      suspensionDetails: {
        reason: 'Temporary suspension pending inquiry into unannounced online class absences and parent feedback on May 12.',
        effectiveDate: '2024-05-14T09:00:00Z',
        expiryDate: '2024-05-28T18:00:00Z',
        internalNote: 'Class timetable reallocated temporarily to Ms. Farhana Yasmin. Historical records preserved.',
        suspendedBy: 'Dr. Tariq Mahmood (Principal)'
      }
    }
  ],

  parents: [
    {
      id: 'PAR-01',
      name: 'Muhammad Imran Khan',
      email: 'm.imran.khan@gmail.com',
      phone: '+92 300 1234567',
      cnicOrIdNumber: '35202-1928374-1',
      linkedStudentIds: ['STD-01', 'STD-02'],
      verificationStatus: 'Verified',
      accountStatus: 'Active',
      relationship: 'Father',
      occupation: 'Chartered Accountant'
    },
    {
      id: 'PAR-02',
      name: 'Mrs. Ayesha Siddiqa',
      email: 'ayesha.siddiqa78@yahoo.com',
      phone: '+92 321 9876543',
      cnicOrIdNumber: '35201-8374921-2',
      linkedStudentIds: ['STD-03'],
      verificationStatus: 'Verified',
      accountStatus: 'Active',
      relationship: 'Mother',
      occupation: 'Software Quality Engineer'
    },
    {
      id: 'PAR-03',
      name: 'Dr. Shahid Rafique',
      email: 'dr.shahid.rafique@outlook.com',
      phone: '+92 333 4567890',
      cnicOrIdNumber: '37405-7281923-5',
      linkedStudentIds: ['STD-04'],
      verificationStatus: 'Verified',
      accountStatus: 'Active',
      relationship: 'Father',
      occupation: 'Consultant Physician'
    },
    {
      id: 'PAR-04',
      name: 'Engr. Noman Ali',
      email: 'engr.noman.ali@gmail.com',
      phone: '+92 345 6789012',
      cnicOrIdNumber: '35202-3948572-9',
      linkedStudentIds: ['STD-05', 'STD-06'],
      verificationStatus: 'Verified',
      accountStatus: 'Active',
      relationship: 'Father',
      occupation: 'Civil Engineer'
    },
    {
      id: 'PAR-05',
      name: 'Fatima Zahra Sheikh',
      email: 'f.zahra.sheikh@hotmail.com',
      phone: '+92 312 3456789',
      cnicOrIdNumber: '35201-9483726-4',
      linkedStudentIds: ['STD-07'],
      verificationStatus: 'Pending Verification',
      accountStatus: 'Active',
      relationship: 'Mother',
      occupation: 'Graphic Designer'
    },
    {
      id: 'PAR-06',
      name: 'Kashif Mehmood',
      email: 'kashif.mehmood@pkenterprises.com',
      phone: '+92 301 7890123',
      cnicOrIdNumber: '35202-6251829-3',
      linkedStudentIds: ['STD-08'],
      verificationStatus: 'Verified',
      accountStatus: 'Active',
      relationship: 'Father',
      occupation: 'Export Business'
    }
  ],

  students: [
    {
      id: 'STD-01',
      name: 'Hamza Imran',
      admissionNumber: 'ADM-2024-101',
      rollNumber: '01',
      classNumber: 1,
      academicSession: '2024-2025',
      admissionDate: '2024-04-01',
      parentIds: ['PAR-01'],
      parentNames: ['Muhammad Imran Khan'],
      contactPhone: '+92 300 1234567',
      contactEmail: 'm.imran.khan@gmail.com',
      enrolmentStatus: 'Active',
      accountStatus: 'Active',
      transferHistory: []
    },
    {
      id: 'STD-02',
      name: 'Zainab Imran',
      admissionNumber: 'ADM-2024-102',
      rollNumber: '05',
      classNumber: 3,
      academicSession: '2024-2025',
      admissionDate: '2023-04-01',
      parentIds: ['PAR-01'],
      parentNames: ['Muhammad Imran Khan'],
      contactPhone: '+92 300 1234567',
      contactEmail: 'm.imran.khan@gmail.com',
      enrolmentStatus: 'Active',
      accountStatus: 'Active',
      transferHistory: [
        {
          id: 'TRF-01',
          previousClass: 2,
          newClass: 3,
          academicSession: '2024-2025',
          effectiveDate: '2024-04-01',
          reason: 'Annual promotion following successful final exams',
          transferredBy: 'Dr. Tariq Mahmood (Principal)'
        }
      ]
    },
    {
      id: 'STD-03',
      name: 'Bilal Ahmad',
      admissionNumber: 'ADM-2024-103',
      rollNumber: '12',
      classNumber: 2,
      academicSession: '2024-2025',
      admissionDate: '2024-04-05',
      parentIds: ['PAR-02'],
      parentNames: ['Mrs. Ayesha Siddiqa'],
      contactPhone: '+92 321 9876543',
      contactEmail: 'ayesha.siddiqa78@yahoo.com',
      enrolmentStatus: 'Active',
      accountStatus: 'Active',
      transferHistory: []
    },
    {
      id: 'STD-04',
      name: 'Dua Shahid',
      admissionNumber: 'ADM-2024-104',
      rollNumber: '03',
      classNumber: 4,
      academicSession: '2024-2025',
      admissionDate: '2022-04-01',
      parentIds: ['PAR-03'],
      parentNames: ['Dr. Shahid Rafique'],
      contactPhone: '+92 333 4567890',
      contactEmail: 'dr.shahid.rafique@outlook.com',
      enrolmentStatus: 'Active',
      accountStatus: 'Active',
      transferHistory: []
    },
    {
      id: 'STD-05',
      name: 'Mustafa Noman',
      admissionNumber: 'ADM-2024-105',
      rollNumber: '08',
      classNumber: 5,
      academicSession: '2024-2025',
      admissionDate: '2021-04-01',
      parentIds: ['PAR-04'],
      parentNames: ['Engr. Noman Ali'],
      contactPhone: '+92 345 6789012',
      contactEmail: 'engr.noman.ali@gmail.com',
      enrolmentStatus: 'Active',
      accountStatus: 'Active',
      transferHistory: []
    },
    {
      id: 'STD-06',
      name: 'Maryam Noman',
      admissionNumber: 'ADM-2024-106',
      rollNumber: '14',
      classNumber: 6,
      academicSession: '2024-2025',
      admissionDate: '2020-04-01',
      parentIds: ['PAR-04'],
      parentNames: ['Engr. Noman Ali'],
      contactPhone: '+92 345 6789012',
      contactEmail: 'engr.noman.ali@gmail.com',
      enrolmentStatus: 'Active',
      accountStatus: 'Active',
      transferHistory: []
    },
    {
      id: 'STD-07',
      name: 'Ali Raza Sheikh',
      admissionNumber: 'ADM-2024-107',
      rollNumber: '19',
      classNumber: 7,
      academicSession: '2024-2025',
      admissionDate: '2023-04-01',
      parentIds: ['PAR-05'],
      parentNames: ['Fatima Zahra Sheikh'],
      contactPhone: '+92 312 3456789',
      contactEmail: 'f.zahra.sheikh@hotmail.com',
      enrolmentStatus: 'Active',
      accountStatus: 'Active',
      transferHistory: []
    },
    {
      id: 'STD-08',
      name: 'Saad Kashif',
      admissionNumber: 'ADM-2024-108',
      rollNumber: '02',
      classNumber: 8,
      academicSession: '2024-2025',
      admissionDate: '2019-04-01',
      parentIds: ['PAR-06'],
      parentNames: ['Kashif Mehmood'],
      contactPhone: '+92 301 7890123',
      contactEmail: 'kashif.mehmood@pkenterprises.com',
      enrolmentStatus: 'Active',
      accountStatus: 'Temporarily Suspended',
      transferHistory: [],
      suspensionDetails: {
        reason: 'Temporary suspension of online classroom access due to 2 overdue consecutive monthly fee challans (March & April). Financial support and inquiry desk remain open.',
        effectiveDate: '2024-05-10T00:00:00Z',
        isFeeNonPayment: true,
        suspendedBy: 'Dr. Tariq Mahmood (Principal)'
      }
    }
  ],

  // Reusable Zoom Class Meetings for Classes 1–8
  zoomMeetings: [
    {
      id: 'ZM-CLS-01',
      classNumber: 1,
      zoomMeetingId: '821 9901 1001',
      passcode: 'IqraCls1#',
      joinUrl: 'https://zoom.us/j/82199011001?pwd=IqraSafeTokenClass1',
      status: 'Active',
      createdDate: '2024-04-01',
      lastRenewalDate: '2024-04-01',
      expiryDate: '2025-03-31',
      lastHealthCheckDate: '2026-10-19T06:00:00Z',
      healthCheckStatus: 'Operational',
      renewalHistory: []
    },
    {
      id: 'ZM-CLS-02',
      classNumber: 2,
      zoomMeetingId: '821 9902 2002',
      passcode: 'IqraCls2#',
      joinUrl: 'https://zoom.us/j/82199022002?pwd=IqraSafeTokenClass2',
      status: 'Active',
      createdDate: '2024-04-01',
      lastRenewalDate: '2024-04-01',
      expiryDate: '2025-03-31',
      lastHealthCheckDate: '2026-10-19T06:00:00Z',
      healthCheckStatus: 'Operational',
      renewalHistory: []
    },
    {
      id: 'ZM-CLS-03',
      classNumber: 3,
      zoomMeetingId: '821 9903 3003',
      passcode: 'IqraCls3#',
      joinUrl: 'https://zoom.us/j/82199033003?pwd=IqraSafeTokenClass3',
      status: 'Active',
      createdDate: '2024-04-01',
      lastRenewalDate: '2024-04-01',
      expiryDate: '2025-03-31',
      lastHealthCheckDate: '2026-10-19T06:00:00Z',
      healthCheckStatus: 'Operational',
      renewalHistory: []
    },
    {
      id: 'ZM-CLS-04',
      classNumber: 4,
      zoomMeetingId: '821 9904 4004',
      passcode: 'IqraCls4#',
      joinUrl: 'https://zoom.us/j/82199044004?pwd=IqraSafeTokenClass4',
      status: 'Active',
      createdDate: '2024-04-01',
      lastRenewalDate: '2024-04-01',
      expiryDate: '2025-03-31',
      lastHealthCheckDate: '2026-10-19T06:00:00Z',
      healthCheckStatus: 'Operational',
      renewalHistory: []
    },
    {
      id: 'ZM-CLS-05',
      classNumber: 5,
      zoomMeetingId: '821 9905 5005',
      passcode: 'IqraCls5#',
      joinUrl: 'https://zoom.us/j/82199055005?pwd=IqraSafeTokenClass5',
      status: 'Active',
      createdDate: '2024-04-01',
      lastRenewalDate: '2024-04-01',
      expiryDate: '2025-03-31',
      lastHealthCheckDate: '2026-10-19T06:00:00Z',
      healthCheckStatus: 'Operational',
      renewalHistory: []
    },
    {
      id: 'ZM-CLS-06',
      classNumber: 6,
      zoomMeetingId: '821 9906 6006',
      passcode: 'IqraCls6#',
      joinUrl: 'https://zoom.us/j/82199066006?pwd=IqraSafeTokenClass6',
      status: 'Active',
      createdDate: '2024-04-01',
      lastRenewalDate: '2024-04-01',
      expiryDate: '2025-03-31',
      lastHealthCheckDate: '2026-10-19T06:00:00Z',
      healthCheckStatus: 'Operational',
      renewalHistory: []
    },
    {
      id: 'ZM-CLS-07',
      classNumber: 7,
      zoomMeetingId: '821 9907 7007',
      passcode: 'IqraCls7#',
      joinUrl: 'https://zoom.us/j/82199077007?pwd=IqraSafeTokenClass7',
      status: 'Requires Renewal',
      createdDate: '2024-01-15',
      lastRenewalDate: '2024-01-15',
      expiryDate: '2024-05-30',
      lastHealthCheckDate: '2026-10-19T06:00:00Z',
      healthCheckStatus: 'Degraded',
      renewalHistory: []
    },
    {
      id: 'ZM-CLS-08',
      classNumber: 8,
      zoomMeetingId: '821 9908 8008',
      passcode: 'IqraCls8#',
      joinUrl: 'https://zoom.us/j/82199088008?pwd=IqraSafeTokenClass8',
      status: 'Active',
      createdDate: '2024-04-01',
      lastRenewalDate: '2024-04-01',
      expiryDate: '2025-03-31',
      lastHealthCheckDate: '2026-10-19T06:00:00Z',
      healthCheckStatus: 'Operational',
      renewalHistory: [
        {
          id: 'RNW-01',
          previousMeetingId: '820 1100 9988',
          newMeetingId: '821 9908 8008',
          renewedAt: '2024-04-01T10:00:00Z',
          renewedBy: 'Dr. Tariq Mahmood (Principal)',
          reason: 'Scheduled annual academic rotation of Zoom Pro persistent class room token.'
        }
      ]
    }
  ],

  // Sample weekly timetable lessons
  timetableLessons: [
    {
      id: 'LES-01',
      classNumber: 1,
      subjectId: 'SUB-1-MTH',
      subjectName: 'Mathematics',
      teacherId: 'TCH-01',
      teacherName: 'Mrs. Farhana Yasmin',
      dayOfWeek: 'Monday',
      startTime: '09:00',
      endTime: '09:45',
      timezone: 'Asia/Karachi (UTC+5)',
      academicSession: '2024-2025',
      publicationStatus: 'Published',
      lessonStatus: 'Completed',
      zoomMeetingId: '821 9901 1001',
      history: []
    },
    {
      id: 'LES-02',
      classNumber: 1,
      subjectId: 'SUB-1-ENG',
      subjectName: 'English',
      teacherId: 'TCH-02',
      teacherName: 'Mr. Kamran Bilal',
      dayOfWeek: 'Monday',
      startTime: '10:00',
      endTime: '10:45',
      timezone: 'Asia/Karachi (UTC+5)',
      academicSession: '2024-2025',
      publicationStatus: 'Published',
      lessonStatus: 'Completed',
      zoomMeetingId: '821 9901 1001',
      history: []
    },
    {
      id: 'LES-03',
      classNumber: 3,
      subjectId: 'SUB-3-CMP',
      subjectName: 'Computer Basics',
      teacherId: 'TCH-03',
      teacherName: 'Ms. Sana Zehra',
      dayOfWeek: 'Monday',
      startTime: '09:00',
      endTime: '09:45',
      timezone: 'Asia/Karachi (UTC+5)',
      academicSession: '2024-2025',
      publicationStatus: 'Published',
      lessonStatus: 'Completed',
      zoomMeetingId: '821 9903 3003',
      history: []
    },
    {
      id: 'LES-04',
      classNumber: 4,
      subjectId: 'SUB-4-ENG',
      subjectName: 'English',
      teacherId: 'TCH-02',
      teacherName: 'Mr. Kamran Bilal',
      dayOfWeek: 'Monday',
      startTime: '11:00',
      endTime: '11:45',
      timezone: 'Asia/Karachi (UTC+5)',
      academicSession: '2024-2025',
      publicationStatus: 'Published',
      lessonStatus: 'Scheduled',
      zoomMeetingId: '821 9904 4004',
      history: []
    },
    {
      id: 'LES-05',
      classNumber: 5,
      subjectId: 'SUB-5-MTH',
      subjectName: 'Mathematics',
      teacherId: 'TCH-01',
      teacherName: 'Mrs. Farhana Yasmin',
      dayOfWeek: 'Tuesday',
      startTime: '09:00',
      endTime: '09:45',
      timezone: 'Asia/Karachi (UTC+5)',
      academicSession: '2024-2025',
      publicationStatus: 'Published',
      lessonStatus: 'Scheduled',
      zoomMeetingId: '821 9905 5005',
      history: []
    },
    {
      id: 'LES-06',
      classNumber: 8,
      subjectId: 'SUB-8-MTH',
      subjectName: 'Pre-O-Level Mathematics',
      teacherId: 'TCH-01',
      teacherName: 'Mrs. Farhana Yasmin',
      dayOfWeek: 'Monday',
      startTime: '10:00',
      endTime: '10:45',
      timezone: 'Asia/Karachi (UTC+5)',
      academicSession: '2024-2025',
      publicationStatus: 'Published',
      lessonStatus: 'Completed',
      zoomMeetingId: '821 9908 8008',
      history: []
    },
    {
      id: 'LES-07',
      classNumber: 8,
      subjectId: 'SUB-8-CMP',
      subjectName: 'Computer Science & Python',
      teacherId: 'TCH-03',
      teacherName: 'Ms. Sana Zehra',
      dayOfWeek: 'Wednesday',
      startTime: '11:00',
      endTime: '11:45',
      timezone: 'Asia/Karachi (UTC+5)',
      academicSession: '2024-2025',
      publicationStatus: 'Published',
      lessonStatus: 'Scheduled',
      zoomMeetingId: '821 9908 8008',
      history: []
    },
    {
      id: 'LES-08',
      classNumber: 2,
      subjectId: 'SUB-2-ISL',
      subjectName: 'Islamiat & Nazra',
      teacherId: 'TCH-04',
      teacherName: 'Qari Abdul Rasheed',
      dayOfWeek: 'Thursday',
      startTime: '08:30',
      endTime: '09:15',
      timezone: 'Asia/Karachi (UTC+5)',
      academicSession: '2024-2025',
      publicationStatus: 'Draft',
      lessonStatus: 'Scheduled',
      zoomMeetingId: '821 9902 2002',
      history: [
        {
          id: 'LH-01',
          lessonId: 'LES-08',
          timestamp: '2024-05-15T11:00:00Z',
          changedBy: 'Dr. Tariq Mahmood (Principal)',
          changeType: 'Created',
          reason: 'Initial schedule draft for additional Tajweed period.'
        }
      ]
    }
  ],

  // Attendance Records
  attendanceSummaries: [
    {
      id: 'ATT-SUM-01',
      lessonId: 'LES-01',
      classNumber: 1,
      subjectName: 'Mathematics',
      teacherId: 'TCH-01',
      teacherName: 'Mrs. Farhana Yasmin',
      date: '2026-10-19',
      startTime: '09:00',
      endTime: '09:45',
      enrolledStudentsCount: 28,
      submissionStatus: 'Submitted',
      submittedAt: '2026-10-19T09:46:12Z',
      records: [
        { studentId: 'STD-01', studentName: 'Hamza Imran', rollNumber: '01', status: 'Present', markedAt: '2026-10-19T09:46:12Z', markedBy: 'Mrs. Farhana Yasmin' },
        { studentId: 'STD-102', studentName: 'Fatima Noor', rollNumber: '02', status: 'Present', markedAt: '2026-10-19T09:46:12Z', markedBy: 'Mrs. Farhana Yasmin' },
        { studentId: 'STD-103', studentName: 'Abdullah Khan', rollNumber: '03', status: 'Late', markedAt: '2026-10-19T09:46:12Z', markedBy: 'Mrs. Farhana Yasmin', remarks: 'Joined 12 minutes late due to ISP connectivity issue' },
        { studentId: 'STD-104', studentName: 'Minahil Tariq', rollNumber: '04', status: 'Absent', markedAt: '2026-10-19T09:46:12Z', markedBy: 'Mrs. Farhana Yasmin' }
      ]
    },
    {
      id: 'ATT-SUM-02',
      lessonId: 'LES-06',
      classNumber: 8,
      subjectName: 'Pre-O-Level Mathematics',
      teacherId: 'TCH-01',
      teacherName: 'Mrs. Farhana Yasmin',
      date: '2026-10-19',
      startTime: '10:00',
      endTime: '10:45',
      enrolledStudentsCount: 38,
      submissionStatus: 'Submitted',
      submittedAt: '2026-10-19T10:48:00Z',
      records: [
        { studentId: 'STD-08', studentName: 'Saad Kashif', rollNumber: '02', status: 'Absent', markedAt: '2026-10-19T10:48:00Z', markedBy: 'Mrs. Farhana Yasmin', remarks: 'Portal temporarily suspended for non-payment' }
      ]
    },
    {
      id: 'ATT-SUM-03',
      lessonId: 'LES-03',
      classNumber: 3,
      subjectName: 'Computer Basics',
      teacherId: 'TCH-03',
      teacherName: 'Ms. Sana Zehra',
      date: '2026-10-19',
      startTime: '09:00',
      endTime: '09:45',
      enrolledStudentsCount: 32,
      submissionStatus: 'Missing',
      records: []
    }
  ],

  attendanceCorrections: [
    {
      id: 'COR-01',
      lessonId: 'LES-01',
      classNumber: 1,
      subjectName: 'Mathematics',
      date: '2026-10-18',
      teacherId: 'TCH-01',
      teacherName: 'Mrs. Farhana Yasmin',
      studentId: 'STD-01',
      studentName: 'Hamza Imran',
      originalStatus: 'Absent',
      proposedStatus: 'Present',
      teacherReason: 'Student was present in Zoom breakout session but marked absent due to late join audio sync bug. Verified via Zoom attendance transcript.',
      requestedAt: '2026-10-18T14:30:00Z',
      status: 'Pending'
    }
  ],

  // Fee Structures for Classes 1 to 8
  feeStructures: [
    {
      id: 'FEE-CLS-01',
      classNumber: 1,
      academicSession: '2024-2025',
      effectiveFrom: '2024-04-01',
      status: 'Active',
      heads: [
        { id: 'FH-01', head: 'Tuition', amount: 6500, isRecurring: true },
        { id: 'FH-02', head: 'Technology', amount: 1000, isRecurring: true },
        { id: 'FH-03', head: 'Examination', amount: 800, isRecurring: true },
        { id: 'FH-04', head: 'Books', amount: 1200, isRecurring: false }
      ],
      totalMonthlyRecurring: 8300
    },
    {
      id: 'FEE-CLS-02',
      classNumber: 2,
      academicSession: '2024-2025',
      effectiveFrom: '2024-04-01',
      status: 'Active',
      heads: [
        { id: 'FH-05', head: 'Tuition', amount: 6500, isRecurring: true },
        { id: 'FH-06', head: 'Technology', amount: 1000, isRecurring: true },
        { id: 'FH-07', head: 'Examination', amount: 800, isRecurring: true }
      ],
      totalMonthlyRecurring: 8300
    },
    {
      id: 'FEE-CLS-03',
      classNumber: 3,
      academicSession: '2024-2025',
      effectiveFrom: '2024-04-01',
      status: 'Active',
      heads: [
        { id: 'FH-08', head: 'Tuition', amount: 7000, isRecurring: true },
        { id: 'FH-09', head: 'Technology', amount: 1000, isRecurring: true },
        { id: 'FH-10', head: 'Examination', amount: 800, isRecurring: true }
      ],
      totalMonthlyRecurring: 8800
    },
    {
      id: 'FEE-CLS-04',
      classNumber: 4,
      academicSession: '2024-2025',
      effectiveFrom: '2024-04-01',
      status: 'Active',
      heads: [
        { id: 'FH-11', head: 'Tuition', amount: 7500, isRecurring: true },
        { id: 'FH-12', head: 'Technology', amount: 1000, isRecurring: true },
        { id: 'FH-13', head: 'Examination', amount: 800, isRecurring: true }
      ],
      totalMonthlyRecurring: 9300
    },
    {
      id: 'FEE-CLS-05',
      classNumber: 5,
      academicSession: '2024-2025',
      effectiveFrom: '2024-04-01',
      status: 'Active',
      heads: [
        { id: 'FH-14', head: 'Tuition', amount: 8000, isRecurring: true },
        { id: 'FH-15', head: 'Technology', amount: 1000, isRecurring: true },
        { id: 'FH-16', head: 'Examination', amount: 800, isRecurring: true }
      ],
      totalMonthlyRecurring: 9800
    },
    {
      id: 'FEE-CLS-06',
      classNumber: 6,
      academicSession: '2024-2025',
      effectiveFrom: '2024-04-01',
      status: 'Active',
      heads: [
        { id: 'FH-17', head: 'Tuition', amount: 8500, isRecurring: true },
        { id: 'FH-18', head: 'Technology', amount: 1200, isRecurring: true },
        { id: 'FH-19', head: 'Examination', amount: 1000, isRecurring: true }
      ],
      totalMonthlyRecurring: 10700
    },
    {
      id: 'FEE-CLS-07',
      classNumber: 7,
      academicSession: '2024-2025',
      effectiveFrom: '2024-04-01',
      status: 'Active',
      heads: [
        { id: 'FH-20', head: 'Tuition', amount: 9000, isRecurring: true },
        { id: 'FH-21', head: 'Technology', amount: 1200, isRecurring: true },
        { id: 'FH-22', head: 'Examination', amount: 1000, isRecurring: true }
      ],
      totalMonthlyRecurring: 11200
    },
    {
      id: 'FEE-CLS-08',
      classNumber: 8,
      academicSession: '2024-2025',
      effectiveFrom: '2024-04-01',
      status: 'Active',
      heads: [
        { id: 'FH-23', head: 'Tuition', amount: 9500, isRecurring: true },
        { id: 'FH-24', head: 'Technology', amount: 1200, isRecurring: true },
        { id: 'FH-25', head: 'Examination', amount: 1000, isRecurring: true }
      ],
      totalMonthlyRecurring: 11700
    }
  ],

  concessions: [
    {
      id: 'CNC-01',
      studentId: 'STD-02',
      studentName: 'Zainab Imran',
      classNumber: 3,
      concessionType: 'Sibling Discount',
      value: 1500,
      reason: 'Second child enrolled in school policy benefit (Rs. 1,500 monthly discount).',
      approvedBy: 'Dr. Tariq Mahmood (Principal)',
      effectiveSession: '2024-2025',
      status: 'Active'
    },
    {
      id: 'CNC-02',
      studentId: 'STD-04',
      studentName: 'Dua Shahid',
      classNumber: 4,
      concessionType: 'Merit Scholarship',
      value: 2000,
      reason: '1st position in academic year 2023-2024 merit award.',
      approvedBy: 'Dr. Tariq Mahmood (Principal)',
      effectiveSession: '2024-2025',
      status: 'Active'
    }
  ],

  // Monthly Challans for current billing month (May 2024)
  challans: [
    {
      id: 'CH-2024-05-01',
      challanNumber: 'CH-2024-05-101',
      studentId: 'STD-01',
      studentName: 'Hamza Imran',
      rollNumber: '01',
      admissionNumber: 'ADM-2024-101',
      classNumber: 1,
      billingMonth: 'May 2024',
      academicSession: '2024-2025',
      generationDate: '2024-05-01',
      dueDate: '2024-05-05',
      gracePeriodDays: 5,
      breakdown: {
        tuitionFee: 6500,
        technologyFee: 1000,
        examinationFee: 800,
        booksFee: 0,
        admissionFee: 0,
        otherFee: 0,
        grossAmount: 8300,
        concessionAmount: 0,
        arrearsAmount: 0,
        lateFeeAmount: 0,
        totalPayable: 8300
      },
      paidAmount: 8300,
      outstandingBalance: 0,
      status: 'Paid',
      remindersSentCount: 0
    },
    {
      id: 'CH-2024-05-02',
      challanNumber: 'CH-2024-05-102',
      studentId: 'STD-02',
      studentName: 'Zainab Imran',
      rollNumber: '05',
      admissionNumber: 'ADM-2024-102',
      classNumber: 3,
      billingMonth: 'May 2024',
      academicSession: '2024-2025',
      generationDate: '2024-05-01',
      dueDate: '2024-05-05',
      gracePeriodDays: 5,
      breakdown: {
        tuitionFee: 7000,
        technologyFee: 1000,
        examinationFee: 800,
        booksFee: 0,
        admissionFee: 0,
        otherFee: 0,
        grossAmount: 8800,
        concessionAmount: 1500, // sibling discount
        arrearsAmount: 0,
        lateFeeAmount: 0,
        totalPayable: 7300
      },
      paidAmount: 0,
      outstandingBalance: 7300,
      status: 'Pending Verification',
      remindersSentCount: 0
    },
    {
      id: 'CH-2024-05-03',
      challanNumber: 'CH-2024-05-103',
      studentId: 'STD-03',
      studentName: 'Bilal Ahmad',
      rollNumber: '12',
      admissionNumber: 'ADM-2024-103',
      classNumber: 2,
      billingMonth: 'May 2024',
      academicSession: '2024-2025',
      generationDate: '2024-05-01',
      dueDate: '2024-05-05',
      gracePeriodDays: 5,
      breakdown: {
        tuitionFee: 6500,
        technologyFee: 1000,
        examinationFee: 800,
        booksFee: 0,
        admissionFee: 0,
        otherFee: 0,
        grossAmount: 8300,
        concessionAmount: 0,
        arrearsAmount: 0,
        lateFeeAmount: 0,
        totalPayable: 8300
      },
      paidAmount: 0,
      outstandingBalance: 8300,
      status: 'Pending Verification',
      remindersSentCount: 1,
      lastReminderDate: '2024-05-06'
    },
    {
      id: 'CH-2024-05-04',
      challanNumber: 'CH-2024-05-104',
      studentId: 'STD-04',
      studentName: 'Dua Shahid',
      rollNumber: '03',
      admissionNumber: 'ADM-2024-104',
      classNumber: 4,
      billingMonth: 'May 2024',
      academicSession: '2024-2025',
      generationDate: '2024-05-01',
      dueDate: '2024-05-05',
      gracePeriodDays: 5,
      breakdown: {
        tuitionFee: 7500,
        technologyFee: 1000,
        examinationFee: 800,
        booksFee: 0,
        admissionFee: 0,
        otherFee: 0,
        grossAmount: 9300,
        concessionAmount: 2000, // merit scholarship
        arrearsAmount: 0,
        lateFeeAmount: 0,
        totalPayable: 7300
      },
      paidAmount: 7300,
      outstandingBalance: 0,
      status: 'Paid',
      remindersSentCount: 0
    },
    {
      id: 'CH-2024-05-05',
      challanNumber: 'CH-2024-05-105',
      studentId: 'STD-05',
      studentName: 'Mustafa Noman',
      rollNumber: '08',
      admissionNumber: 'ADM-2024-105',
      classNumber: 5,
      billingMonth: 'May 2024',
      academicSession: '2024-2025',
      generationDate: '2024-05-01',
      dueDate: '2024-05-05',
      gracePeriodDays: 5,
      breakdown: {
        tuitionFee: 8000,
        technologyFee: 1000,
        examinationFee: 800,
        booksFee: 0,
        admissionFee: 0,
        otherFee: 0,
        grossAmount: 9800,
        concessionAmount: 0,
        arrearsAmount: 0,
        lateFeeAmount: 500, // overdue late fee
        totalPayable: 10300
      },
      paidAmount: 0,
      outstandingBalance: 10300,
      status: 'Overdue',
      remindersSentCount: 2,
      lastReminderDate: '2024-05-12'
    },
    {
      id: 'CH-2024-05-08',
      challanNumber: 'CH-2024-05-108',
      studentId: 'STD-08',
      studentName: 'Saad Kashif',
      rollNumber: '02',
      admissionNumber: 'ADM-2024-108',
      classNumber: 8,
      billingMonth: 'May 2024',
      academicSession: '2024-2025',
      generationDate: '2024-05-01',
      dueDate: '2024-05-05',
      gracePeriodDays: 5,
      breakdown: {
        tuitionFee: 9500,
        technologyFee: 1200,
        examinationFee: 1000,
        booksFee: 0,
        admissionFee: 0,
        otherFee: 0,
        grossAmount: 11700,
        concessionAmount: 0,
        arrearsAmount: 23400, // carried forward from previous months
        lateFeeAmount: 500,
        totalPayable: 35600
      },
      paidAmount: 0,
      outstandingBalance: 35600,
      status: 'Overdue',
      remindersSentCount: 4,
      lastReminderDate: '2024-05-15'
    }
  ],

  // Payment Proof Submissions awaiting review
  paymentProofs: [
    {
      id: 'PAY-SUB-01',
      challanId: 'CH-2024-05-02',
      challanNumber: 'CH-2024-05-102',
      studentId: 'STD-02',
      studentName: 'Zainab Imran',
      parentId: 'PAR-01',
      parentName: 'Muhammad Imran Khan',
      classNumber: 3,
      submittedAmount: 7300,
      bankOrWallet: 'Meezan Bank (Online Transfer)',
      transactionReference: 'MEZN-992817462',
      paymentDate: '2024-05-04',
      proofDocumentUrl: 'doc_meezan_transfer.pdf',
      submissionTimestamp: '2024-05-04T16:22:00Z',
      status: 'Pending'
    },
    {
      id: 'PAY-SUB-02',
      challanId: 'CH-2024-05-03',
      challanNumber: 'CH-2024-05-103',
      studentId: 'STD-03',
      studentName: 'Bilal Ahmad',
      parentId: 'PAR-02',
      parentName: 'Mrs. Ayesha Siddiqa',
      classNumber: 2,
      submittedAmount: 8300,
      bankOrWallet: 'Habib Bank Limited (HBL Raast)',
      transactionReference: 'RAAST-88371920',
      paymentDate: '2024-05-05',
      proofDocumentUrl: 'doc_hbl_slip.pdf',
      submissionTimestamp: '2024-05-05T19:40:00Z',
      status: 'Pending'
    },
    {
      id: 'PAY-SUB-03',
      challanId: 'CH-2024-05-01',
      challanNumber: 'CH-2024-05-101',
      studentId: 'STD-01',
      studentName: 'Hamza Imran',
      parentId: 'PAR-01',
      parentName: 'Muhammad Imran Khan',
      classNumber: 1,
      submittedAmount: 8300,
      bankOrWallet: 'Meezan Bank',
      transactionReference: 'MEZN-118273645',
      paymentDate: '2024-05-02',
      proofDocumentUrl: 'doc_receipt_hamza.pdf',
      submissionTimestamp: '2024-05-02T11:15:00Z',
      status: 'Approved',
      reviewedBy: 'Dr. Tariq Mahmood (Principal)',
      reviewTimestamp: '2024-05-02T14:00:00Z',
      reviewDecisionNote: 'Transaction verified against school designated fee account.',
      verifiedAmount: 8300,
      receiptNumber: 'RCP-2024-05-001'
    }
  ],

  // Teacher Salary Drafts for current payroll month (May 2024)
  salaryDrafts: [
    {
      id: 'SAL-2024-05-01',
      teacherId: 'TCH-01',
      teacherName: 'Mrs. Farhana Yasmin',
      staffIdentifier: 'TCH-2024-001',
      payrollMonth: 'May 2024',
      salaryModel: 'Fixed monthly',
      scheduledLessons: 48,
      completedLessons: 47,
      cancelledLessons: 0,
      missedLessons: 0,
      approvedLeaveDays: 1,
      verifiedHours: 36,
      basePay: 85000,
      ratePerUnit: 0,
      lessonOrHourlyEarning: 0,
      allowances: 8000,
      standardDeductions: 4500,
      adjustments: [
        {
          id: 'ADJ-01',
          type: 'Addition',
          title: 'Curriculum development honorarium',
          amount: 5000,
          reason: 'Reviewed and aligned Class 7 & 8 Mathematics syllabus',
          authorizedBy: 'Dr. Tariq Mahmood'
        }
      ],
      calculationFormula: 'Base Pay (Rs. 85,000) + Allowances (Rs. 8,000) + Adjustments (Rs. 5,000) - Deductions (Rs. 4,500)',
      grossAmount: 98000,
      netPayable: 93500,
      status: 'Approved',
      generatedAt: '2024-05-15T09:00:00Z',
      generatedBy: 'System Payroll Engine',
      reviewedBy: 'Dr. Tariq Mahmood (Principal)',
      reviewedAt: '2024-05-16T11:30:00Z',
      reviewRemarks: 'All 47 lessons delivered with verified Zoom attendance logs. Approved.',
      salarySlipNumber: 'SLIP-2024-05-001'
    },
    {
      id: 'SAL-2024-05-02',
      teacherId: 'TCH-02',
      teacherName: 'Mr. Kamran Bilal',
      staffIdentifier: 'TCH-2024-002',
      payrollMonth: 'May 2024',
      salaryModel: 'Per completed lesson',
      scheduledLessons: 42,
      completedLessons: 40,
      cancelledLessons: 2,
      missedLessons: 0,
      approvedLeaveDays: 0,
      verifiedHours: 30,
      basePay: 0,
      ratePerUnit: 1500,
      lessonOrHourlyEarning: 60000, // 40 * 1500
      allowances: 3000,
      standardDeductions: 1000,
      adjustments: [],
      calculationFormula: '40 Completed Lessons × Rs. 1,500 = Rs. 60,000 + Allowances (Rs. 3,000) - Deductions (Rs. 1,000)',
      grossAmount: 63000,
      netPayable: 62000,
      status: 'Submitted for Approval',
      generatedAt: '2024-05-15T09:00:00Z',
      generatedBy: 'System Payroll Engine'
    },
    {
      id: 'SAL-2024-05-03',
      teacherId: 'TCH-03',
      teacherName: 'Ms. Sana Zehra',
      staffIdentifier: 'TCH-2024-003',
      payrollMonth: 'May 2024',
      salaryModel: 'Fixed monthly',
      scheduledLessons: 36,
      completedLessons: 35,
      cancelledLessons: 0,
      missedLessons: 1,
      approvedLeaveDays: 0,
      verifiedHours: 26.25,
      basePay: 72000,
      ratePerUnit: 0,
      lessonOrHourlyEarning: 0,
      allowances: 5000,
      standardDeductions: 3200,
      adjustments: [
        {
          id: 'ADJ-02',
          type: 'Deduction',
          title: 'Unannounced missed lesson deduction',
          amount: 2000,
          reason: 'Unannounced absence on May 12 without substitute coverage',
          authorizedBy: 'Dr. Tariq Mahmood'
        }
      ],
      calculationFormula: 'Base Pay (Rs. 72,000) + Allowances (Rs. 5,000) - Deductions (Rs. 3,200) - Adjustment (Rs. 2,000)',
      grossAmount: 77000,
      netPayable: 71800,
      status: 'Draft',
      generatedAt: '2024-05-15T09:00:00Z',
      generatedBy: 'System Payroll Engine'
    },
    {
      id: 'SAL-2024-05-04',
      teacherId: 'TCH-04',
      teacherName: 'Qari Abdul Rasheed',
      staffIdentifier: 'TCH-2024-004',
      payrollMonth: 'May 2024',
      salaryModel: 'Per hour',
      scheduledLessons: 30,
      completedLessons: 30,
      cancelledLessons: 0,
      missedLessons: 0,
      approvedLeaveDays: 0,
      verifiedHours: 22.5,
      basePay: 0,
      ratePerUnit: 1800,
      lessonOrHourlyEarning: 40500, // 22.5 hrs * 1800
      allowances: 2000,
      standardDeductions: 800,
      adjustments: [],
      calculationFormula: '22.5 Verified Teaching Hours × Rs. 1,800/hr = Rs. 40,500 + Allowances (Rs. 2,000) - Deductions (Rs. 800)',
      grossAmount: 42500,
      netPayable: 41700,
      status: 'Submitted for Approval',
      generatedAt: '2024-05-15T09:00:00Z',
      generatedBy: 'System Payroll Engine'
    },
    {
      id: 'SAL-2024-05-05',
      teacherId: 'TCH-05',
      teacherName: 'Ms. Mahnoor Malik',
      staffIdentifier: 'TCH-2024-005',
      payrollMonth: 'May 2024',
      salaryModel: 'Hybrid',
      scheduledLessons: 34,
      completedLessons: 34,
      cancelledLessons: 0,
      missedLessons: 0,
      approvedLeaveDays: 0,
      verifiedHours: 25.5,
      basePay: 45000,
      ratePerUnit: 800,
      lessonOrHourlyEarning: 27200, // 34 * 800
      allowances: 4000,
      standardDeductions: 2000,
      adjustments: [],
      calculationFormula: 'Base Pay (Rs. 45,000) + (34 Lessons × Rs. 800 = Rs. 27,200) + Allowances (Rs. 4,000) - Deductions (Rs. 2,000)',
      grossAmount: 76200,
      netPayable: 74200,
      status: 'Draft',
      generatedAt: '2024-05-15T09:00:00Z',
      generatedBy: 'System Payroll Engine'
    }
  ],

  notices: [
    {
      id: 'NOT-01',
      title: 'Revision of Online School Timetable for Summer Session',
      content: 'Effective Monday, May 20, morning class timings for all Classes 1–8 will begin 30 minutes earlier at 08:30 AM to accommodate standardized online break intervals. Please review the updated class schedules in the timetable module.',
      audience: 'School-Wide',
      targetRoles: ['Teacher', 'Student', 'Parent'],
      priority: 'High',
      status: 'Published',
      publishDate: '2024-05-16',
      expiryDate: '2024-06-30',
      createdBy: 'Dr. Tariq Mahmood (Principal)',
      acknowledgedCount: 142
    },
    {
      id: 'NOT-02',
      title: 'Monthly Fee Challan Due Date Notice — May 2024',
      content: 'Monthly Challans for May 2024 have been issued. Parents are kindly requested to submit payment proofs on or before the due date (May 5) or within the grace period to avoid late fee penalties of Rs. 500.',
      audience: 'School-Wide',
      targetRoles: ['Parent'],
      priority: 'Normal',
      status: 'Published',
      publishDate: '2024-05-01',
      expiryDate: '2024-05-31',
      createdBy: 'Dr. Tariq Mahmood (Principal)',
      acknowledgedCount: 210
    },
    {
      id: 'NOT-03',
      title: 'Class 8 Pre-O-Level Science Lab Simulation Requirement',
      content: 'All Class 8 students must ensure their desktop browsers have WebGL enabled for the upcoming PhET physics and chemistry simulation modules starting next week.',
      audience: 'Class 8',
      targetRoles: ['Student', 'Parent'],
      priority: 'Normal',
      status: 'Published',
      publishDate: '2024-05-14',
      expiryDate: '2024-05-28',
      createdBy: 'Dr. Tariq Mahmood (Principal)',
      acknowledgedCount: 35
    },
    {
      id: 'NOT-04',
      title: 'Mid-Year Academic Progress Reports Dispatch',
      content: 'Teacher grade submissions have completed for Classes 1 to 5. Draft evaluation sheets are pending final Principal review before parent portal dissemination.',
      audience: 'School-Wide',
      targetRoles: ['Teacher'],
      priority: 'High',
      status: 'Draft',
      publishDate: '2024-05-20',
      createdBy: 'Dr. Tariq Mahmood (Principal)'
    }
  ],

  notifications: [
    {
      id: 'NOTIF-01',
      title: 'Payment Proof Submitted for Verification',
      message: 'Parent Muhammad Imran Khan uploaded Meezan Bank proof (Rs. 7,300) for Challan CH-2024-05-102 (Class 3, Zainab Imran).',
      type: 'Payment Proof Awaiting Review',
      targetRole: 'Principal',
      relatedRecordId: 'PAY-SUB-01',
      relatedRecordType: 'PaymentProof',
      timestamp: '2024-05-04T16:22:00Z',
      isRead: false,
      priority: 'Medium'
    },
    {
      id: 'NOTIF-02',
      title: 'Payment Proof Submitted for Verification',
      message: 'Parent Mrs. Ayesha Siddiqa submitted HBL transaction proof (Rs. 8,300) for Challan CH-2024-05-103 (Class 2, Bilal Ahmad).',
      type: 'Payment Proof Awaiting Review',
      targetRole: 'Principal',
      relatedRecordId: 'PAY-SUB-02',
      relatedRecordType: 'PaymentProof',
      timestamp: '2024-05-05T19:40:00Z',
      isRead: false,
      priority: 'Medium'
    },
    {
      id: 'NOTIF-03',
      title: 'Zoom Class-Link Degraded Warning',
      message: 'Class 7 reusable Zoom meeting (ID: 821 9907 7007) reported token expiry approaching in 11 days. Renewal required.',
      type: 'Failed Zoom Meeting',
      targetRole: 'Principal',
      relatedRecordId: 'ZM-CLS-07',
      relatedRecordType: 'ZoomMeeting',
      timestamp: '2024-05-18T08:00:00Z',
      isRead: false,
      priority: 'High'
    },
    {
      id: 'NOTIF-04',
      title: 'Missing Attendance Submission',
      message: 'Class 3 Computer Basics (Teacher: Ms. Sana Zehra) attendance for today 09:00 AM has not been submitted.',
      type: 'Missing Attendance',
      targetRole: 'Principal',
      relatedRecordId: 'ATT-SUM-03',
      relatedRecordType: 'Attendance',
      timestamp: '2026-10-19T02:00:00Z',
      isRead: false,
      priority: 'Medium'
    },
    {
      id: 'NOTIF-05',
      title: 'Attendance Correction Awaiting Review',
      message: 'Mrs. Farhana Yasmin requested attendance correction from Absent to Present for student Hamza Imran (Class 1).',
      type: 'Correction Request',
      targetRole: 'Principal',
      relatedRecordId: 'COR-01',
      relatedRecordType: 'AttendanceCorrection',
      timestamp: '2026-10-18T14:30:00Z',
      isRead: false,
      priority: 'Low'
    },
    {
      id: 'NOTIF-06',
      title: 'Teacher Payroll Drafts Generated',
      message: 'Monthly payroll drafts for May 2024 generated for 5 active teachers. 2 drafts are awaiting Principal authorization.',
      type: 'Salary Draft',
      targetRole: 'Principal',
      relatedRecordId: 'SAL-2024-05-02',
      relatedRecordType: 'Payroll',
      timestamp: '2024-05-15T09:00:00Z',
      isRead: true,
      priority: 'Medium'
    }
  ],

  auditLogs: [
    {
      id: 'AUD-001',
      actorName: 'Dr. Tariq Mahmood',
      actorRole: 'Principal',
      action: 'SUSPEND_STUDENT_PORTAL',
      recordType: 'Student Account',
      recordIdentifier: 'STD-08 (Saad Kashif)',
      timestamp: '2024-05-10T00:00:00Z',
      reason: '2 consecutive unpaid monthly fee challans following 4 reminder notices.',
      previousValue: 'AccountStatus: Active',
      newValue: 'AccountStatus: Temporarily Suspended (Fee Arrears: Rs. 35,600)'
    },
    {
      id: 'AUD-002',
      actorName: 'Dr. Tariq Mahmood',
      actorRole: 'Principal',
      action: 'APPROVE_PAYMENT_PROOF',
      recordType: 'Payment Verification',
      recordIdentifier: 'PAY-SUB-03 (Challan CH-2024-05-101)',
      timestamp: '2024-05-02T14:00:00Z',
      reason: 'Bank credit confirmed on Meezan school account statement.',
      previousValue: 'Status: Pending Verification, Challan Status: Unpaid',
      newValue: 'Status: Approved, Challan Status: Paid, Receipt: RCP-2024-05-001'
    },
    {
      id: 'AUD-003',
      actorName: 'Dr. Tariq Mahmood',
      actorRole: 'Principal',
      action: 'APPROVE_SALARY_DRAFT',
      recordType: 'Teacher Payroll',
      recordIdentifier: 'SAL-2024-05-01 (Mrs. Farhana Yasmin)',
      timestamp: '2024-05-16T11:30:00Z',
      reason: 'Duty records verified (47 completed lessons, 1 approved leave day).',
      previousValue: 'Draft Status: Submitted for Approval',
      newValue: 'Draft Status: Approved (Net Payable: Rs. 93,500)'
    },
    {
      id: 'AUD-004',
      actorName: 'Dr. Tariq Mahmood',
      actorRole: 'Principal',
      action: 'RENEW_ZOOM_MEETING',
      recordType: 'Zoom Link',
      recordIdentifier: 'ZM-CLS-08 (Class 8 Reusable Room)',
      timestamp: '2024-04-01T10:00:00Z',
      reason: 'Scheduled annual academic rotation of Zoom Pro persistent class room token.',
      previousValue: 'ZoomMeetingId: 820 1100 9988',
      newValue: 'ZoomMeetingId: 821 9908 8008'
    },
    {
      id: 'AUD-005',
      actorName: 'Dr. Tariq Mahmood',
      actorRole: 'Principal',
      action: 'SUSPEND_TEACHER_ACCOUNT',
      recordType: 'Teacher Account',
      recordIdentifier: 'TCH-06 (Mr. Zafar Iqbal)',
      timestamp: '2024-05-14T09:00:00Z',
      reason: 'Temporary suspension pending inquiry into unannounced online class absences on May 12.',
      previousValue: 'AccountStatus: Active',
      newValue: 'AccountStatus: Temporarily Suspended'
    }
  ],

  academicPerformances: [
    {
      classNumber: 1,
      className: 'Class 1',
      enrolledStudents: 28,
      averageScorePercentage: 86.4,
      taskCompletionRate: 94.2,
      attendanceRate: 93.8,
      missingSubmissionsCount: 3,
      pendingGradingCount: 0,
      publishedResultsStatus: 'Published',
      subjectScores: [
        { subjectName: 'Mathematics', averageScore: 88, teacherName: 'Mrs. Farhana Yasmin' },
        { subjectName: 'English', averageScore: 84, teacherName: 'Mr. Kamran Bilal' },
        { subjectName: 'General Science', averageScore: 87, teacherName: 'Mrs. Farhana Yasmin' }
      ]
    },
    {
      classNumber: 2,
      className: 'Class 2',
      enrolledStudents: 30,
      averageScorePercentage: 83.1,
      taskCompletionRate: 91.0,
      attendanceRate: 91.5,
      missingSubmissionsCount: 5,
      pendingGradingCount: 2,
      publishedResultsStatus: 'Published',
      subjectScores: [
        { subjectName: 'Mathematics', averageScore: 85, teacherName: 'Mrs. Farhana Yasmin' },
        { subjectName: 'English', averageScore: 82, teacherName: 'Mr. Kamran Bilal' },
        { subjectName: 'General Science', averageScore: 82, teacherName: 'Mrs. Farhana Yasmin' }
      ]
    },
    {
      classNumber: 3,
      className: 'Class 3',
      enrolledStudents: 32,
      averageScorePercentage: 81.5,
      taskCompletionRate: 88.5,
      attendanceRate: 89.2,
      missingSubmissionsCount: 7,
      pendingGradingCount: 1,
      publishedResultsStatus: 'Pending Approval',
      subjectScores: [
        { subjectName: 'Mathematics', averageScore: 83, teacherName: 'Mrs. Farhana Yasmin' },
        { subjectName: 'Computer Basics', averageScore: 80, teacherName: 'Ms. Sana Zehra' },
        { subjectName: 'Social Studies', averageScore: 81, teacherName: 'Ms. Mahnoor Malik' }
      ]
    },
    {
      classNumber: 4,
      className: 'Class 4',
      enrolledStudents: 29,
      averageScorePercentage: 79.8,
      taskCompletionRate: 86.2,
      attendanceRate: 88.0,
      missingSubmissionsCount: 8,
      pendingGradingCount: 4,
      publishedResultsStatus: 'Pending Approval',
      subjectScores: [
        { subjectName: 'English', averageScore: 81, teacherName: 'Mr. Kamran Bilal' },
        { subjectName: 'Mathematics', averageScore: 78, teacherName: 'Mrs. Farhana Yasmin' }
      ]
    },
    {
      classNumber: 5,
      className: 'Class 5',
      enrolledStudents: 34,
      averageScorePercentage: 78.4,
      taskCompletionRate: 85.0,
      attendanceRate: 87.5,
      missingSubmissionsCount: 9,
      pendingGradingCount: 3,
      publishedResultsStatus: 'Draft',
      subjectScores: [
        { subjectName: 'Mathematics', averageScore: 79, teacherName: 'Mrs. Farhana Yasmin' },
        { subjectName: 'Computer Coding', averageScore: 82, teacherName: 'Ms. Sana Zehra' }
      ]
    },
    {
      classNumber: 6,
      className: 'Class 6',
      enrolledStudents: 36,
      averageScorePercentage: 76.2,
      taskCompletionRate: 83.4,
      attendanceRate: 86.0,
      missingSubmissionsCount: 12,
      pendingGradingCount: 5,
      publishedResultsStatus: 'Draft',
      subjectScores: [
        { subjectName: 'English Grammar & Comp', averageScore: 77, teacherName: 'Mr. Kamran Bilal' },
        { subjectName: 'Urdu Literature', averageScore: 75, teacherName: 'Ms. Mahnoor Malik' }
      ]
    },
    {
      classNumber: 7,
      className: 'Class 7',
      enrolledStudents: 35,
      averageScorePercentage: 75.8,
      taskCompletionRate: 82.0,
      attendanceRate: 85.2,
      missingSubmissionsCount: 14,
      pendingGradingCount: 6,
      publishedResultsStatus: 'Draft',
      subjectScores: [
        { subjectName: 'Physics & Chemistry', averageScore: 74, teacherName: 'Mrs. Farhana Yasmin' },
        { subjectName: 'Advanced Mathematics', averageScore: 76, teacherName: 'Mrs. Farhana Yasmin' }
      ]
    },
    {
      classNumber: 8,
      className: 'Class 8',
      enrolledStudents: 38,
      averageScorePercentage: 82.3,
      taskCompletionRate: 89.0,
      attendanceRate: 90.1,
      missingSubmissionsCount: 6,
      pendingGradingCount: 2,
      publishedResultsStatus: 'Published',
      subjectScores: [
        { subjectName: 'Pre-O-Level Mathematics', averageScore: 84, teacherName: 'Mrs. Farhana Yasmin' },
        { subjectName: 'Computer Science & Python', averageScore: 86, teacherName: 'Ms. Sana Zehra' },
        { subjectName: 'Pakistan Studies', averageScore: 78, teacherName: 'Ms. Mahnoor Malik' }
      ]
    }
  ]
};
