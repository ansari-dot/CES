import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/shared/db/knex.js';

describe('Module 7: Teacher Payroll & Duty Tracking Tests', () => {
  let app;
  let principalCookies;
  let principalCsrf;
  let activeTeacher;
  let generatedDraftId;
  let activeSession;
  let activeClass;
  let activeSubject;

  beforeAll(async () => {
    app = createApp();

    // 1. Principal Login
    const principalRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'principal', password: 'PrincipalPassword123!' });

    expect(principalRes.status).toBe(200);
    principalCookies = principalRes.headers['set-cookie'];
    const pCsrfCookie = principalCookies.find((c) => c.startsWith('sms_csrf='));
    principalCsrf = pCsrfCookie.split(';')[0].split('=')[1];

    // 2. Academic setup
    activeSession = await db('academic_sessions').where({ is_current: 1 }).first();
    if (!activeSession) activeSession = await db('academic_sessions').first();

    activeClass = await db('classes').first();
    activeSubject = await db('subjects').first();

    // 3. Find or ensure active teacher
    activeTeacher = await db('teachers')
      .join('users', 'teachers.user_id', 'users.id')
      .where('teachers.employment_status', 'ACTIVE')
      .select('teachers.id', 'teachers.user_id', 'teachers.employee_no as staffIdentifier', 'users.full_name as teacherName')
      .first();

    if (!activeTeacher) {
      const [uid] = await db('users').insert({
        role_id: 3,
        username: `payroll_teacher_${Date.now()}`,
        email: `payroll_teacher_${Date.now()}@school.pk`,
        full_name: 'Payroll Test Teacher',
        password_hash: 'hash',
        status: 'ACTIVE'
      });
      const [tid] = await db('teachers').insert({
        user_id: uid,
        employee_no: `TCH-PR-${Date.now().toString().slice(-4)}`,
        designation: 'Senior Faculty',
        joining_date: '2024-01-15',
        employment_status: 'ACTIVE'
      });
      activeTeacher = { id: tid, user_id: uid, staffIdentifier: `TCH-PR-${Date.now().toString().slice(-4)}`, teacherName: 'Payroll Test Teacher' };
    }

    // 4. Ensure teacher has a salary profile
    const existingProfile = await db('teacher_salary_profiles').where({ teacher_id: activeTeacher.id }).first();
    if (!existingProfile) {
      await db('teacher_salary_profiles').insert({
        teacher_id: activeTeacher.id,
        model: 'HYBRID',
        base_amount: 45000,
        per_lesson_rate: 1500,
        per_hour_rate: 1200,
        rules: JSON.stringify({ allowances: 4000, standardDeductions: 2000 }),
        effective_from: '2026-01-01'
      });
    }

    // 5. Clean payroll tables for repeatable test runs
    await db('teacher_salary_adjustments').del();
    await db('teacher_payroll_drafts').del();

    // 6. Insert sample completed lessons for this teacher
    await db('timetable_lessons').insert([
      {
        class_id: activeClass.id,
        subject_id: activeSubject.id,
        teacher_id: activeTeacher.id,
        lesson_date: '2026-04-05',
        start_at: '2026-04-05 09:00:00',
        end_at: '2026-04-05 09:45:00',
        status: 'COMPLETED'
      },
      {
        class_id: activeClass.id,
        subject_id: activeSubject.id,
        teacher_id: activeTeacher.id,
        lesson_date: '2026-04-06',
        start_at: '2026-04-06 10:00:00',
        end_at: '2026-04-06 10:45:00',
        status: 'COMPLETED'
      },
      {
        class_id: activeClass.id,
        subject_id: activeSubject.id,
        teacher_id: activeTeacher.id,
        lesson_date: '2026-04-07',
        start_at: '2026-04-07 11:00:00',
        end_at: '2026-04-07 11:45:00',
        status: 'SCHEDULED'
      }
    ]);
  });

  afterAll(async () => {
    await db.destroy();
  });

  test('1. POST /api/v1/payroll/drafts/generate - Batch generate teacher payroll drafts for month', async () => {
    const res = await request(app)
      .post('/api/v1/payroll/drafts/generate')
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', principalCsrf)
      .send({
        payrollMonth: 'April 2026'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.generatedCount).toBeGreaterThan(0);
  });

  test('2. POST /api/v1/payroll/drafts/generate - Duplicate month draft generation skipped cleanly', async () => {
    const res = await request(app)
      .post('/api/v1/payroll/drafts/generate')
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', principalCsrf)
      .send({
        payrollMonth: 'April 2026'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.skippedCount).toBeGreaterThan(0);
    expect(res.body.data.generatedCount).toBe(0);
  });

  test('3. GET /api/v1/payroll/drafts - Query drafts and verify duty audit & formula breakdown', async () => {
    const res = await request(app)
      .get(`/api/v1/payroll/drafts?payrollMonth=April 2026&teacherId=${activeTeacher.id}`)
      .set('Cookie', principalCookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);

    const draft = res.body.data[0];
    generatedDraftId = draft.id;

    expect(draft.teacherId).toBe(String(activeTeacher.id));
    expect(draft.payrollMonth).toBe('April 2026');
    expect(draft.completedLessons).toBeGreaterThanOrEqual(2);
    expect(draft.verifiedHours).toBeGreaterThan(0);
    expect(draft.calculationFormula).toBeDefined();
    expect(draft.grossAmount).toBeGreaterThan(0);
    expect(draft.netPayable).toBeGreaterThan(0);
    expect(draft.status).toBe('Submitted for Approval');
  });

  test('4. GET /api/v1/payroll/drafts/:id - Fetch single salary draft', async () => {
    const res = await request(app)
      .get(`/api/v1/payroll/drafts/${generatedDraftId}`)
      .set('Cookie', principalCookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(generatedDraftId);
  });

  test('5. POST /api/v1/payroll/drafts/:id/adjustments - Add positive financial allowance/addition', async () => {
    const initialRes = await request(app)
      .get(`/api/v1/payroll/drafts/${generatedDraftId}`)
      .set('Cookie', principalCookies);

    const initialGross = initialRes.body.data.grossAmount;
    const initialNet = initialRes.body.data.netPayable;

    const res = await request(app)
      .post(`/api/v1/payroll/drafts/${generatedDraftId}/adjustments`)
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', principalCsrf)
      .send({
        type: 'Addition',
        title: 'Online Exam Supervision Bonus',
        amount: 3000,
        reason: 'Supervised 3 evening exam shifts'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.adjustments.length).toBe(1);
    expect(res.body.data.adjustments[0].title).toBe('Online Exam Supervision Bonus');
    expect(res.body.data.adjustments[0].amount).toBe(3000);
    expect(res.body.data.grossAmount).toBe(initialGross + 3000);
    expect(res.body.data.netPayable).toBe(initialNet + 3000);
  });

  test('6. POST /api/v1/payroll/drafts/:id/adjustments - Add deduction adjustment', async () => {
    const beforeRes = await request(app)
      .get(`/api/v1/payroll/drafts/${generatedDraftId}`)
      .set('Cookie', principalCookies);

    const beforeNet = beforeRes.body.data.netPayable;

    const res = await request(app)
      .post(`/api/v1/payroll/drafts/${generatedDraftId}/adjustments`)
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', principalCsrf)
      .send({
        type: 'Deduction',
        title: 'Unexcused Tardiness Deduction',
        amount: 500,
        reason: 'Late clock-in for Zoom lesson on April 6'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.adjustments.length).toBe(2);
    expect(res.body.data.netPayable).toBe(beforeNet - 500);
  });

  test('7. POST /api/v1/payroll/drafts/:id/review - Rejection requires remarks note', async () => {
    const res = await request(app)
      .post(`/api/v1/payroll/drafts/${generatedDraftId}/review`)
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', principalCsrf)
      .send({
        decision: 'Rejected',
        reviewRemarks: '' // Empty note should trigger 422
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  test('8. POST /api/v1/payroll/drafts/:id/review - Approve draft & generate salary slip number', async () => {
    const res = await request(app)
      .post(`/api/v1/payroll/drafts/${generatedDraftId}/review`)
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', principalCsrf)
      .send({
        decision: 'Approved',
        reviewRemarks: 'Duty hours and lesson attendance verified against Zoom event logs'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('Approved');
    expect(res.body.data.salarySlipNumber).toBeDefined();
    expect(res.body.data.salarySlipNumber.startsWith('SLIP-')).toBe(true);
    expect(res.body.data.reviewedBy).toBeDefined();
  });

  test('9. POST /api/v1/payroll/drafts/:id/settle - Settle salary bank disbursement', async () => {
    const res = await request(app)
      .post(`/api/v1/payroll/drafts/${generatedDraftId}/settle`)
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', principalCsrf)
      .send({
        paymentMethod: 'Bank Transfer',
        paymentReference: 'HBL-FT-99887766',
        paidAmount: 51500
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('Paid');
    expect(res.body.data.paymentRecord).toBeDefined();
    expect(res.body.data.paymentRecord.paymentReference).toBe('HBL-FT-99887766');
    expect(res.body.data.paymentRecord.paidAmount).toBe(51500);
  });

  test('10. GET /api/v1/payroll/duty-summary/:teacherId - Fetch live teacher duty metrics', async () => {
    const res = await request(app)
      .get(`/api/v1/payroll/duty-summary/${activeTeacher.id}?payrollMonth=April 2026`)
      .set('Cookie', principalCookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.teacherId).toBe(String(activeTeacher.id));
    expect(res.body.data.completedLessons).toBeGreaterThanOrEqual(2);
    expect(res.body.data.verifiedTeachingHours).toBeGreaterThan(0);
  });

  test('11. ACID Invariant - Frozen state: Cannot add adjustment to an already Paid salary draft', async () => {
    const res = await request(app)
      .post(`/api/v1/payroll/drafts/${generatedDraftId}/adjustments`)
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', principalCsrf)
      .send({
        type: 'Addition',
        title: 'Post-Payment Bonus Hack',
        amount: 5000,
        reason: 'Should be blocked by ACID invariants'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('12. ACID Invariant - Double-disbursement prevention: Cannot re-settle an already Paid draft', async () => {
    const res = await request(app)
      .post(`/api/v1/payroll/drafts/${generatedDraftId}/settle`)
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', principalCsrf)
      .send({
        paymentMethod: 'Bank Transfer',
        paymentReference: 'HBL-FT-DUPLICATE-ATTEMPT',
        paidAmount: 51500
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  test('13. ACID Invariant - Frozen review: Cannot review or reject an already Paid salary draft', async () => {
    const res = await request(app)
      .post(`/api/v1/payroll/drafts/${generatedDraftId}/review`)
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', principalCsrf)
      .send({
        decision: 'Rejected',
        reviewRemarks: 'Attempting to reject already paid draft'
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('14. ACID Durability - Atomic audit logs created for payroll lifecycle actions', async () => {
    const logs = await db('audit_logs')
      .where('record_type', 'Teacher Payroll')
      .orderBy('created_at', 'desc');

    expect(logs.length).toBeGreaterThan(0);
    const actions = logs.map((l) => l.action);
    expect(actions).toContain('SETTLE_SALARY_PAYMENT');
  });
});
