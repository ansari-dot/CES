import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/shared/db/knex.js';

describe('Module 9: Reports, Analytics & Data Export Tests', () => {
  let app;
  let principalCookies;
  let principalCsrf;

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
  });

  afterAll(async () => {
    await db.destroy();
  });

  test('1. GET /api/v1/reports/student-enrolment - Retrieve student enrolment report', async () => {
    const res = await request(app)
      .get('/api/v1/reports/student-enrolment')
      .set('Cookie', principalCookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].col1).toBeDefined(); // Roll number
    expect(res.body.data[0].col3).toBeDefined(); // Student name
  });

  test('2. GET /api/v1/reports/fee-collection - Retrieve fee collection report & summary metrics', async () => {
    const res = await request(app)
      .get('/api/v1/reports/fee-collection')
      .set('Cookie', principalCookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summary).toBeDefined();
    expect(res.body.data.summary.totalChallans).toBeDefined();
    expect(Array.isArray(res.body.data.rows)).toBe(true);
  });

  test('3. GET /api/v1/reports/teacher-duty-payroll - Retrieve teacher duty and payroll records', async () => {
    const res = await request(app)
      .get('/api/v1/reports/teacher-duty-payroll')
      .set('Cookie', principalCookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('4. GET /api/v1/reports/attendance-trends - Retrieve lesson attendance trend analytics', async () => {
    const res = await request(app)
      .get('/api/v1/reports/attendance-trends')
      .set('Cookie', principalCookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('5. GET /api/v1/reports/academic-performance - Retrieve class-wise academic performance metrics', async () => {
    const res = await request(app)
      .get('/api/v1/reports/academic-performance')
      .set('Cookie', principalCookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    const classOne = res.body.data[0];
    expect(classOne.classNumber).toBe(1);
    expect(classOne.taskCompletionRate).toBeGreaterThanOrEqual(0);
    expect(classOne.averageScorePercentage).toBeGreaterThan(0);
    expect(Array.isArray(classOne.subjectScores)).toBe(true);
  });

  test('6. POST /api/v1/reports/academic-performance/:classNumber/publish - Principal authorizes result publication', async () => {
    const res = await request(app)
      .post('/api/v1/reports/academic-performance/1/publish')
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', principalCsrf)
      .send({
        sessionId: 1,
        term: 'Mid-Year 2026'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.publishedResultsStatus).toBe('Published');

    // Verify it reflects in academic performances list
    const checkRes = await request(app)
      .get('/api/v1/reports/academic-performance')
      .set('Cookie', principalCookies);

    const classOne = checkRes.body.data.find((c) => c.classNumber === 1);
    expect(classOne.publishedResultsStatus).toBe('Published');
  });

  test('7. GET /api/v1/reports/export - Export student enrolment report as CSV download', async () => {
    const res = await request(app)
      .get('/api/v1/reports/export?reportType=student_enrolment&format=csv')
      .set('Cookie', principalCookies);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.text).toContain('Student Name');
    expect(res.text).toContain('Roll No');
  });

  test('8. GET /api/v1/reports/export - Export fee collection statement as CSV download', async () => {
    const res = await request(app)
      .get('/api/v1/reports/export?reportType=fee_collection&format=csv')
      .set('Cookie', principalCookies);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('Challan No');
    expect(res.text).toContain('Total Payable');
  });

  test('9. GET /api/v1/reports/export - Export operational report as JSON stream', async () => {
    const res = await request(app)
      .get('/api/v1/reports/export?reportType=student_enrolment&format=json')
      .set('Cookie', principalCookies);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    const parsed = JSON.parse(res.text);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
  });

  test('10. GET /api/v1/reports/export - Unauthenticated request rejected (401)', async () => {
    const res = await request(app).get('/api/v1/reports/export?reportType=student_enrolment');
    expect(res.status).toBe(401);
  });
});
