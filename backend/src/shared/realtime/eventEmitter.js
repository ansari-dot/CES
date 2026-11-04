import { getIo } from './socket.js';
import { enqueueRealtimeEvent } from '../queue/queueManager.js';

/**
 * Standard Real-Time Event Names
 */
export const RealtimeEvents = {
  CLASS_STATUS_UPDATED: 'class.status.updated',
  CLASS_PERIOD_ACTIVATED: 'class.period.activated',
  TEACHER_DUTY_UPDATED: 'teacher.duty.updated',
  TEACHER_ATTENDANCE_UPDATED: 'teacher.attendance.updated',
  STUDENT_ATTENDANCE_UPDATED: 'student.attendance.updated',
  NOTIFICATION_CREATED: 'notification.created',
  PAYROLL_SUMMARY_UPDATED: 'payroll.summary.updated',
  TIMETABLE_CHANGE: 'timetable.changed'
};

/**
 * Low-level Socket.IO dispatcher that delivers messages directly to connected WebSocket clients.
 * Invoked either immediately (fallback / test mode) or by the BullMQ background worker.
 *
 * @param {string} event - One of RealtimeEvents
 * @param {object} payload - Structured event payload
 * @param {object} [options]
 * @param {string[]} [options.rooms] - Specific room names (e.g. ['class:1', 'role:PRINCIPAL'])
 * @param {number|number[]} [options.classIds] - Target class IDs
 * @param {number|number[]} [options.teacherIds] - Target teacher IDs
 * @param {number|number[]} [options.userIds] - Target user IDs
 * @param {string|string[]} [options.roles] - Target role names
 */
export function dispatchSocketEvent(event, payload, options = {}) {
  try {
    const io = getIo();
    if (!io) return;

    const data = {
      ...payload,
      _event: event,
      _timestamp: new Date().toISOString()
    };

    const targetRooms = new Set(options.rooms || []);

    if (options.classIds) {
      const cids = Array.isArray(options.classIds) ? options.classIds : [options.classIds];
      cids.forEach((id) => targetRooms.add(`class:${id}`));
    }

    if (options.teacherIds) {
      const tids = Array.isArray(options.teacherIds) ? options.teacherIds : [options.teacherIds];
      tids.forEach((id) => targetRooms.add(`teacher:${id}`));
    }

    if (options.userIds) {
      const uids = Array.isArray(options.userIds) ? options.userIds : [options.userIds];
      uids.forEach((id) => targetRooms.add(`user:${id}`));
    }

    if (options.roles) {
      const rls = Array.isArray(options.roles) ? options.roles : [options.roles];
      rls.forEach((r) => targetRooms.add(`role:${r.toUpperCase()}`));
    }

    // Always notify PRINCIPAL and ADMIN rooms for operational transparency
    targetRooms.add('role:PRINCIPAL');
    targetRooms.add('role:ADMIN');

    if (targetRooms.size > 0) {
      io.to(Array.from(targetRooms)).emit(event, data);
    } else {
      io.emit(event, data);
    }
  } catch (err) {
    // Non-blocking: socket delivery errors never fail database operations
    console.warn(`[RealtimeEventEmitter] Failed to emit event ${event}:`, err.message);
  }
}

/**
 * Authoritative event dispatcher for the application.
 * Routes the event to BullMQ Queue when Redis is running, ensuring asynchronous,
 * reliable, and scalable event processing without blocking database transactions.
 * Safely falls back to immediate synchronous dispatch when queue is inactive or during tests.
 *
 * @param {string} event - One of RealtimeEvents
 * @param {object} payload - Structured event payload
 * @param {object} [options]
 */
export function emitRealtimeEvent(event, payload, options = {}) {
  try {
    enqueueRealtimeEvent(event, payload, options);
  } catch (err) {
    dispatchSocketEvent(event, payload, options);
  }
}
