import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
let currentStudentId: number | string | null = null;
let currentUserId: number | string | null = null;
let currentClassId: number | string | null = null;
let currentActiveThreadId: number | string | null = null;

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
      reconnectionAttempts: 25,
      reconnectionDelay: 1000
    });

    socket.on('connect', () => {
      if (currentStudentId || currentUserId) {
        identifyStudent(currentStudentId || undefined, currentUserId || undefined, currentClassId || undefined);
      }
      if (currentActiveThreadId) {
        joinChatThread(currentActiveThreadId);
      }
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });
  }
  return socket;
}

export function identifyStudent(studentId?: number | string, userId?: number | string, classId?: number | string) {
  if (studentId !== undefined) currentStudentId = studentId;
  if (userId !== undefined) currentUserId = userId;
  if (classId !== undefined) currentClassId = classId;

  const s = getSocket();
  const sid = typeof currentStudentId === 'string' ? Number(currentStudentId.replace(/\D/g, '')) : currentStudentId;
  const uid = typeof currentUserId === 'string' ? Number(currentUserId) : currentUserId;
  const cid = typeof currentClassId === 'string' ? Number(currentClassId) : currentClassId;

  s.emit('identify', {
    studentId: sid,
    userId: uid,
    classId: cid,
    role: 'STUDENT'
  });
}

export function subscribeToClass(classId: number | string) {
  currentClassId = classId;
  const s = getSocket();
  s.emit('join:class', { classId: Number(classId) });
}

export function unsubscribeFromClass(classId: number | string) {
  const s = getSocket();
  s.emit('leave:class', { classId: Number(classId) });
}

export function joinChatThread(threadId: number | string) {
  currentActiveThreadId = threadId;
  const s = getSocket();
  s.emit('chat:join', { threadId: Number(threadId), userId: currentUserId });
}

export function leaveChatThread(threadId: number | string) {
  if (currentActiveThreadId === threadId) currentActiveThreadId = null;
  const s = getSocket();
  s.emit('chat:leave', { threadId: Number(threadId) });
}

export function sendChatTyping(threadId: number | string, isTyping: boolean) {
  const s = getSocket();
  s.emit('chat:typing', { threadId: Number(threadId), isTyping });
}
