import request from 'supertest';
import { createApp } from '../src/app.js';
import { db } from '../src/shared/db/knex.js';

describe('Module 3: Timetable & Zoom Integration Tests', () => {
  let app;
  let principalCookies;
  let principalCsrf;
  let teacherCookies;
  let teacherCsrf;
  let teacherId;

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

    // 2. Teacher Login
    const teacherRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: 'ayesha.math@school.pk', password: 'TeacherPassword123!' });

    expect(teacherRes.status).toBe(200);
    teacherCookies = teacherRes.headers['set-cookie'];
    const tCsrfCookie = teacherCookies.find((c) => c.startsWith('sms_csrf='));
    teacherCsrf = tCsrfCookie.split(';')[0].split('=')[1];

    // Get Teacher profile ID
    const teacherRecord = await db('teachers')
      .join('users', 'teachers.user_id', 'users.id')
      .where('users.email', 'ayesha.math@school.pk')
      .select('teachers.id')
      .first();
    teacherId = teacherRecord.id;

    // Clean up timetable test tables for repeatable run
    await db('timetable_lessons').del();
    await db('timetable_slots').del();
    await db('timetable_change_log').del();
    await db('zoom_participant_log').del();
  });

  afterAll(async () => {
    await db.destroy();
  });

  describe('Zoom Class Meetings Setup & Monitoring', () => {
    it('should setup recurring Zoom meetings for all 8 classes', async () => {
      const res = await request(app)
        .post('/api/v1/zoom/class-meetings/setup')
        .set('Cookie', principalCookies)
        .set('X-CSRF-Token', principalCsrf)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const listRes = await request(app)
        .get('/api/v1/zoom/class-meetings')
        .set('Cookie', principalCookies);

      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);
      expect(listRes.body.data.length).toBe(8);
      expect(listRes.body.data[0].classNumber).toBe(1);
      expect(listRes.body.data[7].classNumber).toBe(8);
      expect(listRes.body.data[0].status).toBe('ACTIVE');
    });
  });

  describe('Timetable Slots and Conflict Checking', () => {
    let createdSlotId;

    it('should create a valid timetable slot', async () => {
      // Find active session
      const session = await db('academic_sessions').where({ is_current: 1 }).first();
      // Subject: Math (id 2) or any subject for Class 1
      const subject = await db('subjects').where({ code: 'MATH-1' }).first() || { id: 1 };

      const res = await request(app)
        .post('/api/v1/timetable/slots')
        .set('Cookie', principalCookies)
        .set('X-CSRF-Token', principalCsrf)
        .send({
          sessionId: session.id,
          classId: 1,
          subjectId: subject.id,
          teacherId: teacherId,
          weekday: 1, // Monday
          startTime: '08:30:00',
          endTime: '09:15:00',
          effectiveFrom: '2026-04-01'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      createdSlotId = res.body.data.id;
    });

    it('should reject overlapping slot for the SAME CLASS (409 Conflict)', async () => {
      const session = await db('academic_sessions').where({ is_current: 1 }).first();
      // Different teacher (e.g. teacher 2), same class, overlapping time (09:00 - 09:45)
      const res = await request(app)
        .post('/api/v1/timetable/slots')
        .set('Cookie', principalCookies)
        .set('X-CSRF-Token', principalCsrf)
        .send({
          sessionId: session.id,
          classId: 1,
          subjectId: 1,
          teacherId: 999, // Another teacher ID
          weekday: 1,
          startTime: '09:00:00',
          endTime: '09:45:00'
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SCHEDULE_CONFLICT');
      expect(res.body.error.message).toContain('Class already has another subject');
    });

    it('should reject overlapping slot for the SAME TEACHER in another class (409 Conflict)', async () => {
      const session = await db('academic_sessions').where({ is_current: 1 }).first();
      // Class 2, same teacher, overlapping time (08:45 - 09:30)
      const res = await request(app)
        .post('/api/v1/timetable/slots')
        .set('Cookie', principalCookies)
        .set('X-CSRF-Token', principalCsrf)
        .send({
          sessionId: session.id,
          classId: 2,
          subjectId: 1,
          teacherId: teacherId,
          weekday: 1,
          startTime: '08:45:00',
          endTime: '09:30:00'
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SCHEDULE_CONFLICT');
      expect(res.body.error.message).toContain('Teacher already has another class');
    });

    it('should allow slot for DIFFERENT CLASS and DIFFERENT TIME without conflict', async () => {
      const session = await db('academic_sessions').where({ is_current: 1 }).first();
      const res = await request(app)
        .post('/api/v1/timetable/slots')
        .set('Cookie', principalCookies)
        .set('X-CSRF-Token', principalCsrf)
        .send({
          sessionId: session.id,
          classId: 2,
          subjectId: 1,
          teacherId: teacherId,
          weekday: 1,
          startTime: '10:00:00',
          endTime: '10:45:00'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should list slots filtered by class and teacher', async () => {
      const res = await request(app)
        .get('/api/v1/timetable/slots?classId=1')
        .set('Cookie', principalCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.some((s) => s.id === createdSlotId)).toBe(true);
    });
  });

  describe('Publish Timetable & Generate Lessons', () => {
    it('should publish timetable and generate rolling window lessons', async () => {
      const session = await db('academic_sessions').where({ is_current: 1 }).first();

      const res = await request(app)
        .post('/api/v1/timetable/publish')
        .set('Cookie', principalCookies)
        .set('X-CSRF-Token', principalCsrf)
        .send({
          sessionId: session.id,
          days: 14
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBeGreaterThanOrEqual(1);

      const lessonsRes = await request(app)
        .get('/api/v1/timetable/lessons?classId=1')
        .set('Cookie', principalCookies);

      expect(lessonsRes.status).toBe(200);
      expect(lessonsRes.body.success).toBe(true);
      expect(lessonsRes.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Teacher Session & Live Class Lifecycle', () => {
    let testLessonId;

    beforeAll(async () => {
      // Create a test lesson for TODAY for Class 1 and Teacher
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const startAt = new Date(now.getTime() - 2 * 60 * 1000); // 2 mins ago (in window)
      const endAt = new Date(now.getTime() + 40 * 60 * 1000); // 40 mins later

      const meeting = await db('zoom_meetings').where({ class_id: 1, status: 'ACTIVE' }).first();

      const [lessonId] = await db('timetable_lessons').insert({
        class_id: 1,
        subject_id: 1,
        teacher_id: teacherId,
        zoom_meeting_id: meeting.id,
        lesson_date: today,
        start_at: startAt,
        end_at: endAt,
        status: 'SCHEDULED'
      });
      testLessonId = lessonId;
    });

    it('should show upcoming lessons for teacher', async () => {
      const res = await request(app)
        .get('/api/v1/zoom/my-class-session')
        .set('Cookie', teacherCookies);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      const lesson = res.body.data.find((l) => l.id === testLessonId);
      expect(lesson).toBeDefined();
      expect(lesson.canStart).toBe(true);
    });

    it('should start lesson and transition status to LIVE', async () => {
      const res = await request(app)
        .post(`/api/v1/zoom/sessions/${testLessonId}/start`)
        .set('Cookie', teacherCookies)
        .set('X-CSRF-Token', teacherCsrf)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('LIVE');
      expect(res.body.data.joinUrl).toBeDefined();
    });

    it('should allow student in Class 1 to access the LIVE class session', async () => {
      // Create or use student user
      const studentRes = await request(app)
        .get('/api/v1/zoom/student-class-session?classId=1')
        .set('Cookie', teacherCookies); // authenticated token

      expect(studentRes.status).toBe(200);
      expect(studentRes.body.success).toBe(true);
      expect(studentRes.body.data.inWindow).toBe(true);
      expect(studentRes.body.data.joinUrl).toContain('zoom.us');
    });

    it('should complete/end the lesson', async () => {
      const res = await request(app)
        .post(`/api/v1/zoom/sessions/${testLessonId}/end`)
        .set('Cookie', teacherCookies)
        .set('X-CSRF-Token', teacherCsrf)
        .send({
          topic: 'Algebraic Equations - Lesson 1',
          notes: 'Completed exercises 4.1 to 4.5'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('COMPLETED');
    });
  });

  describe('Lesson Cancellation & Substitution', () => {
    let cancelLessonId;
    let subLessonId;

    beforeAll(async () => {
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const meeting = await db('zoom_meetings').where({ class_id: 1, status: 'ACTIVE' }).first();

      const [cId] = await db('timetable_lessons').insert({
        class_id: 1,
        subject_id: 1,
        teacher_id: teacherId,
        zoom_meeting_id: meeting.id,
        lesson_date: today,
        start_at: new Date(now.getTime() + 2 * 60 * 60 * 1000),
        end_at: new Date(now.getTime() + 3 * 60 * 60 * 1000),
        status: 'SCHEDULED'
      });
      cancelLessonId = cId;

      const [sId] = await db('timetable_lessons').insert({
        class_id: 1,
        subject_id: 1,
        teacher_id: teacherId,
        zoom_meeting_id: meeting.id,
        lesson_date: today,
        start_at: new Date(now.getTime() + 4 * 60 * 60 * 1000),
        end_at: new Date(now.getTime() + 5 * 60 * 60 * 1000),
        status: 'SCHEDULED'
      });
      subLessonId = sId;
    });

    it('should cancel a lesson with reason', async () => {
      const res = await request(app)
        .post(`/api/v1/timetable/lessons/${cancelLessonId}/cancel`)
        .set('Cookie', principalCookies)
        .set('X-CSRF-Token', principalCsrf)
        .send({
          reason: 'Severe weather alert - afternoon classes suspended'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('CANCELLED');

      const lesson = await db('timetable_lessons').where({ id: cancelLessonId }).first();
      expect(lesson.status).toBe('CANCELLED');
      expect(lesson.cancel_reason).toBe('Severe weather alert - afternoon classes suspended');
    });

    it('should assign a substitute teacher to a scheduled lesson', async () => {
      const res = await request(app)
        .post(`/api/v1/timetable/lessons/${subLessonId}/substitute`)
        .set('Cookie', principalCookies)
        .set('X-CSRF-Token', principalCsrf)
        .send({
          substituteTeacherId: teacherId,
          reason: 'Primary teacher on medical leave'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const lesson = await db('timetable_lessons').where({ id: subLessonId }).first();
      expect(lesson.substitute_teacher_id).toBe(teacherId);
    });
  });
});
