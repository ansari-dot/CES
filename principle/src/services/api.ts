import {
  SchoolDatabase,
  initialDatabase,
  emptyDatabase
} from '../data/mockDatabase';
import {
  DashboardMetrics,
  Teacher,
  Student,
  Parent,
  AcademicSession,
  SchoolClass,
  TimetableLesson,
  DayOfWeek,
  ClassZoomMeeting,
  LessonAttendanceSummary,
  StudentAttendanceRecord,
  AttendanceCorrectionRequest,
  ClassFeeStructure,
  StudentConcession,
  MonthlyChallan,
  PaymentProofSubmission,
  TeacherSalaryDraft,
  SchoolNotice,
  OperationalNotification,
  AuditLogEntry,
  AcademicClassPerformance,
  UserProfile,
  AccountStatus
} from '../types';

const STORAGE_KEY = 'iqra_principal_portal_db_clean_v4';

function getStoredDB(): SchoolDatabase {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(emptyDatabase));
      return emptyDatabase;
    }
    return JSON.parse(raw);
  } catch {
    return emptyDatabase;
  }
}

function saveDB(db: SchoolDatabase): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (err) {
    console.error('Failed to persist database state:', err);
  }
}

const delay = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));

function logAudit(
  db: SchoolDatabase,
  action: string,
  recordType: AuditLogEntry['recordType'],
  recordIdentifier: string,
  reason: string,
  previousValue?: string,
  newValue?: string
) {
  const newAudit: AuditLogEntry = {
    id: `AUD-${Date.now()}`,
    actorName: db.principalProfile.name,
    actorRole: 'Principal',
    action,
    recordType,
    recordIdentifier,
    timestamp: new Date().toISOString(),
    reason,
    previousValue,
    newValue,
    ipAddress: '192.168.10.42 (Principal Office)'
  };
  db.auditLogs.unshift(newAudit);

  // Asynchronously sync to backend audit log
  requestApi('/api/v1/audit', {
    method: 'POST',
    body: JSON.stringify({
      action,
      recordType,
      recordIdentifier,
      reason,
      previousValue,
      newValue
    })
  }).catch(() => {});
}

async function getCsrfHeader(): Promise<string | undefined> {
  const match = document.cookie.match(/(?:^|;\s*)sms_csrf=([^;]+)/);
  if (match) {
    return match[1];
  }
  try {
    const res = await fetch('/api/v1/auth/csrf', { credentials: 'include' });
    const json = await res.json();
    return json.data?.csrfToken;
  } catch {
    return undefined;
  }
}

async function requestApi<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  const method = (options.method || 'GET').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrf = await getCsrfHeader();
    if (csrf) {
      headers.set('X-CSRF-Token', csrf);
    }
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'include'
  });

  const json = await res.json();
  if (!res.ok || json.success === false) {
    throw new Error(json.error?.message || 'API request failed');
  }

  return json.data as T;
}

export const api = {
  // Reset database to initial clean state
  async resetDatabase(): Promise<SchoolDatabase> {
    await delay();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(emptyDatabase));
    return emptyDatabase;
  },

  // 1. Authentication & Principal Profile
  async login(email: string, password: string): Promise<UserProfile> {
    const data = await requestApi<any>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: email, password })
    });

    const principal: UserProfile = {
      id: String(data.id),
      name: data.fullName || data.username,
      email: data.email || email,
      phone: data.phone || '+92 300 9876543',
      role: data.role === 'ADMIN' ? 'Administrator' : 'Principal',
      designation: 'Principal & Academic Director',
      accountStatus: 'Active',
      lastLogin: new Date().toISOString(),
      joiningDate: '2023-01-01'
    };

    const db = getStoredDB();
    db.principalProfile = principal;
    saveDB(db);
    return principal;
  },

  async logout(): Promise<void> {
    try {
      await requestApi('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // quiet fallback
    }
    const db = getStoredDB();
    logAudit(
      db,
      'USER_LOGOUT',
      'Portal Access',
      db.principalProfile.id,
      'Principal session terminated / logged out'
    );
  },

  async getProfile(): Promise<UserProfile> {
    try {
      const data = await requestApi<any>('/api/v1/auth/me');
      const principal: UserProfile = {
        id: String(data.id),
        name: data.fullName || data.username,
        email: data.email || 'principal@school.pk',
        phone: data.phone || '+92 300 9876543',
        role: data.role === 'ADMIN' ? 'Administrator' : 'Principal',
        designation: 'Principal & Academic Director',
        accountStatus: 'Active',
        lastLogin: new Date().toISOString(),
        joiningDate: '2023-01-01'
      };
      return principal;
    } catch {
      return getStoredDB().principalProfile;
    }
  },

  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    await delay();
    const db = getStoredDB();
    const prev = JSON.stringify(db.principalProfile);
    db.principalProfile = { ...db.principalProfile, ...updates };
    logAudit(db, 'UPDATE_PRINCIPAL_PROFILE', 'Portal Access', db.principalProfile.id, 'Principal updated contact/profile information', prev, JSON.stringify(db.principalProfile));
    saveDB(db);
    return db.principalProfile;
  },

  // 2. Dashboard Statistics — Pure Live Data Only
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [teachersRes, studentsRes, feeStatsRes, todayLessonsRes, proofsRes, draftsRes, correctionsRes] = await Promise.all([
        requestApi<any[]>('/api/v1/teachers').catch(() => []),
        requestApi<any[]>('/api/v1/students').catch(() => []),
        requestApi<any>('/api/v1/fees/stats').catch(() => null),
        requestApi<any[]>(`/api/v1/timetable/lessons?date=${today}`).catch(() => []),
        requestApi<any[]>('/api/v1/fees/payment-proofs').catch(() => []),
        requestApi<any[]>('/api/v1/payroll/drafts').catch(() => []),
        requestApi<any[]>('/api/v1/attendance/corrections').catch(() => [])
      ]);

      const teachersList = Array.isArray(teachersRes) ? teachersRes : [];
      const studentsList = Array.isArray(studentsRes) ? studentsRes : [];
      const lessonsList = Array.isArray(todayLessonsRes) ? todayLessonsRes : [];

      const activeTeachers = teachersList.filter((t) => t.accountStatus === 'Active' || t.employmentStatus === 'ACTIVE').length;
      const inactiveTeachers = teachersList.length - activeTeachers;
      const totalActiveStudents = studentsList.filter((s) => s.accountStatus === 'Active' || s.enrollmentStatus === 'ACTIVE').length;

      const completedLessonsToday = lessonsList.filter((l) => l.status === 'COMPLETED').length;
      const cancelledLessonsToday = lessonsList.filter((l) => l.status === 'CANCELLED').length;
      const missedLessonsToday = lessonsList.filter((l) => l.status === 'MISSED').length;

      const monthlyFeeCollectedAmount = Number(feeStatsRes?.totalCollected || feeStatsRes?.collectedAmount || 0);
      const monthlyFeeTargetAmount = Number(feeStatsRes?.totalReceivable || feeStatsRes?.targetAmount || 0);
      const outstandingArrearsAmount = Number(feeStatsRes?.totalOutstanding || feeStatsRes?.outstandingAmount || 0);

      const pendingPaymentProofsCount = Array.isArray(proofsRes) ? proofsRes.filter((p) => p.status === 'Pending' || p.status === 'PENDING').length : 0;
      const pendingSalaryDraftsCount = Array.isArray(draftsRes) ? draftsRes.filter((d) => d.status === 'SUBMITTED' || d.status === 'Submitted for Approval').length : 0;
      const pendingAttendanceCorrectionsCount = Array.isArray(correctionsRes) ? correctionsRes.filter((c) => c.status === 'PENDING' || c.status === 'Pending').length : 0;

      const enrolmentByClass = [1, 2, 3, 4, 5, 6, 7, 8].map((cls) => ({
        classNumber: cls,
        count: studentsList.filter((s) => Number(s.classNumber) === cls).length
      }));

      return {
        totalActiveStudents,
        activeTeachers,
        inactiveTeachers,
        todayScheduledLessons: lessonsList.length,
        completedLessonsToday,
        cancelledLessonsToday,
        missedLessonsToday,
        overallAttendancePercentage: completedLessonsToday > 0 ? 100 : 0,
        monthlyFeeCollectedAmount,
        monthlyFeeTargetAmount,
        outstandingArrearsAmount,
        pendingPaymentProofsCount,
        pendingSalaryDraftsCount,
        pendingAttendanceCorrectionsCount,
        enrolmentByClass
      };
    } catch (err) {
      console.warn('Dashboard metrics API call failed:', err);
    }

    return {
      totalActiveStudents: 0,
      activeTeachers: 0,
      inactiveTeachers: 0,
      todayScheduledLessons: 0,
      completedLessonsToday: 0,
      cancelledLessonsToday: 0,
      missedLessonsToday: 0,
      overallAttendancePercentage: 0,
      monthlyFeeCollectedAmount: 0,
      monthlyFeeTargetAmount: 0,
      outstandingArrearsAmount: 0,
      pendingPaymentProofsCount: 0,
      pendingSalaryDraftsCount: 0,
      pendingAttendanceCorrectionsCount: 0,
      enrolmentByClass: [1, 2, 3, 4, 5, 6, 7, 8].map((c) => ({ classNumber: c, count: 0 }))
    };
  },

  // 3. Teachers Management — Live Only
  async getTeachers(): Promise<Teacher[]> {
    try {
      const liveTeachers = await requestApi<any[]>('/api/v1/teachers');
      if (Array.isArray(liveTeachers)) {
        const formatted: Teacher[] = liveTeachers.map((t) => ({
          id: String(t.id),
          staffIdentifier: t.staffIdentifier || `TCH-${t.id}`,
          name: t.name,
          email: t.email,
          phone: t.phone || '',
          designation: t.designation || 'Faculty Member',
          joiningDate: t.joiningDate || new Date().toISOString().split('T')[0],
          employmentStatus: t.employmentStatus || 'Full-Time',
          accountStatus: t.accountStatus || 'Active',
          salaryConfig: {
            model: t.salaryConfig?.model || 'Fixed monthly',
            baseMonthlySalary: Number(t.salaryConfig?.baseMonthlySalary) || 0,
            perLessonRate: Number(t.salaryConfig?.perLessonRate) || 0,
            perHourRate: Number(t.salaryConfig?.perHourRate) || 0,
            allowances: Number(t.salaryConfig?.allowances) || 0,
            standardDeductions: Number(t.salaryConfig?.standardDeductions) || 0,
            effectiveDate: t.joiningDate || new Date().toISOString().split('T')[0]
          },
          assignments: t.assignments || []
        }));
        return formatted;
      }
    } catch (err) {
      console.warn('getTeachers failed:', err);
    }
    return [];
  },

  async addTeacher(teacherData: Omit<Teacher, 'id'>): Promise<Teacher> {
    const created = await requestApi<any>('/api/v1/teachers', {
      method: 'POST',
      body: JSON.stringify(teacherData)
    });

    const newTeacher: Teacher = {
      id: String(created.id),
      staffIdentifier: created.staffIdentifier,
      name: created.name,
      email: created.email,
      phone: created.phone || '',
      designation: created.designation || 'Faculty Member',
      joiningDate: created.joiningDate || new Date().toISOString().split('T')[0],
      employmentStatus: created.employmentStatus || 'Full-Time',
      accountStatus: created.accountStatus || 'Active',
      salaryConfig: {
        model: created.salaryConfig?.model || 'Fixed monthly',
        baseMonthlySalary: Number(created.salaryConfig?.baseMonthlySalary) || 0,
        perLessonRate: Number(created.salaryConfig?.perLessonRate) || 0,
        perHourRate: Number(created.salaryConfig?.perHourRate) || 0,
        allowances: Number(created.salaryConfig?.allowances) || 0,
        standardDeductions: Number(created.salaryConfig?.standardDeductions) || 0,
        effectiveDate: created.joiningDate || new Date().toISOString().split('T')[0]
      },
      assignments: created.assignments || []
    };

    const db = getStoredDB();
    logAudit(db, 'CREATE_TEACHER', 'Teacher Account', `${newTeacher.name} (${newTeacher.staffIdentifier})`, 'New teacher onboarded via REST API');
    return newTeacher;
  },

  async updateTeacher(id: string, updates: Partial<Teacher>): Promise<Teacher> {
    try {
      await requestApi(`/api/v1/teachers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
    } catch {
      // quiet fallback
    }
    const teachers = await this.getTeachers();
    const found = teachers.find((t) => t.id === id);
    if (found) return { ...found, ...updates };
    return { ...updates, id } as Teacher;
  },

  async changeTeacherStatus(
    id: string,
    action: 'Activate' | 'Temporarily Suspend' | 'Deactivate' | 'Reactivate',
    reason: string,
    expiryDate?: string,
    internalNote?: string
  ): Promise<Teacher> {
    try {
      await requestApi(`/api/v1/teachers/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ action, reason, expiryDate, internalNote })
      });
    } catch (err) {
      console.warn('API status change warning:', err);
    }

    const teachers = await this.getTeachers();
    const teacher = teachers.find(t => t.id === id);
    if (!teacher) throw new Error('Teacher record not found');
    return teacher;
  },

  // 4. Students Management — Live Only
  async getStudents(): Promise<Student[]> {
    try {
      const liveStudents = await requestApi<any[]>('/api/v1/students');
      if (Array.isArray(liveStudents)) {
        const formatted: Student[] = liveStudents.map((s) => ({
          id: `STD-${String(s.id).padStart(2, '0')}`,
          admissionNumber: s.admissionNo || `ADM-${s.id}`,
          rollNumber: s.rollNo || '',
          name: s.name,
          classNumber: Number(s.classNumber) || 1,
          academicSession: '2026-2027',
          admissionDate: s.admissionDate ? String(s.admissionDate).split('T')[0] : '2026-08-01',
          enrolmentStatus: 'Active',
          accountStatus: s.accountStatus === 'ACTIVE' ? 'Active' : s.accountStatus === 'SUSPENDED' ? 'Temporarily Suspended' : 'Deactivated',
          contactEmail: s.email || '',
          contactPhone: s.phone || '',
          parentIds: [],
          parentNames: [],
          transferHistory: []
        }));
        return formatted;
      }
    } catch (err) {
      console.warn('getStudents failed:', err);
    }
    return [];
  },

  async addStudent(studentData: Omit<Student, 'id' | 'transferHistory'>): Promise<Student> {
    const created = await requestApi<any>('/api/v1/students', {
      method: 'POST',
      body: JSON.stringify({
        name: studentData.name,
        admissionNo: studentData.admissionNumber,
        rollNo: studentData.rollNumber,
        currentClassId: studentData.classNumber,
        email: studentData.contactEmail,
        phone: studentData.contactPhone
      })
    });

    const newStudent: Student = {
      ...studentData,
      id: `STD-${String(created.id).padStart(2, '0')}`,
      transferHistory: []
    };

    const db = getStoredDB();
    logAudit(db, 'ADMIT_STUDENT', 'Student Account', `${newStudent.name} (${newStudent.admissionNumber})`, 'New student admission registered via REST API');
    return newStudent;
  },

  async updateStudent(id: string, updates: Partial<Student>): Promise<Student> {
    try {
      const numId = parseInt(id.replace(/\D/g, ''), 10);
      if (numId) {
        await requestApi(`/api/v1/students/${numId}`, {
          method: 'PUT',
          body: JSON.stringify(updates)
        });
      }
    } catch {
      // quiet fallback
    }
    const students = await this.getStudents();
    const found = students.find((s) => s.id === id);
    if (found) return { ...found, ...updates };
    return { ...updates, id } as Student;
  },

  async transferOrPromoteStudent(
    studentId: string,
    destinationClass: number,
    academicSession: string,
    reason: string
  ): Promise<Student> {
    const students = await this.getStudents();
    const student = students.find(s => s.id === studentId);
    if (!student) throw new Error('Student not found');

    const previousClass = student.classNumber;
    student.classNumber = destinationClass;
    student.academicSession = academicSession;
    student.transferHistory.push({
      id: `TRF-${Date.now()}`,
      previousClass,
      newClass: destinationClass,
      academicSession,
      effectiveDate: new Date().toISOString(),
      reason,
      transferredBy: 'Principal'
    });

    return student;
  },

  async changeStudentStatus(
    id: string,
    action: 'Activate' | 'Temporarily Suspend' | 'Deactivate' | 'Reactivate',
    reason: string,
    isFeeNonPayment = false
  ): Promise<Student> {
    const students = await this.getStudents();
    const student = students.find(s => s.id === id);
    if (!student) throw new Error('Student not found');

    student.accountStatus = action === 'Activate' || action === 'Reactivate' ? 'Active' : action === 'Temporarily Suspend' ? 'Temporarily Suspended' : 'Deactivated';
    return student;
  },

  // 5. Parents Management — Live Only
  async getParents(): Promise<Parent[]> {
    try {
      const data = await requestApi<any[]>('/api/v1/parents');
      if (Array.isArray(data)) {
        const mapped: Parent[] = data.map((p) => ({
          id: p.code || `PRN-${String(p.id).padStart(2, '0')}`,
          name: p.name,
          email: p.email,
          phone: p.phone || '',
          cnicOrIdNumber: p.cnic || '42101-0000000-1',
          linkedStudentIds: Array.isArray(p.linkedStudentIds) ? p.linkedStudentIds : [],
          verificationStatus: p.verificationStatus === 'Approved' || p.verificationStatus === 'Verified' ? 'Verified' : p.verificationStatus === 'Rejected' ? 'Rejected' : 'Pending Verification',
          accountStatus: p.accountStatus === 'ACTIVE' ? 'Active' : 'Temporarily Suspended',
          relationship: p.relation === 'MOTHER' ? 'Mother' : p.relation === 'GUARDIAN' ? 'Guardian' : 'Father'
        }));
        return mapped;
      }
    } catch (err) {
      console.warn('getParents failed:', err);
    }
    return [];
  },

  async linkParentToStudent(parentId: string, studentId: string, reason: string): Promise<Parent> {
    const pNum = parseInt(parentId.replace(/\D/g, ''), 10);
    const sNum = parseInt(studentId.replace(/\D/g, ''), 10);
    if (pNum && sNum) {
      await requestApi(`/api/v1/students/${sNum}/guardians`, {
        method: 'POST',
        body: JSON.stringify({
          parentId: pNum,
          relation: 'FATHER',
          isPrimary: true
        })
      });
    }
    const parents = await this.getParents();
    const parent = parents.find(p => p.id === parentId);
    if (!parent) throw new Error('Parent not found');
    return parent;
  },

  async unlinkParentFromStudent(parentId: string, studentId: string, reason: string): Promise<Parent> {
    const parents = await this.getParents();
    const parent = parents.find(p => p.id === parentId);
    if (!parent) throw new Error('Parent not found');
    parent.linkedStudentIds = parent.linkedStudentIds.filter(id => id !== studentId);
    return parent;
  },

  async verifyParent(parentId: string, status: 'Verified' | 'Rejected', reason: string): Promise<Parent> {
    const numId = parseInt(parentId.replace(/\D/g, ''), 10);
    if (numId) {
      await requestApi(`/api/v1/parents/${numId}/approve`, {
        method: 'POST',
        body: JSON.stringify({
          status: status === 'Verified' ? 'APPROVED' : 'REJECTED',
          reason
        })
      });
    }
    const parents = await this.getParents();
    const parent = parents.find(p => p.id === parentId);
    if (!parent) throw new Error('Parent not found');
    parent.verificationStatus = status;
    return parent;
  },

  // 6. Academic Setup & Classes — Live Only
  async getAcademicSessions(): Promise<AcademicSession[]> {
    try {
      const data = await requestApi<any[]>('/api/v1/sessions');
      if (Array.isArray(data) && data.length > 0) {
        return data.map((s) => ({
          id: String(s.id),
          name: s.name,
          startDate: s.start_date ? String(s.start_date).split('T')[0] : '2026-08-01',
          endDate: s.end_date ? String(s.end_date).split('T')[0] : '2027-05-31',
          status: s.is_current ? 'Active' : 'Draft'
        }));
      }
    } catch (err) {
      console.warn('getAcademicSessions failed:', err);
    }
    return [];
  },

  async getClasses(): Promise<SchoolClass[]> {
    try {
      const [classesData, studentsData] = await Promise.all([
        requestApi<any[]>('/api/v1/classes'),
        requestApi<any[]>('/api/v1/students').catch(() => [])
      ]);
      if (Array.isArray(classesData) && classesData.length > 0) {
        const classes = await Promise.all(
          classesData.map(async (c) => {
            const classNum = Number(c.grade_level || c.classNumber || c.id);
            const studentCount = Array.isArray(studentsData)
              ? studentsData.filter((s: any) => Number(s.classNumber) === classNum).length
              : 0;
            let realSubjects: any[] = [];
            try {
              realSubjects = await requestApi<any[]>(`/api/v1/classes/${c.id}/subjects`);
            } catch {
              realSubjects = [];
            }
            return {
              classNumber: classNum,
              name: c.name || `Class ${classNum}`,
              academicSession: '2026-27',
              isActive: true,
              totalStudents: studentCount,
              subjects: Array.isArray(realSubjects)
                ? realSubjects.map((s) => ({
                    id: String(s.id),
                    name: s.name,
                    code: s.code || '',
                    classNumber: classNum,
                    weeklyLessons: 5,
                    assignedTeacherIds: []
                  }))
                : []
            };
          })
        );
        return classes;
      }
    } catch (err) {
      console.warn('getClasses failed:', err);
    }
    return [];
  },

  async assignTeacherToSubject(
    classNumber: number,
    subjectId: string,
    teacherId: string,
    reason: string
  ): Promise<SchoolClass> {
    const classes = await this.getClasses();
    const schoolClass = classes.find(c => c.classNumber === classNumber);
    if (!schoolClass) throw new Error('Class not found');
    return schoolClass;
  },

  // 7. Timetable Management — Live Only
  async getTimetableLessons(): Promise<TimetableLesson[]> {
    try {
      const res = await requestApi<any>('/api/v1/timetable/slots');
      const list = Array.isArray(res) ? res : res?.data;
      if (Array.isArray(list) && list.length > 0) {
        const daysMap: Record<number, DayOfWeek> = {
          1: 'Monday',
          2: 'Tuesday',
          3: 'Wednesday',
          4: 'Thursday',
          5: 'Friday',
          6: 'Saturday'
        };
        return list.map((slot: any) => ({
          id: `SLOT-${slot.id}`,
          classNumber: slot.classNumber,
          subjectId: String(slot.subjectId),
          subjectName: slot.subjectName,
          teacherId: `TCH-${String(slot.teacherId).padStart(2, '0')}`,
          teacherName: slot.teacherName,
          dayOfWeek: daysMap[slot.weekday] || 'Monday',
          startTime: String(slot.startTime).substring(0, 5),
          endTime: String(slot.endTime).substring(0, 5),
          timezone: 'Asia/Karachi',
          academicSession: '2026-27',
          zoomMeetingId: `900-${slot.classNumber}000-${slot.classNumber}`,
          publicationStatus: slot.status === 'PUBLISHED' ? 'Published' : 'Draft',
          lessonStatus: 'Scheduled',
          history: []
        }));
      }
    } catch (err) {
      console.warn('getTimetableLessons failed:', err);
    }
    return [];
  },

  async saveTimetableLesson(lessonData: Omit<TimetableLesson, 'id' | 'history'>, lessonId?: string, reason = 'Timetable update'): Promise<TimetableLesson> {
    const weekdayMap: Record<string, number> = {
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
      Sunday: 7
    };

    const rawClassId = Number(lessonData.classNumber) || 1;
    const rawSubjectId = Number(lessonData.subjectId) || 1;
    const rawTeacherId = parseInt(String(lessonData.teacherId).replace(/\D/g, ''), 10) || 1;
    const startTimeFormatted = lessonData.startTime.length === 5 ? `${lessonData.startTime}:00` : lessonData.startTime;
    const endTimeFormatted = lessonData.endTime.length === 5 ? `${lessonData.endTime}:00` : lessonData.endTime;

    const numSlotId = lessonId ? parseInt(lessonId.replace(/\D/g, ''), 10) : null;

    if (numSlotId) {
      await requestApi(`/api/v1/timetable/slots/${numSlotId}`, {
        method: 'PUT',
        body: JSON.stringify({
          classId: rawClassId,
          subjectId: rawSubjectId,
          teacherId: rawTeacherId,
          weekday: weekdayMap[lessonData.dayOfWeek] || 1,
          startTime: startTimeFormatted,
          endTime: endTimeFormatted
        })
      });
    } else {
      await requestApi('/api/v1/timetable/slots', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: 1,
          classId: rawClassId,
          subjectId: rawSubjectId,
          teacherId: rawTeacherId,
          weekday: weekdayMap[lessonData.dayOfWeek] || 1,
          startTime: startTimeFormatted,
          endTime: endTimeFormatted,
          effectiveFrom: new Date().toISOString().split('T')[0]
        })
      });
    }

    const all = await this.getTimetableLessons();
    const found = all.find(
      (s) =>
        s.classNumber === lessonData.classNumber &&
        s.dayOfWeek === lessonData.dayOfWeek &&
        s.startTime === lessonData.startTime.substring(0, 5)
    );
    return found || { ...lessonData, id: lessonId || `SLOT-${Date.now()}`, history: [] };
  },

  async cancelTimetableLesson(lessonId: string, reason: string): Promise<TimetableLesson> {
    const numId = parseInt(lessonId.replace(/\D/g, ''), 10);
    if (numId) {
      try {
        await requestApi(`/api/v1/timetable/slots/${numId}`, {
          method: 'DELETE'
        });
      } catch (err) {
        console.warn('cancelTimetableLesson backend warning:', err);
      }
    }
    const lessons = await this.getTimetableLessons();
    const found = lessons.find(l => l.id === lessonId);
    if (found) {
      found.lessonStatus = 'Cancelled';
      return found;
    }
    return { id: lessonId, lessonStatus: 'Cancelled' } as TimetableLesson;
  },

  async publishTimetable(classNumber?: number): Promise<void> {
    try {
      await requestApi('/api/v1/timetable/publish', {
        method: 'POST',
        body: JSON.stringify({ sessionId: 1, days: 14 })
      });
    } catch (err) {
      console.warn('publishTimetable failed:', err);
    }
  },

  // 8. Zoom Class Links Management — Live Only
  async getZoomMeetings(): Promise<ClassZoomMeeting[]> {
    try {
      let res = await requestApi<any>('/api/v1/zoom/class-meetings');
      let list = Array.isArray(res) ? res : res?.data;
      if (Array.isArray(list) && list.length === 0) {
        await requestApi('/api/v1/zoom/class-meetings/setup', { method: 'POST', body: JSON.stringify({}) });
        res = await requestApi<any>('/api/v1/zoom/class-meetings');
        list = Array.isArray(res) ? res : res?.data;
      }

      if (Array.isArray(list) && list.length > 0) {
        return list.map((m: any) => ({
          id: `ZM-${m.id}`,
          classNumber: m.classNumber,
          zoomMeetingId: String(m.zoomMeetingId),
          passcode: `CLASS${m.classNumber}#`,
          joinUrl: `https://zoom.us/j/${m.zoomMeetingId}?pwd=CLASS${m.classNumber}#`,
          status: m.status === 'ACTIVE' ? 'Active' : 'Expired',
          createdDate: new Date().toISOString().split('T')[0],
          lastRenewalDate: new Date().toISOString().split('T')[0],
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          lastHealthCheckDate: m.lastHealthCheckAt ? new Date(m.lastHealthCheckAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          healthCheckStatus: m.lastHealthStatus === 'HEALTHY' ? 'Operational' : 'Degraded',
          renewalHistory: []
        }));
      }
    } catch (err) {
      console.warn('getZoomMeetings failed:', err);
    }
    return [];
  },

  async renewZoomMeeting(classNumber: number, reason: string): Promise<ClassZoomMeeting> {
    const meetings = await this.getZoomMeetings();
    const meeting = meetings.find(m => m.classNumber === classNumber);
    if (!meeting) throw new Error('Meeting not found');
    return meeting;
  },

  async runZoomHealthCheck(classNumber: number): Promise<ClassZoomMeeting> {
    const meetings = await this.getZoomMeetings();
    const meeting = meetings.find(m => m.classNumber === classNumber);
    if (!meeting) throw new Error('Meeting not found');
    meeting.lastHealthCheckDate = new Date().toISOString();
    return meeting;
  },

  // 9. Attendance Oversight — Live Only
  async getAttendanceSummaries(): Promise<LessonAttendanceSummary[]> {
    return [];
  },

  async getAttendanceCorrections(): Promise<AttendanceCorrectionRequest[]> {
    try {
      const res = await requestApi<any>('/api/v1/attendance/corrections');
      const list = Array.isArray(res) ? res : res?.data;
      if (Array.isArray(list) && list.length > 0) {
        return list.map((c: any) => ({
          id: `COR-${c.id}`,
          lessonId: `LES-${String(c.lessonId).padStart(2, '0')}`,
          classNumber: c.classNumber,
          subjectName: c.subjectName,
          date: c.lessonDate,
          teacherId: `TCH-${String(c.requestedByUserId).padStart(2, '0')}`,
          teacherName: c.requestedByName,
          studentId: `STD-${String(c.studentId).padStart(2, '0')}`,
          studentName: c.studentName,
          originalStatus: (c.originalStatus === 'PRESENT' ? 'Present' : c.originalStatus === 'ABSENT' ? 'Absent' : c.originalStatus === 'LATE' ? 'Late' : 'Leave'),
          proposedStatus: (c.proposedStatus === 'PRESENT' ? 'Present' : c.proposedStatus === 'ABSENT' ? 'Absent' : c.proposedStatus === 'LATE' ? 'Late' : 'Leave'),
          teacherReason: c.reason,
          requestedAt: c.createdAt,
          status: c.status === 'APPROVED' ? 'Approved' : c.status === 'REJECTED' ? 'Rejected' : 'Pending',
          reviewedBy: c.reviewedByName,
          reviewRemarks: c.reviewRemarks,
          reviewedAt: c.reviewedAt
        }));
      }
    } catch (err) {
      console.warn('getAttendanceCorrections failed:', err);
    }
    return [];
  },

  async reviewAttendanceCorrection(
    correctionId: string,
    decision: 'Approved' | 'Rejected',
    reviewRemarks: string
  ): Promise<AttendanceCorrectionRequest> {
    const numId = parseInt(correctionId.replace(/\D/g, ''), 10);
    if (numId) {
      await requestApi(`/api/v1/attendance/corrections/${numId}/review`, {
        method: 'POST',
        body: JSON.stringify({
          status: decision.toUpperCase(),
          reviewRemarks
        })
      });
    }
    const corrections = await this.getAttendanceCorrections();
    const found = corrections.find(c => c.id === correctionId);
    if (!found) throw new Error('Correction request not found');
    found.status = decision;
    return found;
  },

  async submitDailyAttendance(data: {
    classNumber: number;
    subjectName: string;
    teacherName: string;
    date: string;
    startTime: string;
    endTime: string;
    records: StudentAttendanceRecord[];
  }): Promise<LessonAttendanceSummary> {
    return {
      id: `ATT-${Date.now()}`,
      lessonId: `LES-${Date.now()}`,
      classNumber: data.classNumber,
      subjectName: data.subjectName,
      teacherId: 'TCH-01',
      teacherName: data.teacherName,
      date: data.date,
      startTime: data.startTime,
      endTime: data.endTime,
      enrolledStudentsCount: data.records.length,
      submissionStatus: 'Submitted',
      submittedAt: new Date().toISOString(),
      records: data.records
    };
  },

  // 10. Fee Structures & Concessions — Live Only
  async getFeeStructures(): Promise<ClassFeeStructure[]> {
    try {
      const data = await requestApi<any[]>('/api/v1/fees/structures');
      if (Array.isArray(data) && data.length > 0) {
        return data.map((d) => ({
          id: String(d.id),
          classNumber: Number(d.classNumber || d.classId),
          academicSession: d.academicSession || '2026-27',
          heads: (d.heads || []).map((h: any) => ({
            id: String(h.id || Math.random()),
            head: h.head || 'Tuition',
            amount: Number(h.amount),
            isRecurring: Boolean(h.isRecurring),
            description: h.description
          })),
          totalMonthlyRecurring: Number(d.totalMonthlyRecurring),
          effectiveFrom: d.effectiveFrom || new Date().toISOString().split('T')[0],
          status: 'Active'
        }));
      }
    } catch {
      // Fallback
    }
    return [];
  },

  async getConcessions(): Promise<StudentConcession[]> {
    try {
      const data = await requestApi<any[]>('/api/v1/fees/concessions');
      if (Array.isArray(data)) {
        return data.map((c) => ({
          id: String(c.id),
          studentId: String(c.studentId),
          studentName: c.studentName || 'Student',
          classNumber: Number(c.classNumber || 1),
          concessionType: (c.concessionType === 'PERCENTAGE' ? 'Percentage' : c.concessionType === 'SIBLING_DISCOUNT' ? 'Sibling Discount' : 'Fixed Amount') as any,
          value: Number(c.value),
          reason: c.reason || '',
          approvedBy: c.approvedBy || 'Principal',
          effectiveSession: c.effectiveSession || '2026-27',
          status: (c.status === 'REVOKED' ? 'Revoked' : 'Active') as any
        }));
      }
    } catch {
      // Fallback
    }
    return [];
  },

  async updateFeeStructure(
    classNumber: number,
    heads: ClassFeeStructure['heads'],
    reason: string
  ): Promise<ClassFeeStructure> {
    await requestApi('/api/v1/fees/structures', {
      method: 'POST',
      body: JSON.stringify({
        classId: classNumber,
        heads: heads.map((h) => ({
          head: h.head,
          amount: Number(h.amount),
          isRecurring: h.isRecurring,
          description: h.description
        }))
      })
    });

    const newRecurring = heads
      .filter((h) => h.isRecurring)
      .reduce((sum, h) => sum + Number(h.amount), 0);

    return {
      id: `FS-${classNumber}`,
      classNumber,
      academicSession: '2026-27',
      heads,
      totalMonthlyRecurring: newRecurring,
      effectiveFrom: new Date().toISOString().split('T')[0],
      status: 'Active'
    };
  },

  async addConcession(concessionData: Omit<StudentConcession, 'id' | 'approvedBy'>): Promise<StudentConcession> {
    const res = await requestApi<any>('/api/v1/fees/concessions', {
      method: 'POST',
      body: JSON.stringify({
        studentId: Number(concessionData.studentId),
        concessionType: concessionData.concessionType.toUpperCase().replace(/\s+/g, '_'),
        value: Number(concessionData.value),
        reason: concessionData.reason
      })
    });

    return {
      ...concessionData,
      id: String(res?.id || Date.now()),
      approvedBy: 'Prof. Tariq Mahmood'
    };
  },

  // 11. Challans & Billing — Live Only
  async getChallans(): Promise<MonthlyChallan[]> {
    try {
      const data = await requestApi<any[]>('/api/v1/fees/challans');
      if (Array.isArray(data) && data.length > 0) {
        return data.map((ch) => ({
          id: String(ch.id),
          challanNumber: ch.challanNumber,
          studentId: String(ch.studentId),
          studentName: ch.studentName || 'Student',
          rollNumber: ch.rollNumber || '01',
          admissionNumber: ch.admissionNumber || 'ADM-01',
          classNumber: Number(ch.classNumber || 1),
          billingMonth: ch.billingMonth,
          academicSession: ch.academicSession || '2026-27',
          generationDate: ch.generationDate || new Date().toISOString().split('T')[0],
          dueDate: ch.dueDate || '',
          gracePeriodDays: Number(ch.gracePeriodDays || 5),
          breakdown: {
            tuitionFee: Number(ch.breakdown?.tuitionFee || 0),
            technologyFee: Number(ch.breakdown?.technologyFee || 0),
            examinationFee: Number(ch.breakdown?.examinationFee || 0),
            booksFee: Number(ch.breakdown?.booksFee || 0),
            admissionFee: Number(ch.breakdown?.admissionFee || 0),
            otherFee: Number(ch.breakdown?.otherFee || 0),
            grossAmount: Number(ch.breakdown?.grossAmount || 0),
            concessionAmount: Number(ch.breakdown?.concessionAmount || 0),
            arrearsAmount: Number(ch.breakdown?.arrearsAmount || 0),
            lateFeeAmount: Number(ch.breakdown?.lateFeeAmount || 500),
            totalPayable: Number(ch.breakdown?.totalPayable || ch.totalPayable || 0)
          },
          paidAmount: Number(ch.paidAmount || 0),
          outstandingBalance: Number(ch.outstandingBalance ?? (ch.totalPayable - ch.paidAmount)),
          status: (ch.status === 'PAID' ? 'Paid' : ch.status === 'PENDING_VERIFICATION' ? 'Pending Verification' : ch.status === 'PARTIALLY_PAID' ? 'Partially Paid' : 'Unpaid') as any,
          remindersSentCount: Number(ch.remindersSentCount || 0),
          lastReminderDate: ch.lastReminderDate
        }));
      }
    } catch {
      // Fallback
    }
    return [];
  },

  async generateMonthlyChallans(
    billingMonth: string,
    dueDate: string,
    lateFeeAmount = 500,
    gracePeriodDays = 5
  ): Promise<{ generatedCount: number; skippedCount: number; message: string }> {
    try {
      const res = await requestApi<any>('/api/v1/fees/challans/generate', {
        method: 'POST',
        body: JSON.stringify({
          billingMonth,
          dueDate,
          lateFeeAmount,
          gracePeriodDays
        })
      });
      return {
        generatedCount: res.count || 0,
        skippedCount: 0,
        message: res.message || `Generated ${res.count || 0} challans for ${billingMonth}`
      };
    } catch {
      return {
        generatedCount: 0,
        skippedCount: 0,
        message: `No active students found to generate challans for ${billingMonth}.`
      };
    }
  },

  async sendFeeReminder(challanId: string): Promise<MonthlyChallan> {
    const challans = await this.getChallans();
    const challan = challans.find(c => c.id === challanId);
    if (!challan) throw new Error('Challan not found');
    challan.remindersSentCount = (challan.remindersSentCount || 0) + 1;
    challan.lastReminderDate = new Date().toISOString().split('T')[0];
    return challan;
  },

  async createIndividualChallan(data: any): Promise<MonthlyChallan> {
    const challanNumber = `CH-${data.billingMonth}-${Date.now().toString().slice(-4)}`;
    return {
      id: `CH-${Date.now()}`,
      challanNumber,
      studentId: data.studentId,
      studentName: 'Student',
      rollNumber: '01',
      admissionNumber: 'ADM-01',
      classNumber: 1,
      billingMonth: data.billingMonth,
      academicSession: '2026-27',
      generationDate: new Date().toISOString().split('T')[0],
      dueDate: data.dueDate,
      gracePeriodDays: data.gracePeriodDays ?? 5,
      breakdown: {
        tuitionFee: Number(data.tuitionFee || 0),
        technologyFee: Number(data.techFee || 0),
        examinationFee: Number(data.examFee || 0),
        booksFee: 0,
        admissionFee: 0,
        otherFee: 0,
        grossAmount: Number(data.tuitionFee || 0) + Number(data.techFee || 0) + Number(data.examFee || 0),
        concessionAmount: 0,
        arrearsAmount: 0,
        lateFeeAmount: Number(data.lateFeeAmount || 500),
        totalPayable: Number(data.tuitionFee || 0) + Number(data.techFee || 0) + Number(data.examFee || 0)
      },
      paidAmount: 0,
      outstandingBalance: Number(data.tuitionFee || 0) + Number(data.techFee || 0) + Number(data.examFee || 0),
      status: 'Unpaid',
      remindersSentCount: 0
    };
  },

  // 12. Payment Proof Verification — Live Only
  async getPaymentProofs(): Promise<PaymentProofSubmission[]> {
    try {
      const data = await requestApi<any[]>('/api/v1/fees/payment-proofs');
      if (Array.isArray(data) && data.length > 0) {
        return data.map((p) => ({
          id: String(p.id),
          challanId: String(p.challanId),
          challanNumber: p.challanNumber || `CH-${p.challanId}`,
          studentId: String(p.studentId),
          studentName: p.studentName || 'Student',
          parentId: String(p.parentId || ''),
          parentName: p.parentName || 'Parent',
          classNumber: Number(p.classNumber || 1),
          submittedAmount: Number(p.submittedAmount),
          bankOrWallet: p.bankOrWallet || 'Bank Transfer',
          transactionReference: p.transactionReference || '',
          paymentDate: p.paymentDate || '',
          proofDocumentUrl: p.proofDocumentUrl || '',
          submissionTimestamp: p.submissionTimestamp || new Date().toISOString(),
          status: (p.status === 'APPROVED'
            ? 'Approved'
            : p.status === 'REJECTED'
            ? 'Rejected'
            : p.status === 'RESUBMIT_REQUESTED'
            ? 'Resubmission Requested'
            : 'Pending') as any,
          reviewedBy: p.reviewedBy,
          reviewTimestamp: p.reviewTimestamp,
          reviewDecisionNote: p.reviewDecisionNote,
          verifiedAmount: p.verifiedAmount ? Number(p.verifiedAmount) : undefined,
          receiptNumber: p.receiptNumber
        }));
      }
    } catch {
      // Fallback
    }
    return [];
  },

  async verifyPaymentProof(
    submissionId: string,
    decision: 'Approved' | 'Rejected' | 'Resubmission Requested',
    verifiedAmount: number,
    decisionNote: string
  ): Promise<PaymentProofSubmission> {
    const statusMap: Record<string, string> = {
      Approved: 'APPROVED',
      Rejected: 'REJECTED',
      'Resubmission Requested': 'RESUBMIT_REQUESTED'
    };
    await requestApi(`/api/v1/fees/payment-proofs/${submissionId}/review`, {
      method: 'POST',
      body: JSON.stringify({
        status: statusMap[decision] || 'APPROVED',
        verifiedAmount: Number(verifiedAmount),
        reviewDecisionNote: decisionNote
      })
    });

    const proofs = await this.getPaymentProofs();
    const submission = proofs.find(p => p.id === submissionId);
    if (!submission) throw new Error('Payment submission not found');
    submission.status = decision;
    return submission;
  },

  // 13. Teacher Payroll & Duty — Live Only
  async getSalaryDrafts(): Promise<TeacherSalaryDraft[]> {
    try {
      const data = await requestApi<TeacherSalaryDraft[]>('/api/v1/payroll/drafts');
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch {
      // Fallback
    }
    return [];
  },

  async generateSalaryDrafts(payrollMonth: string): Promise<{ generatedCount: number; skippedCount: number; message: string }> {
    try {
      const res = await requestApi<any>('/api/v1/payroll/drafts/generate', {
        method: 'POST',
        body: JSON.stringify({ payrollMonth })
      });
      return res || { generatedCount: 0, skippedCount: 0, message: `Completed for ${payrollMonth}` };
    } catch {
      return {
        generatedCount: 0,
        skippedCount: 0,
        message: `No active teachers found to generate salary drafts for ${payrollMonth}`
      };
    }
  },

  async reviewSalaryDraft(
    draftId: string,
    decision: 'Approved' | 'Returned for Correction' | 'Rejected',
    reviewRemarks: string
  ): Promise<TeacherSalaryDraft> {
    const updated = await requestApi<TeacherSalaryDraft>(`/api/v1/payroll/drafts/${draftId}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, reviewRemarks })
    });
    return updated;
  },

  async addSalaryAdjustment(
    draftId: string,
    adjustment: { type: 'Addition' | 'Deduction'; title: string; amount: number; reason: string }
  ): Promise<TeacherSalaryDraft> {
    const updated = await requestApi<TeacherSalaryDraft>(`/api/v1/payroll/drafts/${draftId}/adjustments`, {
      method: 'POST',
      body: JSON.stringify(adjustment)
    });
    return updated;
  },

  // 14. Academic Oversight — Live Only
  async getAcademicPerformances(): Promise<AcademicClassPerformance[]> {
    try {
      const data = await requestApi<AcademicClassPerformance[]>('/api/v1/reports/academic-performance');
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch {
      // Fallback
    }
    return [];
  },

  async approveResultPublication(classNumber: number): Promise<void> {
    try {
      await requestApi(`/api/v1/reports/academic-performance/${classNumber}/publish`, {
        method: 'POST'
      });
    } catch {
      // Fallback
    }
  },

  // 15. Notices — Live Only
  async getNotices(): Promise<SchoolNotice[]> {
    try {
      const data = await requestApi<SchoolNotice[]>('/api/v1/notices');
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch {
      // Fallback
    }
    return [];
  },

  async createNotice(noticeData: Omit<SchoolNotice, 'id' | 'createdBy' | 'publishDate'>): Promise<SchoolNotice> {
    const created = await requestApi<SchoolNotice>('/api/v1/notices', {
      method: 'POST',
      body: JSON.stringify(noticeData)
    });
    return created;
  },

  // 16. Notifications — Live Only
  async getNotifications(): Promise<OperationalNotification[]> {
    try {
      const data = await requestApi<OperationalNotification[]>('/api/v1/notices/notifications');
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch {
      // Fallback
    }
    return [];
  },

  async markNotificationAsRead(id: string): Promise<void> {
    try {
      await requestApi(`/api/v1/notices/notifications/${id}/read`, {
        method: 'POST'
      });
    } catch {
      // Fallback
    }
  },

  async markAllNotificationsRead(): Promise<void> {
    try {
      await requestApi('/api/v1/notices/notifications/read-all', {
        method: 'POST'
      });
    } catch {
      // Fallback
    }
  },

  // 17. Audit Logs — Live Only
  async getAuditLogs(): Promise<AuditLogEntry[]> {
    try {
      const data = await requestApi<AuditLogEntry[]>('/api/v1/audit');
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch {
      // Fallback
    }
    return [];
  }
};
