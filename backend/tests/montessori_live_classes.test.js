/**
 * Integration tests: Montessori Live Classes (Zoom).
 * Principal scheduling, teacher / student / parent visibility, section isolation, join window,
 * edit + cancel, Zoom API mode (zoomApiClient stubbed, no network) and regular Zoom regressions.
 * Fixtures use a unique suffix and are removed in afterAll.
 */
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/shared/db/knex.js';
import { hashPassword } from '../src/shared/crypto/password.js';
import { schoolToday } from '../src/modules/montessori/montessori.access.js';
import { zoomApiClient } from '../src/shared/services/zoomApiClient.js';

const PASSWORD = 'Fixture@Pass12345';
const SUFFIX = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
const DAY = (offset) => {
  const d = new Date(`${schoolToday()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};
const M = '/api/v1/montessori';
const LINK = 'https://us05web.zoom.us/j/81234567890?pwd=abc';

const userIds = [];
const sectionIds = [];
const actors = {};
const teachers = {};
const st = {};
const sec = {};
const lc = {};
let app;
let cls;
const originalZoom = {};
const zoomCalls = { created: [], updated: [], deleted: [] };

async function createUser(roleId, label, fullName) {
  const username = `t_${label}_${SUFFIX}`.slice(0, 60);
  const [id] = await db('users').insert({
    role_id: roleId,
    username,
    email: `${username}@fixture.test`,
    full_name: fullName,
    password_hash: await hashPassword(PASSWORD),
    must_change_password: 0,
    status: 'ACTIVE'
  });
  userIds.push(id);
  return { id, username };
}

async function login(username) {
  const res = await request(app).post('/api/v1/auth/login').send({ identifier: username, password: PASSWORD });
  if (res.status !== 200) throw new Error(`Login failed for ${username}: ${res.status}`);
  const cookies = res.headers['set-cookie'];
  const csrf = cookies.find((c) => c.startsWith('sms_csrf=')).split(';')[0].split('=')[1];
  return { cookies, csrf };
}

const as = (a) => ({
  get: (url) => request(app).get(url).set('Cookie', a.cookies),
  post: (url) => request(app).post(url).set('Cookie', a.cookies).set('X-CSRF-Token', a.csrf),
  put: (url) => request(app).put(url).set('Cookie', a.cookies).set('X-CSRF-Token', a.csrf)
});

async function createStudent(label, name) {
  const u = await createUser(4, label, name);
  const [id] = await db('students').insert({
    user_id: u.id,
    admission_no: `LADM-${label}-${SUFFIX}`.slice(0, 50),
    roll_no: String(80 + userIds.length),
    admission_date: '2026-04-01',
    current_class_id: cls.id,
    status: 'ACTIVE'
  });
  return { id, username: u.username };
}

const payload = (over = {}) => ({
  sectionId: sec.kg1,
  teacherId: teachers.a.id,
  title: `Rhymes Time ${SUFFIX}`,
  description: 'Sing along',
  date: DAY(3),
  startTime: '10:00',
  endTime: '10:40',
  meetingMode: 'MANUAL',
  joinUrl: LINK,
  passcode: 'kg1pass',
  ...over
});

beforeAll(async () => {
  app = createApp();
  cls = await db('classes').orderBy('id').first();

  const principal = await createUser(2, 'lprin', 'Fixture Live Principal');
  for (const key of ['a', 'b', 'x']) {
    const u = await createUser(3, `lt${key}`, `Fixture Live Teacher ${key.toUpperCase()}`);
    const [tid] = await db('teachers').insert({ user_id: u.id, employee_no: `LEMP-${key}-${SUFFIX}`, joining_date: '2026-01-01' });
    teachers[key] = { id: tid, username: u.username };
  }
  st.ali = await createStudent('lali', 'Fixture Live Ali');
  st.omar = await createStudent('lomar', 'Fixture Live Omar');
  st.zed = await createStudent('lzed', 'Fixture Live Zed');

  const pa = await createUser(5, 'lpa', 'Fixture Live Parent A');
  const pb = await createUser(5, 'lpb', 'Fixture Live Parent B');
  const [parentA] = await db('parents').insert({ user_id: pa.id });
  const [parentB] = await db('parents').insert({ user_id: pb.id });
  await db('parent_student').insert({ parent_id: parentA, student_id: st.ali.id, linked_by: principal.id, relation: 'FATHER', is_primary: 1 });
  await db('parent_student').insert({ parent_id: parentB, student_id: st.omar.id, linked_by: principal.id, relation: 'MOTHER', is_primary: 1 });

  actors.principal = await login(principal.username);
  actors.teacherA = await login(teachers.a.username);
  actors.teacherB = await login(teachers.b.username);
  actors.teacherX = await login(teachers.x.username);
  actors.ali = await login(st.ali.username);
  actors.omar = await login(st.omar.username);
  actors.zed = await login(st.zed.username);
  actors.parentA = await login(pa.username);
  actors.parentB = await login(pb.username);

  // Sections, teacher assignments and student allocations through the real API
  for (const key of ['kg1', 'kg2']) {
    const res = await as(actors.principal).post(`${M}/sections`).send({ name: `Live ${key} ${SUFFIX}` });
    sec[key] = res.body.data.id;
    sectionIds.push(sec[key]);
  }
  await as(actors.principal).post(`${M}/sections/${sec.kg1}/assignments`).send({ teacherId: teachers.a.id });
  await as(actors.principal).post(`${M}/sections/${sec.kg2}/assignments`).send({ teacherId: teachers.b.id });
  await as(actors.principal).post(`${M}/sections/${sec.kg1}/allocations`).send({ studentIds: [st.ali.id] });
  await as(actors.principal).post(`${M}/sections/${sec.kg2}/allocations`).send({ studentIds: [st.omar.id] });

  for (const k of ['isConfigured', 'createScheduledMeeting', 'updateScheduledMeeting', 'deleteMeeting', 'listLicensedUsers']) originalZoom[k] = zoomApiClient[k];
}, 90000);

afterAll(async () => {
  Object.assign(zoomApiClient, originalZoom);
  const safe = async (fn) => {
    try {
      await fn();
    } catch (err) {
      console.warn('[cleanup]', err.message);
    }
  };
  await safe(() => db('montessori_live_classes').whereIn('section_id', sectionIds).del());
  await safe(() => db('montessori_student_allocations').whereIn('section_id', sectionIds).del());
  await safe(() => db('montessori_teacher_assignments').whereIn('section_id', sectionIds).del());
  await safe(() => db('montessori_sections').whereIn('id', sectionIds).del());
  await safe(() => db('audit_logs').whereIn('actor_id', userIds).del());
  await safe(() => db('zoom_participant_log').whereIn('user_id', userIds).del());
  await safe(() => db('operational_notifications').whereIn('user_id', userIds).del());
  await safe(() => db('parent_student').whereIn('student_id', Object.values(st).map((s) => s.id)).del());
  await safe(() => db('parents').whereIn('user_id', userIds).del());
  await safe(() => db('teachers').whereIn('user_id', userIds).del());
  await safe(() => db('students').whereIn('user_id', userIds).del());
  await safe(() => db('user_sessions').whereIn('user_id', userIds).del());
  await safe(() => db('refresh_tokens').whereIn('user_id', userIds).del());
  await safe(() => db('users').whereIn('id', userIds).del());
  await db.destroy();
}, 90000);

// ===========================================================================
describe('Principal: scheduling', () => {
  test('creates a Montessori live class for a KG section and its assigned teacher', async () => {
    const res = await as(actors.principal).post(`${M}/live-classes`).send(payload());
    expect(res.status).toBe(201);
    lc.kg1 = res.body.data;
    expect(lc.kg1).toMatchObject({ sectionId: sec.kg1, teacherId: teachers.a.id, date: DAY(3), startTime: '10:00', endTime: '10:40', state: 'UPCOMING', joinUrl: LINK, meetingSource: 'MANUAL' });
    // 10:00 Asia/Karachi wall-clock is stored as a UTC instant (existing timetable convention)
    expect(new Date(lc.kg1.endAt) - new Date(lc.kg1.startAt)).toBe(40 * 60000);
    const other = await as(actors.principal).post(`${M}/live-classes`).send(payload({ sectionId: sec.kg2, teacherId: teachers.b.id, title: `Story Hour ${SUFFIX}`, joinUrl: 'https://zoom.us/j/99887766554' }));
    expect(other.status).toBe(201);
    lc.kg2 = other.body.data;
    const audit = await db('audit_logs').where({ action: 'MONTESSORI_LIVE_CLASS_CREATED' }).where('record_identifier', 'like', `Live class #${lc.kg1.id} %`);
    expect(audit).toHaveLength(1);
  });

  test('rejects invalid input', async () => {
    const bad = async (over) => (await as(actors.principal).post(`${M}/live-classes`).send(payload({ date: DAY(5), ...over }))).status;
    expect(await bad({ title: 'x' })).toBe(422);
    expect(await bad({ endTime: '09:00' })).toBe(422);
    expect(await bad({ date: DAY(-1) })).toBe(422);
    expect(await bad({ date: '2026-02-31' })).toBe(422);
    expect(await bad({ joinUrl: 'http://zoom.us/j/1' })).toBe(422);
    expect(await bad({ joinUrl: 'https://evil.example.com/zoom.us/j/1' })).toBe(422);
    expect(await bad({ sectionId: 99999999 })).toBe(404);
    // Teacher B is not assigned to KG-1; teacher X has no Montessori assignment at all
    expect(await bad({ teacherId: teachers.b.id })).toBe(422);
    expect(await bad({ teacherId: teachers.x.id })).toBe(422);
  });

  test('prevents section and teacher double-booking', async () => {
    const section = await as(actors.principal).post(`${M}/live-classes`).send(payload({ startTime: '10:30', endTime: '11:00' }));
    expect(section.status).toBe(409);
    expect(section.body.error?.code || section.body.code).toBe('SCHEDULE_CONFLICT');
    // Teacher A also assists KG-2: the same teacher cannot be in two classes at once
    await as(actors.principal).post(`${M}/sections/${sec.kg2}/assignments`).send({ teacherId: teachers.a.id, role: 'ASSISTANT' });
    const teacher = await as(actors.principal).post(`${M}/live-classes`).send(payload({ sectionId: sec.kg2, date: DAY(4), startTime: '09:00', endTime: '09:30' }));
    expect(teacher.status).toBe(201);
    lc.extra = teacher.body.data;
    const clash = await as(actors.principal).post(`${M}/live-classes`).send(payload({ date: DAY(4), startTime: '09:15', endTime: '09:45' }));
    expect(clash.status).toBe(409);
    // Back-to-back is allowed
    const adjacent = await as(actors.principal).post(`${M}/live-classes`).send(payload({ startTime: '10:40', endTime: '11:00', title: `Adjacent ${SUFFIX}` }));
    expect(adjacent.status).toBe(201);
    lc.adjacent = adjacent.body.data;
  });

  test('only principal / admin can manage or list all live classes', async () => {
    for (const a of [actors.teacherA, actors.ali, actors.parentA]) {
      expect((await as(a).post(`${M}/live-classes`).send(payload({ date: DAY(6) }))).status).toBe(403);
      expect((await as(a).get(`${M}/live-classes`)).status).toBe(403);
      expect((await as(a).put(`${M}/live-classes/${lc.kg1.id}`).send(payload())).status).toBe(403);
      expect((await as(a).post(`${M}/live-classes/${lc.kg1.id}/cancel`).send({ reason: 'nope' })).status).toBe(403);
    }
    expect((await request(app).get(`${M}/live-classes`)).status).toBe(401);
  });

  test('lists upcoming classes, filterable by section', async () => {
    const all = await as(actors.principal).get(`${M}/live-classes`);
    const mine = all.body.data.filter((c) => sectionIds.includes(c.sectionId)).map((c) => c.id);
    expect(mine).toEqual(expect.arrayContaining([lc.kg1.id, lc.kg2.id, lc.extra.id, lc.adjacent.id]));
    const kg2 = await as(actors.principal).get(`${M}/live-classes?sectionId=${sec.kg2}`);
    expect(kg2.body.data.every((c) => c.sectionId === sec.kg2)).toBe(true);
    expect((await as(actors.principal).get(`${M}/live-classes/options`)).body.data).toHaveProperty('zoomApiConfigured');
  });
});

// ===========================================================================
describe('Teacher, student and parent visibility', () => {
  test('assigned teacher sees the classes of their sections with the meeting link', async () => {
    const res = await as(actors.teacherA).get(`${M}/my/live-classes`);
    expect(res.status).toBe(200);
    const mine = res.body.data.upcoming.find((c) => c.id === lc.kg1.id);
    expect(mine).toMatchObject({ joinUrl: LINK, passcode: 'kg1pass', canJoin: true });
    expect(mine).not.toHaveProperty('zoomMeetingId');
    const b = await as(actors.teacherB).get(`${M}/my/live-classes`);
    expect(b.body.data.upcoming.map((c) => c.id)).toContain(lc.kg2.id);
    expect(b.body.data.upcoming.map((c) => c.id)).not.toContain(lc.kg1.id);
  });

  test('a teacher without a Montessori assignment sees nothing', async () => {
    const res = await as(actors.teacherX).get(`${M}/my/live-classes`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ upcoming: [], previous: [] });
    expect((await as(actors.ali).get(`${M}/my/live-classes`)).status).toBe(403);
  });

  test('students see only their own section; the link stays hidden until the join window', async () => {
    const ali = await as(actors.ali).get(`${M}/student/live-classes`);
    expect(ali.status).toBe(200);
    expect(ali.body.data.section.id).toBe(sec.kg1);
    const ids = ali.body.data.upcoming.map((c) => c.id);
    expect(ids).toContain(lc.kg1.id);
    expect(ids).not.toContain(lc.kg2.id);
    const row = ali.body.data.upcoming.find((c) => c.id === lc.kg1.id);
    expect(row).toMatchObject({ title: lc.kg1.title, date: DAY(3), startTime: '10:00', canJoin: false, joinUrl: null, passcode: null });
    expect(JSON.stringify(ali.body.data)).not.toContain('zoom.us');

    const omar = await as(actors.omar).get(`${M}/student/live-classes`);
    expect(omar.body.data.upcoming.map((c) => c.id)).not.toContain(lc.kg1.id);
    const zed = await as(actors.zed).get(`${M}/student/live-classes`);
    expect(zed.body.data).toEqual({ section: null, upcoming: [], previous: [] });
    expect((await as(actors.teacherA).get(`${M}/student/live-classes`)).status).toBe(403);
  });

  test('Join Live Class opens the correct meeting inside the join window', async () => {
    await db('montessori_live_classes').where({ id: lc.kg1.id }).update({ start_at: new Date(Date.now() + 5 * 60000), end_at: new Date(Date.now() + 45 * 60000) });
    const ali = await as(actors.ali).get(`${M}/student/live-classes`);
    expect(ali.body.data.upcoming.find((c) => c.id === lc.kg1.id)).toMatchObject({ canJoin: true, joinUrl: LINK, passcode: 'kg1pass', state: 'UPCOMING' });
    // The unrelated section still gets nothing for this class
    const omar = await as(actors.omar).get(`${M}/student/live-classes`);
    expect(JSON.stringify(omar.body.data)).not.toContain(LINK);
    const parent = await as(actors.parentA).get(`${M}/parent/children/${st.ali.id}/live-classes`);
    expect(parent.body.data.upcoming.find((c) => c.id === lc.kg1.id).joinUrl).toBe(LINK);
  });

  test('parents see only their linked child', async () => {
    const own = await as(actors.parentA).get(`${M}/parent/children/${st.ali.id}/live-classes`);
    expect(own.status).toBe(200);
    expect(own.body.data.section.id).toBe(sec.kg1);
    expect((await as(actors.parentA).get(`${M}/parent/children/${st.omar.id}/live-classes`)).status).toBe(403);
    expect((await as(actors.parentB).get(`${M}/parent/children/${st.ali.id}/live-classes`)).status).toBe(403);
    expect((await as(actors.ali).get(`${M}/parent/children/${st.ali.id}/live-classes`)).status).toBe(403);
  });

  test('a transferred student follows the new section', async () => {
    const res = await as(actors.principal).post(`${M}/allocations/transfer`).send({ studentIds: [st.ali.id], toSectionId: sec.kg2, reason: 'Live class test transfer' });
    expect(res.status).toBe(200);
    const ali = await as(actors.ali).get(`${M}/student/live-classes`);
    expect(ali.body.data.section.id).toBe(sec.kg2);
    expect(ali.body.data.upcoming.map((c) => c.id)).not.toContain(lc.kg1.id);
    expect(JSON.stringify(ali.body.data)).not.toContain(LINK);
    await as(actors.principal).post(`${M}/allocations/transfer`).send({ studentIds: [st.ali.id], toSectionId: sec.kg1, reason: 'Live class test transfer back' });
  });

  test('a teacher loses access when the assignment ends', async () => {
    const history = await as(actors.principal).get(`${M}/assignments?sectionId=${sec.kg2}&teacherId=${teachers.a.id}`);
    const active = history.body.data.find((h) => h.active);
    // The extra KG-2 class is taught by teacher A: reassign it first, then end the assistant role
    expect((await as(actors.principal).put(`${M}/live-classes/${lc.extra.id}`).send(payload({ sectionId: sec.kg2, teacherId: teachers.b.id, date: DAY(4), startTime: '09:00', endTime: '09:30' }))).status).toBe(200);
    expect((await as(actors.principal).post(`${M}/assignments/${active.id}/end`).send({ reason: 'Test end' })).status).toBe(200);
    const a = await as(actors.teacherA).get(`${M}/my/live-classes`);
    expect(a.body.data.upcoming.map((c) => c.id)).not.toContain(lc.extra.id);
    expect(a.body.data.upcoming.map((c) => c.id)).toContain(lc.kg1.id);
  });
});

// ===========================================================================
describe('Principal: edit, cancel and history', () => {
  test('edits a scheduled class', async () => {
    const res = await as(actors.principal).put(`${M}/live-classes/${lc.kg2.id}`).send(payload({ sectionId: sec.kg2, teacherId: teachers.b.id, title: `Story Hour Updated ${SUFFIX}`, date: DAY(7), startTime: '11:00', endTime: '11:45', joinUrl: 'https://zoom.us/j/11122233344', passcode: '' }));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ title: `Story Hour Updated ${SUFFIX}`, date: DAY(7), startTime: '11:00', endTime: '11:45', joinUrl: 'https://zoom.us/j/11122233344', passcode: null });
    const b = await as(actors.teacherB).get(`${M}/my/live-classes`);
    expect(b.body.data.upcoming.find((c) => c.id === lc.kg2.id).date).toBe(DAY(7));
    // Editing into a conflict is rejected; the class may keep its own slot
    expect((await as(actors.principal).put(`${M}/live-classes/${lc.kg2.id}`).send(payload({ sectionId: sec.kg2, teacherId: teachers.b.id, date: DAY(4), startTime: '09:10', endTime: '09:40' }))).status).toBe(409);
    expect((await as(actors.principal).put(`${M}/live-classes/999999999`).send(payload())).status).toBe(404);
  });

  test('cancels a class: hidden link, listed under previous, cannot be edited again', async () => {
    expect((await as(actors.principal).post(`${M}/live-classes/${lc.kg1.id}/cancel`).send({ reason: '' })).status).toBe(422);
    const res = await as(actors.principal).post(`${M}/live-classes/${lc.kg1.id}/cancel`).send({ reason: 'Teacher unwell' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ state: 'CANCELLED', cancelReason: 'Teacher unwell' });
    expect((await as(actors.principal).post(`${M}/live-classes/${lc.kg1.id}/cancel`).send({ reason: 'again' })).status).toBe(409);
    expect((await as(actors.principal).put(`${M}/live-classes/${lc.kg1.id}`).send(payload())).status).toBe(409);

    const ali = await as(actors.ali).get(`${M}/student/live-classes`);
    expect(ali.body.data.upcoming.map((c) => c.id)).not.toContain(lc.kg1.id);
    expect(ali.body.data.previous.find((c) => c.id === lc.kg1.id)).toMatchObject({ state: 'CANCELLED', canJoin: false, joinUrl: null });
    const teacher = await as(actors.teacherA).get(`${M}/my/live-classes`);
    expect(teacher.body.data.previous.find((c) => c.id === lc.kg1.id)).toMatchObject({ state: 'CANCELLED', joinUrl: null });
    const prev = await as(actors.principal).get(`${M}/live-classes?scope=previous&sectionId=${sec.kg1}`);
    expect(prev.body.data.map((c) => c.id)).toContain(lc.kg1.id);
    // The cancelled slot is free again
    const reuse = await as(actors.principal).post(`${M}/live-classes`).send(payload({ title: `Replacement ${SUFFIX}`, startTime: '10:00', endTime: '10:30' }));
    expect(reuse.status).toBe(201);
  });

  test('a completed class is history: no link for learners, no edit or cancel', async () => {
    await db('montessori_live_classes').where({ id: lc.adjacent.id }).update({ start_at: new Date(Date.now() - 3 * 3600000), end_at: new Date(Date.now() - 2 * 3600000) });
    const ali = await as(actors.ali).get(`${M}/student/live-classes`);
    expect(ali.body.data.previous.find((c) => c.id === lc.adjacent.id)).toMatchObject({ state: 'COMPLETED', canJoin: false, joinUrl: null });
    const teacher = await as(actors.teacherA).get(`${M}/my/live-classes`);
    expect(teacher.body.data.previous.find((c) => c.id === lc.adjacent.id)).toMatchObject({ state: 'COMPLETED', joinUrl: null });
    expect((await as(actors.principal).put(`${M}/live-classes/${lc.adjacent.id}`).send(payload({ date: DAY(9) }))).status).toBe(409);
    expect((await as(actors.principal).post(`${M}/live-classes/${lc.adjacent.id}/cancel`).send({ reason: 'too late' })).status).toBe(409);
  });
});

// ===========================================================================
describe('Zoom API mode (existing integration, stubbed client)', () => {
  test('is refused with a clear message when Zoom credentials are not configured', async () => {
    zoomApiClient.isConfigured = () => false;
    const res = await as(actors.principal).post(`${M}/live-classes`).send(payload({ date: DAY(10), meetingMode: 'ZOOM_API', joinUrl: null }));
    expect(res.status).toBe(422);
  });

  test('creates, updates and removes the meeting through the shared Zoom client', async () => {
    zoomApiClient.isConfigured = () => true;
    zoomApiClient.listLicensedUsers = async () => [];
    zoomApiClient.createScheduledMeeting = async (args) => {
      zoomCalls.created.push(args);
      return { meetingId: '7770001112', joinUrl: 'https://us05web.zoom.us/j/7770001112?pwd=gen', passcode: 'GenPass1' };
    };
    zoomApiClient.updateScheduledMeeting = async (id, args) => zoomCalls.updated.push({ id, ...args });
    zoomApiClient.deleteMeeting = async (id) => zoomCalls.deleted.push(String(id));

    const res = await as(actors.principal).post(`${M}/live-classes`).send(payload({ date: DAY(10), meetingMode: 'ZOOM_API', joinUrl: null, passcode: null, title: `API Class ${SUFFIX}` }));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ meetingSource: 'ZOOM_API', zoomMeetingId: '7770001112', joinUrl: 'https://us05web.zoom.us/j/7770001112?pwd=gen', passcode: 'GenPass1' });
    expect(zoomCalls.created[0]).toMatchObject({ hostUserId: 'me', startLocal: `${DAY(10)}T10:00:00`, durationMinutes: 40, timezone: res.body.data.timezone });
    // No host start URL / host key is stored or returned
    const stored = await db('montessori_live_classes').where({ id: res.body.data.id }).first();
    expect(Object.keys(stored).some((k) => /start_url|host_key/.test(k))).toBe(false);

    const edit = await as(actors.principal).put(`${M}/live-classes/${res.body.data.id}`).send(payload({ date: DAY(10), startTime: '12:00', endTime: '12:30', meetingMode: 'ZOOM_API', joinUrl: null, title: `API Class ${SUFFIX}` }));
    expect(edit.status).toBe(200);
    expect(zoomCalls.created).toHaveLength(1);
    expect(zoomCalls.updated[0]).toMatchObject({ id: '7770001112', startLocal: `${DAY(10)}T12:00:00`, durationMinutes: 30 });
    expect(edit.body.data.zoomMeetingId).toBe('7770001112');

    const cancel = await as(actors.principal).post(`${M}/live-classes/${res.body.data.id}/cancel`).send({ reason: 'Holiday' });
    expect(cancel.status).toBe(200);
    expect(zoomCalls.deleted).toEqual(['7770001112']);
  });

  test('a Zoom failure creates nothing in CES', async () => {
    zoomApiClient.createScheduledMeeting = async () => {
      throw new Error('Zoom API error (429): rate limited');
    };
    const before = await db('montessori_live_classes').whereIn('section_id', sectionIds).count('id as n').first();
    const res = await as(actors.principal).post(`${M}/live-classes`).send(payload({ date: DAY(11), meetingMode: 'ZOOM_API', joinUrl: null }));
    expect(res.status).toBe(502);
    const after = await db('montessori_live_classes').whereIn('section_id', sectionIds).count('id as n').first();
    expect(Number(after.n)).toBe(Number(before.n));
  });
});

// ===========================================================================
describe('Regression: regular Zoom live classes are untouched', () => {
  test('regular class meeting directory still works and contains no Montessori records', async () => {
    const res = await as(actors.principal).get('/api/v1/zoom/class-meetings');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(JSON.stringify(res.body.data)).not.toContain(SUFFIX);
    expect((await as(actors.principal).get('/api/v1/zoom/capacity-status')).status).toBe(200);
  });

  test('regular student and teacher live-class endpoints still respond', async () => {
    const student = await as(actors.ali).get('/api/v1/zoom/student-class-session');
    expect(student.status).toBe(200);
    expect(student.body.data.classId).toBe(Number(cls.id));
    expect((await as(actors.teacherA).get('/api/v1/zoom/my-class-session')).status).toBe(200);
    expect((await as(actors.ali).get('/api/v1/zoom/class-meetings')).status).toBe(403);
  });
});
