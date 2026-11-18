/**
 * Integration tests: Certificate Management (teacher issuance, student/parent access,
 * principal oversight & template management, audit, duplicate protection).
 *
 * Fixtures (users, subject, students) are created with a unique suffix and removed in
 * afterAll, together with every certificate, PDF file, event and notification the tests
 * create. Seeded categories/templates are left untouched except for the fixture template.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/shared/db/knex.js';
import { hashPassword } from '../src/shared/crypto/password.js';
import { UPLOAD_ROOT } from '../src/shared/storage/upload.js';
import { certificatesService } from '../src/modules/certificates/certificates.service.js';

const PASSWORD = 'Fixture@Pass12345';
const SUFFIX = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);
const TODAY = new Date().toISOString().slice(0, 10);

const userIds = [];
const createdTemplateIds = [];
const createdCategoryIds = [];
let app;
let cls;
let otherCls;
let subject;
let template;
let studentA;
let studentB;
let studentOther;
let studentInactive;
const actors = {};

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

const binary = (req) => req.buffer(true).parse((res, cb) => {
  const chunks = [];
  res.on('data', (c) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
});

async function createStudent(label, name, classId, status = 'ACTIVE') {
  const u = await createUser(4, label, name);
  const [sid] = await db('students').insert({
    user_id: u.id,
    admission_no: `ADM-${label}-${SUFFIX}`.slice(0, 50),
    roll_no: String(90 + userIds.length),
    admission_date: '2026-04-01',
    current_class_id: classId,
    status
  });
  return { id: sid, userId: u.id, username: u.username, name };
}

const issueBody = (overrides = {}) => ({
  templateId: template.id,
  classId: cls.id,
  mode: 'SELECTED',
  studentIds: [studentA.id],
  achievementTitle: 'outstanding results in the November assessments',
  achievementDescription: 'For consistent effort and excellent scores.',
  issueDate: TODAY,
  idempotencyKey: `key-${Math.random().toString(36).slice(2, 12)}`,
  ...overrides
});

const notices = (userId) =>
  db('operational_notifications').where({ user_id: userId, related_record_type: 'Certificate' });

beforeAll(async () => {
  app = createApp();
  const [rows] = await db.raw(
    "SELECT c.id, c.name, COUNT(s.id) n FROM classes c LEFT JOIN students s ON s.current_class_id = c.id AND s.status = 'ACTIVE' GROUP BY c.id, c.name ORDER BY n ASC, c.id DESC LIMIT 2"
  );
  cls = { id: rows[0].id, name: rows[0].name };
  otherCls = { id: rows[1].id, name: rows[1].name };
  const session = (await db('academic_sessions').where({ is_current: 1 }).first()) || (await db('academic_sessions').first());
  const [subjectId] = await db('subjects').insert({ code: `CX${SUFFIX}`.slice(0, 30), name: `Cert Science ${SUFFIX}`.slice(0, 60) });
  subject = { id: subjectId };

  const principal = await createUser(2, 'cprin', 'Fixture Principal');
  const teacherUser = await createUser(3, 'cteach', 'Fixture Teacher Khan');
  const otherTeacherUser = await createUser(3, 'cteach2', 'Fixture Other Teacher');
  const [teacherId] = await db('teachers').insert({ user_id: teacherUser.id, employee_no: `CEMP-${SUFFIX}`, joining_date: '2026-01-01' });
  const [otherTeacherId] = await db('teachers').insert({ user_id: otherTeacherUser.id, employee_no: `CEMP2-${SUFFIX}`, joining_date: '2026-01-01' });
  await db('teacher_assignments').insert({ teacher_id: teacherId, class_id: cls.id, subject_id: subject.id, session_id: session.id, effective_from: '2026-01-01', assigned_by: principal.id });
  await db('teacher_assignments').insert({ teacher_id: otherTeacherId, class_id: otherCls.id, subject_id: subject.id, session_id: session.id, effective_from: '2026-01-01', assigned_by: principal.id });

  studentA = await createStudent('csa', 'Fixture Certificate Alpha', cls.id);
  studentB = await createStudent('csb', 'Fixture Certificate Beta', cls.id);
  studentOther = await createStudent('cso', 'Fixture Other Class Student', otherCls.id);
  studentInactive = await createStudent('csi', 'Fixture Inactive Student', cls.id, 'INACTIVE');

  const parentAUser = await createUser(5, 'cpa', 'Fixture Cert Parent');
  const [parentA] = await db('parents').insert({ user_id: parentAUser.id });
  await db('parent_student').insert({ parent_id: parentA, student_id: studentA.id, linked_by: principal.id, relation: 'FATHER', is_primary: 1 });

  template = await db('certificate_templates').where({ status: 'ACTIVE' }).orderBy('id').first();

  actors.principal = await login(principal.username);
  actors.teacher = await login(teacherUser.username);
  actors.otherTeacher = await login(otherTeacherUser.username);
  actors.studentA = await login(studentA.username);
  actors.studentB = await login(studentB.username);
  actors.parentA = { ...(await login(parentAUser.username)), userId: parentAUser.id };
  actors.teacherUserId = teacherUser.id;
}, 90000);

afterAll(async () => {
  const safe = async (fn) => {
    try {
      await fn();
    } catch (err) {
      console.warn('[cleanup]', err.message);
    }
  };
  const batchIds = await db('certificate_batches').whereIn('issued_by_user_id', userIds).pluck('id');
  const certs = await db('student_certificates').whereIn('batch_id', batchIds).select('id', 'pdf_storage_key');
  const certIds = certs.map((c) => c.id);
  for (const c of certs) {
    const p = path.resolve(UPLOAD_ROOT, c.pdf_storage_key);
    if (p.startsWith(path.resolve(UPLOAD_ROOT, 'certificates') + path.sep) && fs.existsSync(p)) fs.unlinkSync(p);
  }
  await safe(() => db('operational_notifications').where('related_record_type', 'Certificate').whereIn('related_record_id', certIds.map(String)).del());
  await safe(() => db('certificate_events').whereIn('certificate_id', certIds).del());
  await safe(() => db('certificate_events').whereIn('batch_id', batchIds).del());
  await safe(() => db('certificate_events').whereIn('actor_user_id', userIds).del());
  await safe(() => db('student_certificates').whereIn('id', certIds).del());
  await safe(() => db('certificate_batches').whereIn('id', batchIds).del());
  await safe(async () => {
    const tpls = await db('certificate_templates').whereIn('id', createdTemplateIds);
    for (const t of tpls) {
      for (const key of [t.background_storage_key, t.logo_storage_key, t.principal_signature_storage_key]) {
        const p = key && path.resolve(UPLOAD_ROOT, key);
        if (p && p.startsWith(path.resolve(UPLOAD_ROOT, 'certificate-assets') + path.sep) && fs.existsSync(p)) fs.unlinkSync(p);
      }
    }
    await db('certificate_templates').whereIn('id', createdTemplateIds).del();
  });
  await safe(() => db('certificate_categories').whereIn('id', createdCategoryIds).del());
  // The seeded template was deactivated in a test: restore it
  await safe(() => db('certificate_templates').where({ id: template.id }).update({ status: 'ACTIVE' }));
  await safe(() => db('operational_notifications').whereIn('user_id', userIds).del());
  await safe(() => db('parent_student').whereIn('student_id', [studentA.id]).del());
  await safe(() => db('teacher_assignments').where({ subject_id: subject.id }).del());
  await safe(() => db('parents').whereIn('user_id', userIds).del());
  await safe(() => db('teachers').whereIn('user_id', userIds).del());
  await safe(() => db('students').whereIn('user_id', userIds).del());
  await safe(() => db('audit_logs').whereIn('actor_id', userIds).del());
  await safe(() => db('user_sessions').whereIn('user_id', userIds).del());
  await safe(() => db('refresh_tokens').whereIn('user_id', userIds).del());
  await safe(() => db('users').whereIn('id', userIds).del());
  await safe(() => db('subjects').where({ id: subject.id }).del());
  await db.destroy();
}, 90000);

// ===========================================================================
describe('Teacher: catalog, recipients and previews', () => {
  test('teacher browses categories with their templates', async () => {
    const res = await as(actors.teacher).get('/api/v1/certificates/catalog');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(15);
    const academic = res.body.data.find((c) => c.name === 'Academic Excellence');
    expect(academic.templates.length).toBeGreaterThan(0);
    expect(JSON.stringify(res.body)).not.toMatch(/storage_key|certificate-assets\//);
  });

  test('teacher previews a template as a real PDF', async () => {
    const res = await binary(as(actors.teacher).get(`/api/v1/certificates/templates/${template.id}/preview`));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  test('recipients: only assigned classes and their active students', async () => {
    const res = await as(actors.teacher).get('/api/v1/certificates/recipients');
    expect(res.body.data.classes.map((c) => c.id)).toContain(cls.id);
    expect(res.body.data.classes.map((c) => c.id)).not.toContain(otherCls.id);
    const students = await as(actors.teacher).get(`/api/v1/certificates/recipients?classId=${cls.id}`);
    const ids = students.body.data.students.map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining([studentA.id, studentB.id]));
    expect(ids).not.toContain(studentInactive.id);
    expect(students.body.data.subjects.map((s) => s.id)).toContain(subject.id);
    expect((await as(actors.teacher).get(`/api/v1/certificates/recipients?classId=${otherCls.id}`)).status).toBe(403);
  });

  test('personalised preview for a selected student (nothing saved)', async () => {
    const before = await db('student_certificates').count('id as n').first();
    const res = await binary(
      as(actors.teacher).post('/api/v1/certificates/preview').send({ ...issueBody(), studentId: studentA.id, subjectId: subject.id })
    );
    expect(res.status).toBe(200);
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
    const after = await db('student_certificates').count('id as n').first();
    expect(after.n).toBe(before.n);
  });

  test('students, parents and principals cannot use the issuance endpoints', async () => {
    expect((await as(actors.studentA).post('/api/v1/certificates/issue').send(issueBody())).status).toBe(403);
    expect((await as(actors.parentA).post('/api/v1/certificates/issue').send(issueBody())).status).toBe(403);
    expect((await as(actors.principal).post('/api/v1/certificates/issue').send(issueBody())).status).toBe(403);
    expect((await as(actors.studentA).get('/api/v1/certificates/catalog')).status).toBe(403);
  });
});

// ===========================================================================
describe('Teacher: issuance', () => {
  let single;

  test('issues to one assigned student: record, unique ID and stored PDF', async () => {
    const body = issueBody();
    const res = await as(actors.teacher).post('/api/v1/certificates/issue').send(body);
    expect(res.status).toBe(201);
    expect(res.body.data.issuedCount).toBe(1);
    single = { ...res.body.data.certificates[0], key: body.idempotencyKey, body };
    expect(single.certificateNumber).toMatch(/^CES-\d{4}-[0-9A-HJKMNP-TV-Z]{10}$/);
    expect(single.studentName).toBe(studentA.name);
    expect(single.issuedBy).toBe('Fixture Teacher Khan');
    const row = await db('student_certificates').where({ id: single.id }).first();
    const file = path.resolve(UPLOAD_ROOT, row.pdf_storage_key);
    expect(fs.existsSync(file)).toBe(true);
    expect(fs.readFileSync(file).subarray(0, 5).toString()).toBe('%PDF-');
    expect(JSON.stringify(res.body)).not.toContain(row.pdf_storage_key);
  });

  test('a retried request (same key) replays without duplicates or extra notifications', async () => {
    const studentNoticesBefore = (await notices(studentA.userId)).length;
    const parentNoticesBefore = (await notices(actors.parentA.userId)).length;
    expect(studentNoticesBefore).toBe(1);
    expect(parentNoticesBefore).toBe(1);
    const retry = await as(actors.teacher).post('/api/v1/certificates/issue').send(single.body);
    expect(retry.status).toBe(200);
    expect(retry.body.data.replayed).toBe(true);
    expect(retry.body.data.certificates[0].id).toBe(single.id);
    expect(await db('student_certificates').where({ student_id: studentA.id })).toHaveLength(1);
    expect(await notices(studentA.userId)).toHaveLength(1);
    const conflict = await as(actors.teacher).post('/api/v1/certificates/issue').send({ ...single.body, achievementTitle: 'something different' });
    expect(conflict.status).toBe(409);
  });

  test('issues to multiple selected students: one personalised PDF each', async () => {
    const res = await as(actors.teacher).post('/api/v1/certificates/issue').send(issueBody({ studentIds: [studentA.id, studentB.id, studentA.id] }));
    expect(res.status).toBe(201);
    expect(res.body.data.issuedCount).toBe(2);
    const rows = await db('student_certificates').whereIn('id', res.body.data.certificates.map((c) => c.id));
    expect(new Set(rows.map((r) => r.certificate_number)).size).toBe(2);
    expect(new Set(rows.map((r) => r.pdf_storage_key)).size).toBe(2);
    expect(new Set(rows.map((r) => r.pdf_sha256)).size).toBe(2);
    expect(rows.map((r) => r.student_name).sort()).toEqual([studentA.name, studentB.name].sort());
  });

  test('a legitimate repeat award (new request) is allowed', async () => {
    const res = await as(actors.teacher).post('/api/v1/certificates/issue').send(issueBody({ achievementTitle: 'winning the science fair' }));
    expect(res.status).toBe(201);
  });

  test('issues to an entire authorised class', async () => {
    const active = await db('students').where({ current_class_id: cls.id, status: 'ACTIVE' }).count('id as n').first();
    const res = await as(actors.teacher).post('/api/v1/certificates/issue').send(issueBody({ mode: 'CLASS', studentIds: [] }));
    expect(res.status).toBe(201);
    expect(res.body.data.issuedCount).toBe(Number(active.n));
    expect(res.body.data.certificates.map((c) => c.studentId)).not.toContain(studentInactive.id);
  });

  test('rejects unauthorised classes and ineligible recipients (nothing issued)', async () => {
    const before = (await db('student_certificates').count('id as n').first()).n;
    expect((await as(actors.teacher).post('/api/v1/certificates/issue').send(issueBody({ classId: otherCls.id, studentIds: [studentOther.id] }))).status).toBe(403);
    expect((await as(actors.otherTeacher).post('/api/v1/certificates/issue').send(issueBody())).status).toBe(403);
    const mixed = await as(actors.teacher).post('/api/v1/certificates/issue').send(issueBody({ studentIds: [studentA.id, studentOther.id, studentInactive.id] }));
    expect(mixed.status).toBe(422);
    const reasons = mixed.body.error.details.invalidRecipients;
    expect(reasons.find((r) => r.studentId === studentOther.id).reason).toBe('Student is not in the selected class');
    expect(reasons.find((r) => r.studentId === studentInactive.id).reason).toBe('Student status is INACTIVE');
    expect((await db('student_certificates').count('id as n').first()).n).toBe(before);
  });

  test('validates teacher-entered fields and subject scope', async () => {
    expect((await as(actors.teacher).post('/api/v1/certificates/issue').send(issueBody({ achievementTitle: 'x' }))).status).toBe(422);
    expect((await as(actors.teacher).post('/api/v1/certificates/issue').send(issueBody({ issueDate: '2099-01-01' }))).status).toBe(422);
    expect((await as(actors.teacher).post('/api/v1/certificates/issue').send(issueBody({ achievementTitle: 'Emoji 🎉 award' }))).status).toBe(422);
    const otherSubject = await db('subjects').whereNot({ id: subject.id }).first();
    expect((await as(actors.teacher).post('/api/v1/certificates/issue').send(issueBody({ subjectId: otherSubject.id }))).status).toBe(403);
  });

  test('a failure during saving leaves no certificates or files behind', async () => {
    const pdfCountBefore = fs.readdirSync(path.join(UPLOAD_ROOT, 'certificates')).length;
    const certCountBefore = (await db('student_certificates').count('id as n').first()).n;
    const body = issueBody({ studentIds: [studentA.id, studentB.id] });
    // knex defines `transaction` as a non-writable but configurable property
    const original = Object.getOwnPropertyDescriptor(db, 'transaction');
    Object.defineProperty(db, 'transaction', {
      ...original,
      value: async () => {
        throw new Error('simulated database failure');
      }
    });
    try {
      await expect(certificatesService.issue({ id: actors.teacherUserId, role: 'TEACHER' }, body)).rejects.toThrow('simulated database failure');
    } finally {
      Object.defineProperty(db, 'transaction', original);
    }
    await new Promise((r) => setTimeout(r, 200)); // file removal is async
    expect(fs.readdirSync(path.join(UPLOAD_ROOT, 'certificates')).length).toBe(pdfCountBefore);
    expect((await db('student_certificates').count('id as n').first()).n).toBe(certCountBefore);
    const batch = await db('certificate_batches').where({ idempotency_key: body.idempotencyKey }).first();
    expect(batch.status).toBe('FAILED');
    // Retrying the same request afterwards succeeds exactly once
    const retry = await as(actors.teacher).post('/api/v1/certificates/issue').send(body);
    expect(retry.status).toBe(201);
    expect(retry.body.data.issuedCount).toBe(2);
  });

  test('history: search and filters', async () => {
    const all = await as(actors.teacher).get('/api/v1/certificates/issued?limit=100');
    expect(all.status).toBe(200);
    expect(all.body.data.items.every((c) => c.issuedBy === 'Fixture Teacher Khan')).toBe(true);
    const byName = await as(actors.teacher).get(`/api/v1/certificates/issued?search=${encodeURIComponent('Certificate Beta')}`);
    expect(byName.body.data.items.length).toBeGreaterThan(0);
    expect(byName.body.data.items.every((c) => c.studentName === studentB.name)).toBe(true);
    const byNumber = await as(actors.teacher).get(`/api/v1/certificates/issued?search=${single.certificateNumber}`);
    expect(byNumber.body.data.items.map((c) => c.id)).toEqual([single.id]);
    const byCategory = await as(actors.teacher).get(`/api/v1/certificates/issued?categoryId=${template.category_id}&classId=${cls.id}&from=${TODAY}&to=${TODAY}`);
    expect(byCategory.body.data.total).toBe(all.body.data.total);
    const none = await as(actors.teacher).get('/api/v1/certificates/issued?from=2000-01-01&to=2000-01-02');
    expect(none.body.data.total).toBe(0);
    const other = await as(actors.otherTeacher).get('/api/v1/certificates/issued');
    expect(other.body.data.total).toBe(0);
  });

  test('issuing teacher previews and downloads; another teacher cannot', async () => {
    const pdf = await binary(as(actors.teacher).get(`/api/v1/certificates/${single.id}/pdf?download=1`));
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-disposition']).toMatch(/^attachment; filename="CES-/);
    expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');
    expect((await as(actors.otherTeacher).get(`/api/v1/certificates/${single.id}/pdf`)).status).toBe(404);
    const details = await as(actors.teacher).get(`/api/v1/certificates/${single.id}`);
    expect(details.body.data.history[0].action).toBe('ISSUED');
  });
});

// ===========================================================================
describe('Student and parent access', () => {
  test('student sees only their own certificates and downloads a PDF', async () => {
    const res = await as(actors.studentA).get('/api/v1/certificates/mine');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((c) => c.studentId === studentA.id)).toBe(true);
    const pdf = await binary(as(actors.studentA).get(`${res.body.data[0].pdfUrl}?download=1`));
    expect(pdf.status).toBe(200);
    expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  test("student cannot open another student's certificate by changing the id", async () => {
    const bCert = await db('student_certificates').where({ student_id: studentB.id }).first();
    expect((await as(actors.studentA).get(`/api/v1/certificates/${bCert.id}/pdf`)).status).toBe(404);
    expect((await as(actors.studentA).get(`/api/v1/certificates/${bCert.id}`)).status).toBe(404);
    expect((await as(actors.studentA).get('/api/v1/certificates/issued')).status).toBe(403);
  });

  test('student with no certificates gets an empty list', async () => {
    const fresh = await createStudent('csn', 'Fixture No Certs', otherCls.id);
    const a = await login(fresh.username);
    const res = await as(a).get('/api/v1/certificates/mine');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('parent sees and downloads only linked children’s certificates', async () => {
    const own = await as(actors.parentA).get(`/api/v1/certificates/children/${studentA.id}`);
    expect(own.status).toBe(200);
    expect(own.body.data.length).toBeGreaterThan(0);
    expect((await as(actors.parentA).get(`/api/v1/certificates/children/${studentB.id}`)).status).toBe(403);
    expect((await binary(as(actors.parentA).get(own.body.data[0].pdfUrl))).status).toBe(200);
    const bCert = await db('student_certificates').where({ student_id: studentB.id }).first();
    expect((await as(actors.parentA).get(`/api/v1/certificates/${bCert.id}/pdf`)).status).toBe(404);
  });

  test('existing badges still load unchanged for the student', async () => {
    const res = await as(actors.studentA).get('/api/v1/tasks/achievements');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ===========================================================================
describe('Principal / Admin oversight and template management', () => {
  let newTemplateId;

  test('principal views school-wide records with filters and details', async () => {
    const res = await as(actors.principal).get(`/api/v1/certificates/issued?studentId=${studentA.id}&limit=100`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
    const teacherRow = await db('teachers').where({ user_id: actors.teacherUserId }).first();
    const byTeacher = await as(actors.principal).get(`/api/v1/certificates/issued?teacherId=${teacherRow.id}&limit=1`);
    expect(byTeacher.body.data.total).toBeGreaterThan(1);
    const detail = await as(actors.principal).get(`/api/v1/certificates/${res.body.data.items[0].id}`);
    expect(detail.body.data.history.length).toBeGreaterThan(0);
  });

  test('teachers cannot manage categories or templates', async () => {
    expect((await as(actors.teacher).get('/api/v1/certificates/admin/templates')).status).toBe(403);
    expect((await as(actors.teacher).post('/api/v1/certificates/admin/categories').send({ name: 'Hack' })).status).toBe(403);
    expect((await as(actors.teacher).patch(`/api/v1/certificates/admin/templates/${template.id}/status`).send({ status: 'INACTIVE' })).status).toBe(403);
  });

  test('principal manages categories (duplicate names rejected)', async () => {
    const res = await as(actors.principal).post('/api/v1/certificates/admin/categories').send({ name: `Fixture Category ${SUFFIX}`, description: 'Test', sortOrder: 999 });
    expect(res.status).toBe(201);
    createdCategoryIds.push(res.body.data.id);
    expect((await as(actors.principal).post('/api/v1/certificates/admin/categories').send({ name: `Fixture Category ${SUFFIX}` })).status).toBe(409);
    expect((await as(actors.principal).put(`/api/v1/certificates/admin/categories/${res.body.data.id}`).send({ isActive: false })).status).toBe(200);
  });

  test('template validation: unsupported placeholders and non-image assets are rejected', async () => {
    const base = (req) =>
      req
        .field('categoryId', String(template.category_id))
        .field('name', `Fixture Template ${SUFFIX}`)
        .field('certificateTitle', 'Certificate of Testing')
        .field('designPreset', 'MODERN')
        .field('orientation', 'PORTRAIT')
        .field('pageSize', 'A4')
        .field('primaryColor', '#36348e')
        .field('accentColor', '#ffc53a')
        .field('showTeacherSignature', 'true')
        .field('showPrincipalSignature', 'true');
    const badPlaceholder = await base(as(actors.principal).post('/api/v1/certificates/admin/templates')).field('bodyText', 'Awarded to {{student_name}} of {{section_name}}');
    expect(badPlaceholder.status).toBe(422);
    expect(badPlaceholder.body.error.message).toMatch(/section_name/);
    const badAsset = await base(as(actors.principal).post('/api/v1/certificates/admin/templates'))
      .field('bodyText', 'Awarded to {{student_name}} for {{achievement_title}}.')
      .attach('principalSignature', Buffer.from('<svg onload=alert(1)>'), { filename: 'sig.png', contentType: 'image/png' });
    expect(badAsset.status).toBe(422);

    const ok = await base(as(actors.principal).post('/api/v1/certificates/admin/templates'))
      .field('bodyText', 'Awarded to {{student_name}} for {{achievement_title}}.')
      .field('principalName', 'Fixture Principal')
      .attach('principalSignature', PNG_1X1, { filename: 'sig.png', contentType: 'image/png' });
    expect(ok.status).toBe(201);
    newTemplateId = ok.body.data.id;
    createdTemplateIds.push(newTemplateId);
    const preview = await binary(as(actors.principal).get(`/api/v1/certificates/templates/${newTemplateId}/preview`));
    expect(preview.body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  test('design edits bump the template version; renaming does not', async () => {
    await as(actors.principal).put(`/api/v1/certificates/admin/templates/${newTemplateId}`).field('name', `Fixture Template Renamed ${SUFFIX}`);
    expect((await db('certificate_templates').where({ id: newTemplateId }).first()).version).toBe(1);
    await as(actors.principal).put(`/api/v1/certificates/admin/templates/${newTemplateId}`).field('primaryColor', '#14532d');
    expect((await db('certificate_templates').where({ id: newTemplateId }).first()).version).toBe(2);
  });

  test('deactivated templates cannot be used for new issuance; old certificates remain', async () => {
    const issued = await db('student_certificates').where({ template_id: template.id, student_id: studentA.id }).first();
    const sha = issued.pdf_sha256;
    const res = await as(actors.principal).patch(`/api/v1/certificates/admin/templates/${template.id}/status`).send({ status: 'INACTIVE' });
    expect(res.status).toBe(200);
    const catalog = await as(actors.teacher).get('/api/v1/certificates/catalog');
    expect(catalog.body.data.flatMap((c) => c.templates).map((t) => t.id)).not.toContain(template.id);
    expect((await as(actors.teacher).post('/api/v1/certificates/issue').send(issueBody())).status).toBe(422);
    const pdf = await binary(as(actors.studentA).get(`/api/v1/certificates/${issued.id}/pdf`));
    expect(pdf.status).toBe(200);
    expect(crypto.createHash('sha256').update(pdf.body).digest('hex')).toBe(sha);
  });

  test('revocation: staff only, needs a reason, keeps the record and blocks student download', async () => {
    const cert = await db('student_certificates').where({ student_id: studentA.id, status: 'ACTIVE' }).first();
    expect((await as(actors.teacher).post(`/api/v1/certificates/${cert.id}/revoke`).send({ reason: 'wrong student' })).status).toBe(403);
    expect((await as(actors.principal).post(`/api/v1/certificates/${cert.id}/revoke`).send({ reason: 'no' })).status).toBe(422);
    const ok = await as(actors.principal).post(`/api/v1/certificates/${cert.id}/revoke`).send({ reason: 'Issued to the wrong student by mistake' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('REVOKED');
    expect(ok.body.data.history.map((h) => h.action)).toEqual(['ISSUED', 'REVOKED']);
    expect((await as(actors.studentA).get(`/api/v1/certificates/${cert.id}/pdf`)).status).toBe(410);
    expect((await binary(as(actors.principal).get(`/api/v1/certificates/${cert.id}/pdf`))).status).toBe(200);
    const mine = await as(actors.studentA).get('/api/v1/certificates/mine');
    const row = mine.body.data.find((c) => c.id === cert.id);
    expect(row.status).toBe('REVOKED');
    expect(row.revokeReason).toBeUndefined();
    expect((await as(actors.principal).post(`/api/v1/certificates/${cert.id}/revoke`).send({ reason: 'Issued to the wrong student by mistake' })).status).toBe(409);
  });

  test('audit history is retained and visible to staff only', async () => {
    const issued = await db('student_certificates').whereIn('batch_id', db('certificate_batches').select('id').where({ issued_by_user_id: actors.teacherUserId }));
    const events = await db('certificate_events').where({ action: 'ISSUED' }).whereIn('certificate_id', issued.map((c) => c.id));
    expect(events.length).toBe(issued.length);
    const res = await as(actors.principal).get(`/api/v1/certificates/admin/events?templateId=${newTemplateId}`);
    expect(res.body.data.map((e) => e.action)).toEqual(expect.arrayContaining(['TEMPLATE_CREATED', 'TEMPLATE_UPDATED']));
    expect((await as(actors.teacher).get('/api/v1/certificates/admin/events')).status).toBe(403);
  });
});
