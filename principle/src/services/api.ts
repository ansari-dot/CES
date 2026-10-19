import {
  SchoolDatabase,
  initialDatabase
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

const STORAGE_KEY = 'iqra_principal_portal_db_v2';

function getStoredDB(): SchoolDatabase {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initialDatabase));
      return initialDatabase;
    }
    return JSON.parse(raw);
  } catch {
    return initialDatabase;
  }
}

function saveDB(db: SchoolDatabase): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (err) {
    console.error('Failed to persist database state:', err);
  }
}

const delay = (ms = 120) => new Promise((resolve) => setTimeout(resolve, ms));

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
  // Reset database to initial seed data
  async resetDatabase(): Promise<SchoolDatabase> {
    await delay();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialDatabase));
    return initialDatabase;
  },

  // 1. Authentication & Principal Profile
  async login(email: string, password: string): Promise<UserProfile> {
    try {
      const data = await requestApi<any>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: email, password })
      });

      const principal: UserProfile = {
        id: String(data.id),
        name: data.fullName || data.username,
        email: data.email || email,
        phone: data.phone || '',
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
    } catch (apiErr: any) {
      // If it's a real credential error from backend, throw it
      if (apiErr.message && !apiErr.message.includes('Failed to fetch') && !apiErr.message.includes('NetworkError')) {
        throw apiErr;
      }

      // Offline / network fallback
      await delay(300);
      const db = getStoredDB();
      const cleanEmail = (email || '').trim().toLowerCase();
      const principal = db.principalProfile;
      const isAllowedEmail =
        cleanEmail === principal.email.toLowerCase() ||
        cleanEmail === 'admin@iqraonlineacademy.edu.pk' ||
        cleanEmail === 'principal@school.pk' ||
        cleanEmail === 'principal' ||
        cleanEmail === 'admin';

      if (!isAllowedEmail || !password || password.trim().length < 3) {
        throw new Error('Invalid email or password. Please try again.');
      }

      principal.lastLogin = new Date().toISOString();
      saveDB(db);
      return principal;
    }
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
        phone: data.phone || '',
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

  // 2. Dashboard Statistics
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [teachersRes, studentsRes, feeStatsRes, todayLessonsRes, proofsRes, draftsRes, correctionsRes] = await Promise.all([
        requestApi<any[]>('/api/v1/teachers').catch(() => null),
        requestApi<any[]>('/api/v1/students').catch(() => null),
        requestApi<any>('/api/v1/fees/stats').catch(() => null),
        requestApi<any[]>(`/api/v1/timetable/lessons?date=${today}`).catch(() => null),
        requestApi<any[]>('/api/v1/fees/payment-proofs').catch(() => null),
        requestApi<any[]>('/api/v1/payroll/drafts').catch(() => null),
        requestApi<any[]>('/api/v1/attendance/corrections').catch(() => null)
      ]);

      if (teachersRes && studentsRes) {
        const activeTeachers = teachersRes.filter((t) => t.accountStatus === 'Active' || t.employmentStatus === 'ACTIVE').length;
        const inactiveTeachers = teachersRes.length - activeTeachers;
        const totalActiveStudents = studentsRes.filter((s) => s.accountStatus === 'Active' || s.enrollmentStatus === 'ACTIVE').length;

        const lessons = Array.isArray(todayLessonsRes) ? todayLessonsRes : [];
        const completedLessonsToday = lessons.filter((l) => l.status === 'COMPLETED').length;
        const cancelledLessonsToday = lessons.filter((l) => l.status === 'CANCELLED').length;
        const missedLessonsToday = lessons.filter((l) => l.status === 'MISSED').length;

        const monthlyFeeCollectedAmount = Number(feeStatsRes?.totalCollected || feeStatsRes?.collectedAmount || 0);
        const monthlyFeeTargetAmount = Number(feeStatsRes?.totalReceivable || feeStatsRes?.targetAmount || 0);
        const outstandingArrearsAmount = Number(feeStatsRes?.totalOutstanding || feeStatsRes?.outstandingAmount || 0);

        const pendingPaymentProofsCount = Array.isArray(proofsRes) ? proofsRes.filter((p) => p.status === 'Pending' || p.status === 'PENDING').length : 0;
        const pendingSalaryDraftsCount = Array.isArray(draftsRes) ? draftsRes.filter((d) => d.status === 'SUBMITTED' || d.status === 'Submitted for Approval').length : 0;
        const pendingAttendanceCorrectionsCount = Array.isArray(correctionsRes) ? correctionsRes.filter((c) => c.status === 'PENDING' || c.status === 'Pending').length : 0;

        const enrolmentByClass = [1, 2, 3, 4, 5, 6, 7, 8].map((cls) => ({
          classNumber: cls,
          count: studentsRes.filter((s) => Number(s.classNumber) === cls).length
        }));

        return {
          totalActiveStudents,
          activeTeachers,
          inactiveTeachers,
          todayScheduledLessons: lessons.length,
          completedLessonsToday,
          cancelledLessonsToday,
          missedLessonsToday,
          overallAttendancePercentage: 92.5,
          monthlyFeeCollectedAmount,
          monthlyFeeTargetAmount,
          outstandingArrearsAmount,
          pendingPaymentProofsCount,
          pendingSalaryDraftsCount,
          pendingAttendanceCorrectionsCount,
          enrolmentByClass
        };
      }
    } catch (err) {
      console.warn('Dashboard metrics API call fallback:', err);
    }

    await delay();
    const db = getStoredDB();
    const activeTeachers = db.teachers.filter(t => t.accountStatus === 'Active').length;
    const inactiveTeachers = db.teachers.length - activeTeachers;
    const totalActiveStudents = db.students.filter(s => s.accountStatus === 'Active').length;

    const todayLessons = db.timetableLessons.filter(l => l.dayOfWeek === 'Monday');
    const completedLessonsToday = todayLessons.filter(l => l.lessonStatus === 'Completed').length;
    const cancelledLessonsToday = todayLessons.filter(l => l.lessonStatus === 'Cancelled').length;
    const missedLessonsToday = todayLessons.filter(l => l.lessonStatus === 'Missed').length;

    const monthlyFeeCollectedAmount = db.challans.reduce((sum, ch) => sum + (ch.paidAmount || 0), 0);
    const monthlyFeeTargetAmount = db.challans.reduce((sum, ch) => sum + ch.breakdown.totalPayable, 0);
    const outstandingArrearsAmount = db.challans.reduce((sum, ch) => sum + (ch.outstandingBalance || 0), 0);

    const pendingPaymentProofsCount = db.paymentProofs.filter(p => p.status === 'Pending').length;
    const pendingSalaryDraftsCount = db.salaryDrafts.filter(s => s.status === 'Submitted for Approval').length;
    const pendingAttendanceCorrectionsCount = db.attendanceCorrections.filter(c => c.status === 'Pending').length;

    const enrolmentByClass = [1, 2, 3, 4, 5, 6, 7, 8].map(cls => ({
      classNumber: cls,
      count: db.students.filter(s => s.classNumber === cls).length
    }));

    return {
      totalActiveStudents,
      activeTeachers,
      inactiveTeachers,
      todayScheduledLessons: todayLessons.length,
      completedLessonsToday,
      cancelledLessonsToday,
      missedLessonsToday,
      overallAttendancePercentage: 91.4,
      monthlyFeeCollectedAmount,
      monthlyFeeTargetAmount,
      outstandingArrearsAmount,
      pendingPaymentProofsCount,
      pendingSalaryDraftsCount,
      pendingAttendanceCorrectionsCount,
      enrolmentByClass
    };
  },

  // 3. Teachers Management
  async getTeachers(): Promise<Teacher[]> {
    try {
      const liveTeachers = await requestApi<any[]>('/api/v1/teachers');
      if (Array.isArray(liveTeachers)) {
        const formatted: Teacher[] = liveTeachers.map((t) => ({
          id: t.id,
          staffIdentifier: t.staffIdentifier,
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

        const db = getStoredDB();
        db.teachers = formatted;
        saveDB(db);
        return formatted;
      }
    } catch (err) {
      console.warn('API getTeachers fallback to stored DB:', err);
    }
    await delay();
    return getStoredDB().teachers;
  },

  async addTeacher(teacherData: Omit<Teacher, 'id'>): Promise<Teacher> {
    try {
      const created = await requestApi<any>('/api/v1/teachers', {
        method: 'POST',
        body: JSON.stringify(teacherData)
      });

      const newTeacher: Teacher = {
        id: created.id,
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
      db.teachers.unshift(newTeacher);
      logAudit(db, 'CREATE_TEACHER', 'Teacher Account', `${newTeacher.name} (${newTeacher.staffIdentifier})`, 'New teacher onboarded via REST API');
      saveDB(db);

      return newTeacher;
    } catch (err: any) {
      console.warn('REST API addTeacher failed, trying mock fallback:', err);
      await delay();
      const db = getStoredDB();
      const newId = `TCH-${String(db.teachers.length + 1).padStart(2, '0')}`;
      const newTeacher: Teacher = { ...teacherData, id: newId };
      db.teachers.push(newTeacher);
      saveDB(db);
      return newTeacher;
    }
  },

  async updateTeacher(id: string, updates: Partial<Teacher>): Promise<Teacher> {
    await delay();
    const db = getStoredDB();
    const index = db.teachers.findIndex(t => t.id === id);
    if (index === -1) throw new Error('Teacher record not found');
    const prev = db.teachers[index];
    db.teachers[index] = { ...prev, ...updates };
    logAudit(db, 'UPDATE_TEACHER_PROFILE', 'Teacher Account', `${prev.name} (${prev.staffIdentifier})`, 'Teacher profile/employment details updated', `Status: ${prev.accountStatus}`, `Status: ${db.teachers[index].accountStatus}`);
    saveDB(db);
    return db.teachers[index];
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
        body: JSON.stringify({ action, reason })
      });
    } catch (err) {
      console.warn('API status change warning:', err);
    }

    await delay();
    const db = getStoredDB();
    const teacher = db.teachers.find(t => t.id === id);
    if (!teacher) throw new Error('Teacher record not found');

    const prevStatus = teacher.accountStatus;
    let newStatus: AccountStatus = 'Active';

    if (action === 'Temporarily Suspend') {
      newStatus = 'Temporarily Suspended';
      teacher.suspensionDetails = {
        reason,
        effectiveDate: new Date().toISOString(),
        expiryDate,
        internalNote,
        suspendedBy: db.principalProfile.name
      };
    } else if (action === 'Deactivate') {
      newStatus = 'Deactivated';
      teacher.suspensionDetails = {
        reason,
        effectiveDate: new Date().toISOString(),
        internalNote,
        suspendedBy: db.principalProfile.name
      };
    } else {
      newStatus = 'Active';
      delete teacher.suspensionDetails;
    }

    teacher.accountStatus = newStatus;
    logAudit(
      db,
      `TEACHER_${action.toUpperCase().replace(/\s+/g, '_')}`,
      'Teacher Account',
      `${teacher.name} (${teacher.staffIdentifier})`,
      reason,
      `Previous: ${prevStatus}`,
      `New: ${newStatus}${expiryDate ? ` (Expires: ${expiryDate})` : ''}`
    );
    saveDB(db);
    return teacher;
  },

  // 4. Students Management
  async getStudents(): Promise<Student[]> {
    try {
      const liveStudents = await requestApi<any[]>('/api/v1/students');
      if (Array.isArray(liveStudents)) {
        const formatted: Student[] = liveStudents.map((s) => ({
          id: `STD-${String(s.id).padStart(2, '0')}`,
          admissionNumber: s.admissionNo,
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

        const db = getStoredDB();
        db.students = formatted;
        saveDB(db);
        return formatted;
      }
    } catch (err) {
      console.warn('API getStudents fallback to stored DB:', err);
    }
    await delay();
    return getStoredDB().students;
  },

  async addStudent(studentData: Omit<Student, 'id' | 'transferHistory'>): Promise<Student> {
    try {
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
      db.students.unshift(newStudent);
      logAudit(db, 'ADMIT_STUDENT', 'Student Account', `${newStudent.name} (${newStudent.admissionNumber})`, 'New student admission registered via REST API');
      saveDB(db);

      return newStudent;
    } catch (err: any) {
      console.warn('API addStudent failed, fallback to local storage:', err);
      await delay();
      const db = getStoredDB();
      const newId = `STD-${String(db.students.length + 1).padStart(2, '0')}`;
      const newStudent: Student = {
        ...studentData,
        id: newId,
        transferHistory: []
      };
      db.students.push(newStudent);
      saveDB(db);
      return newStudent;
    }
  },

  async updateStudent(id: string, updates: Partial<Student>): Promise<Student> {
    await delay();
    const db = getStoredDB();
    const index = db.students.findIndex(s => s.id === id);
    if (index === -1) throw new Error('Student record not found');
    db.students[index] = { ...db.students[index], ...updates };
    logAudit(db, 'UPDATE_STUDENT', 'Student Account', `${db.students[index].name} (${db.students[index].admissionNumber})`, 'Student record updated');
    saveDB(db);
    return db.students[index];
  },

  async transferOrPromoteStudent(
    studentId: string,
    destinationClass: number,
    academicSession: string,
    reason: string
  ): Promise<Student> {
    await delay();
    const db = getStoredDB();
    const student = db.students.find(s => s.id === studentId);
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
      transferredBy: db.principalProfile.name
    });

    logAudit(
      db,
      'STUDENT_CLASS_TRANSFER',
      'Student Account',
      `${student.name} (${student.admissionNumber})`,
      reason,
      `Class: ${previousClass}`,
      `Class: ${destinationClass} (Session: ${academicSession})`
    );
    saveDB(db);
    return student;
  },

  async changeStudentStatus(
    id: string,
    action: 'Activate' | 'Temporarily Suspend' | 'Deactivate' | 'Reactivate',
    reason: string,
    isFeeNonPayment = false
  ): Promise<Student> {
    await delay();
    const db = getStoredDB();
    const student = db.students.find(s => s.id === id);
    if (!student) throw new Error('Student not found');

    const prev = student.accountStatus;
    if (action === 'Temporarily Suspend') {
      student.accountStatus = 'Temporarily Suspended';
      student.suspensionDetails = {
        reason,
        effectiveDate: new Date().toISOString(),
        isFeeNonPayment,
        suspendedBy: db.principalProfile.name
      };
    } else if (action === 'Deactivate') {
      student.accountStatus = 'Deactivated';
      student.suspensionDetails = {
        reason,
        effectiveDate: new Date().toISOString(),
        isFeeNonPayment,
        suspendedBy: db.principalProfile.name
      };
    } else {
      student.accountStatus = 'Active';
      delete student.suspensionDetails;
    }

    logAudit(
      db,
      `STUDENT_${action.toUpperCase().replace(/\s+/g, '_')}`,
      'Student Account',
      `${student.name} (${student.admissionNumber})`,
      reason,
      `Previous: ${prev}`,
      `New: ${student.accountStatus}`
    );
    saveDB(db);
    return student;
  },

  // 5. Parents Management
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
        const db = getStoredDB();
        db.parents = mapped;
        saveDB(db);
        return mapped;
      }
    } catch (err) {
      console.warn('API getParents fallback to stored DB:', err);
    }
    await delay();
    return getStoredDB().parents;
  },

  async linkParentToStudent(parentId: string, studentId: string, reason: string): Promise<Parent> {
    try {
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
    } catch (err) {
      console.warn('API linkParentToStudent backend sync fallback:', err);
    }
    await delay();
    const db = getStoredDB();
    const parent = db.parents.find(p => p.id === parentId);
    const student = db.students.find(s => s.id === studentId);
    if (!parent || !student) throw new Error('Parent or student not found');

    if (!parent.linkedStudentIds.includes(studentId)) {
      parent.linkedStudentIds.push(studentId);
    }
    if (!student.parentIds.includes(parentId)) {
      student.parentIds.push(parentId);
      student.parentNames = student.parentNames || [];
      if (!student.parentNames.includes(parent.name)) {
        student.parentNames.push(parent.name);
      }
    }

    logAudit(db, 'LINK_PARENT_CHILD', 'Parent Relationship', `${parent.name} -> ${student.name}`, reason);
    saveDB(db);
    return parent;
  },

  async unlinkParentFromStudent(parentId: string, studentId: string, reason: string): Promise<Parent> {
    await delay();
    const db = getStoredDB();
    const parent = db.parents.find(p => p.id === parentId);
    const student = db.students.find(s => s.id === studentId);
    if (!parent || !student) throw new Error('Parent or student not found');

    parent.linkedStudentIds = parent.linkedStudentIds.filter(id => id !== studentId);
    student.parentIds = student.parentIds.filter(id => id !== parentId);
    student.parentNames = (student.parentNames || []).filter(n => n !== parent.name);

    logAudit(db, 'UNLINK_PARENT_CHILD', 'Parent Relationship', `${parent.name} -x- ${student.name}`, reason);
    saveDB(db);
    return parent;
  },

  async verifyParent(parentId: string, status: 'Verified' | 'Rejected', reason: string): Promise<Parent> {
    try {
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
    } catch (err) {
      console.warn('API verifyParent backend sync failed, updating local state:', err);
    }
    await delay();
    const db = getStoredDB();
    const parent = db.parents.find(p => p.id === parentId);
    if (!parent) throw new Error('Parent not found');

    parent.verificationStatus = status;
    logAudit(db, 'VERIFY_PARENT', 'Parent Relationship', parent.name, reason, 'Status change', status);
    saveDB(db);
    return parent;
  },

  // 6. Academic Setup & Classes
  async getAcademicSessions(): Promise<AcademicSession[]> {
    try {
      const data = await requestApi<any[]>('/api/v1/sessions');
      if (Array.isArray(data) && data.length > 0) {
        const mapped: AcademicSession[] = data.map((s) => ({
          id: String(s.id),
          name: s.name,
          startDate: s.start_date ? String(s.start_date).split('T')[0] : '2026-08-01',
          endDate: s.end_date ? String(s.end_date).split('T')[0] : '2027-05-31',
          status: s.is_current ? 'Active' : 'Draft'
        }));
        const db = getStoredDB();
        db.academicSessions = mapped;
        saveDB(db);
        return mapped;
      }
    } catch (err) {
      console.warn('API getAcademicSessions fallback to stored DB:', err);
    }
    await delay();
    return getStoredDB().academicSessions;
  },

  async getClasses(): Promise<SchoolClass[]> {
    try {
      const [classesData, studentsData] = await Promise.all([
        requestApi<any[]>('/api/v1/classes'),
        requestApi<any[]>('/api/v1/students').catch(() => [])
      ]);
      if (Array.isArray(classesData) && classesData.length > 0) {
        const db = getStoredDB();
        const mapped: SchoolClass[] = classesData.map((c) => {
          const classNum = Number(c.grade_level || c.classNumber || c.id);
          const studentCount = Array.isArray(studentsData) ? studentsData.filter((s: any) => Number(s.classNumber) === classNum).length : 0;
          const existing = db.classes.find((cl) => cl.classNumber === classNum);
          return {
            classNumber: classNum,
            name: c.name || `Class ${classNum}`,
            academicSession: '2026-2027',
            isActive: true,
            totalStudents: studentCount || existing?.totalStudents || 0,
            subjects: existing?.subjects || [
              { id: `SUB-${classNum}-01`, name: 'Mathematics', code: 'MATH', classNumber: classNum, weeklyLessons: 5, assignedTeacherIds: ['TCH-01'] },
              { id: `SUB-${classNum}-02`, name: 'General Science', code: 'SCI', classNumber: classNum, weeklyLessons: 5, assignedTeacherIds: ['TCH-01'] },
              { id: `SUB-${classNum}-03`, name: 'English Language', code: 'ENG', classNumber: classNum, weeklyLessons: 5, assignedTeacherIds: ['TCH-02'] }
            ]
          };
        });
        db.classes = mapped;
        saveDB(db);
        return mapped;
      }
    } catch (err) {
      console.warn('API getClasses fallback to stored DB:', err);
    }
    await delay();
    return getStoredDB().classes;
  },

  async assignTeacherToSubject(
    classNumber: number,
    subjectId: string,
    teacherId: string,
    reason: string
  ): Promise<SchoolClass> {
    await delay();
    const db = getStoredDB();
    const schoolClass = db.classes.find(c => c.classNumber === classNumber);
    if (!schoolClass) throw new Error('Class not found');
    const subject = schoolClass.subjects.find(s => s.id === subjectId);
    if (!subject) throw new Error('Subject not found');
    const teacher = db.teachers.find(t => t.id === teacherId);
    if (!teacher) throw new Error('Teacher not found');

    if (!subject.assignedTeacherIds.includes(teacherId)) {
      subject.assignedTeacherIds.push(teacherId);
    }

    const existingAssignment = teacher.assignments.find(
      a => a.classNumber === classNumber && a.subjectName === subject.name && a.status === 'Active'
    );
    if (!existingAssignment) {
      teacher.assignments.push({
        id: `ASG-${Date.now()}`,
        classNumber,
        subjectName: subject.name,
        startDate: new Date().toISOString().split('T')[0],
        status: 'Active'
      });
    }

    logAudit(
      db,
      'ASSIGN_TEACHER',
      'Teacher Assignment',
      `${teacher.name} -> Class ${classNumber} (${subject.name})`,
      reason
    );
    saveDB(db);
    return schoolClass;
  },

  // 7. Timetable Management & Validation
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
        const mapped: TimetableLesson[] = list.map((slot: any) => ({
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
        return mapped;
      }
    } catch (err) {
      console.warn('API getTimetableLessons failed, fallback to local storage:', err);
    }
    await delay();
    return getStoredDB().timetableLessons;
  },

  async saveTimetableLesson(lessonData: Omit<TimetableLesson, 'id' | 'history'>, lessonId?: string, reason = 'Timetable update'): Promise<TimetableLesson> {
    await delay();
    const db = getStoredDB();

    // SRS 8.3: Start time must be earlier than end time
    if (lessonData.startTime >= lessonData.endTime) {
      throw new Error('Start time must be strictly earlier than end time.');
    }

    // SRS 8.3: Detect teacher double-booking
    const teacherClash = db.timetableLessons.find(
      l =>
        l.id !== lessonId &&
        l.teacherId === lessonData.teacherId &&
        l.dayOfWeek === lessonData.dayOfWeek &&
        ((lessonData.startTime >= l.startTime && lessonData.startTime < l.endTime) ||
          (lessonData.endTime > l.startTime && lessonData.endTime <= l.endTime) ||
          (lessonData.startTime <= l.startTime && lessonData.endTime >= l.endTime))
    );
    if (teacherClash) {
      throw new Error(
        `Teacher Double-Booking Conflict: ${lessonData.teacherName} is already assigned to Class ${teacherClash.classNumber} (${teacherClash.subjectName}) from ${teacherClash.startTime} to ${teacherClash.endTime} on ${lessonData.dayOfWeek}.`
      );
    }

    // SRS 8.3: Detect overlapping lessons for the same class (they share one Zoom meeting!)
    const classClash = db.timetableLessons.find(
      l =>
        l.id !== lessonId &&
        l.classNumber === lessonData.classNumber &&
        l.dayOfWeek === lessonData.dayOfWeek &&
        ((lessonData.startTime >= l.startTime && lessonData.startTime < l.endTime) ||
          (lessonData.endTime > l.startTime && lessonData.endTime <= l.endTime) ||
          (lessonData.startTime <= l.startTime && lessonData.endTime >= l.endTime))
    );
    if (classClash) {
      throw new Error(
        `Class Overlap Conflict: Class ${lessonData.classNumber} already has ${classClash.subjectName} scheduled from ${classClash.startTime} to ${classClash.endTime} on ${lessonData.dayOfWeek}. Class Zoom meetings cannot run simultaneous subjects.`
      );
    }

    if (lessonId) {
      const idx = db.timetableLessons.findIndex(l => l.id === lessonId);
      if (idx === -1) throw new Error('Lesson not found');
      const prev = db.timetableLessons[idx];
      const historyEntry = {
        id: `LH-${Date.now()}`,
        lessonId,
        timestamp: new Date().toISOString(),
        changedBy: db.principalProfile.name,
        changeType: 'Rescheduled' as const,
        reason,
        previousDetails: {
          day: prev.dayOfWeek,
          startTime: prev.startTime,
          endTime: prev.endTime,
          teacherId: prev.teacherId,
          teacherName: prev.teacherName
        },
        newDetails: {
          day: lessonData.dayOfWeek,
          startTime: lessonData.startTime,
          endTime: lessonData.endTime,
          teacherId: lessonData.teacherId,
          teacherName: lessonData.teacherName
        }
      };
      const updated: TimetableLesson = {
        ...lessonData,
        id: lessonId,
        history: [historyEntry, ...prev.history]
      };
      db.timetableLessons[idx] = updated;
      logAudit(db, 'RESCHEDULE_LESSON', 'Timetable Lesson', `Class ${updated.classNumber} (${updated.subjectName})`, reason);
      saveDB(db);
      return updated;
    } else {
      const newLessonId = `LES-${String(db.timetableLessons.length + 1).padStart(2, '0')}`;
      const newLesson: TimetableLesson = {
        ...lessonData,
        id: newLessonId,
        history: [
          {
            id: `LH-${Date.now()}`,
            lessonId: newLessonId,
            timestamp: new Date().toISOString(),
            changedBy: db.principalProfile.name,
            changeType: 'Created',
            reason: reason || 'Initial schedule creation'
          }
        ]
      };
      db.timetableLessons.push(newLesson);
      logAudit(db, 'CREATE_LESSON', 'Timetable Lesson', `Class ${newLesson.classNumber} (${newLesson.subjectName})`, reason || 'New timetable entry created');
      saveDB(db);
      return newLesson;
    }
  },

  async cancelTimetableLesson(lessonId: string, reason: string): Promise<TimetableLesson> {
    await delay();
    const db = getStoredDB();
    const lesson = db.timetableLessons.find(l => l.id === lessonId);
    if (!lesson) throw new Error('Lesson not found');

    lesson.lessonStatus = 'Cancelled';
    lesson.cancellationReason = reason;
    lesson.history.unshift({
      id: `LH-${Date.now()}`,
      lessonId,
      timestamp: new Date().toISOString(),
      changedBy: db.principalProfile.name,
      changeType: 'Cancelled',
      reason
    });

    logAudit(db, 'CANCEL_LESSON', 'Timetable Lesson', `Class ${lesson.classNumber} (${lesson.subjectName})`, reason);
    saveDB(db);
    return lesson;
  },

  async publishTimetable(classNumber?: number): Promise<void> {
    try {
      await requestApi('/api/v1/timetable/publish', {
        method: 'POST',
        body: JSON.stringify({ sessionId: 1, days: 14 })
      });
    } catch (err) {
      console.warn('API publishTimetable backend call failed, fallback to local storage:', err);
    }
    await delay();
    const db = getStoredDB();
    db.timetableLessons.forEach(l => {
      if (!classNumber || l.classNumber === classNumber) {
        l.publicationStatus = 'Published';
      }
    });
    logAudit(
      db,
      'PUBLISH_TIMETABLE',
      'Timetable Lesson',
      classNumber ? `Class ${classNumber}` : 'All Classes (1-8)',
      'Principal published official school timetable schedule'
    );
    saveDB(db);
  },

  // 8. Zoom Class Links Management
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
        const mapped: ClassZoomMeeting[] = list.map((m: any) => ({
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
        return mapped;
      }
    } catch (err) {
      console.warn('API getZoomMeetings failed, fallback to local storage:', err);
    }
    await delay();
    return getStoredDB().zoomMeetings;
  },

  async renewZoomMeeting(
    classNumber: number,
    reason: string
  ): Promise<ClassZoomMeeting> {
    await delay();
    const db = getStoredDB();
    const meeting = db.zoomMeetings.find(m => m.classNumber === classNumber);
    if (!meeting) throw new Error('Class Zoom meeting record not found');

    const previousMeetingId = meeting.zoomMeetingId;
    // Backend simulated Zoom Pro API rotation
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const newMeetingId = `821 990${classNumber} ${randomSuffix}`;
    const newPasscode = `IqraCls${classNumber}#${Math.floor(10 + Math.random() * 89)}`;

    meeting.renewalHistory.unshift({
      id: `RNW-${Date.now()}`,
      previousMeetingId,
      newMeetingId,
      renewedAt: new Date().toISOString(),
      renewedBy: db.principalProfile.name,
      reason
    });

    meeting.zoomMeetingId = newMeetingId;
    meeting.passcode = newPasscode;
    meeting.joinUrl = `https://zoom.us/j/${newMeetingId.replace(/\s+/g, '')}?pwd=IqraSafeTokenClass${classNumber}`;
    meeting.status = 'Active';
    meeting.healthCheckStatus = 'Operational';
    meeting.lastRenewalDate = new Date().toISOString();
    meeting.expiryDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    logAudit(
      db,
      'RENEW_ZOOM_MEETING',
      'Zoom Link',
      `Class ${classNumber} Zoom Link`,
      reason,
      `Previous ID: ${previousMeetingId}`,
      `New ID: ${newMeetingId}`
    );
    saveDB(db);
    return meeting;
  },

  async runZoomHealthCheck(classNumber: number): Promise<ClassZoomMeeting> {
    await delay(300);
    const db = getStoredDB();
    const meeting = db.zoomMeetings.find(m => m.classNumber === classNumber);
    if (!meeting) throw new Error('Meeting not found');

    // Perform health check simulation
    meeting.lastHealthCheckDate = new Date().toISOString();
    if (meeting.status === 'Requires Renewal') {
      meeting.healthCheckStatus = 'Degraded';
    } else {
      meeting.healthCheckStatus = 'Operational';
    }
    saveDB(db);
    return meeting;
  },

  // 9. Attendance Oversight
  async getAttendanceSummaries(): Promise<LessonAttendanceSummary[]> {
    await delay();
    return getStoredDB().attendanceSummaries;
  },

  async getAttendanceCorrections(): Promise<AttendanceCorrectionRequest[]> {
    try {
      const res = await requestApi<any>('/api/v1/attendance/corrections');
      const list = Array.isArray(res) ? res : res?.data;
      if (Array.isArray(list) && list.length > 0) {
        const mapped: AttendanceCorrectionRequest[] = list.map((c: any) => ({
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
        return mapped;
      }
    } catch (err) {
      console.warn('API getAttendanceCorrections failed, fallback to local storage:', err);
    }
    await delay();
    return getStoredDB().attendanceCorrections;
  },

  async reviewAttendanceCorrection(
    correctionId: string,
    decision: 'Approved' | 'Rejected',
    reviewRemarks: string
  ): Promise<AttendanceCorrectionRequest> {
    try {
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
    } catch (err) {
      console.warn('API reviewAttendanceCorrection backend sync failed, fallback to local DB:', err);
    }
    await delay();
    const db = getStoredDB();
    const correction = db.attendanceCorrections.find(c => c.id === correctionId);
    if (!correction) throw new Error('Correction request not found');

    correction.status = decision;
    correction.reviewedBy = db.principalProfile.name;
    correction.reviewedAt = new Date().toISOString();
    correction.reviewRemarks = reviewRemarks;

    // If approved, update student record in the lesson summary
    if (decision === 'Approved') {
      const summary = db.attendanceSummaries.find(s => s.lessonId === correction.lessonId);
      if (summary) {
        const studentRec = summary.records.find(r => r.studentId === correction.studentId);
        if (studentRec) {
          studentRec.correctionHistory = studentRec.correctionHistory || [];
          studentRec.correctionHistory.push({
            previousStatus: correction.originalStatus,
            newStatus: correction.proposedStatus,
            correctedBy: db.principalProfile.name,
            reason: `${correction.teacherReason} (Approved by Principal: ${reviewRemarks})`,
            timestamp: new Date().toISOString()
          });
          studentRec.status = correction.proposedStatus;
        }
      }
    }

    logAudit(
      db,
      `ATTENDANCE_CORRECTION_${decision.toUpperCase()}`,
      'Attendance Correction',
      `${correction.studentName} (Class ${correction.classNumber} - ${correction.subjectName})`,
      reviewRemarks,
      `Original: ${correction.originalStatus}`,
      `Result: ${decision === 'Approved' ? correction.proposedStatus : 'Unchanged (Rejected)'}`
    );
    saveDB(db);
    return correction;
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
    await delay();
    const db = getStoredDB();
    const newSummary: LessonAttendanceSummary = {
      id: `ATT-${Date.now()}`,
      lessonId: `LES-MANUAL-${Date.now()}`,
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
    db.attendanceSummaries.unshift(newSummary);
    const presentCount = data.records.filter(r => r.status === 'Present').length;
    logAudit(
      db,
      'SUBMIT_ATTENDANCE',
      'Attendance Correction',
      `Class ${data.classNumber} - ${data.subjectName}`,
      `Principal submitted attendance session for ${data.date}. ${presentCount}/${data.records.length} present.`
    );
    saveDB(db);
    return newSummary;
  },

  // 10. Fee Structures & Concessions
  async getFeeStructures(): Promise<ClassFeeStructure[]> {
    try {
      const data = await requestApi<any[]>('/api/v1/fees/structures');
      if (Array.isArray(data) && data.length > 0) {
        const mapped: ClassFeeStructure[] = data.map((d) => ({
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
        const db = getStoredDB();
        db.feeStructures = mapped;
        saveDB(db);
        return mapped;
      }
    } catch {
      // Fallback
    }
    await delay();
    return getStoredDB().feeStructures;
  },

  async getConcessions(): Promise<StudentConcession[]> {
    try {
      const data = await requestApi<any[]>('/api/v1/fees/concessions');
      if (Array.isArray(data)) {
        const mapped: StudentConcession[] = data.map((c) => ({
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
        const db = getStoredDB();
        db.concessions = mapped;
        saveDB(db);
        return mapped;
      }
    } catch {
      // Fallback
    }
    await delay();
    return getStoredDB().concessions;
  },

  async updateFeeStructure(
    classNumber: number,
    heads: ClassFeeStructure['heads'],
    reason: string
  ): Promise<ClassFeeStructure> {
    try {
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
    } catch {
      // Fallback
    }
    await delay();
    const db = getStoredDB();
    const feeStruct = db.feeStructures.find((f) => f.classNumber === classNumber);
    if (!feeStruct) throw new Error('Fee structure for class not found');

    const prevRecurring = feeStruct.totalMonthlyRecurring;
    const newRecurring = heads
      .filter((h) => h.isRecurring)
      .reduce((sum, h) => sum + Number(h.amount), 0);

    feeStruct.heads = heads;
    feeStruct.totalMonthlyRecurring = newRecurring;

    logAudit(
      db,
      'UPDATE_FEE_STRUCTURE',
      'Fee Structure',
      `Class ${classNumber} Fee Schedule`,
      reason,
      `Monthly recurring was: Rs. ${prevRecurring}`,
      `New monthly recurring: Rs. ${newRecurring}`
    );
    saveDB(db);
    return feeStruct;
  },

  async addConcession(concessionData: Omit<StudentConcession, 'id' | 'approvedBy'>): Promise<StudentConcession> {
    let createdBackendId: number | undefined;
    try {
      const res = await requestApi<any>('/api/v1/fees/concessions', {
        method: 'POST',
        body: JSON.stringify({
          studentId: Number(concessionData.studentId),
          concessionType: concessionData.concessionType.toUpperCase().replace(/\s+/g, '_'),
          value: Number(concessionData.value),
          reason: concessionData.reason
        })
      });
      if (res?.id) createdBackendId = res.id;
    } catch {
      // Fallback
    }
    await delay();
    const db = getStoredDB();
    const newConcession: StudentConcession = {
      ...concessionData,
      id: createdBackendId ? String(createdBackendId) : `CNC-${Date.now()}`,
      approvedBy: db.principalProfile.name
    };
    db.concessions.push(newConcession);
    logAudit(
      db,
      'APPROVE_STUDENT_CONCESSION',
      'Fee Structure',
      `${newConcession.studentName} (Class ${newConcession.classNumber})`,
      newConcession.reason,
      undefined,
      `${newConcession.concessionType}: Rs. ${newConcession.value}`
    );
    saveDB(db);
    return newConcession;
  },

  // 11. Challans & Billing
  async getChallans(): Promise<MonthlyChallan[]> {
    try {
      const data = await requestApi<any[]>('/api/v1/fees/challans');
      if (Array.isArray(data) && data.length > 0) {
        const mapped: MonthlyChallan[] = data.map((ch) => ({
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
        const db = getStoredDB();
        db.challans = mapped;
        saveDB(db);
        return mapped;
      }
    } catch {
      // Fallback
    }
    await delay();
    return getStoredDB().challans;
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
      if (res?.count !== undefined) {
        await this.getChallans();
        return {
          generatedCount: res.count,
          skippedCount: 0,
          message: res.message || `Generated ${res.count} challans for ${billingMonth}`
        };
      }
    } catch {
      // Fallback
    }
    await delay(350);
    const db = getStoredDB();
    let generatedCount = 0;
    let skippedCount = 0;

    const activeStudents = db.students.filter(s => s.accountStatus === 'Active' || s.accountStatus === 'Temporarily Suspended');

    activeStudents.forEach(student => {
      // Prevent duplicate challan for same student and billing period (SRS 12.3)
      const existing = db.challans.find(
        ch => ch.studentId === student.id && ch.billingMonth === billingMonth
      );
      if (existing) {
        skippedCount++;
        return;
      }

      const feeStruct = db.feeStructures.find(f => f.classNumber === student.classNumber);
      const tuitionFee = feeStruct?.heads.find(h => h.head === 'Tuition')?.amount || 7000;
      const techFee = feeStruct?.heads.find(h => h.head === 'Technology')?.amount || 1000;
      const examFee = feeStruct?.heads.find(h => h.head === 'Examination')?.amount || 800;

      // Student concession
      const activeConcession = db.concessions.find(
        c => c.studentId === student.id && c.status === 'Active'
      );
      const concessionAmount = activeConcession ? activeConcession.value : 0;

      // Calculate previous arrears
      const pastUnpaid = db.challans
        .filter(ch => ch.studentId === student.id && ch.status !== 'Paid')
        .reduce((sum, ch) => sum + ch.outstandingBalance, 0);

      const gross = tuitionFee + techFee + examFee;
      const totalPayable = Math.max(0, gross - concessionAmount + pastUnpaid);

      const challanNumber = `CH-${billingMonth.replace(/\s+/g, '-').toUpperCase()}-${student.rollNumber}`;

      db.challans.push({
        id: `CH-${Date.now()}-${student.id}`,
        challanNumber,
        studentId: student.id,
        studentName: student.name,
        rollNumber: student.rollNumber,
        admissionNumber: student.admissionNumber,
        classNumber: student.classNumber,
        billingMonth,
        academicSession: db.activeSession,
        generationDate: new Date().toISOString().split('T')[0],
        dueDate,
        gracePeriodDays,
        breakdown: {
          tuitionFee,
          technologyFee: techFee,
          examinationFee: examFee,
          booksFee: 0,
          admissionFee: 0,
          otherFee: 0,
          grossAmount: gross,
          concessionAmount,
          arrearsAmount: pastUnpaid,
          lateFeeAmount,
          totalPayable
        },
        paidAmount: 0,
        outstandingBalance: totalPayable,
        status: 'Unpaid',
        remindersSentCount: 0
      });
      generatedCount++;
    });

    logAudit(
      db,
      'GENERATE_MONTHLY_CHALLANS',
      'Monthly Challan',
      `Billing Month: ${billingMonth}`,
      `Batch generated ${generatedCount} challans. ${skippedCount} duplicate student challans skipped. Due date: ${dueDate}`
    );
    saveDB(db);
    return {
      generatedCount,
      skippedCount,
      message: `Generated ${generatedCount} challans for ${billingMonth}. ${skippedCount} students already had challans.`
    };
  },

  async sendFeeReminder(challanId: string): Promise<MonthlyChallan> {
    await delay();
    const db = getStoredDB();
    const challan = db.challans.find(c => c.id === challanId);
    if (!challan) throw new Error('Challan not found');

    challan.remindersSentCount = (challan.remindersSentCount || 0) + 1;
    challan.lastReminderDate = new Date().toISOString().split('T')[0];

    logAudit(
      db,
      'SEND_FEE_REMINDER',
      'Monthly Challan',
      `${challan.challanNumber} (${challan.studentName})`,
      `Fee payment reminder notification dispatched to registered guardian.`
    );
    saveDB(db);
    return challan;
  },

  async createIndividualChallan(data: {
    studentId: string;
    billingMonth: string;
    dueDate: string;
    tuitionFee?: number;
    techFee?: number;
    examFee?: number;
    lateFeeAmount?: number;
    gracePeriodDays?: number;
  }): Promise<MonthlyChallan> {
    await delay();
    const db = getStoredDB();
    const student = db.students.find(s => s.id === data.studentId);
    if (!student) throw new Error('Student record not found');

    const feeStruct = db.feeStructures.find(f => f.classNumber === student.classNumber);
    const tuitionFee = data.tuitionFee ?? (feeStruct?.heads.find(h => h.head === 'Tuition')?.amount || 7000);
    const techFee = data.techFee ?? (feeStruct?.heads.find(h => h.head === 'Technology')?.amount || 1000);
    const examFee = data.examFee ?? (feeStruct?.heads.find(h => h.head === 'Examination')?.amount || 800);

    const activeConcession = db.concessions.find(
      c => c.studentId === student.id && c.status === 'Active'
    );
    const concessionAmount = activeConcession ? activeConcession.value : 0;

    const pastUnpaid = db.challans
      .filter(ch => ch.studentId === student.id && ch.status !== 'Paid')
      .reduce((sum, ch) => sum + ch.outstandingBalance, 0);

    const gross = tuitionFee + techFee + examFee;
    const totalPayable = Math.max(0, gross - concessionAmount + pastUnpaid);
    const challanNumber = `CH-${data.billingMonth.replace(/\s+/g, '-').toUpperCase()}-${student.rollNumber}-${Math.floor(10 + Math.random() * 89)}`;

    const newChallan: MonthlyChallan = {
      id: `CH-${Date.now()}-${student.id}`,
      challanNumber,
      studentId: student.id,
      studentName: student.name,
      rollNumber: student.rollNumber,
      admissionNumber: student.admissionNumber,
      classNumber: student.classNumber,
      billingMonth: data.billingMonth,
      academicSession: db.activeSession,
      generationDate: new Date().toISOString().split('T')[0],
      dueDate: data.dueDate,
      gracePeriodDays: data.gracePeriodDays ?? 5,
      breakdown: {
        tuitionFee,
        technologyFee: techFee,
        examinationFee: examFee,
        booksFee: 0,
        admissionFee: 0,
        otherFee: 0,
        grossAmount: gross,
        concessionAmount,
        arrearsAmount: pastUnpaid,
        lateFeeAmount: data.lateFeeAmount ?? 500,
        totalPayable
      },
      paidAmount: 0,
      outstandingBalance: totalPayable,
      status: 'Unpaid',
      remindersSentCount: 0
    };

    db.challans.unshift(newChallan);
    logAudit(
      db,
      'CREATE_INDIVIDUAL_CHALLAN',
      'Monthly Challan',
      `${newChallan.challanNumber} (${student.name} - Class ${student.classNumber})`,
      `Individual challan generated by Principal for ${data.billingMonth}. Total payable: Rs. ${totalPayable.toLocaleString()}`
    );
    saveDB(db);
    return newChallan;
  },

  // 12. Payment Proof Verification
  async getPaymentProofs(): Promise<PaymentProofSubmission[]> {
    try {
      const data = await requestApi<any[]>('/api/v1/fees/payment-proofs');
      if (Array.isArray(data) && data.length > 0) {
        const mapped: PaymentProofSubmission[] = data.map((p) => ({
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
        const db = getStoredDB();
        db.paymentProofs = mapped;
        saveDB(db);
        return mapped;
      }
    } catch {
      // Fallback
    }
    await delay();
    return getStoredDB().paymentProofs;
  },

  async verifyPaymentProof(
    submissionId: string,
    decision: 'Approved' | 'Rejected' | 'Resubmission Requested',
    verifiedAmount: number,
    decisionNote: string
  ): Promise<PaymentProofSubmission> {
    try {
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
    } catch {
      // Fallback
    }
    await delay(300);
    const db = getStoredDB();
    const submission = db.paymentProofs.find(p => p.id === submissionId);
    if (!submission) throw new Error('Payment submission not found');

    submission.status = decision;
    submission.reviewedBy = db.principalProfile.name;
    submission.reviewTimestamp = new Date().toISOString();
    submission.reviewDecisionNote = decisionNote;

    if (decision === 'Approved') {
      submission.verifiedAmount = verifiedAmount;
      submission.receiptNumber = `RCP-${Date.now()}`;

      // Update associated Challan balance & status (SRS 13.5 & 14)
      const challan = db.challans.find(c => c.id === submission.challanId || c.challanNumber === submission.challanNumber);
      if (challan) {
        challan.paidAmount = (challan.paidAmount || 0) + verifiedAmount;
        challan.outstandingBalance = Math.max(0, challan.breakdown.totalPayable - challan.paidAmount);
        challan.status = challan.outstandingBalance <= 0 ? 'Paid' : 'Partially Paid';

        // Check if student was suspended solely for non-payment; notify or recommend reactivation
        const student = db.students.find(s => s.id === challan.studentId);
        if (student && student.suspensionDetails?.isFeeNonPayment && challan.outstandingBalance <= 0) {
          // If dues cleared, automatically lift suspension or flag for Principal review
          student.accountStatus = 'Active';
          delete student.suspensionDetails;
          logAudit(
            db,
            'STUDENT_REACTIVATE_AFTER_FEE_PAYMENT',
            'Student Account',
            `${student.name} (${student.admissionNumber})`,
            'Online portal classroom access automatically restored after verified full fee clearance.'
          );
        }
      }
    }

    logAudit(
      db,
      `PAYMENT_VERIFICATION_${decision.toUpperCase().replace(/\s+/g, '_')}`,
      'Payment Verification',
      `${submission.challanNumber} (${submission.studentName})`,
      decisionNote,
      `Status: Pending`,
      `Decision: ${decision}${decision === 'Approved' ? ` (Verified: Rs. ${verifiedAmount})` : ''}`
    );
    saveDB(db);
    return submission;
  },

  // 13. Teacher Payroll & Duty
  async getSalaryDrafts(): Promise<TeacherSalaryDraft[]> {
    try {
      const data = await requestApi<TeacherSalaryDraft[]>('/api/v1/payroll/drafts');
      if (Array.isArray(data) && data.length > 0) {
        const db = getStoredDB();
        db.salaryDrafts = data;
        saveDB(db);
        return data;
      }
    } catch {
      // Fallback
    }
    await delay();
    return getStoredDB().salaryDrafts;
  },

  async generateSalaryDrafts(payrollMonth: string): Promise<{ generatedCount: number; skippedCount: number; message: string }> {
    try {
      const res = await requestApi<any>('/api/v1/payroll/drafts/generate', {
        method: 'POST',
        body: JSON.stringify({ payrollMonth })
      });
      if (res?.generatedCount !== undefined) {
        await this.getSalaryDrafts();
        return res;
      }
    } catch {
      // Fallback
    }
    await delay();
    return {
      generatedCount: 0,
      skippedCount: 0,
      message: `Drafts generation completed for ${payrollMonth}`
    };
  },

  async reviewSalaryDraft(
    draftId: string,
    decision: 'Approved' | 'Returned for Correction' | 'Rejected',
    reviewRemarks: string
  ): Promise<TeacherSalaryDraft> {
    try {
      const updated = await requestApi<TeacherSalaryDraft>(`/api/v1/payroll/drafts/${draftId}/review`, {
        method: 'POST',
        body: JSON.stringify({ decision, reviewRemarks })
      });
      if (updated) {
        const db = getStoredDB();
        const idx = db.salaryDrafts.findIndex((d) => d.id === draftId);
        if (idx !== -1) db.salaryDrafts[idx] = updated;
        saveDB(db);
        return updated;
      }
    } catch {
      // Fallback
    }
    await delay();
    const db = getStoredDB();
    const draft = db.salaryDrafts.find((d) => d.id === draftId);
    if (!draft) throw new Error('Salary draft not found');

    draft.status = decision;
    draft.reviewedBy = db.principalProfile.name;
    draft.reviewedAt = new Date().toISOString();
    draft.reviewRemarks = reviewRemarks;

    if (decision === 'Approved') {
      draft.salarySlipNumber = `SLIP-${Date.now()}`;
    }

    logAudit(
      db,
      `PAYROLL_${decision.toUpperCase().replace(/\s+/g, '_')}`,
      'Teacher Payroll',
      `${draft.teacherName} (${draft.payrollMonth})`,
      reviewRemarks,
      'Draft Status: Submitted for Approval',
      `Result: ${decision} (Net Payable: Rs. ${draft.netPayable})`
    );
    saveDB(db);
    return draft;
  },

  async addSalaryAdjustment(
    draftId: string,
    adjustment: { type: 'Addition' | 'Deduction'; title: string; amount: number; reason: string }
  ): Promise<TeacherSalaryDraft> {
    try {
      const updated = await requestApi<TeacherSalaryDraft>(`/api/v1/payroll/drafts/${draftId}/adjustments`, {
        method: 'POST',
        body: JSON.stringify(adjustment)
      });
      if (updated) {
        const db = getStoredDB();
        const idx = db.salaryDrafts.findIndex((d) => d.id === draftId);
        if (idx !== -1) db.salaryDrafts[idx] = updated;
        saveDB(db);
        return updated;
      }
    } catch {
      // Fallback
    }
    await delay();
    const db = getStoredDB();
    const draft = db.salaryDrafts.find((d) => d.id === draftId);
    if (!draft) throw new Error('Draft not found');

    const newAdj = {
      ...adjustment,
      id: `ADJ-${Date.now()}`,
      authorizedBy: db.principalProfile.name
    };
    draft.adjustments.push(newAdj);

    // Recalculate Net
    let additions = draft.allowances;
    let deductions = draft.standardDeductions;
    draft.adjustments.forEach((a) => {
      if (a.type === 'Addition') additions += a.amount;
      if (a.type === 'Deduction') deductions += a.amount;
    });

    const earnings = draft.basePay + draft.lessonOrHourlyEarning;
    draft.grossAmount = earnings + additions;
    draft.netPayable = Math.max(0, draft.grossAmount - deductions);

    logAudit(
      db,
      'SALARY_ADJUSTMENT_ADDED',
      'Teacher Payroll',
      `${draft.teacherName} (${draft.payrollMonth})`,
      adjustment.reason,
      undefined,
      `${adjustment.type}: ${adjustment.title} (Rs. ${adjustment.amount})`
    );
    saveDB(db);
    return draft;
  },

  // 14. Academic Oversight
  async getAcademicPerformances(): Promise<AcademicClassPerformance[]> {
    try {
      const data = await requestApi<AcademicClassPerformance[]>('/api/v1/reports/academic-performance');
      if (Array.isArray(data) && data.length > 0) {
        const db = getStoredDB();
        db.academicPerformances = data;
        saveDB(db);
        return data;
      }
    } catch {
      // Fallback
    }
    await delay();
    return getStoredDB().academicPerformances;
  },

  async approveResultPublication(classNumber: number): Promise<void> {
    try {
      await requestApi(`/api/v1/reports/academic-performance/${classNumber}/publish`, {
        method: 'POST'
      });
    } catch {
      // Fallback
    }
    await delay();
    const db = getStoredDB();
    const perf = db.academicPerformances.find(p => p.classNumber === classNumber);
    if (perf) {
      perf.publishedResultsStatus = 'Published';
      logAudit(
        db,
        'APPROVE_ACADEMIC_RESULTS',
        'Notice',
        `Class ${classNumber} Final Evaluations`,
        'Principal authorized public publishing of mid-year student report cards to Parent portal.'
      );
      saveDB(db);
    }
  },

  // 15. Notices
  async getNotices(): Promise<SchoolNotice[]> {
    try {
      const data = await requestApi<SchoolNotice[]>('/api/v1/notices');
      if (Array.isArray(data) && data.length > 0) {
        const db = getStoredDB();
        db.notices = data;
        saveDB(db);
        return data;
      }
    } catch {
      // Fallback
    }
    await delay();
    return getStoredDB().notices;
  },

  async createNotice(noticeData: Omit<SchoolNotice, 'id' | 'createdBy' | 'publishDate'>): Promise<SchoolNotice> {
    try {
      const created = await requestApi<SchoolNotice>('/api/v1/notices', {
        method: 'POST',
        body: JSON.stringify(noticeData)
      });
      if (created) {
        const db = getStoredDB();
        db.notices.unshift(created);
        logAudit(db, 'PUBLISH_NOTICE', 'Notice', created.title, `Audience: ${created.audience}, Priority: ${created.priority}`);
        saveDB(db);
        return created;
      }
    } catch {
      // Fallback
    }
    await delay();
    const db = getStoredDB();
    const newNotice: SchoolNotice = {
      ...noticeData,
      id: `NOT-${Date.now()}`,
      publishDate: new Date().toISOString().split('T')[0],
      createdBy: db.principalProfile.name,
      acknowledgedCount: 0
    };
    db.notices.unshift(newNotice);
    logAudit(db, 'PUBLISH_NOTICE', 'Notice', newNotice.title, `Audience: ${newNotice.audience}, Priority: ${newNotice.priority}`);
    saveDB(db);
    return newNotice;
  },

  // 16. Notifications
  async getNotifications(): Promise<OperationalNotification[]> {
    try {
      const data = await requestApi<OperationalNotification[]>('/api/v1/notices/notifications');
      if (Array.isArray(data) && data.length > 0) {
        const db = getStoredDB();
        db.notifications = data;
        saveDB(db);
        return data;
      }
    } catch {
      // Fallback
    }
    await delay();
    return getStoredDB().notifications;
  },

  async markNotificationAsRead(id: string): Promise<void> {
    try {
      await requestApi(`/api/v1/notices/notifications/${id}/read`, {
        method: 'POST'
      });
    } catch {
      // Fallback
    }
    await delay(50);
    const db = getStoredDB();
    const notif = db.notifications.find(n => n.id === id);
    if (notif) notif.isRead = true;
    saveDB(db);
  },

  async markAllNotificationsRead(): Promise<void> {
    try {
      await requestApi('/api/v1/notices/notifications/read-all', {
        method: 'POST'
      });
    } catch {
      // Fallback
    }
    await delay(50);
    const db = getStoredDB();
    db.notifications.forEach(n => { n.isRead = true; });
    saveDB(db);
  },

  // 17. Audit Logs
  async getAuditLogs(): Promise<AuditLogEntry[]> {
    try {
      const data = await requestApi<AuditLogEntry[]>('/api/v1/audit');
      if (Array.isArray(data) && data.length > 0) {
        const db = getStoredDB();
        db.auditLogs = data;
        saveDB(db);
        return data;
      }
    } catch {
      // Fallback
    }
    await delay();
    return getStoredDB().auditLogs;
  }
};
