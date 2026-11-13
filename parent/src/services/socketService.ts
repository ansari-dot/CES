import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

/**
 * Parent portal real-time connection. Authentication uses the same HttpOnly session
 * cookie as the REST API; the server places the socket in the parent's personal
 * `user:<id>` room, so only notifications addressed to this parent are delivered.
 */
let socket: Socket | null = null;

export const RealtimeEvents = {
  NOTIFICATION_CREATED: 'notification.created',
  CALENDAR_UPDATED: 'calendar.updated',
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
    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/** Subscribe a component to a socket event for its lifetime. */
export function useSocketEvent<T = any>(eventName: string, handler: (data: T) => void, enabled = true) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const s = getSocket();
    const listener = (data: T) => handlerRef.current?.(data);
    s.on(eventName, listener);
    return () => {
      s.off(eventName, listener);
    };
  }, [eventName, enabled]);
}
