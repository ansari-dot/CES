import { db } from '../../shared/db/knex.js';
import { parseDbDate } from '../../shared/utils/date.js';
import { letterGrade } from '../people/students.repository.js';
import { getCurrentSessionId } from '../../shared/services/accessScope.js';

const DEFAULT_TERM = 'Mid-Year 2026';
const TASK_TYPES = ['ASSIGNMENT', 'QUIZ', 'TEST', 'EXAM'];
const SUPPORT_SCORE_THRESHOLD = 50;
const SUPPORT_ATTENDANCE_THRESHOLD = 75;
const SUPPORT_MISSING_THRESHOLD = 3;

function average(values) {
  const list = values.filter((v) => v != null && Number.isFinite(v));
  if (list.length === 0) return null;
  return Math.round(list.reduce((a, b) => a + b, 0) / list.length);
}

function pctOf(sub) {
  const max = Number(sub.total_marks ?? sub.task?.total_marks);
  if (!max) return null;
  return (Number(sub.marks_awarded) / max) * 100;
}

function toDateString(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  return String(value).split('T')[0];
}

/** Loads the records shared by the academic oversight aggregations in a few queries. */
async function loadAcademicContext({ sessionId = null, subjectId = null, taskType = null }) {
  const finalSessionId = sessionId || (await getCurrentSessionId());
  const today = new Date().toISOString().split('T')[0];

  const [classes, students, classSubjectRows, teacherRows] = await Promise.all([
    db('classes').where('is_active', 1).orderBy('grade_level', 'asc'),
    db('students')
      .join('users', 'students.user_id', 'users.id')
      .where('students.status', 'ACTIVE')
      .select('students.id', 'students.current_class_id', 'students.roll_no', 'students.admission_no', 'users.full_name as name')
      .orderBy('students.roll_no', 'asc'),
    db('class_subjects')
      .join('subjects', 'class_subjects.subject_id', 'subjects.id')
      .where('class_subjects.is_active', 1)
      .select('class_subjects.class_id', 'subjects.id as subjectId', 'subjects.name as subjectName')
      .orderBy('subjects.name', 'asc'),
    db('teacher_assignments')
      .join('teachers', 'teacher_assignments.teacher_id', 'teachers.id')
      .join('users', 'teachers.user_id', 'users.id')
      .where((q) => q.whereNull('teacher_assignments.effective_to').orWhere('teacher_assignments.effective_to', '>=', today))
      .select('teacher_assignments.class_id', 'teacher_assignments.subject_id', 'users.full_name')
      .orderBy('teacher_assignments.id', 'asc')
  ]);

  let taskQuery = db('learning_tasks')
    .join('subjects', 'learning_tasks.subject_id', 'subjects.id')
    .whereIn('learning_tasks.status', ['ACTIVE', 'ARCHIVED'])
    .select('learning_tasks.*', 'subjects.name as subject_name');
  if (finalSessionId) taskQuery = taskQuery.where('learning_tasks.session_id', finalSessionId);
  if (subjectId) taskQuery = taskQuery.where('learning_tasks.subject_id', subjectId);
  if (taskType) taskQuery = taskQuery.where('learning_tasks.task_type', taskType);
  const tasks = await taskQuery;

  const studentIds = students.map((s) => s.id);
  const [subs, attendance] = await Promise.all([
    tasks.length > 0 ? db('task_submissions').whereIn('task_id', tasks.map((t) => t.id)) : [],
    studentIds.length > 0
      ? db('lesson_attendance').whereIn('student_id', studentIds).groupBy('student_id', 'status').select('student_id', 'status', db.raw('count(*) as count'))
      : []
  ]);

  const studentsByClass = new Map();
  for (const s of students) {
    const cid = Number(s.current_class_id);
    if (!studentsByClass.has(cid)) studentsByClass.set(cid, []);
    studentsByClass.get(cid).push(s);
  }

  const subsByTask = new Map();
  const taskById = new Map(tasks.map((t) => [t.id, t]));
  for (const s of subs) {
    if (!subsByTask.has(s.task_id)) subsByTask.set(s.task_id, []);
    subsByTask.get(s.task_id).push({ ...s, total_marks: taskById.get(s.task_id)?.total_marks });
  }

  const attendanceByStudent = new Map();
  for (const a of attendance) {
    const sid = Number(a.student_id);
    if (!attendanceByStudent.has(sid)) attendanceByStudent.set(sid, { present: 0, late: 0, total: 0 });
    const entry = attendanceByStudent.get(sid);
    const c = Number(a.count);
    entry.total += c;
    if (a.status === 'PRESENT') entry.present += c;
    if (a.status === 'LATE') entry.late += c;
  }

  const classSubjects = new Map();
  for (const row of classSubjectRows) {
    const cid = Number(row.class_id);
    if (!classSubjects.has(cid)) classSubjects.set(cid, []);
    classSubjects.get(cid).push(row);
  }

  const teacherNames = new Map();
  for (const row of teacherRows) teacherNames.set(`${row.class_id}-${row.subject_id}`, row.full_name);

  return { sessionId: finalSessionId, classes, studentsByClass, tasks, subsByTask, attendanceByStudent, classSubjects, teacherNames };
}

export const reportsRepository = {
  // 1. Student Enrolment Report
  async getStudentEnrolmentReport({ classId = null, status = null, search = null } = {}) {
    let query = db('students')
      .join('users', 'students.user_id', 'users.id')
      .join('classes', 'students.current_class_id', 'classes.id')
      .select(
        'students.id',
        'students.roll_no as rollNumber',
        'students.admission_no as admissionNumber',
        'users.full_name as studentName',
        'classes.grade_level as classNumber',
        'classes.name as className',
        'students.gender',
        'students.admission_date as admissionDate',
        'students.status as enrolmentStatus',
        'users.status as accountStatus'
      )
      .orderBy('classes.grade_level', 'asc')
      .orderBy('students.roll_no', 'asc');

    if (classId) query = query.where('students.current_class_id', classId);
    if (status) query = query.where('students.status', status);
    if (search) {
      query = query.where((q) => {
        q.where('users.full_name', 'like', `%${search}%`)
          .orWhere('students.admission_no', 'like', `%${search}%`)
          .orWhere('students.roll_no', 'like', `%${search}%`);
      });
    }

    const rows = await query;
    return rows.map((r) => ({
      ...r,
      col1: r.rollNumber,
      col2: r.admissionNumber,
      col3: r.studentName,
      col4: `Class ${r.classNumber}`,
      col5: r.gender || 'N/A',
      col6: r.enrolmentStatus,
      col7: r.accountStatus
    }));
  },

  // 2. Fee Collection Report
  async getFeeCollectionReport({ classId = null, billingMonth = null, status = null } = {}) {
    let query = db('fee_challans')
      .join('students', 'fee_challans.student_id', 'students.id')
      .join('users', 'students.user_id', 'users.id')
      .join('classes', 'fee_challans.class_id', 'classes.id')
      .select(
        'fee_challans.id',
        'fee_challans.challan_number as challanNumber',
        'fee_challans.consumer_number as consumerNumber',
        'users.full_name as studentName',
        'classes.grade_level as classNumber',
        'fee_challans.billing_month as billingMonth',
        'fee_challans.total_payable as totalPayable',
        'fee_challans.paid_amount as paidAmount',
        'fee_challans.status'
      )
      .orderBy('fee_challans.created_at', 'desc');

    if (classId) query = query.where('fee_challans.class_id', classId);
    if (billingMonth) query = query.where('fee_challans.billing_month', billingMonth);
    if (status) query = query.where('fee_challans.status', status);

    const rows = await query;

    let totalBilled = 0;
    let totalCollected = 0;

    const mapped = rows.map((r) => {
      const payable = Number(r.totalPayable);
      const paid = Number(r.paidAmount);
      const balance = Math.max(0, payable - paid);
      totalBilled += payable;
      totalCollected += paid;

      return {
        id: String(r.id),
        challanNumber: r.challanNumber,
        consumerNumber: r.consumerNumber,
        studentName: r.studentName,
        classNumber: r.classNumber,
        billingMonth: r.billingMonth,
        totalPayable: payable,
        paidAmount: paid,
        outstandingBalance: balance,
        status: r.status,
        col1: r.challanNumber,
        col2: r.studentName,
        col3: `Class ${r.classNumber}`,
        col4: `Rs. ${payable.toLocaleString()}`,
        col5: `Rs. ${paid.toLocaleString()}`,
        col6: `Rs. ${balance.toLocaleString()}`,
        col7: r.status
      };
    });

    const totalOutstanding = Math.max(0, totalBilled - totalCollected);
    const collectionRate = totalBilled > 0 ? Number(((totalCollected / totalBilled) * 100).toFixed(1)) : 0;

    return {
      summary: {
        totalChallans: rows.length,
        totalBilled,
        totalCollected,
        totalOutstanding,
        collectionRate
      },
      rows: mapped
    };
  },

  // 3. Teacher Duty & Payroll Report
  async getTeacherDutyPayrollReport({ payrollMonth = null, teacherId = null } = {}) {
    let query = db('teacher_payroll_drafts')
      .join('teachers', 'teacher_payroll_drafts.teacher_id', 'teachers.id')
      .join('users', 'teachers.user_id', 'users.id')
      .select(
        'teacher_payroll_drafts.id',
        'teachers.employee_no as staffIdentifier',
        'users.full_name as teacherName',
        'teacher_payroll_drafts.salary_model as salaryModel',
        'teacher_payroll_drafts.scheduled_lessons as scheduledLessons',
        'teacher_payroll_drafts.completed_lessons as completedLessons',
        'teacher_payroll_drafts.verified_hours as verifiedHours',
        'teacher_payroll_drafts.gross_amount as grossAmount',
        'teacher_payroll_drafts.net_payable as netPayable',
        'teacher_payroll_drafts.status',
        'teacher_payroll_drafts.payroll_month as payrollMonth'
      )
      .orderBy('teacher_payroll_drafts.created_at', 'desc');

    if (payrollMonth) query = query.where('teacher_payroll_drafts.payroll_month', payrollMonth);
    if (teacherId) query = query.where('teacher_payroll_drafts.teacher_id', teacherId);

    const rows = await query;

    return rows.map((r) => ({
      id: String(r.id),
      staffIdentifier: r.staffIdentifier,
      teacherName: r.teacherName,
      salaryModel: r.salaryModel,
      completedLessons: Number(r.completedLessons),
      scheduledLessons: Number(r.scheduledLessons),
      verifiedHours: Number(r.verifiedHours),
      grossAmount: Number(r.grossAmount),
      netPayable: Number(r.netPayable),
      status: r.status,
      payrollMonth: r.payrollMonth,
      col1: r.staffIdentifier,
      col2: r.teacherName,
      col3: r.salaryModel,
      col4: `${r.completedLessons} / ${r.scheduledLessons} lessons (${r.verifiedHours} hrs)`,
      col5: `Rs. ${Number(r.grossAmount).toLocaleString()}`,
      col6: `Rs. ${Number(r.netPayable).toLocaleString()}`,
      col7: r.status
    }));
  },

  // 4. Attendance Trends Report
  async getAttendanceTrendsReport({ classId = null, startDate = null, endDate = null } = {}) {
    let query = db('timetable_lessons')
      .leftJoin('lesson_attendance_submissions', 'timetable_lessons.id', 'lesson_attendance_submissions.lesson_id')
      .join('classes', 'timetable_lessons.class_id', 'classes.id')
      .join('subjects', 'timetable_lessons.subject_id', 'subjects.id')
      .join('teachers', 'timetable_lessons.teacher_id', 'teachers.id')
      .join('users as teacher_users', 'teachers.user_id', 'teacher_users.id')
      .select(
        'timetable_lessons.id',
        'timetable_lessons.lesson_date as date',
        'classes.grade_level as classNumber',
        'classes.name as className',
        'subjects.name as subjectName',
        'teacher_users.full_name as teacherName',
        'lesson_attendance_submissions.total_enrolled as enrolledCount',
        'lesson_attendance_submissions.present_count as presentCount',
        'lesson_attendance_submissions.absent_count as absentCount',
        'lesson_attendance_submissions.is_locked as isLocked'
      )
      .orderBy('timetable_lessons.lesson_date', 'desc');

    if (classId) query = query.where('timetable_lessons.class_id', classId);
    if (startDate) query = query.where('timetable_lessons.lesson_date', '>=', startDate);
    if (endDate) query = query.where('timetable_lessons.lesson_date', '<=', endDate);

    const rows = await query;

    return rows.map((r) => {
      const enrolled = Number(r.enrolledCount || 0);
      const present = Number(r.presentCount || 0);
      const rate = enrolled > 0 ? Math.round((present / enrolled) * 100) : 0;
      const dateStr = r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0];
      const submissionStatus = r.isLocked ? 'Locked / Final' : r.enrolledCount ? 'Submitted' : 'Pending';

      return {
        id: String(r.id),
        date: dateStr,
        classNumber: r.classNumber,
        subjectName: r.subjectName,
        teacherName: r.teacherName,
        enrolledCount: enrolled,
        presentCount: present,
        absentCount: Number(r.absentCount || 0),
        attendanceRate: rate,
        submissionStatus,
        col1: dateStr,
        col2: `Class ${r.classNumber}`,
        col3: r.subjectName,
        col4: r.teacherName,
        col5: `${enrolled} enrolled`,
        col6: `${present} present (${rate}%)`,
        col7: submissionStatus
      };
    });
  },

  // 5. Academic Class Performances (all figures computed from stored records)
  async getAcademicPerformances({ sessionId = null, subjectId = null, taskType = null, term = DEFAULT_TERM } = {}) {
    const ctx = await loadAcademicContext({ sessionId, subjectId, taskType });
    const { classes, studentsByClass, tasks, subsByTask, attendanceByStudent, classSubjects, teacherNames } = ctx;

    const evaluations = ctx.sessionId
      ? await db('class_academic_evaluations').where({ session_id: ctx.sessionId, evaluation_term: term })
      : [];
    const evalByClass = new Map(evaluations.map((e) => [Number(e.class_id), e.published_status]));

    const now = Date.now();

    return classes.map((cls) => {
      const classId = Number(cls.id);
      const students = studentsByClass.get(classId) || [];
      const studentIds = new Set(students.map((s) => Number(s.id)));
      const enrolled = students.length;
      const classTasks = tasks.filter((t) => Number(t.class_id) === classId);

      const classSubs = [];
      for (const t of classTasks) {
        for (const s of subsByTask.get(t.id) || []) {
          if (studentIds.has(Number(s.student_id))) classSubs.push({ ...s, task: t });
        }
      }

      const graded = classSubs.filter((s) => s.status === 'GRADED' && s.marks_awarded != null);
      const pendingGrading = classSubs.filter((s) => s.status === 'PENDING' || s.status === 'LATE').length;

      const pastTasks = classTasks.filter((t) => parseDbDate(t.deadline)?.getTime() < now);
      const pastTaskIds = new Set(pastTasks.map((t) => t.id));
      const pastSubs = classSubs.filter((s) => pastTaskIds.has(s.task.id)).length;
      const missing = Math.max(0, enrolled * pastTasks.length - pastSubs);

      const expected = enrolled * classTasks.length;

      // Attendance for the enrolled students
      let attTotal = 0;
      let attAttended = 0;
      for (const s of students) {
        const a = attendanceByStudent.get(Number(s.id));
        if (a) {
          attTotal += a.total;
          attAttended += a.present + a.late;
        }
      }

      // Subject-wise breakdown
      const subjects = (classSubjects.get(classId) || []).filter((s) => !subjectId || Number(s.subjectId) === Number(subjectId));
      const subjectScores = subjects.map((sub) => {
        const subGraded = graded.filter((g) => Number(g.task.subject_id) === Number(sub.subjectId));
        return {
          subjectId: Number(sub.subjectId),
          subjectName: sub.subjectName,
          averageScore: average(subGraded.map(pctOf)),
          gradedCount: subGraded.length,
          assessmentsCount: classTasks.filter((t) => Number(t.subject_id) === Number(sub.subjectId)).length,
          teacherName: teacherNames.get(`${classId}-${sub.subjectId}`) || 'Not assigned'
        };
      });

      // Assessment type breakdown
      const assessmentBreakdown = TASK_TYPES.map((type) => {
        const typeTasks = classTasks.filter((t) => (t.task_type || 'ASSIGNMENT') === type);
        const typeGraded = graded.filter((g) => (g.task.task_type || 'ASSIGNMENT') === type);
        return {
          taskType: type,
          assessments: typeTasks.length,
          graded: typeGraded.length,
          averageScore: average(typeGraded.map(pctOf))
        };
      }).filter((b) => b.assessments > 0);

      // Most recent assessments
      const recentAssessments = [...classTasks]
        .sort((a, b) => (parseDbDate(b.deadline)?.getTime() || 0) - (parseDbDate(a.deadline)?.getTime() || 0))
        .slice(0, 8)
        .map((t) => {
          const tSubs = classSubs.filter((s) => s.task.id === t.id);
          const tGraded = tSubs.filter((s) => s.status === 'GRADED' && s.marks_awarded != null);
          return {
            taskId: t.id,
            title: t.title,
            taskType: t.task_type || 'ASSIGNMENT',
            subjectName: t.subject_name,
            deadline: t.deadline,
            totalMarks: Number(t.total_marks),
            submitted: tSubs.length,
            graded: tGraded.length,
            enrolled,
            averageScore: average(tGraded.map(pctOf))
          };
        });

      // Monthly trend of graded results
      const byMonth = new Map();
      for (const g of graded) {
        const when = parseDbDate(g.graded_at) || parseDbDate(g.task.deadline);
        if (!when) continue;
        const key = `${when.getUTCFullYear()}-${String(when.getUTCMonth() + 1).padStart(2, '0')}`;
        if (!byMonth.has(key)) byMonth.set(key, []);
        byMonth.get(key).push(pctOf(g));
      }
      const trend = Array.from(byMonth.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([month, values]) => ({ month, averageScore: average(values), graded: values.length }));

      // Students who may need academic support
      const studentsNeedingSupport = students
        .map((s) => {
          const sid = Number(s.id);
          const mine = graded.filter((g) => Number(g.student_id) === sid);
          const avg = average(mine.map(pctOf));
          const att = attendanceByStudent.get(sid);
          const attRate = att && att.total > 0 ? Math.round(((att.present + att.late) / att.total) * 100) : null;
          const submittedPast = classSubs.filter((x) => Number(x.student_id) === sid && pastTaskIds.has(x.task.id)).length;
          const missingCount = Math.max(0, pastTasks.length - submittedPast);

          const reasons = [];
          if (avg != null && avg < SUPPORT_SCORE_THRESHOLD) reasons.push(`Average score ${avg}%`);
          if (attRate != null && attRate < SUPPORT_ATTENDANCE_THRESHOLD) reasons.push(`Attendance ${attRate}%`);
          if (missingCount >= SUPPORT_MISSING_THRESHOLD) reasons.push(`${missingCount} missed submissions`);

          return {
            studentId: sid,
            studentName: s.name,
            rollNo: s.roll_no,
            admissionNo: s.admission_no,
            averageScore: avg,
            attendanceRate: attRate,
            missingSubmissions: missingCount,
            reasons
          };
        })
        .filter((s) => s.reasons.length > 0)
        .sort((a, b) => b.reasons.length - a.reasons.length || (a.averageScore ?? 101) - (b.averageScore ?? 101));

      const status = evalByClass.get(classId);

      return {
        classId,
        classNumber: Number(cls.grade_level),
        className: cls.name,
        enrolledStudents: enrolled,
        assessmentsCount: classTasks.length,
        gradedResultsCount: graded.length,
        averageScorePercentage: average(graded.map(pctOf)),
        taskCompletionRate: expected > 0 ? Math.min(100, Math.round((classSubs.length / expected) * 100)) : null,
        attendanceRate: attTotal > 0 ? Math.round((attAttended / attTotal) * 100) : null,
        missingSubmissionsCount: missing,
        pendingGradingCount: pendingGrading,
        publishedResultsStatus: status === 'PUBLISHED' ? 'Published' : status === 'PENDING_APPROVAL' ? 'Pending Approval' : 'Draft',
        term,
        subjectScores,
        assessmentBreakdown,
        recentAssessments,
        trend,
        studentsNeedingSupport
      };
    });
  },

  async approveResultPublication({ classNumber, sessionId = null, term = DEFAULT_TERM, userId }) {
    const cls = await db('classes').where({ grade_level: classNumber }).first();
    if (!cls) return null;

    const finalSessionId = sessionId || (await getCurrentSessionId());
    if (!finalSessionId) return null;

    const existing = await db('class_academic_evaluations')
      .where({ class_id: cls.id, session_id: finalSessionId, evaluation_term: term })
      .first();

    if (existing) {
      await db('class_academic_evaluations')
        .where({ id: existing.id })
        .update({
          published_status: 'PUBLISHED',
          approved_by: userId,
          approved_at: db.fn.now(3),
          updated_at: db.fn.now(3)
        });
    } else {
      await db('class_academic_evaluations').insert({
        class_id: cls.id,
        session_id: finalSessionId,
        evaluation_term: term,
        published_status: 'PUBLISHED',
        approved_by: userId,
        approved_at: db.fn.now(3)
      });
    }

    return { classNumber, publishedResultsStatus: 'Published', term, sessionId: finalSessionId };
  },

  // 6. Student academic & administrative records (one row per student)
  async getStudentRecordsReport({ classId = null, status = null, sessionId = null } = {}) {
    let studentQuery = db('students')
      .join('users', 'students.user_id', 'users.id')
      .join('classes', 'students.current_class_id', 'classes.id')
      .select(
        'students.id',
        'students.admission_no as admissionNo',
        'students.roll_no as rollNo',
        'users.full_name as studentName',
        'classes.grade_level as classNumber',
        'classes.name as className',
        'students.admission_date as admissionDate',
        'students.status as enrolmentStatus'
      )
      .orderBy('classes.grade_level', 'asc')
      .orderBy('students.roll_no', 'asc');
    if (classId) studentQuery = studentQuery.where('students.current_class_id', classId);
    if (status) studentQuery = studentQuery.where('students.status', status);

    const students = await studentQuery;
    if (students.length === 0) return [];
    const ids = students.map((s) => s.id);
    const finalSessionId = sessionId || (await getCurrentSessionId());

    const [attendance, challans, subs, achievements] = await Promise.all([
      db('lesson_attendance').whereIn('student_id', ids).groupBy('student_id', 'status').select('student_id', 'status', db.raw('count(*) as count')),
      db('fee_challans').whereIn('student_id', ids).select('student_id', 'billing_month', 'total_payable', 'paid_amount', 'status', 'created_at').orderBy('created_at', 'desc'),
      db('task_submissions')
        .join('learning_tasks', 'task_submissions.task_id', 'learning_tasks.id')
        .whereIn('task_submissions.student_id', ids)
        .modify((q) => {
          if (finalSessionId) q.where('learning_tasks.session_id', finalSessionId);
        })
        .select('task_submissions.student_id', 'task_submissions.status', 'task_submissions.marks_awarded', 'learning_tasks.total_marks', 'learning_tasks.task_type'),
      db('student_achievements').whereIn('student_id', ids).where('visibility', 'PUBLISHED').groupBy('student_id').select('student_id', db.raw('count(*) as count'))
    ]);

    const attMap = new Map();
    for (const a of attendance) {
      const sid = Number(a.student_id);
      if (!attMap.has(sid)) attMap.set(sid, { present: 0, absent: 0, late: 0, excused: 0, total: 0 });
      const entry = attMap.get(sid);
      const c = Number(a.count);
      entry.total += c;
      if (a.status === 'PRESENT') entry.present += c;
      else if (a.status === 'ABSENT') entry.absent += c;
      else if (a.status === 'LATE') entry.late += c;
      else if (a.status === 'EXCUSED') entry.excused += c;
    }

    const feeMap = new Map();
    for (const c of challans) {
      const sid = Number(c.student_id);
      if (!feeMap.has(sid)) feeMap.set(sid, { billed: 0, paid: 0, outstanding: 0, latest: c });
      const entry = feeMap.get(sid);
      const payable = Number(c.total_payable);
      const paid = Number(c.paid_amount);
      entry.billed += payable;
      entry.paid += paid;
      if (c.status !== 'PAID') entry.outstanding += Math.max(0, payable - paid);
    }

    const subMap = new Map();
    for (const s of subs) {
      const sid = Number(s.student_id);
      if (!subMap.has(sid)) subMap.set(sid, []);
      subMap.get(sid).push(s);
    }

    const achMap = new Map(achievements.map((a) => [Number(a.student_id), Number(a.count)]));

    return students.map((s) => {
      const att = attMap.get(Number(s.id)) || { present: 0, absent: 0, late: 0, excused: 0, total: 0 };
      const fee = feeMap.get(Number(s.id));
      const mySubs = subMap.get(Number(s.id)) || [];
      const graded = mySubs.filter((x) => x.status === 'GRADED' && x.marks_awarded != null);
      const byType = (type) => average(graded.filter((g) => (g.task_type || 'ASSIGNMENT') === type).map(pctOf));
      const overall = average(graded.map(pctOf));

      return {
        id: String(s.id),
        admissionNo: s.admissionNo,
        rollNo: s.rollNo || '',
        studentName: s.studentName,
        className: s.className,
        classNumber: Number(s.classNumber),
        admissionDate: toDateString(s.admissionDate),
        enrolmentStatus: s.enrolmentStatus,
        attendance: {
          ...att,
          rate: att.total > 0 ? Math.round(((att.present + att.late) / att.total) * 100) : null
        },
        fees: {
          totalBilled: fee ? fee.billed : 0,
          totalPaid: fee ? fee.paid : 0,
          outstanding: fee ? fee.outstanding : 0,
          latestMonth: fee ? fee.latest.billing_month : null,
          latestStatus: fee ? fee.latest.status : null
        },
        academics: {
          submitted: mySubs.length,
          graded: graded.length,
          averageScore: overall,
          grade: letterGrade(overall),
          assignmentAverage: byType('ASSIGNMENT'),
          quizAverage: byType('QUIZ'),
          testAverage: byType('TEST'),
          examAverage: byType('EXAM')
        },
        achievements: achMap.get(Number(s.id)) || 0
      };
    });
  },

  // 7. Subject marks & assessment results (one row per published result)
  async getStudentMarksReport({ classId = null, subjectId = null, taskType = null, sessionId = null } = {}) {
    const finalSessionId = sessionId || (await getCurrentSessionId());
    let query = db('task_submissions')
      .join('learning_tasks', 'task_submissions.task_id', 'learning_tasks.id')
      .join('subjects', 'learning_tasks.subject_id', 'subjects.id')
      .join('classes', 'learning_tasks.class_id', 'classes.id')
      .join('students', 'task_submissions.student_id', 'students.id')
      .join('users as student_users', 'students.user_id', 'student_users.id')
      .join('teachers', 'learning_tasks.teacher_id', 'teachers.id')
      .join('users as teacher_users', 'teachers.user_id', 'teacher_users.id')
      .where('task_submissions.status', 'GRADED')
      .whereNotNull('task_submissions.marks_awarded')
      .select(
        'task_submissions.id',
        'students.admission_no as admissionNo',
        'student_users.full_name as studentName',
        'classes.name as className',
        'classes.grade_level as classNumber',
        'subjects.name as subjectName',
        'learning_tasks.title as assessmentTitle',
        'learning_tasks.task_type as taskType',
        'task_submissions.marks_awarded as marksAwarded',
        'learning_tasks.total_marks as totalMarks',
        'task_submissions.graded_at as gradedAt',
        'task_submissions.feedback',
        'teacher_users.full_name as teacherName'
      )
      .orderBy('classes.grade_level', 'asc')
      .orderBy('student_users.full_name', 'asc')
      .orderBy('task_submissions.graded_at', 'desc');

    if (classId) query = query.where('learning_tasks.class_id', classId);
    if (subjectId) query = query.where('learning_tasks.subject_id', subjectId);
    if (taskType) query = query.where('learning_tasks.task_type', taskType);
    if (finalSessionId) query = query.where('learning_tasks.session_id', finalSessionId);

    const rows = await query;
    return rows.map((r) => {
      const marks = Number(r.marksAwarded);
      const max = Number(r.totalMarks) || 0;
      const pct = max > 0 ? Math.round((marks / max) * 100) : null;
      return {
        id: String(r.id),
        admissionNo: r.admissionNo,
        studentName: r.studentName,
        className: r.className,
        classNumber: Number(r.classNumber),
        subjectName: r.subjectName,
        assessmentTitle: r.assessmentTitle,
        taskType: r.taskType || 'ASSIGNMENT',
        marksAwarded: marks,
        totalMarks: max,
        percentage: pct,
        grade: letterGrade(pct),
        gradedAt: r.gradedAt,
        teacherName: r.teacherName,
        feedback: r.feedback || ''
      };
    });
  },

  async logReportExport({ reportType, exportFormat, filterParameters, rowCount, userId }) {
    const [id] = await db('report_export_logs').insert({
      report_type: reportType,
      export_format: exportFormat.toUpperCase(),
      filter_parameters: JSON.stringify(filterParameters || {}),
      row_count: rowCount,
      exported_by: userId
    });
    return { id, reportType, exportFormat, rowCount };
  }
};
