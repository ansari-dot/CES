import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export const RealtimeEvents = {
  CLASS_STATUS_UPDATED: 'class.status.updated',
  CLASS_PERIOD_ACTIVATED: 'class.period.activated',
  TEACHER_DUTY_UPDATED: 'teacher.duty.updated',
  TEACHER_ATTENDANCE_UPDATED: 'teacher.attendance.updated',
  STUDENT_ATTENDANCE_UPDATED: 'student.attendance.updated',
  NOTIFICATION_CREATED: 'notification.created',
  PAYROLL_SUMMARY_UPDATED: 'payroll.summary.updated'
} as const;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      // Re-joined rooms handled on reconnect
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });
  }
  return socket;
}

export function subscribeToClass(classId: number | string) {
  const s = getSocket();
  s.emit('join:class', { classId: Number(classId) });
}

export function unsubscribeFromClass(classId: number | string) {
  const s = getSocket();
  s.emit('leave:class', { classId: Number(classId) });
}
