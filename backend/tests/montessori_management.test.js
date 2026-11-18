/**
 * Integration tests: Montessori Management (Principal, Teacher, Parent workflows,
 * permissions, history and regressions). Fixtures use a unique suffix and are removed
 * in afterAll; seeded learning areas are left untouched.
 */
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/shared/db/knex.js';
import { hashPassword } from '../src/shared/crypto/password.js';
import { schoolToday } from '../src/modules/montessori/montessori.access.js';

const PASSWORD = 'Fixture@Pass12345';
const SUFFIX = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
const TODAY = schoolToday();
const DAY = (offset) => {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

const userIds = [];
const sectionIds = [];
let app;
let cls;
let regularSubject;
const actors = {};
const st = {};
const teachers = {};

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
  put: (url) => request(app).put(url).set('Cookie', a.cookies).set('X-CSRF-Token', a.csrf),
  patch: (url) => request(app).patch(url).set('Cookie', a.cookies).set('X-CSRF-Token', a.csrf)
});
const M = '/api/v1/montessori';

async function createStudent(label, name) {
  const u = await createUser(4, label, name);
  const [id] = await db('students').insert({
    user_id: u.id,
    admission_no: `MADM-${label}-${SUFFIX}`.slice(0, 50),
    roll_no: String(70 + userIds.length),
    admission_date: '2026-04-01',
    current_class_id: cls.id,
    status: 'ACTIVE'
  });
  return { id, userId: u.id, username: u.username, name };
}

beforeAll(async () => {
  app = createApp();
  cls = await db('classes').orderBy('id').first();
  const session = (await db('academic_sessions').where({ is_current: 1 }).first()) || (await db('academic_sessions').first());
  const [subjectId] = await db('subjects').insert({ code: `MX${SUFFIX}`.slice(0, 30), name: `Mont Regular ${SUFFIX}`.slice(0, 60) });
  regularSubject = subjectId;

  const principal = await createUser(2, 'mprin', 'Fixture Mont Principal');
  for (const [key, name] of [['a', 'Fixture Mont Teacher A'], ['b', 'Fixture Mont Teacher B'], ['c', 'Fixture Mont Assistant C']]) {
    const u = await createUser(3, `mt${key}`, name);
    const [tid] = await db('teachers').insert({ user_id: u.id, employee_no: `MEMP-${key}-${SUFFIX}`, joining_date: '2026-01-01' });
    teachers[key] = { id: tid, userId: u.id, username: u.username };
  }
  // Teacher A also has a regular subject assignment (both workflows)
  await db('teacher_assignments').insert({ teacher_id: teachers.a.id, class_id: cls.id, subject_id: regularSubject, session_id: session.id, effective_from: '2026-01-01', assigned_by: principal.id });

  st.ali = await createStudent('mali', 'Fixture Mont Ali');
  st.sara = await createStudent('msara', 'Fixture Mont Sara');
  st.omar = await createStudent('momar', 'Fixture Mont Omar');

  const pa = await createUser(5, 'mpa', 'Fixture Mont Parent A');
  const pb = await createUser(5, 'mpb', 'Fixture Mont Parent B');
  const [parentA] = await db('parents').insert({ user_id: pa.id });
  const [parentB] = await db('parents').insert({ user_id: pb.id });
  await db('parent_student').insert({ parent_id: parentA, student_id: st.ali.id, linked_by: principal.id, relation: 'FATHER', is_primary: 1 });
  await db('parent_student').insert({ parent_id: parentB, student_id: st.omar.id, linked_by: principal.id, relation: 'MOTHER', is_primary: 1 });

  actors.principal = await login(principal.username);
  actors.teacherA = await login(teachers.a.username);
  actors.teacherB = await login(teachers.b.username);
  actors.teacherC = await login(teachers.c.username);
  actors.parentA = { ...(await login(pa.username)), userId: pa.id };
  actors.parentB = await login(pb.username);
  actors.studentAli = await login(st.ali.username);
}, 90000);

afterAll(async () => {
  const safe = async (fn) => {
    try {
      await fn();
    } catch (err) {
      console.warn('[cleanup]', err.message);
    }
  };
  const progressIds = await db('montessori_progress_records').whereIn('section_id', sectionIds).pluck('id');
  const attendanceIds = await db('montessori_attendance').whereIn('section_id', sectionIds).pluck('id');
  await safe(() => db('operational_notifications').where('related_record_type', 'MontessoriProgress').whereIn('related_record_id', progressIds.map(String)).del());
  await safe(() => db('montessori_progress_history').whereIn('progress_id', progressIds).del());
  await safe(() => db('montessori_progress_records').whereIn('id', progressIds).del());
  await safe(() => db('montessori_activities').whereIn('section_id', sectionIds).del());
  await safe(() => db('montessori_attendance_history').whereIn('attendance_id', attendanceIds).del());
  await safe(() => db('montessori_attendance').whereIn('id', attendanceIds).del());
  await safe(() => db('montessori_student_allocations').whereIn('section_id', sectionIds).del());
  await safe(() => db('montessori_teacher_assignments').whereIn('section_id', sectionIds).del());
  await safe(() => db('montessori_sections').whereIn('id', sectionIds).del());
  await safe(() => db('montessori_learning_areas').where('name', 'like', `%${SUFFIX}%`).del());
  await safe(() => db('audit_logs').whereIn('actor_id', userIds).del());
  await safe(() => db('operational_notifications').whereIn('user_id', userIds).del());
  await safe(() => db('parent_student').whereIn('student_id', Object.values(st).map((s) => s.id)).del());
  await safe(() => db('teacher_assignments').where({ subject_id: regularSubject }).del());
  await safe(() => db('parents').whereIn('user_id', userIds).del());
  await safe(() => db('teachers').whereIn('user_id', userIds).del());
  await safe(() => db('students').whereIn('user_id', userIds).del());
  await safe(() => db('user_sessions').whereIn('user_id', userIds).del());
  await safe(() => db('refresh_tokens').whereIn('user_id', userIds).del());
  await safe(() => db('users').whereIn('id', userIds).del());
  await safe(() => db('subjects').where({ id: regularSubject }).del());
  await db.destroy();
}, 90000);

const sec = {};
let activity;
let progressId;

// ===========================================================================
describe('Principal: sections', () => {
  test('creates sections with database-stored names', async () => {
    for (const [key, name] of [['kg1', `KG-1 ${SUFFIX}`], ['kg2', `KG-2 ${SUFFIX}`]]) {
      const res = await as(actors.principal).post(`${M}/sections`).send({ name });
      expect(res.status).toBe(201);
      sec[key] = res.body.data.id;
      sectionIds.push(res.body.data.id);
    }
    const dup = await as(actors.principal).post(`${M}/sections`).send({ name: `kg-1 ${SUFFIX}` });
    expect(dup.status).toBe(409);
  });

  test('renames and reorders a section', async () => {
    expect((await as(actors.principal).put(`${M}/sections/${sec.kg1}`).send({ name: `Nursery ${SUFFIX}` })).status).toBe(200);
    expect((await as(actors.principal).put(`${M}/sections/reorder`).send({ orderedIds: [sec.kg2, sec.kg1] })).status).toBe(200);
    const list = await as(actors.principal).get(`${M}/sections`);
    const mine = list.body.data.filter((s) => sectionIds.includes(s.id));
    expect(mine.map((s) => s.id)).toEqual([sec.kg2, sec.kg1]);
    expect(mine.find((s) => s.id === sec.kg1).name).toBe(`Nursery ${SUFFIX}`);
    expect(mine[0].sessionName).toBeTruthy();
  });

  test('deactivates and reactivates a section (history kept)', async () => {
    expect((await as(actors.principal).patch(`${M}/sections/${sec.kg2}/status`).send({ isActive: false })).status).toBe(200);
    const active = await as(actors.principal).get(`${M}/sections`);
    expect(active.body.data.map((s) => s.id)).not.toContain(sec.kg2);
    const all = await as(actors.principal).get(`${M}/sections?includeInactive=true`);
    expect(all.body.data.find((s) => s.id === sec.kg2).isActive).toBe(false);
    expect((await as(actors.principal).patch(`${M}/sections/${sec.kg2}/status`).send({ isActive: true })).status).toBe(200);
    const audit = await db('audit_logs').whereIn('action', ['MONTESSORI_SECTION_DEACTIVATED', 'MONTESSORI_SECTION_REACTIVATED']).where('record_identifier', 'like', `Section #${sec.kg2} %`);
    expect(audit).toHaveLength(2);
  });

  test('teachers, parents and students cannot manage sections', async () => {
    expect((await as(actors.teacherA).post(`${M}/sections`).send({ name: 'Hack' })).status).toBe(403);
    expect((await as(actors.parentA).get(`${M}/sections`)).status).toBe(403);
    expect((await as(actors.studentAli).get(`${M}/dashboard`)).status).toBe(403);
  });
});

// ===========================================================================
describe('Principal: teachers and students', () => {
  test('assigns a class teacher and an assistant; blocks a second class teacher', async () => {
    expect((await as(actors.principal).post(`${M}/sections/${sec.kg1}/assignments`).send({ teacherId: teachers.a.id, role: 'CLASS_TEACHER' })).status).toBe(201);
    expect((await as(actors.principal).post(`${M}/sections/${sec.kg1}/assignments`).send({ teacherId: teachers.c.id, role: 'ASSISTANT' })).status).toBe(201);
    const second = await as(actors.principal).post(`${M}/sections/${sec.kg1}/assignments`).send({ teacherId: teachers.b.id, role: 'CLASS_TEACHER' });
    expect(second.status).toBe(409);
    expect((await as(actors.principal).post(`${M}/sections/${sec.kg1}/assignments`).send({ teacherId: teachers.a.id, role: 'ASSISTANT' })).status).toBe(409);
  });

  test('changes the class teacher with replace; history keeps the old assignment', async () => {
    expect((await as(actors.principal).post(`${M}/sections/${sec.kg2}/assignments`).send({ teacherId: teachers.b.id })).status).toBe(201);
    expect((await as(actors.principal).post(`${M}/sections/${sec.kg2}/assignments`).send({ teacherId: teachers.c.id, replaceExisting: true, reason: 'Staffing change' })).status).toBe(201);
    const history = await as(actors.principal).get(`${M}/assignments?sectionId=${sec.kg2}`);
    expect(history.body.data).toHaveLength(2);
    expect(history.body.data.find((h) => h.teacherId === teachers.b.id).active).toBe(false);
    // Put teacher B back as the KG-2 class teacher for later tests
    const current = history.body.data.find((h) => h.active);
    expect((await as(actors.principal).post(`${M}/assignments/${current.id}/end`).send({ reason: 'Test reset' })).status).toBe(200);
    expect((await as(actors.principal).post(`${M}/sections/${sec.kg2}/assignments`).send({ teacherId: teachers.b.id })).status).toBe(201);
  });

  test('teacher list shows Montessori and regular assignments', async () => {
    const res = await as(actors.principal).get(`${M}/teachers`);
    const a = res.body.data.find((t) => t.id === teachers.a.id);
    expect(a.montessoriAssignments.map((m) => m.sectionId)).toContain(sec.kg1);
    expect(a.regularAssignmentCount).toBeGreaterThanOrEqual(1);
  });

  test('allocates existing students, prevents conflicting active allocations', async () => {
    const search = await as(actors.principal).get(`${M}/students/available?search=${encodeURIComponent('Fixture Mont')}`);
    expect(search.body.data.items.map((s) => s.id)).toEqual(expect.arrayContaining([st.ali.id, st.sara.id, st.omar.id]));
    expect(search.body.data.items[0].regularClassName).toBeTruthy();
    const res = await as(actors.principal).post(`${M}/sections/${sec.kg1}/allocations`).send({ studentIds: [st.ali.id, st.sara.id] });
    expect(res.status).toBe(201);
    expect((await as(actors.principal).post(`${M}/sections/${sec.kg2}/allocations`).send({ studentIds: [st.omar.id] })).status).toBe(201);
    const conflict = await as(actors.principal).post(`${M}/sections/${sec.kg2}/allocations`).send({ studentIds: [st.ali.id] });
    expect(conflict.status).toBe(422);
    expect(conflict.body.error.details.problems[0].reason).toMatch(/Already allocated/);
    const byStudentAccounts = await db('users').whereIn('id', [st.ali.userId]).count('id as n').first();
    expect(Number(byStudentAccounts.n)).toBe(1); // no duplicate accounts
  });

  test('transfers a student and keeps allocation history', async () => {
    expect((await as(actors.principal).post(`${M}/allocations/transfer`).send({ studentIds: [st.sara.id], toSectionId: sec.kg2, reason: 'Age group' })).status).toBe(200);
    const hist = await as(actors.principal).get(`${M}/students/${st.sara.id}/allocations`);
    expect(hist.body.data).toHaveLength(2);
    expect(hist.body.data.find((h) => h.active).sectionId).toBe(sec.kg2);
    expect(hist.body.data.find((h) => !h.active).endReason).toBe('TRANSFERRED');
    // and back again, so KG-1 has Ali + Sara
    expect((await as(actors.principal).post(`${M}/allocations/transfer`).send({ studentIds: [st.sara.id], toSectionId: sec.kg1, reason: 'Back' })).status).toBe(200);
  });

  test('a section with students cannot be deactivated', async () => {
    const res = await as(actors.principal).patch(`${M}/sections/${sec.kg1}/status`).send({ isActive: false });
    expect(res.status).toBe(409);
  });
});

// ===========================================================================
describe('Teacher: Montessori workflow', () => {
  test('teacher sees assigned sections and students only', async () => {
    const mine = await as(actors.teacherA).get(`${M}/my/sections`);
    expect(mine.body.data.map((s) => s.id)).toEqual([sec.kg1]);
    const students = await as(actors.teacherA).get(`${M}/sections/${sec.kg1}/students`);
    expect(students.body.data.map((s) => s.studentId).sort()).toEqual([st.ali.id, st.sara.id].sort());
    expect((await as(actors.teacherA).get(`${M}/sections/${sec.kg2}/students`)).status).toBe(403);
    const none = await as(actors.teacherB).get(`${M}/my/sections`);
    expect(none.body.data.map((s) => s.id)).toEqual([sec.kg2]);
  });

  test('marks attendance; duplicates are impossible and corrections are logged', async () => {
    const res = await as(actors.teacherA).put(`${M}/sections/${sec.kg1}/attendance`).send({
      date: TODAY,
      records: [
        { studentId: st.ali.id, status: 'PRESENT' },
        { studentId: st.sara.id, status: 'LATE', remarks: 'Arrived 9:15' }
      ]
    });
    expect(res.status).toBe(200);
    expect(res.body.data.created).toBe(2);
    const again = await as(actors.teacherA).put(`${M}/sections/${sec.kg1}/attendance`).send({ date: TODAY, records: [{ studentId: st.ali.id, status: 'ABSENT' }], reason: 'Left early, marked wrongly' });
    expect(again.body.data.corrected).toBe(1);
    const rows = await db('montessori_attendance').where({ student_id: st.ali.id, attendance_date: TODAY });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('ABSENT');
    const hist = await db('montessori_attendance_history').where({ attendance_id: rows[0].id });
    expect(hist[0].previous_status).toBe('PRESENT');
  });

  test('attendance rules: other sections, outsiders, future and old dates', async () => {
    expect((await as(actors.teacherA).put(`${M}/sections/${sec.kg2}/attendance`).send({ date: TODAY, records: [{ studentId: st.omar.id, status: 'PRESENT' }] })).status).toBe(403);
    expect((await as(actors.teacherA).put(`${M}/sections/${sec.kg1}/attendance`).send({ date: TODAY, records: [{ studentId: st.omar.id, status: 'PRESENT' }] })).status).toBe(422);
    expect((await as(actors.teacherA).put(`${M}/sections/${sec.kg1}/attendance`).send({ date: DAY(1), records: [{ studentId: st.ali.id, status: 'PRESENT' }] })).status).toBe(422);
    // Allocations started today, so older rosters are empty: verify the correction window via staff override path instead
    const principalOld = await as(actors.principal).get(`${M}/sections/${sec.kg1}/attendance?date=${DAY(-30)}`);
    expect(principalOld.body.data.canEdit).toBe(true);
    const teacherOld = await as(actors.teacherA).get(`${M}/sections/${sec.kg1}/attendance?date=${DAY(-30)}`);
    expect(teacherOld.body.data.canEdit).toBe(false);
  });

  test('creates, edits and archives an activity; other teachers cannot', async () => {
    const area = (await as(actors.teacherA).get(`${M}/learning-areas`)).body.data.find((a) => a.name === 'Mathematics');
    const res = await as(actors.teacherA).post(`${M}/activities`).send({
      sectionId: sec.kg1,
      learningAreaId: area.id,
      title: 'Counting 1-20',
      description: 'Count objects up to twenty.',
      objectives: 'Recognise and count numbers 1-20',
      activityDate: TODAY
    });
    expect(res.status).toBe(201);
    activity = res.body.data;
    expect(activity.learningAreaName).toBe('Mathematics');
    expect((await as(actors.teacherA).put(`${M}/activities/${activity.id}`).send({ title: 'Counting 1-20 (objects)' })).body.data.title).toBe('Counting 1-20 (objects)');
    expect((await as(actors.teacherB).put(`${M}/activities/${activity.id}`).send({ title: 'Hijack' })).status).toBe(403);
    expect((await as(actors.teacherB).post(`${M}/activities`).send({ sectionId: sec.kg1, learningAreaId: area.id, title: 'Unauthorised activity', activityDate: TODAY })).status).toBe(403);
    expect((await as(actors.principal).post(`${M}/activities`).send({ sectionId: sec.kg1, learningAreaId: area.id, title: 'Unauthorised activity', activityDate: TODAY })).status).toBe(403);
    expect((await as(actors.teacherA).post(`${M}/activities`).send({ sectionId: sec.kg1, learningAreaId: area.id, title: 'Bad attachment', activityDate: TODAY, attachmentUrl: '/etc/passwd' })).status).toBe(422);
    const archived = await as(actors.teacherA).post(`${M}/activities`).send({ sectionId: sec.kg1, learningAreaId: area.id, title: 'Old rhyme', activityDate: TODAY });
    expect((await as(actors.teacherA).patch(`${M}/activities/${archived.body.data.id}/status`).send({ status: 'ARCHIVED' })).body.data.status).toBe('ARCHIVED');
    const list = await as(actors.teacherA).get(`${M}/activities?sectionId=${sec.kg1}`);
    expect(list.body.data.items.map((a) => a.id)).toEqual([activity.id]);
  });

  test('records individual progress (append-only) and keeps correction history', async () => {
    const res = await as(actors.teacherA).post(`${M}/progress`).send({
      activityId: activity.id,
      records: [
        { studentId: st.ali.id, status: 'IMPROVING', remarks: 'Can recognise numbers but needs more practice counting independently.' },
        { studentId: st.sara.id, status: 'NEEDS_PRACTICE', improvementSuggestions: 'Practise with beads at home.' }
      ]
    });
    expect(res.status).toBe(201);
    progressId = res.body.data.find((p) => p.studentId === st.ali.id).id;
    // A later observation is a new record, not an overwrite
    await as(actors.teacherA).post(`${M}/progress`).send({ activityId: activity.id, records: [{ studentId: st.ali.id, status: 'COMPLETED', observationNotes: 'Counts to 20 confidently.' }] });
    const history = await as(actors.teacherA).get(`${M}/progress?studentId=${st.ali.id}`);
    expect(history.body.data.items.map((p) => p.status)).toEqual(['COMPLETED', 'IMPROVING']);
    const fix = await as(actors.teacherA).put(`${M}/progress/${progressId}`).send({ remarks: 'Recognises numbers 1-10 well.', reason: 'Clarified remark' });
    expect(fix.status).toBe(200);
    expect(fix.body.data.corrected).toBe(true);
    const corrections = await as(actors.teacherA).get(`${M}/progress/${progressId}/history`);
    expect(corrections.body.data[0].previousValues.remarks).toMatch(/needs more practice/);
    expect((await as(actors.teacherA).put(`${M}/progress/${progressId}`).send({ status: 'EXCELLENT' })).status).toBe(422); // reason required
  });

  test('unauthorised teachers cannot read or record another class’s progress', async () => {
    expect((await as(actors.teacherB).get(`${M}/progress?studentId=${st.ali.id}`)).status).toBe(403);
    expect((await as(actors.teacherB).post(`${M}/progress`).send({ activityId: activity.id, records: [{ studentId: st.ali.id, status: 'EXCELLENT' }] })).status).toBe(403);
    expect((await as(actors.teacherB).get(`${M}/reports/students/${st.ali.id}`)).status).toBe(403);
    expect((await as(actors.teacherA).post(`${M}/progress`).send({ activityId: activity.id, records: [{ studentId: st.omar.id, status: 'EXCELLENT' }] })).status).toBe(422);
  });
});

// ===========================================================================
describe('Principal: oversight and reports', () => {
  test('views attendance, activities and progress across sections', async () => {
    const att = await as(actors.principal).get(`${M}/attendance/report?sectionId=${sec.kg1}&from=${TODAY}&to=${TODAY}`);
    expect(att.body.data.totals.total).toBe(2);
    expect(att.body.data.students.find((s) => s.studentId === st.sara.id).LATE).toBe(1);
    const byStudent = await as(actors.principal).get(`${M}/attendance/report?studentId=${st.ali.id}`);
    expect(byStudent.body.data.records[0].status).toBe('ABSENT');
    expect((await as(actors.principal).get(`${M}/activities`)).body.data.items.some((a) => a.id === activity.id)).toBe(true);
    expect((await as(actors.principal).get(`${M}/progress?sectionId=${sec.kg1}`)).body.data.total).toBe(3);
  });

  test('section and student reports', async () => {
    const section = await as(actors.principal).get(`${M}/reports/sections/${sec.kg1}`);
    expect(section.status).toBe(200);
    expect(section.body.data.totals.students).toBe(2);
    expect(section.body.data.completionOverview.COMPLETED).toBe(1); // latest observation per student & activity
    expect(section.body.data.completionOverview.NEEDS_PRACTICE).toBe(1);
    const student = await as(actors.principal).get(`${M}/reports/students/${st.ali.id}`);
    expect(student.body.data.currentSection.id).toBe(sec.kg1);
    expect(student.body.data.completedActivities).toHaveLength(1);
    expect(student.body.data.history).toHaveLength(2);
    expect(student.body.data.student.regularClassName).toBe(cls.name);
  });

  test('dashboard shows real totals', async () => {
    const res = await as(actors.principal).get(`${M}/dashboard`);
    expect(res.status).toBe(200);
    expect(res.body.data.sections.find((s) => s.id === sec.kg1).students).toBe(2);
    expect(res.body.data.needsPractice.some((p) => p.studentId === st.sara.id)).toBe(true);
  });
});

// ===========================================================================
describe('Parent portal', () => {
  test('parent views their own child’s Montessori progress and attendance', async () => {
    const kids = await as(actors.parentA).get(`${M}/parent/children`);
    expect(kids.body.data).toEqual([{ studentId: st.ali.id, sectionId: sec.kg1, sectionName: `Nursery ${SUFFIX}` }]);
    const view = await as(actors.parentA).get(`${M}/parent/children/${st.ali.id}`);
    expect(view.status).toBe(200);
    expect(view.body.data.attendance.total).toBe(1);
    expect(view.body.data.history.length).toBe(2);
    expect(view.body.data.recentActivities.map((a) => a.id)).toContain(activity.id);
    const notices = await db('operational_notifications').where({ user_id: actors.parentA.userId, related_record_type: 'MontessoriProgress' });
    expect(notices.length).toBeGreaterThan(0);
  });

  test('parent cannot access another child or change records', async () => {
    expect((await as(actors.parentA).get(`${M}/parent/children/${st.omar.id}`)).status).toBe(403);
    expect((await as(actors.parentB).get(`${M}/parent/children/${st.ali.id}`)).status).toBe(403);
    expect((await as(actors.parentA).put(`${M}/sections/${sec.kg1}/attendance`).send({ date: TODAY, records: [{ studentId: st.ali.id, status: 'PRESENT' }] })).status).toBe(403);
    expect((await as(actors.parentA).put(`${M}/progress/${progressId}`).send({ status: 'EXCELLENT', reason: 'parent edit' })).status).toBe(403);
  });
});

// ===========================================================================
describe('Regression: regular workflows are unaffected', () => {
  test('teacher with both assignment types keeps the regular class scope', async () => {
    const me = await as(actors.teacherA).get('/api/v1/teachers/me');
    expect([200, 404]).toContain(me.status);
    const tasks = await as(actors.teacherA).get('/api/v1/tasks');
    expect(tasks.status).toBe(200);
  });

  test('existing student account, parent portal and lesson attendance still work', async () => {
    expect((await as(actors.studentAli).get('/api/v1/students/me/dashboard')).status).toBe(200);
    expect((await as(actors.parentA).get(`/api/v1/parents/me/children/${st.ali.id}/attendance`)).status).toBe(200);
    expect((await as(actors.principal).get('/api/v1/attendance/lessons')).status).not.toBe(500);
  });
});
