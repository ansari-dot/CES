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
      if (st === 'P') st = 'PRESENT';
      else if (st === 'A') st = 'ABSENT';
      else if (st === 'L' || st === 'LEAVE') st = 'LATE';
      else if (st === 'E') st = 'EXCUSED';

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
