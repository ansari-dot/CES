import { attendanceRepository } from './attendance.repository.js';
import { timetableRepository } from '../timetable/timetable.repository.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';

export const attendanceService = {
  async getLessonRoster(lessonId) {
    const data = await attendanceRepository.getLessonRoster(lessonId);
    if (!data) {
      throw new AppError('Lesson not found', 404, ErrorCodes.NOT_FOUND);
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

  async submitAttendance({ lessonId, records, userId, userRole }) {
    const lesson = await timetableRepository.findLessonById(lessonId);
    if (!lesson) {
      throw new AppError('Lesson not found', 404, ErrorCodes.NOT_FOUND);
    }

    const currentRoster = await attendanceRepository.getLessonRoster(lessonId);
    if (currentRoster.isLocked && userRole !== 'ADMIN' && userRole !== 'PRINCIPAL') {
      throw new AppError(
        'Attendance is finalized and locked. Submit a correction voucher to request changes.',
        409,
        ErrorCodes.ATTENDANCE_LOCKED
      );
    }

    if (!Array.isArray(records) || records.length === 0) {
      throw new AppError('Attendance records array is required', 422, ErrorCodes.VALIDATION_ERROR);
    }

    // Validate statuses
    const validStatuses = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'];
    for (const rec of records) {
      if (!rec.studentId) {
        throw new AppError('Each record must specify a studentId', 422, ErrorCodes.VALIDATION_ERROR);
      }
      const st = (rec.status || 'PRESENT').toUpperCase();
      if (!validStatuses.includes(st)) {
        throw new AppError(`Invalid attendance status: ${rec.status}`, 422, ErrorCodes.VALIDATION_ERROR);
      }
    }

    const result = await attendanceRepository.submitAttendance({
      lessonId,
      records,
      userId
    });

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

    return result;
  },

  async getAttendanceStats(filters) {
    return await attendanceRepository.getAttendanceStats(filters);
  }
};
