import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/shared/db/knex.js';

describe('Teachers Module API Tests', () => {
  let app;
  let principalCookies;
  let csrfToken;

  beforeAll(async () => {
    app = createApp();

    // Login as Principal
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'principal', password: 'PrincipalPassword123!' });

    expect(loginRes.status).toBe(200);
    principalCookies = loginRes.headers['set-cookie'];
    const csrfCookie = principalCookies.find((c) => c.startsWith('sms_csrf='));
    csrfToken = csrfCookie.split(';')[0].split('=')[1];
  });

  afterAll(async () => {
    await db.destroy();
  });

  it('should list teachers', async () => {
    const res = await request(app)
      .get('/api/v1/teachers')
      .set('Cookie', principalCookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('should create a new teacher with user and salary profile', async () => {
    const newTeacherPayload = {
      name: 'Ms. Ayesha Khan',
      staffIdentifier: `TCH-${Math.floor(100000 + Math.random() * 900000)}`,
      email: `ayesha.${Math.floor(100000 + Math.random() * 900000)}@school.pk`,
      phone: `+92300${Math.floor(1000000 + Math.random() * 9000000)}`,
      designation: 'Senior Mathematics Teacher',
      joiningDate: '2026-08-15',
      employmentStatus: 'Full-Time',
      qualification: 'M.Sc. Mathematics',
      salaryConfig: {
        model: 'Fixed monthly',
        baseMonthlySalary: 75000,
        perLessonRate: 1500,
        perHourRate: 1800,
        allowances: 6000,
        standardDeductions: 3000
      }
    };

    const res = await request(app)
      .post('/api/v1/teachers')
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', csrfToken)
      .send(newTeacherPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe(newTeacherPayload.name);
    expect(res.body.data.staffIdentifier).toBe(newTeacherPayload.staffIdentifier);
    expect(res.body.data.salaryConfig.baseMonthlySalary).toBe(75000);

    // Verify it now appears in GET /api/v1/teachers
    const listRes = await request(app)
      .get('/api/v1/teachers')
      .set('Cookie', principalCookies);

    expect(listRes.status).toBe(200);
    const found = listRes.body.data.find((t) => t.staffIdentifier === newTeacherPayload.staffIdentifier);
    expect(found).toBeDefined();
    expect(found.designation).toBe('Senior Mathematics Teacher');
  });

  it('should change teacher status to Temporarily Suspend', async () => {
    const uniqueId = `TCH-${Math.floor(100000 + Math.random() * 900000)}`;
    const createRes = await request(app)
      .post('/api/v1/teachers')
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', csrfToken)
      .send({
        name: 'Mr. Imran Ali',
        staffIdentifier: uniqueId,
        email: `imran.${Math.floor(100000 + Math.random() * 900000)}@school.pk`,
        designation: 'Science Teacher',
        salaryConfig: { model: 'Fixed monthly', baseMonthlySalary: 60000 }
      });

    const createdTeacher = createRes.body.data;

    // Suspend
    const statusRes = await request(app)
      .post(`/api/v1/teachers/${createdTeacher.id}/status`)
      .set('Cookie', principalCookies)
      .set('X-CSRF-Token', csrfToken)
      .send({
        action: 'Temporarily Suspend',
        reason: 'Investigation pending'
      });

    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.status).toBe('SUSPENDED');

    // Verify status reflected in list
    const listRes = await request(app)
      .get('/api/v1/teachers')
      .set('Cookie', principalCookies);

    const suspended = listRes.body.data.find((t) => t.staffIdentifier === uniqueId);
    expect(suspended.accountStatus).toBe('Temporarily Suspended');
  });
});
