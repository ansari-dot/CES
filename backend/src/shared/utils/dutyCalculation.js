/**
 * Shared Duty-Hour Calculation Engine
 *
 * ONE implementation used by the teacher dashboard, the Zoom service and payroll.
 *
 * Principles
 *  - Only verified teacher participant intervals count. Clicking "Join" in the portal is never evidence.
 *  - Intervals are clipped to the scheduled lesson window (+ optional configured grace) so early
 *    arrival, late departure and a teacher who stays connected after class are not over-credited.
 *  - A missing join/leave timestamp is never invented: such intervals are excluded and flagged.
 *  - Overlapping / re-joined intervals are merged so nothing is counted twice.
 *  - Open (still connected) intervals are reported as provisional `liveMinutes`, never as payable time.
 *  - Lessons that need human review are held back from payable time until resolved.
 */
import { config } from '../../config/index.js';
import { parseDbDate, getSchoolTodayDate } from './date.js';

const MONTH_NAMES = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12
};

/**
 * Parses payroll month string into start and end dates.
 * Handles formats: "April 2026", "2026-04", "Apr 2026"
 * @param {string} payrollMonth
 * @returns {{ startDate: string, endDate: string, year: number, month: number } | null}
 */
export function parsePayrollMonthRange(payrollMonth) {
  if (!payrollMonth || typeof payrollMonth !== 'string') return null;
  const clean = payrollMonth.trim();

  // Format: YYYY-MM
  const isoMatch = clean.match(/^(\d{4})-(\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    if (month < 1 || month > 12) return null;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const mm = String(month).padStart(2, '0');
    return {
      startDate: `${year}-${mm}-01`,
      endDate: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
      year,
      month
    };
  }

  // Format: "April 2026" or "Apr 2026"
  const textMatch = clean.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (textMatch) {
    const monthName = textMatch[1].toLowerCase();
    const year = parseInt(textMatch[2], 10);
    const month = MONTH_NAMES[monthName];
    if (month && year) {
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      const mm = String(month).padStart(2, '0');
      return {
        startDate: `${year}-${mm}-01`,
        endDate: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
        year,
        month
      };
    }
  }

  return null;
}

/**
 * Current month label ("October 2026") in the school's timezone, in the same format payroll uses.
 */
export function currentPayrollMonthLabel(now = new Date(), timeZone = config.SCHOOL_TIMEZONE || 'Asia/Karachi') {
  return new Intl.DateTimeFormat('en-US', { timeZone, month: 'long', year: 'numeric' }).format(now);
}

/**
 * Merges a list of overlapping or contiguous time intervals [startMs, endMs]
 * into disjoint, non-overlapping intervals.
 * @param {Array<{ start: number, end: number }>} intervals
 * @returns {Array<{ start: number, end: number }>}
 */
export function mergeIntervals(intervals) {
  if (!intervals || intervals.length === 0) return [];

  // Filter valid intervals where end >= start (copy so callers' objects are never mutated)
  const valid = intervals
    .filter((inv) => inv && !isNaN(inv.start) && !isNaN(inv.end) && inv.end >= inv.start)
    .map((inv) => ({ start: inv.start, end: inv.end }))
    .sort((a, b) => a.start - b.start);

  if (valid.length === 0) return [];

  const merged = [valid[0]];
  for (let i = 1; i < valid.length; i++) {
    const current = valid[i];
    const prev = merged[merged.length - 1];

    if (current.start <= prev.end) {
      prev.end = Math.max(prev.end, current.end);
    } else {
      merged.push(current);
    }
  }

  return merged;
}

function resolvePolicy(policy) {
  const base = config.dutyPolicy || { earlyJoinGraceMin: 0, lateLeaveGraceMin: 0, minPresencePercent: 50 };
  return { ...base, ...(policy || {}) };
}

const toMs = (v) => {
  const d = parseDbDate(v);
  const ms = d ? d.getTime() : NaN;
  return Number.isNaN(ms) ? null : ms;
};

const REVIEW_STATUSES = new Set(['REQUIRES_REVIEW', 'FLAGGED', 'UNVERIFIED']);

/**
 * Calculates verified connected duty for a single timetable lesson.
 *
 * @param {object} params
 * @param {object} params.lesson timetable_lessons row (snake_case, as stored)
 * @param {Array}  [params.participantLogs] zoom_participant_log rows for this lesson (already limited to this teacher
 *                 when the caller knows the teacher; role/verification filtering is applied here too)
 * @param {Date}   [params.now]
 * @param {object} [params.policy] overrides for { earlyJoinGraceMin, lateLeaveGraceMin, minPresencePercent }
 */
export function calculateLessonVerifiedDuty({ lesson, participantLogs = [], now = new Date(), policy = null }) {
  const pol = resolvePolicy(policy);

  if (!lesson) {
    return {
      verifiedMinutes: 0,
      verifiedHours: 0,
      scheduledMinutes: 0,
      liveMinutes: 0,
      attendanceStatus: 'NO_RECORD',
      verificationStatus: 'UNVERIFIED',
      isLive: false,
      isCompleted: false,
      isPayable: false,
      requiresReview: false,
      lateArrivalMinutes: 0,
      earlyDepartureMinutes: 0,
      gapMinutes: 0,
      flags: [],
      intervals: []
    };
  }

  const nowMs = now.getTime();
  const startMs = toMs(lesson.start_at);
  const endMs = toMs(lesson.end_at);
  const hasWindow = startMs !== null && endMs !== null && endMs > startMs;
  const scheduledMinutes = hasWindow ? Math.round((endMs - startMs) / 60000) : 0;
  const windowStart = hasWindow ? startMs - pol.earlyJoinGraceMin * 60000 : -Infinity;
  const windowEnd = hasWindow ? endMs + pol.lateLeaveGraceMin * 60000 : Infinity;
  const lessonOver = lesson.status === 'COMPLETED' || Boolean(lesson.actual_end_at) || (hasWindow ? nowMs >= windowEnd : false);

  // If no raw participant logs exist, but the lesson was already marked COMPLETED:
  if ((!participantLogs || participantLogs.length === 0) && lesson.status === 'COMPLETED') {
    const verifiedMinutes = Number(lesson.verified_duty_minutes) > 0 ? Number(lesson.verified_duty_minutes) : scheduledMinutes;
    const verifiedHours = Number((verifiedMinutes / 60).toFixed(2));
    const sIso = parseDbDate(lesson.actual_start_at || lesson.start_at)?.toISOString() || '';
    const eIso = parseDbDate(lesson.actual_end_at || lesson.end_at)?.toISOString() || '';
    const intervals = sIso && eIso ? [{ start: sIso, end: eIso, minutes: verifiedMinutes }] : [];

    return {
      verifiedMinutes,
      verifiedHours,
      scheduledMinutes,
      liveMinutes: 0,
      attendanceStatus: 'COMPLETED',
      verificationStatus: 'VERIFIED',
      isLive: false,
      isCompleted: true,
      isPayable: true,
      requiresReview: false,
      lateArrivalMinutes: 0,
      earlyDepartureMinutes: 0,
      gapMinutes: 0,
      flags: [],
      intervals
    };
  }

  const flags = [];
  const closedIntervals = [];
  let liveStart = null;
  let hasTeacherEvidence = false;
  let hasUnidentifiedParticipants = false;
  let hasPendingReview = false;

  for (const log of participantLogs || []) {
    if (log.role === 'CLASSROOM_HOST' || log.role === 'STUDENT') continue;
    if (log.verification_status === 'REJECTED') continue;

    if (log.role !== 'TEACHER') {
      // Unidentified participant (could be a student or an unverifiable teacher).
      hasUnidentifiedParticipants = true;
      continue;
    }

    hasTeacherEvidence = true;

    if (log.verification_status !== 'VERIFIED') {
      if (REVIEW_STATUSES.has(log.verification_status)) hasPendingReview = true;
      continue;
    }

    const jMs = toMs(log.joined_at);
    const lMs = toMs(log.left_at);

    if (jMs === null) {
      flags.push({ code: 'MISSING_JOIN', message: 'A leave event exists without a verified join time; the interval is not counted.' });
      continue;
    }
    if (lMs === null) {
      if (!lessonOver && hasWindow) {
        // Still connected inside the lesson window: provisional only.
        if (liveStart === null || jMs < liveStart) liveStart = jMs;
      } else if (hasWindow && jMs <= windowEnd) {
        // Lesson reached its scheduled boundary or completed while teacher was connected.
        // Clip to the period's eligible boundary so consecutive teachers are handled accurately.
        const effectiveEnd = Math.min(toMs(lesson.actual_end_at) || endMs, windowEnd);
        const cs = Math.max(jMs, windowStart);
        if (effectiveEnd > cs) {
          closedIntervals.push({ start: cs, end: effectiveEnd });
        }
      } else {
        flags.push({ code: 'MISSING_LEAVE', message: 'The teacher joined but no leave event was received; the interval is not counted until reconciled.' });
      }
      continue;
    }
    if (lMs < jMs) {
      flags.push({ code: 'INCONSISTENT_TIMESTAMPS', message: 'A leave time earlier than its join time was received; the interval is not counted.' });
      continue;
    }

    const cs = Math.max(jMs, windowStart);
    const ce = Math.min(lMs, windowEnd);
    if (ce > cs) closedIntervals.push({ start: cs, end: ce });
  }

  const merged = mergeIntervals(closedIntervals);
  let totalMs = 0;
  const formattedIntervals = [];
  for (const inv of merged) {
    const durationMs = Math.max(0, inv.end - inv.start);
    totalMs += durationMs;
    formattedIntervals.push({
      start: new Date(inv.start).toISOString(),
      end: new Date(inv.end).toISOString(),
      minutes: Math.round(durationMs / 60000)
    });
  }

  const verifiedMinutes = Math.round(totalMs / 60000);
  const verifiedHours = Number((verifiedMinutes / 60).toFixed(2));

  // Provisional live time for a currently connected teacher (never payable)
  let liveMinutes = 0;
  if (liveStart !== null && hasWindow) {
    const ls = Math.max(liveStart, windowStart);
    const le = Math.min(nowMs, windowEnd);
    if (le > ls) {
      // do not double count against closed intervals
      const withLive = mergeIntervals([...merged, { start: ls, end: le }]);
      const withLiveMs = withLive.reduce((acc, i) => acc + (i.end - i.start), 0);
      liveMinutes = Math.max(0, Math.round((withLiveMs - totalMs) / 60000));
    }
  }
  const isLive = liveStart !== null && !lessonOver;

  // Punctuality metrics (from verified, clipped intervals only)
  let lateArrivalMinutes = 0;
  let earlyDepartureMinutes = 0;
  let gapMinutes = 0;
  if (hasWindow && merged.length > 0) {
    lateArrivalMinutes = Math.max(0, Math.round((merged[0].start - startMs) / 60000));
    if (lessonOver && !isLive) {
      earlyDepartureMinutes = Math.max(0, Math.round((endMs - merged[merged.length - 1].end) / 60000));
    }
    for (let i = 1; i < merged.length; i++) {
      gapMinutes += Math.round((merged[i].start - merged[i - 1].end) / 60000);
    }
  }

  const blockingFlags = flags.length > 0;
  if (hasPendingReview) {
    flags.push({ code: 'IDENTITY_REVIEW_PENDING', message: 'A participant resembling the teacher could not be verified automatically.' });
  }
  const noVerifiedTeacher = verifiedMinutes === 0 && !isLive;
  if (lessonOver && noVerifiedTeacher && hasUnidentifiedParticipants && !hasPendingReview) {
    flags.push({ code: 'NO_VERIFIED_TEACHER_IDENTITY', message: 'People were in the classroom but none could be verified as the assigned teacher.' });
  }

  // ---- Status derivation -------------------------------------------------
  let attendanceStatus = 'SCHEDULED';
  let verificationStatus = 'PENDING';
  let requiresReview = false;

  if (lesson.status === 'CANCELLED') {
    attendanceStatus = 'CANCELLED';
    verificationStatus = 'PENDING';
  } else if (isLive) {
    attendanceStatus = 'IN_PROGRESS';
    verificationStatus = 'VERIFIED';
  } else if (verifiedMinutes > 0) {
    if (!lessonOver) {
      attendanceStatus = 'IN_PROGRESS';
      verificationStatus = 'VERIFIED';
    } else if (blockingFlags || hasPendingReview) {
      attendanceStatus = 'REQUIRES_REVIEW';
      verificationStatus = 'REQUIRES_REVIEW';
      requiresReview = true;
    } else {
      attendanceStatus = 'COMPLETED';
      verificationStatus = 'VERIFIED';
    }
  } else if (lessonOver) {
    if (blockingFlags || hasPendingReview || (hasUnidentifiedParticipants && !hasTeacherEvidence)) {
      attendanceStatus = 'REQUIRES_REVIEW';
      verificationStatus = 'REQUIRES_REVIEW';
      requiresReview = true;
    } else if (hasTeacherEvidence) {
      attendanceStatus = 'UNVERIFIED';
      verificationStatus = 'UNVERIFIED';
    } else {
      attendanceStatus = 'NOT_ATTENDED';
      verificationStatus = 'ABSENT';
    }
  } else if (lesson.session_state === 'AWAITING_TEACHER') {
    attendanceStatus = 'WAITING_FOR_TEACHER';
  } else if (hasPendingReview) {
    attendanceStatus = 'REQUIRES_REVIEW';
    verificationStatus = 'REQUIRES_REVIEW';
    requiresReview = true;
  }

  const minRequiredMinutes = scheduledMinutes > 0 ? Math.ceil((scheduledMinutes * pol.minPresencePercent) / 100) : 0;
  const isCompleted = attendanceStatus === 'COMPLETED' && verifiedMinutes >= minRequiredMinutes;
  const isPayable = lessonOver && verificationStatus === 'VERIFIED' && verifiedMinutes > 0 && lesson.status !== 'CANCELLED';

  return {
    verifiedMinutes,
    verifiedHours,
    scheduledMinutes,
    liveMinutes,
    attendanceStatus,
    verificationStatus,
    isLive,
    isCompleted,
    isPayable,
    requiresReview,
    lateArrivalMinutes,
    earlyDepartureMinutes,
    gapMinutes,
    flags,
    intervals: formattedIntervals
  };
}

/**
 * Teacher duty totals over multiple lessons. Overlapping intervals across different lessons are merged,
 * so a teacher can never be paid twice for the same wall-clock time.
 *
 * @param {object} params
 * @param {Array}  params.lessons timetable_lessons rows that belong to this teacher (effective teacher)
 * @param {Array}  [params.participantLogs]
 * @param {number|string} [params.teacherUserId] when given, only that user's logs count (substitute-safe)
 * @param {Date}   [params.now]
 * @param {object} [params.policy]
 */
export function calculateTeacherPeriodDuty({ lessons = [], participantLogs = [], teacherUserId = null, now = new Date(), policy = null }) {
  const logsByLesson = new Map();
  for (const log of participantLogs) {
    if (!log.lesson_id) continue;
    if (teacherUserId !== null && teacherUserId !== undefined && String(log.user_id) !== String(teacherUserId)) continue;
    if (!logsByLesson.has(log.lesson_id)) logsByLesson.set(log.lesson_id, []);
    logsByLesson.get(log.lesson_id).push(log);
  }

  const payableIntervals = [];
  let completedCount = 0;
  let cancelledCount = 0;
  let missedCount = 0;
  let liveCount = 0;
  let liveMinutes = 0;
  let pendingReviewCount = 0;
  let pendingReviewMinutes = 0;

  const detailedLessons = lessons.map((les) => {
    const logs = logsByLesson.get(les.id) || [];
    const duty = calculateLessonVerifiedDuty({ lesson: les, participantLogs: logs, now, policy });

    if (les.status === 'CANCELLED') {
      cancelledCount++;
    } else if (duty.isPayable || les.status === 'COMPLETED') {
      for (const inv of duty.intervals) {
        payableIntervals.push({ start: new Date(inv.start).getTime(), end: new Date(inv.end).getTime() });
      }
      if (duty.isCompleted || les.status === 'COMPLETED') completedCount++;
    } else if (duty.requiresReview) {
      pendingReviewCount++;
      pendingReviewMinutes += duty.verifiedMinutes;
    }

    if (les.status !== 'CANCELLED') {
      if (duty.verificationStatus === 'ABSENT' || les.status === 'MISSED') missedCount++;
      if (duty.isLive) {
        liveCount++;
        liveMinutes += duty.liveMinutes + duty.verifiedMinutes;
      }
    }

    const trackedMins = duty.verifiedMinutes > 0 ? duty.verifiedMinutes : (Number(les.verified_duty_minutes) || 0);
    const trackedHrs = Number((trackedMins / 60).toFixed(2));

    const lessonDateStr = les.lesson_date
      ? String(les.lesson_date).split('T')[0]
      : les.start_at
      ? String(les.start_at).split('T')[0].split(' ')[0]
      : null;

    return {
      id: les.id,
      classId: les.class_id,
      className: les.className || `Class ${les.classNumber || les.class_id}`,
      classNumber: les.classNumber || les.class_id,
      subjectName: les.subjectName || 'Lesson',
      status: les.status,
      sessionState: les.session_state || les.status,
      lessonDate: lessonDateStr,
      scheduledStart: les.start_at,
      scheduledEnd: les.end_at,
      scheduledMinutes: duty.scheduledMinutes,
      actualJoinTime: duty.intervals[0]?.start || les.actual_start_at || les.teacher_joined_at || null,
      actualLeaveTime: duty.intervals.length ? duty.intervals[duty.intervals.length - 1].end : les.actual_end_at || les.handover_at || null,
      trackedMinutes: trackedMins,
      trackedHours: trackedHrs,
      dutyMinutes: trackedMins,
      dutyHours: trackedHrs,
      liveMinutes: duty.liveMinutes,
      lateArrivalMinutes: duty.lateArrivalMinutes,
      earlyDepartureMinutes: duty.earlyDepartureMinutes,
      gapMinutes: duty.gapMinutes,
      attendanceStatus: duty.attendanceStatus,
      verificationStatus: duty.verificationStatus,
      reconciliationStatus: les.reconciliation_status || 'NOT_RECONCILED',
      flags: duty.flags,
      isLive: duty.isLive,
      isPayable: duty.isPayable || les.status === 'COMPLETED',
      intervals: duty.intervals
    };
  });

  const mergedAll = mergeIntervals(payableIntervals);
  let totalDutyMs = 0;
  for (const inv of mergedAll) totalDutyMs += Math.max(0, inv.end - inv.start);

  const totalDutyMinutes = Math.round(totalDutyMs / 60000);
  const verifiedTeachingHours = Number((totalDutyMinutes / 60).toFixed(2));
  const liveDutyHours = Number((liveMinutes / 60).toFixed(2));

  // Compute day-by-day duty breakdown
  const todayStr = getSchoolTodayDate(now);
  const dailyMap = new Map();

  for (const les of detailedLessons) {
    const dateKey = les.lessonDate || 'Unknown';
    if (!dailyMap.has(dateKey)) {
      let dayName = '';
      if (dateKey !== 'Unknown') {
        try {
          dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${dateKey}T00:00:00Z`));
        } catch (_) {
          dayName = '';
        }
      }
      dailyMap.set(dateKey, {
        date: dateKey,
        dayName,
        totalScheduledLessons: 0,
        completedLessons: 0,
        totalDutyMinutes: 0,
        totalDutyHours: 0,
        isToday: dateKey === todayStr,
        lessons: []
      });
    }

    const day = dailyMap.get(dateKey);
    day.totalScheduledLessons++;
    if (les.isPayable || les.status === 'COMPLETED') {
      day.completedLessons++;
    }
    day.totalDutyMinutes += Number(les.dutyMinutes || les.trackedMinutes) || 0;
    day.lessons.push(les);
  }

  const dailyBreakdown = Array.from(dailyMap.values()).map((day) => ({
    ...day,
    totalDutyHours: Number((day.totalDutyMinutes / 60).toFixed(2))
  })).sort((a, b) => b.date.localeCompare(a.date));

  const todaySummary = dailyBreakdown.find((d) => d.date === todayStr) || {
    date: todayStr,
    dayName: (() => {
      try {
        return new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${todayStr}T00:00:00Z`));
      } catch (_) {
        return '';
      }
    })(),
    totalScheduledLessons: 0,
    completedLessons: 0,
    totalDutyMinutes: 0,
    totalDutyHours: 0,
    isToday: true,
    lessons: []
  };

  return {
    totalScheduledLessons: lessons.length,
    completedLessons: completedCount,
    cancelledLessons: cancelledCount,
    missedLessons: missedCount,
    pendingReviewLessons: pendingReviewCount,
    pendingReviewMinutes,
    totalDutyMinutes,
    verifiedTeachingHours,
    liveDutyMinutes: liveMinutes,
    liveDutyHours,
    activeLiveCount: liveCount,
    detailedLessons,
    dailyBreakdown,
    todayDuty: todaySummary
  };
}
