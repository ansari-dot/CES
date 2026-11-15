/**
 * Utility to determine if a scheduled class or lesson is currently active (unlocked)
 * or locked until scheduled class time.
 *
 * Rules:
 * - A class is UNLOCKED if:
 *   1. It is currently LIVE (status === 'live').
 *   2. The current time is within `preBufferMinutes` (default 5 mins) before the scheduled start time,
 *      through `postBufferMinutes` (default 15 mins) after the scheduled end time.
 * - Otherwise, it is LOCKED.
 */

export interface ClassTimeItem {
  startTime?: string;
  endTime?: string;
  timeSlot?: string;
  date?: string;
  lessonDate?: string;
  dayOfWeek?: string;
  status?: string;
  startAt?: string;
  endAt?: string;
}

export function isClassTimeActive(
  item: ClassTimeItem | null | undefined,
  preBufferMinutes: number = 5,
  postBufferMinutes: number = 15
): boolean {
  if (!item) return false;
  if (item.status === 'live') return true;
  if (item.status === 'completed' || item.status === 'cancelled') return false;

  const now = new Date();

  // 1. If ISO UTC startAt / endAt exist
  if (item.startAt) {
    const startMs = new Date(item.startAt).getTime();
    const endMs = item.endAt ? new Date(item.endAt).getTime() : startMs + 45 * 60 * 1000;
    if (!isNaN(startMs)) {
      const allowedStartMs = startMs - preBufferMinutes * 60 * 1000;
      const allowedEndMs = endMs + postBufferMinutes * 60 * 1000;
      const nowMs = now.getTime();
      return nowMs >= allowedStartMs && nowMs <= allowedEndMs;
    }
  }

  // 2. Parse time strings
  let startStr = item.startTime || '';
  let endStr = item.endTime || '';

  if (!startStr && item.timeSlot && item.timeSlot.includes('-')) {
    const parts = item.timeSlot.split('-');
    startStr = parts[0].trim();
    endStr = parts[1].trim();
  }

  if (!startStr) return false;

  const parseToMinutes = (str: string): number | null => {
    const match = str.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?$/i);
    if (!match) return null;
    let h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const ampm = match[4] ? match[4].toUpperCase() : null;
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  };

  const startMin = parseToMinutes(startStr);
  if (startMin === null) return false;
  const endMin = endStr ? (parseToMinutes(endStr) ?? (startMin + 45)) : startMin + 45;

  // Check date if provided
  const lessonDate = item.date || item.lessonDate;
  if (lessonDate && typeof lessonDate === 'string' && lessonDate.includes('-')) {
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (lessonDate !== todayStr) {
      return false; // Not scheduled for today
    }
  }

  const currentMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const allowedStartMin = startMin - preBufferMinutes;
  const allowedEndMin = endMin + postBufferMinutes;

  return currentMin >= allowedStartMin && currentMin <= allowedEndMin;
}

