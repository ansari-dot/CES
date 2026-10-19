import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/shared/db/knex.js';

describe('Module 6: Fee Management & Challans Tests', () => {
  let app;
  let principalCookies;
  let principalCsrf;
  let activeStudent;
  let activeSession;
  let activeClass;
  let createdStructureId;
  let createdConcessionId;
  let generatedChallan;
  let createdProofId;

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

    // 2. Fetch or create test session & class
    activeSession = await db('academic_sessions').where({ is_current: 1 }).first();
    if (!activeSession) {
      activeSession = await db('academic_sessions').first();
    }

    // 3. Ensure test student exists
    activeStudent = await db('students')
      .join('users', 'students.user_id', 'users.id')
      .where('students.status', 'ACTIVE')
      .select('students.id', 'students.user_id', 'students.current_class_id', 'users.full_name as studentName')
      .first();

    if (!activeStudent) {
      activeClass = await db('classes').first();
      const [uid] = await db('users').insert({
        role_id: 4,
        username: `fee_student_${Date.now()}`,
        email: `fee_student_${Date.now()}@school.pk`,
        full_name: 'Fee Test Student',
        password_hash: 'hash',
        status: 'ACTIVE'
      });
      const [sid] = await db('students').insert({
        user_id: uid,
        admission_no: `ADM-FEE-${Date.now()}`,
        roll_no: '99',
        admission_date: new Date().toISOString().split('T')[0],
        current_class_id: activeClass.id,
        status: 'ACTIVE'
      });
      activeStudent = { id: sid, user_id: uid, current_class_id: activeClass.id, studentName: 'Fee Test Student' };
    } else {
      activeClass = await db('classes').where({ id: activeStudent.current_class_id }).first();
    }

    // 4. Clean fee tables for predictable tests
    await db('fee_payment_proofs').del();
    await db('fee_challans').del();
    await db('student_concessions').del();
    await db('fee_structure_heads').del();
    await db('fee_structures').del();
  });

  afterAll(async () => {
    await db.destroy();
  });

  test('1. POST /api/v1/fees/structures - Create Fee Structure for Class with multiple heads', async () => {
    const res = await request(app)
      .post('/api/v1/fees/structures')
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', principalCsrf)
      .send({
        sessionId: activeSession.id,
        classId: activeClass.id,
        effectiveFrom: '2026-04-01',
        heads: [
          { head: 'TUITION', amount: 8000, isRecurring: true, description: 'Monthly Tuition Fee' },
          { head: 'TECHNOLOGY', amount: 1000, isRecurring: true, description: 'Digital LMS & Lab Access' },
          { head: 'EXAMINATION', amount: 1500, isRecurring: false, description: 'Annual Exam Fee' }
        ]
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.classId).toBe(activeClass.id);
    expect(res.body.data.totalMonthlyRecurring).toBe(9000); // 8000 + 1000
    expect(res.body.data.heads.length).toBe(3);
    createdStructureId = res.body.data.id;
  });

  test('2. GET /api/v1/fees/structures - Retrieve class fee structures', async () => {
    const res = await request(app)
      .get(`/api/v1/fees/structures?classId=${activeClass.id}`)
      .set('Cookie', principalCookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].heads.length).toBe(3);
  });

  test('3. POST /api/v1/fees/concessions - Add Concession for a Student', async () => {
    const res = await request(app)
      .post('/api/v1/fees/concessions')
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', principalCsrf)
      .send({
        studentId: activeStudent.id,
        sessionId: activeSession.id,
        concessionType: 'PERCENTAGE',
        value: 20, // 20% discount
        reason: 'Sibling Scholarship'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.studentId).toBe(activeStudent.id);
    expect(res.body.data.value).toBe(20);
    expect(res.body.data.status).toBe('ACTIVE');
    createdConcessionId = res.body.data.id;
  });

  test('4. GET /api/v1/fees/concessions - List concessions', async () => {
    const res = await request(app)
      .get(`/api/v1/fees/concessions?studentId=${activeStudent.id}`)
      .set('Cookie', principalCookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].reason).toBe('Sibling Scholarship');
  });

  test('5. POST /api/v1/fees/challans/generate - Generate Monthly Challans with Concession & 1Link Number', async () => {
    const res = await request(app)
      .post('/api/v1/fees/challans/generate')
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', principalCsrf)
      .send({
        sessionId: activeSession.id,
        classId: activeClass.id,
        billingMonth: 'April 2026',
        issueDate: '2026-04-01',
        dueDate: '2026-04-15',
        validUntil: '2026-04-25',
        gracePeriodDays: 5,
        lateFeeAmount: 500
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.count).toBeGreaterThan(0);
  });

  test('6. GET /api/v1/fees/challans - List and inspect generated challan details', async () => {
    const res = await request(app)
      .get(`/api/v1/fees/challans?studentId=${activeStudent.id}&billingMonth=April 2026`)
      .set('Cookie', principalCookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    const challan = res.body.data[0];
    generatedChallan = challan;

    // Validate 10-digit 1Link Consumer Number (Format: 10 + 26 + 04 + 0001)
    expect(challan.consumerNumber).toBeDefined();
    expect(challan.consumerNumber.length).toBe(10);
    expect(challan.consumerNumber.startsWith('10')).toBe(true);

    // Gross amount = 8000 + 1000 + 1500 = 10500
    // 20% concession = 2100
    // Total payable = 10500 - 2100 = 8400
    expect(challan.breakdown.grossAmount).toBe(10500);
    expect(challan.breakdown.concessionAmount).toBe(2100);
    expect(challan.totalPayable).toBe(8400);
    expect(challan.paidAmount).toBe(0);
    expect(challan.status).toBe('UNPAID');
  });

  test('7. GET /api/v1/fees/challans/:id - Fetch single challan by ID', async () => {
    const res = await request(app)
      .get(`/api/v1/fees/challans/${generatedChallan.id}`)
      .set('Cookie', principalCookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(generatedChallan.id);
    expect(res.body.data.challanNumber).toBe(generatedChallan.challanNumber);
  });

  test('8. GET /api/v1/fees/challans/consumer/:consumerNo - 1Link Kuickpay consumer query', async () => {
    const res = await request(app)
      .get(`/api/v1/fees/challans/consumer/${generatedChallan.consumerNumber}`)
      .set('Cookie', principalCookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.consumerNumber).toBe(generatedChallan.consumerNumber);
    expect(res.body.data.totalPayable).toBe(generatedChallan.totalPayable);
  });

  test('9. POST /api/v1/fees/payment-proofs - Submit proof of payment', async () => {
    const res = await request(app)
      .post('/api/v1/fees/payment-proofs')
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', principalCsrf)
      .send({
        challanId: generatedChallan.id,
        studentId: activeStudent.id,
        submittedAmount: 8400,
        bankOrWallet: 'Meezan Bank Ltd',
        transactionReference: 'MZN-TXN-987654321',
        paymentDate: '2026-04-05',
        proofDocumentUrl: '/api/v1/uploads/sample-receipt.pdf'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.challanId).toBe(generatedChallan.id);
    expect(res.body.data.transactionReference).toBe('MZN-TXN-987654321');
    expect(res.body.data.status).toBe('PENDING');
    createdProofId = res.body.data.id;

    // Verify challan status changed to PENDING_VERIFICATION
    const challanCheck = await request(app)
      .get(`/api/v1/fees/challans/${generatedChallan.id}`)
      .set('Cookie', principalCookies);

    expect(challanCheck.body.data.status).toBe('PENDING_VERIFICATION');
  });

  test('10. POST /api/v1/fees/payment-proofs - Duplicate transaction reference rejection (409 Conflict)', async () => {
    const res = await request(app)
      .post('/api/v1/fees/payment-proofs')
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', principalCsrf)
      .send({
        challanId: generatedChallan.id,
        studentId: activeStudent.id,
        submittedAmount: 8400,
        bankOrWallet: 'Meezan Bank Ltd',
        transactionReference: 'MZN-TXN-987654321', // Identical reference
        paymentDate: '2026-04-05'
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('DUPLICATE_TXN_REF');
  });

  test('11. POST /api/v1/fees/payment-proofs/:id/review - Approve payment proof & mark challan PAID', async () => {
    const res = await request(app)
      .post(`/api/v1/fees/payment-proofs/${createdProofId}/review`)
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', principalCsrf)
      .send({
        status: 'APPROVED',
        reviewDecisionNote: 'Payment verified via 1Link Meezan portal',
        verifiedAmount: 8400
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('APPROVED');
    expect(res.body.data.receiptNumber).toBeDefined();

    // Verify challan status changed to PAID and paidAmount updated
    const challanCheck = await request(app)
      .get(`/api/v1/fees/challans/${generatedChallan.id}`)
      .set('Cookie', principalCookies);

    expect(challanCheck.body.data.status).toBe('PAID');
    expect(challanCheck.body.data.paidAmount).toBe(8400);
  });

  test('12. GET /api/v1/fees/stats - Fee Collection Analytics', async () => {
    const res = await request(app)
      .get(`/api/v1/fees/stats?billingMonth=April 2026`)
      .set('Cookie', principalCookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalChallans).toBeGreaterThan(0);
    expect(res.body.data.totalCollected).toBeGreaterThan(0);
    expect(res.body.data.paidCount).toBeGreaterThan(0);
  });

  test('13. POST /api/v1/fees/concessions/:id/revoke - Revoke a student concession', async () => {
    const res = await request(app)
      .post(`/api/v1/fees/concessions/${createdConcessionId}/revoke`)
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', principalCsrf)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const check = await request(app)
      .get(`/api/v1/fees/concessions?studentId=${activeStudent.id}&status=REVOKED`)
      .set('Cookie', principalCookies);

    expect(check.body.data.length).toBe(1);
    expect(check.body.data[0].status).toBe('REVOKED');
  });
});
