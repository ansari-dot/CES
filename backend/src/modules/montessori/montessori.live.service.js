/**
 * Montessori Live Classes: scheduled Zoom classes for a KG section.
 *
 * These are separate records from regular live classes (timetable lessons on the permanent
 * per-class Zoom rooms) but use the same Zoom account through the shared zoomApiClient.
 *
 * Access (enforced here, never trusted from the client):
 *  - Principal / Admin: create, edit, cancel, list everything.
 *  - Teacher: classes of sections where they hold an ACTIVE Montessori assignment.
 *  - Student: classes of the section they are CURRENTLY allocated to.
 *  - Parent: the same, for linked children only.
 * Students and parents receive the join link only inside the join window (the regular
 * live-class convention). Host credentials are never stored or returned.
 */
import { z } from 'zod';
import { db } from '../../shared/db/knex.js';
import { config } from '../../config/index.js';
import { AppError } from '../../shared/errors/AppError.js';
import { ErrorCodes } from '../../shared/errors/errorCodes.js';
import { zoomApiClient } from '../../shared/services/zoomApiClient.js';
import { parseDbDate } from '../../shared/utils/date.js';
import { wallClockToUtc } from '../timetable/timetable.service.js';
import { auditRepository } from '../audit/audit.repository.js';
import { invalid, conflict, notFound, forbidden, parseZod, teacherSectionIds, assertParentLink } from './montessori.access.js';

// Same window the regular student live-class endpoint uses
const JOIN_OPENS_BEFORE_MS = 10 * 60 * 1000;
const JOIN_CLOSES_AFTER_MS = 15 * 60 * 1000;
const MIN_DURATION_MIN = 5;
const MAX_DURATION_MIN = 8 * 60;
const ZOOM_HOSTS = ['zoom.us', 'zoom.com', 'zoomgov.com'];

const schoolTz = () => config.SCHOOL_TIMEZONE || 'Asia/Karachi';
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Times must be HH:MM (24-hour).');

const liveSchema = z.object({
  sectionId: z.coerce.number().int().positive('Select a Montessori section.'),
  teacherId: z.coerce.number().int().positive('Select the Montessori teacher.'),
  title: z.string().trim().min(3, 'Enter a class title (at least 3 characters).').max(150),
  description: z.string().trim().max(2000).optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Select a valid class date.'),
  startTime: time,
  endTime: time,
  meetingMode: z.enum(['MANUAL', 'ZOOM_API']).default('MANUAL'),
  joinUrl: z.string().trim().max(1000).optional().nullable(),
  passcode: z.string().trim().max(50).optional().nullable()
});

function validZoomUrl(raw) {
  try {
    const u = new URL(String(raw || ''));
    const host = u.hostname.toLowerCase();
    return u.protocol === 'https:' && ZOOM_HOSTS.some((d) => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

/** Validates the schedule and returns the UTC instants for a school wall-clock date/time. */
function resolveSchedule(v) {
  const probe = new Date(`${v.date}T00:00:00Z`);
  if (Number.isNaN(probe.getTime()) || probe.toISOString().slice(0, 10) !== v.date) throw invalid('Select a valid class date.');
  const startAt = new Date(wallClockToUtc(v.date, v.startTime, schoolTz()));
  const endAt = new Date(wallClockToUtc(v.date, v.endTime, schoolTz()));
  const minutes = Math.round((endAt - startAt) / 60000);
  if (minutes <= 0) throw invalid('End time must be after the start time.');
  if (minutes < MIN_DURATION_MIN) throw invalid(`A live class must be at least ${MIN_DURATION_MIN} minutes long.`);
  if (minutes > MAX_DURATION_MIN) throw invalid('A live class cannot be longer than 8 hours.');
  return { startAt, endAt, minutes };
}

/** The section must be active and the teacher must hold an active assignment on it. */
async function loadSectionAndTeacher(sectionId, teacherId) {
  const section = await db('montessori_sections').where({ id: sectionId }).first();
  if (!section) throw notFound('Montessori section not found.');
  if (!section.is_active) throw invalid('This Montessori section is inactive.');
  const assignment = await db('montessori_teacher_assignments as a')
    .join('teachers as t', 'a.teacher_id', 't.id')
    .join('users as u', 't.user_id', 'u.id')
    .where({ 'a.section_id': section.id, 'a.teacher_id': teacherId })
    .whereNull('a.ended_at')
    .first('a.id', 'u.full_name', 'u.status');
  if (!assignment) throw invalid(`The selected teacher is not assigned to ${section.name}. Assign the teacher in Montessori Teachers first.`);
  if (assignment.status === 'DEACTIVATED') throw invalid('This teacher account is deactivated.');
  return { section, teacherName: assignment.full_name };
}

/**
 * Existing CES rule: neither a class nor a teacher may be double-booked. Checked against other
 * Montessori live classes (same section or teacher) and the teacher's regular timetable lessons.
 */
async function assertNoConflict(trx, { sectionId, teacherId, startAt, endAt, excludeId = null }) {
  let q = trx('montessori_live_classes as lc')
    .join('montessori_sections as s', 'lc.section_id', 's.id')
    .where('lc.status', 'SCHEDULED')
    .where('lc.start_at', '<', endAt)
    .where('lc.end_at', '>', startAt)
    .where((w) => w.where('lc.section_id', sectionId).orWhere('lc.teacher_id', teacherId))
    .forUpdate();
  if (excludeId) q = q.whereNot('lc.id', excludeId);
  const clash = await q.first('lc.id', 'lc.title', 'lc.section_id', 's.name as section_name');
  if (clash) {
    const sameSection = Number(clash.section_id) === Number(sectionId);
    throw new AppError(
      sameSection
        ? `${clash.section_name} already has a live class ("${clash.title}") at this time.`
        : `This teacher already has a Montessori live class ("${clash.title}", ${clash.section_name}) at this time.`,
      409,
      ErrorCodes.SCHEDULE_CONFLICT,
      [{ type: sameSection ? 'SECTION_CONFLICT' : 'TEACHER_CONFLICT', conflictingLiveClassId: clash.id }]
    );
  }
  const lesson = await trx('timetable_lessons')
    .whereNotIn('status', ['CANCELLED', 'RESCHEDULED'])
    .where('teacher_id', teacherId)
    .where('start_at', '<', endAt)
    .where('end_at', '>', startAt)
    .first('id');
  if (lesson) {
    throw new AppError('This teacher has a regular timetable lesson at this time.', 409, ErrorCodes.SCHEDULE_CONFLICT, [
      { type: 'TEACHER_CONFLICT', conflictingLessonId: lesson.id }
    ]);
  }
}

/** A licensed Zoom user that is not reserved for one of the eight regular class rooms, else the account owner. */
async function pickZoomHost() {
  try {
    const users = await zoomApiClient.listLicensedUsers();
    if (users[8]) return users[8].id;
  } catch {
    /* fall back to the account owner */
  }
  return 'me';
}

function assertZoomConfigured() {
  if (!zoomApiClient.isConfigured()) {
    throw new AppError(
      'The Zoom API is not configured on the server. Paste a Zoom meeting link instead, or configure the Zoom credentials.',
      422,
      ErrorCodes.ZOOM_LINK_UNUSABLE
    );
  }
}

const zoomFailure = (err) =>
  err instanceof AppError ? err : new AppError(`Zoom could not complete the request: ${String(err?.message || 'unknown error').slice(0, 200)}`, 502, ErrorCodes.ZOOM_LINK_UNUSABLE);

/** Best-effort removal of a meeting this module created on Zoom (never blocks the CES change). */
async function removeZoomMeeting(meetingId) {
  if (!meetingId || !zoomApiClient.isConfigured()) return;
  try {
    await zoomApiClient.deleteMeeting(meetingId);
  } catch (err) {
    console.warn(`[montessori-live] Could not delete Zoom meeting ${meetingId}: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------
function baseQuery() {
  return db('montessori_live_classes as lc')
    .join('montessori_sections as s', 'lc.section_id', 's.id')
    .join('teachers as t', 'lc.teacher_id', 't.id')
    .join('users as tu', 't.user_id', 'tu.id')
    .select(
      'lc.id',
      'lc.section_id',
      'lc.teacher_id',
      'lc.title',
      'lc.description',
      db.raw("DATE_FORMAT(lc.class_date, '%Y-%m-%d') as class_date"),
      db.raw("TIME_FORMAT(lc.start_time, '%H:%i') as start_time"),
      db.raw("TIME_FORMAT(lc.end_time, '%H:%i') as end_time"),
      'lc.start_at',
      'lc.end_at',
      'lc.meeting_source',
      'lc.zoom_meeting_id',
      'lc.join_url',
      'lc.passcode',
      'lc.status',
      'lc.cancelled_at',
      'lc.cancel_reason',
      's.name as section_name',
      'tu.full_name as teacher_name'
    );
}

const upcomingOnly = (q, now) => q.where('lc.status', 'SCHEDULED').where('lc.end_at', '>', now).orderBy('lc.start_at', 'asc');
const previousOnly = (q, now) => q.where((w) => w.where('lc.status', 'CANCELLED').orWhere('lc.end_at', '<=', now)).orderBy('lc.start_at', 'desc');

/**
 * audience: 'STAFF' (full record), 'TEACHER' (link until the class closes),
 * 'LEARNER' (student / parent: link only inside the join window).
 */
function present(row, audience, now = Date.now()) {
  const startMs = parseDbDate(row.start_at).getTime();
  const endMs = parseDbDate(row.end_at).getTime();
  const cancelled = row.status === 'CANCELLED';
  const state = cancelled ? 'CANCELLED' : now >= endMs ? 'COMPLETED' : now >= startMs ? 'LIVE' : 'UPCOMING';
  const inWindow = !cancelled && now >= startMs - JOIN_OPENS_BEFORE_MS && now <= endMs + JOIN_CLOSES_AFTER_MS;
  const open = !cancelled && now <= endMs + JOIN_CLOSES_AFTER_MS;
  const showLink = audience === 'STAFF' || (audience === 'TEACHER' ? open : inWindow);
  const out = {
    id: row.id,
    sectionId: row.section_id,
    sectionName: row.section_name,
    teacherId: row.teacher_id,
    teacherName: row.teacher_name,
    title: row.title,
    description: row.description,
    date: row.class_date,
    startTime: row.start_time,
    endTime: row.end_time,
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(endMs).toISOString(),
    timezone: schoolTz(),
    state,
    canJoin: audience === 'TEACHER' ? open : inWindow,
    joinUrl: showLink ? row.join_url : null,
    passcode: showLink ? row.passcode : null,
    cancelReason: cancelled ? row.cancel_reason : null
  };
  if (audience === 'STAFF') {
    out.meetingSource = row.meeting_source;
    out.zoomMeetingId = row.zoom_meeting_id;
    out.cancelledAt = row.cancelled_at;
  }
  return out;
}

async function getOne(id, audience = 'STAFF') {
  const row = await baseQuery().where('lc.id', Number(id)).first();
  if (!row) throw notFound('Montessori live class not found.');
  return present(row, audience);
}

/** Principal list. scope: upcoming (default) | previous | all. */
export async function listLiveClasses({ scope = 'upcoming', sectionId = null } = {}) {
  const now = new Date();
  let q = baseQuery();
  if (sectionId) q = q.where('lc.section_id', Number(sectionId));
  if (scope === 'previous') q = previousOnly(q, now);
  else if (scope === 'all') q = q.orderBy('lc.start_at', 'desc');
  else q = upcomingOnly(q, now);
  return (await q.limit(300)).map((r) => present(r, 'STAFF'));
}

/** Whether the "create on Zoom" option is available (credentials configured). No secrets returned. */
export function meetingOptions() {
  return { zoomApiConfigured: zoomApiClient.isConfigured(), timezone: schoolTz() };
}

async function splitFor(sectionIds, audience) {
  if (!sectionIds.length) return { upcoming: [], previous: [] };
  const now = new Date();
  const [upcoming, previous] = await Promise.all([
    upcomingOnly(baseQuery().whereIn('lc.section_id', sectionIds), now).limit(100),
    previousOnly(baseQuery().whereIn('lc.section_id', sectionIds), now).limit(30)
  ]);
  return { upcoming: upcoming.map((r) => present(r, audience)), previous: previous.map((r) => present(r, audience)) };
}

/** Teacher: classes of the sections they are actively assigned to (class teacher or assistant). */
export async function myLiveClasses(user) {
  const { sectionIds } = await teacherSectionIds(user);
  return splitFor([...sectionIds], 'TEACHER');
}

async function forStudent(studentId) {
  const alloc = await db('montessori_student_allocations as al')
    .join('montessori_sections as s', 'al.section_id', 's.id')
    .where('al.student_id', Number(studentId))
    .whereNull('al.ended_at')
    .where('s.is_active', 1)
    .first('s.id', 's.name');
  if (!alloc) return { section: null, upcoming: [], previous: [] };
  return { section: { id: alloc.id, name: alloc.name }, ...(await splitFor([Number(alloc.id)], 'LEARNER')) };
}

/** Student: classes of the section the logged-in student is currently allocated to. */
export async function studentLiveClasses(user) {
  if (user.role !== 'STUDENT') throw forbidden('Only students can use this view.');
  const student = await db('students').where({ user_id: user.id }).first('id');
  if (!student) return { section: null, upcoming: [], previous: [] };
  return forStudent(student.id);
}

/** Parent: the same view for a linked child. */
export async function parentLiveClasses(user, studentId) {
  await assertParentLink(user, studentId);
  return forStudent(studentId);
}

// ---------------------------------------------------------------------------
// Principal: create / edit / cancel
// ---------------------------------------------------------------------------
export async function createLiveClass(user, body) {
  const v = parseZod(liveSchema, body);
  const { section, teacherName } = await loadSectionAndTeacher(v.sectionId, v.teacherId);
  const { startAt, endAt, minutes } = resolveSchedule(v);
  if (startAt.getTime() <= Date.now()) throw invalid('The class must start in the future.');
  if (v.meetingMode === 'MANUAL' && !validZoomUrl(v.joinUrl)) throw invalid('Enter a valid Zoom meeting link (https://…zoom.us/j/…).');
  if (v.meetingMode === 'ZOOM_API') assertZoomConfigured();

  // Fail fast on conflicts before anything is created on Zoom
  await db.transaction((trx) => assertNoConflict(trx, { sectionId: section.id, teacherId: v.teacherId, startAt, endAt }));

  let meeting = { meetingId: null, joinUrl: v.joinUrl, passcode: v.passcode || null };
  if (v.meetingMode === 'ZOOM_API') {
    try {
      meeting = await zoomApiClient.createScheduledMeeting({
        hostUserId: await pickZoomHost(),
        topic: `${section.name}: ${v.title}`,
        agenda: v.description || '',
        startLocal: `${v.date}T${v.startTime}:00`,
        durationMinutes: minutes,
        timezone: schoolTz()
      });
    } catch (err) {
      throw zoomFailure(err);
    }
  }

  try {
    const id = await db.transaction(async (trx) => {
      await assertNoConflict(trx, { sectionId: section.id, teacherId: v.teacherId, startAt, endAt });
      const [newId] = await trx('montessori_live_classes').insert({
        section_id: section.id,
        session_id: section.session_id,
        teacher_id: v.teacherId,
        title: v.title,
        description: v.description || null,
        class_date: v.date,
        start_time: `${v.startTime}:00`,
        end_time: `${v.endTime}:00`,
        start_at: startAt,
        end_at: endAt,
        meeting_source: v.meetingMode,
        zoom_meeting_id: meeting.meetingId,
        join_url: meeting.joinUrl,
        passcode: meeting.passcode,
        created_by: user.id,
        updated_by: user.id
      });
      await auditRepository.logAction(trx, {
        actorId: user.id,
        action: 'MONTESSORI_LIVE_CLASS_CREATED',
        recordType: 'montessori_live_classes',
        recordIdentifier: `Live class #${newId} (${v.title})`,
        newValue: { sectionId: section.id, sectionName: section.name, teacherId: v.teacherId, teacherName, date: v.date, startTime: v.startTime, endTime: v.endTime, meetingSource: v.meetingMode }
      });
      return newId;
    });
    return getOne(id);
  } catch (err) {
    if (v.meetingMode === 'ZOOM_API') await removeZoomMeeting(meeting.meetingId);
    throw err;
  }
}

export async function updateLiveClass(user, id, body) {
  const v = parseZod(liveSchema, body);
  const before = await db('montessori_live_classes').where({ id: Number(id) }).first();
  if (!before) throw notFound('Montessori live class not found.');
  if (before.status === 'CANCELLED') throw conflict('A cancelled live class cannot be edited. Schedule a new one instead.');
  if (parseDbDate(before.end_at).getTime() <= Date.now()) throw conflict('This live class has already ended and can no longer be edited.');

  const { section, teacherName } = await loadSectionAndTeacher(v.sectionId, v.teacherId);
  const { startAt, endAt, minutes } = resolveSchedule(v);
  const timeChanged = parseDbDate(before.start_at).getTime() !== startAt.getTime() || parseDbDate(before.end_at).getTime() !== endAt.getTime();
  if (timeChanged && startAt.getTime() <= Date.now()) throw invalid('The class must start in the future.');
  if (v.meetingMode === 'MANUAL' && !validZoomUrl(v.joinUrl)) throw invalid('Enter a valid Zoom meeting link (https://…zoom.us/j/…).');

  await db.transaction((trx) => assertNoConflict(trx, { sectionId: section.id, teacherId: v.teacherId, startAt, endAt, excludeId: before.id }));

  const hadApiMeeting = before.meeting_source === 'ZOOM_API' && before.zoom_meeting_id;
  let meeting = { meetingId: null, joinUrl: v.joinUrl, passcode: v.passcode || null };
  let createdOnZoom = null;
  if (v.meetingMode === 'ZOOM_API') {
    assertZoomConfigured();
    const details = {
      topic: `${section.name}: ${v.title}`,
      agenda: v.description || '',
      startLocal: `${v.date}T${v.startTime}:00`,
      durationMinutes: minutes,
      timezone: schoolTz()
    };
    try {
      if (hadApiMeeting) {
        await zoomApiClient.updateScheduledMeeting(before.zoom_meeting_id, details);
        meeting = { meetingId: before.zoom_meeting_id, joinUrl: before.join_url, passcode: before.passcode };
      } else {
        meeting = await zoomApiClient.createScheduledMeeting({ hostUserId: await pickZoomHost(), ...details });
        createdOnZoom = meeting.meetingId;
      }
    } catch (err) {
      throw zoomFailure(err);
    }
  }

  try {
    await db.transaction(async (trx) => {
      await assertNoConflict(trx, { sectionId: section.id, teacherId: v.teacherId, startAt, endAt, excludeId: before.id });
      await trx('montessori_live_classes').where({ id: before.id }).update({
        section_id: section.id,
        session_id: section.session_id,
        teacher_id: v.teacherId,
        title: v.title,
        description: v.description || null,
        class_date: v.date,
        start_time: `${v.startTime}:00`,
        end_time: `${v.endTime}:00`,
        start_at: startAt,
        end_at: endAt,
        meeting_source: v.meetingMode,
        zoom_meeting_id: meeting.meetingId,
        join_url: meeting.joinUrl,
        passcode: meeting.passcode,
        updated_by: user.id
      });
      await auditRepository.logAction(trx, {
        actorId: user.id,
        action: 'MONTESSORI_LIVE_CLASS_UPDATED',
        recordType: 'montessori_live_classes',
        recordIdentifier: `Live class #${before.id} (${v.title})`,
        previousValue: { sectionId: before.section_id, teacherId: before.teacher_id, title: before.title, startAt: before.start_at, endAt: before.end_at, meetingSource: before.meeting_source },
        newValue: { sectionId: section.id, teacherId: v.teacherId, teacherName, title: v.title, date: v.date, startTime: v.startTime, endTime: v.endTime, meetingSource: v.meetingMode }
      });
    });
  } catch (err) {
    await removeZoomMeeting(createdOnZoom);
    throw err;
  }
  // The class moved to a pasted link: the meeting CES created earlier is no longer used
  if (hadApiMeeting && v.meetingMode === 'MANUAL') await removeZoomMeeting(before.zoom_meeting_id);
  return getOne(before.id);
}

export async function cancelLiveClass(user, id, reason) {
  const text = String(reason || '').trim();
  if (text.length < 3) throw invalid('Enter a reason for cancelling this live class.');
  const row = await db.transaction(async (trx) => {
    const lc = await trx('montessori_live_classes').where({ id: Number(id) }).forUpdate().first();
    if (!lc) throw notFound('Montessori live class not found.');
    if (lc.status === 'CANCELLED') throw conflict('This live class is already cancelled.');
    if (parseDbDate(lc.end_at).getTime() <= Date.now()) throw conflict('This live class has already ended and cannot be cancelled.');
    await trx('montessori_live_classes').where({ id: lc.id }).update({
      status: 'CANCELLED',
      cancelled_at: trx.raw('CURRENT_TIMESTAMP(3)'),
      cancelled_by: user.id,
      cancel_reason: text.slice(0, 300),
      updated_by: user.id
    });
    await auditRepository.logAction(trx, {
      actorId: user.id,
      action: 'MONTESSORI_LIVE_CLASS_CANCELLED',
      recordType: 'montessori_live_classes',
      recordIdentifier: `Live class #${lc.id} (${lc.title})`,
      reason: text
    });
    return lc;
  });
  if (row.meeting_source === 'ZOOM_API') await removeZoomMeeting(row.zoom_meeting_id);
  return getOne(row.id);
}
