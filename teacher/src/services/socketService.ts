import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let currentTeacherId: string | number | null = null;
let currentUserId: string | number | null = null;

export const RealtimeEvents = {
  CLASS_STATUS_UPDATED: 'class.status.updated',
  CLASS_PERIOD_ACTIVATED: 'class.period.activated',
  TEACHER_DUTY_UPDATED: 'teacher.duty.updated',
  TEACHER_ATTENDANCE_UPDATED: 'teacher.attendance.updated',
  STUDENT_ATTENDANCE_UPDATED: 'student.attendance.updated',
  NOTIFICATION_CREATED: 'notification.created',
  PAYROLL_SUMMARY_UPDATED: 'payroll.summary.updated',
  TIMETABLE_CHANGE: 'timetable.changed'
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
      if (currentTeacherId) {
        identifyTeacher(currentTeacherId, currentUserId || undefined);
      }
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });
  }
  return socket;
}

export function identifyTeacher(teacherId: number | string, userId?: number | string) {
  currentTeacherId = teacherId;
  if (userId) currentUserId = userId;
  const s = getSocket();
  const tid = typeof teacherId === 'string' ? Number(teacherId.replace(/\D/g, '')) : teacherId;
  s.emit('identify', { teacherId: tid, userId: currentUserId, role: 'TEACHER' });
  if (tid) {
    s.emit('join:teacher', { teacherId: tid });
  }
}

export function subscribeToClass(classId: number | string) {
  const s = getSocket();
  s.emit('join:class', { classId: Number(classId) });
}

export function unsubscribeFromClass(classId: number | string) {
  const s = getSocket();
  s.emit('leave:class', { classId: Number(classId) });
}

export function joinChatThread(threadId: number | string) {
  const s = getSocket();
  s.emit('chat:join', { threadId: Number(threadId) });
}

export function leaveChatThread(threadId: number | string) {
  const s = getSocket();
  s.emit('chat:leave', { threadId: Number(threadId) });
}

export function sendChatTyping(threadId: number | string, isTyping: boolean) {
  const s = getSocket();
  s.emit('chat:typing', { threadId: Number(threadId), isTyping });
}

