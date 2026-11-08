import { db } from '../../shared/db/knex.js';

export const attendanceRepository = {
  /**
   * Get enrolled students for the lesson's class and any existing marked attendance
   */
  async getLessonRoster(lessonId) {
    const lesson = await db('timetable_lessons')
      .join('classes', 'timetable_lessons.class_id', 'classes.id')
      .join('subjects', 'timetable_lessons.subject_id', 'subjects.id')
      .where('timetable_lessons.id', lessonId)
      .select(
        'timetable_lessons.id as lessonId',
        'timetable_lessons.class_id as classId',
        'classes.grade_level as classNumber',
        'classes.name as className',
        'subjects.name as subjectName',
        'timetable_lessons.lesson_date as lessonDate',
        'timetable_lessons.start_at as startAt',
        'timetable_lessons.end_at as endAt',
        'timetable_lessons.status as lessonStatus',
        'timetable_lessons.topic_covered as topicCovered',
        'timetable_lessons.teaching_notes as teachingNotes',
        'timetable_lessons.delivery_logged_at as deliveryLoggedAt'
      )
      .first();

    if (!lesson) return null;

    // Check submission status
    const submission = await db('lesson_attendance_submissions')
      .where({ lesson_id: lessonId })
      .first();

    // Query all currently active enrolled students in this class
    const students = await db('students')
      .join('users', 'students.user_id', 'users.id')
      .leftJoin('lesson_attendance', function () {
        this.on('lesson_attendance.student_id', '=', 'students.id')
          .andOn('lesson_attendance.lesson_id', '=', db.raw('?', [lessonId]));
      })
      .where(function () {
        this.where('students.current_class_id', lesson.classId)
          .orWhereIn(
            'students.id',
            db('enrollments')
              .select('student_id')
              .where('class_id', lesson.classId)
              .andWhere('status', 'ACTIVE')
          );
      })
      .where('students.status', 'ACTIVE')
      .select(
        'students.id as studentId',
        'students.admission_no as admissionNumber',
        'students.roll_no as rollNumber',
        'users.full_name as studentName',
        'users.email as studentEmail',
        'lesson_attendance.id as attendanceId',
        'lesson_attendance.status as status',
        'lesson_attendance.remarks as remarks',
        'lesson_attendance.marked_by_user_id as markedByUserId',
        'lesson_attendance.updated_at as markedAt'
      )
      .orderBy('students.roll_no', 'asc');

    const studentRoster = students.map((s) => ({
      ...s,
      status: s.status || 'PRESENT' // default to present if not marked
    }));

    return {
      lesson,
      isLocked: submission ? Boolean(submission.is_locked) : false,
      submission: submission || null,
      roster: studentRoster,
      students: studentRoster
    };
  },

  /**
   * Get class roster directly by classId (with today's or specified date's lesson if scheduled)
   */
  async getClassRoster(classId, date = new Date().toISOString().slice(0, 10)) {
    const classObj = await db('classes').where({ id: classId }).first();
    if (!classObj) return null;

    // Look for a scheduled lesson for this class today
    const lesson = await db('timetable_lessons')
      .join('subjects', 'timetable_lessons.subject_id', 'subjects.id')
      .where('timetable_lessons.class_id', classId)
      .where('timetable_lessons.lesson_date', date)
      .select(
        'timetable_lessons.id as lessonId',
        'timetable_lessons.class_id as classId',
        'timetable_lessons.lesson_date as lessonDate',
        'timetable_lessons.start_at as startAt',
        'timetable_lessons.end_at as endAt',
        'timetable_lessons.status as lessonStatus',
        'subjects.name as subjectName'
      )
      .first();

    const lessonId = lesson ? lesson.lessonId : null;

    let submission = null;
    if (lessonId) {
      submission = await db('lesson_attendance_submissions')
        .where({ lesson_id: lessonId })
        .first();
    }

    const students = await db('students')
      .join('users', 'students.user_id', 'users.id')
      .leftJoin('lesson_attendance', function () {
        if (lessonId) {
          this.on('lesson_attendance.student_id', '=', 'students.id')
            .andOn('lesson_attendance.lesson_id', '=', db.raw('?', [lessonId]));
        } else {
          this.on(db.raw('1 = 0'));
        }
      })
      .where(function () {
        this.where('students.current_class_id', classId)
          .orWhereIn(
            'students.id',
            db('enrollments')
              .select('student_id')
              .where('class_id', classId)
              .andWhere('status', 'ACTIVE')
          );
      })
      .where('students.status', 'ACTIVE')
      .select(
        'students.id as studentId',
        'students.admission_no as admissionNumber',
        'students.roll_no as rollNumber',
        'users.full_name as studentName',
        'users.email as studentEmail',
        'lesson_attendance.id as attendanceId',
        'lesson_attendance.status as status',
        'lesson_attendance.remarks as remarks',
        'lesson_attendance.marked_by_user_id as markedByUserId',
        'lesson_attendance.updated_at as markedAt'
      )
      .orderBy('students.roll_no', 'asc');

    const roster = students.map((s) => ({
      ...s,
      status: s.status || 'PRESENT'
    }));

    return {
      class: {
        id: classObj.id,
        name: classObj.name,
        gradeLevel: classObj.grade_level
      },
      lesson: lesson || {
        lessonId: `CLASS-${classObj.id}`,
        classId: classObj.id,
        className: classObj.name,
        subjectName: 'Class Session',
        lessonDate: date,
        startAt: `${date} 09:00:00.000`,
        endAt: `${date} 09:45:00.000`,
        lessonStatus: 'SCHEDULED'
      },
      isLocked: submission ? Boolean(submission.is_locked) : false,
      submission: submission || null,
      roster,
      students: roster
    };
  },

  /**
   * Log Lesson Delivery
   */
  async recordLessonDelivery({
    lessonId,
    actualStartAt,
    actualEndAt,
    topicCovered,
    teachingNotes,
    resourceUrl,
    problemCategory = 'NONE',
    userId
  }) {
    const updates = {
      actual_start_at: actualStartAt || db.fn.now(3),
      actual_end_at: actualEndAt || db.fn.now(3),
      topic_covered: topicCovered || null,
      teaching_notes: teachingNotes || null,
      resource_url: resourceUrl || null,
      problem_category: problemCategory,
      delivery_logged_at: db.fn.now(3),
      delivery_logged_by: userId,
      status: 'COMPLETED'
    };

    await db('timetable_lessons').where({ id: lessonId }).update(updates);
    return await db('timetable_lessons').where({ id: lessonId }).first();
  },

  /**
   * Submit and Lock Lesson Attendance (or save draft when isLocked is false)
   */
  async submitAttendance({ lessonId, records, userId, isLocked = true }) {
    return await db.transaction(async (trx) => {
      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;
      let excusedCount = 0;

      for (const rec of records) {
        let status = (rec.status || 'PRESENT').toUpperCase();
        if (status === 'P' || status === 'PRESENT') status = 'PRESENT';
        else if (status === 'A' || status === 'ABSENT') status = 'ABSENT';
        else if (status === 'L' || status === 'LATE') status = 'LATE';
        else if (status === 'E' || status === 'EXCUSED' || status === 'LEAVE') status = 'EXCUSED';

        if (status === 'PRESENT') presentCount++;
        else if (status === 'ABSENT') absentCount++;
        else if (status === 'LATE') lateCount++;
        else if (status === 'EXCUSED') excusedCount++;

        const remarksText = rec.remarks || rec.remark || null;

        // Upsert student record
        const existing = await trx('lesson_attendance')
          .where({ lesson_id: lessonId, student_id: rec.studentId })
          .first();

        if (existing) {
          await trx('lesson_attendance')
            .where({ id: existing.id })
            .update({
              status,
              remarks: remarksText,
              marked_by_user_id: userId,
              updated_at: trx.fn.now(3)
            });
        } else {
          await trx('lesson_attendance').insert({
            lesson_id: lessonId,
            student_id: rec.studentId,
            status,
            remarks: remarksText,
            marked_by_user_id: userId
          });
        }
      }

      const totalEnrolled = records.length;
      const lockVal = isLocked ? 1 : 0;

      // Upsert submission lock record
      const existingSub = await trx('lesson_attendance_submissions')
        .where({ lesson_id: lessonId })
        .first();

      if (existingSub) {
        await trx('lesson_attendance_submissions')
          .where({ id: existingSub.id })
          .update({
            submitted_by_user_id: userId,
            submitted_at: trx.fn.now(3),
            is_locked: lockVal,
            present_count: presentCount,
            absent_count: absentCount,
            late_count: lateCount,
            excused_count: excusedCount,
            total_enrolled: totalEnrolled
          });
      } else {
        await trx('lesson_attendance_submissions').insert({
          lesson_id: lessonId,
          submitted_by_user_id: userId,
          submitted_at: trx.fn.now(3),
          is_locked: lockVal,
          present_count: presentCount,
          absent_count: absentCount,
          late_count: lateCount,
          excused_count: excusedCount,
          total_enrolled: totalEnrolled
        });
      }

      return {
        lessonId,
        isLocked: Boolean(lockVal),
        presentCount,
        absentCount,
        lateCount,
        excusedCount,
        totalEnrolled
      };
    });
  },

  /**
   * Find attendance record for a student in a lesson
   */
  async findAttendanceRecord({ lessonId, studentId }) {
    return await db('lesson_attendance')
      .where({ lesson_id: lessonId, student_id: studentId })
      .first();
  },

  /**
   * Create Attendance Correction Voucher
   */
  async createCorrectionRequest({
    lessonId,
    studentId,
    attendanceRecordId,
    requestedByUserId,
    originalStatus,
    proposedStatus,
    reason
  }) {
    const [id] = await db('attendance_corrections').insert({
      lesson_id: lessonId,
      student_id: studentId,
      attendance_record_id: attendanceRecordId,
      requested_by_user_id: requestedByUserId,
      original_status: originalStatus,
      proposed_status: proposedStatus,
      reason,
      status: 'PENDING'
    });
    return id;
  },

  /**
   * Get Correction Vouchers
   */
  async getCorrectionRequests({ status = null, classId = null, lessonId = null } = {}) {
    let query = db('attendance_corrections')
      .join('timetable_lessons', 'attendance_corrections.lesson_id', 'timetable_lessons.id')
      .join('classes', 'timetable_lessons.class_id', 'classes.id')
      .join('subjects', 'timetable_lessons.subject_id', 'subjects.id')
      .join('students', 'attendance_corrections.student_id', 'students.id')
      .join('users as student_users', 'students.user_id', 'student_users.id')
      .join('users as teacher_users', 'attendance_corrections.requested_by_user_id', 'teacher_users.id')
      .leftJoin('users as reviewer_users', 'attendance_corrections.reviewed_by_user_id', 'reviewer_users.id')
      .select(
        'attendance_corrections.id',
        'attendance_corrections.lesson_id as lessonId',
        'classes.grade_level as classNumber',
        'classes.name as className',
        'subjects.name as subjectName',
        'timetable_lessons.lesson_date as lessonDate',
        'attendance_corrections.student_id as studentId',
        'student_users.full_name as studentName',
        'students.admission_no as admissionNumber',
        'attendance_corrections.requested_by_user_id as requestedByUserId',
        'teacher_users.full_name as requestedByName',
        'attendance_corrections.original_status as originalStatus',
        'attendance_corrections.proposed_status as proposedStatus',
        'attendance_corrections.reason',
        'attendance_corrections.status',
        'attendance_corrections.reviewed_by_user_id as reviewedByUserId',
        'reviewer_users.full_name as reviewedByName',
        'attendance_corrections.review_remarks as reviewRemarks',
        'attendance_corrections.reviewed_at as reviewedAt',
        'attendance_corrections.created_at as createdAt'
      )
      .orderBy('attendance_corrections.created_at', 'desc');

    if (status) query = query.where('attendance_corrections.status', status);
    if (classId) query = query.where('timetable_lessons.class_id', classId);
    if (lessonId) query = query.where('attendance_corrections.lesson_id', lessonId);

    return await query;
  },

  async findCorrectionById(id) {
    return await db('attendance_corrections').where({ id }).first();
  },

  /**
   * Review Attendance Correction Request
   */
  async reviewCorrectionRequest({ correctionId, status, reviewRemarks, reviewedByUserId }) {
    return await db.transaction(async (trx) => {
      const correction = await trx('attendance_corrections').where({ id: correctionId }).first();
      if (!correction) return null;

      await trx('attendance_corrections')
        .where({ id: correctionId })
        .update({
          status,
          review_remarks: reviewRemarks || null,
          reviewed_by_user_id: reviewedByUserId,
          reviewed_at: trx.fn.now(3)
        });

      if (status === 'APPROVED') {
        // Update lesson_attendance record
        await trx('lesson_attendance')
          .where({ id: correction.attendance_record_id })
          .update({
            status: correction.proposed_status,
            remarks: `Correction approved: ${correction.reason}`,
            updated_at: trx.fn.now(3)
          });

        // Recalculate submission counts
        const allRecords = await trx('lesson_attendance')
          .where({ lesson_id: correction.lesson_id });

        const presentCount = allRecords.filter((r) => r.status === 'PRESENT').length;
        const absentCount = allRecords.filter((r) => r.status === 'ABSENT').length;
        const lateCount = allRecords.filter((r) => r.status === 'LATE').length;
        const excusedCount = allRecords.filter((r) => r.status === 'EXCUSED').length;

        await trx('lesson_attendance_submissions')
          .where({ lesson_id: correction.lesson_id })
          .update({
            present_count: presentCount,
            absent_count: absentCount,
            late_count: lateCount,
            excused_count: excusedCount
          });
      }

      return await trx('attendance_corrections').where({ id: correctionId }).first();
    });
  },

  /**
   * Get Overall Attendance Statistics
   */
  async getAttendanceStats({ classId = null, studentId = null, startDate = null, endDate = null } = {}) {
    let query = db('lesson_attendance')
      .join('timetable_lessons', 'lesson_attendance.lesson_id', 'timetable_lessons.id')
      .join('classes', 'timetable_lessons.class_id', 'classes.id');

    if (classId) query = query.where('timetable_lessons.class_id', classId);
    if (studentId) query = query.where('lesson_attendance.student_id', studentId);
    if (startDate) query = query.where('timetable_lessons.lesson_date', '>=', startDate);
    if (endDate) query = query.where('timetable_lessons.lesson_date', '<=', endDate);

    const rows = await query.select(
      'lesson_attendance.status',
      db.raw('count(*) as count')
    ).groupBy('lesson_attendance.status');

    let total = 0;
    let present = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;

    for (const r of rows) {
      const c = Number(r.count);
      total += c;
      if (r.status === 'PRESENT') present += c;
      else if (r.status === 'ABSENT') absent += c;
      else if (r.status === 'LATE') late += c;
      else if (r.status === 'EXCUSED') excused += c;
    }

    const attendanceRate = total > 0 ? Number((((present + late) / total) * 100).toFixed(1)) : 100;

    // For a single student, also return the lecture-wise records so the
    // student/parent portals can show the per-lesson attendance table.
    let records = [];
    if (studentId) {
      let recQuery = db('lesson_attendance')
        .join('timetable_lessons', 'lesson_attendance.lesson_id', 'timetable_lessons.id')
        .join('subjects', 'timetable_lessons.subject_id', 'subjects.id')
        .leftJoin('teachers', 'timetable_lessons.teacher_id', 'teachers.id')
        .leftJoin('users as teacher_users', 'teachers.user_id', 'teacher_users.id')
        .where('lesson_attendance.student_id', studentId)
        .select(
          'lesson_attendance.id',
          'timetable_lessons.lesson_date as lessonDate',
          'timetable_lessons.start_at as startAt',
          'timetable_lessons.topic_covered as topic',
          'subjects.name as subjectName',
          'teacher_users.full_name as teacherName',
          'lesson_attendance.status',
          'lesson_attendance.remarks'
        )
        .orderBy('timetable_lessons.lesson_date', 'desc')
        .orderBy('timetable_lessons.start_at', 'desc');
      if (startDate) recQuery = recQuery.where('timetable_lessons.lesson_date', '>=', startDate);
      if (endDate) recQuery = recQuery.where('timetable_lessons.lesson_date', '<=', endDate);
      records = await recQuery.limit(500);
    }

    return {
      total,
      present,
      absent,
      late,
      excused,
      attendanceRate,
      records
    };
  },

  /** Recent attendance submissions for a teacher's lessons (newest first). */
  async getTeacherSubmissions({ teacherId = null, limit = 20 } = {}) {
    let query = db('lesson_attendance_submissions')
      .join('timetable_lessons', 'lesson_attendance_submissions.lesson_id', 'timetable_lessons.id')
      .join('classes', 'timetable_lessons.class_id', 'classes.id')
      .leftJoin('subjects', 'timetable_lessons.subject_id', 'subjects.id')
      .leftJoin('teachers', 'timetable_lessons.teacher_id', 'teachers.id')
      .leftJoin('users as teacher_users', 'teachers.user_id', 'teacher_users.id')
      .select(
        'lesson_attendance_submissions.id',
        'lesson_attendance_submissions.lesson_id as lessonId',
        'lesson_attendance_submissions.submitted_at as submittedAt',
        'lesson_attendance_submissions.is_locked as isLocked',
        'lesson_attendance_submissions.present_count as presentCount',
        'lesson_attendance_submissions.absent_count as absentCount',
        'lesson_attendance_submissions.late_count as lateCount',
        'lesson_attendance_submissions.excused_count as excusedCount',
        'lesson_attendance_submissions.total_enrolled as totalEnrolled',
        'timetable_lessons.lesson_date as lessonDate',
        'timetable_lessons.start_at as startAt',
        'timetable_lessons.end_at as endAt',
        'timetable_lessons.teacher_id as teacherId',
        'teacher_users.full_name as teacherName',
        'classes.name as className',
        'classes.grade_level as classNumber',
        'subjects.name as subjectName'
      )
      .orderBy('lesson_attendance_submissions.submitted_at', 'desc')
      .limit(Math.min(Math.max(Number(limit) || 20, 1), 300));
    if (teacherId) query = query.where('timetable_lessons.teacher_id', teacherId);
    return await query;
  }
};
