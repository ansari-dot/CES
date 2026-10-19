import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/shared/db/knex.js';

describe('Module 5: Learning Tasks, Submissions & Resources Tests', () => {
  let app;
  let teacherCookies;
  let teacherCsrf;
  let teacherId;
  let studentCookies;
  let studentId;
  let studentUser;
  let createdTaskId;
  let createdSubmissionId;
  let createdResourceId;

  beforeAll(async () => {
    app = createApp();

    // 1. Teacher Login
    const teacherRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'ayesha.math@school.pk', password: 'TeacherPassword123!' });

    expect(teacherRes.status).toBe(200);
    teacherCookies = teacherRes.headers['set-cookie'];
    const tCsrfCookie = teacherCookies.find((c) => c.startsWith('sms_csrf='));
    teacherCsrf = tCsrfCookie.split(';')[0].split('=')[1];

    const teacherRecord = await db('teachers')
      .join('users', 'teachers.user_id', 'users.id')
      .where('users.email', 'ayesha.math@school.pk')
      .select('teachers.id')
      .first();
    teacherId = teacherRecord.id;

    // 2. Clean tables for repeatable tests
    await db('task_submissions').del();
    await db('learning_resources').del();
    await db('learning_tasks').del();

    // 3. Find or create a student in Class 1
    let student = await db('students').where({ current_class_id: 1, status: 'ACTIVE' }).first();
    if (!student) {
      const [uid] = await db('users').insert({
        role_id: 4,
        username: `student_m5_${Date.now()}`,
        email: `student_m5_${Date.now()}@school.pk`,
        full_name: 'Module 5 Student',
        password_hash: 'hash',
        status: 'ACTIVE'
      });
      const [sid] = await db('students').insert({
        user_id: uid,
        admission_no: `ADM-M5-${Date.now()}`,
        roll_no: '01',
        admission_date: new Date().toISOString().split('T')[0],
        current_class_id: 1,
        status: 'ACTIVE'
      });
      student = await db('students').where({ id: sid }).first();
    }
    studentId = student.id;
    studentUser = await db('users').where({ id: student.user_id }).first();
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('Learning Tasks Creation & Listing', () => {
    it('should create a new learning task for Class 1', async () => {
      const futureDeadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

      const res = await request(app)
        .post('/api/v1/tasks')
        .set('Cookie', teacherCookies)
        .set('X-CSRF-Token', teacherCsrf)
        .send({
          sessionId: 1,
          classId: 1,
          subjectId: 1,
          teacherId,
          title: 'Assignment 4: Dividing Fractions Practice',
          instructions: 'Solve all 10 problems showing step-by-step reciprocals and reduction.',
          deadline: futureDeadline,
          totalMarks: 20,
          gradingScale: 'NUMERIC',
          handoutUrl: 'https://resources.school.pk/worksheets/fractions_ex4.pdf',
          handoutName: 'Fractions_Assignment_4.pdf'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.title).toBe('Assignment 4: Dividing Fractions Practice');
      expect(res.body.data.totalMarks).toBe(20);
      expect(res.body.data.submittedCount).toBe(0);
      expect(res.body.data.missingCount).toBeGreaterThan(0);

      createdTaskId = res.body.data.id;
    });

    it('should list tasks filtered by class', async () => {
      const res = await request(app)
        .get('/api/v1/tasks?classId=1')
        .set('Cookie', teacherCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((t) => t.id === createdTaskId)).toBe(true);
    });

    it('should get task details by ID with dynamic submission metrics', async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/${createdTaskId}`)
        .set('Cookie', teacherCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(createdTaskId);
      expect(res.body.data.className).toBeDefined();
      expect(res.body.data.subjectName).toBeDefined();
    });
  });

  describe('Student Task Submission', () => {
    it('should allow student to submit their homework assignment', async () => {
      const res = await request(app)
        .post(`/api/v1/tasks/${createdTaskId}/submit`)
        .set('Cookie', teacherCookies) // authenticated session with studentId override
        .set('X-CSRF-Token', teacherCsrf)
        .send({
          studentId,
          fileUrl: 'https://storage.school.pk/submissions/bella_fractions.pdf',
          fileName: 'Bella_Chen_Math_Fractions.pdf',
          fileSize: '1.4 MB • 2 Pages',
          studentNotes: 'Completed all problems and verified answers.'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.taskId).toBe(createdTaskId);
      expect(res.body.data.status).toBe('PENDING');
      expect(res.body.data.isLate).toBe(0);
      createdSubmissionId = res.body.data.id;
    });

    it('should reflect the new submission in task metrics', async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/${createdTaskId}`)
        .set('Cookie', teacherCookies);

      expect(res.status).toBe(200);
      expect(res.body.data.submittedCount).toBe(1);
      expect(res.body.data.pendingCount).toBe(1);
      expect(res.body.data.gradedCount).toBe(0);
    });
  });

  describe('Teacher Grading & Assessment', () => {
    it('should list submissions for the task', async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/${createdTaskId}/submissions`)
        .set('Cookie', teacherCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].id).toBe(createdSubmissionId);
    });

    it('should reject marks exceeding total marks (422 Validation Error)', async () => {
      const res = await request(app)
        .post(`/api/v1/tasks/submissions/${createdSubmissionId}/grade`)
        .set('Cookie', teacherCookies)
        .set('X-CSRF-Token', teacherCsrf)
        .send({
          marksAwarded: 25, // Total marks is 20!
          feedback: 'Too high'
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should successfully grade the submission with marks and feedback', async () => {
      const res = await request(app)
        .post(`/api/v1/tasks/submissions/${createdSubmissionId}/grade`)
        .set('Cookie', teacherCookies)
        .set('X-CSRF-Token', teacherCsrf)
        .send({
          marksAwarded: 18,
          rubricScores: { accuracy: 9, steps: 5, presentation: 4 },
          feedback: 'Excellent work! Clearly presented simplification steps.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('GRADED');
      expect(Number(res.body.data.marks_awarded)).toBe(18);
      expect(res.body.data.feedback).toBe('Excellent work! Clearly presented simplification steps.');
    });

    it('should update task gradedCount after grading', async () => {
      const res = await request(app)
        .get(`/api/v1/tasks/${createdTaskId}`)
        .set('Cookie', teacherCookies);

      expect(res.status).toBe(200);
      expect(res.body.data.gradedCount).toBe(1);
      expect(res.body.data.pendingCount).toBe(0);
    });
  });

  describe('Learning Resources Management', () => {
    it('should upload/create a learning resource for Class 1', async () => {
      const res = await request(app)
        .post('/api/v1/tasks/resources')
        .set('Cookie', teacherCookies)
        .set('X-CSRF-Token', teacherCsrf)
        .send({
          classId: 1,
          subjectId: 1,
          title: 'Fraction Division Lecture Slides Deck',
          description: 'Step-by-step visual slide deck with reciprocal rules and examples.',
          resourceType: 'SLIDES',
          fileUrl: 'https://resources.school.pk/slides/fractions_deck.pptx',
          fileSize: '4.2 MB'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      createdResourceId = res.body.data.id;
    });

    it('should list learning resources filtered by class', async () => {
      const res = await request(app)
        .get('/api/v1/tasks/resources?classId=1')
        .set('Cookie', teacherCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.some((r) => r.id === createdResourceId)).toBe(true);
      expect(res.body.data[0].resourceType).toBe('SLIDES');
    });

    it('should delete a learning resource', async () => {
      const res = await request(app)
        .delete(`/api/v1/tasks/resources/${createdResourceId}`)
        .set('Cookie', teacherCookies)
        .set('X-CSRF-Token', teacherCsrf);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.deleted).toBe(true);

      const listRes = await request(app)
        .get('/api/v1/tasks/resources?classId=1')
        .set('Cookie', teacherCookies);
      expect(listRes.body.data.some((r) => r.id === createdResourceId)).toBe(false);
    });
  });
});
