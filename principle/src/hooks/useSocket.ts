import { useEffect, useRef } from 'react';
import { getSocket, subscribeToClass, unsubscribeFromClass } from '../services/socketService';

export function useSocketEvent<T = any>(eventName: string, handler: (data: T) => void) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const socket = getSocket();
    const listener = (data: T) => {
      if (handlerRef.current) {
        handlerRef.current(data);
      }
    };

    socket.on(eventName, listener);

    return () => {
      socket.off(eventName, listener);
    };
  }, [eventName]);
}

export function useClassRoomSubscription(classId: number | string | null | undefined) {
  useEffect(() => {
    if (!classId) return;
    subscribeToClass(classId);
    return () => {
      unsubscribeFromClass(classId);
    };
  }, [classId]);
}
