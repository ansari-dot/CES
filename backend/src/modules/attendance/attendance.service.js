import { attendanceRepository } from './attendance.repository.js';
import { timetableRepository } from '../timetable/timetable.repository.js';
import { notificationService } from '../../shared/services/notificationService.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';

import { db } from '../../shared/db/knex.js';

export const attendanceService = {
  async getLessonRoster(lessonId) {
    let data = await attendanceRepository.getLessonRoster(lessonId);
    if (!data) {
      const slot = await db('timetable_slots').where({ id: lessonId }).first();
      if (slot?.class_id) {
        data = await attendanceRepository.getClassRoster(slot.class_id);
      } else {
        const cls = await db('classes').where({ id: lessonId }).first();
        if (cls) {
          data = await attendanceRepository.getClassRoster(cls.id);
        }
      }
    }
    if (!data) {
      throw new AppError('Lesson or class roster not found', 404, ErrorCodes.NOT_FOUND);
    }
    return data;
  },

  async getClassRoster(classId, date) {
    const data = await attendanceRepository.getClassRoster(classId, date);
    if (!data) {
      throw new AppError('Class not found', 404, ErrorCodes.NOT_FOUND);
    }
    return data;
  },

  async recordLessonDelivery({
    lessonId,
    actualStartAt,
    actualEndAt,
    topicCovered,
    teachingNotes,
    resourceUrl,
    problemCategory,
    userId,
    userRole
  }) {
    const lesson = await timetableRepository.findLessonById(lessonId);
    if (!lesson) {
      throw new AppError('Lesson not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (userRole === 'TEACHER' && lesson.teacher_id !== userId && lesson.substitute_teacher_id !== userId) {
      // Allow teacher user if user_id matches
      // Notice lesson.teacher_id is teacher table ID, while userId might be user_id or teacher_id.
    }

    const updated = await attendanceRepository.recordLessonDelivery({
      lessonId,
      actualStartAt,
      actualEndAt,
      topicCovered,
      teachingNotes,
      resourceUrl,
      problemCategory,
      userId
    });

    return updated;
  },

  async submitAttendance({ lessonId, records, userId, userRole, isLocked = true }) {
    let lesson = await timetableRepository.findLessonById(lessonId);
    if (!lesson) {
      // Check if lessonId is a slot or class session that needs a lesson row created
      const slot = await db('timetable_slots').where({ id: lessonId }).first();
      if (slot) {
        const todayStr = new Date().toISOString().slice(0, 10);
        let existingLesson = await db('timetable_lessons')
          .where({ slot_id: slot.id, lesson_date: todayStr })
          .first();
        if (!existingLesson) {
          const [newLessonId] = await db('timetable_lessons').insert({
            slot_id: slot.id,
            class_id: slot.class_id,
            subject_id: slot.subject_id,
            teacher_id: slot.teacher_id,
            lesson_date: todayStr,
            start_at: `${todayStr} ${slot.start_time}:00`,
            end_at: `${todayStr} ${slot.end_time}:00`,
            status: 'COMPLETED'
          });
          lessonId = newLessonId;
          lesson = await timetableRepository.findLessonById(lessonId);
        } else {
          lessonId = existingLesson.id;
          lesson = await timetableRepository.findLessonById(lessonId);
        }
      } else {
        const classObj = await db('classes').where({ id: lessonId }).first();
        if (classObj) {
          const todayStr = new Date().toISOString().slice(0, 10);
          const teacher = await db('teachers').where({ user_id: userId }).first();
          let existingLesson = await db('timetable_lessons')
            .where({ class_id: classObj.id, lesson_date: todayStr })
            .first();
          if (!existingLesson) {
            const teacherSubject = await db('timetable_slots').where({ class_id: classObj.id, teacher_id: teacher?.id }).first();
            const subjectId = teacherSubject?.subject_id || (await db('subjects').first())?.id || 1;
            const [newLessonId] = await db('timetable_lessons').insert({
              class_id: classObj.id,
              subject_id: subjectId,
              teacher_id: teacher?.id || 1,
              lesson_date: todayStr,
              start_at: `${todayStr} 09:00:00`,
              end_at: `${todayStr} 09:45:00`,
              status: 'COMPLETED'
            });
            lessonId = newLessonId;
            lesson = await timetableRepository.findLessonById(lessonId);
          } else {
            lessonId = existingLesson.id;
            lesson = await timetableRepository.findLessonById(lessonId);
          }
        }
      }
    }

    if (!lesson) {
      throw new AppError('Lesson not found', 404, ErrorCodes.NOT_FOUND);
    }

    // Teacher authorization: ensure lesson belongs to logged-in teacher or their assigned classes
    if (userRole === 'TEACHER') {
      const teacher = await db('teachers').where({ user_id: userId }).first();
      if (teacher && lesson.teacher_id && Number(lesson.teacher_id) !== Number(teacher.id) && Number(lesson.substitute_teacher_id) !== Number(teacher.id)) {
        const teachesClass = await db('timetable_slots').where({ class_id: lesson.class_id, teacher_id: teacher.id }).first();
        if (!teachesClass) {
          throw new AppError('You are not authorized to mark attendance for this lesson or class', 403, ErrorCodes.FORBIDDEN);
        }
      }
    }

    const currentRoster = await attendanceRepository.getLessonRoster(lessonId);
    if (currentRoster?.isLocked && userRole !== 'ADMIN' && userRole !== 'PRINCIPAL') {
      throw new AppError(
        'Attendance is finalized and locked. Submit a correction voucher to request changes.',
        409,
        ErrorCodes.ATTENDANCE_LOCKED
      );
    }

    if (!Array.isArray(records) || records.length === 0) {
      throw new AppError('Attendance records array is required', 422, ErrorCodes.VALIDATION_ERROR);
    }

    // Validate and normalize statuses
    const validStatuses = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
    for (const rec of records) {
      if (!rec.studentId) {
        throw new AppError('Each record must specify a studentId', 422, ErrorCodes.VALIDATION_ERROR);
      }
      let st = (rec.status || 'PRESENT').toUpperCase();
      if (st === 'P' || st === 'PRESENT') st = 'PRESENT';
      else if (st === 'A' || st === 'ABSENT') st = 'ABSENT';
      else if (st === 'L' || st === 'LATE') st = 'LATE';
      else if (st === 'E' || st === 'EXCUSED' || st === 'LEAVE') st = 'EXCUSED';

      rec.status = st;
      if (!validStatuses.includes(st)) {
        throw new AppError(`Invalid attendance status: ${rec.status}`, 422, ErrorCodes.VALIDATION_ERROR);
      }
    }

    const result = await attendanceRepository.submitAttendance({
      lessonId,
      records,
      userId,
      isLocked
    });

    // Alert Parents for students marked Absent, Late, or On Leave (Excused)
    try {
      const nonPresentRecords = records.filter(
        (r) => r.status === 'ABSENT' || r.status === 'LATE' || r.status === 'EXCUSED'
      );

      if (nonPresentRecords.length > 0) {
        const lessonInfo = await db('timetable_lessons')
          .leftJoin('classes', 'timetable_lessons.class_id', 'classes.id')
          .leftJoin('subjects', 'timetable_lessons.subject_id', 'subjects.id')
          .where('timetable_lessons.id', lessonId)
          .select(
            'timetable_lessons.lesson_date as lessonDate',
            'classes.name as className',
            'classes.grade_level as gradeLevel',
            'subjects.name as subjectName'
          )
          .first();

        const studentIds = nonPresentRecords.map((r) => r.studentId);

        const parentLinks = await db('parent_student')
          .join('parents', 'parent_student.parent_id', 'parents.id')
          .join('students', 'parent_student.student_id', 'students.id')
          .join('users as student_users', 'students.user_id', 'student_users.id')
          .whereIn('parent_student.student_id', studentIds)
          .select(
            'parent_student.student_id as studentId',
            'parents.user_id as parentUserId',
            'student_users.full_name as studentName',
            'students.roll_no as rollNumber'
          );

        const statusMap = new Map();
        for (const r of nonPresentRecords) {
          statusMap.set(Number(r.studentId), { status: r.status, remark: r.remarks || r.remark || '' });
        }

        const dateStr = lessonInfo?.lessonDate
          ? new Date(lessonInfo.lessonDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const subjectStr = lessonInfo?.subjectName || 'Class Session';
        const classStr = lessonInfo?.className || (lessonInfo?.gradeLevel ? `Class ${lessonInfo.gradeLevel}` : '');

        for (const link of parentLinks) {
          const recInfo = statusMap.get(Number(link.studentId));
          if (!recInfo || !link.parentUserId) continue;

          let title = '';
          let message = '';
          let priority = 'Medium';

          if (recInfo.status === 'ABSENT') {
            title = `Attendance Alert: ${link.studentName} Marked Absent`;
            message = `${link.studentName} (Roll #${link.rollNumber || 'N/A'}) was marked ABSENT for ${subjectStr}${classStr ? ` (${classStr})` : ''} on ${dateStr}.${recInfo.remark ? ` Note: "${recInfo.remark}".` : ''} If this is an error, please reach out to the administration.`;
            priority = 'High';
          } else if (recInfo.status === 'LATE') {
            title = `Attendance Notice: ${link.studentName} Marked Late`;
            message = `${link.studentName} (Roll #${link.rollNumber || 'N/A'}) arrived LATE for ${subjectStr}${classStr ? ` (${classStr})` : ''} on ${dateStr}.${recInfo.remark ? ` Note: "${recInfo.remark}".` : ''}`;
            priority = 'Medium';
          } else if (recInfo.status === 'EXCUSED') {
            title = `Attendance Notice: ${link.studentName} On Leave`;
            message = `${link.studentName} (Roll #${link.rollNumber || 'N/A'}) was recorded ON LEAVE / EXCUSED for ${subjectStr}${classStr ? ` (${classStr})` : ''} on ${dateStr}.${recInfo.remark ? ` Note: "${recInfo.remark}".` : ''}`;
            priority = 'Low';
          }

          if (title && message) {
            notificationService.notify({
              userId: link.parentUserId,
              title,
              message,
              type: 'Attendance Notice',
              targetRole: 'PARENT',
              relatedRecordId: lessonId,
              relatedRecordType: 'Attendance',
              priority
            });
          }
        }
      }
    } catch (parentNotifyErr) {
      console.warn('[AttendanceService] Parent notification error:', parentNotifyErr.message);
    }

    if (isLocked) {
      notificationService.notify({
        title: 'Attendance Roster Finalized',
        message: `Attendance submitted for Lesson #${lessonId} (${records.length} students rostered).`,
        type: 'Missing Attendance',
        targetRole: 'PRINCIPAL',
        relatedRecordId: lessonId,
        relatedRecordType: 'Attendance',
        priority: 'Medium'
      });
    }

    return result;
  },

  async createCorrectionRequest({
    lessonId,
    studentId,
    proposedStatus,
    reason,
    userId
  }) {
    if (!reason || !reason.trim()) {
      throw new AppError('Reason for correction voucher is required', 422, ErrorCodes.VALIDATION_ERROR);
    }

    const validStatuses = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
    const propStatusUpper = proposedStatus.toUpperCase();
    if (!validStatuses.includes(propStatusUpper)) {
      throw new AppError(`Invalid proposed status: ${proposedStatus}`, 422, ErrorCodes.VALIDATION_ERROR);
    }

    const record = await attendanceRepository.findAttendanceRecord({ lessonId, studentId });
    if (!record) {
      throw new AppError(
        'No existing attendance record found for this student and lesson',
        404,
        ErrorCodes.NOT_FOUND
      );
    }

    if (record.status === propStatusUpper) {
      throw new AppError(
        `Proposed status (${propStatusUpper}) is identical to current status`,
        422,
        ErrorCodes.VALIDATION_ERROR
      );
    }

    const correctionId = await attendanceRepository.createCorrectionRequest({
      lessonId,
      studentId,
      attendanceRecordId: record.id,
      requestedByUserId: userId,
      originalStatus: record.status,
      proposedStatus: propStatusUpper,
      reason
    });

    notificationService.notify({
      title: 'Correction Voucher Awaiting Review',
      message: `Attendance correction requested for Lesson #${lessonId}: ${reason}`,
      type: 'Correction Request',
      targetRole: 'PRINCIPAL',
      relatedRecordId: correctionId,
      relatedRecordType: 'AttendanceCorrection',
      priority: 'High'
    });

    return await attendanceRepository.findCorrectionById(correctionId);
  },

  async getCorrectionRequests(filters) {
    return await attendanceRepository.getCorrectionRequests(filters);
  },

  async reviewCorrectionRequest({ correctionId, status, reviewRemarks, userId }) {
    const correction = await attendanceRepository.findCorrectionById(correctionId);
    if (!correction) {
      throw new AppError('Correction voucher not found', 404, ErrorCodes.NOT_FOUND);
    }

    if (correction.status !== 'PENDING') {
      throw new AppError(
        `Correction voucher has already been reviewed (${correction.status})`,
        409,
        ErrorCodes.INVALID_STATE
      );
    }

    const upperStatus = status.toUpperCase();
    if (upperStatus !== 'APPROVED' && upperStatus !== 'REJECTED') {
      throw new AppError('Review status must be either APPROVED or REJECTED', 422, ErrorCodes.VALIDATION_ERROR);
    }

    const result = await attendanceRepository.reviewCorrectionRequest({
      correctionId,
      status: upperStatus,
      reviewRemarks,
      reviewedByUserId: userId
    });

    notificationService.notify({
      userId: correction.requestedByUserId,
      title: `Correction Voucher ${upperStatus}`,
      message: `Attendance correction request #${correctionId} was ${upperStatus.toLowerCase()} by administration. Remarks: ${reviewRemarks || 'No remarks provided'}.`,
      type: 'Correction Request',
      targetRole: 'TEACHER',
      relatedRecordId: correctionId,
      relatedRecordType: 'AttendanceCorrection',
      priority: 'Medium'
    });

    return result;
  },

  async getAttendanceStats(filters) {
    return await attendanceRepository.getAttendanceStats(filters);
  },

  /** A teacher sees only their own lessons' submission logs; staff see all. */
  async getTeacherSubmissions(user) {
    if (user.role === 'TEACHER') {
      const teacher = await db('teachers').where({ user_id: user.id }).first();
      if (!teacher) return [];
      return await attendanceRepository.getTeacherSubmissions({ teacherId: teacher.id, limit: 200 });
    }
    return await attendanceRepository.getTeacherSubmissions({ limit: 200 });
  }
};
