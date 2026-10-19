import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/shared/db/knex.js';

describe('Module 8: Notices, Operational Notifications & Audit Logs Tests', () => {
  let app;
  let principalCookies;
  let principalCsrf;
  let createdNoticeId;
  let createdNotifId;

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

    // 2. Clean tables for repeatable tests
    await db('audit_logs').del();
    await db('operational_notifications').del();
    await db('school_notices').del();
  });

  afterAll(async () => {
    await db.destroy();
  });

  // --- 1. School Notices ---
  test('1. POST /api/v1/notices - Create School Notice', async () => {
    const res = await request(app)
      .post('/api/v1/notices')
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', principalCsrf)
      .send({
        title: 'Spring Break & Mid-Term Exam Schedule',
        content: 'Spring recess begins Monday April 21st. Online Zoom revision sessions will resume on April 28th.',
        audience: 'School-Wide',
        targetRoles: ['Teacher', 'Student', 'Parent'],
        priority: 'High',
        status: 'Published',
        expiryDate: '2026-05-01'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Spring Break & Mid-Term Exam Schedule');
    expect(res.body.data.priority).toBe('High');
    expect(res.body.data.status).toBe('Published');
    expect(res.body.data.targetRoles).toContain('Parent');
    createdNoticeId = res.body.data.id;
  });

  test('2. GET /api/v1/notices - List all notices with filtering', async () => {
    const res = await request(app)
      .get('/api/v1/notices?audience=School-Wide&status=Published')
      .set('Cookie', principalCookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].id).toBe(createdNoticeId);
  });

  test('3. GET /api/v1/notices/:id - Retrieve single notice by ID', async () => {
    const res = await request(app)
      .get(`/api/v1/notices/${createdNoticeId}`)
      .set('Cookie', principalCookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdNoticeId);
    expect(res.body.data.createdBy).toBeDefined();
  });

  test('4. POST /api/v1/notices/:id/archive - Archive published notice', async () => {
    const res = await request(app)
      .post(`/api/v1/notices/${createdNoticeId}/archive`)
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', principalCsrf)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('Archived');
  });

  // --- 2. Operational Notifications ---
  test('5. POST /api/v1/notices/notifications - Create operational system alert', async () => {
    const res = await request(app)
      .post('/api/v1/notices/notifications')
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', principalCsrf)
      .send({
        title: 'Payment Proof Awaiting Review',
        message: 'A new fee payment proof for Challan CH-2026-04-001 has been submitted by parent.',
        type: 'Payment Proof Awaiting Review',
        targetRole: 'PRINCIPAL',
        relatedRecordId: 'CH-2026-04-001',
        relatedRecordType: 'Monthly Challan',
        priority: 'High'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe('Payment Proof Awaiting Review');
    expect(res.body.data.isRead).toBe(false);
    createdNotifId = res.body.data.id;
  });

  test('6. GET /api/v1/notices/notifications - Fetch operational notifications', async () => {
    const res = await request(app)
      .get('/api/v1/notices/notifications?role=PRINCIPAL&isRead=false')
      .set('Cookie', principalCookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].id).toBe(createdNotifId);
  });

  test('7. POST /api/v1/notices/notifications/:id/read - Mark single notification as read', async () => {
    const res = await request(app)
      .post(`/api/v1/notices/notifications/${createdNotifId}/read`)
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', principalCsrf)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isRead).toBe(true);
  });

  test('8. POST /api/v1/notices/notifications/read-all - Mark all operational alerts read', async () => {
    const res = await request(app)
      .post('/api/v1/notices/notifications/read-all')
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', principalCsrf)
      .send();

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // --- 3. Audit Logs ---
  test('9. POST /api/v1/audit - Capture immutable audit log event', async () => {
    const res = await request(app)
      .post('/api/v1/audit')
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', principalCsrf)
      .send({
        action: 'UPDATE_FEE_STRUCTURE',
        recordType: 'Fee Structure',
        recordIdentifier: 'Class 5 Fee Schedule',
        reason: 'Authorized annual adjustment of science laboratory fee',
        previousValue: 'Monthly recurring was: Rs. 8500',
        newValue: 'New monthly recurring: Rs. 9500'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.id.startsWith('AUD-')).toBe(true);
    expect(res.body.data.action).toBe('UPDATE_FEE_STRUCTURE');
    expect(res.body.data.actorRole).toBeDefined();
  });

  test('10. GET /api/v1/audit - Query audit logs with recordType filter', async () => {
    const res = await request(app)
      .get('/api/v1/audit?recordType=Fee Structure')
      .set('Cookie', principalCookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0].action).toBe('UPDATE_FEE_STRUCTURE');
    expect(res.body.data[0].recordIdentifier).toBe('Class 5 Fee Schedule');
    expect(res.body.data[0].reason).toContain('science laboratory fee');
  });
});
