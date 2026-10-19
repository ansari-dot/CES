import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/shared/db/knex.js';

describe('Module 2: Academic Setup & People API Tests', () => {
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

  describe('Academic Setup APIs', () => {
    it('should list all classes from 1 to 8', async () => {
      const res = await request(app)
        .get('/api/v1/classes')
        .set('Cookie', principalCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(8);
      expect(res.body.data[0].name).toBe('Class 1');
      expect(res.body.data[7].name).toBe('Class 8');
    });

    it('should list academic sessions and have active current session', async () => {
      const res = await request(app)
        .get('/api/v1/sessions')
        .set('Cookie', principalCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.some((s) => s.is_current === 1)).toBe(true);
    });

    it('should list subjects and class subjects', async () => {
      const subjectsRes = await request(app)
        .get('/api/v1/subjects')
        .set('Cookie', principalCookies);

      expect(subjectsRes.status).toBe(200);
      expect(subjectsRes.body.data.length).toBeGreaterThan(0);

      const class1Res = await request(app)
        .get('/api/v1/classes/1/subjects')
        .set('Cookie', principalCookies);

      expect(class1Res.status).toBe(200);
      expect(class1Res.body.data.length).toBeGreaterThan(0);
    });
  });

  describe('Students & Enrollment APIs', () => {
    let createdStudentId;
    const admissionNo = `STD-${Math.floor(100000 + Math.random() * 900000)}`;

    it('should create a new student with user account and enrollment', async () => {
      const res = await request(app)
        .post('/api/v1/students')
        .set('Cookie', principalCookies)
        .set('X-CSRF-Token', csrfToken)
        .send({
          name: 'Zainab Fatima',
          admissionNo,
          rollNo: '5A-12',
          dateOfBirth: '2015-04-10',
          gender: 'FEMALE',
          currentClassId: 5,
          email: `zainab.${Math.floor(100000 + Math.random() * 900000)}@school.pk`
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Zainab Fatima');
      expect(res.body.data.admissionNo).toBe(admissionNo);
      createdStudentId = res.body.data.id;
    });

    it('should fetch the student profile by ID', async () => {
      const res = await request(app)
        .get(`/api/v1/students/${createdStudentId}`)
        .set('Cookie', principalCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Zainab Fatima');
      expect(res.body.data.className).toBe('Class 5');
    });

    it('should list students filtered by class', async () => {
      const res = await request(app)
        .get('/api/v1/students?classId=5')
        .set('Cookie', principalCookies);

      expect(res.status).toBe(200);
      expect(res.body.data.some((s) => s.admissionNo === admissionNo)).toBe(true);
    });
  });

  describe('Parents & Guardian Linking APIs', () => {
    let registeredParentId;
    const parentEmail = `parent.${Math.floor(100000 + Math.random() * 900000)}@example.com`;

    it('should allow parent public self-registration', async () => {
      const res = await request(app)
        .post('/api/v1/parents/register')
        .send({
          name: 'Muhammad Tariq',
          email: parentEmail,
          phone: `+92300${Math.floor(1000000 + Math.random() * 9000000)}`,
          cnic: '42101-1234567-1',
          relation: 'FATHER',
          password: 'ParentSecret123!'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.verificationStatus).toBe('PENDING');
      registeredParentId = res.body.data.id;
    });

    it('should list pending parents for Principal review', async () => {
      const res = await request(app)
        .get('/api/v1/parents?status=PENDING')
        .set('Cookie', principalCookies);

      expect(res.status).toBe(200);
      expect(res.body.data.some((p) => p.email === parentEmail)).toBe(true);
    });

    it('should approve parent and link to student', async () => {
      // Get the student created earlier
      const student = await db('students').orderBy('id', 'desc').first();

      const res = await request(app)
        .post(`/api/v1/parents/${registeredParentId}/approve`)
        .set('Cookie', principalCookies)
        .set('X-CSRF-Token', csrfToken)
        .send({
          status: 'APPROVED',
          children: [
            {
              studentId: student.id,
              relation: 'FATHER',
              isPrimary: true
            }
          ]
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.verificationStatus).toBe('APPROVED');
      expect(res.body.data.children.length).toBe(1);
      expect(res.body.data.children[0].studentId).toBe(student.id);
    });
  });

  describe('Teacher Subject & Class Assignment API', () => {
    it('should assign a teacher to a class and subject', async () => {
      const teacher = await db('teachers').first();
      const currentSession = await db('academic_sessions').where({ is_current: 1 }).first();

      const res = await request(app)
        .post(`/api/v1/teachers/${teacher.id}/assignments`)
        .set('Cookie', principalCookies)
        .set('X-CSRF-Token', csrfToken)
        .send({
          classId: 5,
          subjectId: 1, // Mathematics
          sessionId: currentSession.id,
          effectiveFrom: '2026-08-01'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // Verify assignment query
      const listRes = await request(app)
        .get(`/api/v1/teachers/${teacher.id}/assignments`)
        .set('Cookie', principalCookies);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.length).toBeGreaterThan(0);
      expect(listRes.body.data.some((a) => a.classNumber === 5)).toBe(true);
    });
  });
});
