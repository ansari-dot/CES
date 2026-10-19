import { timetableRepository } from './timetable.repository.js';
import { zoomRepository } from '../zoom/zoom.repository.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';

export const timetableService = {
  async getSlots(filter = {}) {
    return await timetableRepository.getSlots(filter);
  },

  async createSlot({
    sessionId,
    classId,
    subjectId,
    teacherId,
    weekday,
    startTime,
    endTime,
    effectiveFrom,
    effectiveTo = null,
    status = 'PUBLISHED',
    createdBy
  }) {
    // 1. Conflict check: no class overlap, no teacher double-booking
    const conflict = await timetableRepository.checkSlotConflict({
      classId,
      teacherId,
      weekday,
      startTime,
      endTime
    });

    if (conflict) {
      const message =
        conflict.type === 'CLASS_CONFLICT'
          ? 'Class already has another subject scheduled during this period.'
          : 'Teacher already has another class assigned during this period.';
      throw new AppError(message, 409, ErrorCodes.SCHEDULE_CONFLICT, [
        { field: 'timeRange', issue: message }
      ]);
    }

    const slotId = await timetableRepository.createSlot({
      session_id: sessionId,
      class_id: classId,
      subject_id: subjectId,
      teacher_id: teacherId,
      weekday,
      start_time: startTime,
      end_time: endTime,
      effective_from: effectiveFrom || new Date().toISOString().split('T')[0],
      effective_to: effectiveTo,
      status,
      created_by: createdBy
    });

    await timetableRepository.logChange({
      slotId,
      changeType: 'CREATED',
      newValues: { classId, subjectId, teacherId, weekday, startTime, endTime },
      reason: 'Slot created',
      changedBy: createdBy
    });

    return await timetableRepository.findSlotById(slotId);
  },

  async getLessons(filter = {}) {
    return await timetableRepository.getLessons(filter);
  },

  async getLessonById(id) {
    const lesson = await timetableRepository.findLessonById(id);
    if (!lesson) {
      throw new AppError('Lesson not found', 404, ErrorCodes.NOT_FOUND);
    }
    return lesson;
  },

  async publishTimetable({ sessionId, days = 14, createdBy }) {
    const slots = await timetableRepository.getSlots({ sessionId });
    const generatedLessons = [];

    const now = new Date();
    for (let dayOffset = 0; dayOffset < days; dayOffset++) {
      const targetDate = new Date(now.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      // JS getDay(): 0=Sun, 1=Mon ... 6=Sat. SRS convention: 1=Mon .. 7=Sun
      const jsDay = targetDate.getDay();
      const srsWeekday = jsDay === 0 ? 7 : jsDay;
      const dateString = targetDate.toISOString().split('T')[0];

      const matchingSlots = slots.filter((s) => s.weekday === srsWeekday && s.status === 'PUBLISHED');

      for (const slot of matchingSlots) {
        // Find active class zoom meeting
        const classMeeting = await zoomRepository.getMeetingByClassId(slot.classId);

        const startIso = slot.startTime.length === 5 ? `${slot.startTime}:00` : slot.startTime;
        const endIso = slot.endTime.length === 5 ? `${slot.endTime}:00` : slot.endTime;
        const startAt = new Date(`${dateString}T${startIso}Z`);
        const endAt = new Date(`${dateString}T${endIso}Z`);

        try {
          const lessonId = await timetableRepository.createLesson({
            slot_id: slot.id,
            class_id: slot.classId,
            subject_id: slot.subjectId,
            teacher_id: slot.teacherId,
            zoom_meeting_id: classMeeting ? classMeeting.id : null,
            lesson_date: dateString,
            start_at: startAt,
            end_at: endAt,
            status: 'SCHEDULED'
          });
          generatedLessons.push(lessonId);
        } catch {
          // Ignore unique duplicate constraint (uq_slot_date) if already generated
        }
      }
    }

    await timetableRepository.logChange({
      changeType: 'PUBLISHED',
      newValues: { sessionId, days, generatedCount: generatedLessons.length },
      reason: 'Published timetable and generated rolling window lessons',
      changedBy: createdBy
    });

    return {
      message: `Generated ${generatedLessons.length} lessons for ${days} days rolling window`,
      count: generatedLessons.length
    };
  },

  async cancelLesson({ lessonId, reason, userId }) {
    const lesson = await timetableRepository.findLessonById(lessonId);
    if (!lesson) throw new AppError('Lesson not found', 404, ErrorCodes.NOT_FOUND);

    await timetableRepository.updateLesson(lessonId, {
      status: 'CANCELLED',
      cancel_reason: reason || 'Cancelled by administration'
    });

    await timetableRepository.logChange({
      lessonId,
      changeType: 'CANCELLED',
      oldValues: { status: lesson.status },
      newValues: { status: 'CANCELLED', cancel_reason: reason },
      reason,
      changedBy: userId
    });

    return { lessonId, status: 'CANCELLED' };
  },

  async substituteTeacher({ lessonId, substituteTeacherId, reason, userId }) {
    const lesson = await timetableRepository.findLessonById(lessonId);
    if (!lesson) throw new AppError('Lesson not found', 404, ErrorCodes.NOT_FOUND);

    await timetableRepository.updateLesson(lessonId, {
      substitute_teacher_id: substituteTeacherId
    });

    await timetableRepository.logChange({
      lessonId,
      changeType: 'SUBSTITUTED',
      oldValues: { teacher_id: lesson.teacher_id, substitute_teacher_id: lesson.substitute_teacher_id },
      newValues: { substitute_teacher_id: substituteTeacherId },
      reason: reason || 'Substitute teacher assigned',
      changedBy: userId
    });

    return { lessonId, substituteTeacherId };
  }
};
