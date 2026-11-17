/**
 * Integration tests: editable challan payment details + QR, AI quiz generation,
 * and parent visibility of checked quiz results.
 *
 * All fixtures (class, subject, users, challans, quizzes) are created here with a
 * unique suffix and removed in afterAll. No existing records are modified.
 * The AI provider is stubbed at the fetch boundary; no network call or API key is used.
 */
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/shared/db/knex.js';
import { hashPassword } from '../src/shared/crypto/password.js';
import { aiQuizService, allocateMarks, validateGeneratedQuestions } from '../src/modules/assessments/aiQuiz.service.js';
import { normalizeIban } from '../src/modules/fees/fees.paymentDetails.js';
import { UPLOAD_ROOT } from '../src/shared/storage/upload.js';
import { challanInfoQrService, createVerifyToken, maskName } from '../src/modules/fees/fees.infoQr.js';

const PASSWORD = 'Fixture@Pass12345';
const SUFFIX = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);
const VALID_IBAN = 'PK36SCBL0000001123456702';

const ids = { users: [], challans: [], bankAccounts: [], tests: [] };
let app;
let session;
let cls;
let subject;
const actors = {};
let studentA;
let studentB;

async function createUser(roleId, label, fullName) {
  const [id] = await db('users').insert({
    role_id: roleId,
    username: `t_${label}_${SUFFIX}`.slice(0, 60),
    email: `t_${label}_${SUFFIX}@fixture.test`,
    full_name: fullName,
    password_hash: await hashPassword(PASSWORD),
    must_change_password: 0,
    status: 'ACTIVE'
  });
  ids.users.push(id);
  return { id, username: `t_${label}_${SUFFIX}`.slice(0, 60) };
}

async function login(username) {
  const res = await request(app).post('/api/v1/auth/login').send({ identifier: username, password: PASSWORD });
  if (res.status !== 200) throw new Error(`Login failed for ${username}: ${res.status} ${JSON.stringify(res.body)}`);
  const cookies = res.headers['set-cookie'];
  const csrf = cookies.find((c) => c.startsWith('sms_csrf=')).split(';')[0].split('=')[1];
  return { cookies, csrf };
}

const as = (actor) => ({
  get: (url) => request(app).get(url).set('Cookie', actor.cookies),
  post: (url) => request(app).post(url).set('Cookie', actor.cookies).set('X-CSRF-Token', actor.csrf),
  put: (url) => request(app).put(url).set('Cookie', actor.cookies).set('X-CSRF-Token', actor.csrf),
  patch: (url) => request(app).patch(url).set('Cookie', actor.cookies).set('X-CSRF-Token', actor.csrf)
});

async function createStudent(label, name) {
  const u = await createUser(4, label, name);
  const [sid] = await db('students').insert({
    user_id: u.id,
    admission_no: `ADM-${label}-${SUFFIX}`.slice(0, 50),
    roll_no: label.slice(-2),
    admission_date: '2026-04-01',
    current_class_id: cls.id,
    status: 'ACTIVE'
  });
  await db('enrollments').insert({ student_id: sid, class_id: cls.id, session_id: session.id, enrolled_on: '2026-04-01', status: 'ACTIVE' });
  return { id: sid, userId: u.id, username: u.username, name };
}

async function createChallan(studentId, month, status = 'UNPAID', paid = 0) {
  const def = await db('school_bank_accounts').where({ is_default: true, status: 'ACTIVE' }).first();
  const [id] = await db('fee_challans').insert({
    challan_number: `TST-${SUFFIX}-${studentId}-${month}`.slice(0, 50),
    consumer_number: `9${String(Date.now()).slice(-7)}${Math.floor(Math.random() * 90 + 10)}`.slice(0, 20),
    session_id: session.id,
    class_id: cls.id,
    student_id: studentId,
    billing_month: month,
    issue_date: '2026-11-01',
    due_date: '2026-11-10',
    valid_until: '2026-11-15',
    tuition_amount: 8000,
    technology_amount: 1000,
    gross_amount: 9000,
    concession_amount: 500,
    total_payable: 8500,
    paid_amount: paid,
    status,
    bank_account_id: def ? def.id : null
  });
  ids.challans.push(id);
  return id;
}

// ---------------------------------------------------------------------------
// Fake AI provider (Anthropic-shaped responses)
// ---------------------------------------------------------------------------
function anthropicReply(payload) {
  const body = JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(payload) }], stop_reason: 'end_turn' });
  return { status: 200, text: async () => body, headers: new Headers() };
}

function buildValidQuestions({ count, types, difficulty, topics, prefix = 'Q' }) {
  const levels = ['EASY', 'MEDIUM', 'HARD'];
  return Array.from({ length: count }, (_, i) => {
    const type = types[i % types.length];
    const topic = topics[i % topics.length];
    const q = {
      type,
      difficulty: difficulty === 'MIXED' ? levels[i % 3] : difficulty,
      topic,
      question: `${prefix}${i + 1}: In ${topic}, which statement number ${i + 1} is correct?`,
      explanation: 'Stated directly in the syllabus.'
    };
    if (type === 'MCQ') Object.assign(q, { options: [`Alpha ${i}`, `Beta ${i}`, `Gamma ${i}`, `Delta ${i}`], correctOptionIndex: i % 4 });
    if (type === 'TRUE_FALSE') Object.assign(q, { question: `${prefix}${i + 1}: ${topic} statement ${i + 1} is true.`, answer: i % 2 === 0 });
    if (type === 'FILL_IN_THE_BLANK') Object.assign(q, { question: `${prefix}${i + 1}: The key term of ${topic} is _____ (item ${i + 1}).`, expectedAnswer: `term${i}` });
    if (type === 'SHORT_ANSWER') Object.assign(q, { expectedAnswer: `Model answer ${i}` });
    return q;
  });
}

function fakeAi(handler) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, body });
    return handler(body, calls.length);
  };
  return {
    calls,
    deps: { config: { provider: 'anthropic', apiKey: 'test-key', model: 'test-model', timeoutMs: 5000, configured: true }, fetchImpl }
  };
}

const TOPICS = ['Photosynthesis', 'Plant Cells'];
const SYLLABUS = 'Photosynthesis converts light energy into chemical energy in chloroplasts. Plant cells have a cell wall.';

function quizRequest(overrides = {}) {
  return {
    classId: cls.id,
    subjectId: subject.id,
    title: `Science Quiz ${SUFFIX}`,
    topics: TOPICS,
    syllabus: SYLLABUS,
    difficulty: 'EASY',
    questionCount: 4,
    questionTypes: ['MCQ', 'TRUE_FALSE', 'FILL_IN_THE_BLANK', 'SHORT_ANSWER'],
    totalMarks: 10,
    durationMinutes: 20,
    idempotencyKey: `key-${Math.random().toString(36).slice(2, 12)}`,
    ...overrides
  };
}

// ---------------------------------------------------------------------------
beforeAll(async () => {
  app = createApp();
  session = (await db('academic_sessions').where({ is_current: 1 }).first()) || (await db('academic_sessions').first());

  // classes are constrained to grades 1-8, so fixtures join the existing class with the
  // fewest active students; every notification the tests cause is removed afterwards.
  const [counts] = await db.raw(
    "SELECT c.id, c.name, COUNT(s.id) n FROM classes c LEFT JOIN students s ON s.current_class_id = c.id AND s.status = 'ACTIVE' GROUP BY c.id, c.name ORDER BY n ASC, c.id DESC LIMIT 1"
  );
  cls = { id: counts[0].id, name: counts[0].name };
  const [subjectId] = await db('subjects').insert({ code: `FX${SUFFIX}`.slice(0, 30), name: `Fixture Science ${SUFFIX}`.slice(0, 60) });
  subject = { id: subjectId };

  const principal = await createUser(2, 'prin', 'Fixture Principal');
  const teacherUser = await createUser(3, 'teach', 'Fixture Teacher');
  const otherTeacherUser = await createUser(3, 'teach2', 'Fixture Other Teacher');
  const [teacherId] = await db('teachers').insert({ user_id: teacherUser.id, employee_no: `EMP-${SUFFIX}`, joining_date: '2026-01-01' });
  await db('teachers').insert({ user_id: otherTeacherUser.id, employee_no: `EMP2-${SUFFIX}`, joining_date: '2026-01-01' });
  await db('teacher_assignments').insert({
    teacher_id: teacherId,
    class_id: cls.id,
    subject_id: subject.id,
    session_id: session.id,
    effective_from: '2026-01-01',
    assigned_by: principal.id
  });

  studentA = await createStudent('sa', 'Fixture Student Alpha');
  studentB = await createStudent('sb', 'Fixture Student Beta');

  const parentAUser = await createUser(5, 'pa', 'Fixture Parent Alpha');
  const parentBUser = await createUser(5, 'pb', 'Fixture Parent Beta');
  const [parentA] = await db('parents').insert({ user_id: parentAUser.id });
  const [parentB] = await db('parents').insert({ user_id: parentBUser.id });
  await db('parent_student').insert({ parent_id: parentA, student_id: studentA.id, linked_by: principal.id, relation: 'FATHER', is_primary: 1 });
  await db('parent_student').insert({ parent_id: parentB, student_id: studentB.id, linked_by: principal.id, relation: 'MOTHER', is_primary: 1 });

  actors.principal = await login(principal.username);
  actors.teacher = await login(teacherUser.username);
  actors.otherTeacher = await login(otherTeacherUser.username);
  actors.parentA = { ...(await login(parentAUser.username)), userId: parentAUser.id };
  actors.parentB = { ...(await login(parentBUser.username)), userId: parentBUser.id };
  actors.studentA = await login(studentA.username);
  actors.studentB = await login(studentB.username);
  actors.teacherUser = { id: teacherUser.id, role: 'TEACHER' };
}, 60000);

afterAll(async () => {
  const safe = async (fn) => {
    try {
      await fn();
    } catch (err) {
      console.warn('[cleanup]', err.message);
    }
  };
  if (!cls) return db.destroy();
  const testIds = (await db('monthly_tests').where({ subject_id: subject.id }).pluck('id')) || [];
  await safe(() => db('operational_notifications').where('related_record_type', 'MonthlyTest').whereIn('related_record_id', testIds.map(String)).del());
  await safe(() => db('operational_notifications').where('title', 'like', `%${SUFFIX}%`).del());
  await safe(() => db('assessment_result_notifications').whereIn('test_id', testIds).del());
  await safe(() => db('test_attempts').whereIn('test_id', testIds).del());
  await safe(() => db('monthly_tests').whereIn('id', testIds).del());
  await safe(() => db('ai_quiz_generations').whereIn('requested_by', ids.users).del());
  // Remove QR images written for fixture challans (all revisions)
  await safe(async () => {
    const keys = await db('fee_challan_payment_details').whereIn('challan_id', ids.challans).whereNotNull('qr_storage_key').pluck('qr_storage_key');
    for (const key of keys) {
      const file = path.resolve(UPLOAD_ROOT, key);
      if (file.startsWith(path.resolve(UPLOAD_ROOT, 'challan-qr') + path.sep) && fs.existsSync(file)) fs.unlinkSync(file);
    }
  });
  await safe(() => db('fee_payment_proofs').whereIn('challan_id', ids.challans).del());
  await safe(() => db('fee_challans').whereIn('id', ids.challans).del());
  await safe(() => db('school_bank_accounts').whereIn('id', ids.bankAccounts).del());
  await safe(() => db('operational_notifications').whereIn('user_id', ids.users).del());
  await safe(() => db('audit_logs').whereIn('actor_id', ids.users).del());
  await safe(() => db('parent_student').whereIn('student_id', [studentA.id, studentB.id]).del());
  await safe(() => db('enrollments').whereIn('student_id', [studentA.id, studentB.id]).del());
  await safe(() => db('teacher_assignments').where({ subject_id: subject.id }).del());
  await safe(() => db('parents').whereIn('user_id', ids.users).del());
  await safe(() => db('teachers').whereIn('user_id', ids.users).del());
  await safe(() => db('students').whereIn('user_id', ids.users).del());
  await safe(() => db('user_sessions').whereIn('user_id', ids.users).del());
  await safe(() => db('refresh_tokens').whereIn('user_id', ids.users).del());
  await safe(() => db('users').whereIn('id', ids.users).del());
  await safe(() => db('subjects').where({ id: subject.id }).del());
  await db.destroy();
}, 60000);

// ===========================================================================
// FEATURE 1: Challan payment details & QR
// ===========================================================================
describe('Challan payment details and QR code', () => {
  let challanA;
  let challanB;
  let paidChallanA;
  let originalB;
  let financialBefore;

  beforeAll(async () => {
    challanA = await createChallan(studentA.id, 'November 2026');
    challanB = await createChallan(studentB.id, 'November 2026');
    paidChallanA = await createChallan(studentA.id, 'October 2026', 'PAID', 8500);
    financialBefore = await db('fee_challans').where({ id: challanA }).first();
  });

  test('IBAN validation accepts a valid IBAN and rejects a bad checksum', () => {
    expect(normalizeIban('pk36 scbl 0000 0011 2345 6702')).toBe(VALID_IBAN);
    expect(() => normalizeIban('PK36SCBL0000001123456703')).toThrow(/checksum/);
  });

  test('Principal views current details: a frozen issued snapshot (revision 1)', async () => {
    const res = await as(actors.principal).get(`/api/v1/fees/challans/${challanA}/payment-details`);
    expect(res.status).toBe(200);
    expect(res.body.data.current.revision).toBe(1);
    expect(res.body.data.current.source).toBe('ISSUED_SNAPSHOT');
    expect(res.body.data.editable).toBe(true);
    const resB = await as(actors.principal).get(`/api/v1/fees/challans/${challanB}/payment-details`);
    originalB = resB.body.data.current;
  });

  test('Teachers, parents and students cannot read or edit payment details (403)', async () => {
    for (const actor of [actors.teacher, actors.parentA, actors.studentA]) {
      const r1 = await as(actor).get(`/api/v1/fees/challans/${challanA}/payment-details`);
      expect(r1.status).toBe(403);
      const r2 = await as(actor)
        .put(`/api/v1/fees/challans/${challanA}/payment-details`)
        .field('accountTitle', 'HACKED')
        .field('paymentMethod', 'Raast')
        .field('accountNumber', '123')
        .field('reason', 'attempted change')
        .field('confirmRevision', 'true')
        .field('expectedRevision', '1');
      expect(r2.status).toBe(403);
    }
    const res = await as(actors.principal).get(`/api/v1/fees/challans/${challanA}/payment-details`);
    expect(res.body.data.current.accountTitle).not.toBe('HACKED');
  });

  test('Editing an issued challan requires explicit confirmation', async () => {
    const res = await as(actors.principal)
      .put(`/api/v1/fees/challans/${challanA}/payment-details`)
      .field('accountTitle', 'CES Fee Collection')
      .field('paymentMethod', 'Online Banking / IBFT')
      .field('accountNumber', '0011223344')
      .field('reason', 'Collect via the new fee account')
      .field('expectedRevision', '1');
    expect(res.status).toBe(422);
    expect(res.body.error?.details?.requiresConfirmation).toBe(true);
  });

  test('Principal edits recipient details for one student: new revision, amounts untouched', async () => {
    const res = await as(actors.principal)
      .put(`/api/v1/fees/challans/${challanA}/payment-details`)
      .field('accountTitle', 'CES Fee Collection')
      .field('bankName', 'Standard Chartered')
      .field('branchName', 'Blue Area')
      .field('accountNumber', '0011223344')
      .field('iban', VALID_IBAN)
      .field('paymentMethod', 'Online Banking / IBFT')
      .field('instructions', 'Write the challan number in the transfer reference.')
      .field('reason', 'Collect via the new fee account')
      .field('confirmRevision', 'true')
      .field('expectedRevision', '1');
    expect(res.status).toBe(200);
    expect(res.body.data.current.revision).toBe(2);
    expect(res.body.data.current.accountTitle).toBe('CES Fee Collection');
    expect(res.body.data.history).toHaveLength(2);

    const after = await db('fee_challans').where({ id: challanA }).first();
    for (const f of ['total_payable', 'paid_amount', 'concession_amount', 'arrears_amount', 'gross_amount', 'status', 'tuition_amount']) {
      expect(after[f]).toEqual(financialBefore[f]);
    }
  });

  test('A retried save with the old revision is rejected (no duplicate revision)', async () => {
    const res = await as(actors.principal)
      .put(`/api/v1/fees/challans/${challanA}/payment-details`)
      .field('accountTitle', 'CES Fee Collection')
      .field('accountNumber', '0011223344')
      .field('paymentMethod', 'Online Banking / IBFT')
      .field('reason', 'Collect via the new fee account')
      .field('confirmRevision', 'true')
      .field('expectedRevision', '1');
    expect(res.status).toBe(409);
    const count = await db('fee_challan_payment_details').where({ challan_id: challanA }).count('id as n').first();
    expect(Number(count.n)).toBe(2);
  });

  test("Another student's challan is unchanged", async () => {
    const res = await as(actors.principal).get(`/api/v1/fees/challans/${challanB}/payment-details`);
    expect(res.body.data.current.revision).toBe(1);
    expect(res.body.data.current.accountTitle).toBe(originalB.accountTitle);
    expect(res.body.data.current.accountNumber).toBe(originalB.accountNumber);
  });

  test('QR upload: rejects non-images and unattested QR codes', async () => {
    const fake = await as(actors.principal)
      .put(`/api/v1/fees/challans/${challanA}/payment-details`)
      .field('accountTitle', 'CES Fee Collection')
      .field('bankName', 'Standard Chartered')
      .field('branchName', 'Blue Area')
      .field('accountNumber', '0011223344')
      .field('iban', VALID_IBAN)
      .field('paymentMethod', 'Online Banking / IBFT')
      .field('reason', 'Add payment QR code')
      .field('confirmRevision', 'true')
      .field('expectedRevision', '2')
      .field('qrAction', 'replace')
      .field('qrAttested', 'true')
      .attach('qr', Buffer.from('not really an image at all'), { filename: 'qr.png', contentType: 'image/png' });
    expect(fake.status).toBe(422);
    expect(fake.body.error.message).toMatch(/PNG, JPEG or WebP/);

    const unattested = await as(actors.principal)
      .put(`/api/v1/fees/challans/${challanA}/payment-details`)
      .field('accountTitle', 'CES Fee Collection')
      .field('accountNumber', '0011223344')
      .field('paymentMethod', 'Online Banking / IBFT')
      .field('reason', 'Add payment QR code')
      .field('confirmRevision', 'true')
      .field('expectedRevision', '2')
      .field('qrAction', 'replace')
      .attach('qr', PNG_1X1, { filename: 'qr.png', contentType: 'image/png' });
    expect(unattested.status).toBe(422);
    expect(unattested.body.error.message).toMatch(/verified this QR/);
  });

  test('QR upload: principal uploads and enables a QR; it appears in challan data for preview/print', async () => {
    const res = await as(actors.principal)
      .put(`/api/v1/fees/challans/${challanA}/payment-details`)
      .field('accountTitle', 'CES Fee Collection')
      .field('bankName', 'Standard Chartered')
      .field('branchName', 'Blue Area')
      .field('accountNumber', '0011223344')
      .field('iban', VALID_IBAN)
      .field('paymentMethod', 'Online Banking / IBFT')
      .field('instructions', 'Write the challan number in the transfer reference.')
      .field('reason', 'Add payment QR code')
      .field('confirmRevision', 'true')
      .field('expectedRevision', '2')
      .field('qrAction', 'replace')
      .field('qrAttested', 'true')
      .field('qrEnabled', 'true')
      .field('qrLabel', 'CES Fee Collection (SCB)')
      .attach('qr', PNG_1X1, { filename: 'qr.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.data.current.revision).toBe(3);
    expect(res.body.data.current.qr.enabled).toBe(true);
    expect(res.body.data.current.qr.url).toMatch(new RegExp(`/api/v1/fees/challans/${challanA}/payment-qr\\?rev=3$`));
    expect(JSON.stringify(res.body)).not.toMatch(/challan-qr\//); // storage path never exposed

    // Principal challan list (used by the print/PDF voucher)
    const list = await as(actors.principal).get(`/api/v1/fees/challans?studentId=${studentA.id}`);
    const row = list.body.data.find((c) => c.id === challanA);
    expect(row.bankAccount.accountTitle).toBe('CES Fee Collection');
    expect(row.bankAccount.iban).toBe(VALID_IBAN);
    expect(row.paymentDetails.qr.enabled).toBe(true);

    // Parent voucher (parent portal print/PDF)
    const detail = await as(actors.parentA).get(`/api/v1/parents/me/children/${studentA.id}/challans/${challanA}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.bankAccount.accountTitle).toBe('CES Fee Collection');
    expect(detail.body.data.paymentDetails.qr.enabled).toBe(true);
    expect(detail.body.data.paymentDetails.paymentMethod).toBe('Online Banking / IBFT');
  });

  test('QR image is served only to users who may view the challan', async () => {
    const own = await as(actors.parentA).get(`/api/v1/fees/challans/${challanA}/payment-qr`).buffer(true);
    expect(own.status).toBe(200);
    expect(own.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(own.body, PNG_1X1)).toBe(0);
    expect((await as(actors.studentA).get(`/api/v1/fees/challans/${challanA}/payment-qr`)).status).toBe(200);
    expect((await as(actors.parentB).get(`/api/v1/fees/challans/${challanA}/payment-qr`)).status).toBe(403);
    expect((await as(actors.studentB).get(`/api/v1/fees/challans/${challanA}/payment-qr`)).status).toBe(403);
  });

  test('Changing the recipient while keeping an old QR is blocked', async () => {
    const res = await as(actors.principal)
      .put(`/api/v1/fees/challans/${challanA}/payment-details`)
      .field('accountTitle', 'Different Recipient')
      .field('accountNumber', '999999')
      .field('paymentMethod', 'Online Banking / IBFT')
      .field('reason', 'Switch recipient')
      .field('confirmRevision', 'true')
      .field('expectedRevision', '3')
      .field('qrAction', 'keep')
      .field('qrEnabled', 'true');
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/QR code may no longer pay/);
  });

  test('Principal replaces then removes the QR code', async () => {
    const replaced = await as(actors.principal)
      .put(`/api/v1/fees/challans/${challanA}/payment-details`)
      .field('accountTitle', 'CES Fee Collection')
      .field('bankName', 'Standard Chartered')
      .field('branchName', 'Blue Area')
      .field('accountNumber', '0011223344')
      .field('iban', VALID_IBAN)
      .field('paymentMethod', 'Online Banking / IBFT')
      .field('instructions', 'Write the challan number in the transfer reference.')
      .field('reason', 'Replace QR with the bank-issued one')
      .field('confirmRevision', 'true')
      .field('expectedRevision', '3')
      .field('qrAction', 'replace')
      .field('qrAttested', 'true')
      .field('qrEnabled', 'true')
      .attach('qr', Buffer.concat([PNG_1X1, Buffer.from([0])]), { filename: 'qr2.png', contentType: 'image/png' });
    expect(replaced.status).toBe(200);
    expect(replaced.body.data.current.revision).toBe(4);
    const shaRows = await db('fee_challan_payment_details').where({ challan_id: challanA }).whereIn('revision_no', [3, 4]).pluck('qr_sha256');
    expect(new Set(shaRows).size).toBe(2);

    const removed = await as(actors.principal)
      .put(`/api/v1/fees/challans/${challanA}/payment-details`)
      .field('accountTitle', 'CES Fee Collection')
      .field('bankName', 'Standard Chartered')
      .field('branchName', 'Blue Area')
      .field('accountNumber', '0011223344')
      .field('iban', VALID_IBAN)
      .field('paymentMethod', 'Online Banking / IBFT')
      .field('instructions', 'Write the challan number in the transfer reference.')
      .field('reason', 'QR no longer used')
      .field('confirmRevision', 'true')
      .field('expectedRevision', '4')
      .field('qrAction', 'remove');
    expect(removed.status).toBe(200);
    expect(removed.body.data.current.qr.uploaded).toBe(false);
    expect((await as(actors.parentA).get(`/api/v1/fees/challans/${challanA}/payment-qr`)).status).toBe(404);
    // Staff can still retrieve the historical QR of revision 3 for audit
    expect((await as(actors.principal).get(`/api/v1/fees/challans/${challanA}/payment-qr?rev=3`)).status).toBe(200);
  });

  test('Paid challan keeps its original payment details (edit and reassignment refused)', async () => {
    const before = await db('fee_challans').where({ id: paidChallanA }).first();
    const res = await as(actors.principal)
      .put(`/api/v1/fees/challans/${paidChallanA}/payment-details`)
      .field('accountTitle', 'Should Not Apply')
      .field('accountNumber', '1234')
      .field('paymentMethod', 'Raast')
      .field('reason', 'try to edit paid challan')
      .field('confirmRevision', 'true')
      .field('expectedRevision', '1');
    expect(res.status).toBe(409);
    const def = await db('school_bank_accounts').where({ status: 'ACTIVE' }).first();
    const reassign = await as(actors.principal).put(`/api/v1/fees/challans/${paidChallanA}/bank-account`).send({ bankAccountId: def.id });
    expect(reassign.status).toBe(409);
    const after = await db('fee_challans').where({ id: paidChallanA }).first();
    expect(after).toEqual(before);
    const revs = await db('fee_challan_payment_details').where({ challan_id: paidChallanA });
    expect(revs).toHaveLength(1);
  });

  test('Editing a shared bank account no longer rewrites already-issued challans', async () => {
    const created = await as(actors.principal).post('/api/v1/fees/bank-accounts').send({
      bankName: 'Fixture Bank',
      accountTitle: 'Fixture Title Original',
      accountNumber: '55550000'
    });
    expect([200, 201]).toContain(created.status);
    ids.bankAccounts.push(created.body.data.id);
    const reassign = await as(actors.principal).put(`/api/v1/fees/challans/${challanB}/bank-account`).send({ bankAccountId: created.body.data.id });
    expect(reassign.status).toBe(200);

    const edit = await as(actors.principal).put(`/api/v1/fees/bank-accounts/${created.body.data.id}`).send({ accountTitle: 'Fixture Title EDITED' });
    expect(edit.status).toBe(200);

    const res = await as(actors.principal).get(`/api/v1/fees/challans/${challanB}/payment-details`);
    expect(res.body.data.current.source).toBe('BANK_REASSIGNMENT');
    expect(res.body.data.current.accountTitle).toBe('Fixture Title Original');
  });

  test('Every change is recorded in the audit log with who/what', async () => {
    const rows = await db('audit_logs')
      .where({ action: 'CHALLAN_PAYMENT_DETAILS_REVISED' })
      .where('record_identifier', 'like', `%(ID: ${challanA})%`);
    expect(rows.length).toBe(4);
    const rev2 = rows.find((r) => r.record_identifier.endsWith('rev 2'));
    expect(rev2.actor_role).toBe('PRINCIPAL');
    expect(JSON.parse(rev2.new_value).accountTitle).toBe('CES Fee Collection');
    expect(JSON.parse(rev2.previous_value).revision).toBe(1);
    expect(rev2.reason).toBe('Collect via the new fee account');
  });

  test('Information QR: PNG for authorised viewers only, encoding the current challan details', async () => {
    const own = await as(actors.parentA).get(`/api/v1/fees/challans/${challanA}/info-qr`).buffer(true);
    expect(own.status).toBe(200);
    expect(own.headers['content-type']).toBe('image/png');
    expect(own.body.subarray(0, 4).toString('hex')).toBe('89504e47');
    expect((await as(actors.principal).get(`/api/v1/fees/challans/${challanA}/info-qr`)).status).toBe(200);
    expect((await as(actors.parentB).get(`/api/v1/fees/challans/${challanA}/info-qr`)).status).toBe(403);
    expect((await request(app).get(`/api/v1/fees/challans/${challanA}/info-qr`)).status).toBe(401);

    const { text } = await challanInfoQrService.renderForUser({ id: 0, role: 'PRINCIPAL' }, challanA);
    const challan = await db('fee_challans').where({ id: challanA }).first();
    expect(text).toContain(`Challan: ${challan.challan_number}`);
    expect(text).toContain(`Consumer No: ${challan.consumer_number}`);
    expect(text).toContain(studentA.name);
    expect(text).toContain('Payable by 10 Nov 2026: Rs 8,500');
    // Frozen current revision, not the live default bank account
    expect(text).toContain('Pay to: CES Fee Collection');
    expect(text).toContain(`IBAN: ${VALID_IBAN}`);
    expect(text).toMatch(/Verify: .*\/api\/v1\/public\/challans\/verify\/[0-9a-z]+\.[A-Za-z0-9_-]{22}$/);
  });

  test('Public verification page: genuine token shows masked details; tampered token is rejected', async () => {
    const challan = await db('fee_challans').where({ id: challanA }).first();
    const token = createVerifyToken(challan);
    const ok = await request(app).get(`/api/v1/public/challans/verify/${token}`); // no login
    expect(ok.status).toBe(200);
    expect(ok.headers['content-type']).toMatch(/text\/html/);
    expect(ok.text).toContain('Genuine fee challan');
    expect(ok.text).toContain(challan.challan_number);
    expect(ok.text).toContain('Rs 8,500');
    expect(ok.text).toContain('CES Fee Collection');
    expect(ok.text).toContain(maskName(studentA.name));
    expect(ok.text).not.toContain(studentA.name);

    const forged = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
    const bad = await request(app).get(`/api/v1/public/challans/verify/${forged}`);
    expect(bad.status).toBe(404);
    expect(bad.text).toContain('Not verified');
    // A valid signature cannot be reused for another challan id
    const otherId = Number(challanB).toString(36);
    const swapped = await request(app).get(`/api/v1/public/challans/verify/${otherId}.${token.split('.')[1]}`);
    expect(swapped.status).toBe(404);
  });
});

// ===========================================================================
// FEATURE 2: AI quiz generation
// ===========================================================================
describe('AI quiz generator', () => {
  test.each(['EASY', 'MEDIUM', 'HARD', 'MIXED'])('generates a valid %s quiz from the supplied topics', async (difficulty) => {
    const ai = fakeAi((body) => anthropicReply({ questions: buildValidQuestions({ count: 6, types: ['MCQ', 'TRUE_FALSE', 'FILL_IN_THE_BLANK', 'SHORT_ANSWER'], difficulty, topics: TOPICS }) }));
    const result = await aiQuizService.generateQuiz(actors.teacherUser, quizRequest({ difficulty, questionCount: 6, totalMarks: 15 }), ai.deps);

    expect(result.questions).toHaveLength(6);
    expect(result.questions.reduce((s, q) => s + q.marks, 0)).toBe(15);
    for (const q of result.questions) {
      expect(TOPICS).toContain(q.aiMeta.topic);
      if (difficulty !== 'MIXED') expect(q.aiMeta.difficulty).toBe(difficulty);
      expect(['MCQ', 'SHORT_ANSWER']).toContain(q.questionType);
      if (q.questionType === 'MCQ') expect(q.options.map((o) => o.key)).toContain(q.correctOption);
    }
    const tf = result.questions.find((q) => q.aiMeta.sourceType === 'TRUE_FALSE');
    expect(tf.options).toEqual([{ key: 'A', text: 'True' }, { key: 'B', text: 'False' }]);
    if (difficulty === 'MIXED') expect(new Set(result.questions.map((q) => q.aiMeta.difficulty)).size).toBeGreaterThan(1);

    // The syllabus and topics are sent to the model; the API key only in headers
    const prompt = ai.calls[0].body.messages[0].content;
    expect(prompt).toContain(SYLLABUS);
    expect(prompt).toContain('"Photosynthesis"');
    expect(JSON.stringify(ai.calls[0].body)).not.toContain('test-key');
  });

  test('a retried request with the same idempotency key does not call the provider again', async () => {
    const ai = fakeAi(() => anthropicReply({ questions: buildValidQuestions({ count: 4, types: ['MCQ', 'TRUE_FALSE', 'FILL_IN_THE_BLANK', 'SHORT_ANSWER'], difficulty: 'EASY', topics: TOPICS }) }));
    const req = quizRequest();
    const first = await aiQuizService.generateQuiz(actors.teacherUser, req, ai.deps);
    const second = await aiQuizService.generateQuiz(actors.teacherUser, req, ai.deps);
    expect(ai.calls).toHaveLength(1);
    expect(second.cached).toBe(true);
    expect(second.generationId).toBe(first.generationId);
    await expect(aiQuizService.generateQuiz(actors.teacherUser, { ...req, difficulty: 'HARD' }, ai.deps)).rejects.toMatchObject({ statusCode: 409 });
  });

  test('invalid AI output (duplicates / ambiguous options / off-syllabus) is rejected and nothing is saved', async () => {
    const bad = buildValidQuestions({ count: 4, types: ['MCQ', 'TRUE_FALSE', 'FILL_IN_THE_BLANK', 'SHORT_ANSWER'], difficulty: 'EASY', topics: TOPICS });
    bad[1].question = bad[0].question; // duplicate
    bad[0].options[3] = 'All of the above';
    bad[2].topic = 'Quantum Mechanics';
    const ai = fakeAi(() => anthropicReply({ questions: bad }));
    const testsBefore = await db('monthly_tests').where({ subject_id: subject.id }).count('id as n').first();
    const req = quizRequest();
    await expect(aiQuizService.generateQuiz(actors.teacherUser, req, ai.deps)).rejects.toMatchObject({ statusCode: 502, code: 'AI_INVALID_OUTPUT' });
    expect(ai.calls).toHaveLength(2); // one corrective retry, then fail
    const row = await db('ai_quiz_generations').where({ idempotency_key: req.idempotencyKey }).first();
    expect(row.status).toBe('FAILED');
    expect(row.result_questions).toBeNull();
    const testsAfter = await db('monthly_tests').where({ subject_id: subject.id }).count('id as n').first();
    expect(testsAfter.n).toBe(testsBefore.n);

    const { issues } = validateGeneratedQuestions({ questions: bad }, { expectedCount: 4, allowedTypes: ['MCQ', 'TRUE_FALSE', 'FILL_IN_THE_BLANK', 'SHORT_ANSWER'], difficulty: 'EASY', topics: TOPICS, allowOutsideSyllabus: false });
    expect(issues.join(' ')).toMatch(/duplicate/);
    expect(issues.join(' ')).toMatch(/all\/none of the above/);
    expect(issues.join(' ')).toMatch(/Quantum Mechanics/);
  });

  test('malformed JSON and wrong difficulty are rejected', async () => {
    const ai = fakeAi((body, n) =>
      n === 1
        ? { status: 200, text: async () => JSON.stringify({ content: [{ type: 'text', text: 'Sure! Here are questions: not json' }] }), headers: new Headers() }
        : anthropicReply({ questions: buildValidQuestions({ count: 4, types: ['MCQ', 'TRUE_FALSE', 'FILL_IN_THE_BLANK', 'SHORT_ANSWER'], difficulty: 'EASY', topics: TOPICS }) })
    );
    await expect(aiQuizService.generateQuiz(actors.teacherUser, quizRequest({ difficulty: 'HARD' }), ai.deps)).rejects.toMatchObject({ code: 'AI_INVALID_OUTPUT' });
  });

  test('provider failures map to clear errors (network 503, rate limit 429)', async () => {
    const down = fakeAi(() => {
      throw new TypeError('fetch failed');
    });
    await expect(aiQuizService.generateQuiz(actors.teacherUser, quizRequest(), down.deps)).rejects.toMatchObject({ statusCode: 503, code: 'AI_UNAVAILABLE' });
    const limited = fakeAi(() => ({ status: 429, text: async () => '{"error":{"message":"rate"}}', headers: new Headers({ 'retry-after': '30' }) }));
    await expect(aiQuizService.generateQuiz(actors.teacherUser, quizRequest(), limited.deps)).rejects.toMatchObject({ statusCode: 429 });
  });

  test('HTTP: unconfigured provider returns 503 and manual quiz creation still works', async () => {
    const saved = { a: process.env.ANTHROPIC_API_KEY, g: process.env.GEMINI_API_KEY, p: process.env.AI_PROVIDER };
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.AI_PROVIDER;
    try {
      const status = await as(actors.teacher).get('/api/v1/assessments/ai/status');
      expect(status.body.data.configured).toBe(false);
      const gen = await as(actors.teacher).post('/api/v1/assessments/ai/generate').send(quizRequest());
      expect(gen.status).toBe(503);
      expect(gen.body.error.code).toBe('AI_UNAVAILABLE');
      expect(JSON.stringify(gen.body)).not.toMatch(/stack|api[_-]?key/i);
    } finally {
      if (saved.a) process.env.ANTHROPIC_API_KEY = saved.a;
      if (saved.g) process.env.GEMINI_API_KEY = saved.g;
      if (saved.p) process.env.AI_PROVIDER = saved.p;
    }
    const manual = await as(actors.teacher).post('/api/v1/assessments').send({
      classId: cls.id,
      subjectId: subject.id,
      examType: 'CLASS_QUIZ',
      title: `Manual quiz after AI outage ${SUFFIX}`,
      durationMinutes: 10,
      passingMarks: 1,
      availableFrom: new Date(Date.now() - 60000).toISOString(),
      availableUntil: new Date(Date.now() + 3600000).toISOString(),
      questions: [{ questionType: 'MCQ', prompt: 'Manual MCQ?', marks: 2, options: [{ key: 'A', text: 'x' }, { key: 'B', text: 'y' }], correctOption: 'A' }]
    });
    expect(manual.status).toBe(201);
    expect(manual.body.data.ai_review_status).toBe('NOT_APPLICABLE');
  });

  test('teacher cannot generate for a class/subject they do not teach', async () => {
    const res = await as(actors.otherTeacher).post('/api/v1/assessments/ai/generate').send(quizRequest());
    expect(res.status).toBe(403);
  });

  test('regenerating one question avoids existing questions and keeps the marks', async () => {
    const ai = fakeAi(() => anthropicReply({ questions: buildValidQuestions({ count: 1, types: ['MCQ'], difficulty: 'MEDIUM', topics: TOPICS, prefix: 'R' }) }));
    const res = await aiQuizService.regenerateQuestion(
      actors.teacherUser,
      {
        classId: cls.id,
        subjectId: subject.id,
        topics: TOPICS,
        syllabus: SYLLABUS,
        difficulty: 'MEDIUM',
        questionType: 'MCQ',
        marks: 3,
        existingQuestions: ['Q1: existing question text'],
        idempotencyKey: `regen-${SUFFIX}`
      },
      ai.deps
    );
    expect(res.question.marks).toBe(3);
    expect(res.question.questionType).toBe('MCQ');
    expect(ai.calls[0].body.messages[0].content).toContain('Q1: existing question text');
  });

  test('marks allocation always sums to the requested total', () => {
    expect(allocateMarks(['MCQ', 'MCQ', 'SHORT_ANSWER'], 10).reduce((a, b) => a + b, 0)).toBe(10);
    expect(allocateMarks(['MCQ', 'SHORT_ANSWER', 'SHORT_ANSWER', 'MCQ', 'TRUE_FALSE'], 5)).toEqual([1, 1, 1, 1, 1]);
    expect(allocateMarks(Array(7).fill('SHORT_ANSWER'), 23).reduce((a, b) => a + b, 0)).toBe(23);
  });

  describe('teacher review, draft and publish', () => {
    let generation;
    let draftId;

    beforeAll(async () => {
      const ai = fakeAi(() => anthropicReply({ questions: buildValidQuestions({ count: 4, types: ['MCQ', 'TRUE_FALSE', 'FILL_IN_THE_BLANK', 'SHORT_ANSWER'], difficulty: 'MEDIUM', topics: TOPICS }) }));
      generation = await aiQuizService.generateQuiz(actors.teacherUser, quizRequest({ difficulty: 'MEDIUM', title: `AI Draft Quiz ${SUFFIX}` }), ai.deps);
    });

    const payloadFrom = (gen, extra = {}) => {
      const edited = gen.questions.map((q, i) => (i === 0 ? { ...q, prompt: 'Teacher-edited question text?', marks: 4 } : q)).slice(0, 3); // edit one, delete one
      edited.push({ questionType: 'SHORT_ANSWER', prompt: 'Teacher added: explain photosynthesis.', marks: 3, options: [], rubricGuide: 'Light to chemical energy' });
      return {
        classId: cls.id,
        subjectId: subject.id,
        examType: 'CLASS_QUIZ',
        title: `AI Draft Quiz ${SUFFIX}`,
        durationMinutes: 20,
        passingMarks: 4,
        availableFrom: new Date(Date.now() - 60000).toISOString(),
        availableUntil: new Date(Date.now() + 3600000).toISOString(),
        aiGenerationId: gen.generationId,
        questions: edited,
        ...extra
      };
    };

    test('publishing an AI quiz without review confirmation is refused', async () => {
      const res = await as(actors.teacher).post('/api/v1/assessments').send(payloadFrom(generation, { status: 'PUBLISHED', publishImmediately: true }));
      expect(res.status).toBe(422);
      expect(res.body.error.details.requiresAiReviewConfirmation).toBe(true);
    });

    test('teacher saves the edited AI quiz as a draft; a retried save does not duplicate it', async () => {
      const res = await as(actors.teacher).post('/api/v1/assessments').send(payloadFrom(generation));
      expect(res.status).toBe(201);
      draftId = res.body.data.id;
      expect(res.body.data.status).toBe('DRAFT');
      expect(res.body.data.ai_review_status).toBe('PENDING_REVIEW');
      expect(res.body.data.questions).toHaveLength(4);
      expect(res.body.data.questions[0].question_text).toBe('Teacher-edited question text?');
      expect(res.body.data.questions[3].question_text).toBe('Teacher added: explain photosynthesis.');

      const retry = await as(actors.teacher).post('/api/v1/assessments').send(payloadFrom(generation));
      expect(retry.status).toBe(201);
      expect(retry.body.data.id).toBe(draftId);
      expect(retry.body.data.idempotentReplay).toBe(true);
      const n = await db('monthly_tests').where({ ai_generation_id: generation.generationId }).count('id as n').first();
      expect(Number(n.n)).toBe(1);
    });

    test('another teacher cannot attach someone else’s AI generation', async () => {
      const res = await as(actors.principal).post('/api/v1/assessments').send(payloadFrom(generation, { title: 'stolen' }));
      expect(res.status).toBe(403);
    });

    test('publishing the draft requires confirmation, then uses the normal publish workflow', async () => {
      const noConfirm = await as(actors.teacher).patch(`/api/v1/assessments/${draftId}/status`).send({ status: 'PUBLISHED' });
      expect(noConfirm.status).toBe(422);
      const ok = await as(actors.teacher).patch(`/api/v1/assessments/${draftId}/status`).send({ status: 'PUBLISHED', confirmAiReview: true });
      expect(ok.status).toBe(200);
      const row = await db('monthly_tests').where({ id: draftId }).first();
      expect(row.status).toBe('PUBLISHED');
      expect(row.ai_review_status).toBe('REVIEWED');
      // Student sees the quiz through the existing student workflow
      const st = await as(actors.studentA).get('/api/v1/assessments/student/my-tests');
      expect(st.body.data.allTests.some((t) => t.id === draftId)).toBe(true);
    });
  });
});

// ===========================================================================
// FEATURE 3: Checked quiz results visible to parents
// ===========================================================================
describe('Parent quiz results', () => {
  let quiz;
  let mcqQ;
  let shortQ;
  let attemptA;
  let attemptB;

  const parentResults = (actor, studentId) => as(actor).get(`/api/v1/assessments/parent/${studentId}/results`);
  const parentNotices = (userId, testId) =>
    db('operational_notifications').where({ user_id: userId, related_record_type: 'MonthlyTest', related_record_id: String(testId) });

  beforeAll(async () => {
    const res = await as(actors.teacher).post('/api/v1/assessments').send({
      classId: cls.id,
      subjectId: subject.id,
      examType: 'CLASS_QUIZ',
      title: `Plants Quiz ${SUFFIX}`,
      durationMinutes: 15,
      passingMarks: 3,
      availableFrom: new Date(Date.now() - 60000).toISOString(),
      availableUntil: new Date(Date.now() + 3600000).toISOString(),
      publishImmediately: true,
      status: 'PUBLISHED',
      questions: [
        { questionType: 'MCQ', prompt: 'Where does photosynthesis happen?', marks: 2, options: [{ key: 'A', text: 'Chloroplast' }, { key: 'B', text: 'Nucleus' }], correctOption: 'A' },
        { questionType: 'SHORT_ANSWER', prompt: 'Name the gas released.', marks: 3, rubricGuide: 'Oxygen' }
      ]
    });
    expect(res.status).toBe(201);
    quiz = res.body.data;
    [mcqQ, shortQ] = quiz.questions;
  });

  async function attempt(actor, mcqAnswer, textAnswer) {
    const start = await as(actor).post(`/api/v1/assessments/${quiz.id}/start`);
    expect(start.status).toBe(200);
    const attemptId = start.body.data.attempt.id;
    await as(actor).post(`/api/v1/assessments/attempts/${attemptId}/save-answer`).send({ questionId: mcqQ.id, selectedOption: mcqAnswer });
    await as(actor).post(`/api/v1/assessments/attempts/${attemptId}/save-answer`).send({ questionId: shortQ.id, textAnswer });
    const submit = await as(actor).post(`/api/v1/assessments/attempts/${attemptId}/submit`);
    expect(submit.status).toBe(200);
    return attemptId;
  }

  test('student submits: MCQ auto-graded, written answer stays pending, nothing visible to parent', async () => {
    attemptA = await attempt(actors.studentA, 'A', 'Oxygen');
    attemptB = await attempt(actors.studentB, 'B', 'Carbon');
    const row = await db('test_attempts').where({ id: attemptA }).first();
    expect(Number(row.mcq_score)).toBe(2);
    expect(row.status).toBe('SUBMITTED');
    expect(row.total_score).toBeNull();
    const rowB = await db('test_attempts').where({ id: attemptB }).first();
    expect(Number(rowB.mcq_score)).toBe(0);

    const res = await parentResults(actors.parentA, studentA.id);
    expect(res.status).toBe(200);
    expect(res.body.data.results.find((r) => r.testId === quiz.id)).toBeUndefined();
  });

  test('results cannot be published while written answers are unchecked', async () => {
    const res = await as(actors.teacher).post(`/api/v1/assessments/${quiz.id}/publish-results`);
    expect(res.status).toBe(422);
    expect((await parentNotices(actors.parentA.userId, quiz.id)).length).toBe(0);
  });

  test('teacher checks answers; result still hidden from parents until published', async () => {
    const g1 = await as(actors.teacher)
      .post(`/api/v1/assessments/attempts/${attemptA}/grade`)
      .send({ grades: [{ questionId: shortQ.id, marksAwarded: 3, teacherFeedback: 'Correct' }], teacherRemarks: 'Well done' });
    expect(g1.status).toBe(200);
    const g2 = await as(actors.teacher)
      .post(`/api/v1/assessments/attempts/${attemptB}/grade`)
      .send({ grades: [{ questionId: shortQ.id, marksAwarded: 1 }], teacherRemarks: 'Revise the chapter' });
    expect(g2.status).toBe(200);
    const res = await parentResults(actors.parentA, studentA.id);
    expect(res.body.data.results.find((r) => r.testId === quiz.id)).toBeUndefined();
  });

  test('after publication the parent sees the checked result (no answer keys)', async () => {
    const pub = await as(actors.teacher).post(`/api/v1/assessments/${quiz.id}/publish-results`);
    expect(pub.status).toBe(200);
    const res = await parentResults(actors.parentA, studentA.id);
    const r = res.body.data.results.find((x) => x.testId === quiz.id);
    expect(r).toMatchObject({
      title: `Plants Quiz ${SUFFIX}`,
      examType: 'CLASS_QUIZ',
      subjectName: expect.stringContaining('Fixture Science'),
      className: cls.name,
      totalMarks: 5,
      totalScore: 5,
      percentage: 100,
      resultStatus: 'PASSED',
      teacherRemarks: 'Well done',
      correctionCount: 0
    });
    expect(r.publishedAt).toBeTruthy();
    expect(r.quizDate).toBeTruthy();
    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/correct_option|correctOption|rubric/i);
    expect(raw).not.toContain('Chloroplast');
  });

  test('parents cannot see other students’ results or the quiz answer key', async () => {
    expect((await parentResults(actors.parentA, studentB.id)).status).toBe(403);
    expect((await parentResults(actors.parentB, studentA.id)).status).toBe(403);
    expect((await as(actors.parentA).get(`/api/v1/assessments/${quiz.id}`)).status).toBe(403);
    const own = await parentResults(actors.parentB, studentB.id);
    expect(own.body.data.results.find((x) => x.testId === quiz.id).totalScore).toBe(1);
  });

  test('each parent gets exactly one result notification; re-publishing sends none', async () => {
    const a = await parentNotices(actors.parentA.userId, quiz.id);
    expect(a).toHaveLength(1);
    expect(a[0].title).toBe(`Result Available: ${studentA.name} - Plants Quiz ${SUFFIX}`);
    expect(a[0].message).toContain('Fixture Science');
    expect(a[0].type).toBe('Results Published');
    const again = await as(actors.teacher).post(`/api/v1/assessments/${quiz.id}/publish-results`);
    expect(again.status).toBe(200);
    expect(again.body.data.alreadyPublished).toBe(true);
    expect(await parentNotices(actors.parentA.userId, quiz.id)).toHaveLength(1);
    const b = await parentNotices(actors.parentB.userId, quiz.id);
    expect(b).toHaveLength(1);
    expect(b[0].title).toContain(studentB.name);
    expect(b[0].title).not.toContain(studentA.name);
  });

  test('correcting a published result needs a reason and keeps audit history', async () => {
    const noReason = await as(actors.teacher)
      .post(`/api/v1/assessments/attempts/${attemptA}/grade`)
      .send({ grades: [{ questionId: shortQ.id, marksAwarded: 2, teacherFeedback: 'Partially correct' }], teacherRemarks: 'Well done' });
    expect(noReason.status).toBe(422);
    expect(noReason.body.error.details.requiresCorrectionReason).toBe(true);

    const fixed = await as(actors.teacher)
      .post(`/api/v1/assessments/attempts/${attemptA}/grade`)
      .send({
        grades: [{ questionId: shortQ.id, marksAwarded: 2, teacherFeedback: 'Partially correct' }],
        teacherRemarks: 'Well done',
        correctionReason: 'Answer missed the word "gas"; re-marked.'
      });
    expect(fixed.status).toBe(200);

    const revs = await db('test_attempt_grade_revisions').where({ attempt_id: attemptA });
    expect(revs).toHaveLength(1);
    expect(Number(revs[0].previous_total_score)).toBe(5);
    expect(Number(revs[0].new_total_score)).toBe(4);
    const audit = await db('audit_logs').where({ action: 'ASSESSMENT_RESULT_CORRECTED', record_identifier: `Attempt #${attemptA} (test #${quiz.id})` });
    expect(audit).toHaveLength(1);

    const res = await parentResults(actors.parentA, studentA.id);
    const r = res.body.data.results.find((x) => x.testId === quiz.id);
    expect(r.totalScore).toBe(4);
    expect(r.correctionCount).toBe(1);

    const notices = await parentNotices(actors.parentA.userId, quiz.id);
    expect(notices).toHaveLength(2);
    expect(notices.some((n) => n.title.startsWith('Result Updated'))).toBe(true);
    expect(await parentNotices(actors.parentB.userId, quiz.id)).toHaveLength(1);

    // Saving the same grades again is not a new correction
    await as(actors.teacher)
      .post(`/api/v1/assessments/attempts/${attemptA}/grade`)
      .send({ grades: [{ questionId: shortQ.id, marksAwarded: 2, teacherFeedback: 'Partially correct' }], teacherRemarks: 'Well done', correctionReason: 'no-op resave' });
    expect(await db('test_attempt_grade_revisions').where({ attempt_id: attemptA })).toHaveLength(1);
    expect(await parentNotices(actors.parentA.userId, quiz.id)).toHaveLength(2);
  });
});
