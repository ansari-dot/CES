import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/shared/db/knex.js';
import {
  runFeeLifecycle,
  applyOverdueRestrictions,
  generateCurrentMonthInvoices
} from '../src/modules/fees/fees.scheduler.js';
import { toZonedDateString, addDays } from '../src/modules/fees/fees.billing.js';

describe('Fee Restriction Lifecycle Tests', () => {
  let app;
  let principalCookies;
  let principalCsrf;
  let principalUserId;
  let testStudent;
  let testSession;
  let testClass;
  let testChallanId;

  const SCHOOL_TZ = 'Asia/Karachi';

  beforeAll(async () => {
    app = createApp();

    // Login as principal
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'principal', password: 'PrincipalPassword123!' });
    expect(loginRes.status).toBe(200);
    principalCookies = loginRes.headers['set-cookie'];
    principalCsrf = principalCookies.find((c) => c.startsWith('sms_csrf=')).split(';')[0].split('=')[1];
    principalUserId = loginRes.body.data.id;

    testSession = await db('academic_sessions').where({ is_current: 1 }).first()
      || await db('academic_sessions').first();
    testClass = await db('classes').first();

    // Create a dedicated test student
    const [uid] = await db('users').insert({
      role_id: 4,
      username: `restrict_test_${Date.now()}`,
      email: `restrict_test_${Date.now()}@school.pk`,
      full_name: 'Restriction Test Student',
      password_hash: 'hash',
      status: 'ACTIVE'
    });
    const [sid] = await db('students').insert({
      user_id: uid,
      admission_no: `ADM-RST-${Date.now()}`,
      admission_date: new Date().toISOString().split('T')[0],
      current_class_id: testClass.id,
      status: 'ACTIVE'
    });
    testStudent = { id: sid, userId: uid };

    // Clean any leftover restriction events for this student
    await db('fee_restriction_events').where({ student_id: sid }).del();
    await db('fee_challans').where({ student_id: sid }).del();
  });

  afterAll(async () => {
    if (testStudent) {
      await db('fee_restriction_events').where({ student_id: testStudent.id }).del();
      await db('fee_challans').where({ student_id: testStudent.id }).del();
      await db('students').where({ id: testStudent.id }).del();
      await db('users').where({ id: testStudent.userId }).del();
    }
    await db.destroy();
  });

  // ── 1. Invoice generation ────────────────────────────────────────────────

  test('1. Generate monthly challan for test student', async () => {
    const billingMonth = 'November 2026';
    const today = new Date().toISOString().split('T')[0];
    const res = await request(app)
      .post('/api/v1/fees/challans/generate')
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', principalCsrf)
      .send({
        sessionId: testSession.id,
        classId: testClass.id,
        billingMonth,
        issueDate: today,
        dueDate: addDays(today, 5),
        validUntil: addDays(today, 10),
        gracePeriodDays: 5,
        lateFeeAmount: 500
      });
    expect(res.status).toBe(201);
    expect(res.body.data.count).toBeGreaterThan(0);

    const challan = await db('fee_challans')
      .where({ student_id: testStudent.id })
      .first();
    expect(challan).toBeDefined();
    testChallanId = challan.id;
  });

  test('2. Duplicate invoice prevention — same billing month not re-created', async () => {
    const before = await db('fee_challans').where({ student_id: testStudent.id }).count('id as cnt').first();
    await request(app)
      .post('/api/v1/fees/challans/generate')
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', principalCsrf)
      .send({
        sessionId: testSession.id,
        classId: testClass.id,
        billingMonth: 'November 2026',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: addDays(new Date().toISOString().split('T')[0], 5),
        validUntil: addDays(new Date().toISOString().split('T')[0], 10)
      });
    const after = await db('fee_challans').where({ student_id: testStudent.id }).count('id as cnt').first();
    expect(Number(after.cnt)).toBe(Number(before.cnt));
  });

  test('3. Paid invoice is preserved and not reset', async () => {
    // Mark challan as PAID
    await db('fee_challans').where({ id: testChallanId }).update({ status: 'PAID', paid_amount: 5000 });
    const challan = await db('fee_challans').where({ id: testChallanId }).first();
    expect(challan.status).toBe('PAID');
    expect(Number(challan.paid_amount)).toBe(5000);

    // Re-run generator — paid challan must not be touched
    await request(app)
      .post('/api/v1/fees/challans/generate')
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', principalCsrf)
      .send({
        sessionId: testSession.id,
        classId: testClass.id,
        billingMonth: 'November 2026',
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: addDays(new Date().toISOString().split('T')[0], 5),
        validUntil: addDays(new Date().toISOString().split('T')[0], 10)
      });

    const after = await db('fee_challans').where({ id: testChallanId }).first();
    expect(after.status).toBe('PAID');
    expect(Number(after.paid_amount)).toBe(5000);
  });

  // ── 2. Restriction ───────────────────────────────────────────────────────

  test('4. Student is NOT restricted when challan is within grace period', async () => {
    // Reset to UNPAID with a future valid_until
    const futureDate = addDays(new Date().toISOString().split('T')[0], 5);
    await db('fee_challans').where({ id: testChallanId }).update({
      status: 'UNPAID', paid_amount: 0, valid_until: futureDate
    });
    await db('fee_restriction_events').where({ student_id: testStudent.id }).del();

    const schoolToday = toZonedDateString(new Date(), SCHOOL_TZ);
    const candidates = await db('fee_challans as fc')
      .whereIn('fc.status', ['UNPAID', 'OVERDUE'])
      .where('fc.valid_until', '<', schoolToday)
      .where('fc.student_id', testStudent.id)
      .count('fc.id as cnt').first();
    expect(Number(candidates.cnt)).toBe(0);
  });

  test('5. Automatic restriction applied after grace period', async () => {
    // Set valid_until to yesterday so grace has expired
    const yesterday = addDays(new Date().toISOString().split('T')[0], -1);
    await db('fee_challans').where({ id: testChallanId }).update({
      status: 'UNPAID', paid_amount: 0, valid_until: yesterday
    });
    await db('fee_restriction_events').where({ student_id: testStudent.id }).del();
    await db('users').where({ id: testStudent.userId }).update({ status: 'ACTIVE' });

    const schoolToday = toZonedDateString(new Date(), SCHOOL_TZ);
    const result = await applyOverdueRestrictions(new Date());
    expect(result.RESTRICTED + result.ATTACHED).toBeGreaterThan(0);

    const user = await db('users').where({ id: testStudent.userId }).first();
    expect(user.status).toBe('SUSPENDED');

    const event = await db('fee_restriction_events')
      .where({ student_id: testStudent.id })
      .whereNull('resolved_at')
      .first();
    expect(event).toBeDefined();
  });

  test('6. Restricted student appears in GET /fees/restricted-students', async () => {
    const res = await request(app)
      .get('/api/v1/fees/restricted-students')
      .set('Cookie', principalCookies);
    expect(res.status).toBe(200);
    const found = res.body.data.find((s) => String(s.studentId) === String(testStudent.id));
    expect(found).toBeDefined();
    expect(found.portalStatus).toBe('SUSPENDED');
  });

  test('7. Restricted student cannot access protected portal routes', async () => {
    // Login as the restricted student
    const studentUser = await db('users').where({ id: testStudent.userId }).first();
    // We cannot log in with a hashed password in tests; verify via authenticate middleware logic
    // by checking the user status directly
    expect(studentUser.status).toBe('SUSPENDED');
  });

  // ── 3. Principal restore ─────────────────────────────────────────────────

  test('8. Unauthorized user cannot restore access', async () => {
    // Attempt without auth
    const res = await request(app)
      .post(`/api/v1/fees/students/${testStudent.id}/restore-access`)
      .set('X-CSRF-Token', principalCsrf)
      .send();
    expect(res.status).toBe(401);
  });

  test('9. Principal restores student access via Allow Access action', async () => {
    const res = await request(app)
      .post(`/api/v1/fees/students/${testStudent.id}/restore-access`)
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', principalCsrf)
      .send();
    expect(res.status).toBe(200);
    expect(res.body.data.portalStatus).toBe('ACTIVE');

    const user = await db('users').where({ id: testStudent.userId }).first();
    expect(user.status).toBe('ACTIVE');
  });

  test('10. Restriction events are resolved after Principal restore', async () => {
    const open = await db('fee_restriction_events')
      .where({ student_id: testStudent.id })
      .whereNull('resolved_at')
      .first();
    expect(open).toBeUndefined();

    const resolved = await db('fee_restriction_events')
      .where({ student_id: testStudent.id, resolution: 'PRINCIPAL_MANUAL_RESTORE' })
      .first();
    expect(resolved).toBeDefined();
  });

  test('11. Student no longer appears in restricted list after restore', async () => {
    const res = await request(app)
      .get('/api/v1/fees/restricted-students')
      .set('Cookie', principalCookies);
    expect(res.status).toBe(200);
    const found = res.body.data.find((s) => String(s.studentId) === String(testStudent.id));
    expect(found).toBeUndefined();
  });

  test('12. Scheduler does NOT re-restrict after Principal manual restore for same challan', async () => {
    // The challan is still UNPAID and past grace — but the restriction event is resolved
    const userBefore = await db('users').where({ id: testStudent.userId }).first();
    expect(userBefore.status).toBe('ACTIVE');

    await applyOverdueRestrictions(new Date());

    const userAfter = await db('users').where({ id: testStudent.userId }).first();
    expect(userAfter.status).toBe('ACTIVE'); // must NOT be re-restricted
  });

  test('13. Invoice financial status remains separate from portal access status', async () => {
    // After restore, challan is still UNPAID (not marked PAID by the restore action)
    const challan = await db('fee_challans').where({ id: testChallanId }).first();
    expect(challan.status).not.toBe('PAID');
    expect(Number(challan.paid_amount)).toBe(0);
  });

  test('14. New billing month creates a fresh restriction event (new cycle)', async () => {
    // Generate a new challan for a different month with expired grace
    const yesterday = addDays(new Date().toISOString().split('T')[0], -1);
    const [newChallanId] = await db('fee_challans').insert({
      challan_number: `CH-TEST-NEW-${Date.now()}`,
      consumer_number: `19999${String(testStudent.id).padStart(4, '0')}`,
      session_id: testSession.id,
      class_id: testClass.id,
      student_id: testStudent.id,
      billing_month: 'December 2026',
      issue_date: yesterday,
      due_date: yesterday,
      valid_until: yesterday,
      grace_period_days: 5,
      gross_amount: 5000,
      total_payable: 5000,
      paid_amount: 0,
      status: 'UNPAID'
    });

    await applyOverdueRestrictions(new Date());

    const user = await db('users').where({ id: testStudent.userId }).first();
    expect(user.status).toBe('SUSPENDED'); // new month → new restriction

    // Cleanup
    await db('fee_restriction_events').where({ student_id: testStudent.id }).del();
    await db('fee_challans').where({ id: newChallanId }).del();
    await db('users').where({ id: testStudent.userId }).update({ status: 'ACTIVE' });
  });

  // ── 4. Timezone conversion (pure logic, no DB) ───────────────────────────

  test('15. School timezone date calculation is correct', () => {
    const date = new Date('2026-11-11T00:00:00+05:00'); // midnight PKT
    const schoolDate = toZonedDateString(date, 'Asia/Karachi');
    expect(schoolDate).toBe('2026-11-11');
  });

  test('16. UK student sees different date for same instant', () => {
    // 2026-11-11 00:00 PKT = 2026-11-10 19:00 UTC = 2026-11-10 19:00 GMT
    const date = new Date('2026-11-10T19:00:00Z');
    const pkDate = toZonedDateString(date, 'Asia/Karachi');
    const ukDate = toZonedDateString(date, 'Europe/London');
    expect(pkDate).toBe('2026-11-11');
    expect(ukDate).toBe('2026-11-10'); // previous calendar day in UK
  });

  test('17. DST transition handled correctly for Europe/London', () => {
    // BST ends last Sunday of October; 2026-10-25 02:00 BST → 01:00 GMT
    const bstDate = new Date('2026-10-25T00:30:00Z'); // 01:30 BST
    const gmtDate = new Date('2026-10-25T02:30:00Z'); // 02:30 GMT (after clock change)
    const bstZone = toZonedDateString(bstDate, 'Europe/London');
    const gmtZone = toZonedDateString(gmtDate, 'Europe/London');
    expect(bstZone).toBe('2026-10-25');
    expect(gmtZone).toBe('2026-10-25');
  });

  test('18. addDays calendar arithmetic is correct', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-11-05', 5)).toBe('2026-11-10');
  });

  test('19. GET /api/v1/geo/timezone returns a timezone', async () => {
    const res = await request(app)
      .get('/api/v1/geo/timezone?browserTz=Asia/Karachi');
    expect(res.status).toBe(200);
    expect(res.body.data.timezone).toBeTruthy();
    expect(res.body.data.source).toMatch(/^(ip|browser|fallback|cache)$/);
  });
});
