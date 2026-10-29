import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { getSocket, RealtimeEvents, subscribeToClass } from '../services/socketService';
import { fetchTeacherLessonsThunk, updateLessonRealtimeStatus } from '../store/slices/timetableSlice';
import { fetchSchoolTimetable } from '../store/slices/schoolTimetableSlice';
import { fetchDutySummaryThunk } from '../store/slices/dutySlice';
import { fetchTeacherNotificationsThunk, addToast, addNotification } from '../store/slices/uiSlice';
import { fetchNoticesThunk } from '../store/slices/noticesSlice';

/**
 * Global Real-Time WebSocket Synchronization Hook for Teacher Portal.
 * Handles instant class status updates, live lesson link activations,
 * timetable updates, notices, and duty/attendance updates in real-time.
 */
export function useTeacherRealtime() {
  const dispatch = useAppDispatch();
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const teacher = useAppSelector((state) => state.auth.teacher);
  const assignedClasses = teacher?.assignedClasses || [];

  useEffect(() => {
    if (!isAuthenticated) return;

    const socket = getSocket();

    // 1. Join room for each assigned class to receive targeted class events
    assignedClasses.forEach((cls) => {
      if (cls && cls.id) {
        subscribeToClass(cls.id);
      }
    });

    // 2. Class Status Updated (e.g. SCHEDULED -> LIVE -> COMPLETED / CANCELLED)
    const onClassStatusUpdated = (data: any) => {
      if (data?.lessonId && data?.status) {
        dispatch(
          updateLessonRealtimeStatus({
            lessonId: data.lessonId,
            status: data.status,
            sessionState: data.sessionState || data.status,
            actualStartTime: data.actualStartTime,
            actualEndTime: data.actualEndTime,
            joinUrl: data.joinUrl
          })
        );
      }

      // Re-fetch all relevant academic states
      dispatch(fetchTeacherLessonsThunk());
      dispatch(fetchSchoolTimetable());
      if (teacher?.id) {
        dispatch(fetchDutySummaryThunk(teacher.id));
      }

      // Actionable real-time banner/toast notification
      if (data?.status === 'LIVE') {
        const className = data.className || `Class ${data.classId || ''}`;
        const subject = data.subjectName ? `(${data.subjectName})` : '';
        dispatch(
          addToast({
            title: '🔴 CLASS SESSION LIVE',
            message: `${className} ${subject} is now active and LIVE. Click Live Lessons to join.`,
            type: 'success'
          })
        );
      } else if (data?.status === 'COMPLETED') {
        const className = data.className || `Class ${data.classId || ''}`;
        dispatch(
          addToast({
            title: 'Class Session Concluded',
            message: `${className} session marked completed and duty minutes logged.`,
            type: 'info'
          })
        );
      } else if (data?.status === 'CANCELLED') {
        const className = data.className || `Class ${data.classId || ''}`;
        dispatch(
          addToast({
            title: 'Class Cancelled',
            message: `${className} session was cancelled by administration.`,
            type: 'info'
          })
        );
      }
    };

    // 3. Class Period Activated (pre-session countdown or room activation)
    const onClassPeriodActivated = (data: any) => {
      dispatch(fetchTeacherLessonsThunk());
      dispatch(fetchSchoolTimetable());
      const className = data.className || `Class ${data.classId || ''}`;
      dispatch(
        addToast({
          title: 'Class Period Ready',
          message: `${className} period activated. Persistent Zoom room is ready for launch.`,
          type: 'info'
        })
      );
    };

    // 4. Timetable / Schedule Changes (slots created, updated, or published)
    const onTimetableChanged = () => {
      dispatch(fetchTeacherLessonsThunk());
      dispatch(fetchSchoolTimetable());
      dispatch(
        addToast({
          title: 'Schedule Updated',
          message: 'Timetable slots and scheduled lessons updated in real-time.',
          type: 'info'
        })
      );
    };

    // 5. Notifications Created (administrative announcements, urgent notices)
    const onNotificationCreated = (data: any) => {
      dispatch(fetchTeacherNotificationsThunk());
      dispatch(fetchNoticesThunk());
      if (data?.title) {
        dispatch(
          addToast({
            title: data.title,
            message: data.message || 'New institutional notification received.',
            type: 'info'
          })
        );
        dispatch(
          addNotification({
            id: String(data.id || Date.now()),
            title: data.title,
            message: data.message || '',
            type: 'administrative',
            timestamp: 'Just now',
            read: false,
            targetTab: 'dashboard'
          })
        );
      }
    };

    // 6. Duty, Attendance & Payroll Real-time Sync
    const onTeacherDutyUpdated = () => {
      dispatch(fetchTeacherLessonsThunk());
      if (teacher?.id) dispatch(fetchDutySummaryThunk(teacher.id));
    };

    const onTeacherAttendanceUpdated = () => {
      dispatch(fetchTeacherLessonsThunk());
      if (teacher?.id) dispatch(fetchDutySummaryThunk(teacher.id));
    };

    const onPayrollUpdated = () => {
      if (teacher?.id) dispatch(fetchDutySummaryThunk(teacher.id));
    };

    socket.on(RealtimeEvents.CLASS_STATUS_UPDATED, onClassStatusUpdated);
    socket.on(RealtimeEvents.CLASS_PERIOD_ACTIVATED, onClassPeriodActivated);
    socket.on(RealtimeEvents.TIMETABLE_CHANGE, onTimetableChanged);
    socket.on(RealtimeEvents.NOTIFICATION_CREATED, onNotificationCreated);
    socket.on(RealtimeEvents.TEACHER_DUTY_UPDATED, onTeacherDutyUpdated);
    socket.on(RealtimeEvents.TEACHER_ATTENDANCE_UPDATED, onTeacherAttendanceUpdated);
    socket.on(RealtimeEvents.PAYROLL_SUMMARY_UPDATED, onPayrollUpdated);

    return () => {
      socket.off(RealtimeEvents.CLASS_STATUS_UPDATED, onClassStatusUpdated);
      socket.off(RealtimeEvents.CLASS_PERIOD_ACTIVATED, onClassPeriodActivated);
      socket.off(RealtimeEvents.TIMETABLE_CHANGE, onTimetableChanged);
      socket.off(RealtimeEvents.NOTIFICATION_CREATED, onNotificationCreated);
      socket.off(RealtimeEvents.TEACHER_DUTY_UPDATED, onTeacherDutyUpdated);
      socket.off(RealtimeEvents.TEACHER_ATTENDANCE_UPDATED, onTeacherAttendanceUpdated);
      socket.off(RealtimeEvents.PAYROLL_SUMMARY_UPDATED, onPayrollUpdated);
    };
  }, [isAuthenticated, teacher?.id, assignedClasses, dispatch]);
}
